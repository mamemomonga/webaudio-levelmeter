import { useEffect, useRef } from 'react'

type PhaseScopeProps = {
  samples: Float32Array
}

const PHASE_SCOPE_FLOOR_DB = -60
const PHASE_SCOPE_MAX_VECTOR = Math.SQRT2
const PHASE_SCOPE_DRAW_INTERVAL_MS = 1000 / 60
const PHASE_SCOPE_FADE_ALPHA = 0.14

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value))
}

function logScalePoint(x: number, y: number): { x: number; y: number } {
  const magnitude = Math.hypot(x, y)
  if (magnitude <= 0) return { x: 0, y: 0 }

  const normalizedMagnitude = Math.min(1, magnitude / PHASE_SCOPE_MAX_VECTOR)
  const db = 20 * Math.log10(normalizedMagnitude)
  const scaledMagnitude = clampUnit((db - PHASE_SCOPE_FLOOR_DB) / -PHASE_SCOPE_FLOOR_DB)
  const scale = scaledMagnitude / magnitude

  return {
    x: x * scale,
    y: y * scale,
  }
}

export default function PhaseScope({ samples }: PhaseScopeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastDrawAtRef = useRef(0)

  useEffect(() => {
    const now = performance.now()
    if (now - lastDrawAtRef.current < PHASE_SCOPE_DRAW_INTERVAL_MS) return
    lastDrawAtRef.current = now

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const width = Math.max(1, Math.round(rect.width * dpr))
    const height = Math.max(1, Math.round(rect.height * dpr))
    const resized = canvas.width !== width || canvas.height !== height
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (resized) ctx.clearRect(0, 0, width, height)
    ctx.globalCompositeOperation = 'source-over'
    ctx.shadowBlur = 0
    ctx.fillStyle = resized ? '#0e1012' : `rgba(14, 16, 18, ${PHASE_SCOPE_FADE_ALPHA})`
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
      const point = logScalePoint(samples[i], samples[i + 1])
      const x = cx + clampUnit(point.x) * radius
      const y = cy - clampUnit(point.y) * radius
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
      const point = logScalePoint(samples[i], samples[i + 1])
      const x = cx + clampUnit(point.x) * radius
      const y = cy - clampUnit(point.y) * radius
      ctx.beginPath()
      ctx.arc(x, y, Math.max(1, dpr * 1.1), 0, Math.PI * 2)
      ctx.fill()
    }
  }, [samples])

  return (
    <div className="panel phase-scope">
      <div className="panel-title">
        PHASE SCOPE <span className="unit">L/R / LOG</span>
      </div>
      <div className="ps-label ps-label-top">+</div>
      <div className="ps-label ps-label-bottom">-</div>
      <div className="ps-label ps-label-left">L</div>
      <div className="ps-label ps-label-right">R</div>
      <canvas
        ref={canvasRef}
        className="ps-canvas"
        aria-label="ステレオフェーズスコープ"
      />
    </div>
  )
}
