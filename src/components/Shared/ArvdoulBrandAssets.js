// Shared static geometric paths and brand stops extracted from SplashScreen
// so the boot screen, splash animation, top bar, and nav rail stay 100% identical.

export const LOGO = Object.freeze({
  viewBox: 512,
  orbit: { d: "M328.2 446.3 A197 197 0 1 1 390.3 407.1", width: 39 },
  monogram: { d: "M154 352 L226.4 192 Q256.5 119 286.6 192 L386 408", width: 47.5 },
  crossbar: { d: "M154 352 Q256 257 358 352", width: 41 },
  gradient: {
    x1: 60,
    y1: 96,
    x2: 440,
    y2: 446,
    stops: [
      [0, "#BD03F6"],
      [0.2, "#A508F9"],
      [0.3, "#9210F8"],
      [0.4, "#7A1AF8"],
      [0.5, "#5A25FA"],
      [0.6, "#3434FA"],
      [0.7, "#1048FA"],
      [0.8, "#0160FB"],
      [1, "#0074F8"],
    ],
  },
  orbitStart: { x: 328.2, y: 446.3 },
  orbitCenter: { x: 256, y: 263 },
  orbitRadius: 197,
});

export const WORDMARK = Object.freeze({
  label: "Arvdoul",
  width: 496,
  height: 100,
  stroke: 18,
  letters: [
    { ch: "A", x: 0, paths: ["M9 91 L36 26 Q50 -8 64 26 L91 91", "M9 91 Q50 29 91 91"] },
    { ch: "r", x: 106, paths: ["M9 91 V43", "M9 66 Q9 43 33 43"] },
    { ch: "v", x: 156, paths: ["M9 43 L40 91 L71 43"] },
    { ch: "d", x: 240, paths: ["M9 67 a24 24 0 1 0 48 0 a24 24 0 1 0 -48 0", "M57 9 V91"] },
    { ch: "o", x: 318, paths: ["M9 67 a24 24 0 1 0 48 0 a24 24 0 1 0 -48 0"] },
    { ch: "u", x: 396, paths: ["M9 43 V67 A24 24 0 0 0 57 67", "M57 43 V91"] },
    { ch: "l", x: 478, paths: ["M9 9 V91"] },
  ],
});
