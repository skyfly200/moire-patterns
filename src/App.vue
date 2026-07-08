<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import MoireCanvas from './components/MoireCanvas.vue'
import ControlPanel from './components/ControlPanel.vue'
import TimelineBar from './components/TimelineBar.vue'
import { settings, loadFromHash, randomize } from './settings.js'
import { saveToGallery } from './gallery.js'
import { jumpToKey } from './timeline.js'
import { slideshow, startSlideshow, stopSlideshow } from './slideshow.js'

const canvasRef = ref(null)
const panelVisible = ref(true)

const WARN_KEY = 'moire-epilepsy-ack'
const showWarning = ref(!localStorage.getItem(WARN_KEY))

function acknowledgeWarning() {
  try {
    localStorage.setItem(WARN_KEY, '1')
  } catch {
    // Private browsing — the warning will just show again next visit.
  }
  showWarning.value = false
}

function saveCurrent() {
  const thumb = canvasRef.value?.captureThumb()
  if (thumb) saveToGallery(thumb)
}

function toggleSlideshow() {
  if (slideshow.active) {
    stopSlideshow()
    panelVisible.value = true
  } else {
    startSlideshow()
    panelVisible.value = false
  }
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen()
  else document.documentElement.requestFullscreen()
}

function onKey(e) {
  if (showWarning.value) return
  if (e.target.closest('input, select, textarea')) return
  const key = e.key.toLowerCase()
  if (key === 'h') panelVisible.value = !panelVisible.value
  else if (key === 'f') toggleFullscreen()
  else if (key === 's') toggleSlideshow()
  else if (key === 'r') randomize()
  else if (key === ' ' || key === 'a') {
    // Space on a focused button should click the button, not toggle playback.
    if (key === ' ' && e.target.closest('button')) return
    e.preventDefault()
    settings.animate = !settings.animate
  } else if (key === ',') jumpToKey(-1)
  else if (key === '.') jumpToKey(1)
  else if (key === 'arrowup' || key === 'arrowdown') {
    e.preventDefault()
    const delta = key === 'arrowup' ? 0.1 : -0.1
    settings.animSpeed = +Math.min(4, Math.max(0.1, settings.animSpeed + delta)).toFixed(1)
  }
}

onMounted(() => {
  loadFromHash()
  // Always start paused, even when a share link was saved mid-animation.
  settings.animate = false
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="app" :class="{ clean: !panelVisible }">
    <div class="main">
      <ControlPanel
        v-show="panelVisible"
        @export="canvasRef?.exportPNG()"
        @record="canvasRef?.toggleRecording()"
        @save="saveCurrent"
        @slideshow="toggleSlideshow"
      />
      <MoireCanvas ref="canvasRef" />
    </div>
    <TimelineBar v-show="panelVisible" />
    <div class="view-buttons">
      <button @click="panelVisible = !panelVisible">
        {{ panelVisible ? 'Hide UI' : 'Show UI' }}
      </button>
      <button @click="toggleFullscreen">Fullscreen</button>
    </div>
    <button v-if="slideshow.active" class="slideshow-badge" @click="toggleSlideshow">
      ■ stop slideshow
    </button>
    <div v-if="showWarning" class="warn-backdrop">
      <div class="warn-dialog" role="alertdialog" aria-labelledby="warn-title">
        <h2 id="warn-title">⚠️ Seizure warning — photosensitive epilepsy</h2>
        <p>
          This tool produces high-contrast interference patterns that can
          <strong>flash, strobe, and shift rapidly</strong>. Content like
          this <strong>can trigger seizures</strong> in people with
          photosensitive epilepsy — including people who have
          <strong>never had a seizure before</strong>.
        </p>
        <p>
          <strong>Animation is paused by default and we advise against
          enabling it</strong> if you or anyone watching has epilepsy, a
          history of seizures, or is unsure of their sensitivity. The
          animated and slideshow modes substantially increase the risk.
        </p>
        <p>
          Stop using this tool immediately and seek medical advice if you
          experience dizziness, altered vision, eye or muscle twitching,
          disorientation, or any involuntary movement.
        </p>
        <button class="warn-ok" @click="acknowledgeWarning">
          I understand the risk
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}
.main {
  display: flex;
  flex: 1;
  min-height: 0;
}
.view-buttons {
  position: fixed;
  top: 10px;
  right: 12px;
  display: flex;
  gap: 6px;
  transition: opacity 0.25s;
}

/* Clean display mode: with the UI hidden, the remaining overlays are
   invisible until hovered. */
.app.clean .view-buttons {
  opacity: 0;
  padding: 10px 12px;
  margin: -10px -12px;
}
.app.clean .view-buttons:hover,
.app.clean .view-buttons:focus-within {
  opacity: 1;
}
.app.clean :deep(.hint) {
  opacity: 0;
  pointer-events: auto;
  transition: opacity 0.25s;
}
.app.clean :deep(.hint:hover) {
  opacity: 1;
}
.slideshow-badge {
  position: fixed;
  bottom: 12px;
  right: 12px;
  z-index: 50;
  padding: 5px 12px;
  font-size: 11.5px;
  color: #c9c9d1;
  background: rgba(12, 12, 16, 0.65);
  border: 1px solid #26262e;
  border-radius: 999px;
  cursor: pointer;
  backdrop-filter: blur(4px);
  opacity: 0.4;
  transition: opacity 0.25s;
}
.slideshow-badge:hover {
  opacity: 1;
}
.warn-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(5, 5, 8, 0.82);
  backdrop-filter: blur(6px);
}
.warn-dialog {
  max-width: 460px;
  padding: 26px 28px;
  background: #14141a;
  border: 1px solid #35314f;
  border-radius: 12px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
}
.warn-dialog h2 {
  font-size: 16px;
  font-weight: 650;
  color: #ffd166;
  margin-bottom: 12px;
}
.warn-dialog p {
  font-size: 13px;
  line-height: 1.6;
  color: #c9c9d1;
  margin-bottom: 12px;
}
.warn-dialog strong {
  color: #e4e4e9;
}
.warn-ok {
  width: 100%;
  margin-top: 4px;
  padding: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #e9e6ff;
  background: #342e6e;
  border: 1px solid #4c42a3;
  border-radius: 8px;
  cursor: pointer;
}
.warn-ok:hover {
  background: #3e3784;
}
.view-buttons button {
  padding: 5px 12px;
  font-size: 11.5px;
  color: #c9c9d1;
  background: rgba(12, 12, 16, 0.65);
  border: 1px solid #26262e;
  border-radius: 999px;
  cursor: pointer;
  backdrop-filter: blur(4px);
  transition: background 0.12s, border-color 0.12s;
}
.view-buttons button:hover {
  background: rgba(35, 35, 44, 0.85);
  border-color: #3a3a48;
}
</style>
