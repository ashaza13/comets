// Dust tail: particles flow from the head back along the history curve,
// spreading out as they age (wider when the estimate is uncertain).
uniform sampler2D uCurve;  // RGBA32F points, oldest first
uniform sampler2D uColors; // per-observation colour and alpha along the tail
uniform float uCount;
uniform float uTime;
uniform float uSpread;
uniform float uPixelRatio;
uniform vec3 uTint;

attribute vec3 aSeed;

varying vec3 vColor;
varying float vAlpha;

#include ./noise.glsl

vec3 curveAt(float u) {
  float f = u * (uCount - 1.0);
  int i0 = int(floor(f));
  int i1 = min(i0 + 1, int(uCount) - 1);
  vec3 a = texelFetch(uCurve, ivec2(i0, 0), 0).xyz;
  vec3 b = texelFetch(uCurve, ivec2(i1, 0), 0).xyz;
  return mix(a, b, fract(f));
}

void main() {
  float age = fract(aSeed.x + uTime * 0.015);
  float u = 1.0 - pow(age, 1.4); // denser near the head
  vec3 base = curveAt(u);

  vec3 q = base * 1.3 + aSeed * 9.0 + vec3(0.0, uTime * 0.04, 0.0);
  vec3 jitter = vec3(snoise(q), snoise(q + 19.1), snoise(q + 41.3));
  float scatter = (0.02 + 0.32 * age) * (0.6 + 0.8 * uSpread);
  vec3 pos = base + jitter * scatter;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  vec4 c = texture(uColors, vec2(u, 0.5));
  vColor = c.rgb * uTint;
  vAlpha = c.a * (1.0 - 0.7 * age) * step(1.5, uCount);
  gl_PointSize = min((0.8 + 2.2 * aSeed.z) * (1.0 - 0.4 * age) * uPixelRatio * max(6.0 / max(-mv.z, 0.5), 0.6), 32.0);
}
