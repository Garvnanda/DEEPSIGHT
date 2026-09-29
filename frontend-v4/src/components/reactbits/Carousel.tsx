// React Bits  Carousel. Draggable 3D card carousel with autoplay + indicators.
//
// The track is animated imperatively rather than through a `animate` prop driven by
// React state. The wrap at the end of the loop has to move `x` instantly, and doing that
// alongside a state update raced the next render: motion still held the old target, so it
// sprang the whole track back across every card before settling  the visible stutter on
// the last slide. Driving the animation by hand keeps the jump and its target in the same
// tick, and `x.jump()` moves without carrying spring velocity into the next leg.

import {
    animate,
    motion,
    useMotionValue,
    useTransform,
    type MotionValue,
    type PanInfo,
} from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'

import './Carousel.css'

export interface CarouselItem {
  id: number
  title: string
  description: string
  icon?: React.ReactNode
}

const DRAG_BUFFER = 0
const VELOCITY_THRESHOLD = 500
const GAP = 16
const SPRING = { type: 'spring' as const, stiffness: 300, damping: 30 }

function Card({
  item,
  index,
  itemWidth,
  trackItemOffset,
  x,
}: {
  item: CarouselItem
  index: number
  itemWidth: number
  trackItemOffset: number
  x: MotionValue<number>
}) {
  const range = [
    -(index + 1) * trackItemOffset,
    -index * trackItemOffset,
    -(index - 1) * trackItemOffset,
  ]
  // Clamped on purpose. Extrapolating past the ends sent distant cards through 180° and
  // 360°, where they face the viewer again  mirrored  and pile up on top of the active
  // card. Clamped, they stop dead at ±90°: edge-on, and nothing to paint.
  const rotateY = useTransform(x, range, [90, 0, -90])
  // and drop them entirely once they are a full slot away, so the compositor skips them
  const opacity = useTransform(x, range, [0, 1, 0])
  return (
    <motion.div
      className="rb-carousel-item"
      style={{
        width: itemWidth,
        rotateY,
        opacity,
        backfaceVisibility: 'hidden',
        willChange: 'transform, opacity',
      }}
    >
      {item.icon && <span className="rb-carousel-icon">{item.icon}</span>}
      <div className="rb-carousel-title">{item.title}</div>
      <p className="rb-carousel-desc">{item.description}</p>
    </motion.div>
  )
}

interface Props {
  items: CarouselItem[]
  baseWidth?: number
  autoplay?: boolean
  autoplayDelay?: number
  pauseOnHover?: boolean
  loop?: boolean
}

export function Carousel({
  items,
  baseWidth = 320,
  autoplay = true,
  autoplayDelay = 3800,
  pauseOnHover = true,
  loop = true,
}: Props) {
  const containerPadding = 16
  const itemWidth = baseWidth - containerPadding * 2
  const trackItemOffset = itemWidth + GAP

  const itemsForRender = useMemo(() => {
    if (!loop || items.length === 0) return items
    return [items[items.length - 1], ...items, items[0]]
  }, [items, loop])

  const lastIndex = itemsForRender.length - 1

  // `instant` says how to reach this index: spring to it, or snap with no animation at
  // all. The wrap sets it, and because it lands in the *next* effect pass the finished
  // animation has already been stopped and can no longer write the old value back.
  const [pos, setPos] = useState({ i: loop ? 1 : 0, instant: true })
  const position = pos.i
  const x = useMotionValue(loop ? -trackItemOffset : 0)
  const [isHovered, setIsHovered] = useState(false)
  const dragging = useRef(false)

  const go = (i: number) => setPos({ i, instant: false })

  useEffect(() => {
    const target = -(position * trackItemOffset)
    if (pos.instant) {
      x.jump(target)
      return
    }
    const controls = animate(x, target, {
      ...SPRING,
      onComplete: () => {
        if (!loop || itemsForRender.length <= 1) return
        if (position === lastIndex) setPos({ i: 1, instant: true })
        else if (position === 0) setPos({ i: items.length, instant: true })
      },
    })
    return () => controls.stop()
  }, [pos, position, trackItemOffset, loop, lastIndex, items.length, itemsForRender.length, x])

  useEffect(() => {
    if (!autoplay || itemsForRender.length <= 1 || (pauseOnHover && isHovered)) return
    const t = setInterval(() => {
      if (!dragging.current) setPos((p) => ({ i: Math.min(p.i + 1, lastIndex), instant: false }))
    }, autoplayDelay)
    return () => clearInterval(t)
  }, [autoplay, autoplayDelay, isHovered, pauseOnHover, itemsForRender.length, lastIndex])

  // reset when the item set itself changes
  useEffect(() => {
    setPos({ i: loop ? 1 : 0, instant: true })
  }, [items.length, loop])

  const onDragEnd = (_: unknown, info: PanInfo) => {
    dragging.current = false
    const dir =
      info.offset.x < -DRAG_BUFFER || info.velocity.x < -VELOCITY_THRESHOLD
        ? 1
        : info.offset.x > DRAG_BUFFER || info.velocity.x > VELOCITY_THRESHOLD
          ? -1
          : 0
    if (dir === 0) {
      // snap back to where we already are
      void animate(x, -(position * trackItemOffset), SPRING)
      return
    }
    go(Math.max(0, Math.min(position + dir, lastIndex)))
  }

  const activeIndex = loop
    ? (position - 1 + items.length) % items.length
    : Math.min(position, items.length - 1)

  return (
    <div
      className="rb-carousel-container"
      style={{ width: baseWidth }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div
        className="rb-carousel-track"
        drag="x"
        dragMomentum={false}
        dragConstraints={
          loop
            ? undefined
            : { left: -trackItemOffset * Math.max(itemsForRender.length - 1, 0), right: 0 }
        }
        style={{ width: itemWidth, gap: `${GAP}px`, perspective: 1000, x }}
        onDragStart={() => {
          dragging.current = true
        }}
        onDragEnd={onDragEnd}
      >
        {itemsForRender.map((item, index) => (
          <Card
            key={`${item.id}-${index}`}
            item={item}
            index={index}
            itemWidth={itemWidth}
            trackItemOffset={trackItemOffset}
            x={x}
          />
        ))}
      </motion.div>
      <div className="rb-carousel-dots">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            className={`rb-carousel-dot ${activeIndex === i ? 'active' : ''}`}
            onClick={() => go(loop ? i + 1 : i)}
          />
        ))}
      </div>
    </div>
  )
}
