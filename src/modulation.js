import { reactive } from 'vue'
import { setParam, trackLabel } from './timeline.js'
import { MAX_LAYERS } from './shaders/moire.js'
import { settings, randomize, randomizeColors } from './settings.js'
import { nextSlide } from './slideshow.js'

// Live-input modulation: audio (microphone), MIDI controllers, and a Leap
// Motion controller each expose normalized 0..1 sources that can be mapped
// onto any numeric setting. Mappings are applied every frame, after the
// keyframe timeline, so live input wins over automation.

export const AUDIO_SOURCES = [
  { value: 'audio.level', label: 'Audio · level' },
  { value: 'audio.bass', label: 'Audio · bass' },
  { value: 'audio.mid', label: 'Audio · mid' },
  { value: 'audio.treble', label: 'Audio · treble' },
  { value: 'audio.beat', label: 'Audio · beat pulse' },
]

export const BEAT_ACTIONS = [
  { value: 'none', label: 'Nothing' },
  { value: 'randomize', label: 'Randomize pattern' },
  { value: 'colors', label: 'Random colors' },
  { value: 'slide', label: 'Next display slide' },
]

export const LEAP_SOURCES = [
  { value: 'leap.palmX', label: 'Leap · palm X' },
  { value: 'leap.palmY', label: 'Leap · palm Y' },
  { value: 'leap.palmZ', label: 'Leap · palm Z' },
  { value: 'leap.pinch', label: 'Leap · pinch' },
  { value: 'leap.grab', label: 'Leap · grab' },
  { value: 'leap.roll', label: 'Leap · palm roll' },
]

export const ARTNET_SOURCES = Array.from({ length: 16 }, (_, i) => ({
  value: 'artnet.ch' + (i + 1),
  label: 'Art-Net · ch ' + (i + 1),
}))

export const MOD_TARGETS = (() => {
  const t = [
    { path: 'zoom', min: 0.25, max: 4 },
    { path: 'thickness', min: 0.05, max: 0.95 },
    { path: 'animSpeed', min: 0.1, max: 4 },
  ]
  for (let i = 0; i < MAX_LAYERS; i++) {
    t.push({ path: `layers.${i}.freq`, min: 5, max: 1000 })
    t.push({ path: `layers.${i}.rot`, min: -Math.PI, max: Math.PI })
    t.push({ path: `layers.${i}.x`, min: -1, max: 1 })
    t.push({ path: `layers.${i}.y`, min: -1, max: 1 })
    t.push({ path: `layers.${i}.alpha`, min: 0, max: 1 })
  }
  return t.map((x) => ({ ...x, label: trackLabel(x.path) }))
})()

export const modState = reactive({
  audio: { enabled: false, error: '', level: 0, bass: 0, mid: 0, treble: 0, beat: 0, bpm: 0 },
  beat: { action: 'none', every: 1, count: 0, sens: 1 },
  artnet: { enabled: false, connected: false, error: '', values: {} },
  midi: { enabled: false, error: '', inputs: 0, lastCC: null, values: {} },
  leap: {
    enabled: false, error: '', connected: false, hands: 0,
    palmX: 0.5, palmY: 0.5, palmZ: 0.5, pinch: 0, grab: 0, roll: 0.5,
  },
  mappings: [], // { id, source, path, min, max, smooth }
  learnId: null, // mapping id waiting for the next MIDI CC
})

let nextId = 0

export function addMapping(source = 'audio.level') {
  const target = MOD_TARGETS[0]
  modState.mappings.push({
    id: 'm' + ++nextId + Math.random().toString(36).slice(2, 6),
    source,
    path: target.path,
    min: target.min,
    max: target.max,
    smooth: 0.6,
  })
}

export function removeMapping(id) {
  const i = modState.mappings.findIndex((m) => m.id === id)
  if (i >= 0) modState.mappings.splice(i, 1)
  if (modState.learnId === id) modState.learnId = null
}

export function resetMappingRange(m) {
  const r = MOD_TARGETS.find((t) => t.path === m.path)
  if (r) {
    m.min = r.min
    m.max = r.max
  }
}

export function modSnapshot() {
  const list = modState.mappings.map(({ source, path, min, max, smooth }) => ({
    source, path, min, max, smooth,
  }))
  const beat = modState.beat.action !== 'none' || modState.beat.sens !== 1
    ? { action: modState.beat.action, every: modState.beat.every, sens: modState.beat.sens }
    : undefined
  if (!list.length && !beat) return undefined
  return { list, beat }
}

