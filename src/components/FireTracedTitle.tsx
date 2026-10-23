import { useEffect, useRef, useState, useCallback } from 'react'

interface CharPathData {
  char: string
  path: string
  approxLen: number
  rimClass: string
}

export const AKSHITA_CHARS: CharPathData[] = [
  // Bodoni Moda Cap 'A': apex at (50, 18), left foot (22, 98), right foot (78, 98), crossbar at y=72
  { char: 'A', path: 'M 22,98 L 50,18 L 78,98 L 68,72 L 32,72', approxLen: 235, rimClass: 'rim-left-cool' },
  // 'K': stem (30, 18) to (30, 98), upper arm (30, 64) to (78, 18), lower leg (48, 54) to (82, 98)
  { char: 'K', path: 'M 30,18 L 30,98 L 30,64 L 78,18 L 48,54 L 82,98', approxLen: 220, rimClass: 'rim-left-cool' },
  // 'S': graceful Didone spine curve
  { char: 'S', path: 'M 74,34 C 68,16 32,16 28,36 C 24,58 76,58 72,82 C 68,104 28,104 22,86', approxLen: 230, rimClass: 'rim-left-cool' },
  // 'H': left stem, crossbar, right stem
  { char: 'H', path: 'M 26,18 L 26,98 L 26,62 L 74,62 L 74,18 L 74,98', approxLen: 240, rimClass: 'rim-center' },
  // 'I': top serif, vertical stem, bottom serif
  { char: 'I', path: 'M 34,18 L 66,18 L 50,18 L 50,98 L 34,98 L 66,98', approxLen: 160, rimClass: 'rim-right-warm' },
  // 'T': top crossbar, stem down
  { char: 'T', path: 'M 16,18 L 84,18 L 50,18 L 50,98', approxLen: 180, rimClass: 'rim-right-warm' },
  // Final 'A'
  { char: 'A', path: 'M 22,98 L 50,18 L 78,98 L 68,72 L 32,72', approxLen: 235, rimClass: 'rim-right-warm' },
]

export const MAHAJAN_CHARS = ['M', 'A', 'H', 'A', 'J', 'A', 'N']

interface Ember {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
}

interface FireTracedTitleProps {
  reducedMotion?: boolean
  testFirstAOnly?: boolean
  onSettled?: () => void
}

