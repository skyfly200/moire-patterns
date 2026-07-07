<script setup>
import { ref, computed } from 'vue'
import {
  settings,
  PRESETS,
  PATTERN_TYPES,
  BLEND_MODES,
  AA_MODES,
  COLOR_MODES,
  applyPreset,
  randomize,
  shareURL,
  encodeSnapshot,
} from '../settings.js'
import { gallery, loadFromGallery, removeFromGallery } from '../gallery.js'
import { recState } from '../recorder.js'

defineEmits(['export', 'record', 'save'])

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
    </section>

    <section>
      <h2>Pattern</h2>
      <label class="row">
        <span>Type</span>
        <select v-model.number="settings.patternType">
          <option v-for="t in PATTERN_TYPES" :key="t.value" :value="t.value">
            {{ t.label }}
          </option>
        </select>
      </label>
      <label class="row">
        <span>Blend</span>
        <select v-model.number="settings.blendMode">
          <option v-for="b in BLEND_MODES" :key="b.value" :value="b.value">
            {{ b.label }}
          </option>
        </select>
      </label>
      <label class="row">
        <span>Anti-alias</span>
        <select v-model.number="settings.aaMode">
          <option v-for="m in AA_MODES" :key="m.value" :value="m.value">
            {{ m.label }}
          </option>
        </select>
      </label>
      <label class="row">
        <span>Layers</span>
        <input type="range" min="1" max="4" step="1" v-model.number="settings.layerCount" />
        <b>{{ settings.layerCount }}</b>
      </label>
      <label class="row">
        <span>Zoom</span>
        <input type="range" min="0.25" max="4" step="0.01" v-model.number="settings.zoom" />
        <b>{{ settings.zoom.toFixed(2) }}</b>
      </label>
      <label class="row">
        <span>Line width</span>
        <input type="range" min="0.05" max="0.95" step="0.01" v-model.number="settings.thickness" />
        <b>{{ settings.thickness.toFixed(2) }}</b>
      </label>
      <label class="row">
        <span>Color mode</span>
        <select v-model.number="settings.colorMode">
          <option v-for="c in COLOR_MODES" :key="c.value" :value="c.value">
            {{ c.label }}
          </option>
        </select>
      </label>
      <div class="row colors">
        <span>Colors</span>
        <input type="color" v-model="settings.colorA" title="Background" />
        <input
          v-if="settings.colorMode === 0 || settings.colorMode === 1"
          type="color" v-model="settings.colorB"
          :title="settings.colorMode === 1 ? 'Gradient middle' : 'Foreground'"
        />
        <input
          v-if="settings.colorMode === 1"
          type="color" v-model="settings.colorC" title="Gradient end"
        />
        <em v-if="settings.colorMode === 2" class="note">hue follows pattern</em>
        <em v-if="settings.colorMode === 3" class="note">set per layer below</em>
      </div>
    </section>

    <section>
      <h2>Animation</h2>
      <label class="row">
        <span>Animate</span>
        <input type="checkbox" v-model="settings.animate" />
      </label>
      <label class="row">
        <span>Speed</span>
        <input type="range" min="0.1" max="4" step="0.1" v-model.number="settings.animSpeed" />
        <b>{{ settings.animSpeed.toFixed(1) }}×</b>
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
        <input
          v-if="settings.colorMode === 3"
          type="color" v-model="settings.layers[i - 1].color"
          class="layer-color" title="Layer color"
        />
        <span v-if="settings.activeLayer === i - 1" class="tag">drag target</span>
      </h2>
      <label class="row">
        <span>Frequency</span>
        <input type="range" min="5" max="1000" step="1" v-model.number="settings.layers[i - 1].freq" />
        <b>{{ Math.round(settings.layers[i - 1].freq) }}</b>
      </label>
      <label class="row">
        <span>Rotation</span>
        <input
          type="range" min="-180" max="180" step="1"
          :value="rotDeg(settings.layers[i - 1])"
          @input="setRotDeg(settings.layers[i - 1], $event.target.value)"
        />
        <b>{{ rotDeg(settings.layers[i - 1]) }}°</b>
      </label>
      <label class="row">
        <span>Offset X</span>
        <input type="range" min="-1" max="1" step="0.005" v-model.number="settings.layers[i - 1].x" />
        <b>{{ settings.layers[i - 1].x.toFixed(2) }}</b>
      </label>
      <label class="row">
        <span>Offset Y</span>
        <input type="range" min="-1" max="1" step="0.005" v-model.number="settings.layers[i - 1].y" />
        <b>{{ settings.layers[i - 1].y.toFixed(2) }}</b>
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
.note {
  font-size: 11px;
  font-style: normal;
  color: #75757f;
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
