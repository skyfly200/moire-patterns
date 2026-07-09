// Art-Net → WebSocket bridge for the moiré generator.
//
// Browsers cannot receive UDP, so run this tiny relay on the machine whose
// browser is showing the app:
//
//   npm install   (installs the `ws` dev dependency)
//   node tools/artnet-bridge.mjs
//
// It listens for ArtDMX packets on the standard Art-Net port (UDP 6454) and
// forwards each frame as JSON ({ u: universe, d: [channel bytes] }) to every
// WebSocket client on ws://localhost:6455 — which is where the app's
// "Art-Net" toggle connects.

import dgram from 'node:dgram'
import { WebSocketServer } from 'ws'

const UDP_PORT = 6454
const WS_PORT = 6455

const wss = new WebSocketServer({ port: WS_PORT })
wss.on('connection', () => console.log('app connected'))

const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true })

sock.on('message', (buf) => {
  if (buf.length < 20) return
  if (buf.toString('latin1', 0, 7) !== 'Art-Net') return
  const opcode = buf.readUInt16LE(8)
  if (opcode !== 0x5000) return // ArtDMX only
  const universe = buf.readUInt16LE(14)
  const length = buf.readUInt16BE(16)
  const data = Array.from(buf.subarray(18, 18 + Math.min(length, 512)))
  const msg = JSON.stringify({ u: universe, d: data })
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg)
  }
})

sock.on('error', (e) => {
  console.error('UDP error:', e.message)
  process.exit(1)
})

sock.bind(UDP_PORT, () =>
  console.log(`Art-Net bridge running: UDP :${UDP_PORT} → ws://localhost:${WS_PORT}`),
)
