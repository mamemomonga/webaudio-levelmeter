import { TRUE_PEAK_LIMIT } from '../audio/useAudioMeter.js'
import { fmtDb } from '../lib/scale.js'

// -1.0dBTP を超えたら点灯し、リセットまで保持するピークランプ。
export default function PeakLamp({ over, truePeak, onReset }) {
  return (
    <div className="panel peak-lamp">
      <div className="panel-title">
        PEAK <span className="unit">-1.0 dBTP</span>
      </div>
      <div className="pl-body">
        <div className={`pl-led ${over ? 'on' : ''}`} aria-hidden="true" />
        <div className="pl-info">
          <div className="pl-status">{over ? 'OVER' : 'OK'}</div>
          <div className="pl-tp">TP {fmtDb(truePeak)} dB</div>
        </div>
        <button className="pl-reset" onClick={onReset} disabled={!over}>
          RESET
        </button>
      </div>
    </div>
  )
}
