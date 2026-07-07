<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import MoireCanvas from './components/MoireCanvas.vue'
import ControlPanel from './components/ControlPanel.vue'
import { loadFromHash } from './settings.js'
import { saveToGallery } from './gallery.js'

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
  if (e.key === 'h' || e.key === 'H') panelVisible.value = !panelVisible.value
  if (e.key === 'f' || e.key === 'F') toggleFullscreen()
}

onMounted(() => {
  loadFromHash()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="app">
    <ControlPanel
      v-show="panelVisible"
      @export="canvasRef?.exportPNG()"
      @record="canvasRef?.toggleRecording()"
      @save="saveCurrent"
    />
    <MoireCanvas ref="canvasRef" />
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
  width: 100%;
  height: 100%;
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
