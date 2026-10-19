// Íconos de la marca (foco = "lo entiendo cuando lo explico") para la web instalable y para Android.
// Uso: node scripts/icons.mjs  → public/icon*.png, public/icon.svg y android/app/src/main/res/*
import sharp from 'sharp';
import { readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const p = (u) => fileURLToPath(u);
const PUB = new URL('../public/', import.meta.url);
const RES = new URL('../android/app/src/main/res/', import.meta.url);
const ORANGE = '#D9480F';
const PAPER = '#F2F1EF';
// Foco (trazo de 24x24) centrado en un lienzo de 512.
const bulb = (scale, color = '#fff', stroke = 1.7) => `<g transform="translate(256 256) scale(${scale}) translate(-12 -12)" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></g>`;
const svg = (inner, r = 112) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${r}" fill="${ORANGE}"/>${inner}</svg>`);

const icon = svg(bulb(14));
await writeFile(p(new URL('icon.svg', PUB)), icon);
for (const [n, s] of [['icon-180.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) await sharp(icon, { density: 400 }).resize(s, s).png().toFile(p(new URL(n, PUB)));
// Maskable: fondo a sangre y el foco dentro de la zona segura (80 %).
await sharp(svg(bulb(11), 0), { density: 400 }).resize(512, 512).png().toFile(p(new URL('icon-maskable-512.png', PUB)));

// Android: ícono clásico, redondo y primer plano adaptativo (zona segura = 66 % central).
const round = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="256" fill="${ORANGE}"/>${bulb(12)}</svg>`);
const fg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bulb(10, '#fff', 1.8)}</svg>`);
for (const [d, k] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
  const dir = new URL(`mipmap-${d}/`, RES);
  await sharp(icon, { density: 300 }).resize(48 * k, 48 * k).png().toFile(p(new URL('ic_launcher.png', dir)));
  await sharp(round, { density: 300 }).resize(48 * k, 48 * k).png().toFile(p(new URL('ic_launcher_round.png', dir)));
  await sharp(fg, { density: 300 }).resize(108 * k, 108 * k).png().toFile(p(new URL('ic_launcher_foreground.png', dir)));
}
await writeFile(new URL('values/ic_launcher_background.xml', RES), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${ORANGE}</color>\n</resources>\n`);

// Pantalla de arranque: fondo papel con el ícono al centro.
for (const name of await readdir(RES)) {
  if (!name.startsWith('drawable')) continue;
  const file = p(new URL(`${name}/splash.png`, RES));
  let meta;
  try { meta = await sharp(file).metadata(); } catch { continue; }
  const s = Math.round(Math.min(meta.width, meta.height) * 0.22);
  const mark = await sharp(icon, { density: 300 }).resize(s, s).png().toBuffer();
  const out = await sharp({ create: { width: meta.width, height: meta.height, channels: 4, background: PAPER } }).composite([{ input: mark, gravity: 'center' }]).png().toBuffer();
  await writeFile(file, out);
}
console.log('íconos listos');
