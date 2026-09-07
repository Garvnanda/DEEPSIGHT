// WaterfallCanvas — The heart of the demo.
// Renders sonar waterfall data from the ring buffer with instrument chrome.
// Smooth scrolling via RAF drain loop. Letterboxed, never stretched.

import { useRef, useEffect, useCallback } from 'react';
import { RingBuffer } from './RingBuffer';
import { amberLUT, greyLUT } from './colourRamp';
import { usePlaybackStore } from '../stores/playbackStore';
import { useSelectionStore } from '../stores/selectionStore';
import type { Detection } from '../types/api';

// How many rows to drain per animation frame for smooth scrolling
const ROWS_PER_FRAME = 4;

// Detection class → colour hex (for drawing boxes)
const CLASS_COLOURS: Record<string, string> = {
  wreck: '#E0674F',
  milco: '#E8A33D',
  pipeline: '#4FB3C9',
  nombo: '#7E9AA3',
};

interface WaterfallCanvasProps {
  rangeM: number;
  corrected?: boolean;
}

export function WaterfallCanvas({ rangeM }: WaterfallCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ringBufferRef = useRef<RingBuffer>(new RingBuffer());
  const rafRef = useRef<number>(0);
  const drainIndexRef = useRef(0); // which batch in the queue we're processing
  const drainRowRef = useRef(0); // which row within the current batch
  const scrollOffsetRef = useRef(0); // total rows drained (for detection box positioning)

  // Check reduced motion preference
  const reducedMotion = useRef(
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  const getDetections = useCallback(() => {
    return usePlaybackStore.getState().detections;
  }, []);

  const getSelectedId = useCallback(() => {
    return useSelectionStore.getState().selectedDetectionId;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false })!;
    const rb = ringBufferRef.current;

    // --- ResizeObserver to sync canvas with container ---
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.scale(dpr, dpr);
    };

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(container);
    resizeCanvas();

    // --- RAF render loop ---
    const render = () => {
      const state = usePlaybackStore.getState();
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = canvas.width / dpr;
      const displayHeight = canvas.height / dpr;

      // Reset transform for each frame
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Clear with hull-deep background
      ctx.fillStyle = '#0E1A1E';
      ctx.fillRect(0, 0, displayWidth, displayHeight);

      // --- Drain rows from the queue ---
      const queue = state.rowQueue;
      const lut = state.correctedView ? greyLUT : amberLUT;
      const isPlaying = state.state === 'playing';

      if (isPlaying && !reducedMotion.current) {
        let rowsDrained = 0;
        while (rowsDrained < ROWS_PER_FRAME && drainIndexRef.current < queue.length) {
          const batch = queue[drainIndexRef.current];
          const rowsLeft = batch.count - drainRowRef.current;
          const toDrain = Math.min(rowsLeft, ROWS_PER_FRAME - rowsDrained);

          // Extract the slice of rows to write
          const offset = drainRowRef.current * batch.width;
          const slice = batch.data.slice(offset, offset + toDrain * batch.width);
          rb.writeRows(slice, toDrain, batch.width, lut);

          drainRowRef.current += toDrain;
          rowsDrained += toDrain;
          scrollOffsetRef.current += toDrain;

          if (drainRowRef.current >= batch.count) {
            drainIndexRef.current++;
            drainRowRef.current = 0;
          }
        }
      }

      // --- Draw waterfall from ring buffer ---
      const wfWidth = rb.bufferWidth || state.waterfallWidth;
      if (wfWidth > 0) {
        // Letterbox: centre the waterfall, pad with hull-deep
        const xOffset = Math.max(0, Math.floor((displayWidth - wfWidth) / 2));
        rb.drawTo(ctx, xOffset, Math.floor(displayHeight));

        // --- Instrument Chrome ---
        drawChrome(ctx, xOffset, wfWidth, displayWidth, displayHeight, rangeM);

        // --- Detection boxes ---
        drawDetections(
          ctx,
          xOffset,
          wfWidth,
          displayHeight,
          scrollOffsetRef.current,
          getDetections(),
          getSelectedId()
        );
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
    };
  }, [rangeM, getDetections, getSelectedId]);

  return (
    <div ref={containerRef} className="waterfall-container">
      <canvas ref={canvasRef} />
    </div>
  );
}

