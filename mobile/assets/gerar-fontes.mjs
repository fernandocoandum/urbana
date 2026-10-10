// Gera as imagens-fonte do ícone e da tela de abertura (assets/*.png) a partir do desenho da
// Urbaninha (o mesmo de src/features/urbaninha/urbaninha-mascote.tsx). Depois: npm run assets.
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const MASCOTE = `
  <defs><linearGradient id="c" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#5b8cff"/><stop offset="1" stop-color="#1d4fc9"/></linearGradient></defs>
  <path d="M32 17V9.5" stroke="#dbe6ff" stroke-width="3" stroke-linecap="round"/>
  <circle cx="32" cy="7" r="4" fill="#ffc93c"/>
  <ellipse cx="54.5" cy="44" rx="4.6" ry="4.2" fill="#8fb0ff" stroke="#fff" stroke-opacity=".9" stroke-width="1.6"/>
  <path d="M32 70C25 61 12 50 12 36a20 20 0 0 1 40 0c0 14-13 25-20 34Z" fill="url(#c)" stroke="#fff" stroke-opacity=".9" stroke-width="1.6"/>
  <ellipse cx="22" cy="23" rx="5" ry="3" fill="#fff" opacity=".28" transform="rotate(-30 22 23)"/>
  <ellipse cx="32" cy="37.5" rx="14.5" ry="12" fill="#f5f8ff"/>
  <ellipse cx="26.5" cy="36" rx="2.3" ry="3" fill="#0f172a"/><circle cx="27.3" cy="34.9" r=".8" fill="#fff"/>
  <ellipse cx="37.5" cy="36" rx="2.3" ry="3" fill="#0f172a"/><circle cx="38.3" cy="34.9" r=".8" fill="#fff"/>
  <ellipse cx="22.2" cy="41.5" rx="2.4" ry="1.6" fill="#ff8fa3" opacity=".75"/>
  <ellipse cx="41.8" cy="41.5" rx="2.4" ry="1.6" fill="#ff8fa3" opacity=".75"/>
  <path d="M28.5 41.6Q32 45.2 35.5 41.6" stroke="#0f172a" stroke-width="1.8" stroke-linecap="round" fill="none"/>`;

const fundo = (lado) => `
  <defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2563eb"/><stop offset=".55" stop-color="#1d4fc9"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient></defs>
  <rect width="${lado}" height="${lado}" fill="url(#f)"/>`;

/** Mascote com altura `alt` centralizado num quadrado de `lado`. */
const mascote = (lado, alt) => {
  const esc = alt / 72;
  const x = (lado - 64 * esc) / 2;
  const y = (lado - 72 * esc) / 2;
  return `<g transform="translate(${x} ${y}) scale(${esc})">${MASCOTE}</g>`;
};
const svg = (lado, corpo) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">${corpo}</svg>`);

const saidas = {
  // ícone adaptativo: o Android corta ~1/3 das bordas, então o mascote ocupa só o miolo
  'icon-foreground.png': svg(1024, mascote(1024, 520)),
  'icon-background.png': svg(1024, fundo(1024)),
  'icon-only.png': svg(1024, fundo(1024) + mascote(1024, 700)),
  'splash.png': svg(2732, fundo(2732) + mascote(2732, 900)),
  'splash-dark.png': svg(2732, fundo(2732) + mascote(2732, 900)),
};
for (const [nome, buf] of Object.entries(saidas)) {
  await sharp(buf).png().toFile(fileURLToPath(new URL(nome, import.meta.url)));
  console.log('ok', nome);
}
