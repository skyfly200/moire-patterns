<script setup>
import { modState, rescanMIDI, MIDI_PROFILES, applyMidiProfile } from '../modulation.js'
import { mdiClose, mdiCircle, mdiRefresh } from '@mdi/js'

const props = defineProps({ which: { type: String, required: true } }) // 'midi' | 'artnet'
const emit = defineEmits(['close'])
</script>

<template>
  <v-dialog
    :model-value="true" max-width="480"
    @update:model-value="(v) => !v && emit('close')"
  >
    <v-card color="surface-bright">
      <v-card-title class="d-flex align-center">
        <span class="flex-grow-1">{{ which === 'midi' ? 'MIDI setup' : 'Art-Net / DMX setup' }}</span>
        <v-btn :icon="mdiClose" size="x-small" variant="text" @click="emit('close')" />
      </v-card-title>

      <v-card-text v-if="which === 'midi'">
        <p class="lead">
          Connect a USB or Bluetooth MIDI controller, then it should appear
          below. Knobs and faders send Control-Change messages; buttons send
          notes — bind either in the MIDI Control panel.
        </p>

        <v-list class="devices" density="compact" bg-color="transparent">
          <v-list-item v-if="!modState.midi.devices.length" class="empty">
            No MIDI inputs detected.
          </v-list-item>
          <v-list-item v-for="(d, i) in modState.midi.devices" :key="i">
            <template #prepend>
              <v-icon
                :icon="mdiCircle" size="10"
                :color="d.state === 'connected' ? 'success' : 'grey'"
              />
            </template>
            <v-list-item-title>{{ d.name }}</v-list-item-title>
            <template #append>
              <span class="dstate">{{ d.state }}</span>
            </template>
          </v-list-item>
        </v-list>

        <v-alert v-if="modState.midi.error" type="warning" variant="tonal" density="compact" class="my-2 alert-sm">
          {{ modState.midi.error }}
        </v-alert>

        <v-card variant="tonal" color="secondary" class="profiles">
          <div class="plabel">Controller profile</div>
          <p class="pnote">
            Loads a ready-made control map. Every binding is still
            MIDI-learnable in the panel if your controller differs.
          </p>
          <v-btn
            v-for="p in MIDI_PROFILES" :key="p.value"
            variant="outlined" block class="mb-2" @click="applyMidiProfile(p.value)"
          >Load {{ p.label }}</v-btn>
        </v-card>

        <ul class="tips">
          <li>Web MIDI works in <b>Chrome</b> and <b>Edge</b> (not Firefox/Safari).</li>
          <li>On a deployed site it requires <b>https</b> and a permission prompt.</li>
          <li>Hot-plug is detected; if a device is missing, hit Rescan.</li>
        </ul>
      </v-card-text>

      <v-card-text v-else>
        <p class="lead">
          Browsers can't receive UDP, so Art-Net comes in through a tiny
          bridge you run on this machine. It relays Art-Net (UDP 6454) to the
          app over a local WebSocket.
        </p>
        <ol class="steps">
          <li>In a terminal at the project folder, run <code>npm install</code> once.</li>
          <li>Start the bridge: <code>node tools/artnet-bridge.mjs</code></li>
          <li>Point your console / Art-Net source at this computer, universe 0.</li>
          <li>Channels 1–16 become mappable sources (<code>Art-Net · ch N</code>).</li>
        </ol>
        <v-alert
          :type="modState.artnet.connected ? 'success' : 'info'"
          variant="tonal" density="compact" class="alert-sm"
        >
          Bridge {{ modState.artnet.connected ? 'connected' : 'not connected' }}<span
            v-if="modState.artnet.enabled && !modState.artnet.connected"> — retrying every 3 s…</span>
        </v-alert>
      </v-card-text>

      <v-card-actions v-if="which === 'midi'">
        <v-spacer />
        <v-btn :prepend-icon="mdiRefresh" variant="tonal" color="primary" @click="rescanMIDI()">
          Rescan devices
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.lead {
  font-size: 12.5px;
  line-height: 1.55;
  color: #c9c9d1;
  margin-bottom: 12px;
}
.devices {
  margin-bottom: 8px;
  border-radius: 8px;
}
.empty {
  font-size: 12px;
  color: #85858f;
}
.dstate {
  font-size: 11px;
  color: #85858f;
}
.alert-sm {
  font-size: 11.5px;
  line-height: 1.5;
}
.profiles {
  padding: 12px;
  margin-bottom: 12px;
}
.plabel {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #a8a2d8;
  margin-bottom: 4px;
}
.pnote {
  font-size: 11.5px;
  line-height: 1.5;
  color: #a4a4ae;
  margin-bottom: 8px;
}
.tips,
.steps {
  margin: 6px 0 0 18px;
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
</style>
