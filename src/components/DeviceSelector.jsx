import { useState } from 'react'

// 選択中のオーディオデバイスを表示し、押すと選択ダイアログを開く。
export default function DeviceSelector({
  devices,
  currentDeviceId,
  currentLabel,
  onSelect,
}) {
  const [open, setOpen] = useState(false)

  const choose = (id) => {
    setOpen(false)
    onSelect(id)
  }

  return (
    <>
      <button className="device-btn" onClick={() => setOpen(true)}>
        <span className="device-icon" aria-hidden="true">
          🎙
        </span>
        <span className="device-name">{currentLabel || '入力デバイス'}</span>
        <span className="device-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="dialog-backdrop" onClick={() => setOpen(false)}>
          <div
            className="dialog"
            role="dialog"
            aria-label="オーディオデバイスの選択"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-title">入力デバイスを選択</div>
            <ul className="device-list">
              {devices.length === 0 && (
                <li className="device-empty">利用可能なデバイスがありません</li>
              )}
              {devices.map((d) => (
                <li key={d.deviceId}>
                  <button
                    className={`device-item ${
                      d.deviceId === currentDeviceId ? 'selected' : ''
                    }`}
                    onClick={() => choose(d.deviceId)}
                  >
                    <span className="device-item-check">
                      {d.deviceId === currentDeviceId ? '●' : ''}
                    </span>
                    <span className="device-item-label">
                      {d.label || '不明なデバイス'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button className="dialog-close" onClick={() => setOpen(false)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  )
}
