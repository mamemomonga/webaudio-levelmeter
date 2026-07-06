// ショートターム(3秒)を基準に、初心者にも分かりやすい適正表示を出す。
const LOW_MAX_LUFS = -16
const HIGH_MIN_LUFS = -14

export default function LoudnessAdvice({ shortTerm }) {
  let level // 'low' | 'ok' | 'high' | 'none'
  if (!Number.isFinite(shortTerm)) {
    level = 'none'
  } else if (shortTerm <= LOW_MAX_LUFS) {
    level = 'low'
  } else if (shortTerm >= HIGH_MIN_LUFS) {
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
        適正レベル <span className="unit">Short&nbsp;Term</span>
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
