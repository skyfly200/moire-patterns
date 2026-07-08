<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import MoireCanvas from './components/MoireCanvas.vue'
import ControlPanel from './components/ControlPanel.vue'
import TimelineBar from './components/TimelineBar.vue'
import { settings, loadFromHash, randomize } from './settings.js'
import { saveToGallery } from './gallery.js'
import { jumpToKey } from './timeline.js'

const canvasRef = ref(null)
const panelVisible = ref(true)

function saveCurrent() {
  const thumb = canvasRef.value?.captureThumb()
  if (thumb) saveToGallery(thumb)
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen()
  else document.documentElement.requestFullscreen()
}

function onKey(e) {
  if (e.target.closest('input, select, textarea')) return
  const key = e.key.toLowerCase()
  if (key === 'h') panelVisible.value = !panelVisible.value
  else if (key === 'f') toggleFullscreen()
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
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="app">
    <div class="main">
      <ControlPanel
        v-show="panelVisible"
        @export="canvasRef?.exportPNG()"
        @record="canvasRef?.toggleRecording()"
        @save="saveCurrent"
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
