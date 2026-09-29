// React Bits  SpecularButton. WebGL specular rim highlight that follows the cursor (ogl).
import { Color, Mesh, Program, Renderer, Triangle } from 'ogl'
import { useEffect, useRef } from 'react'

import './SpecularButton.css'

const PAD = 20

const VERT = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uRadius;
uniform float uAngle;
uniform float uPx;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform float uShineSize;
uniform float uShineFade;
uniform float uThickness;
uniform float uBaseWidth;
out vec4 fragColor;
float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float gaussianLine(float d, float sigma) {
  float x = d / (sigma + 1e-6);
  float k = mix(1.0, 1.6, smoothstep(0.0, 1.5, x));
  return exp(-k * x * x);
}
void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = sdRoundedRect(p, uHalfSize, uRadius);
  vec2 L = vec2(cos(uAngle), sin(uAngle));
  float base = (1.0 - smoothstep(0.0, uBaseWidth, abs(d))) * 0.45;
  vec2 nEll = normalize(p / (uHalfSize * uHalfSize) + 1e-6);
  float phi = acos(clamp(abs(dot(nEll, L)), 0.0, 1.0));
  float rim = 1.0 - smoothstep(uShineSize - uShineFade, uShineSize + uShineFade + 1e-4, phi);
  float line = gaussianLine(d, uThickness);
  float edgeClamp = 1.0 - smoothstep(0.5 * uPx, 3.0 * uPx, abs(d));
  float hi = line * rim * edgeClamp * uIntensity;
  vec3 col = uBaseColor * base + uLineColor * hi;
  float a = clamp(base + hi, 0.0, 1.0);
  fragColor = vec4(col, a);
}
`

interface Props {
  children?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  radius?: number
  textColor?: string
  lineColor?: string
  baseColor?: string
  intensity?: number
  speed?: number
  proximity?: number
  disabled?: boolean
  onClick?: React.MouseEventHandler
  className?: string
  type?: 'button' | 'submit' | 'reset'
}

export function SpecularButton({
  children = 'Get started',
  size = 'md',
  radius = 14,
  textColor = 'var(--primary-foreground)',
  lineColor = '#ffffff',
  baseColor = '#7a7a7a',
  intensity = 1,
  speed = 0.35,
  proximity = 240,
  disabled = false,
  onClick,
  className = '',
  type = 'button',
}: Props) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const fxRef = useRef<HTMLSpanElement>(null)
  const propsRef = useRef({ radius, lineColor, baseColor, intensity, speed, proximity })
  propsRef.current = { radius, lineColor, baseColor, intensity, speed, proximity }

  useEffect(() => {
    const btn = btnRef.current
    const fx = fxRef.current
    if (!btn || !fx) return
    const dpr = window.devicePixelRatio || 1
    let renderer: Renderer
    try {
      renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true, dpr })
    } catch {
      return
    }
    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    const geometry = new Triangle(gl)
    const attrs = geometry.attributes as unknown as Record<string, unknown>
    if (attrs.uv) delete attrs.uv
    const program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uCenter: { value: [0, 0] },
        uHalfSize: { value: [1, 1] },
        uRadius: { value: 0 },
        uAngle: { value: 2.4 },
        uPx: { value: dpr },
        uLineColor: { value: [1, 1, 1] },
        uBaseColor: { value: [0.48, 0.48, 0.48] },
        uIntensity: { value: 1 },
        uShineSize: { value: 0.17 },
        uShineFade: { value: 0.7 },
        uThickness: { value: 1 },
        uBaseWidth: { value: dpr },
      },
    })
    const mesh = new Mesh(gl, { geometry, program })
    fx.appendChild(gl.canvas)

    const sz = { w: 1, h: 1 }
    const resize = () => {
      const r = btn.getBoundingClientRect()
      sz.w = r.width
      sz.h = r.height
      renderer.setSize(r.width + PAD * 2, r.height + PAD * 2)
      program.uniforms.uCenter.value = [(PAD + r.width / 2) * dpr, (PAD + r.height / 2) * dpr]
      program.uniforms.uHalfSize.value = [(r.width / 2) * dpr, (r.height / 2) * dpr]
    }
    const ro = new ResizeObserver(resize)
    ro.observe(btn)
    resize()

    let pointerAngle: number | null = null
    let proximityT = 0
    const onPointerMove = (e: PointerEvent) => {
      const r = btn.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right)
      const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom)
      const dist = Math.hypot(dx, dy)
      pointerAngle = dist === 0
        ? Math.atan2(2 / r.height, -2 / r.width)
        : Math.atan2(cy - e.clientY, e.clientX - cx)
      const t = Math.max(0, 1 - dist / Math.max(propsRef.current.proximity, 1))
      proximityT = t * t * (3 - 2 * t)
    }
    window.addEventListener('pointermove', onPointerMove)

    let angle = 2.4
    let idleAngle = 2.4
    let bright = 0
    let last = performance.now()
    let raf = 0
    const lineC = new Color()
    const baseC = new Color()
    const update = (now: number) => {
      raf = requestAnimationFrame(update)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const p = propsRef.current
      idleAngle += p.speed * dt
      const target = pointerAngle != null ? pointerAngle : idleAngle
      const diff = ((target - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI
      angle += diff * (1 - Math.exp(-dt * 7))
      bright += (proximityT - bright) * (1 - Math.exp(-dt * 8))
      lineC.set(p.lineColor)
      baseC.set(p.baseColor)
      program.uniforms.uAngle.value = angle
      program.uniforms.uRadius.value = Math.min(p.radius, Math.min(sz.w, sz.h) / 2) * dpr
      program.uniforms.uLineColor.value = [lineC.r, lineC.g, lineC.b]
      program.uniforms.uBaseColor.value = [baseC.r, baseC.g, baseC.b]
      program.uniforms.uIntensity.value = p.intensity * bright
      renderer.render({ scene: mesh })
    }
    raf = requestAnimationFrame(update)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      if (gl.canvas.parentNode === fx) fx.removeChild(gl.canvas)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  return (
    <button
      ref={btnRef}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`specular-button specular-button--${size} ${className}`}
      style={{ ['--sb-radius' as string]: `${radius}px`, ['--sb-text-color' as string]: textColor }}
    >
      <span ref={fxRef} className="specular-button__fx" aria-hidden="true" />
      <span className="specular-button__label">{children}</span>
    </button>
  )
}
