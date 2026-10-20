uniform vec3 uColor;
uniform float uOpacity;
uniform float uRound; // 1 for points (soft disc), 0 for lines

varying float vAlpha;

void main() {
  float shape = 1.0;
  if (uRound > 0.5) {
    vec2 p = gl_PointCoord - 0.5;
    shape = exp(-dot(p, p) * 18.0);
  }
  float a = shape * vAlpha * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor * a, 1.0);
}
