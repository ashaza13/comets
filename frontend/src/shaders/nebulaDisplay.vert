varying vec3 vDir;

void main() {
  vDir = position;
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  // Pin to the far plane so the sky is always behind everything else.
  gl_Position = clip.xyww;
}
