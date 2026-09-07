// React Bits  ElasticSlider (controlled). Timeline scrubber with elastic overflow drag.
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from 'framer-motion'
import { useRef, useState } from 'react'

import './ElasticSlider.css'

const MAX_OVERFLOW = 50

function decay(value: number, max: number) {
  if (max === 0) return 0
  const entry = value / max
  return (2 * (1 / (1 + Math.exp(-entry)) - 0.5)) * max
}

interface Props {
  value: number
  min?: number
  max?: number
  step?: number
  onChange?: (v: number) => void
  onCommit?: (v: number) => void
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  className?: string
}

export function ElasticSlider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  onCommit,
  leftIcon,
  rightIcon,
  className = '',
}: Props) {
  const sliderRef = useRef<HTMLDivElement>(null)
  const [region, setRegion] = useState<'left' | 'middle' | 'right'>('middle')
  const clientX = useMotionValue(0)
  const overflow = useMotionValue(0)
  const scale = useMotionValue(1)

  useMotionValueEvent(clientX, 'change', (latest) => {
    const el = sliderRef.current
    if (!el) return
    const { left, right } = el.getBoundingClientRect()
    let nv: number
    if (latest < left) {
      setRegion('left')
      nv = left - latest
    } else if (latest > right) {
      setRegion('right')
      nv = latest - right
    } else {
      setRegion('middle')
      nv = 0
    }
    overflow.jump(decay(nv, MAX_OVERFLOW))
  })

  const valueFromEvent = (clientXPx: number) => {
    const el = sliderRef.current
    if (!el) return value
    const { left, width } = el.getBoundingClientRect()
    let nv = min + ((clientXPx - left) / width) * (max - min)
    nv = Math.round(nv / step) * step
    return Math.min(Math.max(nv, min), max)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons > 0) {
      onChange?.(valueFromEvent(e.clientX))
      clientX.jump(e.clientX)
    }
  }
  const onPointerDown = (e: React.PointerEvent) => {
    const nv = valueFromEvent(e.clientX)
    onChange?.(nv)
    clientX.jump(e.clientX)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerUp = () => {
    animate(overflow, 0, { type: 'spring', bounce: 0.5 })
    onCommit?.(value)
  }

  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100

  return (
    <motion.div
      onHoverStart={() => animate(scale, 1.15)}
      onHoverEnd={() => animate(scale, 1)}
      style={{ scale, opacity: useTransform(scale, [1, 1.15], [0.85, 1]) }}
      className={`rb-slider-wrapper ${className}`}
    >
      {leftIcon && (
        <motion.span
          className="rb-slider-icon"
          animate={{ scale: region === 'left' ? [1, 1.3, 1] : 1 }}
          style={{ x: useTransform(() => (region === 'left' ? -overflow.get() / scale.get() : 0)) }}
        >
          {leftIcon}
        </motion.span>
      )}
      <div
        ref={sliderRef}
        className="rb-slider-root"
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
      >
        <motion.div
          style={{
            scaleX: useTransform(() => {
              const w = sliderRef.current?.getBoundingClientRect().width ?? 1
              return 1 + overflow.get() / w
            }),
            scaleY: useTransform(overflow, [0, MAX_OVERFLOW], [1, 0.8]),
            transformOrigin: useTransform(() => {
              const el = sliderRef.current
              if (!el) return 'center'
              const { left, width } = el.getBoundingClientRect()
              return clientX.get() < left + width / 2 ? 'right' : 'left'
            }),
            height: useTransform(scale, [1, 1.15], [6, 10]),
          }}
          className="rb-slider-track-wrapper"
        >
          <div className="rb-slider-track">
            <div className="rb-slider-range" style={{ width: `${pct}%` }} />
          </div>
        </motion.div>
      </div>
      {rightIcon && (
        <motion.span
          className="rb-slider-icon"
          animate={{ scale: region === 'right' ? [1, 1.3, 1] : 1 }}
          style={{ x: useTransform(() => (region === 'right' ? overflow.get() / scale.get() : 0)) }}
        >
          {rightIcon}
        </motion.span>
      )}
    </motion.div>
  )
}
