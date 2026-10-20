uniform vec3 uColor;
uniform float uEnergy;
uniform float uPulse;

varying vec3 vNormal;
varying vec3 vView;
varying float vRock;

void main() {
  // Sunlit ice seen through its own glow: a bright, mottled core whose lumps
  // read as brightness variation, with an emotion-coloured rim.
  // Clamped: dot() of unit vectors can round above 1, and pow() of a negative is NaN.
  float rim = pow(clamp(1.0 - dot(normalize(vNormal), vView), 0.0, 1.0), 2.2);
  vec3 ice = mix(uColor, vec3(1.0), 0.6) * (0.75 + 0.35 * vRock);
  vec3 col = (ice * 1.6 + uColor * rim * 1.8) * uEnergy;
  gl_FragColor = vec4(col * uPulse, 1.0);
}
