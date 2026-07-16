<script setup>
import { computed, ref } from 'vue'
import {
  mdiDrag, mdiContentCopy, mdiClose, mdiDiceMultiple, mdiPalette,
  mdiUndo, mdiRedo, mdiPlay, mdiFlash, mdiPlus, mdiCog,
} from '@mdi/js'
import {
  settings,
  shaderState,
  PRESETS,
  PATTERN_GROUPS,
  LAYER_OPS,
  AA_MODES,
  COLOR_MODES,
  applyPreset,
  randomize,
  randomizePattern,
  randomizeColors,
  randomizeOpts,
  history,
  undoRandomize,
  redoRandomize,
} from '../settings.js'
import KeyBtn from './KeyBtn.vue'
import { slideshow, SLIDESHOW_MODES } from '../slideshow.js'
import {
  modState,
  BEAT_ACTIONS,
  AUDIO_SOURCES,
  LEAP_SOURCE_GROUPS,
  ARTNET_SOURCES,
  MOD_TARGETS,
  MIDI_CONTINUOUS,
  MIDI_DISCRETE,
  MIDI_TOGGLES,
  MIDI_ACTIONS,
  MIDI_PROFILES,
  addMapping,
  duplicateMapping,
  removeMapping,
  moveMapping,
  resetMappingRange,
  autoMap,
  isModRoute,
  addMidiBinding,
  removeMidiBinding,
  resetMidiBindingRange,
  midiTriggerLabel,
  applyMidiProfile,
  startAudio,
  stopAudio,
  startMIDI,
  stopMIDI,
  startLeap,
  stopLeap,
  startArtnet,
  stopArtnet,
} from '../modulation.js'

defineEmits(['slideshow', 'setup'])

