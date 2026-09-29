// React Bits  Dock. macOS-style magnifying dock (framer-motion).
import {
    AnimatePresence,
    motion,
    useMotionValue,
    useSpring,
    useTransform,
    type MotionValue,
    type SpringOptions,
} from 'framer-motion'
import { Children, cloneElement, isValidElement, useEffect, useMemo, useRef, useState } from 'react'

import './Dock.css'

export interface DockItemData {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  className?: string
}

interface DockItemProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  mouseX: MotionValue<number>
  spring: SpringOptions
  distance: number
  magnification: number
  baseItemSize: number
  label: string
}

function DockItem({
  children,
  className = '',
  onClick,
  mouseX,
  spring,
  distance,
  magnification,
  baseItemSize,
  label,
}: DockItemProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isHovered = useMotionValue(0)
  const mouseDistance = useTransform(mouseX, (val) => {
    const rect = ref.current?.getBoundingClientRect() ?? { x: 0, width: baseItemSize }
    return val - rect.x - baseItemSize / 2
  })
  const targetSize = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [baseItemSize, magnification, baseItemSize],
  )
  const size = useSpring(targetSize, spring)

  return (
    <motion.div
      ref={ref}
      style={{ width: size, height: size }}
      onHoverStart={() => isHovered.set(1)}
      onHoverEnd={() => isHovered.set(0)}
      onFocus={() => isHovered.set(1)}
      onBlur={() => isHovered.set(0)}
      onClick={onClick}
      className={`dock-item ${className}`}
      tabIndex={0}
      role="button"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      {Children.map(children, (child) =>
        isValidElement(child)
          ? cloneElement(child as React.ReactElement<{ isHovered?: MotionValue<number> }>, { isHovered })
          : child,
      )}
    </motion.div>
  )
}

function DockLabel({ children, isHovered }: { children: React.ReactNode; isHovered?: MotionValue<number> }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!isHovered) return
    return isHovered.on('change', (v) => setVisible(v === 1))
  }, [isHovered])
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: -10 }}
          exit={{ opacity: 0, y: 0 }}
          transition={{ duration: 0.2 }}
          className="dock-label"
          role="tooltip"
          style={{ x: '-50%' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function DockIcon({ children }: { children: React.ReactNode }) {
  return <div className="dock-icon">{children}</div>
}

interface DockProps {
  items: DockItemData[]
  className?: string
  spring?: SpringOptions
  magnification?: number
  distance?: number
  panelHeight?: number
  baseItemSize?: number
}

export function Dock({
  items,
  className = '',
  spring = { mass: 0.1, stiffness: 150, damping: 12 },
  magnification = 64,
  distance = 180,
  panelHeight = 60,
  baseItemSize = 44,
}: DockProps) {
  const mouseX = useMotionValue(Infinity)
  const isHovered = useMotionValue(0)
  const maxHeight = useMemo(() => Math.max(160, magnification + magnification / 2 + 4), [magnification])
  const heightRow = useTransform(isHovered, [0, 1], [panelHeight, maxHeight])
  const height = useSpring(heightRow, spring)

  return (
    <motion.div style={{ height, scrollbarWidth: 'none' }} className="dock-outer">
      <motion.div
        onMouseMove={({ pageX }) => {
          isHovered.set(1)
          mouseX.set(pageX)
        }}
        onMouseLeave={() => {
          isHovered.set(0)
          mouseX.set(Infinity)
        }}
        className={`dock-panel ${className}`}
        style={{ height: panelHeight }}
        role="toolbar"
        aria-label="Section dock"
      >
        {items.map((item, i) => (
          <DockItem
            key={i}
            onClick={item.onClick}
            className={item.className}
            mouseX={mouseX}
            spring={spring}
            distance={distance}
            magnification={magnification}
            baseItemSize={baseItemSize}
            label={item.label}
          >
            <DockIcon>{item.icon}</DockIcon>
            <DockLabel>{item.label}</DockLabel>
          </DockItem>
        ))}
      </motion.div>
    </motion.div>
  )
}
