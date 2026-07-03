import { TARGET_LUFS } from '../audio/useAudioMeter.js'

// Long Termを基準に、初心者にも分かりやすい適正表示を出す。
// ターゲット -14 LUFS を中心に「小さい」「ちょうどいい」「大きい」。
const TOLERANCE = 2.0 // ±2 LU を「ちょうどいい」とする

export default function LoudnessAdvice({ longTerm }) {
  let level // 'low' | 'ok' | 'high' | 'none'
  if (!Number.isFinite(longTerm) || longTerm < -50) {
    level = 'none'
  } else if (longTerm < TARGET_LUFS - TOLERANCE) {
    level = 'low'
  } else if (longTerm > TARGET_LUFS + TOLERANCE) {
    level = 'high'
  } else {
    level = 'ok'
  }

  const items = [
    { key: 'low', label: '小さい' },
    { key: 'ok', label: 'ちょうどいい' },
    { key: 'high', label: '大きい' },
  ]

  return (
    <div className="panel advice">
      <div className="panel-title">
        適正レベル <span className="unit">Long Term</span>
      </div>
      <div className="advice-row">
        {items.map((it) => (
          <div
            key={it.key}
            className={`advice-item ${it.key} ${
              level === it.key ? 'active' : ''
            }`}
          >
            {it.label}
          </div>
        ))}
      </div>
    </div>
  )
}
