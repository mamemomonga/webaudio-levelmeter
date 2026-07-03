import { useCallback, useEffect, useRef, useState } from 'react'
import processorUrl from './meter-processor.js?url'

// メータの下限(dB)。この値をメータ底とする。
export const METER_FLOOR = -60
// トゥルーピークの上限しきい値(dBTP)
export const TRUE_PEAK_LIMIT = -1.0
// ラウドネスのターゲット(LUFS)
export const TARGET_LUFS = -14

// ピークホールドの挙動
const HOLD_TIME = 1.2 // 秒
const RELEASE_RATE = 14 // dB/秒
const PEAK_LAMP_HOLD_TIME = 3.0 // 秒

// ステレオ判定・エネルギー平滑化の時定数(秒)
const SMOOTH_TAU = 0.25
// 有信号とみなす下限(dBFS相当)
const ACTIVE_FLOOR = -55

const AUDIO_CONSTRAINTS = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
}

function safeDb(v) {
  return Number.isFinite(v) ? v : METER_FLOOR
}

// 平滑化済みエネルギーと相関からステレオ状態を判定する。
function classifyStereo(eL, eR, corr) {
  const levelL = eL > 0 ? 10 * Math.log10(eL) : -Infinity
  const levelR = eR > 0 ? 10 * Math.log10(eR) : -Infinity
  const maxLevel = Math.max(levelL, levelR)
  const minLevel = Math.min(levelL, levelR)

  if (maxLevel < ACTIVE_FLOOR) return 'silent'
  // 片方が他方より40dB以上小さい → 片チャンネル
  if (minLevel < maxLevel - 40 || minLevel < ACTIVE_FLOOR - 10) return 'single'
  if (corr > 0.99) return 'mono'
  if (corr < -0.99) return 'inverted'
  return 'stereo'
}

export function useAudioMeter() {
  const [status, setStatus] = useState('idle') // idle | running | error
  const [error, setError] = useState(null)
  const [devices, setDevices] = useState([])
  const [currentDeviceId, setCurrentDeviceId] = useState(null)
  const [currentDeviceLabel, setCurrentDeviceLabel] = useState('')

  // レンダリング用の計測データ(rAFで更新)
  const [data, setData] = useState({
    peakL: METER_FLOOR,
    peakR: METER_FLOOR,
    holdL: METER_FLOOR,
    holdR: METER_FLOOR,
    truePeak: METER_FLOOR,
    shortTerm: -Infinity,
    longTerm: -Infinity,
    momentary: -Infinity,
    stereoMode: 'silent',
    peakOver: false,
  })

  const ctxRef = useRef(null)
  const nodeRef = useRef(null)
  const streamRef = useRef(null)
  const latestRef = useRef(null) // worklet からの最新メッセージ
  const rafRef = useRef(0)
  const peakOverUntilRef = useRef(0)

  // rAFで維持する状態(ピークホールド・平滑化)
  const holdRef = useRef({ l: METER_FLOOR, r: METER_FLOOR, tL: 0, tR: 0 })
  const smoothRef = useRef({ eL: 0, eR: 0, corr: 0 })
  const lastTimeRef = useRef(0)

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
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
    async (deviceId) => {
      const ctx = ctxRef.current
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
      // 既存ノードを繋ぎ替え
      try {
        source.connect(nodeRef.current)
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
      const ctx = new AudioCtx()
      ctxRef.current = ctx
      await ctx.audioWorklet.addModule(processorUrl)

      const node = new AudioWorkletNode(ctx, 'meter-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      })
      nodeRef.current = node
      node.port.onmessage = (e) => {
        latestRef.current = e.data
      }

      // グラフを駆動するため無音(ゲイン0)で destination に接続
      const zero = ctx.createGain()
      zero.gain.value = 0
      node.connect(zero)
      zero.connect(ctx.destination)

      await connect(null)
      if (ctx.state === 'suspended') await ctx.resume()

      setStatus('running')
      startLoop()
    } catch (err) {
      console.error(err)
      setError(err && err.message ? err.message : String(err))
      setStatus('error')
    }
  }, [connect])

  const selectDevice = useCallback(
    async (deviceId) => {
      try {
        await connect(deviceId)
      } catch (err) {
        console.error(err)
        setError(err && err.message ? err.message : String(err))
      }
    },
    [connect]
  )

  // rAFループ: ピークホールド減衰・平滑化・状態更新
  const startLoop = useCallback(() => {
    const loop = (now) => {
      rafRef.current = requestAnimationFrame(loop)
      const t = now / 1000
      const dt = lastTimeRef.current ? t - lastTimeRef.current : 0
      lastTimeRef.current = t

      const m = latestRef.current
      if (!m) return

      const peakL = safeDb(m.peakL)
      const peakR = safeDb(m.peakR)

      // ピークホールド(L/R)
      const hold = holdRef.current
      for (const [ch, val] of [
        ['l', peakL],
        ['r', peakR],
      ]) {
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

      // トゥルーピーク(L/R最大)と -1.0dBTP 超過後3秒のランプ保持
      const truePeak = Math.max(safeDb(m.truePeakL), safeDb(m.truePeakR))
      if (truePeak > TRUE_PEAK_LIMIT) peakOverUntilRef.current = t + PEAK_LAMP_HOLD_TIME
      const peakOver = t < peakOverUntilRef.current

      // エネルギー・相関の平滑化
      const sm = smoothRef.current
      const a = dt > 0 ? 1 - Math.exp(-dt / SMOOTH_TAU) : 0
      sm.eL += (m.energyL - sm.eL) * a
      sm.eR += (m.energyR - sm.eR) * a
      sm.corr += (m.correlation - sm.corr) * a
      const stereoMode = classifyStereo(sm.eL, sm.eR, sm.corr)

      setData({
        peakL,
        peakR,
        holdL: hold.l,
        holdR: hold.r,
        truePeak,
        shortTerm: m.shortTerm,
        longTerm: m.longTerm,
        momentary: m.momentary,
        stereoMode,
        peakOver,
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
      if (ctxRef.current) ctxRef.current.close()
    }
  }, [stopStream])

  return {
    status,
    error,
    devices,
    currentDeviceId,
    currentDeviceLabel,
    data,
    start,
    selectDevice,
  }
}
