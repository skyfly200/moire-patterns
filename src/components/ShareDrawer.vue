<script setup>
import { ref, computed, nextTick } from 'vue'
import QRCode from 'qrcode'
import { shareURL, encodeSnapshot } from '../settings.js'
import { gallery, loadFromGallery, removeFromGallery } from '../gallery.js'
import { modes, loadMode, removeMode, renameMode } from '../modes.js'
import { recState } from '../recorder.js'

defineEmits(['export', 'record', 'save', 'savemode'])

const copiedId = ref(null)
let copiedTimer = null

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    window.prompt('Copy this link:', text)
  }
}

async function copyShare(snap = null, id = 'current') {
  const url = snap ? shareURL(snap) : shareURL()
  if (id === 'current') history.replaceState(null, '', '#s=' + encodeSnapshot())
  await copyText(url)
  copiedId.value = id
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copiedId.value = null), 1500)
}

const qrVisible = ref(false)
const qrCanvas = ref(null)

async function toggleQR() {
  qrVisible.value = !qrVisible.value
  if (!qrVisible.value) return
  await nextTick()
  const url = shareURL()
  history.replaceState(null, '', '#s=' + encodeSnapshot())
  QRCode.toCanvas(qrCanvas.value, url, {
    width: 232,
    margin: 2,
    color: { dark: '#0b0b0f', light: '#f5f5f0' },
  })
}

const recTime = computed(() => {
  const m = Math.floor(recState.seconds / 60)
  const s = String(recState.seconds % 60).padStart(2, '0')
  return `${m}:${s}`
})

function rename(m) {
  const name = window.prompt('Rename mode:', m.name)
  if (name !== null) renameMode(m.id, name)
}
</script>

<template>
  <aside class="drawer">
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
      <button class="wide" @click="toggleQR">
        {{ qrVisible ? 'Hide QR code' : 'QR code' }}
      </button>
      <div v-if="qrVisible" class="qr-box">
        <canvas ref="qrCanvas" />
        <p class="note">Scan to open this exact pattern</p>
      </div>
      <button class="accent wide" @click="$emit('save')">Save to gallery</button>
      <button class="accent wide" @click="$emit('savemode')">Save mode…</button>
    </section>

    <section v-if="modes.length">
      <h2>Modes</h2>
      <p class="note">Full setups incl. mappings &amp; timeline — keys 1–9 load them</p>
      <div v-for="(m, i) in modes" :key="m.id" class="mode-row">
        <img
          v-if="m.thumb" :src="m.thumb" class="mode-thumb"
          :title="'Load — saved ' + new Date(m.date).toLocaleString()"
          @click="loadMode(m)"
        />
        <span class="mode-name" title="Click to load · double-click to rename"
          @click="loadMode(m)" @dblclick="rename(m)">
          {{ m.name }}
        </span>
        <span v-if="i < 9" class="mode-key">{{ i + 1 }}</span>
        <button :title="copiedId === m.id ? 'Copied!' : 'Copy share link'" @click="copyShare(m.snap, m.id)">
          {{ copiedId === m.id ? '✓' : '🔗' }}
        </button>
        <button title="Delete" @click="removeMode(m.id)">✕</button>
      </div>
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
            <button :title="copiedId === e.id ? 'Copied!' : 'Copy share link'" @click="copyShare(e.snap, e.id)">
              {{ copiedId === e.id ? '✓' : '🔗' }}
            </button>
            <button title="Delete" @click="removeFromGallery(e.id)">✕</button>
          </div>
        </div>
      </div>
    </section>

    <p v-if="!gallery.length && !modes.length" class="note empty">
      Save patterns to the gallery (G) or full modes (M) and they'll appear
      here. Modes 1–9 load from the number keys.
    </p>
  </aside>
</template>

<style scoped>
.drawer {
  width: 264px;
  flex: none;
  overflow-y: auto;
  padding: 18px 14px 24px;
  background: #101014;
  border-left: 1px solid #212129;
  display: flex;
  flex-direction: column;
  gap: 18px;
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
.qr-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px;
  background: #16161c;
  border: 1px solid #24242d;
  border-radius: 8px;
}
.qr-box canvas {
  border-radius: 4px;
  max-width: 100%;
}
.note {
  font-size: 11px;
  line-height: 1.5;
  color: #75757f;
}
.empty {
  border-top: 1px solid #212129;
  padding-top: 12px;
}
.mode-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.mode-thumb {
  width: 44px;
  height: 28px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #2c2c36;
  cursor: pointer;
  flex: none;
}
.mode-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: #c9c9d1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}
.mode-name:hover {
  color: #e9e6ff;
}
.mode-key {
  flex: none;
  min-width: 16px;
  text-align: center;
  font-size: 10px;
  color: #8f86d8;
  border: 1px solid #35314f;
  border-radius: 4px;
  padding: 0 3px;
}
.mode-row button {
  flex: none;
  padding: 2px 6px;
  font-size: 11px;
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
</style>
