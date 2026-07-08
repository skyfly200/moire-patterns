<script setup>
import { ref, computed } from 'vue'
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
  shareURL,
  encodeSnapshot,
} from '../settings.js'
import { gallery, loadFromGallery, removeFromGallery } from '../gallery.js'
import { recState } from '../recorder.js'
import KeyBtn from './KeyBtn.vue'
import { slideshow } from '../slideshow.js'

defineEmits(['export', 'record', 'save', 'slideshow'])

const copiedId = ref(null)
let copiedTimer = null

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    window.prompt('Copy this link:', text)
  }
}

async function copyShare(entry = null) {
  const url = entry ? shareURL(entry.snap) : shareURL()
  if (!entry) history.replaceState(null, '', '#s=' + encodeSnapshot())
  await copyText(url)
  copiedId.value = entry ? entry.id : 'current'
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copiedId.value = null), 1500)
}

const recTime = computed(() => {
  const m = Math.floor(recState.seconds / 60)
  const s = String(recState.seconds % 60).padStart(2, '0')
  return `${m}:${s}`
})

const anyCustom = computed(() =>
  settings.layers.slice(0, settings.layerCount).some((l) => l.pattern === 9),
)

const anyCustomShape = computed(() =>
  settings.layers.slice(0, settings.layerCount).some((l) => l.pattern === 15),
)

function rotDeg(layer) {
  return Math.round((layer.rot * 180) / Math.PI)
}

function setRotDeg(layer, deg) {
  layer.rot = (Number(deg) * Math.PI) / 180
}
</script>

