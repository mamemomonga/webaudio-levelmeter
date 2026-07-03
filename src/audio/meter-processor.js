// AudioWorkletProcessor: レベルメータ用DSP
//
// - ステレオのサンプルピーク / トゥルーピーク(4倍オーバーサンプリング)
// - ITU-R BS.1770 K特性フィルタによるラウドネス(モメンタリー / ショートターム)
// - ステレオ相関・チャンネルエネルギーの算出
//
// 計測結果は一定間隔でメインスレッドへ postMessage する。
// 本ファイルは import を持たない自己完結モジュールとして addModule される。

// ITU-R BS.1770 K特性フィルタ係数(サンプルレート依存)を算出する。
function kWeightingCoeffs(fs) {
  // ステージ1: ハイシェルフ(頭部・胴体の音響効果を模擬)
  let f0 = 1681.9744509555319
  const G = 3.99984385397
  let Q = 0.7071752369554193
  let K = Math.tan(Math.PI * f0 / fs)
  const Vh = Math.pow(10, G / 20)
  const Vb = Math.pow(Vh, 0.499666774155)
  let a0 = 1 + K / Q + K * K
  const s1 = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  }

  // ステージ2: ハイパスフィルタ
  f0 = 38.13547087613982
  Q = 0.5003270373253953
  K = Math.tan(Math.PI * f0 / fs)
  a0 = 1 + K / Q + K * K
  const s2 = {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  }

  return [s1, s2]
}

// バイキャッド1段分の状態(Direct Form I)
function newBiquadState() {
  return { x1: 0, x2: 0, y1: 0, y2: 0 }
}

class MeterProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    const fs = sampleRate
    this.fs = fs

    const [c1, c2] = kWeightingCoeffs(fs)
    this.c1 = c1
    this.c2 = c2

    // L / R それぞれ2段のフィルタ状態
    this.kState = [
      { s1: newBiquadState(), s2: newBiquadState() },
      { s1: newBiquadState(), s2: newBiquadState() },
    ]

    // ラウドネス積算(100msブロック単位)
    this.blockSamples = Math.round(fs * 0.1)
    this.blockCount = 0
    this.blockSumL = 0
    this.blockSumR = 0
    this.ring = [] // 各要素 {sumL, sumR, n}
    this.maxBlocks = 30 // ショートターム = 3秒 = 30ブロック
    this.momentary = -Infinity
    this.shortTerm = -Infinity
    this.longTerm = -Infinity
    this.totalSumL = 0
    this.totalSumR = 0
    this.totalCount = 0

    // トゥルーピーク用オーバーサンプラ
    this.buildOversampler()
    this.tpL = { buf: new Float32Array(this.tpTaps), pos: 0 }
    this.tpR = { buf: new Float32Array(this.tpTaps), pos: 0 }

    // 送信間隔(約30ms)
    this.postSamples = Math.round(fs * 0.03)
    this.postCount = 0
    this.resetPostAccum()
  }

  // 送信ウィンドウ用アキュムレータの初期化
  resetPostAccum() {
    this.peakLinL = 0
    this.peakLinR = 0
    this.tpLinL = 0
    this.tpLinR = 0
    this.sumL2 = 0
    this.sumR2 = 0
    this.sumLR = 0
  }

  // 4倍オーバーサンプリング用ポリフェーズFIRを構築する。
  buildOversampler() {
    const OS = 4
    const P = 12 // 位相あたりのタップ数
    const N = OS * P
    const center = (N - 1) / 2
    const raw = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const k = i - center
      const t = (Math.PI * k) / OS
      const sinc = k === 0 ? 1 : Math.sin(t) / t
      // ブラックマン窓
      const w =
        0.42 -
        0.5 * Math.cos((2 * Math.PI * i) / (N - 1)) +
        0.08 * Math.cos((4 * Math.PI * i) / (N - 1))
      raw[i] = sinc * w
    }
    // 位相ごとに分解し、各位相のDCゲインを1に正規化
    this.phases = []
    for (let p = 0; p < OS; p++) {
      const ph = new Float32Array(P)
      let s = 0
      for (let j = 0; j < P; j++) {
        ph[j] = raw[p + OS * j]
        s += ph[j]
      }
      for (let j = 0; j < P; j++) ph[j] /= s
      this.phases.push(ph)
    }
    this.tpTaps = P
  }

  // 1サンプルをオーバーサンプリングし、補間点を含む最大絶対値を返す。
  overSamplePeak(state, x) {
    const P = this.tpTaps
    const buf = state.buf
    state.pos = (state.pos + 1) % P
    buf[state.pos] = x
    let peak = 0
    for (let p = 0; p < this.phases.length; p++) {
      const ph = this.phases[p]
      let acc = 0
      for (let j = 0; j < P; j++) {
        const idx = (state.pos - j + P) % P
        acc += ph[j] * buf[idx]
      }
      const a = Math.abs(acc)
      if (a > peak) peak = a
    }
    return peak
  }

  // K特性フィルタ(2段バイキャッド)を1サンプル適用する。
  kweight(ch, x) {
    const st = this.kState[ch]
    let s = st.s1
    let c = this.c1
    const y1 = c.b0 * x + c.b1 * s.x1 + c.b2 * s.x2 - c.a1 * s.y1 - c.a2 * s.y2
    s.x2 = s.x1
    s.x1 = x
    s.y2 = s.y1
    s.y1 = y1

    s = st.s2
    c = this.c2
    const y2 = c.b0 * y1 + c.b1 * s.x1 + c.b2 * s.x2 - c.a1 * s.y1 - c.a2 * s.y2
    s.x2 = s.x1
    s.x1 = y1
    s.y2 = s.y1
    s.y1 = y2

    return y2
  }

  // 100msブロックを確定してリングに積み、ラウドネスを更新する。
  pushBlock() {
    this.ring.push({ sumL: this.blockSumL, sumR: this.blockSumR, n: this.blockCount })
    if (this.ring.length > this.maxBlocks) this.ring.shift()
    this.totalSumL += this.blockSumL
    this.totalSumR += this.blockSumR
    this.totalCount += this.blockCount
    this.momentary = this.loudnessOver(4) // 400ms
    this.shortTerm = this.loudnessOver(30) // 3s
    this.longTerm = this.loudnessFromSums(this.totalSumL, this.totalSumR, this.totalCount)
    this.blockSumL = 0
    this.blockSumR = 0
    this.blockCount = 0
  }

  // 合計エネルギーからラウドネス(LUFS)を算出する。
  loudnessFromSums(sL, sR, n) {
    if (n === 0) return -Infinity
    const sum = sL / n + sR / n // 前方2ch は重み G=1.0
    if (sum <= 0) return -Infinity
    return -0.691 + 10 * Math.log10(sum)
  }

  // 直近 count ブロックからラウドネス(LUFS)を算出する。
  loudnessOver(count) {
    const start = Math.max(0, this.ring.length - count)
    let sL = 0
    let sR = 0
    let nn = 0
    for (let i = start; i < this.ring.length; i++) {
      sL += this.ring[i].sumL
      sR += this.ring[i].sumR
      nn += this.ring[i].n
    }
    return this.loudnessFromSums(sL, sR, nn)
  }

  postUpdate() {
    const toDb = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity)
    let correlation = 0
    const denom = Math.sqrt(this.sumL2 * this.sumR2)
    if (denom > 1e-12) correlation = this.sumLR / denom

    this.port.postMessage({
      peakL: toDb(this.peakLinL),
      peakR: toDb(this.peakLinR),
      truePeakL: toDb(this.tpLinL),
      truePeakR: toDb(this.tpLinR),
      momentary: this.momentary,
      shortTerm: this.shortTerm,
      longTerm: this.longTerm,
      energyL: this.sumL2,
      energyR: this.sumR2,
      correlation,
    })

    this.resetPostAccum()
    this.postCount = 0
  }

  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true

    const L = input[0]
    const R = input.length > 1 ? input[1] : input[0]
    const n = L.length
    if (n === 0) return true

    for (let i = 0; i < n; i++) {
      const l = L[i]
      const r = R[i]

      const al = l < 0 ? -l : l
      const ar = r < 0 ? -r : r
      if (al > this.peakLinL) this.peakLinL = al
      if (ar > this.peakLinR) this.peakLinR = ar

      this.sumL2 += l * l
      this.sumR2 += r * r
      this.sumLR += l * r

      const tpl = this.overSamplePeak(this.tpL, l)
      const tpr = this.overSamplePeak(this.tpR, r)
      if (tpl > this.tpLinL) this.tpLinL = tpl
      if (tpr > this.tpLinR) this.tpLinR = tpr

      const kl = this.kweight(0, l)
      const kr = this.kweight(1, r)
      this.blockSumL += kl * kl
      this.blockSumR += kr * kr
      this.blockCount++
      if (this.blockCount >= this.blockSamples) this.pushBlock()

      this.postCount++
      if (this.postCount >= this.postSamples) this.postUpdate()
    }

    return true
  }
}

registerProcessor('meter-processor', MeterProcessor)
