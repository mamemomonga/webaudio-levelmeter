import type { ChangeEvent } from 'react'

type OutputControlsProps = {
  outputEnabled: boolean
  compressorEnabled: boolean
  compressorLevelDb: number
  onOutputEnabledChange: (enabled: boolean) => void
  onCompressorEnabledChange: (enabled: boolean) => void
  onCompressorLevelChange: (level: number) => void
}

export default function OutputControls({
  outputEnabled,
  compressorEnabled,
  compressorLevelDb,
  onOutputEnabledChange,
  onCompressorEnabledChange,
  onCompressorLevelChange,
}: OutputControlsProps) {
  const handleLevelChange = (event: ChangeEvent<HTMLInputElement>) => {
    onCompressorLevelChange(Number(event.target.value))
  }

  return (
    <div className="panel output-controls">
      <div className="panel-title">
        OUTPUT <span className="unit">MONITOR / COMP</span>
      </div>

      <div className="oc-grid">
        <div className="oc-card">
          <div className="oc-copy">
            <div className="oc-label">出力有効</div>
            <div className="oc-desc">
              処理済みの音をブラウザ音声として出力します。ハウリングに注意してください。
            </div>
          </div>
          <button
            className={`tt-switch oc-switch ${outputEnabled ? 'on' : ''}`}
            type="button"
            role="switch"
            aria-checked={outputEnabled}
            onClick={() => onOutputEnabledChange(!outputEnabled)}
          >
            <span className="tt-switch-track" aria-hidden="true">
              <span className="tt-switch-knob" />
            </span>
            <span className="tt-switch-label">{outputEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        <div className="oc-card oc-card-compressor">
          <div className="oc-copy">
            <div className="oc-label">コンプレッサー</div>
            <div className="oc-desc">TIMEは1秒固定、LEVELは最大+30 dBです。</div>
          </div>
          <div className="oc-compressor-controls">
            <button
              className={`tt-switch oc-switch ${compressorEnabled ? 'on' : ''}`}
              type="button"
              role="switch"
              aria-checked={compressorEnabled}
              onClick={() => onCompressorEnabledChange(!compressorEnabled)}
            >
              <span className="tt-switch-track" aria-hidden="true">
                <span className="tt-switch-knob" />
              </span>
              <span className="tt-switch-label">{compressorEnabled ? 'ON' : 'OFF'}</span>
            </button>

            <label className={`oc-level ${compressorEnabled ? '' : 'disabled'}`}>
              <span className="oc-level-label">GAIN</span>
              <input
                type="range"
                min="0"
                max="30"
                step="0.5"
                value={compressorLevelDb}
                disabled={!compressorEnabled}
                onChange={handleLevelChange}
              />
              <span className="oc-level-value">+{compressorLevelDb.toFixed(1)} dB</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
