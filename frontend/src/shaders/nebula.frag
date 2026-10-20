// Bakes the nebula's structure into a cube map, once. Colour is applied later by
// nebulaDisplay.frag, so mood changes never require re-running this noise.
//   r: blend between violet and teal clouds
//   g: cloud density
//   b: galactic band brightness (with dust lanes cut out)
//   a: bright wisps
uniform vec3 uBandNormal;
uniform float uSeed;

varying vec3 vDir;

#include ./noise.glsl

void main() {
  vec3 d = normalize(vDir);
  vec3 s = d + uSeed;

  // Domain warping folds the clouds into filaments instead of plain blobs.
  vec3 q = vec3(fbm(s * 1.5), fbm(s * 1.5 + vec3(5.2, 1.3, 2.8)), fbm(s * 1.5 + vec3(9.1, 4.7, 7.3)));
  float n = fbm(s * 2.1 + q * 1.9);
  // Large-scale mask leaves stretches of open, dark sky between cloud regions.
  float mask = smoothstep(-0.3, 0.45, fbm(d * 0.9 + uSeed * 3.0));
  float clouds = smoothstep(-0.05, 0.85, n) * mask;

  float h = dot(d, uBandNormal);
  float band = exp(-h * h / 0.03);
  float lanes = smoothstep(0.05, 0.6, fbm(d * 7.0 + q * 2.0));

  vec4 layers = vec4(
    smoothstep(-0.35, 0.45, q.x),
    clouds,
    band * (0.35 + 0.65 * clouds) * (1.0 - 0.75 * lanes),
    clouds * clouds * clouds
  );
  // Some drivers produce stray NaNs here; never let one reach the bloom pass.
  gl_FragColor = (any(isnan(layers)) || any(isinf(layers))) ? vec4(0.0) : layers;
}
