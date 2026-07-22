import { useCallback, useEffect, useRef, useState } from 'react'

export type TestToneWaveform =
  | 'sine'
  | 'triangle'
  | 'square'
  | 'white-noise'
  | 'pink-noise'
  | 'brown-noise'

export type TestToneLevel = -20 | -18 | -12 | -6 | 0

type NoiseWaveform = Extract<TestToneWaveform, `${string}-noise`>
type OscillatorWaveform = Exclude<TestToneWaveform, NoiseWaveform>

export const TEST_TONE_WAVEFORMS: Array<{ value: TestToneWaveform; label: string }> = [
  { value: 'sine', label: 'サイン波' },
  { value: 'triangle', label: '三角波' },
  { value: 'square', label: '矩形波' },
  { value: 'white-noise', label: 'ホワイトノイズ' },
  { value: 'pink-noise', label: 'ピンクノイズ' },
  { value: 'brown-noise', label: 'ブラウンノイズ' },
]

export const TEST_TONE_LEVELS: TestToneLevel[] = [-20, -18, -12, -6, 0]

const TONE_FREQUENCY = 1000
const NOISE_BUFFER_SECONDS = 2
const GAIN_RAMP_SECONDS = 0.015

type ToneSource = OscillatorNode | AudioBufferSourceNode

function dbToGain(db: TestToneLevel): number {
  return 10 ** (db / 20)
}

function normalizeBuffer(buffer: Float32Array): Float32Array {
  let peak = 0
  for (const value of buffer) {
    const abs = Math.abs(value)
    if (abs > peak) peak = abs
  }

  if (peak === 0) return buffer
  const gain = 1 / peak
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] *= gain
  }
  return buffer
}

function createNoiseData(type: NoiseWaveform, length: number) {
  const data = new Float32Array(length)

  if (type === 'white-noise') {
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1
    }
    return normalizeBuffer(data)
  }

  if (type === 'pink-noise') {
    let b0 = 0
    let b1 = 0
    let b2 = 0
    let b3 = 0
    let b4 = 0
    let b5 = 0
    let b6 = 0

    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + white * 0.0555179
      b1 = 0.99332 * b1 + white * 0.0750759
      b2 = 0.969 * b2 + white * 0.153852
      b3 = 0.8665 * b3 + white * 0.3104856
      b4 = 0.55 * b4 + white * 0.5329522
      b5 = -0.7616 * b5 - white * 0.016898
      data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
      data[i] *= 0.11
      b6 = white * 0.115926
    }
    return normalizeBuffer(data)
  }

  let last = 0
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.5
  }
  return normalizeBuffer(data)
}

function createNoiseSource(ctx: AudioContext, type: NoiseWaveform) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * NOISE_BUFFER_SECONDS))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  buffer.getChannelData(0).set(createNoiseData(type, length))

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true
  return source
}

function isNoiseWaveform(
  waveform: TestToneWaveform
): waveform is NoiseWaveform {
  return waveform.endsWith('-noise')
}

function isOscillatorWaveform(waveform: TestToneWaveform): waveform is OscillatorWaveform {
  return waveform === 'sine' || waveform === 'triangle' || waveform === 'square'
}

export function useTestTone() {
  const [enabled, setEnabledState] = useState(false)
  const [waveform, setWaveformState] = useState<TestToneWaveform>('sine')
  const [level, setLevelState] = useState<TestToneLevel>(-20)
  const ctxRef = useRef<AudioContext | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const sourceRef = useRef<ToneSource | null>(null)
  const enabledRef = useRef(false)
  const waveformRef = useRef<TestToneWaveform>('sine')
  const levelRef = useRef<TestToneLevel>(-20)

  const ensureContext = useCallback(() => {
    if (ctxRef.current && gainRef.current) return ctxRef.current

    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) {
      throw new Error('Web Audio API is not supported')
    }

    const ctx = new AudioCtx()
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(ctx.destination)

    ctxRef.current = ctx
    gainRef.current = gain
    return ctx
  }, [])

  const stopSource = useCallback(() => {
    const source = sourceRef.current
    sourceRef.current = null
    if (!source) return

    try {
      source.stop()
    } catch {
      /* すでに停止済みなら無視 */
    }
    source.disconnect()
  }, [])

  const applyLevel = useCallback((nextLevel: TestToneLevel) => {
    const ctx = ctxRef.current
    const gain = gainRef.current
    if (!ctx || !gain) return

    gain.gain.cancelScheduledValues(ctx.currentTime)
    gain.gain.setTargetAtTime(dbToGain(nextLevel), ctx.currentTime, GAIN_RAMP_SECONDS)
  }, [])

  const startWaveform = useCallback(
    async (nextWaveform: TestToneWaveform, nextLevel: TestToneLevel) => {
      const ctx = ensureContext()
      const gain = gainRef.current
      if (!gain) {
        throw new Error('test tone gain is not initialized')
      }

      await ctx.resume()

      stopSource()

      let source: ToneSource
      if (isNoiseWaveform(nextWaveform)) {
        source = createNoiseSource(ctx, nextWaveform)
      } else if (isOscillatorWaveform(nextWaveform)) {
        const oscillator = ctx.createOscillator()
        oscillator.type = nextWaveform
        oscillator.frequency.value = TONE_FREQUENCY
        source = oscillator
      } else {
        throw new Error(`unsupported waveform: ${nextWaveform}`)
      }

      source.connect(gain)
      source.start()
      sourceRef.current = source
      applyLevel(nextLevel)
    },
    [applyLevel, ensureContext, stopSource]
  )

  const setWaveform = useCallback(
    async (nextWaveform: TestToneWaveform) => {
      waveformRef.current = nextWaveform
      setWaveformState(nextWaveform)

      if (enabledRef.current) await startWaveform(nextWaveform, levelRef.current)
    },
    [startWaveform]
  )

  const setEnabled = useCallback(
    async (nextEnabled: boolean) => {
      enabledRef.current = nextEnabled
      setEnabledState(nextEnabled)

      if (nextEnabled) {
        await startWaveform(waveformRef.current, levelRef.current)
        return
      }

      const ctx = ctxRef.current
      const gain = gainRef.current
      if (ctx && gain) {
        gain.gain.cancelScheduledValues(ctx.currentTime)
        gain.gain.setTargetAtTime(0, ctx.currentTime, GAIN_RAMP_SECONDS)
      }
      stopSource()
    },
    [startWaveform, stopSource]
  )

  const setLevel = useCallback(
    (nextLevel: TestToneLevel) => {
      levelRef.current = nextLevel
      setLevelState(nextLevel)
      if (enabledRef.current) applyLevel(nextLevel)
    },
    [applyLevel]
  )

  useEffect(() => {
    return () => {
      stopSource()
      gainRef.current?.disconnect()
      ctxRef.current?.close()
    }
  }, [stopSource])

  return {
    enabled,
    waveform,
    level,
    setEnabled,
    setWaveform,
    setLevel,
  }
}