export function modApply(mods) {
  // v2 snapshots stored a bare array of mappings; newer ones wrap it.
  const list = Array.isArray(mods) ? mods : mods?.list || []
  modState.mappings = list.map((m) => ({
    id: 'm' + ++nextId + Math.random().toString(36).slice(2, 6),
    source: m.source,
    path: m.path,
    min: +m.min,
    max: +m.max,
    smooth: +m.smooth || 0,
  }))
  const beat = !Array.isArray(mods) && mods?.beat
  modState.beat.action = beat ? beat.action : 'none'
  modState.beat.every = beat ? Math.max(1, +beat.every || 1) : 1
  modState.beat.sens = beat ? Math.min(2, Math.max(0.5, +beat.sens || 1)) : 1
  modState.beat.count = 0
}

// --- Audio (Web Audio API, microphone) ---------------------------------

let audioCtx = null
let analyser = null
let mediaStream = null
let freqData = null
let analysisTimer = null

export async function startAudio() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioCtx = new AudioContext()
    const src = audioCtx.createMediaStreamSource(mediaStream)
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 1024
    // Low smoothing: spectral flux needs sharp frame-to-frame differences.
    analyser.smoothingTimeConstant = 0.2
    src.connect(analyser)
    freqData = new Uint8Array(analyser.frequencyBinCount)
    analysisTimer = setInterval(updateAudio, 20)
    modState.audio.error = ''
    modState.audio.enabled = true
  } catch (e) {
    modState.audio.error = 'Microphone unavailable: ' + (e.message || e.name)
    modState.audio.enabled = false
  }
}

export function stopAudio() {
  clearInterval(analysisTimer)
  analysisTimer = null
  mediaStream?.getTracks().forEach((t) => t.stop())
  audioCtx?.close()
  audioCtx = analyser = mediaStream = freqData = null
  prevSpec = null
  fluxHistory = []
  beatIntervals = []
  lastBeatAt = 0
  Object.assign(modState.audio, {
    enabled: false, level: 0, bass: 0, mid: 0, treble: 0, beat: 0, bpm: 0,
  })
}

// Beat detection: spectral flux (positive spectral difference between
// analysis frames, low bands weighted) with an adaptive mean+deviation
// threshold and a refractory period. Analysis runs on its own 20 ms timer
// so a slow render frame rate cannot starve the detector.
let prevSpec = null
let fluxHistory = []
let lastBeatAt = 0
let beatIntervals = []

function fireBeatAction() {
  modState.beat.count++
  if (modState.beat.action === 'none') return
  if (modState.beat.count % Math.max(1, modState.beat.every) !== 0) return
  if (modState.beat.action === 'randomize') randomize()
  else if (modState.beat.action === 'colors') randomizeColors()
  else if (modState.beat.action === 'slide') nextSlide()
}

function detectBeat(binHz) {
  // Positive flux over bins up to ~4 kHz, with the low bins double-weighted
  // (kicks and snares live there).
  const bins = Math.min(freqData.length, Math.ceil(4000 / binHz))
  const bassBins = Math.ceil(250 / binHz)
  if (!prevSpec || prevSpec.length !== bins) {
    prevSpec = new Uint8Array(freqData.subarray(0, bins))
    return
  }
  let flux = 0
  for (let i = 0; i < bins; i++) {
    const d = freqData[i] - prevSpec[i]
    if (d > 0) flux += i < bassBins ? d * 2 : d
    prevSpec[i] = freqData[i]
  }
  flux /= bins * 255

  fluxHistory.push(flux)
  if (fluxHistory.length > 64) fluxHistory.shift() // ~1.3 s at 50 Hz
  modState.audio.beat = Math.max(0, modState.audio.beat - 0.08)
  if (fluxHistory.length < 25) return

  const mean = fluxHistory.reduce((a, b) => a + b, 0) / fluxHistory.length
  const dev = Math.sqrt(
    fluxHistory.reduce((a, b) => a + (b - mean) * (b - mean), 0) / fluxHistory.length,
  )
  // Higher sensitivity lowers the deviation multiplier (0.5 → strict 2.7σ,
  // 2 → loose 0.3σ); a small absolute floor rejects silence.
  const threshold = mean + dev * (3.2 - modState.beat.sens * 1.45) + 0.003
  const now = performance.now()
  if (flux > threshold && now - lastBeatAt > 180) {
    if (lastBeatAt) {
      beatIntervals.push(now - lastBeatAt)
      if (beatIntervals.length > 8) beatIntervals.shift()
      const sorted = [...beatIntervals].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)]
      const bpm = Math.round(60000 / median)
      modState.audio.bpm = bpm >= 40 && bpm <= 220 ? bpm : 0
    }
    lastBeatAt = now
    modState.audio.beat = 1
    fireBeatAction()
  }
}