// --- Accordion groups (v-expansion-panels) ------------------------------
const GROUPS = [
  { id: 'presets', label: 'Presets' },
  { id: 'pattern', label: 'Pattern' },
  { id: 'animation', label: 'Animate' },
  { id: 'input', label: 'Input' },
  { id: 'layers', label: 'Layers' },
]
const openPanels = ref(['presets', 'pattern', 'layers'])
function isOpen(id) {
  return openPanels.value.includes(id)
}
function jump(id) {
  if (!isOpen(id)) openPanels.value = [...openPanels.value, id]
  requestAnimationFrame(() =>
    document.getElementById('grp-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
  )
}

function rotDeg(layer) {
  return Math.round((layer.rot * 180) / Math.PI)
}
function setRotDeg(layer, deg) {
  layer.rot = (Number(deg) * Math.PI) / 180
}

function toggleAudio(v) {
  v ? startAudio() : stopAudio()
}
function toggleMIDI(v) {
  v ? startMIDI() : stopMIDI()
}
function toggleLeap(v) {
  v ? startLeap() : stopLeap()
}
function toggleArtnet(v) {
  v ? startArtnet() : stopArtnet()
}

const midiContinuous = MIDI_CONTINUOUS()

function midiTargetIsParam(b) {
  return b.target.startsWith('param:')
}

const anyInputEnabled = computed(
  () =>
    modState.audio.enabled ||
    modState.midi.enabled ||
    modState.leap.enabled ||
    modState.artnet.enabled,
)

const anyCustom = computed(() =>
  settings.layers.slice(0, settings.layerCount).some((l) => l.pattern === 9),
)
const anyCustomShape = computed(() =>
  settings.layers.slice(0, settings.layerCount).some((l) => l.pattern === 15),
)
const isMorphMode = computed(
  () => slideshow.mode === 'morph' || slideshow.mode === 'shufflemorph',
)

const RANDOMIZE_OPTS = [
  ['patterns', 'patterns'],
  ['ops', 'combine'],
  ['freqs', 'freqs'],
  ['offsets', 'offsets'],
  ['layerCount', 'layers'],
  ['thickness', 'width'],
  ['colors', 'colors'],
]

// --- Mappings helpers ---------------------------------------------------
function mapLetter(i) {
  let s = ''
  i += 1
  while (i > 0) {
    s = String.fromCharCode(65 + ((i - 1) % 26)) + s
    i = Math.floor((i - 1) / 26)
  }
  return s
}

// Modular routing targets: every OTHER mapping's range min/max and smoothing.
function modRoutes(currentId) {
  const out = []
  modState.mappings.forEach((m, i) => {
    if (m.id === currentId) return
    const name = 'Map ' + mapLetter(i)
    out.push({ value: `mod:${m.key}:min`, label: `${name} · range min` })
    out.push({ value: `mod:${m.key}:max`, label: `${name} · range max` })
    out.push({ value: `mod:${m.key}:smooth`, label: `${name} · smoothing` })
  })
  return out
}

const dragIndex = ref(-1)
function onDragStart(i, e) {
  dragIndex.value = i
  e.dataTransfer.effectAllowed = 'move'
}
function onDrop(i) {
  if (dragIndex.value >= 0 && dragIndex.value !== i) moveMapping(dragIndex.value, i)
  dragIndex.value = -1
}
</script>

<template>
  <aside class="panel">
    <header>
      <h1>Moiré Generator</h1>
      <p class="sub">Layered gratings rendered in a Three.js fragment shader</p>
    </header>

    <nav class="acc-nav">
      <button
        v-for="g in GROUPS" :key="g.id"
        :class="{ active: isOpen(g.id) }"
        @click="jump(g.id)"
      >{{ g.label }}</button>
    </nav>

    <v-expansion-panels v-model="openPanels" multiple flat class="panels">
      <!-- Presets & Random -->
      <v-expansion-panel id="grp-presets" value="presets" title="Presets &amp; Random">
        <v-expansion-panel-text>
          <div class="preset-grid">
            <v-btn
              v-for="p in PRESETS" :key="p.name"
              size="small" variant="tonal" class="tt-none" @click="applyPreset(p)"
            >{{ p.name }}</v-btn>
          </div>
          <div class="btn-row mt-2">
            <v-btn :icon="mdiUndo" size="small" variant="tonal" :disabled="!history.past.length"
              title="Go back to the pattern before the last randomize (Z)" @click="undoRandomize()" />
            <v-btn color="primary" variant="flat" class="flex-grow-1 tt-none" @click="randomize()">Randomize</v-btn>
            <v-btn :icon="mdiRedo" size="small" variant="tonal" :disabled="!history.future.length"
              title="Redo (Shift+Z)" @click="redoRandomize()" />
          </div>
          <div class="btn-row mt-2">
            <v-btn :prepend-icon="mdiDiceMultiple" size="small" variant="tonal" class="flex-grow-1 tt-none"
              title="Randomize the pattern structure only" @click="randomizePattern()">Pattern</v-btn>
            <v-btn :prepend-icon="mdiPalette" size="small" variant="tonal" class="flex-grow-1 tt-none"
              title="Random colors only" @click="randomizeColors()">Colors</v-btn>
          </div>
          <div class="rand-opts" title="What Randomize (and R / on-beat) affects">
            <label v-for="[key, label] in RANDOMIZE_OPTS" :key="key">
              <input type="checkbox" v-model="randomizeOpts[key]" /> {{ label }}
            </label>
          </div>
          <div class="ctl mt-2">
            <v-btn :prepend-icon="mdiPlay" size="small" variant="tonal" class="tt-none display-btn"
              title="Start the display view (S · Esc exits)" @click="$emit('slideshow')">Display</v-btn>
            <select v-model="slideshow.mode" class="nsel">
              <option v-for="m in SLIDESHOW_MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
          </div>
          <div v-if="slideshow.mode !== 'current'" class="ctl">
            <span class="lbl">every</span>
            <input type="number" min="2" max="60" step="1" class="nnum" v-model.number="slideshow.interval" />
            <span class="unit">seconds</span>
          </div>
          <div v-if="isMorphMode" class="ctl" title="How long each fade takes (up to the interval)">
            <span class="lbl">fade over</span>
            <input type="number" min="0.5" max="60" step="0.5" class="nnum" v-model.number="slideshow.morphRate" />
            <span class="unit">seconds</span>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>

      <!-- Pattern -->
      <v-expansion-panel id="grp-pattern" value="pattern" title="Pattern">
        <v-expansion-panel-text>
          <div class="ctl">
            <span class="lbl">Anti-alias</span>
            <select v-model.number="settings.aaMode" class="nsel">
              <option v-for="m in AA_MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
            <KeyBtn path="aaMode" />
          </div>
          <div class="ctl" title="Render resolution. Lower = smoother on slower GPUs.">
            <span class="lbl">Resolution</span>
            <select v-model.number="settings.resScale" class="nsel">
              <option :value="0">Auto (sharp)</option>
              <option :value="1">100%</option>
              <option :value="0.75">75%</option>
              <option :value="0.5">50%</option>
              <option :value="2160">2160 px</option>
              <option :value="1440">1440 px</option>
              <option :value="1080">1080 px</option>
              <option :value="720">720 px</option>
              <option :value="540">540 px</option>
              <option :value="480">480 px</option>
              <option :value="360">360 px</option>
              <option :value="240">240 px</option>
            </select>
          </div>
          <div class="ctl">
            <span class="lbl">FPS counter</span>
            <v-switch v-model="settings.showFps" hide-details density="compact" class="ml-auto" />
          </div>
          <div class="ctl">
            <span class="lbl">Layers</span>
            <v-slider v-model="settings.layerCount" :min="1" :max="8" :step="1" class="sl" />
            <span class="val">{{ settings.layerCount }}</span>
            <KeyBtn path="layerCount" />
          </div>
          <div class="ctl">
            <span class="lbl">Zoom</span>
            <v-slider v-model="settings.zoom" :min="0.25" :max="4" :step="0.01" class="sl" />
            <span class="val">{{ settings.zoom.toFixed(2) }}</span>
            <KeyBtn path="zoom" />
          </div>
          <div class="ctl">
            <span class="lbl">Line width</span>
            <v-slider v-model="settings.thickness" :min="0.05" :max="0.95" :step="0.01" class="sl" />
            <span class="val">{{ settings.thickness.toFixed(2) }}</span>
            <KeyBtn path="thickness" />
          </div>
          <div class="ctl">
            <span class="lbl">Color mode</span>
            <select v-model.number="settings.colorMode" class="nsel">
              <option v-for="c in COLOR_MODES" :key="c.value" :value="c.value">{{ c.label }}</option>
            </select>
            <KeyBtn path="colorMode" />
          </div>
          <div class="ctl colors">
            <span class="lbl">Colors</span>
            <input type="color" v-model="settings.colorA" title="Background" />
            <KeyBtn path="colorA" />
            <template v-if="settings.colorMode === 0 || settings.colorMode === 1">
              <input type="color" v-model="settings.colorB" :title="settings.colorMode === 1 ? 'Gradient middle' : 'Foreground'" />
              <KeyBtn path="colorB" />
            </template>
            <template v-if="settings.colorMode === 1">
              <input type="color" v-model="settings.colorC" title="Gradient end" />
              <KeyBtn path="colorC" />
            </template>
            <em v-if="settings.colorMode === 2" class="note">hue follows pattern</em>
            <em v-if="settings.colorMode === 3" class="note">set per layer below</em>
          </div>
          <div v-if="anyCustom" class="custom-box">
            <span class="box-label">Custom pattern</span>
            <textarea v-model="settings.customExpr" rows="3" spellcheck="false"
              placeholder="sin(d * freq + 3.0 * sin(a * 5.0))" />
            <p class="note">GLSL → float in [-1, 1]. Vars: <em>p</em>, <em>freq</em>, <em>d</em>, <em>a</em>, <em>t</em></p>
          </div>
          <div v-if="anyCustomShape" class="custom-box">
            <span class="box-label">Custom shape</span>
            <textarea v-model="settings.customShapeExpr" rows="3" spellcheck="false"
              placeholder="d - r * (0.7 + 0.3 * cos(a * 5.0))" />
            <p class="note">Signed distance, negative inside. Vars: <em>p</em>, <em>r</em>, <em>freq</em>, <em>d</em>, <em>a</em>, <em>t</em></p>
          </div>
          <p v-if="(anyCustom || anyCustomShape) && shaderState.error" class="err">{{ shaderState.error }}</p>
        </v-expansion-panel-text>
      </v-expansion-panel>

      <!-- Animation -->
      <v-expansion-panel id="grp-animation" value="animation" title="Animation">
        <v-expansion-panel-text>
          <div class="ctl">
            <span class="lbl">Animate</span>
            <v-switch v-model="settings.animate" hide-details density="compact" class="ml-auto" />
          </div>
          <div class="ctl" title="Built-in slow orbit and counter-rotation of layers">
            <span class="lbl">Drift</span>
            <v-switch v-model="settings.drift" hide-details density="compact" class="ml-auto" />
          </div>
          <div class="ctl">
            <span class="lbl">Speed</span>
            <v-slider v-model="settings.animSpeed" :min="0.1" :max="4" :step="0.1" class="sl" />
            <span class="val">{{ settings.animSpeed.toFixed(1) }}×</span>
            <KeyBtn path="animSpeed" />
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>

      <!-- Live Input -->
      <v-expansion-panel id="grp-input" value="input" title="Live Input">
        <v-expansion-panel-text>
          <div class="ctl">
            <span class="lbl">Audio (mic)</span>
            <v-switch :model-value="modState.audio.enabled" @update:model-value="toggleAudio" hide-details density="compact" />
            <span v-if="modState.audio.enabled" class="meter">
              <span class="meter-fill" :style="{ width: modState.audio.level * 100 + '%' }" />
            </span>
          </div>
          <p v-if="modState.audio.error" class="err">{{ modState.audio.error }}</p>
          <div v-if="modState.audio.enabled" class="ctl">
            <span class="lbl">Beat</span>
            <span class="beat-dot" :class="{ on: modState.audio.beat > 0.5 }" />
            <em class="note">{{ modState.audio.bpm ? '~' + modState.audio.bpm + ' BPM' : 'listening…' }}</em>
          </div>
          <div v-if="modState.audio.enabled" class="ctl" title="Higher = more beats detected">
            <span class="lbl">Sensitivity</span>
            <v-slider v-model="modState.beat.sens" :min="0.5" :max="2" :step="0.05" class="sl" />
            <span class="val">{{ modState.beat.sens.toFixed(2) }}</span>
          </div>
          <div v-if="modState.audio.enabled" class="ctl">
            <span class="lbl">On beat</span>
            <select v-model="modState.beat.action" class="nsel">
              <option v-for="a in BEAT_ACTIONS" :key="a.value" :value="a.value">{{ a.label }}</option>
            </select>
          </div>
          <div v-if="modState.audio.enabled && modState.beat.action !== 'none'" class="ctl">
            <span class="lbl">Every</span>
            <input type="number" min="1" max="32" step="1" class="nnum" v-model.number="modState.beat.every" />
            <span class="unit">beat{{ modState.beat.every === 1 ? '' : 's' }}</span>
          </div>

          <div class="ctl">
            <span class="lbl">MIDI</span>
            <v-switch :model-value="modState.midi.enabled" @update:model-value="toggleMIDI" hide-details density="compact" />
            <em v-if="modState.midi.enabled" class="note ml-1">{{ modState.midi.inputs }} dev</em>
            <v-btn :prepend-icon="mdiCog" size="x-small" variant="tonal" class="tt-none ml-auto" @click="$emit('setup', 'midi')">setup</v-btn>
          </div>
          <p v-if="modState.midi.error" class="err">{{ modState.midi.error }}</p>

          <div class="ctl">
            <span class="lbl">Leap Motion</span>
            <v-switch :model-value="modState.leap.enabled" @update:model-value="toggleLeap" hide-details density="compact" />
            <em v-if="modState.leap.connected" class="note ml-1">{{ modState.leap.hands }} hand{{ modState.leap.hands === 1 ? '' : 's' }}</em>
          </div>
          <p v-if="modState.leap.error" class="err">{{ modState.leap.error }}</p>

          <div class="ctl">
            <span class="lbl">Art-Net</span>
            <v-switch :model-value="modState.artnet.enabled" @update:model-value="toggleArtnet" hide-details density="compact" />
            <em v-if="modState.artnet.connected" class="note ml-1">connected</em>
            <v-btn :prepend-icon="mdiCog" size="x-small" variant="tonal" class="tt-none ml-auto" @click="$emit('setup', 'artnet')">setup</v-btn>
          </div>
          <p v-if="modState.artnet.error" class="err">{{ modState.artnet.error }}</p>

          <!-- Modulation mappings (audio / leap / art-net) -->
          <div
            v-for="(m, mi) in modState.mappings" :key="m.id"
            class="map-box" :class="{ routing: isModRoute(m.path) }"
            @dragover.prevent @drop="onDrop(mi)"
          >
            <div class="map-head">
              <v-icon :icon="mdiDrag" size="16" class="map-handle" title="Drag to reorder"
                draggable="true" @dragstart="onDragStart(mi, $event)" />
              <span class="map-key">Map {{ mapLetter(mi) }}</span>
              <v-btn :icon="mdiContentCopy" size="x-small" variant="text" title="Duplicate" @click="duplicateMapping(m.id)" />
              <v-btn :icon="mdiClose" size="x-small" variant="text" color="error" title="Remove" @click="removeMapping(m.id)" />
            </div>
            <div class="map-line">
              <span>Source</span>
              <select v-model="m.source" class="nsel">
                <optgroup label="Audio">
                  <option v-for="s in AUDIO_SOURCES" :key="s.value" :value="s.value">{{ s.label }}</option>
                </optgroup>
                <optgroup v-for="g in LEAP_SOURCE_GROUPS" :key="g.label" :label="g.label">
                  <option v-for="s in g.items" :key="s.value" :value="s.value">{{ s.label }}</option>
                </optgroup>
                <optgroup label="Art-Net">
                  <option v-for="s in ARTNET_SOURCES" :key="s.value" :value="s.value">{{ s.label }}</option>
                </optgroup>
                <optgroup v-if="m.source.startsWith('midi.')" label="MIDI (legacy)">
                  <option :value="m.source">MIDI · {{ m.source.replace('midi.cc', 'CC ') }}</option>
                </optgroup>
              </select>
            </div>
            <div class="map-line">
              <span>Target</span>
              <select v-model="m.path" class="nsel" @change="resetMappingRange(m)">
                <optgroup label="Settings">
                  <option v-for="t in MOD_TARGETS" :key="t.path" :value="t.path">{{ t.label }}</option>
                </optgroup>
                <optgroup v-if="modRoutes(m.id).length" label="Modulate a mapping">
                  <option v-for="r in modRoutes(m.id)" :key="r.value" :value="r.value">{{ r.label }}</option>
                </optgroup>
              </select>
            </div>
            <div class="map-line map-range">
              <span>Range</span>
              <input type="number" step="any" v-model.number="m.min" />
              <input type="number" step="any" v-model.number="m.max" />
            </div>
            <div class="ctl">
              <span class="lbl sm">Smooth</span>
              <v-slider v-model="m.smooth" :min="0" :max="0.995" :step="0.005" class="sl" />
            </div>
          </div>

          <div class="btn-row mt-2">
            <v-btn :prepend-icon="mdiPlus" size="small" variant="tonal" class="flex-grow-1 tt-none" @click="addMapping()">Add mapping</v-btn>
            <v-btn :prepend-icon="mdiFlash" size="small" variant="tonal" class="flex-grow-1 tt-none" :disabled="!anyInputEnabled"
              title="Add default mappings for every enabled input" @click="autoMap()">Auto-map</v-btn>
          </div>

          <!-- MIDI control surface -->
          <div v-if="modState.midi.enabled || modState.midi.bindings.length" class="midi-block">
            <div class="midi-title">
              <span class="box-label">MIDI Control</span>
              <select class="nsel profile-sel" :value="modState.midi.profile"
                title="Load a controller profile" @change="applyMidiProfile($event.target.value)">
                <option value="">Profile…</option>
                <option v-for="p in MIDI_PROFILES" :key="p.value" :value="p.value">{{ p.label }}</option>
              </select>
            </div>
            <div v-for="b in modState.midi.bindings" :key="b.id" class="bind-box">
              <div class="bind-head">
                <v-btn size="x-small" :variant="modState.midi.learnBindingId === b.id ? 'flat' : 'tonal'"
                  :color="modState.midi.learnBindingId === b.id ? 'warning' : undefined" class="tt-none learn-btn"
                  title="Click, then move a knob or press a button"
                  @click="modState.midi.learnBindingId = modState.midi.learnBindingId === b.id ? null : b.id"
                >{{ modState.midi.learnBindingId === b.id ? 'press…' : midiTriggerLabel(b) }}</v-btn>
                <span class="arrow">→</span>
                <select v-model="b.target" class="nsel" @change="resetMidiBindingRange(b)">
                  <optgroup label="Continuous">
                    <option v-for="t in midiContinuous" :key="t.value" :value="t.value">{{ t.label }}</option>
                  </optgroup>
                  <optgroup label="Options">
                    <option v-for="t in MIDI_DISCRETE" :key="t.value" :value="t.value">{{ t.label }}</option>
                  </optgroup>
                  <optgroup label="Toggles">
                    <option v-for="t in MIDI_TOGGLES" :key="t.value" :value="t.value">{{ t.label }}</option>
                  </optgroup>
                  <optgroup label="Actions">
                    <option v-for="t in MIDI_ACTIONS" :key="t.value" :value="t.value">{{ t.label }}</option>
                  </optgroup>
                </select>
                <v-btn :icon="mdiClose" size="x-small" variant="text" color="error" title="Remove" @click="removeMidiBinding(b.id)" />
              </div>
              <div v-if="midiTargetIsParam(b)" class="map-line map-range">
                <span>Range</span>
                <input type="number" step="any" v-model.number="b.min" />
                <input type="number" step="any" v-model.number="b.max" />
              </div>
            </div>
            <v-btn :prepend-icon="mdiPlus" size="small" variant="tonal" block class="tt-none mt-1" @click="addMidiBinding()">Add MIDI control</v-btn>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>

      <!-- Layers -->
      <v-expansion-panel id="grp-layers" value="layers" title="Layers">
        <v-expansion-panel-text>
          <div v-for="i in settings.layerCount" :key="i" class="layer">
            <div class="layer-head">
              <v-btn size="x-small" :variant="settings.activeLayer === i - 1 ? 'flat' : 'tonal'"
                :color="settings.activeLayer === i - 1 ? 'primary' : undefined" class="tt-none"
                @click="settings.activeLayer = i - 1">Layer {{ i }}</v-btn>
              <template v-if="settings.colorMode === 3">
                <input type="color" v-model="settings.layers[i - 1].color" class="layer-color" title="Layer color" />
                <KeyBtn :path="`layers.${i - 1}.color`" />
              </template>
              <span v-if="settings.activeLayer === i - 1" class="tag">drag target</span>
            </div>
            <div class="ctl">
              <span class="lbl">Type</span>
              <select v-model.number="settings.layers[i - 1].pattern" class="nsel">
                <optgroup v-for="g in PATTERN_GROUPS" :key="g.label" :label="g.label">
                  <option v-for="t in g.items" :key="t.value" :value="t.value">{{ t.label }}</option>
                </optgroup>
              </select>
              <KeyBtn :path="`layers.${i - 1}.pattern`" />
            </div>
            <div v-if="i > 1" class="ctl" title="How this layer combines with those below. Mask blends below vs above.">
              <span class="lbl">Combine</span>
              <select v-model.number="settings.layers[i - 1].op" class="nsel">
                <option v-for="o in LAYER_OPS" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
              <KeyBtn :path="`layers.${i - 1}.op`" />
            </div>
            <div class="ctl">
              <span class="lbl">Frequency</span>
              <v-slider v-model="settings.layers[i - 1].freq" :min="5" :max="1000" :step="1" class="sl" />
              <span class="val">{{ Math.round(settings.layers[i - 1].freq) }}</span>
              <KeyBtn :path="`layers.${i - 1}.freq`" />
            </div>
            <div class="ctl">
              <span class="lbl">Rotation</span>
              <v-slider :model-value="rotDeg(settings.layers[i - 1])" :min="-180" :max="180" :step="1"
                class="sl" @update:model-value="(v) => setRotDeg(settings.layers[i - 1], v)" />
              <span class="val">{{ rotDeg(settings.layers[i - 1]) }}°</span>
              <KeyBtn :path="`layers.${i - 1}.rot`" />
            </div>
            <div class="ctl">
              <span class="lbl">Offset X</span>
              <v-slider v-model="settings.layers[i - 1].x" :min="-1" :max="1" :step="0.005" class="sl" />
              <span class="val">{{ settings.layers[i - 1].x.toFixed(2) }}</span>
              <KeyBtn :path="`layers.${i - 1}.x`" />
            </div>
            <div class="ctl">
              <span class="lbl">Offset Y</span>
              <v-slider v-model="settings.layers[i - 1].y" :min="-1" :max="1" :step="0.005" class="sl" />
              <span class="val">{{ settings.layers[i - 1].y.toFixed(2) }}</span>
              <KeyBtn :path="`layers.${i - 1}.y`" />
            </div>
            <div class="ctl" title="Layer opacity: scales this layer's contribution">
              <span class="lbl">Opacity</span>
              <v-slider v-model="settings.layers[i - 1].alpha" :min="0" :max="1" :step="0.01" class="sl" />
              <span class="val">{{ (settings.layers[i - 1].alpha ?? 1).toFixed(2) }}</span>
              <KeyBtn :path="`layers.${i - 1}.alpha`" />
            </div>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <footer>
      Moiré appears when a grating's frequency beats against another grating —
      or against the pixel grid itself. Set anti-alias to <em>Off</em> with a
      high frequency to see sampling moiré; switch to <em>Smooth</em> or
      <em>Supersample</em> to reduce it.
    </footer>
  </aside>
</template>

<style scoped>
.panel {
  width: 300px;
  flex: none;
  overflow-y: auto;
  padding: 18px 16px 24px;
  background: #101014;
  border-right: 1px solid #212129;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
header h1 {
  font-size: 17px;
  font-weight: 650;
  letter-spacing: 0.02em;
}
.sub {
  margin-top: 4px;
  font-size: 11.5px;
  color: #85858f;
}
.acc-nav {
  position: sticky;
  top: -18px;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 0;
  background: #101014;
}
.acc-nav button {
  flex: 1;
  min-width: 0;
  padding: 5px 4px;
  font-size: 10.5px;
  color: #9a9aa5;
  background: #1a1a21;
  border: 1px solid #2c2c36;
  border-radius: 6px;
  cursor: pointer;
}
.acc-nav button.active {
  color: #cfc8ff;
  border-color: #4c42a3;
  background: #241f45;
}

/* Compact expansion panels */
.panels {
  background: transparent;
}
.panels :deep(.v-expansion-panel) {
  background: transparent;
  color: #c9c9d1;
}
.panels :deep(.v-expansion-panel-title) {
  min-height: 0;
  padding: 8px 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: #8a8a95;
  border-bottom: 1px solid #212129;
}
.panels :deep(.v-expansion-panel-title--active) {
  color: #cfc8ff;
}
.panels :deep(.v-expansion-panel-text__wrapper) {
  padding: 12px 2px 4px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.panels :deep(.v-expansion-panel__shadow) {
  display: none;
}

.ctl {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  color: #c9c9d1;
}
.lbl {
  width: 74px;
  flex: none;
  color: #9a9aa5;
}
.lbl.sm {
  width: 54px;
  font-size: 11px;
}
.unit {
  font-size: 11.5px;
  color: #75757f;
}
.val {
  width: 42px;
  flex: none;
  text-align: right;
  font-size: 11.5px;
  color: #d7d7de;
  font-variant-numeric: tabular-nums;
}
.sl {
  flex: 1;
  min-width: 0;
}

/* Native controls, styled to match Vuetify's outlined look */
.nsel {
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  font-size: 12.5px;
  color: #e4e4e9;
  background: #1a1a21;
  border: 1px solid #3a3a46;
  border-radius: 6px;
}
.nsel:focus {
  outline: none;
  border-color: #7c6cf0;
}
.nnum {
  width: 60px;
  flex: none;
  padding: 6px 8px;
  font-size: 12.5px;
  color: #e4e4e9;
  background: #1a1a21;
  border: 1px solid #3a3a46;
  border-radius: 6px;
  font-variant-numeric: tabular-nums;
}
input[type='color'] {
  width: 34px;
  height: 26px;
  padding: 0;
  border: 1px solid #2c2c36;
  border-radius: 6px;
  background: none;
  cursor: pointer;
}

.tt-none :deep(.v-btn__content),
.tt-none {
  text-transform: none;
  letter-spacing: normal;
}
.preset-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.btn-row {
  display: flex;
  gap: 6px;
}
.display-btn {
  flex: 0 0 auto;
}
.rand-opts {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 3px 8px;
}
.rand-opts label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  color: #85858f;
  cursor: pointer;
}
.rand-opts input {
  width: 12px;
  height: 12px;
  accent-color: #7c6cf0;
}

.keybtn {
  flex: none;
}
.note {
  font-size: 11px;
  font-style: normal;
  color: #75757f;
}
.err {
  font-size: 11px;
  line-height: 1.45;
  color: #ff8a8a;
  font-family: ui-monospace, Menlo, Consolas, monospace;
}
.custom-box {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.box-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #8f86d8;
}
.custom-box textarea {
  width: 100%;
  resize: vertical;
  padding: 7px 9px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 11.5px;
  line-height: 1.5;
  color: #d7f0d7;
  background: #14141a;
  border: 1px solid #2c2c36;
  border-radius: 7px;
}
.custom-box textarea:focus {
  outline: none;
  border-color: #4c42a3;
}
.custom-box .note em {
  color: #a8a2d8;
  font-style: normal;
}
.meter {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: #1a1a21;
  border: 1px solid #2c2c36;
  overflow: hidden;
}
.meter-fill {
  display: block;
  height: 100%;
  background: #7c6cf0;
  transition: width 0.08s linear;
}
.beat-dot {
  flex: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #2c2c36;
  transition: background 0.05s;
}
.beat-dot.on {
  background: #ffd166;
  box-shadow: 0 0 8px rgba(255, 209, 102, 0.8);
}
.map-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background: #16161c;
  border: 1px solid #24242d;
  border-radius: 7px;
}
.map-box.routing {
  border-color: #4c42a3;
  background: #17151f;
}
.map-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.map-handle {
  cursor: grab;
  color: #5c5c68;
}
.map-key {
  flex: 1;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: #8f86d8;
}
.map-line {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}
.map-line > span {
  width: 48px;
  flex: none;
  color: #85858f;
}
.map-range input[type='number'] {
  flex: 1;
  min-width: 0;
  width: 0;
  padding: 5px 6px;
  font-size: 12px;
  color: #e4e4e9;
  background: #1a1a21;
  border: 1px solid #3a3a46;
  border-radius: 5px;
  font-variant-numeric: tabular-nums;
}
.arrow {
  flex: none;
  color: #6f6f7a;
  font-size: 11px;
}
.midi-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 8px;
  margin-top: 4px;
  border-top: 1px dashed #2c2c36;
}
.midi-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.midi-title .box-label {
  flex: 1;
}
.profile-sel {
  flex: none;
  max-width: 62%;
  font-size: 11px;
  padding: 4px 6px;
}
.bind-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 7px 8px;
  background: #171a20;
  border: 1px solid #26303a;
  border-radius: 7px;
}
.bind-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.learn-btn {
  min-width: 62px;
  font-variant-numeric: tabular-nums;
}
.layer {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding-bottom: 6px;
}
.layer-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.layer-color {
  width: 26px !important;
  height: 20px !important;
}
.tag {
  font-size: 10px;
  color: #7c6cf0;
  letter-spacing: 0.02em;
}
footer {
  font-size: 11px;
  line-height: 1.55;
  color: #75757f;
  border-top: 1px solid #212129;
  padding-top: 12px;
}
footer em {
  color: #a8a2d8;
  font-style: normal;
}
</style>
