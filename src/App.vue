<script setup>
import { ref } from 'vue'
import MoireCanvas from './components/MoireCanvas.vue'
import ControlPanel from './components/ControlPanel.vue'

const canvasRef = ref(null)
</script>

<template>
  <div class="app">
    <ControlPanel @export="canvasRef?.exportPNG()" />
    <MoireCanvas ref="canvasRef" />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  width: 100%;
  height: 100%;
}
</style>