export default function FireTracedTitle({
  reducedMotion = false,
  testFirstAOnly = false,
  onSettled,
}: FireTracedTitleProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const [mahajanVisible, setMahajanVisible] = useState(false)
  const [isSettled, setIsSettled] = useState(false)

  // Critical Single-Pass Control Refs (Prevents infinite restarts)
  const hasStartedRef = useRef(false)
  const hasFinishedRef = useRef(false)
  const mahajanTriggeredRef = useRef(false)
  const onSettledRef = useRef(onSettled)
  useEffect(() => {
    onSettledRef.current = onSettled
  }, [onSettled])

  // Character references for AKSHITA
  const akshitaTextGroups = useRef<(SVGGElement | null)[]>([])
  const akshitaMaskPaths = useRef<(SVGPathElement | null)[]>([])
  const akshitaAuraPaths = useRef<(SVGPathElement | null)[]>([])
  const akshitaGlowPaths = useRef<(SVGPathElement | null)[]>([])
  const akshitaCorePaths = useRef<(SVGPathElement | null)[]>([])
  const akshitaGuidePaths = useRef<(SVGPathElement | null)[]>([])
  const akshitaSparkGroups = useRef<(SVGGElement | null)[]>([])
  const akshitaFilamentGroups = useRef<(SVGGElement | null)[]>([])
  const akshitaPathLengths = useRef<number[]>(AKSHITA_CHARS.map(c => c.approxLen))

  // Embers per character
  const embersRef = useRef<Ember[][]>(AKSHITA_CHARS.map(() => []))
  const emberSvgGroups = useRef<(SVGGElement | null)[]>([])

  // Measure path lengths on mount and establish strictly hidden state
  useEffect(() => {
    AKSHITA_CHARS.forEach((item, i) => {
      const guide = akshitaGuidePaths.current[i]
      const len = guide ? guide.getTotalLength() : item.approxLen
      akshitaPathLengths.current[i] = len

      // Set initial strokeDasharray and hidden offsets
      if (akshitaMaskPaths.current[i]) {
        akshitaMaskPaths.current[i]!.style.strokeDasharray = `${len}`
        akshitaMaskPaths.current[i]!.style.strokeDashoffset = `${len}`
      }
      if (akshitaAuraPaths.current[i]) {
        akshitaAuraPaths.current[i]!.style.strokeDasharray = `${len}`
        akshitaAuraPaths.current[i]!.style.strokeDashoffset = `${len}`
      }
      if (akshitaGlowPaths.current[i]) {
        akshitaGlowPaths.current[i]!.style.strokeDasharray = `${len}`
        akshitaGlowPaths.current[i]!.style.strokeDashoffset = `${len}`
      }
      if (akshitaCorePaths.current[i]) {
        akshitaCorePaths.current[i]!.style.strokeDasharray = `${len}`
        akshitaCorePaths.current[i]!.style.strokeDashoffset = `${len}`
      }

      // Hide text group until ignition
      if (akshitaTextGroups.current[i]) {
        akshitaTextGroups.current[i]!.style.opacity = '0'
      }
      if (akshitaSparkGroups.current[i]) {
        akshitaSparkGroups.current[i]!.style.display = 'none'
      }
      if (akshitaFilamentGroups.current[i]) {
        akshitaFilamentGroups.current[i]!.style.opacity = '0'
      }
    })
  }, [])

  // Timing configuration (ms)
  // Panel 1: 0 to 1200ms -> clean smoke background
  // Panel 2+: 1200ms onwards -> sequential letter fire tracing
  const START_DELAY = 1200
  const CHAR_DURATION = 850 // Rich cinematic stroke duration for each letter
  const CHAR_STAGGER = 280  // Organic continuous stagger from letter to letter
  const FADE_DURATION = 450 // Cooling fade from molten gold to permanent ivory Didone
  const MAHAJAN_DELAY = START_DELAY + (AKSHITA_CHARS.length - 1) * CHAR_STAGGER + 350

  const applyProgressToChar = useCallback((i: number, progress: number, fadeProgress: number = 0) => {
    const len = akshitaPathLengths.current[i] || AKSHITA_CHARS[i].approxLen
    const textGroup = akshitaTextGroups.current[i]
    const maskPath = akshitaMaskPaths.current[i]
    const auraPath = akshitaAuraPaths.current[i]
    const glowPath = akshitaGlowPaths.current[i]
    const corePath = akshitaCorePaths.current[i]
    const guidePath = akshitaGuidePaths.current[i]
    const sparkGroup = akshitaSparkGroups.current[i]
    const filamentGroup = akshitaFilamentGroups.current[i]
    const emberGroup = emberSvgGroups.current[i]

    // State 1: Before ignition
    if (progress <= 0) {
      if (textGroup) {
        textGroup.style.opacity = '0'
        textGroup.setAttribute('mask', `url(#akshita-mask-${i})`)
      }
      if (maskPath) maskPath.style.strokeDashoffset = `${len}`
      if (auraPath) auraPath.style.strokeDashoffset = `${len}`
      if (glowPath) glowPath.style.strokeDashoffset = `${len}`
      if (corePath) corePath.style.strokeDashoffset = `${len}`
      if (sparkGroup) sparkGroup.style.display = 'none'
      if (filamentGroup) filamentGroup.style.opacity = '0'
      if (emberGroup) emberGroup.innerHTML = ''
    }
    // State 2 & 3: Active Molten Fire Tracing & Progressive Letter Formation
    else if (progress > 0 && progress < 1.0) {
      const offset = len * (1.0 - progress)

      // Make text body visible and reveal progressive mask
      if (textGroup) {
        textGroup.style.opacity = '1'
        textGroup.setAttribute('mask', `url(#akshita-mask-${i})`)
      }
      if (maskPath) maskPath.style.strokeDashoffset = `${offset}`

      // Draw active cinematic fire trail layers
      if (filamentGroup) {
        filamentGroup.style.display = 'block'
        filamentGroup.style.opacity = '1'
      }
      if (auraPath) auraPath.style.strokeDashoffset = `${offset}`
      if (glowPath) glowPath.style.strokeDashoffset = `${offset}`
      if (corePath) corePath.style.strokeDashoffset = `${offset}`

      // Calculate precise flame head position along strokes
      if (guidePath && sparkGroup) {
        const pt = guidePath.getPointAtLength(progress * len)
        // Subtle organic flame flicker
        const flickerX = (Math.random() - 0.5) * 1.2
        const flickerY = (Math.random() - 0.5) * 1.2

        sparkGroup.style.display = 'block'
        sparkGroup.setAttribute('transform', `translate(${pt.x + flickerX}, ${pt.y + flickerY})`)

        // Spawn dynamic hot embers around active flame head
        if (Math.random() < 0.75) {
          embersRef.current[i].push({
            x: pt.x + (Math.random() - 0.5) * 4,
            y: pt.y + (Math.random() - 0.5) * 4,
            vx: (Math.random() - 0.5) * 2.2,
            vy: -Math.random() * 2.8 - 0.8,
            life: 1.0,
            maxLife: 1.0,
            size: Math.random() * 2.0 + 1.0,
          })
        }
      }

      // Update flying embers
      const embers = embersRef.current[i]
      for (let eIdx = embers.length - 1; eIdx >= 0; eIdx--) {
        const e = embers[eIdx]
        e.x += e.vx
        e.y += e.vy
        e.life -= 0.045
        if (e.life <= 0) {
          embers.splice(eIdx, 1)
        }
      }

      if (emberGroup) {
        emberGroup.innerHTML = embers
          .map(
            e =>
              `<circle cx="${e.x}" cy="${e.y}" r="${e.size}" fill="#FFE082" opacity="${Math.max(
                0,
                e.life
              )}" filter="drop-shadow(0 0 3px #FF6D00)" />`
          )
          .join('')
      }
    }
    // State 4: Formation Complete -> Fire Trail Subsales into Crisp Permanent Ivory Bodoni Serif
    else {
      if (textGroup) {
        textGroup.style.opacity = '1'
        if (fadeProgress >= 1.0) {
          textGroup.removeAttribute('mask')
        }
      }
      if (maskPath) maskPath.style.strokeDashoffset = '0'
      if (sparkGroup) sparkGroup.style.display = 'none'
      if (emberGroup) emberGroup.innerHTML = ''

      if (fadeProgress < 1.0) {
        if (filamentGroup) {
          filamentGroup.style.display = 'block'
          filamentGroup.style.opacity = `${1.0 - fadeProgress}`
        }
      } else {
        if (filamentGroup) filamentGroup.style.display = 'none'
      }
    }
  }, [])

  // ── Permanent Single-Pass Animation Loop ──
  useEffect(() => {
    // Immediate display if reduced motion is preferred
    if (reducedMotion) {
      hasFinishedRef.current = true
      AKSHITA_CHARS.forEach((_, i) => applyProgressToChar(i, 1.0, 1.0))
      setMahajanVisible(true)
      setIsSettled(true)
      if (onSettledRef.current) onSettledRef.current()
      return
    }

    // Do not restart if already finished
    if (hasFinishedRef.current || hasStartedRef.current) return
    hasStartedRef.current = true

    const startTime = performance.now()
    const activeCharsCount = testFirstAOnly ? 1 : AKSHITA_CHARS.length

    const loop = (now: number) => {
      // If completed, ensure loop is severed
      if (hasFinishedRef.current) return

      const elapsed = now - startTime

      // Process each character of AKSHITA
      for (let i = 0; i < activeCharsCount; i++) {
        const charStart = START_DELAY + i * CHAR_STAGGER
        const charElapsed = elapsed - charStart

        if (charElapsed <= 0) {
          applyProgressToChar(i, 0)
        } else if (charElapsed > 0 && charElapsed < CHAR_DURATION) {
          const progress = Math.min(1.0, charElapsed / CHAR_DURATION)
          applyProgressToChar(i, progress)
        } else {
          const fadeElapsed = charElapsed - CHAR_DURATION
          const fadeProg = Math.min(1.0, fadeElapsed / FADE_DURATION)
          applyProgressToChar(i, 1.0, fadeProg)
        }
      }

      // Trigger MAHAJAN reveal ONCE
      if (!testFirstAOnly && elapsed >= MAHAJAN_DELAY && !mahajanTriggeredRef.current) {
        mahajanTriggeredRef.current = true
        setMahajanVisible(true)
      }

      // Check overall settlement
      const totalTimeNeeded = testFirstAOnly
        ? START_DELAY + CHAR_DURATION + FADE_DURATION + 100
        : START_DELAY + (AKSHITA_CHARS.length - 1) * CHAR_STAGGER + CHAR_DURATION + FADE_DURATION + 600

      if (elapsed >= totalTimeNeeded) {
        // PERMANENT FINAL STATE REACHED — Lock in forever
        hasFinishedRef.current = true
        for (let i = 0; i < activeCharsCount; i++) {
          applyProgressToChar(i, 1.0, 1.0)
        }
        setMahajanVisible(true)
        setIsSettled(true)
        if (onSettledRef.current) onSettledRef.current()
        return // Loop naturally terminates and NEVER calls rAF again!
      }

      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
      if (!hasFinishedRef.current) {
        hasStartedRef.current = false
      }
    }
  }, [reducedMotion, testFirstAOnly, applyProgressToChar])

  return (
    <div className={`fire-traced-title-root ${isSettled ? 'is-fully-settled' : ''}`} ref={containerRef}>
      {/* ── Global Cinematic SVG Filters & Gradients ── */}
      <svg className="fire-shared-defs" aria-hidden="true" width="0" height="0">
        <defs>
          {/* Luminous Warm Ivory Bodoni Letter Fill */}
          <linearGradient id="ivoryDidoneGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="48%" stopColor="#F6ECE0" />
            <stop offset="100%" stopColor="#E5CEB0" />
          </linearGradient>

          {/* Champagne Gold Surname Fill */}
          <linearGradient id="champagneGoldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFF7E6" />
            <stop offset="50%" stopColor="#DFBE88" />
            <stop offset="100%" stopColor="#C29653" />
          </linearGradient>

          {/* Cinematic Blazing Fire Gradient */}
          <linearGradient id="blazingFireGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="18%" stopColor="#FFE082" />
            <stop offset="50%" stopColor="#FFA726" />
            <stop offset="80%" stopColor="#FF5722" />
            <stop offset="100%" stopColor="#D84315" />
          </linearGradient>

          {/* Radial Plasma Gradient for Active Flame Head */}
          <radialGradient id="flameHeadAura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="25%" stopColor="#FFE082" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#FF9100" stopOpacity="0.75" />
            <stop offset="80%" stopColor="#E65100" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#BF360C" stopOpacity="0" />
          </radialGradient>

          {/* High-Impact Multi-Stage Cinematic Flame Blur Filter */}
          <filter id="cinematicFlameGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="glow1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="6.5" result="glow2" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="glow3" />
            <feMerge>
              <feMergeNode in="glow3" />
              <feMergeNode in="glow2" />
              <feMergeNode in="glow1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="fireAuraBlur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
      </svg>

      {/* ── First Name: AKSHITA (Real Fire-Traced Formation) ── */}
      <h1 className="cinematic-serif-title" aria-label="Akshita">
        <span className="fire-name-akshita" aria-hidden="true">
          {AKSHITA_CHARS.map((item, i) => {
            if (testFirstAOnly && i > 0) return null

            return (
              <span key={`fire-char-${i}`} className={`fire-char-box ${item.rimClass}`}>
                <svg
                  className="fire-char-svg"
                  viewBox="0 0 100 120"
                  preserveAspectRatio="xMidYMid meet"
                  aria-hidden="true"
                >
                  <defs>
                    {/* Progressive Reveal Mask Driven by the Molten Trail */}
                    <mask
                      id={`akshita-mask-${i}`}
                      maskUnits="userSpaceOnUse"
                      x="-15"
                      y="-15"
                      width="130"
                      height="150"
                    >
                      <rect width="130" height="150" fill="black" />
                      <path
                        ref={el => {
                          akshitaMaskPaths.current[i] = el
                        }}
                        d={item.path}
                        fill="none"
                        stroke="white"
                        strokeWidth="42"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          strokeDasharray: item.approxLen,
                          strokeDashoffset: item.approxLen,
                        }}
                      />
                    </mask>
                  </defs>

                  {/* Invisible Guide Path used for exact mathematical getPointAtLength */}
                  <path
                    ref={el => {
                      akshitaGuidePaths.current[i] = el
                    }}
                    d={item.path}
                    fill="none"
                    stroke="none"
                    style={{ display: 'none' }}
                  />

                  {/* Layer 1: True Bodoni Moda Ivory Serif Letter (Masked Progressively) */}
                  <g
                    ref={el => {
                      akshitaTextGroups.current[i] = el
                    }}
                    mask={`url(#akshita-mask-${i})`}
                    style={{ opacity: 0 }}
                  >
                    <text
                      x="50"
                      y="96"
                      textAnchor="middle"
                      className="didone-svg-text"
                      fill="url(#ivoryDidoneGrad)"
                    >
                      {item.char}
                    </text>
                  </g>

                  {/* Layer 2: Real Cinematic Molten Fire Trail (Active only during tracing) */}
                  <g
                    ref={el => {
                      akshitaFilamentGroups.current[i] = el
                    }}
                    className="filament-group"
                    style={{ opacity: 0 }}
                  >
                    {/* Layer 2A: Broad Outer Plasma Heat Aura */}
                    <path
                      ref={el => {
                        akshitaAuraPaths.current[i] = el
                      }}
                      d={item.path}
                      fill="none"
                      stroke="rgba(255, 120, 20, 0.45)"
                      strokeWidth="16"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter="url(#fireAuraBlur)"
                      style={{
                        strokeDasharray: item.approxLen,
                        strokeDashoffset: item.approxLen,
                      }}
                    />
                    {/* Layer 2B: Blazing Amber Fire Body */}
                    <path
                      ref={el => {
                        akshitaGlowPaths.current[i] = el
                      }}
                      d={item.path}
                      fill="none"
                      stroke="url(#blazingFireGrad)"
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter="url(#cinematicFlameGlow)"
                      style={{
                        strokeDasharray: item.approxLen,
                        strokeDashoffset: item.approxLen,
                      }}
                    />
                    {/* Layer 2C: Incandescent White-Hot Inner Core */}
                    <path
                      ref={el => {
                        akshitaCorePaths.current[i] = el
                      }}
                      d={item.path}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        strokeDasharray: item.approxLen,
                        strokeDashoffset: item.approxLen,
                      }}
                    />
                  </g>

                  {/* Layer 3: Dynamic Flying Embers */}
                  <g
                    ref={el => {
                      emberSvgGroups.current[i] = el
                    }}
                    className="embers-group"
                  />

                  {/* Layer 4: Active Moving Ignition Flame Head */}
                  <g
                    ref={el => {
                      akshitaSparkGroups.current[i] = el
                    }}
                    className="spark-head-group"
                    style={{ display: 'none' }}
                  >
                    {/* Outer glowing plasma aura */}
                    <circle r="22" fill="url(#flameHeadAura)" />
                    {/* Brilliant golden flame nucleus */}
                    <circle r="10" fill="#FFA726" filter="url(#cinematicFlameGlow)" />
                    {/* Intense white-hot center */}
                    <circle r="4" fill="#FFFFFF" />
                  </g>
                </svg>
              </span>
            )
          })}
        </span>
        <span className="sr-only">AKSHITA</span>
      </h1>

      {/* ── Surname: MAHAJAN (Champagne Didone Subtitle) ── */}
      {!testFirstAOnly && (
        <div className="surname-container">
          <h2 className="cinematic-serif-surname" aria-label="Mahajan">
            <span className={`word-mahajan ${mahajanVisible ? 'mahajan-emerged' : 'mahajan-hidden'}`}>
              {MAHAJAN_CHARS.map((char, idx) => (
                <span
                  key={`mahajan-char-${idx}`}
                  className="mahajan-letter"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  {char}
                </span>
              ))}
            </span>
            <span className="sr-only">MAHAJAN</span>
          </h2>
        </div>
      )}
    </div>
  )
}
