// The glowing cloud of gas around the nucleus. Its churn is the model's
// uncertainty; it stretches away from the direction of travel.
uniform vec3 uColor;
uniform float uEnergy;
uniform float uSpread;
uniform float uTime;
uniform float uPulse;
uniform vec2 uTrail;    // trailing direction in the billboard plane (unit length)
uniform float uStretch; // 0 = round
uniform float uHeadroom; // plane size relative to the glow, so stretched glow never reaches the edge

varying vec2 vUv;

#include ./noise.glsl

void main() {
  vec2 q = (vUv - 0.5) * 2.0; // -1..1 across the plane
  vec2 p = q * uHeadroom;     // glow coordinates; 1 = nominal glow radius
  float along = dot(p, uTrail);
  vec2 perp = p - along * uTrail;
  // Compress distance on the trailing side so the glow reaches further that way.
  float a = along > 0.0 ? along / (1.0 + uStretch) : along * (1.0 + 0.3 * uStretch);
  float r = length(perp + a * uTrail);

  float n = fbm(vec3(p * 2.4, uTime * 0.18));
  float churn = 0.2 + 0.8 * uSpread;
  float glow = exp(-r * r * 7.0 * (1.0 + n * churn)) * (1.0 + 0.35 * n * churn);
  float inner = exp(-r * r * 55.0);

  vec3 col = uColor * glow * 0.75 + mix(uColor, vec3(1.0), 0.65) * inner * 1.6;
  float edge = 1.0 - smoothstep(0.8, 0.98, length(q));
  gl_FragColor = vec4(max(col, 0.0) * uEnergy * uPulse * edge, 1.0);
}
