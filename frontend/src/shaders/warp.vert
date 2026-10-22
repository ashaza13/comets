// Space dust that fills an endless box around the camera. Each mote is drawn
// twice: as a point, and as a line whose far end trails behind along the
// camera's velocity, so the field streaks past when travelling fast.
attribute float aEnd;   // 0 = head of the streak, 1 = trailing end (lines only)
attribute float aSeed;

uniform vec3 uCamPos;
uniform vec3 uVelocity;
uniform float uBox;
uniform float uStretch;
uniform float uPixelRatio;
uniform float uPointSize;

varying float vAlpha;

void main() {
  // Wrap into a box centred on the camera so the field never runs out.
  vec3 p = mod(position - uCamPos + uBox * 0.5, uBox) - uBox * 0.5 + uCamPos;
  p -= uVelocity * uStretch * aEnd;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  float dist = length(p - uCamPos);
  float edge = 1.0 - smoothstep(uBox * 0.25, uBox * 0.5, dist); // hide the wrap seam
  float near = smoothstep(0.4, 2.0, dist);
  vAlpha = edge * near * (0.55 + 0.45 * fract(aSeed * 7.13)) * (1.0 - 0.85 * aEnd);
  gl_PointSize = min(uPointSize * uPixelRatio * (10.0 / max(-mv.z, 0.5)), 24.0);
}
