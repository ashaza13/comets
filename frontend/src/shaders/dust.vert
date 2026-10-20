attribute float aSize;
attribute float aPhase;

uniform float uTime;
uniform float uDrift;
uniform float uPixelRatio;

varying float vAlpha;

void main() {
  // Each mote bobs on its own slow Lissajous path.
  vec3 p = position;
  float t = uTime * uDrift;
  p += vec3(sin(t * 0.7 + aPhase * 6.28), cos(t * 0.5 + aPhase * 12.1), sin(t * 0.6 + aPhase * 3.7)) * 0.25;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z, 0.5);
  gl_PointSize = aSize * uPixelRatio * (12.0 / depth);
  // Fade motes that come very close to the camera.
  vAlpha = smoothstep(0.6, 2.0, depth);
}
