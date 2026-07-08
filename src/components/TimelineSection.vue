<script setup>
import { timeline, EASINGS, applyTimeline, removeTrack, trackLabel, hasKeyNear } from '../timeline.js'

function scrub() {
  applyTimeline(timeline.time)
}

function jumpTo(t) {
  timeline.time = t
  applyTimeline(t)
}
</script>

<template>
  <section>
    <h2>Timeline</h2>
    <label class="row">
      <span>Duration</span>
      <input
        type="range" min="1" max="60" step="0.5"
        v-model.number="timeline.duration"
      />
      <b>{{ timeline.duration }}s</b>
    </label>
    <label class="row">
      <span>Position</span>
      <input
        type="range" min="0" :max="timeline.duration" step="0.01"
        v-model.number="timeline.time" @input="scrub"
      />
      <b>{{ timeline.time.toFixed(1) }}s</b>
    </label>
    <p v-if="!timeline.tracks.length" class="empty">
      Click the ◆ next to any control to keyframe it at the current position.
      Add two or more keyframes and press play.
    </p>
    <div v-for="tr in timeline.tracks" :key="tr.path" class="track">
      <div class="track-head">
        <span class="track-name">{{ trackLabel(tr.path) }}</span>
        <select v-model="tr.easing" title="Easing curve between keyframes">
          <option v-for="e in EASINGS" :key="e" :value="e">{{ e }}</option>
        </select>
        <button class="track-del" title="Delete track" @click="removeTrack(tr.path)">✕</button>
      </div>
      <div class="keys">
        <button
          v-for="k in tr.keys"
          :key="k.t"
          class="key-chip"
          :class="{ on: hasKeyNear(tr.path, timeline.time) && Math.abs(k.t - timeline.time) < 0.051 }"
          title="Jump to keyframe (use ◆ on the control to remove it)"
          @click="jumpTo(k.t)"
        >
          ◆ {{ k.t.toFixed(1) }}s
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
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
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  color: #c9c9d1;
}
.row > span {
  width: 74px;
  flex: none;
  color: #9a9aa5;
}
.row input[type='range'] {
  flex: 1;
  min-width: 0;
  accent-color: #7c6cf0;
}
.row b {
  width: 42px;
  flex: none;
  text-align: right;
  font-size: 11.5px;
  font-weight: 500;
  color: #d7d7de;
  font-variant-numeric: tabular-nums;
}
.empty {
  font-size: 11px;
  line-height: 1.5;
  color: #75757f;
}
.track {
  padding: 7px 8px;
  background: #16161c;
  border: 1px solid #24242d;
  border-radius: 7px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.track-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.track-name {
  flex: 1;
  font-size: 12px;
  color: #c9c9d1;
}
.track-head select {
  padding: 2px 4px;
  font-size: 11px;
  color: #b6b6c0;
  background: #1a1a21;
  border: 1px solid #2c2c36;
  border-radius: 5px;
}
.track-del {
  padding: 1px 6px;
  font-size: 11px;
  color: #9a9aa5;
  background: none;
  border: 1px solid #2c2c36;
  border-radius: 5px;
  cursor: pointer;
}
.track-del:hover {
  color: #ff8a8a;
  border-color: rgba(255, 92, 92, 0.5);
}
.keys {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.key-chip {
  padding: 2px 7px;
  font-size: 10.5px;
  color: #a8a2d8;
  background: #1c1b28;
  border: 1px solid #35314f;
  border-radius: 999px;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}
.key-chip:hover {
  border-color: #7c6cf0;
}
.key-chip.on {
  color: #e9e6ff;
  background: #342e6e;
  border-color: #7c6cf0;
}
</style>
