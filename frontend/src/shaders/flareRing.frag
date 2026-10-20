// Expanding shockwave ring when an answer lands.
uniform vec3 uColor;
uniform float uProgress; // 0 → 1 over the flare's life

varying vec2 vUv;

void main() {
  vec2 p = (vUv - 0.5) * 2.0; // -1..1 across the plane
  float r = length(p);
  // The ring stays well inside the plane, and everything fades out before the
  // plane's edge, so the quad's straight sides can never clip the glow.
  float radius = 0.72 * (1.0 - pow(1.0 - uProgress, 3.0)); // fast out, slow settle
  float width = mix(0.015, 0.06, uProgress);
  float d = (r - radius) / width;
  float ring = exp(-d * d);
  float flash = exp(-r * r * 60.0) * (1.0 - uProgress) * 2.0;
  float fade = pow(1.0 - uProgress, 1.5);
  float edge = 1.0 - smoothstep(0.85, 0.98, r);
  gl_FragColor = vec4(uColor * (ring * 1.6 + flash) * fade * edge, 1.0);
}
