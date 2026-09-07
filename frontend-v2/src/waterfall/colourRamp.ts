// Waterfall colour ramps  256-entry Uint32 LUTs (packed little-endian RGBA / ABGR).
// `amber` is the default sonar look; `ice` is a cool grey-blue for the geo-corrected view.

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t)
}

function pack(r: number, g: number, b: number) {
  return (255 << 24) | (b << 16) | (g << 8) | r
}

type Anchor = [number, number, number, number] // [byteValue, r, g, b]

function build(anchors: Anchor[]): Uint32Array {
  const lut = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let lo = anchors[0]
    let hi = anchors[anchors.length - 1]
    for (let a = 0; a < anchors.length - 1; a++) {
      if (i >= anchors[a][0] && i <= anchors[a + 1][0]) {
        lo = anchors[a]
        hi = anchors[a + 1]
        break
      }
    }
    const span = hi[0] - lo[0]
    const t = span === 0 ? 0 : (i - lo[0]) / span
    lut[i] = pack(lerp(lo[1], hi[1], t), lerp(lo[2], hi[2], t), lerp(lo[3], hi[3], t))
  }
  return lut
}

const AMBER: Anchor[] = [
  [0, 0x14, 0x0c, 0x06],
  [51, 0x45, 0x24, 0x0b],
  [102, 0x8c, 0x52, 0x16],
  [153, 0xcf, 0x8a, 0x30],
  [204, 0xf1, 0xbb, 0x63],
  [255, 0xff, 0xea, 0xc6],
]

const ICE: Anchor[] = [
  [0, 0x08, 0x0d, 0x12],
  [64, 0x1e, 0x33, 0x40],
  [128, 0x3f, 0x67, 0x7a],
  [192, 0x86, 0xb4, 0xc2],
  [255, 0xe9, 0xf4, 0xf7],
]

export const amberLUT = build(AMBER)
export const iceLUT = build(ICE)
