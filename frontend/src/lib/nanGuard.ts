import { ShaderPass } from 'postprocessing'
import * as THREE from 'three'

// Largest value allowed through. Far brighter than anything meant to be on
// screen, but it stops overflowing additive particles from reaching Infinity.
const MAX_RADIANCE = 64

/**
 * Full-screen pass that replaces NaN and Infinity pixels before bloom.
 *
 * The bloom blur spreads a single bad pixel across the whole frame, which shows
 * up as the screen flashing black. Bad pixels can come from driver differences
 * (e.g. pow() of a tiny negative number), geometry very close to the camera, or
 * many additive particles overflowing the half-float buffer.
 */
export function createNanGuardPass(): ShaderPass {
  const material = new THREE.ShaderMaterial({
    name: 'NanGuard',
    uniforms: { inputBuffer: { value: null } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = position.xy * 0.5 + 0.5;
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D inputBuffer;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(inputBuffer, vUv);
        bool bad = any(isnan(c)) || any(isinf(c));
        // max/min also drop NaN on drivers that optimise isnan() away.
        gl_FragColor = bad ? vec4(0.0, 0.0, 0.0, 1.0) : min(max(c, vec4(0.0)), vec4(${MAX_RADIANCE.toFixed(1)}));
      }
    `,
    depthTest: false,
    depthWrite: false,
  })
  return new ShaderPass(material, 'inputBuffer')
}
