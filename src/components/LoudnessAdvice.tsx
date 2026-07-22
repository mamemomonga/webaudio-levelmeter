// ショートターム(3秒)を基準に、初心者にも分かりやすい適正表示を出す。
const LOW_MAX_LUFS = -16
const HIGH_MIN_LUFS = -14

type AdviceLevel = 'low' | 'ok' | 'high' | 'none'

type LoudnessAdviceProps = {
  shortTerm: number
}

export default function LoudnessAdvice({ shortTerm }: LoudnessAdviceProps) {
  let level: AdviceLevel
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
    { key: 'low', label: '小さい', threshold: `${LOW_MAX_LUFS} LUFS 以下` },
    {
      key: 'ok',
      label: 'ちょうどいい',
      threshold: `${LOW_MAX_LUFS} 〜 ${HIGH_MIN_LUFS} LUFS`,
    },
    { key: 'high', label: '大きい', threshold: `${HIGH_MIN_LUFS} LUFS 以上` },
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
            <span className="advice-label">{it.label}</span>
            <span className="advice-threshold">{it.threshold}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
