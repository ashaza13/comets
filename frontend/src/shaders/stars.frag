uniform float uBrightness;

varying vec3 vColor;
varying float vTwinkle;

void main() {
  vec2 p = gl_PointCoord - 0.5;
  float r2 = dot(p, p) * 4.0;
  float core = exp(-r2 * 16.0);
  float halo = exp(-r2 * 3.0) * 0.18;
  float a = (core + halo) * vTwinkle;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor * a * uBrightness, 1.0);
}
