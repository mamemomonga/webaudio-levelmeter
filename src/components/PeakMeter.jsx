import { dbToPct, fmtDb } from '../lib/scale.js'
import { METER_FLOOR } from '../audio/useAudioMeter.js'

// 目盛(dBFS)
const TICKS = [0, -3, -6, -12, -18, -24, -36, -48, -60]

// dBゾーンに対応した色配置(下:緑 → 上:赤)
const GRADIENT = `linear-gradient(to top,
  var(--green) 0%,
  var(--green) ${dbToPct(-18)}%,
  var(--yellow) ${dbToPct(-12)}%,
  var(--yellow) ${dbToPct(-9)}%,
  var(--orange) ${dbToPct(-6)}%,
  var(--orange) ${dbToPct(-3)}%,
  var(--red) ${dbToPct(-1)}%,
  var(--red) 100%)`

function Bar({ label, level, hold }) {
  const levelPct = dbToPct(level)
  const holdPct = dbToPct(hold)
  return (
    <div className="pm-bar">
      <div className="pm-track">
        <div className="pm-grad-dim" style={{ background: GRADIENT }} />
        <div
          className="pm-grad-lit"
          style={{
            background: GRADIENT,
            clipPath: `inset(${100 - levelPct}% 0 0 0)`,
          }}
        />
        {hold > METER_FLOOR && (
          <div className="pm-hold" style={{ bottom: `${holdPct}%` }} />
        )}
      </div>
      <div className="pm-chlabel">{label}</div>
    </div>
  )
}

export default function PeakMeter({ peakL, peakR, holdL, holdR }) {
  return (
    <div className="panel peak-meter">
      <div className="panel-title">
        PEAK <span className="unit">dBFS</span>
      </div>
      <div className="pm-body">
        <div className="pm-scale">
          {TICKS.map((t) => (
            <div key={t} className="pm-tick" style={{ bottom: `${dbToPct(t)}%` }}>
              <span>{t}</span>
            </div>
          ))}
        </div>
        <Bar label="L" level={peakL} hold={holdL} />
        <Bar label="R" level={peakR} hold={holdR} />
      </div>
      <div className="pm-readout">
        <span>L {fmtDb(peakL)}</span>
        <span>R {fmtDb(peakR)}</span>
      </div>
    </div>
  )
}
