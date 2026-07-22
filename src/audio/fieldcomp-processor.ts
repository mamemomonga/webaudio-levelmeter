// DSP core ported from:
// https://tangled.org/mamemomonga.bsky.social/simple-js-comp/blob/main/src/audio/fieldcomp-processor.js
//
// 元実装はAudioWorkletProcessorだが、このファイルではメータ処理から再利用しやすい
// 1フレーム処理クラスとして分離している。

const LEVEL_MAX_DB = 30
const COMP_THRESHOLD_DB = -18
const RATIO_EXPONENT = 0.75
const ATTACK_SECONDS = 0.005
const RELEASE_SECONDS = 0.15
const COMP_CONTROL_INTERVAL = 8
const MAKEUP_TARGET_LUFS = -14
const LUFS_OFFSET = 0.691
const MAKEUP_TARGET_RMS_DB = MAKEUP_TARGET_LUFS + LUFS_OFFSET
const MAKEUP_WINDOW_SECONDS = 0.4
const MAKEUP_REACTION_SECONDS = 1
const MAKEUP_MAX_DB = 20
const MAKEUP_MIN_DB = 0
const MAKEUP_GATE_DB = -45
const MAKEUP_CONTROL_INTERVAL = 32
const LIMITER_ATTACK_SECONDS = 0.0005
const LIMITER_RELEASE_SECONDS = 0.05
const LIMITER_CEILING_DB = -1
const LIMITER_LOOKAHEAD_AT_48K = 96

export type FieldCompConfig = {
  compressorEnabled?: boolean
  levelDb?: number
  monoMicEnabled?: boolean
}

function dbToLinear(db: number): number {
  return 10 ** (db / 20)
}

function meanSquareDb(ms: number): number {
  return ms > 0 ? 10 * Math.log10(ms) : -Infinity
}

function smoothingCoeff(seconds: number, fs: number): number {
  return Math.exp(-1 / (seconds * fs))
}

export class FieldCompProcessor {
  private compressorEnabled = false
  private monoMicEnabled = false
  private levelGain = 1
  private compThreshold = dbToLinear(COMP_THRESHOLD_DB)
  private compTarget = 1
  private compGain = 1
  private compPeak = 0
  private compCount = 0
  private attackCoeff: number
  private releaseCoeff: number
  private makeupMs = dbToLinear(2 * MAKEUP_TARGET_RMS_DB)
  private makeupGainDb = 0
  private makeupGain = 1
  private makeupWindowAlpha: number
  private makeupReactionAlpha: number
  private makeupGateMs = dbToLinear(2 * MAKEUP_GATE_DB)
  private makeupCount = 0
  private limiterGain = 1
  private limiterAttackCoeff: number
  private limiterReleaseCoeff: number
  private limiterCeiling = dbToLinear(LIMITER_CEILING_DB)
  private limiterPeak = 0
  private limiterHold = 0
  private lookahead: number
  private laBufL: Float32Array
  private laBufR: Float32Array
  private laPos = 0

  constructor(fs: number) {
    this.attackCoeff = smoothingCoeff(ATTACK_SECONDS, fs)
    this.releaseCoeff = smoothingCoeff(RELEASE_SECONDS, fs)
    this.makeupWindowAlpha = 1 / (MAKEUP_WINDOW_SECONDS * fs)
    this.makeupReactionAlpha = MAKEUP_CONTROL_INTERVAL / fs / MAKEUP_REACTION_SECONDS
    this.limiterAttackCoeff = smoothingCoeff(LIMITER_ATTACK_SECONDS, fs)
    this.limiterReleaseCoeff = smoothingCoeff(LIMITER_RELEASE_SECONDS, fs)
    this.lookahead = Math.max(1, Math.round((LIMITER_LOOKAHEAD_AT_48K * fs) / 48000))
    this.laBufL = new Float32Array(this.lookahead)
    this.laBufR = new Float32Array(this.lookahead)
  }

