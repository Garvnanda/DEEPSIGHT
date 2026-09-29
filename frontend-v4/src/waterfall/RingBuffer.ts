// Ring Buffer  Offscreen canvas for waterfall rendering.
// Manages a fixed-height canvas that wraps, preventing unbounded memory use
// for surveys with 40,000+ pings.

const BUFFER_HEIGHT = 4096;

export class RingBuffer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private writeCursor = 0;
  private _totalRowsWritten = 0;
  private initialized = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.width = 0;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false })!;
  }

  /** Lazily initialize dimensions from the first ping_batch's width. */
  private init(width: number): void {
    if (this.initialized && this.width === width) return;
    this.width = width;
    this.canvas.width = width;
    this.canvas.height = BUFFER_HEIGHT;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false })!;
    this.writeCursor = 0;
    this._totalRowsWritten = 0;
    this.initialized = true;
  }

  /** Total rows written since init  never wraps. Used for scroll offset. */
  get totalRowsWritten(): number {
    return this._totalRowsWritten;
  }

  get bufferHeight(): number {
    return BUFFER_HEIGHT;
  }

  get bufferWidth(): number {
    return this.width;
  }

  /**
   * Write rows into the ring buffer.
   * @param data Raw greyscale bytes (count × width)
   * @param count Number of rows
   * @param width Pixels per row
   * @param lut 256-entry Uint32Array colour lookup table
   */
  writeRows(data: Uint8Array, count: number, width: number, lut: Uint32Array): void {
    this.init(width);

    for (let row = 0; row < count; row++) {
      const rowOffset = row * width;

      // Create a single-row ImageData
      const imageData = this.ctx.createImageData(width, 1);
      const u32 = new Uint32Array(imageData.data.buffer);

      // Apply colour LUT  one write per pixel instead of four
      for (let x = 0; x < width; x++) {
        u32[x] = lut[data[rowOffset + x]];
      }

      // Write to offscreen canvas at current cursor
      this.ctx.putImageData(imageData, 0, this.writeCursor);

      // Advance and wrap
      this.writeCursor = (this.writeCursor + 1) % BUFFER_HEIGHT;
      this._totalRowsWritten++;
    }
  }

  /**
   * Draw the visible window from the ring buffer onto the display canvas.
   * Handles the wrap-around seam with two drawImage calls if needed.
   *
   * @param displayCtx The visible canvas context
   * @param xOffset Horizontal offset to centre/letterbox the waterfall
   * @param displayHeight How many rows the visible area can show
   */
  drawTo(
    displayCtx: CanvasRenderingContext2D,
    xOffset: number,
    displayHeight: number
  ): void {
    if (!this.initialized || this._totalRowsWritten === 0) return;

    displayCtx.imageSmoothingEnabled = false;

    // How many rows we actually have available
    const available = Math.min(this._totalRowsWritten, BUFFER_HEIGHT);
    const rowsToDraw = Math.min(displayHeight, available);

    // Read start position: the oldest row in the visible window
    // writeCursor points to where the NEXT row will be written,
    // so the most recent row is at (writeCursor - 1).
    // The visible window starts at (writeCursor - rowsToDraw).
    let readStart = ((this.writeCursor - rowsToDraw) % BUFFER_HEIGHT + BUFFER_HEIGHT) % BUFFER_HEIGHT;

    if (readStart + rowsToDraw <= BUFFER_HEIGHT) {
      // No wrap  single drawImage
      displayCtx.drawImage(
        this.canvas,
        0, readStart, this.width, rowsToDraw,        // source rect
        xOffset, displayHeight - rowsToDraw, this.width, rowsToDraw  // dest rect (bottom-aligned)
      );
    } else {
      // Wrap  two drawImage calls
      const firstChunk = BUFFER_HEIGHT - readStart; // rows from readStart to end of buffer
      const secondChunk = rowsToDraw - firstChunk;  // remaining rows from start of buffer

      // Draw the first chunk (bottom of buffer) at the top of the visible area
      displayCtx.drawImage(
        this.canvas,
        0, readStart, this.width, firstChunk,
        xOffset, displayHeight - rowsToDraw, this.width, firstChunk
      );

      // Draw the second chunk (top of buffer) below the first chunk
      displayCtx.drawImage(
        this.canvas,
        0, 0, this.width, secondChunk,
        xOffset, displayHeight - rowsToDraw + firstChunk, this.width, secondChunk
      );
    }
  }

  /** Clear the buffer and reset state. */
  reset(): void {
    if (this.initialized) {
      this.ctx.clearRect(0, 0, this.width, BUFFER_HEIGHT);
    }
    this.writeCursor = 0;
    this._totalRowsWritten = 0;
  }
}
