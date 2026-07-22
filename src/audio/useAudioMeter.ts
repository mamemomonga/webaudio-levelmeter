import { useCallback, useEffect, useRef, useState } from 'react'
import processorUrl from './meter-processor.ts?worker&url'

// メータの下限(dB)。この値をメータ底とする。
export const METER_FLOOR = -60
// ピーク数値表示はこの値以上を表示し、未満は -∞ とする。バー表示は METER_FLOOR のまま。
const PEAK_READOUT_FLOOR = -120
// トゥルーピークの上限しきい値(dBTP)
export const TRUE_PEAK_LIMIT = -1.0
// ラウドネスのターゲット(LUFS)
export const TARGET_LUFS = -15

// ピークホールドの挙動
const HOLD_TIME = 1.2 // 秒
const RELEASE_RATE = 14 // dB/秒
const PEAK_LAMP_HOLD_TIME = 0.5 // 秒
const PEAK_READOUT_INTERVAL = 1.0 // 秒

const COMPRESSOR_LEVEL_MIN = 0
const COMPRESSOR_LEVEL_MAX = 30

// ステレオ判定・エネルギー平滑化の時定数(秒)
const SMOOTH_TAU = 0.25
// 有信号とみなす下限(dBFS相当)
const ACTIVE_FLOOR = -55
const SINGLE_CHANNEL_GAP = 30 // dB
const CORRELATED_LEVEL_GAP = 3 // dB
const MONO_DIFF_GAP = 24 // dB
const MONO_CORRELATION = 0.95
const INVERTED_CORRELATION = -0.95

const AUDIO_CONSTRAINTS = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
} satisfies MediaTrackConstraints

export type MeterStatus = 'idle' | 'running' | 'error'
export type StereoMode = 'silent' | 'single' | 'mono' | 'inverted' | 'stereo'

export type MeterData = {
  peakL: number
  peakR: number
  holdL: number
  holdR: number
  shortTerm: number
  momentary: number
  stereoMode: StereoMode
  peakOverL: boolean
  peakOverR: boolean
  peakReadoutL: number
  peakReadoutR: number
  phaseScope: Float32Array
}

type ProcessorMessage = {
  peakL: number
  peakR: number
  truePeakL: number
  truePeakR: number
  momentary: number
  shortTerm: number
  energyL: number
  energyR: number
  diffEnergy?: number
  correlation: number
  phaseScope?: Float32Array
}

type HoldState = {
  l: number
  r: number
  tL: number
  tR: number
}

type SmoothState = {
  eL: number
  eR: number
  eDiff: number
  corr: number
}

