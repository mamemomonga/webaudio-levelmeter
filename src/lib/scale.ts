import { METER_FLOOR } from '../audio/useAudioMeter'

// dB値をメータ内の位置(0〜100%)へ変換する。
export function dbToPct(db: number, floor = METER_FLOOR, top = 0): number {
  if (!Number.isFinite(db)) return 0
  const p = ((db - floor) / (top - floor)) * 100
  return Math.max(0, Math.min(100, p))
}

// 表示用のdB文字列(整数丸め)
export function fmtDb(db: number, digits = 1): string {
  if (!Number.isFinite(db)) return '-∞'
  return db.toFixed(digits)
}
