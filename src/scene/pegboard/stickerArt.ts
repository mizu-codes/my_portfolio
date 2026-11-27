import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, SRGBColorSpace } from 'three'

/**
 * Cute decorative vinyl stickers, drawn in code. No technology or developer-brand logos: cats, a camera, a controller,
 * a handheld console, stars and moons, a plant, a paw print, a pixel character and a coffee cup.
 * Each is drawn flat, then given a white die-cut border and a faint edge line, like a real printed vinyl sticker.
 */
export type StickerKind =
  | 'sleepingCat' | 'catFace' | 'camera' | 'controller' | 'handheld'
  | 'moonStars' | 'star' | 'plant' | 'paw' | 'pixelGhost' | 'coffee'

/** Texture size (px). Every sticker is drawn in a square canvas. */
const SIZE = 256
const INK = '#4a4457'

type G = CanvasRenderingContext2D

function path(g: G, pts: [number, number][], close = true) {
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (close) g.closePath()
}
function ell(g: G, x: number, y: number, rx: number, ry: number, rot = 0) {
  g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2)
}
function fillStroke(g: G, fill: string, lw = 6, stroke = INK) {
  g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = stroke; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke()
}
function rr(g: G, x: number, y: number, w: number, h: number, r: number | number[]) {
  g.beginPath(); g.roundRect(x, y, w, h, r)
}
function star5(g: G, cx: number, cy: number, R: number, r: number, rot = -Math.PI / 2) {
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5, rad = i % 2 ? r : R
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad
    i ? g.lineTo(x, y) : g.moveTo(x, y)
  }
  g.closePath()
}

/** Coloured vinyl disc printed behind some designs, so every sticker has its own colour identity against the dark steel. */
const BACKDROP: Partial<Record<StickerKind, { a: string; b: string; scale: number; sparkle?: boolean }>> = {
  sleepingCat: { a: '#5b6cff', b: '#3a3fc4', scale: 0.8, sparkle: true },
  catFace: { a: '#ffb3d1', b: '#ff7fb2', scale: 0.8 },
  moonStars: { a: '#4a46b8', b: '#2b2784', scale: 0.8, sparkle: true },
}