  updateConfig(data: FieldCompConfig): void {
    if (typeof data.compressorEnabled === 'boolean') {
      if (data.compressorEnabled !== this.compressorEnabled) this.resetCompState()
      this.compressorEnabled = data.compressorEnabled
    }
    if (typeof data.levelDb === 'number') {
      const db = Math.max(0, Math.min(LEVEL_MAX_DB, data.levelDb))
      this.levelGain = dbToLinear(db)
    }
    if (typeof data.monoMicEnabled === 'boolean') {
      this.monoMicEnabled = data.monoMicEnabled
    }
  }

  resetCompState(): void {
    this.compTarget = 1
    this.compGain = 1
    this.compPeak = 0
    this.compCount = 0
    this.makeupMs = dbToLinear(2 * MAKEUP_TARGET_RMS_DB)
    this.makeupGainDb = 0
    this.makeupGain = 1
    this.makeupCount = 0
    this.limiterGain = 1
    this.limiterPeak = 0
    this.limiterHold = 0
    this.laBufL.fill(0)
    this.laBufR.fill(0)
    this.laPos = 0
  }

  processFrame(left: number, right: number): [number, number] {
    const inputRight = this.monoMicEnabled ? left : right
    return this.compressorEnabled ? this.compressFrame(left, inputRight) : [left, inputRight]
  }

  private compressFrame(left: number, right: number): [number, number] {
    const lvlLeft = left * this.levelGain
    const lvlRight = right * this.levelGain
    const compPeak = Math.max(Math.abs(lvlLeft), Math.abs(lvlRight))

    if (compPeak > this.compPeak) this.compPeak = compPeak
    this.compCount += 1
    if (this.compCount >= COMP_CONTROL_INTERVAL) {
      this.compCount = 0
      if (this.compPeak > this.compThreshold && this.compPeak > 1e-12) {
        const ratio = this.compThreshold / this.compPeak
        this.compTarget = ratio ** RATIO_EXPONENT
      } else {
        this.compTarget = 1
      }
      this.compPeak = 0
    }

    const compCoeff = this.compTarget < this.compGain ? this.attackCoeff : this.releaseCoeff
    this.compGain = compCoeff * this.compGain + (1 - compCoeff) * this.compTarget

    const compLeft = lvlLeft * this.compGain
    const compRight = lvlRight * this.compGain
    const msInst = 0.5 * (compLeft * compLeft + compRight * compRight)
    this.makeupMs += this.makeupWindowAlpha * (msInst - this.makeupMs)

    this.makeupCount += 1
    if (this.makeupCount >= MAKEUP_CONTROL_INTERVAL) {
      this.makeupCount = 0
      if (this.makeupMs > this.makeupGateMs) {
        const levelDb = meanSquareDb(this.makeupMs)
        const targetDb = Math.max(
          MAKEUP_MIN_DB,
          Math.min(MAKEUP_MAX_DB, MAKEUP_TARGET_RMS_DB - levelDb)
        )
        this.makeupGainDb += this.makeupReactionAlpha * (targetDb - this.makeupGainDb)
        this.makeupGain = dbToLinear(this.makeupGainDb)
      }
    }

    const mkLeft = compLeft * this.makeupGain
    const mkRight = compRight * this.makeupGain
    const peak = Math.max(Math.abs(mkLeft), Math.abs(mkRight))
    if (peak >= this.limiterPeak) {
      this.limiterPeak = peak
      this.limiterHold = this.lookahead
    } else if (this.limiterHold > 0) {
      this.limiterHold -= 1
    } else {
      this.limiterPeak = peak
    }

    const limiterTarget =
      this.limiterPeak > this.limiterCeiling && this.limiterPeak > 1e-12
        ? this.limiterCeiling / this.limiterPeak
        : 1
    const limiterCoeff =
      limiterTarget < this.limiterGain ? this.limiterAttackCoeff : this.limiterReleaseCoeff
    this.limiterGain = limiterCoeff * this.limiterGain + (1 - limiterCoeff) * limiterTarget

    const delayedLeft = this.laBufL[this.laPos]
    const delayedRight = this.laBufR[this.laPos]
    this.laBufL[this.laPos] = mkLeft
    this.laBufR[this.laPos] = mkRight
    this.laPos = (this.laPos + 1) % this.lookahead

    return [delayedLeft * this.limiterGain, delayedRight * this.limiterGain]
  }
}
