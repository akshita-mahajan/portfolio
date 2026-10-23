import { useState } from 'react'
import SmokeCanvas from './components/SmokeCanvas'
import HeroParticles from './components/HeroParticles'
import FireTracedTitle from './components/FireTracedTitle'
import './App.css'

export default function App() {
  const [isSettled, setIsSettled] = useState<boolean>(false)
  const [replayKey, setReplayKey] = useState<number>(0)

  const [isReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false
    const params = new URLSearchParams(window.location.search)
    return params.get('reduced-motion') === 'true'
  })

  const [isTestFirstA] = useState(() => {
    if (typeof window === 'undefined') return false
    const params = new URLSearchParams(window.location.search)
    return params.get('test-first-a') === 'true'
  })

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setIsSettled(false)
    setReplayKey(k => k + 1)
  }

  return (
    <div
      className={`cinematic-experience ${isSettled ? 'stage-settled' : 'stage-tracing'}`}
      data-force-motion={!isReducedMotion ? 'true' : 'false'}
    >
      {/* Existing live WebGL fluid smoke canvas (100% Untouched) */}
      <div className="cinematic-backdrop" aria-hidden="true">
        <SmokeCanvas reducedMotion={isReducedMotion} />
      </div>

      {/* Atmospheric floating particles (100% Untouched) */}
      <HeroParticles reducedMotion={isReducedMotion} />

      {/* Top Navigation — Preserved */}
      <header className="cinematic-nav" role="banner">
        <div className="nav-container">
          <a href="#" className="nav-home-link" onClick={handleHomeClick} aria-label="Home">
            <span className="home-text">HOME</span>
            <span className="home-indicator" />
          </a>
          <nav className="nav-links-right" aria-label="Main Navigation">
            <a href="#about" className="nav-item">ABOUT</a>
            <a href="#projects" className="nav-item">PROJECTS</a>
            <a href="#contact" className="nav-item">CONTACT</a>
          </nav>
        </div>
      </header>

      {/* Main Hero Stage */}
      <main className="cinematic-main" role="main">
        <section className="central-character-stage" aria-label="Hero Section">
          <div className="hero-title-wrapper">
            <div className="title-letter-container" key={replayKey}>
              {/* Real Fire-Traced Formation Title Engine */}
              <FireTracedTitle
                testFirstAOnly={isTestFirstA}
                reducedMotion={isReducedMotion}
                onSettled={() => setIsSettled(true)}
              />
            </div>

            {/* Tagline — Centered beneath MAHAJAN */}
            {!isTestFirstA && (
              <p className={`hero-sub-descriptor ${isSettled ? 'descriptor-visible' : ''}`}>
                CSIT STUDENT
                <span className="descriptor-separator">·</span>
                FULL-STACK DEVELOPER
                <span className="descriptor-separator">·</span>
                PROJECT BUILDER
              </p>
            )}

            {/* Understated CTA — Centered below tagline */}
            {!isTestFirstA && (
              <div className={`hero-explore-cta ${isSettled ? 'cta-visible' : ''}`}>
                <a href="#projects" className="explore-link">
                  <span>EXPLORE MY WORK</span>
                  <span className="explore-arrow" aria-hidden="true">→</span>
                </a>
              </div>
            )}
          </div>
        </section>
      </main>

      <section id="about" className="sr-anchor" aria-hidden="true" />
      <section id="projects" className="sr-anchor" aria-hidden="true" />
      <section id="contact" className="sr-anchor" aria-hidden="true" />
    </div>
  )
}
