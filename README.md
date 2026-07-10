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
  different patterns can be masked together; multiple masks chain into
  multiple regions
- **Shape masks** — SDF-based shape fills (circle, square, triangle, star,
  hexagon, or a **custom signed-distance expression**) usable as any layer,
  and most powerfully as masks: put a shape layer on Mask to show one
  pattern inside the shape and another outside (see the *Circle window*
  and *Star window* presets); shapes are positioned/rotated/sized with the
  regular layer controls and can be dragged on the canvas
- **Color modes** — duotone, three-stop gradient, rainbow (hue follows the
  pattern value — richest with the Average blend), and per-layer colors
  screen-composited over the background
- **Anti-aliasing controls** straight from the Reddit thread: point-sampled
  (aliased, maximum moiré), `fwidth()` smoothstep, and 4×/16× supersampling —
  so you can watch sampling moiré appear and disappear
- **Performance options** — an FPS counter overlay and a render-resolution
  scale (auto/100%/75%/50%) for smoother motion on slower GPUs
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
- **Display view** (`S`, exit with `Esc`) — hide the UI and auto-play with
  only the art on screen (the stop control appears on hover): **Gallery**
  rotates through your saved gallery (or the built-in presets while the
  gallery is empty), **Shuffle** jumps to fully random settings every
  interval, **Morph** smoothly eases frequencies, rotations, offsets, zoom,
  line width, and colors toward new random targets for a continuous fade,
  and **Shuffle + Morph** re-rolls pattern types and combine ops each cycle
  while everything else fades smoothly
- **Video capture** — record the canvas to a WebM video with one click
- **Full-screen view** — hide the control panel (`H`) or go fullscreen (`F`)
- **Live input modulation** — map real-time sources onto any numeric
  setting with per-mapping range and smoothing, applied every frame:
  - **Audio reactive**: microphone level plus bass / mid / treble bands
    (Web Audio API), **beat detection** with a live BPM readout, a
    mappable beat-pulse source, and on-beat triggers (randomize the
    pattern, shuffle colors, or advance the display slide every Nth beat)
  - **MIDI**: any CC from a connected controller, with click-and-twist
    MIDI learn (Web MIDI API — Chrome/Edge)
  - **Leap Motion**: palm X/Y/Z, pinch, grab, and palm roll via the
    Ultraleap tracking service WebSocket (run the Leap service locally)
  - **Art-Net / DMX**: 16 channels via a bundled WebSocket bridge —
    `node tools/artnet-bridge.mjs` relays UDP 6454 to the app
  An **Auto-map** button wires sensible defaults for every enabled input,
  and higher smoothing values give multi-second glides. Mappings travel in
  share links, gallery saves, and modes; input devices re-enable per session.
- **Modes** — save the entire setup (all settings, custom expressions,
  timeline, input mappings, beat triggers, display config) under a name in
  a right-side drawer; keys 1–9 load the first nine live. The drawer also
  hosts capture, share links, and a **QR code** of the current pattern.
- **Gallery collections** — organize saved patterns into named collections,
  filter the gallery by collection tab, and reassign entries from each tile.
- **Randomize history** — `↶`/`↷` buttons (and `Z` / `Shift+Z`) step back and
  forward through randomizes, so a great pattern skipped by accident is
  recoverable.
- **Keyboard shortcuts** — `Space`/`A` play/pause (pauses in place, never
  resets), `↑`/`↓` animation speed, `,`/`.` jump to previous/next keyframe,
  `R` randomize, `Z`/`Shift+Z` randomize back/forward, `G` save to gallery,
  `M` save mode, `1`–`9` load modes, `S` display view, `Esc` exit it,
  `H` hide UI, `F` fullscreen

## ⚠️ Photosensitivity

These patterns can flash and strobe, and may trigger seizures in people
with photosensitive epilepsy — including people with no prior history.
The app shows a seizure warning on first launch, **always starts with
animation paused**, and never enables animation on its own (loading a
share link or running the slideshow keeps your play/pause choice). We
advise photosensitive users not to enable the animated or slideshow
modes.

## Where the moiré comes from

Two flavors are on display:

1. **Interference moiré** — two gratings with slightly different frequencies
   or rotations multiply/difference into low-frequency beat patterns.
2. **Sampling moiré** — a single grating whose frequency exceeds the pixel
   Nyquist limit aliases against the pixel grid (try the *Aliasing demo*
   preset with anti-alias set to *Off*, then flip it to *Smooth* or
   *Supersample*).

## Mobile

On phones and narrow screens the canvas goes full-bleed and the control
panel and share drawer become slide-over sheets, opened from a bottom
toolbar (Controls · Random · Play · Timeline · Share · Fullscreen). The
keyframe timeline is hidden by default and slides up as a bottom sheet
from the Timeline button. Pinch to zoom, drag to move the active layer.
The desktop three-column layout is unchanged above 768px.

## Development

```bash
npm install
npm run dev      # start dev server
npm run build    # production build in dist/
```