// --- Instrument Chrome Drawing ---

function drawChrome(
  ctx: CanvasRenderingContext2D,
  xOffset: number,
  wfWidth: number,
  displayWidth: number,
  displayHeight: number,
  rangeM: number
) {
  // Faint nadir centre line
  const nadirX = xOffset + Math.floor(wfWidth / 2);
  ctx.strokeStyle = 'rgba(44, 70, 80, 0.5)'; // --rule with alpha
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(nadirX + 0.5, 0);
  ctx.lineTo(nadirX + 0.5, displayHeight);
  ctx.stroke();
  ctx.setLineDash([]);

  // Port / Starboard labels
  ctx.font = '11px IBM Plex Sans';
  ctx.fillStyle = '#7E9AA3'; // --text-quiet
  ctx.textAlign = 'center';
  ctx.fillText('PORT', xOffset + wfWidth * 0.25, 16);
  ctx.fillText('STBD', xOffset + wfWidth * 0.75, 16);

  // Range scale ticks down both edges
  if (rangeM > 0) {
    ctx.font = '10px IBM Plex Mono';
    ctx.fillStyle = '#7E9AA3';
    ctx.textAlign = 'left';

    const tickCount = 5;
    const halfWidth = wfWidth / 2;
    for (let i = 0; i <= tickCount; i++) {
      const rangeFrac = i / tickCount;
      const rangeVal = (rangeM * rangeFrac).toFixed(0);
      const xLeft = xOffset + Math.floor(halfWidth * (1 - rangeFrac));
      const xRight = xOffset + Math.floor(halfWidth + halfWidth * rangeFrac);

      // Tick marks on waterfall edges at fixed y positions
      const yTick = 30 + i * 40;
      if (yTick < displayHeight - 20) {
        // Left edge tick
        ctx.fillText(`${rangeVal}m`, xOffset + 4, yTick);
        // Right edge tick
        ctx.textAlign = 'right';
        ctx.fillText(`${rangeVal}m`, xOffset + wfWidth - 4, yTick);
        ctx.textAlign = 'left';

        // Small tick lines
        ctx.strokeStyle = 'rgba(44, 70, 80, 0.3)';
        ctx.beginPath();
        ctx.moveTo(xLeft, yTick - 4);
        ctx.lineTo(xLeft, yTick + 4);
        ctx.moveTo(xRight, yTick - 4);
        ctx.lineTo(xRight, yTick + 4);
        ctx.stroke();
      }
    }
  }

  // Ping counter overlay — drawn by the component that has access to the store
  // (handled separately via DOM overlay to avoid re-drawing text every frame)
  void displayWidth; // used for centering calculations
}

// --- Detection Box Drawing ---

function drawDetections(
  ctx: CanvasRenderingContext2D,
  xOffset: number,
  _wfWidth: number,
  displayHeight: number,
  scrollOffset: number,
  detections: Detection[],
  selectedId: string | null
) {
  for (const det of detections) {
    // Convert absolute ping index to screen Y position
    const screenY = displayHeight - (scrollOffset - det.bbox_px.y);
    const screenX = xOffset + det.bbox_px.x;
    const boxW = det.bbox_px.w;
    const boxH = det.bbox_px.h;

    // Only draw if the box is within the visible window
    if (screenY + boxH < 0 || screenY > displayHeight) continue;

    const isSelected = det.detection_id === selectedId;
    const colour = CLASS_COLOURS[det.class] || '#4FB3C9';

    // Box outline
    ctx.strokeStyle = isSelected ? '#FFFFFF' : colour;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.strokeRect(screenX, screenY, boxW, boxH);

    // Class label — small, outside the box so it doesn't obscure the target
    ctx.font = '10px IBM Plex Sans';
    ctx.fillStyle = colour;
    ctx.textAlign = 'left';
    ctx.fillText(det.class_display, screenX, screenY - 3);
  }
}
