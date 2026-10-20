// Straight, thin plasma tail streaming back along the heading.
uniform vec3 uColor;
uniform float uTime;
uniform float uIntensity;

varying vec2 vUv; // x: across the tail, y: 0 at the nucleus → 1 at the tip

#include ./noise.glsl

void main() {
  float x = (vUv.x - 0.5) * 2.0;
  float y = vUv.y;
  float width = mix(0.12, 1.0, pow(y, 0.55));
  float across = exp(-(x * x) / (width * width) * 5.0);
  float streaks = 0.5 + 0.5 * snoise(vec3(x * 7.0 / width, y * 2.5 - uTime * 0.9, 1.7));
  float fade = pow(1.0 - y, 1.4) * smoothstep(0.0, 0.06, y);
  vec3 ion = mix(vec3(0.42, 0.68, 1.0), uColor, 0.3);
  gl_FragColor = vec4(ion * across * (0.35 + 0.65 * streaks) * fade * uIntensity, 1.0);
}
