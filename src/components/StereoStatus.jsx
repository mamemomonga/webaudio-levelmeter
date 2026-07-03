// ステレオ状態の表示。
const MODES = {
  stereo: { label: 'ステレオ', desc: '左右に異なる信号', tone: 'ok' },
  mono: { label: 'モノラル', desc: '左右が同じ信号', tone: 'info' },
  single: { label: '片チャンネル', desc: '片側のみ信号あり', tone: 'warn' },
  inverted: { label: '逆位相', desc: '左右が逆相 — 結線を確認', tone: 'error' },
  silent: { label: '無信号', desc: '入力がありません', tone: 'idle' },
}

export default function StereoStatus({ mode }) {
  const m = MODES[mode] || MODES.silent
  return (
    <div className="panel stereo-status">
      <div className="panel-title">STEREO</div>
      <div className={`ss-body tone-${m.tone}`}>
        <div className="ss-label">{m.label}</div>
        <div className="ss-desc">{m.desc}</div>
      </div>
    </div>
  )
}
