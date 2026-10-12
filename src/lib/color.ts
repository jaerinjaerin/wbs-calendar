// Excel (Office 2013–2022) theme colors → their "Lighter 80%" swatch, copied exactly from Excel's palette.
// White, Black and Background 2 are left out: those columns have no "Lighter 80%" swatch.
const EXCEL_LIGHTER_80: Record<string, string> = {
  '#44546A': '#D6DCE4',
  '#4472C4': '#D9E1F2',
  '#ED7D31': '#FCE4D6',
  '#A5A5A5': '#EDEDED',
  '#FFC000': '#FFF2CC',
  '#5B9BD5': '#DDEBF7',
  '#70AD47': '#E2EFDA',
};

export const COLOR_PRESETS = Object.keys(EXCEL_LIGHTER_80);

// Excel's swatch values come from its own HLS rounding, so presets use the table;
// other colors (nodes saved before the switch) get the HSL approximation L' = L + (1 - L) * 0.8.
export function lighter80(hex: string): string {
  const preset = EXCEL_LIGHTER_80[hex.toUpperCase()];
  if (preset) return preset;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const L = l + (1 - l) * 0.8;
  const c = (1 - Math.abs(2 * L - 1)) * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = L - c / 2;
  const [r1, g1, b1] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h) % 6];
  return '#' + [r1, g1, b1].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}