function updateAudio() {
  if (!analyser) return
  analyser.getByteFrequencyData(freqData)
  const binHz = audioCtx.sampleRate / 2 / freqData.length
  const band = (lo, hi) => {
    let sum = 0
    let n = 0
    const end = Math.min(freqData.length - 1, Math.ceil(hi / binHz))
    for (let i = Math.floor(lo / binHz); i <= end; i++) {
      sum += freqData[i]
      n++
    }
    return n ? sum / n / 255 : 0
  }
  modState.audio.bass = band(20, 250)
  modState.audio.mid = band(250, 2000)
  modState.audio.treble = band(2000, 8000)
  modState.audio.level = band(20, 8000)
  detectBeat(binHz)
}

// --- MIDI (Web MIDI API) ------------------------------------------------

let midiAccess = null

function onMIDIMessage(e) {
  const [status, d1, d2] = e.data
  if ((status & 0xf0) !== 0xb0) return // control change only
  modState.midi.values[d1] = d2 / 127
  modState.midi.lastCC = d1
  if (modState.learnId) {
    const m = modState.mappings.find((x) => x.id === modState.learnId)
    if (m) m.source = 'midi.cc' + d1
    modState.learnId = null
  }
}

export async function startMIDI() {
  try {
    midiAccess = await navigator.requestMIDIAccess()
    const attach = () => {
      let n = 0
      midiAccess.inputs.forEach((input) => {
        n++
        input.onmidimessage = onMIDIMessage
      })
      modState.midi.inputs = n
    }
    attach()
    midiAccess.onstatechange = attach
    modState.midi.error = ''
    modState.midi.enabled = true
  } catch (e) {
    modState.midi.error = 'MIDI unavailable: ' + (e.message || e.name)
    modState.midi.enabled = false
  }
}

export function stopMIDI() {
  if (midiAccess) {
    midiAccess.inputs.forEach((input) => (input.onmidimessage = null))
    midiAccess.onstatechange = null
  }
  midiAccess = null
  modState.midi.enabled = false
  modState.learnId = null
}

// --- Leap Motion (Ultraleap tracking service WebSocket) -----------------

let leapWs = null

const clamp01 = (v) => Math.min(1, Math.max(0, v))

export function startLeap() {
  modState.leap.enabled = true
  modState.leap.error = ''
  try {
    leapWs = new WebSocket('ws://127.0.0.1:6437/v6.json')
  } catch (e) {
    modState.leap.error = 'Could not open Leap WebSocket: ' + (e.message || e.name)
    modState.leap.enabled = false
    return
  }
  leapWs.onopen = () => {
    modState.leap.connected = true
    modState.leap.error = ''
    leapWs.send(JSON.stringify({ focused: true }))
    leapWs.send(JSON.stringify({ background: true }))
  }
  leapWs.onerror = () => {
    modState.leap.error =
      'Leap service not reachable — is the Ultraleap/Leap Motion tracking service running?'
  }
  leapWs.onclose = () => {
    modState.leap.connected = false
    modState.leap.hands = 0
  }
  leapWs.onmessage = (ev) => {
    let msg
    try {
      msg = JSON.parse(ev.data)
    } catch {
      return
    }
    if (!Array.isArray(msg.hands)) return
    modState.leap.hands = msg.hands.length
    const h = msg.hands[0]
    if (!h) return // no hand in view: hold the last values
    const [x, y, z] = h.palmPosition
    // Typical interaction box: x/z roughly ±200 mm, y 100..400 mm.
    modState.leap.palmX = clamp01((x + 200) / 400)
    modState.leap.palmY = clamp01((y - 100) / 300)
    modState.leap.palmZ = clamp01((z + 150) / 300)
    modState.leap.pinch = clamp01(h.pinchStrength ?? 0)
    modState.leap.grab = clamp01(h.grabStrength ?? 0)
    const n = h.palmNormal || [0, -1, 0]
    modState.leap.roll = clamp01((Math.atan2(n[0], -n[1]) / Math.PI + 1) / 2)
  }
}

export function stopLeap() {
  modState.leap.enabled = false
  leapWs?.close()
  leapWs = null
  modState.leap.connected = false
  modState.leap.hands = 0
}

// --- Art-Net (DMX over the bundled WebSocket bridge) ---------------------
//
// Browsers cannot receive UDP, so Art-Net comes in through a tiny local
// bridge: `node tools/artnet-bridge.mjs` listens on UDP 6454 and relays
// ArtDMX frames to ws://localhost:6455.

let artWs = null

