uniform vec3 uColor;
uniform float uEnergy;
uniform float uPulse;

varying vec3 vNormal;
varying vec3 vView;
varying float vRock;

void main() {
  // Sunlit ice seen through its own glow: a bright, mottled core whose lumps
  // read as brightness variation, with an emotion-coloured rim.
  float rim = pow(1.0 - max(dot(normalize(vNormal), vView), 0.0), 2.2);
  vec3 ice = mix(uColor, vec3(1.0), 0.6) * (0.75 + 0.35 * vRock);
  vec3 col = (ice * 1.6 + uColor * rim * 1.8) * uEnergy;
  gl_FragColor = vec4(col * uPulse, 1.0);
}
