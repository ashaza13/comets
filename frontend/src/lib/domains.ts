// Maps each interest domain to a unit-length direction on the sphere.
// Directions are spread to minimise overlap between adjacent domains.
const S = 0.577  // 1/√3
const H = 0.707  // 1/√2

export const DOMAIN_DIRECTIONS: Record<string, [number, number, number]> = {
  // Axis-aligned (6 faces of a cube)
  literature:   [1,  0,  0],
  athletics:    [-1, 0,  0],
  philosophy:   [0,  1,  0],
  cooking:      [0, -1,  0],
  film:         [0,  0,  1],
  gaming:       [0,  0, -1],

  // Octahedron vertices (8 corners, ±45° on all axes)
  science:      [ S,  S,  S],
  technology:   [ S,  S, -S],
  art:          [-S,  S,  S],
  music:        [-S,  S, -S],
  mathematics:  [ S, -S,  S],
  psychology:   [ S, -S, -S],
  history:      [-S, -S,  S],
  spirituality: [-S, -S, -S],

  // Edge midpoints of a cube (12 edges, 45° on two axes)
  nature:       [ H,  H,  0],
  economics:    [-H,  H,  0],
  politics:     [ 0,  H,  H],
  software:     [ 0,  H, -H],
  social:       [ H,  0,  H],
  health:       [ H,  0, -H],
}

export const DOMAIN_COLORS: Record<string, string> = {
  literature:   '#ff6b6b',
  athletics:    '#ff9f43',
  philosophy:   '#ffd93d',
  cooking:      '#6bcb77',
  film:         '#4d96ff',
  gaming:       '#c77dff',
  science:      '#00d2ff',
  technology:   '#0096c7',
  art:          '#f77f00',
  music:        '#e040fb',
  mathematics:  '#00b4d8',
  psychology:   '#ff4d6d',
  history:      '#b5838d',
  spirituality: '#9b5de5',
  nature:       '#80b918',
  economics:    '#f4a261',
  politics:     '#e63946',
  software:     '#48cae4',
  social:       '#ff9ece',
  health:       '#52b788',
}