export function startArtnet() {
  modState.artnet.enabled = true
  modState.artnet.error = ''
  try {
    artWs = new WebSocket('ws://127.0.0.1:6455')
  } catch (e) {
    modState.artnet.error = 'Could not open bridge socket: ' + (e.message || e.name)
    modState.artnet.enabled = false
    return
  }
  artWs.onopen = () => {
    modState.artnet.connected = true
    modState.artnet.error = ''
  }
  artWs.onerror = () => {
    modState.artnet.error =
      'Art-Net bridge not reachable — run `node tools/artnet-bridge.mjs` on this machine'
  }
  artWs.onclose = () => {
    modState.artnet.connected = false
  }
  artWs.onmessage = (ev) => {
    let msg
    try {
      msg = JSON.parse(ev.data)
    } catch {
      return
    }
    if (!Array.isArray(msg.d)) return
    const n = Math.min(msg.d.length, 32)
    for (let i = 0; i < n; i++) modState.artnet.values[i + 1] = msg.d[i] / 255
  }
}

export function stopArtnet() {
  modState.artnet.enabled = false
  artWs?.close()
  artWs = null
  modState.artnet.connected = false
}

// --- Per-frame application ----------------------------------------------

const smoothed = new Map()

function sourceValue(m) {
  const s = m.source
  if (s.startsWith('audio.')) {
    return modState.audio.enabled ? modState.audio[s.slice(6)] : null
  }
  if (s.startsWith('leap.')) {
    return modState.leap.connected ? modState.leap[s.slice(5)] : null
  }
  if (s.startsWith('midi.cc')) {
    if (!modState.midi.enabled) return null
    const v = modState.midi.values[+s.slice(7)]
    return v === undefined ? null : v
  }
  if (s.startsWith('artnet.ch')) {
    if (!modState.artnet.connected) return null
    const v = modState.artnet.values[+s.slice(9)]
    return v === undefined ? null : v
  }
  return null
}

let lastApplyAt = 0

export function applyModulation() {
  const now = performance.now()
  const dt = lastApplyAt ? Math.min((now - lastApplyAt) / 1000, 0.1) : 1 / 60
  lastApplyAt = now
  for (const m of modState.mappings) {
    const v = sourceValue(m)
    if (v == null) continue
    // Frame-rate-independent exponential smoothing: `smooth` is the per-60Hz
    // retention factor, so 0.99+ gives multi-second glides at any FPS.
    const k = Math.pow(Math.min(m.smooth ?? 0, 0.998), dt * 60)
    const prev = smoothed.get(m.id) ?? v
    const sm = v + (prev - v) * k
    smoothed.set(m.id, sm)
    setParam(m.path, m.min + (m.max - m.min) * sm)
  }
}

// Quick-start: add sensible default mappings for every enabled input,
// skipping any target that is already mapped.
export function autoMap() {
  const add = (source, path, min, max, smooth = 0.6) => {
    if (modState.mappings.some((m) => m.path === path)) return
    const target = MOD_TARGETS.find((t) => t.path === path)
    if (!target) return
    modState.mappings.push({
      id: 'm' + ++nextId + Math.random().toString(36).slice(2, 6),
      source, path, min, max, smooth,
    })
  }
  if (modState.audio.enabled) {
    add('audio.bass', 'layers.0.freq', 100, 260, 0.75)
    add('audio.level', 'zoom', 0.85, 1.5, 0.85)
    add('audio.treble', 'thickness', 0.4, 0.62, 0.8)
    add('audio.beat', 'layers.1.rot', 0, 0.25, 0.45)
  }
  if (modState.leap.enabled) {
    add('leap.palmX', 'layers.0.x', -0.5, 0.5, 0.4)
    add('leap.palmY', 'zoom', 0.6, 1.8, 0.5)
    add('leap.pinch', 'thickness', 0.2, 0.8, 0.4)
    add('leap.roll', 'layers.0.rot', -1.2, 1.2, 0.4)
  }
  if (modState.midi.enabled) {
    const ccs = Object.keys(modState.midi.values).map(Number).sort((a, b) => a - b).slice(0, 4)
    const targets = [
      ['zoom', 0.25, 4],
      ['thickness', 0.05, 0.95],
      ['layers.0.freq', 5, 600],
      ['layers.0.rot', -Math.PI, Math.PI],
    ]
    ccs.forEach((cc, i) => add('midi.cc' + cc, targets[i][0], targets[i][1], targets[i][2], 0.2))
  }
  if (modState.artnet.enabled) {
    add('artnet.ch1', 'zoom', 0.25, 4, 0.2)
    add('artnet.ch2', 'thickness', 0.05, 0.95, 0.2)
    add('artnet.ch3', 'layers.0.freq', 5, 600, 0.2)
  }
}
