// Zero-key renderer. Draws a labeled frame whose colour follows the look,
// so a look edit visibly changes the before/after grid. Every frame says STUB.

export interface MockInput {
  label: string;
  shotSize: string;
  lookText: string;
  key: string;
}

// The earliest colour word in the look text wins; tuned so the demo edit
// (green-tinted daylight -> sodium streetlight) reads as green -> amber.
const HUE_WORDS: [string, number][] = [
  ["sodium", 32],
  ["amber", 38],
  ["gold", 45],
  ["red", 0],
  ["green", 140],
  ["teal", 180],
  ["blue", 215],
  ["grey", 210],
  ["gray", 210],
];

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function hueFor(lookText: string): number {
  const text = lookText.toLowerCase();
  let best: { index: number; hue: number } | null = null;
  for (const [word, hue] of HUE_WORDS) {
    const index = text.indexOf(word);
    if (index !== -1 && (!best || index < best.index)) best = { index, hue };
  }
  return best ? best.hue : fnv1a(text) % 360;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// Comma-form hsl() and plain rgb fills: the forms Safari and Chrome both
// render inside SVG attributes.
export function mockSvg(input: MockInput): string {
  const hue = hueFor(input.lookText);
  const font = 'font-family="ui-monospace, Menlo, monospace"';
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" width="320" height="180">`,
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0" stop-color="hsl(${hue}, 38%, 32%)"/>`,
    `<stop offset="1" stop-color="hsl(${(hue + 25) % 360}, 30%, 10%)"/>`,
    `</linearGradient></defs>`,
    `<rect width="320" height="180" fill="url(#g)"/>`,
    `<text x="16" y="30" ${font} font-size="13" fill="rgb(255,255,255)">${esc(clip(input.label, 34))}</text>`,
    `<text x="16" y="48" ${font} font-size="10" fill="rgb(255,255,255)" fill-opacity="0.7">${esc(clip(input.shotSize, 46))}</text>`,
    `<text x="16" y="164" ${font} font-size="9" fill="rgb(255,255,255)" fill-opacity="0.7">${esc(clip(input.lookText, 58))}</text>`,
    `<rect x="262" y="12" width="46" height="18" rx="3" fill="rgb(0,0,0)" fill-opacity="0.6"/>`,
    `<text x="285" y="25" text-anchor="middle" ${font} font-size="10" fill="rgb(255,255,255)">STUB</text>`,
    `<text x="304" y="176" text-anchor="end" ${font} font-size="7" fill="rgb(255,255,255)" fill-opacity="0.5">${input.key.slice(0, 8)}</text>`,
    `</svg>`,
  ].join("");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
