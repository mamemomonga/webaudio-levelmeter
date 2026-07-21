import { useEffect, useRef } from 'react'

type PhaseScopeProps = {
  samples: Float32Array
}

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value))
}

export default function PhaseScope({ samples }: PhaseScopeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const width = Math.max(1, Math.round(rect.width * dpr))
    const height = Math.max(1, Math.round(rect.height * dpr))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#0e1012'
    ctx.fillRect(0, 0, width, height)

    const cx = width / 2
    const cy = height / 2
    const radius = Math.min(width, height) * 0.42

    ctx.lineWidth = Math.max(1, dpr)
    ctx.strokeStyle = 'rgba(216, 221, 227, 0.08)'
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.moveTo(cx - radius, cy)
    ctx.lineTo(cx + radius, cy)
    ctx.moveTo(cx, cy - radius)
    ctx.lineTo(cx, cy + radius)
    ctx.moveTo(cx - radius * 0.72, cy + radius * 0.72)
    ctx.lineTo(cx + radius * 0.72, cy - radius * 0.72)
    ctx.moveTo(cx - radius * 0.72, cy - radius * 0.72)
    ctx.lineTo(cx + radius * 0.72, cy + radius * 0.72)
    ctx.stroke()

    if (samples.length < 2) return

    ctx.lineWidth = Math.max(1.2, dpr * 1.2)
    ctx.strokeStyle = 'rgba(77, 182, 172, 0.78)'
    ctx.shadowColor = 'rgba(77, 182, 172, 0.55)'
    ctx.shadowBlur = 6 * dpr
    ctx.beginPath()

    for (let i = 0; i < samples.length; i += 2) {
      const x = cx + clampUnit(samples[i]) * radius
      const y = cy - clampUnit(samples[i + 1]) * radius
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }

    ctx.stroke()
    ctx.shadowBlur = 0

    ctx.fillStyle = 'rgba(232, 244, 242, 0.72)'
    for (let i = 0; i < samples.length; i += 8) {
      const x = cx + clampUnit(samples[i]) * radius
      const y = cy - clampUnit(samples[i + 1]) * radius
      ctx.beginPath()
      ctx.arc(x, y, Math.max(1, dpr * 1.1), 0, Math.PI * 2)
      ctx.fill()
    }
  }, [samples])

  return (
    <div className="panel phase-scope">
      <div className="panel-title">
        PHASE SCOPE <span className="unit">L/R</span>
      </div>
      <canvas
        ref={canvasRef}
        className="ps-canvas"
        aria-label="ステレオフェーズスコープ"
      />
    </div>
  )
}
