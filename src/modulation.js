import { reactive } from 'vue'
import { setParam, getParam, trackLabel } from './timeline.js'
import { MAX_LAYERS } from './shaders/moire.js'
import {
  settings,
  randomize,
  randomizeColors,
  undoRandomize,
  redoRandomize,
  applyPreset,
  PRESETS,
  AA_MODES,
  COLOR_MODES,
  LAYER_OPS,
  PATTERN_GROUPS,
} from './settings.js'
import { nextSlide } from './slideshow.js'

// Live-input modulation: audio (microphone), MIDI controllers, a Leap Motion
// controller (both hands), and Art-Net/DMX each expose normalized 0..1
// sources that can be mapped onto any numeric setting — or, modular-synth
// style, onto another mapping's range or smoothing. Mappings are applied
// every frame, after the keyframe timeline, so live input wins over automation.

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

const LEAP_FIELDS = [
  ['palmX', 'palm X'],
  ['palmY', 'palm Y'],
  ['palmZ', 'palm Z'],
  ['pinch', 'pinch'],
  ['grab', 'grab'],
  ['roll', 'palm roll'],
]

// Grouped so the mapping dropdown can show any-hand plus per-hand sources.
export const LEAP_SOURCE_GROUPS = [
  {
    label: 'Leap · any hand',
    items: LEAP_FIELDS.map(([f, l]) => ({ value: 'leap.' + f, label: 'Leap · ' + l })),
  },
  {
    label: 'Leap · left hand',
    items: LEAP_FIELDS.map(([f, l]) => ({ value: 'leap.left.' + f, label: 'Leap L · ' + l })),
  },
  {
    label: 'Leap · right hand',
    items: LEAP_FIELDS.map(([f, l]) => ({ value: 'leap.right.' + f, label: 'Leap R · ' + l })),
  },
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

// --- MIDI control-surface targets ---------------------------------------
//
// MIDI is its own system (separate from the audio/Leap continuous
// modulation): a MIDI CC or note can drive ANY UI control — continuous
// params, discrete option selects, toggles, or one-shot actions.

// Computed lazily (not at module-init) because settings.js and modulation.js
// import each other — touching PATTERN_GROUPS at top level would hit a
// temporal-dead-zone error during the circular import.
let _patternCount = 0
function patternCount() {
  if (!_patternCount) _patternCount = PATTERN_GROUPS.reduce((n, g) => n + g.items.length, 0)
  return _patternCount
}

// Discrete (stepped) targets: contiguous integer value ranges.
function discreteInfo(path) {
  if (path === 'aaMode') return { base: 0, count: AA_MODES.length }
  if (path === 'colorMode') return { base: 0, count: COLOR_MODES.length }
  if (path === 'layerCount') return { base: 1, count: MAX_LAYERS }
  if (/^layers\.\d+\.pattern$/.test(path)) return { base: 0, count: patternCount() }
  if (/^layers\.\d+\.op$/.test(path)) return { base: 0, count: LAYER_OPS.length }
  return { base: 0, count: 2 }
}

export const MIDI_DISCRETE = (() => {
  const t = [
    { value: 'option:aaMode', label: 'Anti-alias' },
    { value: 'option:colorMode', label: 'Color mode' },
    { value: 'option:layerCount', label: 'Layer count' },
  ]
  for (let i = 0; i < MAX_LAYERS; i++) {
    t.push({ value: `option:layers.${i}.pattern`, label: `L${i + 1} type` })
    t.push({ value: `option:layers.${i}.op`, label: `L${i + 1} combine` })
  }
  return t
})()

export const MIDI_TOGGLES = [
  { value: 'toggle:animate', label: 'Animate' },
  { value: 'toggle:drift', label: 'Drift' },
  { value: 'toggle:showFps', label: 'FPS counter' },
]

export const MIDI_ACTIONS = [
  { value: 'action:randomize', label: 'Randomize' },
  { value: 'action:colors', label: 'Random colors' },
  { value: 'action:playpause', label: 'Play / pause' },
  { value: 'action:nextPreset', label: 'Next preset' },
  { value: 'action:prevPreset', label: 'Prev preset' },
  { value: 'action:nextSlide', label: 'Next display slide' },
  { value: 'action:undo', label: 'Undo randomize' },
  { value: 'action:redo', label: 'Redo randomize' },
]

// Continuous params reuse MOD_TARGETS, prefixed 'param:'.
export const MIDI_CONTINUOUS = () => MOD_TARGETS.map((t) => ({ value: 'param:' + t.path, label: t.label }))

function blankHand() {
  return { present: false, palmX: 0.5, palmY: 0.5, palmZ: 0.5, pinch: 0, grab: 0, roll: 0.5 }
}

export const modState = reactive({
  audio: { enabled: false, error: '', level: 0, bass: 0, mid: 0, treble: 0, beat: 0, bpm: 0 },
  beat: { action: 'none', every: 1, count: 0, sens: 1 },
  artnet: { enabled: false, connected: false, error: '', values: {} },
  midi: {
    enabled: false, error: '', inputs: 0, lastCC: null, values: {}, devices: [],
    bindings: [], // { id, key, ttype:'cc'|'note', num, target, min, max }
    learnBindingId: null, // binding waiting to learn its trigger
    profile: '',
  },
  leap: {
    enabled: false, error: '', connected: false, hands: 0,
    // primary (first) hand — kept for the "any hand" source ids
    palmX: 0.5, palmY: 0.5, palmZ: 0.5, pinch: 0, grab: 0, roll: 0.5,
    left: blankHand(),
    right: blankHand(),
  },
  mappings: [], // { id, key, source, path, min, max, smooth }
  learnId: null, // mapping id waiting for the next MIDI CC
})

let nextId = 0
let keySeq = 0

// Stable short id (serialized) so modular routing can reference a mapping
// across reload and reorder.
function genKey() {
  return (keySeq++).toString(36) + Math.random().toString(36).slice(2, 4)
}

// Default per-60Hz retention factor for a fresh mapping — high so input
// glides. Leap gets half: hand tracking is fast and expressive, so heavy
// smoothing feels laggy.
export const DEFAULT_SMOOTH = 0.85
export const LEAP_SMOOTH = 0.42

export function defaultSmoothFor(source) {
  return String(source).startsWith('leap.') ? LEAP_SMOOTH : DEFAULT_SMOOTH
}

// True for a "route to another mapping" target path: mod:<key>:<field>.
export function isModRoute(path) {
  return typeof path === 'string' && path.startsWith('mod:')
}

// A modulation band centered on the target's current value, `frac` of its
// full range wide, shifted to stay inside the target's absolute bounds. For
// routing targets the sensible defaults are the routed field's own range.
export function bandAround(path, frac = 0.4) {
  if (isModRoute(path)) {
    const [, key, field] = path.split(':')
    if (field === 'smooth') return [0, 0.98]
    const tgt = modState.mappings.find((m) => m.key === key)
    const r = tgt && MOD_TARGETS.find((t) => t.path === tgt.path)
    return r ? [r.min, r.max] : [0, 1]
  }
  const t = MOD_TARGETS.find((x) => x.path === path)
  if (!t) return [0, 1]
  const cur = Math.min(t.max, Math.max(t.min, getParam(path)))
  const span = (t.max - t.min) * frac
  let min = cur - span / 2
  let max = cur + span / 2
  if (min < t.min) {
    max = Math.min(t.max, max + (t.min - min))
    min = t.min
  }
  if (max > t.max) {
    min = Math.max(t.min, min - (max - t.max))
    max = t.max
  }
  const round = /\.freq$/.test(path) ? (v) => Math.round(v) : (v) => +v.toFixed(3)
  return [round(min), round(max)]
}

function makeMapping(source, path, min, max, smooth) {
  return {
    id: 'm' + ++nextId + Math.random().toString(36).slice(2, 6),
    key: genKey(),
    source,
    path,
    min,
    max,
    smooth,
  }
}

export function addMapping(source = 'audio.level') {
  const target = MOD_TARGETS[0]
  const [min, max] = bandAround(target.path, 0.4)
  modState.mappings.push(makeMapping(source, target.path, min, max, defaultSmoothFor(source)))
}

export function duplicateMapping(id) {
  const i = modState.mappings.findIndex((m) => m.id === id)
  if (i < 0) return
  const s = modState.mappings[i]
  const copy = makeMapping(s.source, s.path, s.min, s.max, s.smooth)
  modState.mappings.splice(i + 1, 0, copy)
}

export function removeMapping(id) {
  const i = modState.mappings.findIndex((m) => m.id === id)
  if (i < 0) return
  const key = modState.mappings[i].key
  modState.mappings.splice(i, 1)
  // Any mapping that was routing to this one falls back to its own target.
  modState.mappings.forEach((m) => {
    if (isModRoute(m.path) && m.path.split(':')[1] === key) {
      m.path = MOD_TARGETS[0].path
      const [mn, mx] = bandAround(m.path, 0.4)
      m.min = mn
      m.max = mx
    }
  })
  if (modState.learnId === id) modState.learnId = null
}

export function moveMapping(fromIdx, toIdx) {
  const list = modState.mappings
  if (fromIdx < 0 || fromIdx >= list.length || toIdx < 0 || toIdx >= list.length) return
  const [m] = list.splice(fromIdx, 1)
  list.splice(toIdx, 0, m)
}

export function resetMappingRange(m) {
  const [min, max] = bandAround(m.path, 0.4)
  m.min = min
  m.max = max
}

export function modSnapshot() {
  const list = modState.mappings.map(({ key, source, path, min, max, smooth }) => ({
    key, source, path, min, max, smooth,
  }))
  const beat = modState.beat.action !== 'none' || modState.beat.sens !== 1
    ? { action: modState.beat.action, every: modState.beat.every, sens: modState.beat.sens }
    : undefined
  const midi = modState.midi.bindings.length
    ? {
        profile: modState.midi.profile || undefined,
        binds: modState.midi.bindings.map(({ ttype, num, target, min, max }) => ({
          ttype, num, target, min, max,
        })),
      }
    : undefined
  if (!list.length && !beat && !midi) return undefined
  return { list, beat, midi }
}

export function modApply(mods) {
  // v2 snapshots stored a bare array of mappings; newer ones wrap it.
  const list = Array.isArray(mods) ? mods : mods?.list || []
  modState.mappings = list.map((m) => ({
    id: 'm' + ++nextId + Math.random().toString(36).slice(2, 6),
    key: m.key || genKey(),
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

  const midi = !Array.isArray(mods) && mods?.midi
  modState.midi.profile = midi?.profile || ''
  modState.midi.bindings = (midi?.binds || []).map((b) => ({
    id: 'b' + ++nextId + Math.random().toString(36).slice(2, 5),
    key: midiKey(),
    ttype: b.ttype === 'note' ? 'note' : 'cc',
    num: b.num == null ? null : +b.num,
    target: b.target,
    min: +b.min,
    max: +b.max,
    _pressed: false,
    _norm: null,
  }))
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
  // Don't flood the undo history with automated (on-beat) randomizes.
  if (modState.beat.action === 'randomize') randomize(false)
  else if (modState.beat.action === 'colors') randomizeColors(false)
  else if (modState.beat.action === 'slide') nextSlide()
}

function detectBeat(binHz) {
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
  if (fluxHistory.length > 64) fluxHistory.shift()
  modState.audio.beat = Math.max(0, modState.audio.beat - 0.08)
  if (fluxHistory.length < 25) return

  const mean = fluxHistory.reduce((a, b) => a + b, 0) / fluxHistory.length
  const dev = Math.sqrt(
    fluxHistory.reduce((a, b) => a + (b - mean) * (b - mean), 0) / fluxHistory.length,
  )
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
let presetIndex = 0

// --- MIDI control bindings ----------------------------------------------

let midiKeySeq = 0
function midiKey() {
  return 'k' + (midiKeySeq++).toString(36) + Math.random().toString(36).slice(2, 4)
}

function midiTargetRange(target) {
  const [kind, path] = splitTarget(target)
  if (kind === 'param') {
    const t = MOD_TARGETS.find((x) => x.path === path)
    return t ? [t.min, t.max] : [0, 1]
  }
  return [0, 1]
}

function splitTarget(target) {
  const i = target.indexOf(':')
  return [target.slice(0, i), target.slice(i + 1)]
}

export function addMidiBinding(target = 'param:zoom') {
  const [min, max] = midiTargetRange(target)
  modState.midi.bindings.push({
    id: 'b' + ++nextId + Math.random().toString(36).slice(2, 5),
    key: midiKey(),
    ttype: 'cc',
    num: null,
    target,
    min,
    max,
    _pressed: false,
    _norm: null,
  })
}

export function removeMidiBinding(id) {
  const i = modState.midi.bindings.findIndex((b) => b.id === id)
  if (i >= 0) modState.midi.bindings.splice(i, 1)
  if (modState.midi.learnBindingId === id) modState.midi.learnBindingId = null
}

export function resetMidiBindingRange(b) {
  const [min, max] = midiTargetRange(b.target)
  b.min = min
  b.max = max
}

function fireAction(name) {
  if (name === 'randomize') randomize()
  else if (name === 'colors') randomizeColors()
  else if (name === 'playpause') settings.animate = !settings.animate
  else if (name === 'nextPreset') {
    presetIndex = (presetIndex + 1) % PRESETS.length
    applyPreset(PRESETS[presetIndex])
  } else if (name === 'prevPreset') {
    presetIndex = (presetIndex - 1 + PRESETS.length) % PRESETS.length
    applyPreset(PRESETS[presetIndex])
  } else if (name === 'nextSlide') nextSlide()
  else if (name === 'undo') undoRandomize()
  else if (name === 'redo') redoRandomize()
}

// Route a MIDI event to any bindings listening to it. `type` is 'cc' or
// 'note'; `norm` is 0..1 (cc value or note velocity).
function dispatchMidi(type, num, norm) {
  for (const b of modState.midi.bindings) {
    if (b.ttype !== type || b.num !== num) continue
    const [kind, path] = splitTarget(b.target)
    if (kind === 'param') {
      // Continuous — smoothed per frame in applyModulation.
      b._norm = clamp01(norm)
    } else if (kind === 'option') {
      const { base, count } = discreteInfo(path)
      if (type === 'note') {
        const cur = Math.round(getParam(path))
        setParam(path, base + (((cur - base + 1) % count) + count) % count)
      } else {
        setParam(path, base + Math.round((count - 1) * clamp01(norm)))
      }
    } else if (kind === 'toggle') {
      if (type === 'note') setParam(path, !getParam(path))
      else setParam(path, norm >= 0.5)
    } else if (kind === 'action') {
      const pressed = type === 'note' ? true : norm >= 0.5
      if (pressed && !b._pressed) fireAction(path)
      b._pressed = pressed
    }
  }
}

function onMIDIMessage(e) {
  const [status, d1, d2] = e.data
  const cmd = status & 0xf0
  if (cmd === 0xb0) {
    // Control change
    modState.midi.values[d1] = d2 / 127
    modState.midi.lastCC = d1
    if (modState.midi.learnBindingId != null) {
      learnMidiTrigger('cc', d1)
      return
    }
    if (modState.learnId) {
      // Legacy: learning a modulation-mapping source (kept for old setups).
      const m = modState.mappings.find((x) => x.id === modState.learnId)
      if (m) m.source = 'midi.cc' + d1
      modState.learnId = null
      return
    }
    dispatchMidi('cc', d1, d2 / 127)
  } else if (cmd === 0x90 && d2 > 0) {
    // Note on
    if (modState.midi.learnBindingId != null) {
      learnMidiTrigger('note', d1)
      return
    }
    dispatchMidi('note', d1, d2 / 127)
  } else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) {
    // Note off: release any action bindings watching this note.
    for (const b of modState.midi.bindings) {
      if (b.ttype === 'note' && b.num === d1) b._pressed = false
    }
  }
}

function learnMidiTrigger(ttype, num) {
  const b = modState.midi.bindings.find((x) => x.id === modState.midi.learnBindingId)
  if (b) {
    b.ttype = ttype
    b.num = num
  }
  modState.midi.learnBindingId = null
}

// (Re)bind message handlers to every input and refresh the device list. Some
// controllers only appear a moment after the device statechange fires, so we
// always re-enumerate here rather than trusting an earlier count.
function refreshMIDIInputs() {
  if (!midiAccess) return
  const devices = []
  midiAccess.inputs.forEach((input) => {
    input.onmidimessage = onMIDIMessage
    devices.push({ name: input.name || 'MIDI input', state: input.state, connection: input.connection })
  })
  modState.midi.devices = devices
  modState.midi.inputs = devices.length
}

export async function startMIDI() {
  if (!navigator.requestMIDIAccess) {
    modState.midi.error =
      'Web MIDI is not available in this browser. Use Chrome or Edge (Firefox/Safari do not support it).'
    modState.midi.enabled = false
    return
  }
  try {
    midiAccess = await navigator.requestMIDIAccess({ sysex: false })
    refreshMIDIInputs()
    // Re-enumerate on hot-plug and once more shortly after (some drivers
    // populate the input map a beat late).
    midiAccess.onstatechange = refreshMIDIInputs
    setTimeout(refreshMIDIInputs, 400)
    setTimeout(refreshMIDIInputs, 1500)
    modState.midi.error = modState.midi.inputs
      ? ''
      : 'No MIDI inputs detected yet. Connect a controller (it should appear here), or open MIDI setup to rescan.'
    modState.midi.enabled = true
  } catch (e) {
    modState.midi.error =
      'MIDI permission denied or unavailable: ' + (e.message || e.name) +
      '. On a deployed site MIDI needs https; try Chrome/Edge.'
    modState.midi.enabled = false
  }
}

// Manual rescan for the setup popup.
export function rescanMIDI() {
  if (!midiAccess) {
    startMIDI()
    return
  }
  refreshMIDIInputs()
  if (modState.midi.inputs) modState.midi.error = ''
}

export function stopMIDI() {
  if (midiAccess) {
    midiAccess.inputs.forEach((input) => (input.onmidimessage = null))
    midiAccess.onstatechange = null
  }
  midiAccess = null
  modState.midi.enabled = false
  modState.midi.devices = []
  modState.midi.inputs = 0
  modState.learnId = null
  modState.midi.learnBindingId = null
  // Bindings are configuration — keep them so re-enabling MIDI restores them.
}

// --- Leap Motion (Ultraleap tracking service WebSocket) -----------------
//
// Only the older tracking software exposes this WebSocket API (port 6437) —
// Leap Motion / Orion up to 4.x. Ultraleap Gemini (5.x) removed it, so with
// Gemini installed nothing listens and the connection can never succeed.
// While enabled we retry every few seconds so starting the service connects
// without re-toggling. Both hands are tracked (left/right sources).

let leapWs = null
let leapRetryTimer = null

const clamp01 = (v) => Math.min(1, Math.max(0, v))

const LEAP_HELP =
  'Leap service not reachable on ws://127.0.0.1:6437. Check: (1) the ' +
  'tracking service is running (hands visible in the Visualizer); (2) your ' +
  'software includes the WebSocket API — Leap Motion/Orion 4.x does, but ' +
  'Ultraleap Gemini 5.x removed it, so install Orion 4.1 for browser use; ' +
  '(3) "Allow Web Apps" is enabled in the Leap Motion Control Panel; ' +
  '(4) on an https:// page Firefox blocks localhost sockets — use ' +
  'Chrome/Edge or run the app locally. Retrying…'

function scheduleLeapRetry() {
  clearTimeout(leapRetryTimer)
  if (!modState.leap.enabled) return
  leapRetryTimer = setTimeout(connectLeap, 3000)
}

function readHand(dst, h) {
  const [x, y, z] = h.palmPosition
  // Typical interaction box: x/z roughly ±200 mm, y 100..400 mm.
  dst.palmX = clamp01((x + 200) / 400)
  dst.palmY = clamp01((y - 100) / 300)
  dst.palmZ = clamp01((z + 150) / 300)
  dst.pinch = clamp01(h.pinchStrength ?? 0)
  dst.grab = clamp01(h.grabStrength ?? 0)
  const n = h.palmNormal || [0, -1, 0]
  dst.roll = clamp01((Math.atan2(n[0], -n[1]) / Math.PI + 1) / 2)
  dst.present = true
}

function connectLeap() {
  if (!modState.leap.enabled) return
  try {
    leapWs = new WebSocket('ws://127.0.0.1:6437/v6.json')
  } catch (e) {
    modState.leap.error = 'Could not open Leap WebSocket: ' + (e.message || e.name)
    scheduleLeapRetry()
    return
  }
  leapWs.onopen = () => {
    modState.leap.connected = true
    modState.leap.error = ''
    leapWs.send(JSON.stringify({ focused: true }))
    leapWs.send(JSON.stringify({ background: true }))
  }
  leapWs.onerror = () => {
    modState.leap.error = LEAP_HELP
  }
  leapWs.onclose = () => {
    const wasConnected = modState.leap.connected
    modState.leap.connected = false
    modState.leap.hands = 0
    if (wasConnected && modState.leap.enabled) {
      modState.leap.error = 'Leap connection lost — retrying…'
    }
    scheduleLeapRetry()
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

    // Primary ("any hand") = first hand in view.
    const first = msg.hands[0]
    if (first) readHand(modState.leap, first)

    // Per-hand left/right. Mark absent hands so the UI can show it, but keep
    // their last values so a routed mapping holds instead of snapping.
    const left = msg.hands.find((h) => h.type === 'left')
    const right = msg.hands.find((h) => h.type === 'right')
    if (left) readHand(modState.leap.left, left)
    else modState.leap.left.present = false
    if (right) readHand(modState.leap.right, right)
    else modState.leap.right.present = false
  }
}

export function startLeap() {
  modState.leap.enabled = true
  modState.leap.error = ''
  connectLeap()
}

export function stopLeap() {
  modState.leap.enabled = false
  clearTimeout(leapRetryTimer)
  leapRetryTimer = null
  leapWs?.close()
  leapWs = null
  modState.leap.connected = false
  modState.leap.hands = 0
}

// --- Art-Net (DMX over the bundled WebSocket bridge) ---------------------

let artWs = null
let artRetryTimer = null

const ARTNET_HELP =
  'Art-Net bridge not reachable on ws://127.0.0.1:6455. Browsers cannot ' +
  'receive UDP directly, so run the bundled bridge on this machine: ' +
  '`npm install` then `node tools/artnet-bridge.mjs`. It relays Art-Net ' +
  '(UDP 6454) to the app. Retrying…'

function scheduleArtnetRetry() {
  clearTimeout(artRetryTimer)
  if (!modState.artnet.enabled) return
  artRetryTimer = setTimeout(connectArtnet, 3000)
}

function connectArtnet() {
  if (!modState.artnet.enabled) return
  try {
    artWs = new WebSocket('ws://127.0.0.1:6455')
  } catch (e) {
    modState.artnet.error = 'Could not open bridge socket: ' + (e.message || e.name)
    scheduleArtnetRetry()
    return
  }
  artWs.onopen = () => {
    modState.artnet.connected = true
    modState.artnet.error = ''
  }
  artWs.onerror = () => {
    modState.artnet.error = ARTNET_HELP
  }
  artWs.onclose = () => {
    modState.artnet.connected = false
    scheduleArtnetRetry()
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

export function startArtnet() {
  modState.artnet.enabled = true
  modState.artnet.error = ''
  connectArtnet()
}

export function stopArtnet() {
  modState.artnet.enabled = false
  clearTimeout(artRetryTimer)
  artRetryTimer = null
  artWs?.close()
  artWs = null
  modState.artnet.connected = false
}

// --- Per-frame application ----------------------------------------------

const smoothed = new Map()

function leapField(pathTail) {
  // pathTail is e.g. 'palmX', 'left.palmX', 'right.grab'
  if (pathTail.includes('.')) {
    const [hand, field] = pathTail.split('.')
    return modState.leap[hand]?.[field]
  }
  return modState.leap[pathTail]
}

function sourceValue(m) {
  const s = m.source
  if (s.startsWith('audio.')) {
    return modState.audio.enabled ? modState.audio[s.slice(6)] : null
  }
  if (s.startsWith('leap.')) {
    if (!modState.leap.connected) return null
    const v = leapField(s.slice(5))
    return v === undefined ? null : v
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

function smoothedValue(m, dt) {
  const v = sourceValue(m)
  if (v == null) return null
  // Frame-rate-independent exponential smoothing.
  const k = Math.pow(Math.min(m.smooth ?? 0, 0.998), dt * 60)
  const prev = smoothed.get(m.id) ?? v
  const sm = v + (prev - v) * k
  smoothed.set(m.id, sm)
  return sm
}

function writeTarget(m, sm) {
  const out = m.min + (m.max - m.min) * sm
  if (isModRoute(m.path)) {
    const [, key, field] = m.path.split(':')
    const tgt = modState.mappings.find((x) => x.key === key)
    if (tgt) tgt[field] = field === 'smooth' ? clamp01(out) : out
  } else {
    setParam(m.path, out)
  }
}

let lastApplyAt = 0

export function applyModulation() {
  const now = performance.now()
  const dt = lastApplyAt ? Math.min((now - lastApplyAt) / 1000, 0.1) : 1 / 60
  lastApplyAt = now
  // Pass 1: routing mappings run first so consumer ranges are up to date.
  for (const m of modState.mappings) {
    if (!isModRoute(m.path)) continue
    const sm = smoothedValue(m, dt)
    if (sm != null) writeTarget(m, sm)
  }
  // Pass 2: mappings that drive settings.
  for (const m of modState.mappings) {
    if (isModRoute(m.path)) continue
    const sm = smoothedValue(m, dt)
    if (sm != null) writeTarget(m, sm)
  }
  // MIDI continuous bindings: light smoothing to iron out 7-bit stepping.
  const k = Math.pow(0.6, dt * 60)
  for (const b of modState.midi.bindings) {
    if (b._norm == null || !b.target.startsWith('param:')) continue
    const path = b.target.slice(6)
    const targetVal = b.min + (b.max - b.min) * b._norm
    const prev = smoothed.get(b.id) ?? targetVal
    const sm = targetVal + (prev - targetVal) * k
    smoothed.set(b.id, sm)
    setParam(path, sm)
  }
}

// Quick-start: add sensible default mappings for every enabled input,
// skipping any target that is already mapped.
export function autoMap() {
  const add = (source, path, smooth, frac) => {
    if (modState.mappings.some((m) => m.path === path)) return
    if (!MOD_TARGETS.some((t) => t.path === path)) return
    const [min, max] = bandAround(path, frac)
    modState.mappings.push(makeMapping(source, path, min, max, smooth))
  }
  if (modState.audio.enabled) {
    add('audio.bass', 'layers.0.freq', 0.9, 0.5)
    add('audio.level', 'zoom', 0.93, 0.5)
    add('audio.treble', 'thickness', 0.9, 0.5)
    add('audio.beat', 'layers.1.rot', 0.72, 0.35)
  }
  if (modState.leap.enabled) {
    // Requested layout: Y → zoom, X/Z → layer 2 offset, grab → line width,
    // roll → layer 2 rotation. Leap smoothing is half the usual default.
    add('leap.palmY', 'zoom', LEAP_SMOOTH, 0.7)
    add('leap.palmX', 'layers.1.x', LEAP_SMOOTH, 0.8)
    add('leap.palmZ', 'layers.1.y', LEAP_SMOOTH, 0.8)
    add('leap.grab', 'thickness', LEAP_SMOOTH, 0.7)
    add('leap.roll', 'layers.1.rot', LEAP_SMOOTH, 0.7)
  }
  if (modState.midi.enabled) {
    const ccs = Object.keys(modState.midi.values).map(Number).sort((a, b) => a - b).slice(0, 4)
    const paths = ['zoom', 'thickness', 'layers.0.freq', 'layers.0.rot']
    ccs.forEach((cc, i) => add('midi.cc' + cc, paths[i], 0.6, 0.8))
  }
  if (modState.artnet.enabled) {
    add('artnet.ch1', 'zoom', 0.6, 0.8)
    add('artnet.ch2', 'thickness', 0.6, 0.8)
    add('artnet.ch3', 'layers.0.freq', 0.6, 0.8)
  }
}

// A readable label for a binding trigger.
export function midiTriggerLabel(b) {
  if (b.num == null) return 'unassigned'
  return (b.ttype === 'note' ? 'Note ' : 'CC ') + b.num
}

// --- Controller profiles ------------------------------------------------

export const MIDI_PROFILES = [
  { value: 'nanokontrol-studio', label: 'KORG nanoKONTROL Studio' },
]

// Factory-default CC layout for the KORG nanoKONTROL Studio (native mode,
// same numbering family as the nanoKONTROL2). Faders 0–7, knobs 16–23,
// S/M/R buttons 32–39 / 48–55 / 64–71, transport 41–46, track/marker 58–62.
// All remappable in KORG Kontrol Editor, and each can be MIDI-learned here.
export function applyMidiProfile(name) {
  if (name !== 'nanokontrol-studio') return
  const b = (ttype, num, target, range) => {
    const [min, max] = range || midiTargetRange(target)
    return {
      id: 'b' + ++nextId + Math.random().toString(36).slice(2, 5),
      key: midiKey(),
      ttype, num, target, min, max, _pressed: false, _norm: null,
    }
  }
  modState.midi.bindings = [
    // Faders → the big continuous knobs of the piece
    b('cc', 0, 'param:zoom'),
    b('cc', 1, 'param:thickness'),
    b('cc', 2, 'param:layers.0.freq'),
    b('cc', 3, 'param:layers.1.freq'),
    b('cc', 4, 'param:animSpeed'),
    b('cc', 5, 'param:layers.0.alpha'),
    b('cc', 6, 'param:layers.1.alpha'),
    b('cc', 7, 'param:layers.2.freq'),
    // Knobs → rotations & offsets
    b('cc', 16, 'param:layers.0.rot'),
    b('cc', 17, 'param:layers.1.rot'),
    b('cc', 18, 'param:layers.0.x'),
    b('cc', 19, 'param:layers.0.y'),
    b('cc', 20, 'param:layers.1.x'),
    b('cc', 21, 'param:layers.1.y'),
    b('cc', 22, 'option:colorMode'),
    b('cc', 23, 'option:layers.0.pattern'),
    // Solo/Mute buttons → toggles
    b('cc', 32, 'toggle:animate'),
    b('cc', 33, 'toggle:drift'),
    b('cc', 34, 'toggle:showFps'),
    // Transport → actions (buttons send 127 on press, 0 on release)
    b('cc', 45, 'action:randomize'), // Rec
    b('cc', 46, 'action:colors'), // Cycle
    b('cc', 41, 'action:playpause'), // Play
    b('cc', 43, 'action:prevPreset'), // Rewind
    b('cc', 44, 'action:nextPreset'), // FFwd
    b('cc', 58, 'action:undo'), // Track ◄
    b('cc', 59, 'action:redo'), // Track ►
    b('cc', 42, 'action:nextSlide'), // Stop
  ]
  modState.midi.profile = name
}
