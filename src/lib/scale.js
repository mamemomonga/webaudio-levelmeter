import { METER_FLOOR } from '../audio/useAudioMeter.js'

// dB値をメータ内の位置(0〜100%)へ変換する。
export function dbToPct(db, floor = METER_FLOOR, top = 0) {
  if (!Number.isFinite(db)) return 0
  const p = ((db - floor) / (top - floor)) * 100
  return Math.max(0, Math.min(100, p))
}

// 表示用のdB文字列(整数丸め)
export function fmtDb(db, digits = 1) {
  if (!Number.isFinite(db)) return '-∞'
  return db.toFixed(digits)
}
