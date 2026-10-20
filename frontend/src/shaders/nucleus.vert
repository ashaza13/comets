uniform float uRoughness;

varying vec3 vNormal;
varying vec3 vView;
varying float vRock;

#include ./noise.glsl

void main() {
  // Lumpy, irregular body: push vertices along the normal by low-frequency noise.
  float n = snoise(normal * 2.3) * 0.6 + snoise(normal * 5.1) * 0.25;
  vRock = n;
  vec3 p = position * (1.0 + uRoughness * n);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
