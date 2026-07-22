import { TARGET_LUFS } from '../audio/useAudioMeter'
import { fmtDb } from '../lib/scale'

// ラウドネスメータのスケール(LUFS)
const LU_TOP = 0
const LU_FLOOR = -36

const TICKS = [0, -6, -15, -20, -28, -36]

type LoudnessMeterProps = {
  momentary: number
}

function luToPct(lufs: number): number {
  if (!Number.isFinite(lufs)) return 0
  const p = ((lufs - LU_FLOOR) / (LU_TOP - LU_FLOOR)) * 100
  return Math.max(0, Math.min(100, p))
}

// モメンタリー値を表示するラウドネスメータ。ターゲットは -15 LUFS。
export default function LoudnessMeter({ momentary }: LoudnessMeterProps) {
  const pct = luToPct(momentary)
  const targetPct = luToPct(TARGET_LUFS)

  return (
    <div className="panel loudness-meter">
      <div className="panel-title">
        LOUDNESS <span className="unit">LUFS / Momentary</span>
      </div>
      <div className="lm-body">
        <div className="lm-main">
          <div className="lm-track">
            <div className="lm-fill" style={{ width: `${pct}%` }} />
            <div className="lm-target" style={{ left: `${targetPct}%` }}>
              <span>-15</span>
            </div>
          </div>
          <div className="lm-scale">
            {TICKS.map((t) => (
              <div key={t} className="lm-tick" style={{ left: `${luToPct(t)}%` }}>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="lm-readout">
          {fmtDb(momentary)} <span className="unit">LUFS</span>
        </div>
      </div>
    </div>
  )
}
