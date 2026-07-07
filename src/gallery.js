import { reactive } from 'vue'
import { snapshot, applySnapshot } from './settings.js'

const KEY = 'moire-gallery-v1'
const MAX_ENTRIES = 24

function load() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(gallery))
  } catch {
    // Storage full or unavailable — the in-memory gallery still works.
  }
}

export const gallery = reactive(load())

export function saveToGallery(thumb) {
  gallery.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    date: new Date().toISOString(),
    thumb,
    snap: snapshot(),
  })
  if (gallery.length > MAX_ENTRIES) gallery.length = MAX_ENTRIES
  persist()
}

export function loadFromGallery(entry) {
  applySnapshot(entry.snap)
}

export function removeFromGallery(id) {
  const i = gallery.findIndex((e) => e.id === id)
  if (i >= 0) {
    gallery.splice(i, 1)
    persist()
  }
}
