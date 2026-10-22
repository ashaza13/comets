uniform samplerCube uLayers;
uniform vec3 uTint;
uniform float uIntensity;
uniform mat3 uRotation;

varying vec3 vDir;

void main() {
  vec4 l = textureCube(uLayers, uRotation * normalize(vDir));
  // A single NaN texel would be smeared across the whole frame by the bloom blur.
  if (any(isnan(l)) || any(isinf(l))) l = vec4(0.0);

  vec3 deep = vec3(0.005, 0.005, 0.016);
  vec3 violet = vec3(0.11, 0.035, 0.20);
  vec3 teal = vec3(0.015, 0.085, 0.13);

  vec3 col = deep;
  col += mix(violet, teal, l.r) * l.g * 0.62;
  col += uTint * l.a * 0.2;
  col += vec3(0.1, 0.09, 0.13) * l.b;

  gl_FragColor = vec4(col * uIntensity, 1.0);
}
