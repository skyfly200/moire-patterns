# Moiré Pattern Generator

An interactive web tool for generating moiré interference patterns, built with
**Vue 3** and **Three.js**. The pattern is rendered entirely in a fragment
shader on a fullscreen quad — inspired by the classic
`sin(length(uv) * frequency)` shader (and the discussion of reducing its moiré
artifacts on [r/GraphicsProgramming](https://www.reddit.com/r/GraphicsProgramming/comments/1bg2kgr/reducing_moir%C3%A9_patterns_in_a_simple_fragment/)).

## Features

- **Ten grating types** — rings, lines, grid, spokes, spiral, checker, hex,
  waves, dots, and a **custom GLSL expression** compiled live into the
  shader (with inline error feedback)
- **Up to 8 layers**, each with its own pattern type, combine op, frequency,
  rotation, and center offset
- **Per-layer combine ops** — multiply, difference (XOR-like), average, min,
  max, screen, add, subtract, and **mask**: a mask layer's pattern blends
  the composite of the layers below it against the layers above it, so
  different patterns can be masked together
- **Color modes** — duotone, three-stop gradient, rainbow (hue follows the
  pattern value — richest with the Average blend), and per-layer colors
  screen-composited over the background
- **Anti-aliasing controls** straight from the Reddit thread: point-sampled
  (aliased, maximum moiré), `fwidth()` smoothstep, and 4×/16× supersampling —
  so you can watch sampling moiré appear and disappear
- **Animation** — layers slowly counter-rotate and orbit (the "drift"
  animation, toggleable)
- **Keyframe timeline** — every control has a ◆ button that keyframes it at
  the current timeline position; tracks interpolate with selectable easing
  curves (linear, ease-in, ease-out, ease-in-out, hold), colors blend
  smoothly, discrete options step, and the whole timeline loops, records to
  video, and travels inside share links and gallery saves
- **Blender-style timeline bar** — a dock under the canvas with a time
  ruler, scrubbable playhead, adjustable timeline length, and one lane per
  track: numeric tracks draw their interpolation curve, color tracks show a
  gradient strip, and keyframes are draggable diamonds (right-click or
  double-click to delete); toolbar buttons jump the playhead to the
  previous/next keyframe
- **Direct manipulation** — drag on the canvas to move the active layer's
  center, scroll to zoom
- **Presets + randomizer**, custom colors, and PNG export
- **Save & share** — save favorites to a local gallery (with thumbnails) and
  copy a share link that encodes the full pattern state in the URL
- **Video capture** — record the canvas to a WebM video with one click
- **Full-screen view** — hide the control panel (`H`) or go fullscreen (`F`)
- **Keyboard shortcuts** — `Space`/`A` play/pause (pauses in place, never
  resets), `↑`/`↓` animation speed, `,`/`.` jump to previous/next keyframe,
  `R` randomize, `H` hide UI, `F` fullscreen

## Where the moiré comes from

Two flavors are on display:

1. **Interference moiré** — two gratings with slightly different frequencies
   or rotations multiply/difference into low-frequency beat patterns.
2. **Sampling moiré** — a single grating whose frequency exceeds the pixel
   Nyquist limit aliases against the pixel grid (try the *Aliasing demo*
   preset with anti-alias set to *Off*, then flip it to *Smooth* or
   *Supersample*).

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # production build in dist/
```
