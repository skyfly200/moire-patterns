// Fullscreen-quad shaders for the moiré generator.
//
// Inspired by the classic `sin(length(uv) * frequency)` fragment shader:
// when the ring frequency approaches/exceeds the pixel Nyquist limit, the
// point-sampled sine aliases against the pixel grid and moiré appears.
// Layering several gratings (rings / lines / grids / spokes) with slightly
// different frequencies, rotations or centers produces the classic
// interference moiré as well. uAAMode exposes the mitigation techniques
// (screen-space derivative smoothing, supersampling) discussed alongside
// that shader, so aliasing moiré can be dialed up or down on demand.

export const vertexShader = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const fragmentShader = /* glsl */ `
precision highp float;

const int MAX_LAYERS = 4;
const float PI = 3.141592653589793;

uniform vec2  uResolution;
uniform float uAnimTime;    // seconds accumulated only while playing
uniform float uZoom;
uniform int   uPatternType; // 0 rings, 1 lines, 2 grid, 3 spokes
uniform int   uLayerCount;  // 1..MAX_LAYERS
uniform int   uBlendMode;   // 0 multiply, 1 difference, 2 average, 3 min,
                            // 4 max, 5 screen, 6 add, 7 subtract
uniform int   uAAMode;      // 0 off (aliased), 1 fwidth smooth, 2 ssaa 2x2, 3 ssaa 4x4
uniform int   uColorMode;   // 0 duotone, 1 gradient, 2 rainbow, 3 per-layer
uniform float uThickness;   // stripe duty threshold in [0,1]
uniform vec3  uColorA;      // background
uniform vec3  uColorB;      // foreground
uniform vec3  uColorC;      // gradient end stop
uniform vec3  uLayerColor[MAX_LAYERS];
uniform vec2  uOffset[MAX_LAYERS];
uniform float uFreq[MAX_LAYERS];
uniform float uRot[MAX_LAYERS];

vec2 toPlane(vec2 fragCoord) {
  vec2 uv = fragCoord / uResolution * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;
  return uv * uZoom;
}

float wave(vec2 p, float freq) {
  if (uPatternType == 0) return sin(length(p) * freq);
  if (uPatternType == 1) return sin(p.x * freq);
  if (uPatternType == 2) return max(sin(p.x * freq), sin(p.y * freq));
  float spokes = max(floor(freq * 0.25), 1.0);
  return sin(atan(p.y, p.x) * spokes);
}

float layerValue(vec2 p, int i) {
  float dir = mod(float(i), 2.0) < 0.5 ? 1.0 : -1.0;
  float phase = float(i) * 2.4;
  float t = uAnimTime * dir;

  // Slow orbit of the layer center (zero displacement at t = 0 so enabling
  // animation never snaps the pattern) plus a slow counter-rotation.
  vec2 off = uOffset[i]
    + 0.06 * (vec2(cos(t * 0.7 + phase), sin(t * 0.7 + phase))
            - vec2(cos(phase), sin(phase)));
  float rot = uRot[i] + t * 0.15;

  float c = cos(rot);
  float s = sin(rot);
  vec2 q = mat2(c, -s, s, c) * (p - off);

  float v = 0.5 + 0.5 * wave(q, uFreq[i]);
  if (uAAMode == 1) {
    float w = fwidth(v) + 1e-4;
    return smoothstep(uThickness - w, uThickness + w, v);
  }
  return step(uThickness, v);
}

float composite(vec2 p) {
  float acc = layerValue(p, 0);
  float sum = acc;
  for (int i = 1; i < MAX_LAYERS; i++) {
    if (i >= uLayerCount) break;
    float c = layerValue(p, i);
    if      (uBlendMode == 0) acc *= c;
    else if (uBlendMode == 1) acc = abs(acc - c);
    else if (uBlendMode == 2) sum += c;
    else if (uBlendMode == 3) acc = min(acc, c);
    else if (uBlendMode == 4) acc = max(acc, c);
    else if (uBlendMode == 5) acc = acc + c - acc * c;
    else if (uBlendMode == 6) acc = min(acc + c, 1.0);
    else                      acc = clamp(acc - c, 0.0, 1.0);
  }
  if (uBlendMode == 2) return sum / float(uLayerCount);
  return acc;
}

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

vec3 shade(vec2 fragCoord) {
  vec2 p = toPlane(fragCoord);

  if (uColorMode == 3) {
    // Per-layer colors: screen-composite each tinted grating over the background.
    vec3 col = uColorA;
    for (int i = 0; i < MAX_LAYERS; i++) {
      if (i >= uLayerCount) break;
      vec3 tinted = uLayerColor[i] * layerValue(p, i);
      col = col + tinted - col * tinted;
    }
    return col;
  }

  float v = composite(p);
  if (uColorMode == 1) {
    return v < 0.5 ? mix(uColorA, uColorB, v * 2.0)
                   : mix(uColorB, uColorC, v * 2.0 - 1.0);
  }
  if (uColorMode == 2) {
    // Hue from the composite value, drifting slowly while animated.
    // Richest with the Average blend, where v is multi-level.
    return mix(uColorA, hsv2rgb(vec3(fract(v * 0.833 + uAnimTime * 0.03), 0.8, 0.95)), v);
  }
  return mix(uColorA, uColorB, v);
}

void main() {
  vec3 col = vec3(0.0);
  if (uAAMode == 2) {
    for (int x = 0; x < 2; x++)
      for (int y = 0; y < 2; y++)
        col += shade(gl_FragCoord.xy + (vec2(float(x), float(y)) - 0.5) * 0.5);
    col *= 0.25;
  } else if (uAAMode == 3) {
    for (int x = 0; x < 4; x++)
      for (int y = 0; y < 4; y++)
        col += shade(gl_FragCoord.xy + (vec2(float(x), float(y)) - 1.5) * 0.25);
    col *= 0.0625;
  } else {
    col = shade(gl_FragCoord.xy);
  }
  gl_FragColor = vec4(col, 1.0);
}
`
