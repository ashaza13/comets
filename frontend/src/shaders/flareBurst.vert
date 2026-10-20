// Particles thrown out from the comet when an answer lands.
uniform float uProgress;
uniform float uPixelRatio;
uniform vec3 uColor;

attribute vec3 aDir;   // unit direction
attribute float aSpeed;

varying vec3 vColor;
varying float vAlpha;

void main() {
  float travel = 1.0 - pow(1.0 - uProgress, 2.5);
  vec3 pos = aDir * travel * aSpeed;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  vColor = uColor;
  vAlpha = pow(1.0 - uProgress, 1.6) * step(0.0001, uProgress);
  gl_PointSize = min((2.5 + 2.0 * (1.0 - uProgress)) * uPixelRatio * (8.0 / max(-mv.z, 0.5)), 40.0);
}
