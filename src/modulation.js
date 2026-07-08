import { reactive } from 'vue'
import { setParam, trackLabel } from './timeline.js'
import { MAX_LAYERS } from './shaders/moire.js'

// Live-input modulation: audio (microphone), MIDI controllers, and a Leap
// Motion controller each expose normalized 0..1 sources that can be mapped
// onto any numeric setting. Mappings are applied every frame, after the
// keyframe timeline, so live input wins over automation.

export const AUDIO_SOURCES = [
  { value: 'audio.level', label: 'Audio · level' },
  { value: 'audio.bass', label: 'Audio · bass' },
  { value: 'audio.mid', label: 'Audio · mid' },
  { value: 'audio.treble', label: 'Audio · treble' },
]

export const LEAP_SOURCES = [
  { value: 'leap.palmX', label: 'Leap · palm X' },
  { value: 'leap.palmY', label: 'Leap · palm Y' },
  { value: 'leap.palmZ', label: 'Leap · palm Z' },
  { value: 'leap.pinch', label: 'Leap · pinch' },
  { value: 'leap.grab', label: 'Leap · grab' },
  { value: 'leap.roll', label: 'Leap · palm roll' },
]

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
  }
  return t.map((x) => ({ ...x, label: trackLabel(x.path) }))
})()

export const modState = reactive({
  audio: { enabled: false, error: '', level: 0, bass: 0, mid: 0, treble: 0 },
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
  if (!modState.mappings.length) return undefined
  return modState.mappings.map(({ source, path, min, max, smooth }) => ({
    source, path, min, max, smooth,
  }))
}

export function modApply(mods) {
  modState.mappings = (Array.isArray(mods) ? mods : []).map((m) => ({
    id: 'm' + ++nextId + Math.random().toString(36).slice(2, 6),
    source: m.source,
    path: m.path,
    min: +m.min,
    max: +m.max,
    smooth: +m.smooth || 0,
  }))
}

// --- Audio (Web Audio API, microphone) ---------------------------------

let audioCtx = null
let analyser = null
let mediaStream = null
let freqData = null

export async function startAudio() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioCtx = new AudioContext()
    const src = audioCtx.createMediaStreamSource(mediaStream)
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.5
    src.connect(analyser)
    freqData = new Uint8Array(analyser.frequencyBinCount)
    modState.audio.error = ''
    modState.audio.enabled = true
  } catch (e) {
    modState.audio.error = 'Microphone unavailable: ' + (e.message || e.name)
    modState.audio.enabled = false
  }
}

export function stopAudio() {
  mediaStream?.getTracks().forEach((t) => t.stop())
  audioCtx?.close()
  audioCtx = analyser = mediaStream = freqData = null
  Object.assign(modState.audio, { enabled: false, level: 0, bass: 0, mid: 0, treble: 0 })
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
  return null
}

export function applyModulation() {
  if (modState.audio.enabled) updateAudio()
  for (const m of modState.mappings) {
    const v = sourceValue(m)
    if (v == null) continue
    const alpha = 1 - Math.min(m.smooth ?? 0, 0.98)
    const prev = smoothed.get(m.id) ?? v
    const sm = prev + (v - prev) * alpha
    smoothed.set(m.id, sm)
    setParam(m.path, m.min + (m.max - m.min) * sm)
  }
}
