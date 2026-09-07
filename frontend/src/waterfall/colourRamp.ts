// Waterfall Colour Ramp — Pre-computed 256-entry lookup tables.
// Maps greyscale byte value (0–255) → packed RGBA as Uint32.
// The amber ramp matches real survey software warm tones.

/** Linearly interpolate between two hex colours at position t (0–1). */
function lerpColour(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
  t: number
): [number, number, number] {
  return [
    Math.round(r1 + (r2 - r1) * t),
    Math.round(g1 + (g2 - g1) * t),
    Math.round(b1 + (b2 - b1) * t),
  ];
}

/** Pack RGBA into a single Uint32 (little-endian: ABGR byte order). */
function packRGBA(r: number, g: number, b: number, a: number): number {
  return (a << 24) | (b << 16) | (g << 8) | r;
}

/**
 * Build a 256-entry Uint32Array LUT from a set of anchor points.
 * Each anchor is [byteValue, r, g, b].
 */
function buildLUT(anchors: [number, number, number, number][]): Uint32Array {
  const lut = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    // Find the two anchors this index falls between
    let lower = anchors[0];
    let upper = anchors[anchors.length - 1];
    for (let a = 0; a < anchors.length - 1; a++) {
      if (i >= anchors[a][0] && i <= anchors[a + 1][0]) {
        lower = anchors[a];
        upper = anchors[a + 1];
        break;
      }
    }
    const range = upper[0] - lower[0];
    const t = range === 0 ? 0 : (i - lower[0]) / range;
    const [r, g, b] = lerpColour(
      lower[1], lower[2], lower[3],
      upper[1], upper[2], upper[3],
      t
    );
    lut[i] = packRGBA(r, g, b, 255);
  }
  return lut;
}

// Amber ramp anchors from the design spec:
// #1A0E05 → #4A2408 → #8F5312 → #D18B2A → #F2BC61 → #FFE9C4
const AMBER_ANCHORS: [number, number, number, number][] = [
  [0,   0x1A, 0x0E, 0x05],
  [51,  0x4A, 0x24, 0x08],
  [102, 0x8F, 0x53, 0x12],
  [153, 0xD1, 0x8B, 0x2A],
  [204, 0xF2, 0xBC, 0x61],
  [255, 0xFF, 0xE9, 0xC4],
];

// Greyscale anchors for the toggle
const GREY_ANCHORS: [number, number, number, number][] = [
  [0,   0x0A, 0x0A, 0x0A],
  [255, 0xF0, 0xF0, 0xF0],
];

/** Pre-computed amber colour LUT (default). */
export const amberLUT = buildLUT(AMBER_ANCHORS);

/** Pre-computed greyscale LUT (toggle option). */
export const greyLUT = buildLUT(GREY_ANCHORS);
