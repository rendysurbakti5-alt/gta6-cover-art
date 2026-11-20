// Colour grades. A grade works in two layers, both drawn by the renderer:
//   filter  — a CSS filter string applied to each photo as it is drawn, so the
//             photography itself takes on the grade's colour science.
//   wash    — gradient stops painted over the whole poster afterwards with a
//             blend mode, which ties the separate panels into one piece of art.
//   title   — the two colours the caption lettering's gradient runs between.
//   paper   — the gutter/frame colour the panels sit on.

export const GRADES = [
  {
    id: 'vice-sunset',
    name: 'Vice Sunset',
    filter: 'saturate(1.45) contrast(1.09) brightness(1.03) sepia(0.16)',
    washMode: 'soft-light',
    washStops: [
      [0, 'rgba(255, 110, 64, 0.55)'],
      [0.45, 'rgba(255, 170, 90, 0.18)'],
      [0.75, 'rgba(214, 51, 132, 0.28)'],
      [1, 'rgba(88, 10, 74, 0.6)'],
    ],
    bandStops: [
      [0, 'rgba(20, 4, 24, 0)'],
      [1, 'rgba(20, 4, 24, 0.7)'],
    ],
    titleTop: '#fff7e8',
    titleBottom: '#ff9a3d',
    accent: '#ff5e7a',
    paper: '#170a18',
    swatch: 'linear-gradient(160deg, #ffb347, #ff5e7a 55%, #57124e)',
  },
  {
    id: 'neon-nights',
    name: 'Neon Nights',
    filter: 'saturate(1.55) contrast(1.16) brightness(0.97) hue-rotate(-6deg)',
    washMode: 'overlay',
    washStops: [
      [0, 'rgba(0, 229, 255, 0.34)'],
      [0.5, 'rgba(20, 0, 60, 0.12)'],
      [1, 'rgba(255, 0, 128, 0.4)'],
    ],
    bandStops: [
      [0, 'rgba(2, 0, 16, 0)'],
      [1, 'rgba(2, 0, 16, 0.7)'],
    ],
    titleTop: '#f2feff',
    titleBottom: '#ff4fd8',
    accent: '#00e5ff',
    paper: '#070314',
    swatch: 'linear-gradient(160deg, #00e5ff, #3b0f66 55%, #ff2ea6)',
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    filter: 'saturate(1.28) contrast(1.05) brightness(1.07) sepia(0.34)',
    washMode: 'soft-light',
    washStops: [
      [0, 'rgba(255, 214, 130, 0.5)'],
      [0.6, 'rgba(255, 160, 60, 0.16)'],
      [1, 'rgba(120, 52, 10, 0.42)'],
    ],
    bandStops: [
      [0, 'rgba(26, 12, 2, 0)'],
      [1, 'rgba(26, 12, 2, 0.55)'],
    ],
    titleTop: '#fffbeF',
    titleBottom: '#ffc44d',
    accent: '#ff7847',
    paper: '#170d04',
    swatch: 'linear-gradient(160deg, #ffe9a8, #ffb347 55%, #8a4b12)',
  },
  {
    id: 'noir',
    name: 'Noir',
    filter: 'grayscale(1) contrast(1.28) brightness(1.03)',
    washMode: 'soft-light',
    washStops: [
      [0, 'rgba(255, 255, 255, 0.22)'],
      [0.55, 'rgba(90, 90, 90, 0.1)'],
      [1, 'rgba(0, 0, 0, 0.5)'],
    ],
    bandStops: [
      [0, 'rgba(0, 0, 0, 0)'],
      [1, 'rgba(0, 0, 0, 0.72)'],
    ],
    titleTop: '#ffffff',
    titleBottom: '#b9bec7',
    accent: '#e8b13c',
    paper: '#0a0a0c',
    swatch: 'linear-gradient(160deg, #f4f4f4, #6d6d6d 55%, #101010)',
  },
];

export function gradeById(id) {
  return GRADES.find((grade) => grade.id === id) ?? GRADES[0];
}
