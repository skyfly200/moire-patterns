import { reactive, watch } from 'vue'
import { gallery, loadFromGallery } from './gallery.js'
import { settings, PRESETS, applyPreset } from './settings.js'

// Slideshow mode: cycles through the saved gallery (or the built-in presets
// when the gallery has fewer than two entries), animating each slide.

export const slideshow = reactive({
  active: false,
  interval: 8, // seconds per slide
  index: 0,
})

let timer = null

function items() {
  return gallery.length >= 2 ? gallery : PRESETS
}

function advance() {
  const list = items()
  if (!list.length) return
  slideshow.index = slideshow.index % list.length
  const item = list[slideshow.index]
  if (item.snap) loadFromGallery(item)
  else applyPreset(item)
  settings.animate = true
  slideshow.index++
}

export function startSlideshow() {
  if (slideshow.active) return
  slideshow.active = true
  slideshow.index = 0
  advance()
  timer = setInterval(advance, slideshow.interval * 1000)
}

export function stopSlideshow() {
  if (!slideshow.active) return
  slideshow.active = false
  clearInterval(timer)
  timer = null
}

watch(
  () => slideshow.interval,
  () => {
    if (timer) {
      clearInterval(timer)
      timer = setInterval(advance, slideshow.interval * 1000)
    }
  },
)
