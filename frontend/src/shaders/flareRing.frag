// Expanding shockwave ring when an answer lands.
uniform vec3 uColor;
uniform float uProgress; // 0 → 1 over the flare's life

varying vec2 vUv;

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  float radius = 1.0 - pow(1.0 - uProgress, 3.0); // fast out, slow settle
  float width = mix(0.02, 0.09, uProgress);
  float d = (r - radius) / width;
  float ring = exp(-d * d);
  float flash = exp(-r * r * 30.0) * (1.0 - uProgress) * 2.0;
  float fade = pow(1.0 - uProgress, 1.5);
  gl_FragColor = vec4(uColor * (ring * 1.6 + flash) * fade, 1.0);
}
