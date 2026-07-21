import {
  TEST_TONE_LEVELS,
  TEST_TONE_WAVEFORMS,
  type TestToneWaveform,
  useTestTone,
} from '../audio/useTestTone'

export default function TestToneGenerator() {
  const { waveform, level, setWaveform, setLevel } = useTestTone()

  const handleWaveform = (nextWaveform: TestToneWaveform) => {
    void setWaveform(nextWaveform)
  }

  return (
    <div className="panel test-tone">
      <div className="panel-title">
        TEST TONE <span className="unit">1kHz / dBFS</span>
      </div>

      <div className="tt-group" aria-label="出力波形">
        {TEST_TONE_WAVEFORMS.map((item) => (
          <button
            key={item.value}
            className={`tt-button ${waveform === item.value ? 'active' : ''}`}
            type="button"
            aria-pressed={waveform === item.value}
            onClick={() => handleWaveform(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="tt-levels" aria-label="出力レベル">
        {TEST_TONE_LEVELS.map((item) => (
          <button
            key={item}
            className={`tt-level ${level === item ? 'active' : ''}`}
            type="button"
            aria-pressed={level === item}
            onClick={() => setLevel(item)}
          >
            <span className="tt-level-value">{item}</span>
            <span className="tt-level-unit">dBFS</span>
          </button>
        ))}
      </div>
    </div>
  )
}