<template>
  <aside class="panel">
    <header>
      <h1>Moiré Generator</h1>
      <p class="sub">Layered gratings rendered in a Three.js fragment shader</p>
    </header>

    <section>
      <h2>Presets</h2>
      <div class="preset-grid">
        <button v-for="p in PRESETS" :key="p.name" @click="applyPreset(p)">
          {{ p.name }}
        </button>
        <button class="accent" @click="randomize()">Randomize</button>
      </div>
      <div class="row slideshow-row">
        <button
          class="slideshow-btn"
          title="Cycle through your saved gallery (or these presets while the gallery is empty), hiding the UI. Shortcut: S"
          @click="$emit('slideshow')"
        >
          ▶ Slideshow
        </button>
        <span>every</span>
        <input type="number" min="2" max="60" step="1" v-model.number="slideshow.interval" />
        <span>s</span>
      </div>
    </section>

    <section>
      <h2>Pattern</h2>
      <label class="row">
        <span>Anti-alias</span>
        <select v-model.number="settings.aaMode">
          <option v-for="m in AA_MODES" :key="m.value" :value="m.value">
            {{ m.label }}
          </option>
        </select>
        <KeyBtn path="aaMode" />
      </label>
      <label class="row">
        <span>Layers</span>
        <input type="range" min="1" max="8" step="1" v-model.number="settings.layerCount" />
        <b>{{ settings.layerCount }}</b>
        <KeyBtn path="layerCount" />
      </label>
      <label class="row">
        <span>Zoom</span>
        <input type="range" min="0.25" max="4" step="0.01" v-model.number="settings.zoom" />
        <b>{{ settings.zoom.toFixed(2) }}</b>
        <KeyBtn path="zoom" />
      </label>
      <label class="row">
        <span>Line width</span>
        <input type="range" min="0.05" max="0.95" step="0.01" v-model.number="settings.thickness" />
        <b>{{ settings.thickness.toFixed(2) }}</b>
        <KeyBtn path="thickness" />
      </label>
      <label class="row">
        <span>Color mode</span>
        <select v-model.number="settings.colorMode">
          <option v-for="c in COLOR_MODES" :key="c.value" :value="c.value">
            {{ c.label }}
          </option>
        </select>
        <KeyBtn path="colorMode" />
      </label>
      <div class="row colors">
        <span>Colors</span>
        <input type="color" v-model="settings.colorA" title="Background" />
        <KeyBtn path="colorA" />
        <template v-if="settings.colorMode === 0 || settings.colorMode === 1">
          <input
            type="color" v-model="settings.colorB"
            :title="settings.colorMode === 1 ? 'Gradient middle' : 'Foreground'"
          />
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
        <textarea
          v-model="settings.customExpr"
          rows="3" spellcheck="false"
          placeholder="sin(d * freq + 3.0 * sin(a * 5.0))"
        />
        <p class="note">
          GLSL expression → float in [-1, 1]. Vars: <em>p</em> (vec2),
          <em>freq</em>, <em>d</em> = length(p), <em>a</em> = angle, <em>t</em> = time
        </p>
      </div>
      <div v-if="anyCustomShape" class="custom-box">
        <span class="box-label">Custom shape</span>
        <textarea
          v-model="settings.customShapeExpr"
          rows="3" spellcheck="false"
          placeholder="d - r * (0.7 + 0.3 * cos(a * 5.0))"
        />
        <p class="note">
          Signed distance → negative inside the shape. Vars: <em>p</em>,
          <em>r</em> = size from frequency, <em>freq</em>, <em>d</em>, <em>a</em>, <em>t</em>
        </p>
      </div>
      <p v-if="(anyCustom || anyCustomShape) && shaderState.error" class="err">
        {{ shaderState.error }}
      </p>
    </section>

    <section>
      <h2>Animation</h2>
      <label class="row">
        <span>Animate</span>
        <input type="checkbox" v-model="settings.animate" />
      </label>
      <label class="row" title="Built-in slow orbit and counter-rotation of layers">
        <span>Drift</span>
        <input type="checkbox" v-model="settings.drift" />
      </label>
      <label class="row">
        <span>Speed</span>
        <input type="range" min="0.1" max="4" step="0.1" v-model.number="settings.animSpeed" />
        <b>{{ settings.animSpeed.toFixed(1) }}×</b>
        <KeyBtn path="animSpeed" />
      </label>
    </section>

    <section v-for="i in settings.layerCount" :key="i">
      <h2 class="layer-head">
        <button
          class="layer-tab"
          :class="{ active: settings.activeLayer === i - 1 }"
          @click="settings.activeLayer = i - 1"
        >
          Layer {{ i }}
        </button>
        <template v-if="settings.colorMode === 3">
          <input
            type="color" v-model="settings.layers[i - 1].color"
            class="layer-color" title="Layer color"
          />
          <KeyBtn :path="`layers.${i - 1}.color`" />
        </template>
        <span v-if="settings.activeLayer === i - 1" class="tag">drag target</span>
      </h2>
      <label class="row">
        <span>Type</span>
        <select v-model.number="settings.layers[i - 1].pattern">
          <optgroup v-for="g in PATTERN_GROUPS" :key="g.label" :label="g.label">
            <option v-for="t in g.items" :key="t.value" :value="t.value">
              {{ t.label }}
            </option>
          </optgroup>
        </select>
        <KeyBtn :path="`layers.${i - 1}.pattern`" />
      </label>
      <label v-if="i > 1" class="row" title="How this layer combines with the layers below it. Mask blends the layers below against the layers above using this layer's pattern.">
        <span>Combine</span>
        <select v-model.number="settings.layers[i - 1].op">
          <option v-for="o in LAYER_OPS" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </select>
        <KeyBtn :path="`layers.${i - 1}.op`" />
      </label>
      <label class="row">
        <span>Frequency</span>
        <input type="range" min="5" max="1000" step="1" v-model.number="settings.layers[i - 1].freq" />
        <b>{{ Math.round(settings.layers[i - 1].freq) }}</b>
        <KeyBtn :path="`layers.${i - 1}.freq`" />
      </label>
      <label class="row">
        <span>Rotation</span>
        <input
          type="range" min="-180" max="180" step="1"
          :value="rotDeg(settings.layers[i - 1])"
          @input="setRotDeg(settings.layers[i - 1], $event.target.value)"
        />
        <b>{{ rotDeg(settings.layers[i - 1]) }}°</b>
        <KeyBtn :path="`layers.${i - 1}.rot`" />
      </label>
      <label class="row">
        <span>Offset X</span>
        <input type="range" min="-1" max="1" step="0.005" v-model.number="settings.layers[i - 1].x" />
        <b>{{ settings.layers[i - 1].x.toFixed(2) }}</b>
        <KeyBtn :path="`layers.${i - 1}.x`" />
      </label>
      <label class="row">
        <span>Offset Y</span>
        <input type="range" min="-1" max="1" step="0.005" v-model.number="settings.layers[i - 1].y" />
        <b>{{ settings.layers[i - 1].y.toFixed(2) }}</b>
        <KeyBtn :path="`layers.${i - 1}.y`" />
      </label>
    </section>

    <section>
      <h2>Capture &amp; Share</h2>
      <button class="wide" @click="$emit('export')">Export PNG</button>
      <button class="wide" :class="{ rec: recState.active }" @click="$emit('record')">
        <template v-if="recState.active">■ Stop recording · {{ recTime }}</template>
        <template v-else>● Record video (WebM)</template>
      </button>
      <button class="wide" @click="copyShare()">
        {{ copiedId === 'current' ? 'Link copied!' : 'Copy share link' }}
      </button>
      <button class="accent wide" @click="$emit('save')">Save to gallery</button>
    </section>

    <section v-if="gallery.length">
      <h2>Gallery</h2>
      <div class="gallery">
        <div v-for="e in gallery" :key="e.id" class="entry">
          <img
            :src="e.thumb"
            :title="'Load — saved ' + new Date(e.date).toLocaleString()"
            @click="loadFromGallery(e)"
          />
          <div class="entry-actions">
            <button :title="copiedId === e.id ? 'Copied!' : 'Copy share link'" @click="copyShare(e)">
              {{ copiedId === e.id ? '✓' : '🔗' }}
            </button>
            <button title="Delete" @click="removeFromGallery(e.id)">✕</button>
          </div>
        </div>
      </div>
    </section>

    <footer>
      Moiré appears when a grating's frequency beats against another grating —
      or against the pixel grid itself. Set anti-alias to
      <em>Off</em> with a high frequency to see sampling moiré; switch to
      <em>Smooth</em> or <em>Supersample</em> to reduce it.
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
  gap: 18px;
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
section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
h2 {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: #6f6f7a;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  color: #c9c9d1;
}
.row > span {
  width: 74px;
  flex: none;
  color: #9a9aa5;
}
.row input[type='range'] {
  flex: 1;
  min-width: 0;
  accent-color: #7c6cf0;
}
.row b {
  width: 42px;
  flex: none;
  text-align: right;
  font-size: 11.5px;
  font-weight: 500;
  color: #d7d7de;
  font-variant-numeric: tabular-nums;
}
select {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  font-size: 12.5px;
  color: #e4e4e9;
  background: #1a1a21;
  border: 1px solid #2c2c36;
  border-radius: 6px;
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
input[type='checkbox'] {
  accent-color: #7c6cf0;
  width: 15px;
  height: 15px;
}
.preset-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.slideshow-row {
  font-size: 11.5px;
  color: #9a9aa5;
}
.slideshow-row .slideshow-btn {
  flex: 1;
}
.slideshow-row input {
  width: 46px;
  padding: 4px 6px;
  font-size: 12px;
  color: #e4e4e9;
  background: #1a1a21;
  border: 1px solid #2c2c36;
  border-radius: 6px;
  font-variant-numeric: tabular-nums;
}
button {
  padding: 7px 8px;
  font-size: 12px;
  color: #d7d7de;
  background: #1a1a21;
  border: 1px solid #2c2c36;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
}
button:hover {
  background: #23232c;
  border-color: #3a3a48;
}
button.accent {
  background: #342e6e;
  border-color: #4c42a3;
  color: #e9e6ff;
}
button.accent:hover {
  background: #3e3784;
}
button.wide {
  width: 100%;
  padding: 9px;
}
button.rec {
  border-color: rgba(255, 92, 92, 0.55);
  color: #ff8a8a;
}
.gallery {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.entry {
  position: relative;
  border: 1px solid #2c2c36;
  border-radius: 7px;
  overflow: hidden;
}
.entry img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  cursor: pointer;
  transition: opacity 0.12s;
}
.entry img:hover {
  opacity: 0.8;
}
.entry-actions {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.12s;
}
.entry:hover .entry-actions {
  opacity: 1;
}
.entry-actions button {
  padding: 2px 6px;
  font-size: 11px;
  background: rgba(12, 12, 16, 0.8);
}
.layer-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.layer-tab {
  padding: 4px 10px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.09em;
}
.layer-tab.active {
  border-color: #7c6cf0;
  color: #cfc8ff;
}
.keybtn {
  flex: none;
  padding: 0 2px;
  font-size: 12px;
  line-height: 1;
  color: #3f3f4c;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.12s;
}
.keybtn:hover {
  color: #a8a2d8;
  background: none;
  border: none;
}
.keybtn.has {
  color: #7c6cf0;
}
.keybtn.on {
  color: #ffd166;
}
.note {
  font-size: 11px;
  font-style: normal;
  color: #75757f;
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
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
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
.err {
  font-size: 11px;
  color: #ff8a8a;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
}
.layer-color {
  width: 26px !important;
  height: 20px !important;
}
.tag {
  font-size: 10px;
  color: #7c6cf0;
  text-transform: none;
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
