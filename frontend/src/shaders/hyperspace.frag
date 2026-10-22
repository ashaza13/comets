uniform float uWarp;
uniform vec3 uHead;
uniform vec3 uTail;

varying float vAlpha;
varying float vEnd;

void main() {
  // White-hot at the near end, cooling to blue along the streak.
  vec3 col = mix(uHead, uTail, vEnd);
  float a = vAlpha * uWarp * (1.0 - 0.7 * vEnd);
  if (a < 0.003) discard;
  gl_FragColor = vec4(col * a, 1.0);
}
