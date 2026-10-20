// Interest jets: particles stream out of the nucleus along each domain's
// direction. Positions are a pure function of time, so no simulation state.
uniform float uTime;
uniform float uSpread;
uniform float uPixelRatio;
uniform vec3 uDir[DOMAIN_COUNT];
uniform vec3 uColor[DOMAIN_COUNT];
uniform float uDepth[DOMAIN_COUNT];

attribute float aDomain;
attribute vec3 aSeed;

varying vec3 vColor;
varying float vAlpha;

#include ./noise.glsl

void main() {
  int i = int(aDomain);
  float depth = uDepth[i];
  vec3 dir = uDir[i];

  float age = fract(uTime * (0.22 + 0.18 * aSeed.x) + aSeed.y);
  float len = 0.12 + depth * 2.1;

  vec3 side = normalize(abs(dir.y) < 0.9 ? cross(dir, vec3(0.0, 1.0, 0.0)) : cross(dir, vec3(1.0, 0.0, 0.0)));
  vec3 up = cross(dir, side);
  float angle = aSeed.z * 6.2831;
  // Deep, focused interests make tight jets; shallow ones fan out.
  float cone = (0.12 + 0.25 * (1.0 - depth)) * age * len;
  vec3 pos = dir * age * len + (side * cos(angle) + up * sin(angle)) * cone * fract(aSeed.x * 13.7);

  vec3 q = pos * 3.0 + vec3(uTime * 0.35, 0.0, aSeed.y * 7.0);
  pos += vec3(snoise(q), snoise(q + 17.0), snoise(q + 31.0)) * 0.07 * age * (0.4 + uSpread);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  float on = step(0.01, depth);
  vAlpha = on * (1.0 - age) * smoothstep(0.0, 0.08, age) * (0.6 + 0.6 * depth);
  vColor = uColor[i];
  gl_PointSize = on * (2.0 + 4.5 * (1.0 - age)) * uPixelRatio * (9.0 / max(-mv.z, 0.5));
}
