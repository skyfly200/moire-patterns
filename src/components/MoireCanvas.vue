<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import * as THREE from 'three'
import { vertexShader, fragmentShader } from '../shaders/moire.js'
import { settings, MAX_LAYERS } from '../settings.js'

const container = ref(null)
const canvas = ref(null)

let renderer, scene, camera, material, rafId, resizeObserver
let animTime = 0
let lastFrame = 0

const colorA = new THREE.Color()
const colorB = new THREE.Color()

function makeUniforms() {
  return {
    uResolution: { value: new THREE.Vector2(1, 1) },
    uAnimTime: { value: 0 },
    uZoom: { value: 1 },
    uPatternType: { value: 0 },
    uLayerCount: { value: 2 },
    uBlendMode: { value: 0 },
    uAAMode: { value: 0 },
    uThickness: { value: 0.5 },
    uColorA: { value: new THREE.Color('#0b0b0f') },
    uColorB: { value: new THREE.Color('#f5f5f0') },
    uOffset: { value: Array.from({ length: MAX_LAYERS }, () => new THREE.Vector2()) },
    uFreq: { value: new Array(MAX_LAYERS).fill(140) },
    uRot: { value: new Array(MAX_LAYERS).fill(0) },
  }
}

function syncUniforms() {
  const u = material.uniforms
  u.uZoom.value = settings.zoom
  u.uPatternType.value = settings.patternType
  u.uLayerCount.value = settings.layerCount
  u.uBlendMode.value = settings.blendMode
  u.uAAMode.value = settings.aaMode
  u.uThickness.value = settings.thickness
  u.uColorA.value.copy(colorA.set(settings.colorA))
  u.uColorB.value.copy(colorB.set(settings.colorB))
  for (let i = 0; i < MAX_LAYERS; i++) {
    const l = settings.layers[i]
    u.uOffset.value[i].set(l.x, l.y)
    u.uFreq.value[i] = l.freq
    u.uRot.value[i] = l.rot
  }
}

function resize() {
  const w = container.value.clientWidth
  const h = container.value.clientHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  renderer.setPixelRatio(dpr)
  renderer.setSize(w, h, false)
  material.uniforms.uResolution.value.set(w * dpr, h * dpr)
}

function frame(now) {
  rafId = requestAnimationFrame(frame)
  const dt = Math.min((now - lastFrame) / 1000, 0.1)
  lastFrame = now
  if (settings.animate) animTime += dt * settings.animSpeed
  material.uniforms.uAnimTime.value = animTime
  syncUniforms()
  renderer.render(scene, camera)
}

// Drag on the canvas to move the active layer's center.
let dragging = false
let dragStart = null

function planeDelta(e) {
  const rect = canvas.value.getBoundingClientRect()
  // Same mapping as toPlane(): y spans [-zoom, zoom] over the canvas height.
  const scale = (2 * settings.zoom) / rect.height
  return { x: e.clientX * scale, y: -e.clientY * scale }
}

function onPointerDown(e) {
  const l = settings.layers[settings.activeLayer]
  const p = planeDelta(e)
  dragging = true
  dragStart = { px: p.x, py: p.y, lx: l.x, ly: l.y }
  canvas.value.setPointerCapture(e.pointerId)
}

function onPointerMove(e) {
  if (!dragging) return
  const l = settings.layers[settings.activeLayer]
  const p = planeDelta(e)
  l.x = +(dragStart.lx + p.x - dragStart.px).toFixed(4)
  l.y = +(dragStart.ly + p.y - dragStart.py).toFixed(4)
}

function onPointerUp() {
  dragging = false
}

function onWheel(e) {
  e.preventDefault()
  const factor = Math.exp(e.deltaY * 0.001)
  settings.zoom = Math.min(4, Math.max(0.25, settings.zoom * factor))
}

function exportPNG() {
  renderer.render(scene, camera)
  canvas.value.toBlob((blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'moire-pattern.png'
    a.click()
    URL.revokeObjectURL(url)
  })
}

defineExpose({ exportPNG })

onMounted(() => {
  renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: false })
  scene = new THREE.Scene()
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: makeUniforms(),
  })
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material))

  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container.value)
  resize()
  lastFrame = performance.now()
  rafId = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  resizeObserver?.disconnect()
  material?.dispose()
  renderer?.dispose()
})
</script>

<template>
  <div ref="container" class="canvas-wrap">
    <canvas
      ref="canvas"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @wheel="onWheel"
    />
    <div class="hint">drag: move layer {{ settings.activeLayer + 1 }} · scroll: zoom</div>
  </div>
</template>

<style scoped>
.canvas-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: none;
}
canvas:active {
  cursor: grabbing;
}
.hint {
  position: absolute;
  left: 12px;
  bottom: 10px;
  padding: 4px 10px;
  font-size: 11px;
  color: #9a9aa5;
  background: rgba(12, 12, 16, 0.65);
  border: 1px solid #26262e;
  border-radius: 999px;
  pointer-events: none;
  backdrop-filter: blur(4px);
}
</style>
