"use client";

import { useMemo } from "react";

const N = 29;

/** Deterministic placeholder pattern. This is NOT a scannable GCash code; swap for the real QR image later. */
function buildMatrix(seed: string): boolean[][] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
  const m = Array.from({ length: N }, () => Array.from({ length: N }, () => rand() > 0.52));
  const finder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r;
        const cc = c0 + c;
        if (rr < 0 || cc < 0 || rr >= N || cc >= N) continue;
        const edge = r === 0 || r === 6 || c === 0 || c === 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        m[rr][cc] = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (edge || core);
      }
  };
  finder(0, 0);
  finder(0, N - 7);
  finder(N - 7, 0);
  return m;
}

export function qrSvgString(seed: string): string {
  const m = buildMatrix(seed);
  const q = 2;
  const size = N + q * 2;
  let rects = "";
  m.forEach((row, r) =>
    row.forEach((on, c) => {
      if (on) rects += `<rect x="${c + q}" y="${r + q}" width="1" height="1"/>`;
    }),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size * 12}" height="${size * 12}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#0b3ec4">${rects}</g></svg>`;
}

export function MockQr({ seed }: { seed: string }) {
  const src = useMemo(
    () => `data:image/svg+xml;utf8,${encodeURIComponent(qrSvgString(seed))}`,
    [seed],
  );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="Sample GCash QR code" className="size-full" />
  );
}

/** Rasterises the QR to a PNG and triggers a download. */
export function downloadQr(seed: string, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas unavailable"));
      ctx.drawImage(img, 0, 0, 720, 720);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("export failed"));
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        resolve();
      }, "image/png");
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(qrSvgString(seed))}`;
  });
}
