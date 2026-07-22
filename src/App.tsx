import { useAudioMeter } from './audio/useAudioMeter'
import DeviceSelector from './components/DeviceSelector'
import PeakMeter from './components/PeakMeter'
import LoudnessMeter from './components/LoudnessMeter'
import LoudnessAdvice from './components/LoudnessAdvice'
import PhaseScope from './components/PhaseScope'
import StereoStatus from './components/StereoStatus'
import TestToneGenerator from './components/TestToneGenerator'
import UsageGuide from './components/UsageGuide'
import './App.css'

export default function App() {
  const {
    status,
    error,
    devices,
    currentDeviceId,
    currentDeviceLabel,
    data,
    start,
    selectDevice,
  } = useAudioMeter()

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-dot" />
          <h1>WEB LEVEL METER</h1>
        </div>
        {status === 'running' && (
          <DeviceSelector
            devices={devices}
            currentDeviceId={currentDeviceId}
            currentLabel={currentDeviceLabel}
            onSelect={selectDevice}
          />
        )}
      </header>

      {status !== 'running' ? (
        <div className="startup">
          <div className="startup-card">
            <h2>オーディオレベルメータ</h2>
            <p>
              ライブ配信やDTMの入力レベルを手軽にチェックできます。
              <br />
              マイク/ライン入力へのアクセスを許可してください。
            </p>
            <button className="start-btn" onClick={start}>
              計測をはじめる
            </button>
            {status === 'error' && (
              <p className="startup-error">
                エラー: {error || 'デバイスにアクセスできませんでした'}
              </p>
            )}
            <p className="startup-note">
              ノイズ抑制・自動ゲイン・エコー除去はすべて無効化されます。
            </p>
          </div>
        </div>
      ) : (
        <main className="meters">
          <div className="meters-top">
            <PeakMeter
              peakL={data.peakL}
              peakR={data.peakR}
              holdL={data.holdL}
              holdR={data.holdR}
              overL={data.peakOverL}
              overR={data.peakOverR}
              readoutL={data.peakReadoutL}
              readoutR={data.peakReadoutR}
            />
            <LoudnessMeter momentary={data.momentary} />
          </div>
          <div className="meters-side">
            <LoudnessAdvice shortTerm={data.shortTerm} />
            <TestToneGenerator />
            <StereoStatus mode={data.stereoMode} />
            <PhaseScope samples={data.phaseScope} />
            <UsageGuide />
          </div>
        </main>
      )}

      <footer className="app-footer">
        <span>Target -15 LUFS</span>
        <span>ITU-R BS.1770</span>
        <span>True Peak -1.0 dBTP</span>
      </footer>
    </div>
  )
}
