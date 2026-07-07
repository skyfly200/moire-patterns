import { reactive } from 'vue'

export const MAX_LAYERS = 4

export const PATTERN_TYPES = [
  { value: 0, label: 'Rings' },
  { value: 1, label: 'Lines' },
  { value: 2, label: 'Grid' },
  { value: 3, label: 'Spokes' },
]

export const BLEND_MODES = [
  { value: 0, label: 'Multiply' },
  { value: 1, label: 'Difference' },
  { value: 2, label: 'Average' },
  { value: 3, label: 'Min' },
  { value: 4, label: 'Max' },
  { value: 5, label: 'Screen' },
  { value: 6, label: 'Add' },
  { value: 7, label: 'Subtract' },
]

export const COLOR_MODES = [
  { value: 0, label: 'Duotone' },
  { value: 1, label: 'Gradient' },
  { value: 2, label: 'Rainbow' },
  { value: 3, label: 'Per-layer' },
]

export const AA_MODES = [
  { value: 0, label: 'Off — aliased' },
  { value: 1, label: 'Smooth (fwidth)' },
  { value: 2, label: 'Supersample 4×' },
  { value: 3, label: 'Supersample 16×' },
]

const LAYER_COLORS = ['#ff5c7a', '#5cc8ff', '#ffd166', '#9b5cff']

function makeLayer(freq = 140, rot = 0, x = 0, y = 0) {
  return { freq, rot, x, y }
}

export function defaultSettings() {
  return {
    patternType: 0,
    blendMode: 0,
    aaMode: 0,
    layerCount: 2,
    zoom: 1,
    thickness: 0.5,
    animate: false,
    animSpeed: 1,
    colorMode: 0,
    colorA: '#0b0b0f',
    colorB: '#f5f5f0',
    colorC: '#ff4d6d',
    activeLayer: 0,
    layers: [
      makeLayer(140, 0, -0.06, 0),
      makeLayer(143, 0, 0.06, 0),
      makeLayer(150, 0.5, 0, 0.1),
      makeLayer(160, -0.5, 0, -0.1),
    ].map((l, i) => ({ ...l, color: LAYER_COLORS[i] })),
  }
}

export const settings = reactive(defaultSettings())

export const PRESETS = [
  {
    name: 'Classic rings',
    apply: {
      patternType: 0, blendMode: 0, aaMode: 0, layerCount: 2,
      zoom: 1, thickness: 0.5,
      layers: [makeLayer(140, 0, -0.06, 0), makeLayer(143, 0, 0.06, 0)],
    },
  },
  {
    name: 'Rotated lines',
    apply: {
      patternType: 1, blendMode: 1, aaMode: 0, layerCount: 2,
      zoom: 1, thickness: 0.5,
      layers: [makeLayer(180, 0, 0, 0), makeLayer(180, 0.07, 0, 0)],
    },
  },
  {
    name: 'Grid interference',
    apply: {
      patternType: 2, blendMode: 0, aaMode: 0, layerCount: 2,
      zoom: 1, thickness: 0.55,
      layers: [makeLayer(120, 0, 0, 0), makeLayer(121, 0.035, 0, 0)],
    },
  },
  {
    name: 'Radial spokes',
    apply: {
      patternType: 3, blendMode: 1, aaMode: 0, layerCount: 2,
      zoom: 1, thickness: 0.5,
      layers: [makeLayer(240, 0, -0.03, 0), makeLayer(240, 0.02, 0.03, 0)],
    },
  },
  {
    name: 'Aliasing demo',
    apply: {
      patternType: 0, blendMode: 0, aaMode: 0, layerCount: 1,
      zoom: 1, thickness: 0.5,
      layers: [makeLayer(800, 0, 0, 0)],
    },
  },
]

export function applyPreset(preset) {
  const a = preset.apply
  settings.patternType = a.patternType
  settings.blendMode = a.blendMode
  settings.aaMode = a.aaMode
  settings.layerCount = a.layerCount
  settings.zoom = a.zoom
  settings.thickness = a.thickness
  settings.activeLayer = 0
  a.layers.forEach((l, i) => Object.assign(settings.layers[i], l))
}

const SNAP_KEYS = [
  'patternType', 'blendMode', 'aaMode', 'layerCount', 'zoom',
  'thickness', 'animate', 'animSpeed', 'colorMode', 'colorA', 'colorB', 'colorC',
]

export function snapshot() {
  const s = { v: 1 }
  for (const k of SNAP_KEYS) s[k] = settings[k]
  s.layers = settings.layers.map((l) => ({
    freq: +l.freq.toFixed(2),
    rot: +l.rot.toFixed(4),
    x: +l.x.toFixed(4),
    y: +l.y.toFixed(4),
    color: l.color,
  }))
  return s
}

export function applySnapshot(s) {
  for (const k of SNAP_KEYS) if (s[k] !== undefined) settings[k] = s[k]
  if (Array.isArray(s.layers)) {
    s.layers.forEach((l, i) => {
      if (settings.layers[i]) Object.assign(settings.layers[i], l)
    })
  }
  settings.activeLayer = 0
}

export function encodeSnapshot(s = snapshot()) {
  const bytes = new TextEncoder().encode(JSON.stringify(s))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function decodeSnapshot(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

export function shareURL(snap) {
  return `${location.origin}${location.pathname}#s=${encodeSnapshot(snap)}`
}

export function loadFromHash() {
  const m = location.hash.match(/[#&]s=([A-Za-z0-9_-]+)/)
  if (!m) return false
  try {
    applySnapshot(decodeSnapshot(m[1]))
    return true
  } catch {
    return false
  }
}

export function randomize() {
  const rnd = (min, max) => min + Math.random() * (max - min)
  settings.patternType = Math.floor(rnd(0, 4))
  settings.blendMode = Math.floor(rnd(0, 4))
  settings.layerCount = 2 + Math.floor(rnd(0, 3))
  settings.thickness = rnd(0.35, 0.65)
  const baseFreq = rnd(60, 400)
  settings.layers.forEach((l, i) => {
    l.freq = baseFreq * rnd(0.97, 1.03)
    l.rot = rnd(-0.15, 0.15) * i
    l.x = rnd(-0.15, 0.15)
    l.y = rnd(-0.15, 0.15)
  })
}
