attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;

uniform float uTime;
uniform float uTwinkle;
uniform float uPixelRatio;

varying vec3 vColor;
varying float vTwinkle;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  // Each star twinkles at its own rate and phase.
  float rate = 0.4 + fract(aPhase * 7.31) * 2.2;
  vTwinkle = 1.0 - uTwinkle * 0.5 * (1.0 + sin(uTime * rate + aPhase * 6.2831));
  vColor = aColor;
  gl_PointSize = aSize * uPixelRatio;
}
