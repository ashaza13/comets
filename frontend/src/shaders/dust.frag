uniform vec3 uColor;
uniform float uOpacity;

varying float vAlpha;

void main() {
  vec2 p = gl_PointCoord - 0.5;
  float a = exp(-dot(p, p) * 18.0) * vAlpha * uOpacity;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor * a, 1.0);
}