const ART: Record<StickerKind, (g: G) => void> = {
  sleepingCat(g) {
    // tail
    g.beginPath(); g.moveTo(196, 170); g.bezierCurveTo(250, 170, 244, 118, 206, 120)
    g.lineWidth = 26; g.strokeStyle = INK; g.lineCap = 'round'; g.stroke()
    g.lineWidth = 15; g.strokeStyle = '#ffffff'; g.stroke()
    // body loaf
    ell(g, 142, 168, 82, 48); fillStroke(g, '#ffffff')
    ell(g, 150, 186, 56, 18); g.fillStyle = 'rgba(190,196,214,0.45)'; g.fill()
    // head
    path(g, [[44, 128], [52, 84], [86, 108]]); fillStroke(g, '#ffffff')
    path(g, [[110, 108], [140, 84], [142, 128]]); fillStroke(g, '#ffffff')
    path(g, [[56, 116], [58, 98], [74, 108]]); g.fillStyle = '#f9b7c6'; g.fill()
    path(g, [[116, 112], [128, 100], [130, 118]]); g.fillStyle = '#f9b7c6'; g.fill()
    ell(g, 92, 150, 52, 42); fillStroke(g, '#ffffff')
    // closed eyes, nose, blush
    g.strokeStyle = INK; g.lineWidth = 5; g.lineCap = 'round'
    g.beginPath(); g.arc(72, 148, 9, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke()
    g.beginPath(); g.arc(112, 148, 9, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke()
    path(g, [[88, 160], [96, 160], [92, 166]]); g.fillStyle = '#f08fa6'; g.fill()
    ell(g, 62, 164, 9, 5.5); g.fillStyle = 'rgba(249,160,180,0.7)'; g.fill()
    ell(g, 124, 164, 9, 5.5); g.fillStyle = 'rgba(249,160,180,0.7)'; g.fill()
    // tucked paws
    ell(g, 104, 202, 20, 11); fillStroke(g, '#ffffff', 5)
    ell(g, 146, 204, 20, 11); fillStroke(g, '#ffffff', 5)
    // sleepy z's
    g.fillStyle = '#ffe27a'; g.font = '700 34px "Trebuchet MS", sans-serif'; g.fillText('z', 150, 96)
    g.font = '700 26px "Trebuchet MS", sans-serif'; g.fillText('z', 182, 72); g.font = '700 19px "Trebuchet MS", sans-serif'; g.fillText('z', 206, 54)
  },

  catFace(g) {
    path(g, [[44, 118], [50, 40], [110, 78]]); fillStroke(g, '#f2a65a')
    path(g, [[146, 78], [206, 40], [212, 118]]); fillStroke(g, '#3d3a46')
    path(g, [[58, 98], [60, 62], [90, 82]]); g.fillStyle = '#f9b7c6'; g.fill()
    path(g, [[166, 82], [196, 62], [198, 98]]); g.fillStyle = '#f9b7c6'; g.fill()
    ell(g, 128, 142, 94, 78); fillStroke(g, '#fffaf4')
    // calico patches
    g.save(); ell(g, 128, 142, 91, 75); g.clip()
    ell(g, 70, 100, 46, 40); g.fillStyle = '#f2a65a'; g.fill()
    ell(g, 196, 108, 40, 40); g.fillStyle = '#3d3a46'; g.fill()
    g.restore()
    ell(g, 128, 142, 94, 78); g.lineWidth = 6; g.strokeStyle = INK; g.stroke()
    // eyes
    for (const x of [92, 164]) {
      ell(g, x, 144, 11, 14); g.fillStyle = '#26232c'; g.fill()
      ell(g, x + 3.5, 138, 4, 4.5); g.fillStyle = '#fff'; g.fill()
    }
    ell(g, 66, 168, 13, 8); g.fillStyle = 'rgba(249,150,172,0.75)'; g.fill()
    ell(g, 190, 168, 13, 8); g.fillStyle = 'rgba(249,150,172,0.75)'; g.fill()
    path(g, [[119, 164], [137, 164], [128, 175]]); fillStroke(g, '#f08fa6', 4)
    g.strokeStyle = INK; g.lineWidth = 4.5; g.lineCap = 'round'
    g.beginPath(); g.moveTo(128, 175); g.quadraticCurveTo(122, 190, 110, 186); g.moveTo(128, 175); g.quadraticCurveTo(134, 190, 146, 186); g.stroke()
    g.lineWidth = 3; g.strokeStyle = 'rgba(74,68,87,0.75)'
    for (const s of [-1, 1]) for (const dy of [-6, 8]) { g.beginPath(); g.moveTo(128 + s * 66, 176 + dy * 0.5); g.lineTo(128 + s * 112, 168 + dy * 1.6); g.stroke() }
  },

  camera(g) {
    // strap lugs
    ell(g, 40, 98, 9, 9); fillStroke(g, '#c9ced6', 4); ell(g, 216, 98, 9, 9); fillStroke(g, '#c9ced6', 4)
    // top housing + viewfinder + shutter
    rr(g, 82, 52, 62, 36, 8); fillStroke(g, '#c9ced6')
    rr(g, 148, 60, 34, 28, 6); fillStroke(g, '#c9ced6', 5)
    rr(g, 52, 60, 30, 24, 6); fillStroke(g, '#e9546b', 5)
    // body
    rr(g, 30, 82, 196, 124, 22); fillStroke(g, '#fff3dc')
    rr(g, 30, 82, 196, 46, 22); g.fillStyle = '#2f3a4b'; g.fill(); g.lineWidth = 6; g.strokeStyle = INK; g.stroke()
    g.save(); rr(g, 32, 126, 192, 78, 20); g.clip(); g.fillStyle = '#fff3dc'; g.fillRect(30, 126, 196, 80); g.restore()
    rr(g, 30, 82, 196, 124, 22); g.lineWidth = 6; g.strokeStyle = INK; g.stroke()
    // flash window + dots
    rr(g, 148, 94, 52, 24, 6); fillStroke(g, '#fff7c7', 4)
    // lens
    ell(g, 118, 152, 50, 50); fillStroke(g, '#c9ced6')
    ell(g, 118, 152, 38, 38); fillStroke(g, '#2a3446', 5)
    ell(g, 118, 152, 24, 24); g.fillStyle = '#2f7bff'; g.fill()
    ell(g, 108, 142, 8, 6, -0.6); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fill()
    ell(g, 128, 164, 4, 3); g.fillStyle = 'rgba(255,255,255,0.45)'; g.fill()
    // grip stitch
    g.strokeStyle = 'rgba(74,68,87,0.5)'; g.lineWidth = 3; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(52, 186); g.lineTo(204, 186); g.stroke(); g.setLineDash([])
  },

  controller(g) {
    g.beginPath()
    g.moveTo(72, 74); g.bezierCurveTo(100, 66, 156, 66, 184, 74)
    g.bezierCurveTo(216, 80, 236, 120, 236, 170)
    g.bezierCurveTo(236, 206, 208, 214, 192, 192)
    g.bezierCurveTo(180, 176, 168, 160, 150, 160)
    g.lineTo(106, 160)
    g.bezierCurveTo(88, 160, 76, 176, 64, 192)
    g.bezierCurveTo(48, 214, 20, 206, 20, 170)
    g.bezierCurveTo(20, 120, 40, 80, 72, 74)
    g.closePath(); fillStroke(g, '#7b61ff')
    // sheen
    g.save(); g.clip(); g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(0, 60, 256, 40); g.restore()
    // d-pad
    g.fillStyle = '#ffffff'; rr(g, 52, 112, 52, 16, 4); g.fill(); rr(g, 70, 94, 16, 52, 4); g.fill()
    // buttons
    const b: [number, number, string][] = [[176, 100, '#ff5d8f'], [198, 122, '#ffd23f'], [176, 144, '#35d0ff'], [154, 122, '#4cd964']]
    for (const [x, y, c] of b) { ell(g, x, y, 11, 11); fillStroke(g, c, 4) }
    // sticks
    ell(g, 112, 150, 12, 12); fillStroke(g, '#2f2b3a', 4); ell(g, 144, 150, 12, 12); fillStroke(g, '#2f2b3a', 4)
  },

  handheld(g) {
    rr(g, 58, 18, 140, 220, [14, 14, 40, 14]); fillStroke(g, '#ffd23f')
    rr(g, 70, 32, 116, 88, [8, 8, 22, 8]); fillStroke(g, '#4a4a58', 5)
    rr(g, 86, 46, 84, 60, 4); g.fillStyle = '#a9c98a'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#3d4b3b'; g.stroke()
    // tiny smiling sprite on the screen
    g.fillStyle = '#35502f'; g.fillRect(112, 62, 32, 6); g.fillRect(104, 68, 8, 20); g.fillRect(144, 68, 8, 20); g.fillRect(112, 88, 32, 6)
    g.fillRect(118, 72, 6, 6); g.fillRect(134, 72, 6, 6); g.fillRect(116, 82, 4, 4); g.fillRect(138, 82, 4, 4); g.fillRect(120, 84, 16, 4)
    // d-pad
    g.fillStyle = '#2f2b3a'; rr(g, 78, 154, 40, 12, 3); g.fill(); rr(g, 92, 140, 12, 40, 3); g.fill()
    // A/B
    ell(g, 142, 172, 11, 11); fillStroke(g, '#ff4f87', 4); ell(g, 166, 158, 11, 11); fillStroke(g, '#2ec4b6', 4)
    // start/select + speaker
    g.strokeStyle = '#8a8578'; g.lineWidth = 7; g.lineCap = 'round'
    g.beginPath(); g.moveTo(90, 206); g.lineTo(106, 200); g.moveTo(112, 208); g.lineTo(128, 202); g.stroke()
    g.strokeStyle = 'rgba(74,68,87,0.55)'; g.lineWidth = 3
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(150 + i * 8, 222); g.lineTo(168 + i * 8, 198); g.stroke() }
  },

  moonStars(g) {
    g.beginPath(); g.arc(112, 128, 80, 0.62 * Math.PI, 1.62 * Math.PI * 1 - 0.0, false)
    g.arc(146, 112, 70, 1.5 * Math.PI - 0.02, 0.76 * Math.PI, true)
    g.closePath(); fillStroke(g, '#ffd86b', 6)
    ell(g, 70, 118, 7, 7); g.fillStyle = 'rgba(214,160,40,0.45)'; g.fill()
    ell(g, 82, 168, 5, 5); g.fillStyle = 'rgba(214,160,40,0.45)'; g.fill()
    star5(g, 192, 80, 28, 12); fillStroke(g, '#ffe9a3', 5)
    star5(g, 214, 158, 17, 7.5); fillStroke(g, '#fff3c7', 4)
    star5(g, 168, 190, 12, 5.2); fillStroke(g, '#ffe9a3', 3.5)
  },

  star(g) {
    star5(g, 128, 132, 100, 44); fillStroke(g, '#ffd86b', 7)
    ell(g, 108, 124, 7, 9); g.fillStyle = '#26232c'; g.fill(); ell(g, 148, 124, 7, 9); g.fill()
    g.beginPath(); g.arc(128, 142, 11, 0.15 * Math.PI, 0.85 * Math.PI); g.lineWidth = 4; g.strokeStyle = '#26232c'; g.stroke()
    ell(g, 94, 144, 8, 5); g.fillStyle = 'rgba(255,140,120,0.6)'; g.fill(); ell(g, 162, 144, 8, 5); g.fill()
  },

  plant(g) {
    // leaves
    const leaf = (x: number, y: number, rot: number, s: number, c: string) => {
      g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s)
      g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-34, -26, -30, -78, 0, -96); g.bezierCurveTo(30, -78, 34, -26, 0, 0); g.closePath()
      fillStroke(g, c, 6 / s)
      g.strokeStyle = 'rgba(40,90,60,0.55)'; g.lineWidth = 3 / s; g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -80); g.stroke()
      g.restore()
    }
    leaf(128, 134, -0.75, 0.85, '#4cc97e'); leaf(128, 134, 0.75, 0.85, '#4cc97e'); leaf(128, 134, 0, 1.05, '#2fae63')
    // pot
    g.beginPath(); g.moveTo(62, 134); g.lineTo(194, 134); g.lineTo(178, 226); g.quadraticCurveTo(176, 236, 164, 236); g.lineTo(92, 236); g.quadraticCurveTo(80, 236, 78, 226); g.closePath()
    fillStroke(g, '#ff7a59')
    rr(g, 54, 124, 148, 26, 10); fillStroke(g, '#ff946f')
    // face
    ell(g, 108, 186, 6, 8); g.fillStyle = '#26232c'; g.fill(); ell(g, 148, 186, 6, 8); g.fill()
    g.beginPath(); g.arc(128, 194, 9, 0.15 * Math.PI, 0.85 * Math.PI); g.lineWidth = 4; g.strokeStyle = '#26232c'; g.stroke()
    ell(g, 94, 198, 8, 5); g.fillStyle = 'rgba(255,255,255,0.45)'; g.fill(); ell(g, 162, 198, 8, 5); g.fill()
  },

  paw(g) {
    const c = '#ff6fa8'
    for (const [x, y, rx, ry, rot] of [[66, 112, 22, 30, -0.35], [106, 70, 22, 32, -0.1], [152, 70, 22, 32, 0.1], [192, 112, 22, 30, 0.35]] as const) {
      ell(g, x, y, rx, ry, rot); fillStroke(g, c)
    }
    g.beginPath()
    g.moveTo(128, 120); g.bezierCurveTo(168, 120, 200, 170, 190, 202); g.bezierCurveTo(182, 226, 158, 206, 128, 206)
    g.bezierCurveTo(98, 206, 74, 226, 66, 202); g.bezierCurveTo(56, 170, 88, 120, 128, 120); g.closePath()
    fillStroke(g, c)
    g.fillStyle = 'rgba(255,255,255,0.4)'; ell(g, 112, 150, 14, 8, -0.5); g.fill()
  },

  pixelGhost(g) {
    // 12 x 12 pixel-art character (a friendly ghost with a tiny bow); each "pixel" is 18 px.
    const map = [
      '....oooo....',
      '..ooWWWWoo..',
      '.oWWWWWWWWo.',
      '.oWWWWWWWWo.',
      'oWWbbWWbbWWo',
      'oWWbwWWbwWWo',
      'oWpWWWWWWpWo',
      'oWWWWmmWWWWo',
      'oWWWWWWWWWWo',
      'oWWWWWWWWWWo',
      'oWWoWWWWoWWo',
      '.oo.oWWo.oo.',
    ]
    const col: Record<string, string> = { o: '#2c2838', W: '#43dcc0', b: '#2c2838', w: '#ffffff', p: '#ff8fb8', m: '#ff5d8f' }
    const px = 18, ox = (SIZE - 12 * px) / 2, oy = (SIZE - 12 * px) / 2 + 4
    map.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return
      g.fillStyle = col[ch]; g.fillRect(ox + x * px, oy + y * px, px + 0.6, px + 0.6)
    }))
    // soft body shading, pixel-aligned
    g.fillStyle = 'rgba(20,120,140,0.35)'
    for (let y = 8; y < 11; y++) for (let x = 8; x < 11; x++) g.fillRect(ox + x * px, oy + y * px, px, px)
    // bow
    g.fillStyle = '#ffd23f'
    for (const [x, y] of [[8, 1], [9, 1], [8, 0], [10, 0], [9, 2]] as const) { g.fillRect(ox + x * px, oy + y * px - 6, px, px) }
    g.fillStyle = '#4a4457'; g.fillRect(ox + 9 * px, oy + 1 * px - 6, px, px)
  },

  coffee(g) {
    // steam as little hearts
    g.strokeStyle = '#f08fa6'; g.lineWidth = 7; g.lineCap = 'round'
    for (const x of [98, 142]) { g.beginPath(); g.moveTo(x, 92); g.bezierCurveTo(x - 16, 74, x + 16, 56, x, 36); g.stroke() }
    // handle
    g.beginPath(); g.arc(198, 156, 28, -Math.PI / 2, Math.PI / 2); g.lineWidth = 24; g.strokeStyle = INK; g.stroke()
    g.lineWidth = 12; g.strokeStyle = '#ff7a6b'; g.stroke()
    // mug
    g.beginPath(); g.moveTo(52, 100); g.lineTo(190, 100); g.lineTo(182, 190); g.quadraticCurveTo(178, 224, 146, 224); g.lineTo(96, 224); g.quadraticCurveTo(64, 224, 60, 190); g.closePath()
    fillStroke(g, '#ff7a6b')
    ell(g, 121, 102, 70, 15); fillStroke(g, '#7a4a33', 6)
    ell(g, 108, 100, 22, 5); g.fillStyle = 'rgba(255,225,190,0.55)'; g.fill()
    // face
    ell(g, 98, 160, 6, 8); g.fillStyle = '#26232c'; g.fill(); ell(g, 142, 160, 6, 8); g.fill()
    g.beginPath(); g.arc(120, 168, 9, 0.15 * Math.PI, 0.85 * Math.PI); g.lineWidth = 4; g.strokeStyle = '#26232c'; g.stroke()
    ell(g, 84, 172, 8, 5); g.fillStyle = 'rgba(249,150,172,0.8)'; g.fill(); ell(g, 156, 172, 8, 5); g.fill()
    // saucer
    ell(g, 121, 232, 86, 10); fillStroke(g, '#ffffff', 5)
  },
}

