import { useEffect, useRef } from 'react'

interface SmokeCanvasProps {
  reducedMotion?: boolean
}

export default function SmokeCanvas({ reducedMotion = false }: SmokeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = (
      canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
      }) ||
      canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
      })
    ) as WebGLRenderingContext | null

    if (!gl) {
      console.warn('WebGL not supported')
      return
    }

    let animationFrameId: number
    const globalStartTime = performance.now()
    const introStartTime = performance.now()
    let isIntroComplete = reducedMotion

    const updateSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const displayWidth = Math.floor(window.innerWidth * dpr)
      const displayHeight = Math.floor(window.innerHeight * dpr)
      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth
        canvas.height = displayHeight
      }
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    updateSize()
    window.addEventListener('resize', updateSize)

    // ─── Cursor Tracking for Avatar Parallax ──────────────────────────────────
    let targetMouseX = 0
    let targetMouseY = 0
    let currentMouseX = 0
    let currentMouseY = 0

    const handleMouseMove = (e: MouseEvent) => {
      if (reducedMotion) return
      // Normalized coordinates from -1.0 to 1.0 relative to window center
      targetMouseX = (e.clientX / window.innerWidth) * 2.0 - 1.0
      targetMouseY = (e.clientY / window.innerHeight) * 2.0 - 1.0
    }

    const handleMouseLeave = () => {
      targetMouseX = 0.0
      targetMouseY = 0.0
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseleave', handleMouseLeave, { passive: true })

    // Replay intro listener — signals HTML title to restart (not used by shader anymore)
    const handleReplayIntro = () => {
      isIntroComplete = false
    }
    window.addEventListener('replay-cinematic-intro', handleReplayIntro)

    // ─── Vertex Shader ───────────────────────────────────────────────────────
    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = (a_position + 1.0) * 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `

    // ─── Fragment Shader ─────────────────────────────────────────────────────
    // Cinematic Intro Sequence + Genuine Smoke Motion + Cursor Avatar Parallax:
    // Stages A (Atmosphere), B (Avatar), C (Name Sweep), D (Resting state).
    const fsSource = `
      precision highp float;
      varying vec2 v_uv;
      uniform sampler2D u_image;
      uniform vec2  u_resolution;
      uniform vec2  u_imageResolution;
      uniform float u_time;
      uniform float u_introTime;
      uniform float u_isIntroComplete;
      uniform vec2  u_mouse;
      uniform float u_speed;

      // ── 3D Simplex Noise by Stefan Gustavson ────────────────────────────────
      vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289v4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x)  { return mod289v4(((x * 34.0) + 1.0) * x); }

      float snoise(vec3 v) {
        const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);

        vec3 g  = step(x0.yzx, x0.xyz);
        vec3 l  = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);

        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;

        i = mod289v3(i);
        vec4 p = permute(permute(permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0))
                  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                  + i.x + vec4(0.0, i1.x, i2.x, 1.0));

        float n_ = 0.142857142857;
        vec3  ns = n_ * D.wyz - D.xzx;

        vec4 j  = p - 49.0 * floor(p * ns.z * ns.z);
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);

        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);

        vec4 s0 = floor(b0) * 2.0 + 1.0;
        vec4 s1 = floor(b1) * 2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);

        vec4 norm = 1.79284291400159 - 0.85373472095314 * vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
      }

      // Exact cover-fit mapping matching CSS background-size: cover; background-position: center center
      vec2 getCoverUV(vec2 uv, vec2 screenRes, vec2 imgRes) {
        float screenAspect = screenRes.x / screenRes.y;
        float imgAspect = imgRes.x / imgRes.y;
        vec2 coverUV = uv;
        if (screenAspect > imgAspect) {
          float factor = imgAspect / screenAspect;
          coverUV.y = (coverUV.y - 0.5) * factor + 0.5;
        } else {
          float factor = screenAspect / imgAspect;
          coverUV.x = (coverUV.x - 0.5) * factor + 0.5;
        }
        return coverUV;
      }

      void main() {
        vec2 coverUV = getCoverUV(v_uv, u_resolution, u_imageResolution);

        // ── Character, Text & Navigation Motion Masks ─────────────────────────
        // 1. Face & Head region — protect portrait sharpness
        vec2 faceOffset = (coverUV - vec2(0.515, 0.69)) / vec2(0.13, 0.19);
        float faceWeight = smoothstep(0.9, 1.4, length(faceOffset));

        // 2. Neck & Upper Torso
        vec2 neckOffset = (coverUV - vec2(0.515, 0.50)) / vec2(0.11, 0.08);
        float neckWeight = smoothstep(0.85, 1.35, length(neckOffset));

        // 3. Central Title Block: allow gentle smoke and energy flow behind text
        vec2 titleBox = abs(coverUV - vec2(0.50, 0.26)) - vec2(0.32, 0.18);
        float dTitleBox = length(max(titleBox, 0.0));
        float textWeight = 0.65 + 0.35 * smoothstep(0.0, 0.08, dTitleBox);

        // 4. Navigation top strip — no displacement near nav links
        float topNavWeight = smoothstep(0.95, 0.89, coverUV.y);

        float motionMask = faceWeight * neckWeight * textWeight * topNavWeight;

        // ── Cursor-Responsive Avatar Parallax ─────────────────────────────────
        float charMask = 1.0 - faceWeight;
        vec2 avatarParallax = u_mouse * vec2(0.006, -0.004) * charMask;

        // ── Organic Smoke Internal Displacement ───────────────────────────────
        float t = u_time * 0.55 * u_speed;
        vec2 p1 = coverUV * vec2(2.2, 1.9);
        float n1x = snoise(vec3(p1 + vec2(0.0, -t * 0.50), t * 0.40));
        float n1y = snoise(vec3(p1 + vec2(4.3, -t * 0.60), t * 0.40));

        vec2 p2 = coverUV * vec2(4.4, 3.8);
        float n2x = snoise(vec3(p2 + vec2(1.7, -t * 0.75), t * 0.60));
        float n2y = snoise(vec3(p2 + vec2(7.9, -t * 0.85), t * 0.60));

        vec2 flow = vec2(n1x + 0.38 * n2x, n1y + 0.38 * n2y);
        vec2 smokeDisplacement = flow * (0.022 * motionMask);

        // Final sampling coordinates
        vec2 sampleUV = clamp(coverUV + smokeDisplacement - avatarParallax, vec2(0.001), vec2(0.965));
        vec4 baseColor = texture2D(u_image, sampleUV);

        // ── Atmospheric Intro Fade ────────────────────────────────────────────
        // Simple scene fade from black — no text detection, no veil, no sweep.
        // HTML title overlay handles the cinematic letter-by-letter reveal.
        float introT = u_introTime;
        float sceneFade = u_isIntroComplete > 0.5 ? 1.0 : smoothstep(0.0, 1.8, introT);

        gl_FragColor = vec4(baseColor.rgb * sceneFade, 1.0);
      }
    `

    // Compile shaders & program
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)
    if (!vertexShader) return
    gl.shaderSource(vertexShader, vsSource)
    gl.compileShader(vertexShader)
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error('Vertex Shader Error:', gl.getShaderInfoLog(vertexShader))
      return
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
    if (!fragmentShader) return
    gl.shaderSource(fragmentShader, fsSource)
    gl.compileShader(fragmentShader)
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error('Fragment Shader Error:', gl.getShaderInfoLog(fragmentShader))
      return
    }

    const program = gl.createProgram()
    if (!program) return
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program Link Error:', gl.getProgramInfoLog(program))
      return
    }

    // Fullscreen quad buffer
    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1,
      ]),
      gl.STATIC_DRAW
    )

    const positionLocation = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    const resolutionLoc     = gl.getUniformLocation(program, 'u_resolution')
    const imgResolutionLoc  = gl.getUniformLocation(program, 'u_imageResolution')
    const timeLoc           = gl.getUniformLocation(program, 'u_time')
    const introTimeLoc      = gl.getUniformLocation(program, 'u_introTime')
    const isCompleteLoc     = gl.getUniformLocation(program, 'u_isIntroComplete')
    const mouseLoc          = gl.getUniformLocation(program, 'u_mouse')
    const speedLoc          = gl.getUniformLocation(program, 'u_speed')
    const imageLoc          = gl.getUniformLocation(program, 'u_image')

    // Texture setup
    const texture = gl.createTexture()
    const setupTextureParams = () => {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    }

    gl.bindTexture(gl.TEXTURE_2D, texture)
    setupTextureParams()
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([5, 6, 8, 255])
    )

    let imgNaturalWidth = 1672
    let imgNaturalHeight = 941

    const img = new Image()
    img.crossOrigin = 'anonymous'

    const uploadTexture = () => {
      if (!gl || !texture) return
      imgNaturalWidth = img.naturalWidth || 1672
      imgNaturalHeight = img.naturalHeight || 941
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
      setupTextureParams()
    }

    img.onload = uploadTexture
    img.src = '/images/hero-clean.png'
    if (img.complete && img.naturalWidth > 0) {
      uploadTexture()
    }

    const speed = reducedMotion ? 0.0 : 1.0

    const render = (now: number) => {
      if (!gl || !program) return
      const totalElapsed = (now - globalStartTime) * 0.001
      const introElapsed = (now - introStartTime) * 0.001

      if (!isIntroComplete && introElapsed >= 2.0) {
        isIntroComplete = true
      }

      // Smooth cursor parallax interpolation (cinematic damping)
      currentMouseX += (targetMouseX - currentMouseX) * 0.05
      currentMouseY += (targetMouseY - currentMouseY) * 0.05

      gl.useProgram(program)
      gl.uniform2f(resolutionLoc, canvas.width, canvas.height)
      gl.uniform2f(imgResolutionLoc, imgNaturalWidth, imgNaturalHeight)
      gl.uniform1f(timeLoc, totalElapsed)
      gl.uniform1f(introTimeLoc, introElapsed)
      gl.uniform1f(isCompleteLoc, isIntroComplete ? 1.0 : 0.0)
      gl.uniform2f(mouseLoc, reducedMotion ? 0.0 : currentMouseX, reducedMotion ? 0.0 : currentMouseY)
      gl.uniform1f(speedLoc, speed)
      gl.uniform1i(imageLoc, 0)

      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, texture)

      gl.drawArrays(gl.TRIANGLES, 0, 6)

      ;(window as any).__SMOKE_CANVAS_TIME__ = totalElapsed

      animationFrameId = requestAnimationFrame(render)
    }

    animationFrameId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', updateSize)
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('replay-cinematic-intro', handleReplayIntro)
      if (positionBuffer) gl.deleteBuffer(positionBuffer)
      if (texture)        gl.deleteTexture(texture)
      if (program)        gl.deleteProgram(program)
      if (vertexShader)   gl.deleteShader(vertexShader)
      if (fragmentShader) gl.deleteShader(fragmentShader)
    }
  }, [reducedMotion])

  return (
    <canvas
      ref={canvasRef}
      className="webgl-smoke-canvas"
      aria-hidden="true"
    />
  )
}
