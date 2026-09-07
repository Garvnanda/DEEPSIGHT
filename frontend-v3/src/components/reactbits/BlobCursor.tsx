// React Bits  BlobCursor. Trailing gooey blobs follow the pointer (gsap).
import gsap from 'gsap'
import { useCallback, useEffect, useRef } from 'react'

import './BlobCursor.css'

interface Props {
  fillColor?: string
  trailCount?: number
  sizes?: number[]
  innerSizes?: number[]
  innerColor?: string
  opacities?: number[]
  filterId?: string
  filterStdDeviation?: number
  filterColorMatrixValues?: string
  useFilter?: boolean
  fastDuration?: number
  slowDuration?: number
  zIndex?: number
}

export function BlobCursor({
  fillColor = 'var(--accent)',
  trailCount = 3,
  sizes = [48, 96, 60],
  innerSizes = [16, 28, 20],
  innerColor = 'rgba(255,255,255,0.7)',
  opacities = [0.5, 0.5, 0.5],
  filterId = 'blob',
  filterStdDeviation = 24,
  filterColorMatrixValues = '1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 32 -9',
  useFilter = true,
  fastDuration = 0.1,
  slowDuration = 0.5,
  zIndex = 5,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const blobsRef = useRef<(HTMLDivElement | null)[]>([])

  const handleMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const rect = containerRef.current?.getBoundingClientRect()
      const left = rect?.left ?? 0
      const top = rect?.top ?? 0
      const x = 'clientX' in e ? e.clientX : e.touches[0].clientX
      const y = 'clientY' in e ? e.clientY : e.touches[0].clientY
      blobsRef.current.forEach((el, i) => {
        if (!el) return
        gsap.to(el, {
          x: x - left,
          y: y - top,
          duration: i === 0 ? fastDuration : slowDuration,
          ease: i === 0 ? 'power3.out' : 'power1.out',
        })
      })
    },
    [fastDuration, slowDuration],
  )

  useEffect(() => {
    const onResize = () => containerRef.current?.getBoundingClientRect()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return (
    <div
      ref={containerRef}
      className="blob-container"
      style={{ zIndex }}
      onMouseMove={handleMove}
      onTouchMove={handleMove}
    >
      {useFilter && (
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <filter id={filterId}>
            <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation={filterStdDeviation} />
            <feColorMatrix in="blur" values={filterColorMatrixValues} />
          </filter>
        </svg>
      )}
      <div className="blob-main" style={{ filter: useFilter ? `url(#${filterId})` : undefined }}>
        {Array.from({ length: trailCount }).map((_, i) => (
          <div
            key={i}
            ref={(el) => {
              blobsRef.current[i] = el
            }}
            className="blob"
            style={{
              width: sizes[i],
              height: sizes[i],
              backgroundColor: fillColor,
              opacity: opacities[i],
            }}
          >
            <div
              className="inner-dot"
              style={{
                width: innerSizes[i],
                height: innerSizes[i],
                top: (sizes[i] - innerSizes[i]) / 2,
                left: (sizes[i] - innerSizes[i]) / 2,
                backgroundColor: innerColor,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
