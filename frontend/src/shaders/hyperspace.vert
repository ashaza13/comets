// A tunnel of streaks around the camera's line of sight. Each streak races
// towards the camera and wraps round; its length grows with the warp, so the
// stars stretch into lines radiating from the centre of the screen.
attribute vec3 aStreak; // angle, radius, depth offset (0–1)
attribute float aEnd;   // 0 = head (near end), 1 = tail (far end)

uniform float uTime;
uniform float uWarp;
uniform float uDepth;
uniform float uNear;
uniform float uLength;

varying float vAlpha;
varying float vEnd;

void main() {
  // Depth of the head, travelling towards the camera, wrapped over the tunnel.
  float z = -uNear - mod(aStreak.z * uDepth - uTime, uDepth);
  // The tail trails behind; stretched only while warping.
  z -= aEnd * uLength * uWarp;
  vec3 pos = vec3(cos(aStreak.x) * aStreak.y, sin(aStreak.x) * aStreak.y, z);
  // Fade in from the far end of the tunnel, and out as a streak passes the camera.
  float depth = (-z - uNear) / uDepth;
  vAlpha = smoothstep(1.0, 0.6, depth) * smoothstep(0.0, 0.08, depth);
  vEnd = aEnd;
  gl_Position = projectionMatrix * vec4(pos, 1.0);
}
