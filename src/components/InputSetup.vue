<script setup>
import { modState, rescanMIDI, MIDI_PROFILES, applyMidiProfile } from '../modulation.js'

const props = defineProps({ which: { type: String, required: true } }) // 'midi' | 'artnet'
defineEmits(['close'])
</script>

<template>
  <div class="setup-backdrop" @click.self="$emit('close')">
    <div class="setup" role="dialog">
      <header>
        <h2>{{ which === 'midi' ? 'MIDI setup' : 'Art-Net / DMX setup' }}</h2>
        <button class="x" @click="$emit('close')">✕</button>
      </header>

      <template v-if="which === 'midi'">
        <p class="lead">
          Connect a USB or Bluetooth MIDI controller, then it should appear
          below. Knobs and faders send Control-Change messages you can map or
          MIDI-learn.
        </p>
        <div class="devices">
          <div v-if="!modState.midi.devices.length" class="empty">
            No MIDI inputs detected.
          </div>
          <div v-for="(d, i) in modState.midi.devices" :key="i" class="device">
            <span class="dot" :class="{ on: d.state === 'connected' }" />
            <span class="dname">{{ d.name }}</span>
            <span class="dstate">{{ d.state }}</span>
          </div>
        </div>
        <p v-if="modState.midi.error" class="err">{{ modState.midi.error }}</p>
        <ul class="tips">
          <li>Web MIDI works in <b>Chrome</b> and <b>Edge</b> (not Firefox/Safari).</li>
          <li>On a deployed site it requires <b>https</b> and a permission prompt — allow it.</li>
          <li>Plug the device in <b>before</b> or after — hot-plug is detected. If not, hit Rescan.</li>
          <li>Move a knob to confirm data arrives (the last CC lights the mapping's Learn).</li>
        </ul>
        <div class="profiles">
          <span class="plabel">Controller profile</span>
          <p class="pnote">
            Loads a ready-made control map. Every binding is still
            MIDI-learnable in the panel if your controller differs.
          </p>
          <button
            v-for="p in MIDI_PROFILES" :key="p.value"
            class="profile-btn"
            @click="applyMidiProfile(p.value)"
          >Load {{ p.label }}</button>
        </div>
        <div class="actions">
          <button class="accent" @click="rescanMIDI()">Rescan devices</button>
        </div>
      </template>

      <template v-else>
        <p class="lead">
          Browsers can't receive UDP, so Art-Net comes in through a tiny
          bridge you run on this machine. It relays Art-Net (UDP 6454) to the
          app over a local WebSocket.
        </p>
        <ol class="steps">
          <li>In a terminal at the project folder, run <code>npm install</code> once.</li>
          <li>Start the bridge: <code>node tools/artnet-bridge.mjs</code></li>
          <li>Point your lighting console / Art-Net source at this computer's IP, universe 0.</li>
          <li>Channels 1–16 become mappable sources (<code>Art-Net · ch N</code>).</li>
        </ol>
        <p class="status">
          Bridge:
          <b :class="{ ok: modState.artnet.connected }">
            {{ modState.artnet.connected ? 'connected' : 'not connected' }}
          </b>
          <span v-if="modState.artnet.enabled && !modState.artnet.connected"> — retrying every 3 s…</span>
        </p>
        <p v-if="modState.artnet.error" class="err">{{ modState.artnet.error }}</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.setup-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(5, 5, 8, 0.8);
  backdrop-filter: blur(6px);
}
.setup {
  width: 100%;
  max-width: 460px;
  max-height: 84vh;
  overflow-y: auto;
  padding: 20px 22px 22px;
  background: #14141a;
  border: 1px solid #35314f;
  border-radius: 12px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6);
}
header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}
header h2 {
  flex: 1;
  font-size: 15px;
  font-weight: 650;
  color: #e9e6ff;
}
.x {
  padding: 3px 9px;
  font-size: 12px;
  color: #9a9aa5;
  background: #1a1a21;
  border: 1px solid #2c2c36;
  border-radius: 6px;
  cursor: pointer;
}
.lead {
  font-size: 12.5px;
  line-height: 1.55;
  color: #c9c9d1;
  margin-bottom: 12px;
}
.devices {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}
.empty {
  font-size: 12px;
  color: #85858f;
  padding: 8px;
  background: #16161c;
  border: 1px solid #24242d;
  border-radius: 7px;
}
.device {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  background: #16161c;
  border: 1px solid #24242d;
  border-radius: 7px;
  font-size: 12.5px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4a4a55;
}
.dot.on {
  background: #9ee493;
  box-shadow: 0 0 6px rgba(158, 228, 147, 0.7);
}
.dname {
  flex: 1;
  color: #e4e4e9;
}
.dstate {
  font-size: 11px;
  color: #85858f;
}
.tips,
.steps {
  margin: 6px 0 14px 18px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.tips li,
.steps li {
  font-size: 12px;
  line-height: 1.5;
  color: #9a9aa5;
}
.tips b,
.steps b {
  color: #c9c9d1;
}
code {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 11.5px;
  color: #d7f0d7;
  background: #10131a;
  padding: 1px 5px;
  border-radius: 4px;
}
.status {
  font-size: 12.5px;
  color: #9a9aa5;
  margin-bottom: 8px;
}
.status b {
  color: #ff8a8a;
}
.status b.ok {
  color: #9ee493;
}
.err {
  font-size: 11.5px;
  line-height: 1.5;
  color: #ff8a8a;
  margin-bottom: 10px;
}
.profiles {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 4px 0 14px;
  padding: 12px;
  background: #16161c;
  border: 1px solid #24242d;
  border-radius: 8px;
}
.plabel {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #8f86d8;
}
.pnote {
  font-size: 11.5px;
  line-height: 1.5;
  color: #85858f;
}
.profile-btn {
  padding: 8px 10px;
  font-size: 12.5px;
  color: #d7d7de;
  background: #1a1a21;
  border: 1px solid #2c2c36;
  border-radius: 7px;
  cursor: pointer;
}
.profile-btn:hover {
  background: #23232c;
  border-color: #3a3a48;
}
.actions {
  display: flex;
  gap: 8px;
}
.accent {
  padding: 8px 14px;
  font-size: 12.5px;
  font-weight: 600;
  color: #e9e6ff;
  background: #342e6e;
  border: 1px solid #4c42a3;
  border-radius: 8px;
  cursor: pointer;
}
.accent:hover {
  background: #3e3784;
}
</style>
