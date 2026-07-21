import { TRUE_PEAK_LIMIT } from '../audio/useAudioMeter'
import { fmtDb } from '../lib/scale'

type PeakLampProps = {
  over: boolean
  truePeak: number
}

// -1.0dBTP を超えたら点灯し、3秒保持するピークランプ。
export default function PeakLamp({ over, truePeak }: PeakLampProps) {
  return (
    <div className="panel peak-lamp">
      <div className="panel-title">
        PEAK <span className="unit">-1.0 dBTP / 0.5s HOLD</span>
      </div>
      <div className="pl-body">
        <div className={`pl-led ${over ? 'on' : ''}`} aria-hidden="true" />
        <div className="pl-info">
          <div className="pl-status">{over ? 'OVER' : 'OK'}</div>
          <div className="pl-tp">TP {fmtDb(truePeak)} dB</div>
        </div>
      </div>
    </div>
  )
}