type PeakReadoutState = {
  l: number
  r: number
  nextAt: number
  displayL: number
  displayR: number
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function safeDb(v: number): number {
  return Number.isFinite(v) ? v : METER_FLOOR
}

function safePeakReadoutDb(v: number): number {
  if (!Number.isFinite(v) || v < PEAK_READOUT_FLOOR) return -Infinity
  return v
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// 平滑化済みエネルギー、L-R音量、相関からステレオ状態を判定する。
function classifyStereo(
  eL: number,
  eR: number,
  eDiff: number,
  corr: number
): StereoMode {
  const levelL = eL > 0 ? 10 * Math.log10(eL) : -Infinity
  const levelR = eR > 0 ? 10 * Math.log10(eR) : -Infinity
  const diffLevel = eDiff > 0 ? 10 * Math.log10(eDiff) : -Infinity
  const maxLevel = Math.max(levelL, levelR)
  const minLevel = Math.min(levelL, levelR)
  const levelGap = maxLevel - minLevel

  if (maxLevel < ACTIVE_FLOOR) return 'silent'
  if (minLevel < ACTIVE_FLOOR || levelGap >= SINGLE_CHANNEL_GAP) return 'single'
  const diffIsSmall = diffLevel <= maxLevel - MONO_DIFF_GAP
  if (levelGap <= CORRELATED_LEVEL_GAP && (corr >= MONO_CORRELATION || diffIsSmall)) {
    return 'mono'
  }
  if (levelGap <= CORRELATED_LEVEL_GAP && corr <= INVERTED_CORRELATION) return 'inverted'
  return 'stereo'
}

export function useAudioMeter() {
  const [status, setStatus] = useState<MeterStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null)
  const [currentDeviceLabel, setCurrentDeviceLabel] = useState('')
  const [outputEnabled, setOutputEnabledState] = useState(false)
  const [compressorEnabled, setCompressorEnabledState] = useState(false)
  const [compressorLevelDb, setCompressorLevelDbState] = useState(0)

  // レンダリング用の計測データ(rAFで更新)
  const [data, setData] = useState<MeterData>({
    peakL: METER_FLOOR,
    peakR: METER_FLOOR,
    holdL: METER_FLOOR,
    holdR: METER_FLOOR,
    shortTerm: -Infinity,
    momentary: -Infinity,
    stereoMode: 'silent',
    peakOverL: false,
    peakOverR: false,
    peakReadoutL: -Infinity,
    peakReadoutR: -Infinity,
    phaseScope: new Float32Array(0),
  })

  const ctxRef = useRef<AudioContext | null>(null)
  const nodeRef = useRef<AudioWorkletNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const monitorGainRef = useRef<GainNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const latestRef = useRef<ProcessorMessage | null>(null) // worklet からの最新メッセージ
  const rafRef = useRef(0)
  const peakOverUntilRef = useRef({ l: 0, r: 0 })
  const outputEnabledRef = useRef(false)
  const compressorEnabledRef = useRef(false)
  const compressorLevelDbRef = useRef(0)

  // rAFで維持する状態(ピークホールド・平滑化)
  const holdRef = useRef<HoldState>({ l: METER_FLOOR, r: METER_FLOOR, tL: 0, tR: 0 })
  const smoothRef = useRef<SmoothState>({ eL: 0, eR: 0, eDiff: 0, corr: 0 })
  const peakReadoutRef = useRef<PeakReadoutState>({
    l: -Infinity,
    r: -Infinity,
    nextAt: 0,
    displayL: -Infinity,
    displayR: -Infinity,
  })
  const lastTimeRef = useRef(0)

  const stopStream = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect()
      } catch {
        /* noop */
      }
      sourceRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const applyAudioControls = useCallback(() => {
    const ctx = ctxRef.current
    const node = nodeRef.current
    const monitorGain = monitorGainRef.current

    if (node) {
      node.port.postMessage({
        compressorEnabled: compressorEnabledRef.current,
        levelDb: clamp(compressorLevelDbRef.current, COMPRESSOR_LEVEL_MIN, COMPRESSOR_LEVEL_MAX),
      })
    }

    if (monitorGain) {
      const nextGain = outputEnabledRef.current ? 1 : 0
      if (ctx) {
        monitorGain.gain.setTargetAtTime(nextGain, ctx.currentTime, 0.015)
      } else {
        monitorGain.gain.value = nextGain
      }
    }
  }, [])

  // デバイス一覧を更新する。
  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices()
      setDevices(list.filter((d) => d.kind === 'audioinput'))
    } catch {
      /* 取得失敗は無視 */
    }
  }, [])

  // 指定デバイス(未指定は既定)へ接続する。
  const connect = useCallback(
    async (deviceId: string | null) => {
      const ctx = ctxRef.current
      const node = nodeRef.current
      if (!ctx || !node) {
        throw new Error('audio context is not initialized')
      }

      stopStream()

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...AUDIO_CONSTRAINTS,
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
        video: false,
      })
      streamRef.current = stream

      const track = stream.getAudioTracks()[0]
      const settings = track.getSettings()
      setCurrentDeviceId(settings.deviceId || deviceId || null)
      setCurrentDeviceLabel(track.label || '入力デバイス')

      const source = ctx.createMediaStreamSource(stream)
      sourceRef.current = source
      // 入力はWorklet内でコンプレッサー処理後に計測・モニター出力する
      try {
        source.connect(node)
      } catch {
        /* noop */
      }

      await refreshDevices()
    },
    [refreshDevices, stopStream]
  )

  // 計測開始(ユーザー操作から呼び出す)
  const start = useCallback(async () => {
    try {
      setError(null)
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) {
        throw new Error('Web Audio API is not supported')
      }

      const ctx = new AudioCtx()
      ctxRef.current = ctx
      await ctx.audioWorklet.addModule(processorUrl)

      const node = new AudioWorkletNode(ctx, 'meter-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      })
      nodeRef.current = node
      node.port.onmessage = (e) => {
        latestRef.current = e.data
      }

      const monitorGain = ctx.createGain()
      monitorGain.gain.value = outputEnabledRef.current ? 1 : 0
      monitorGainRef.current = monitorGain

      node.connect(monitorGain)
      monitorGain.connect(ctx.destination)
      applyAudioControls()

      await connect(null)
      if (ctx.state === 'suspended') await ctx.resume()

      setStatus('running')
      startLoop()
    } catch (err) {
      console.error(err)
      setError(errorMessage(err))
      setStatus('error')
    }
  }, [connect])

  const selectDevice = useCallback(
    async (deviceId: string) => {
      try {
        await connect(deviceId)
      } catch (err) {
        console.error(err)
        setError(errorMessage(err))
      }
    },
    [connect]
  )

  const setOutputEnabled = useCallback(
    (enabled: boolean) => {
      outputEnabledRef.current = enabled
      setOutputEnabledState(enabled)
      applyAudioControls()
    },
    [applyAudioControls]
  )

  const setCompressorEnabled = useCallback(
    (enabled: boolean) => {
      compressorEnabledRef.current = enabled
      setCompressorEnabledState(enabled)
      applyAudioControls()
    },
    [applyAudioControls]
  )

  const setCompressorLevelDb = useCallback(
    (level: number) => {
      const next = clamp(level, COMPRESSOR_LEVEL_MIN, COMPRESSOR_LEVEL_MAX)
      compressorLevelDbRef.current = next
      setCompressorLevelDbState(next)
      applyAudioControls()
    },
    [applyAudioControls]
  )

  // rAFループ: ピークホールド減衰・平滑化・状態更新
  const startLoop = useCallback(() => {
    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop)
      const t = now / 1000
      const dt = lastTimeRef.current ? t - lastTimeRef.current : 0
      lastTimeRef.current = t

      const m = latestRef.current
      if (!m) return

      const peakL = safeDb(m.peakL)
      const peakR = safeDb(m.peakR)
      const peakReadoutL = safePeakReadoutDb(m.peakL)
      const peakReadoutR = safePeakReadoutDb(m.peakR)

      const readout = peakReadoutRef.current
      if (!readout.nextAt) readout.nextAt = t + PEAK_READOUT_INTERVAL
      readout.l = Math.max(readout.l, peakReadoutL)
      readout.r = Math.max(readout.r, peakReadoutR)
      if (t >= readout.nextAt) {
        readout.displayL = readout.l
        readout.displayR = readout.r
        readout.l = -Infinity
        readout.r = -Infinity
        readout.nextAt = t + PEAK_READOUT_INTERVAL
      }

      // ピークホールド(L/R)
      const hold = holdRef.current
      const channels: Array<{ ch: 'l' | 'r'; val: number }> = [
        { ch: 'l', val: peakL },
        { ch: 'r', val: peakR },
      ]

      for (const { ch, val } of channels) {
        const tKey = ch === 'l' ? 'tL' : 'tR'
        if (val >= hold[ch]) {
          hold[ch] = val
          hold[tKey] = 0
        } else {
          hold[tKey] += dt
          if (hold[tKey] > HOLD_TIME) {
            hold[ch] = Math.max(METER_FLOOR, hold[ch] - RELEASE_RATE * dt)
          }
        }
      }

      // トゥルーピークと -1.0dBTP 超過後のランプ保持
      const truePeakL = safeDb(m.truePeakL)
      const truePeakR = safeDb(m.truePeakR)
      const peakOverUntil = peakOverUntilRef.current
      if (truePeakL > TRUE_PEAK_LIMIT) peakOverUntil.l = t + PEAK_LAMP_HOLD_TIME
      if (truePeakR > TRUE_PEAK_LIMIT) peakOverUntil.r = t + PEAK_LAMP_HOLD_TIME
      const peakOverL = t < peakOverUntil.l
      const peakOverR = t < peakOverUntil.r

      // エネルギー・相関の平滑化
      const sm = smoothRef.current
      const a = dt > 0 ? 1 - Math.exp(-dt / SMOOTH_TAU) : 0
      sm.eL += (m.energyL - sm.eL) * a
      sm.eR += (m.energyR - sm.eR) * a
      sm.eDiff += ((m.diffEnergy || 0) - sm.eDiff) * a
      sm.corr += (m.correlation - sm.corr) * a
      const stereoMode = classifyStereo(sm.eL, sm.eR, sm.eDiff, sm.corr)

      setData({
        peakL,
        peakR,
        holdL: hold.l,
        holdR: hold.r,
        shortTerm: m.shortTerm,
        momentary: m.momentary,
        stereoMode,
        peakOverL,
        peakOverR,
        peakReadoutL: readout.displayL,
        peakReadoutR: readout.displayR,
        phaseScope: m.phaseScope ?? new Float32Array(0),
      })
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  // デバイス変更を監視
  useEffect(() => {
    const handler = () => refreshDevices()
    navigator.mediaDevices?.addEventListener?.('devicechange', handler)
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', handler)
  }, [refreshDevices])

  // クリーンアップ
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      stopStream()
      monitorGainRef.current?.disconnect()
      nodeRef.current?.disconnect()
      if (ctxRef.current) ctxRef.current.close()
    }
  }, [stopStream])

  return {
    status,
    error,
    devices,
    currentDeviceId,
    currentDeviceLabel,
    outputEnabled,
    compressorEnabled,
    compressorLevelDb,
    data,
    start,
    selectDevice,
    setOutputEnabled,
    setCompressorEnabled,
    setCompressorLevelDb,
  }
}