const cache = new Map<StickerKind, CanvasTexture>()

/**
 * Draw the artwork, then build the die-cut: the silhouette is dilated by sampling the art around a circle, filled white, and
 * the art is drawn on top. A faint dark halo outside the white border gives the vinyl a crisp, slightly raised edge.
 */
export function stickerTexture(kind: StickerKind) {
  const hit = cache.get(kind)
  if (hit) return hit
  const art = document.createElement('canvas'); art.width = art.height = SIZE
  const ag = art.getContext('2d')!
  const back = BACKDROP[kind]
  if (back) {
    const gr = ag.createLinearGradient(30, 20, 226, 236); gr.addColorStop(0, back.a); gr.addColorStop(1, back.b)
    ag.beginPath(); ag.arc(128, 128, 112, 0, Math.PI * 2); ag.fillStyle = gr; ag.fill()
    ag.lineWidth = 5; ag.strokeStyle = 'rgba(255,255,255,0.55)'; ag.beginPath(); ag.arc(128, 128, 104, 0, Math.PI * 2); ag.stroke()
    if (back.sparkle) {
      ag.fillStyle = 'rgba(255,255,255,0.85)'
      for (const [x, y, r] of [[48, 70, 3.2], [206, 62, 2.6], [40, 168, 2.4], [214, 176, 3.4], [168, 34, 2.2], [84, 220, 2.4]] as const) { ag.beginPath(); ag.arc(x, y, r, 0, Math.PI * 2); ag.fill() }
    }
    ag.save(); ag.translate(128, 128); ag.scale(back.scale, back.scale); ag.translate(-128, -128)
    ART[kind](ag); ag.restore()
  } else {
    ag.save(); ag.translate(128, 128); ag.scale(0.92, 0.92); ag.translate(-128, -128)
    ART[kind](ag); ag.restore()
  }

  const out = document.createElement('canvas'); out.width = out.height = SIZE
  const g = out.getContext('2d')!
  const dilate = (radius: number, color: string, alpha: number) => {
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = SIZE
    const t = tmp.getContext('2d')!
    const n = 28
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      t.drawImage(art, Math.cos(a) * radius, Math.sin(a) * radius)
    }
    t.drawImage(art, 0, 0)
    t.globalCompositeOperation = 'source-in'; t.fillStyle = color; t.fillRect(0, 0, SIZE, SIZE)
    g.globalAlpha = alpha; g.drawImage(tmp, 0, 0); g.globalAlpha = 1
  }
  dilate(9.5, '#8a8494', 0.55)   // edge line
  dilate(7.6, '#fbfaf7', 1)      // white vinyl margin
  g.drawImage(art, 0, 0)

  const t = new CanvasTexture(out)
  t.colorSpace = SRGBColorSpace; t.anisotropy = 8
  t.magFilter = LinearFilter; t.minFilter = LinearMipmapLinearFilter
  cache.set(kind, t)
  return t
}
