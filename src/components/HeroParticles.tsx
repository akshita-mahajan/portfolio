import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  baseAlpha: number
  alpha: number
  phase: number
  phaseSpeed: number
  color: 'blue' | 'amber'
}

interface HeroParticlesProps {
  reducedMotion?: boolean
}

export default function HeroParticles({ reducedMotion = false }: HeroParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (reducedMotion) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    // Generate ~22 sparse, elegant cinematic particles
    const particleCount = 22
    const particles: Particle[] = []

    for (let i = 0; i < particleCount; i++) {
      const isLeft = i < particleCount / 2
      particles.push({
        x: isLeft ? Math.random() * (width * 0.45) : width * 0.55 + Math.random() * (width * 0.45),
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -0.2 - Math.random() * 0.35, // slow upward drift
        radius: 1.0 + Math.random() * 1.6,
        baseAlpha: 0.18 + Math.random() * 0.35,
        alpha: 0.2,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.012 + Math.random() * 0.018,
        color: isLeft ? 'blue' : 'amber',
      })
    }

    let lastTime = performance.now()

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1)
      lastTime = now

      ctx.clearRect(0, 0, width, height)

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.phase += p.phaseSpeed
        p.alpha = p.baseAlpha * (0.6 + 0.4 * Math.sin(p.phase))
        p.x += p.vx * dt * 60 + Math.sin(p.phase * 0.8) * 0.15
        p.y += p.vy * dt * 60

        // Wrap around boundaries
        if (p.y < -10) {
          p.y = height + 10
          p.x = p.color === 'blue'
            ? Math.random() * (width * 0.45)
            : width * 0.55 + Math.random() * (width * 0.45)
        }
        if (p.x < -10) p.x = width + 10
        if (p.x > width + 10) p.x = -10

        // Draw soft glowing particle
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 2.2)
        if (p.color === 'blue') {
          gradient.addColorStop(0, `rgba(145, 195, 245, ${p.alpha})`)
          gradient.addColorStop(0.5, `rgba(90, 160, 225, ${p.alpha * 0.5})`)
          gradient.addColorStop(1, 'rgba(60, 125, 195, 0)')
        } else {
          gradient.addColorStop(0, `rgba(255, 215, 140, ${p.alpha})`)
          gradient.addColorStop(0.5, `rgba(245, 150, 50, ${p.alpha * 0.5})`)
          gradient.addColorStop(1, 'rgba(215, 90, 20, 0)')
        }

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius * 2.2, 0, Math.PI * 2)
        ctx.fill()
      }

      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
    }
  }, [reducedMotion])

  if (reducedMotion) return null

  return (
    <canvas
      ref={canvasRef}
      className="hero-particles-canvas"
      aria-hidden="true"
    />
  )
}
