<script setup>
import { ref, computed, nextTick } from 'vue'
import QRCode from 'qrcode'
import { shareURL, encodeSnapshot } from '../settings.js'
import {
  gallery,
  collections,
  galleryView,
  loadFromGallery,
  removeFromGallery,
  createCollection,
  deleteCollection,
  renameCollection,
  setEntryCollection,
} from '../gallery.js'
import { modes, loadMode, removeMode, renameMode } from '../modes.js'
import { recState } from '../recorder.js'
import {
  mdiImage, mdiRecordCircle, mdiStop, mdiLinkVariant, mdiQrcode,
  mdiContentSave, mdiTune, mdiCog, mdiPlus, mdiCheck, mdiClose,
} from '@mdi/js'

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

const filteredGallery = computed(() => {
  if (galleryView.filter === 'all') return gallery
  if (galleryView.filter === 'uncat') return gallery.filter((e) => !e.collection)
  return gallery.filter((e) => e.collection === galleryView.filter)
})

function newCollection() {
  const name = window.prompt('New collection name:')
  if (name && name.trim()) galleryView.filter = createCollection(name)
}

function onEntryCollection(e, value) {
  if (value === '__new') {
    const name = window.prompt('New collection name:')
    if (name && name.trim()) setEntryCollection(e.id, createCollection(name))
    return
  }
  setEntryCollection(e.id, value)
}

function editCollection() {
  const cur = galleryView.filter
  if (cur === 'all' || cur === 'uncat') return
  const action = window.prompt(
    `Collection "${cur}" — type a new name to rename, or "delete" to remove it (entries move to Uncategorized):`,
    cur,
  )
  if (action === null) return
  if (action.trim().toLowerCase() === 'delete') deleteCollection(cur)
  else renameCollection(cur, action)
}
</script>

<template>
  <aside class="drawer">
    <section>
      <h2>Capture &amp; Share</h2>
      <v-btn block variant="tonal" class="tt-none mb-2" :prepend-icon="mdiImage" @click="$emit('export')">Export PNG</v-btn>
      <v-btn
        block variant="tonal" class="tt-none mb-2"
        :color="recState.active ? 'error' : undefined"
        :prepend-icon="recState.active ? mdiStop : mdiRecordCircle"
        @click="$emit('record')"
      >{{ recState.active ? 'Stop recording · ' + recTime : 'Record video (WebM)' }}</v-btn>
      <v-btn block variant="tonal" class="tt-none mb-2" :prepend-icon="mdiLinkVariant" @click="copyShare()">
        {{ copiedId === 'current' ? 'Link copied!' : 'Copy share link' }}
      </v-btn>
      <v-btn block variant="tonal" class="tt-none mb-2" :prepend-icon="mdiQrcode" @click="toggleQR">
        {{ qrVisible ? 'Hide QR code' : 'QR code' }}
      </v-btn>
      <div v-if="qrVisible" class="qr-box">
        <canvas ref="qrCanvas" />
        <p class="note">Scan to open this exact pattern</p>
      </div>
      <v-btn block variant="flat" color="primary" class="tt-none mb-2" :prepend-icon="mdiContentSave" @click="$emit('save')">Save to gallery</v-btn>
      <v-btn block variant="flat" color="primary" class="tt-none" :prepend-icon="mdiTune" @click="$emit('savemode')">Save mode…</v-btn>
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
        <v-btn
          :icon="copiedId === m.id ? mdiCheck : mdiLinkVariant" size="x-small" variant="text"
          :title="copiedId === m.id ? 'Copied!' : 'Copy share link'" @click="copyShare(m.snap, m.id)"
        />
        <v-btn :icon="mdiClose" size="x-small" variant="text" title="Delete" @click="removeMode(m.id)" />
      </div>
    </section>

    <section v-if="gallery.length">
      <div class="gallery-head">
        <h2>Gallery</h2>
        <v-btn
          v-if="galleryView.filter !== 'all' && galleryView.filter !== 'uncat'"
          :icon="mdiCog" size="x-small" variant="text"
          title="Rename or delete this collection" @click="editCollection()"
        />
      </div>
      <div class="col-tabs">
        <v-chip-group v-model="galleryView.filter" mandatory selected-class="chip-active" class="chips">
          <v-chip value="all" size="x-small" label>All</v-chip>
          <v-chip v-for="c in collections" :key="c" :value="c" size="x-small" label>{{ c }}</v-chip>
          <v-chip value="uncat" size="x-small" label>Uncategorized</v-chip>
        </v-chip-group>
        <v-btn :icon="mdiPlus" size="x-small" variant="tonal" title="New collection" @click="newCollection()" />
      </div>
      <div v-if="filteredGallery.length" class="gallery">
        <div v-for="e in filteredGallery" :key="e.id" class="entry">
          <img
            :src="e.thumb"
            :title="'Load — saved ' + new Date(e.date).toLocaleString()"
            @click="loadFromGallery(e)"
          />
          <div class="entry-actions">
            <v-btn
              :icon="copiedId === e.id ? mdiCheck : mdiLinkVariant" size="x-small" variant="flat"
              class="entry-act-btn" :title="copiedId === e.id ? 'Copied!' : 'Copy share link'"
              @click="copyShare(e.snap, e.id)"
            />
            <v-btn
              :icon="mdiClose" size="x-small" variant="flat" class="entry-act-btn"
              title="Delete" @click="removeFromGallery(e.id)"
            />
          </div>
          <select
            class="entry-col" title="Collection"
            :value="e.collection || ''"
            @change="onEntryCollection(e, $event.target.value)"
          >
            <option value="">Uncategorized</option>
            <option v-for="c in collections" :key="c" :value="c">{{ c }}</option>
            <option value="__new">+ New…</option>
          </select>
        </div>
      </div>
      <p v-else class="note">Nothing in this collection yet.</p>
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
.tt-none :deep(.v-btn__content) {
  text-transform: none;
  letter-spacing: normal;
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
.gallery-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.gallery-head h2 {
  flex: 1;
}
.col-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
}
.col-tabs .chips {
  flex: 1;
  min-width: 0;
}
.col-tabs :deep(.v-chip) {
  font-size: 10.5px;
}
.col-tabs :deep(.v-chip.chip-active) {
  color: #cfc8ff;
  border-color: #7c6cf0;
  background: #241f45;
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
.entry-col {
  display: block;
  width: 100%;
  padding: 2px 4px;
  font-size: 10px;
  color: #b6b6c0;
  background: #16161c;
  border: none;
  border-top: 1px solid #24242d;
  cursor: pointer;
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
.entry-act-btn {
  background: rgba(12, 12, 16, 0.8) !important;
}
</style>
