import { METER_FLOOR } from '../audio/useAudioMeter'
import { dbToPct, fmtDb } from '../lib/scale'

// 目盛(dBFS)
const TICKS = [0, -3, -6, -12, -18, -24, -36, -48, -60]

// dBゾーンに対応した色配置(下:緑 → 上:赤)
const GRADIENT = `linear-gradient(to right,
  var(--green) 0%,
  var(--green) ${dbToPct(-18)}%,
  var(--yellow) ${dbToPct(-12)}%,
  var(--yellow) ${dbToPct(-9)}%,
  var(--orange) ${dbToPct(-6)}%,
  var(--orange) ${dbToPct(-3)}%,
  var(--red) ${dbToPct(-1)}%,
  var(--red) 100%)`

type BarProps = {
  label: string
  level: number
  hold: number
  over: boolean
  readout: number
}

type PeakMeterProps = {
  peakL: number
  peakR: number
  holdL: number
  holdR: number
  overL: boolean
  overR: boolean
  readoutL: number
  readoutR: number
}

function Bar({ label, level, hold, over, readout }: BarProps) {
  const levelPct = dbToPct(level)
  const holdPct = dbToPct(hold)
  return (
    <div className="pm-bar">
      <div className="pm-chlabel">{label}</div>
      <div className="pm-track">
        <div className="pm-grad-dim" style={{ background: GRADIENT }} />
        <div
          className="pm-grad-lit"
          style={{
            background: GRADIENT,
            clipPath: `inset(0 ${100 - levelPct}% 0 0)`,
          }}
        />
        {hold > METER_FLOOR && (
          <div className="pm-hold" style={{ left: `${holdPct}%` }} />
        )}
      </div>
      <div className={`pm-overlamp ${over ? 'on' : ''}`} aria-hidden="true" />
      <div className="pm-row-readout">
        {fmtDb(readout)} <span className="unit">dB</span>
      </div>
    </div>
  )
}

export default function PeakMeter({
  peakL,
  peakR,
  holdL,
  holdR,
  overL,
  overR,
  readoutL,
  readoutR,
}: PeakMeterProps) {
  return (
    <div className="panel peak-meter">
      <div className="panel-title">
        PEAK <span className="unit">dBFS / 1s MAX</span>
      </div>
      <div className="pm-body">
        <Bar label="L" level={peakL} hold={holdL} over={overL} readout={readoutL} />
        <Bar label="R" level={peakR} hold={holdR} over={overR} readout={readoutR} />
        <div className="pm-scale">
          {TICKS.map((t) => (
            <div key={t} className="pm-tick" style={{ left: `${dbToPct(t)}%` }}>
              <span>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
