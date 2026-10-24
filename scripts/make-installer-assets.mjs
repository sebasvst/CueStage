/**
 * Genera las imágenes del instalador de Windows (NSIS).
 *
 *   node scripts/make-installer-assets.mjs
 *
 * Las imágenes se dibujan en un navegador (para tener el texto bien tipografiado)
 * y se guardan como BMP, que es el formato que entiende NSIS.
 */
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const outDir = join(root, 'src-tauri', 'windows');
const PORT = 5178;

const PAGE = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>CueStage · recursos</title>
<style>
  body { margin: 0; background: #fff; }
  canvas { display: block; }
</style></head>
<body>
<canvas id="header" width="150" height="57"></canvas>
<canvas id="sidebar" width="164" height="314"></canvas>
<script>
const ACCENT = '#C44A22';
const AMBER = '#F5C542';
const INK = '#17171B';
const MUTED = '#8A8A8F';

function mark(ctx, x, y, scale) {
  // Tres barras de nivel y la luz de señal, el mismo dibujo que el icono.
  const bars = [
    { h: 14, o: 0.45 },
    { h: 24, o: 0.72 },
    { h: 34, o: 1 },
  ];
  const w = 5 * scale;
  const gap = 3 * scale;
  const base = 34 * scale;
  let cx = x;
  for (const bar of bars) {
    ctx.globalAlpha = bar.o;
    ctx.fillStyle = ACCENT;
    const r = w / 2;
    const top = y + base - bar.h * scale;
    ctx.beginPath();
    ctx.roundRect(cx, top, w, bar.h * scale, r);
    ctx.fill();
    cx += w + gap;
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.arc(cx + w / 2, y - 4 * scale, 3 * scale, 0, Math.PI * 2);
  ctx.fill();
  return cx + w / 2;
}

function drawHeader() {
  const c = document.getElementById('header');
  const ctx = c.getContext('2d');
  // Un BMP de 24 bits no guarda transparencia: el fondo debe ser opaco y del
  // color de las páginas del instalador.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 150, 57);
  mark(ctx, 12, 16, 0.85);
  ctx.fillStyle = INK;
  ctx.font = '600 16px "Segoe UI", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('CueStage', 44, 29);
  ctx.fillStyle = MUTED;
  ctx.font = '400 9.5px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Música y sonidos en vivo', 45, 43);
}

function drawSidebar() {
  const c = document.getElementById('sidebar');
  const ctx = c.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 40, 314);
  bg.addColorStop(0, '#22222A');
  bg.addColorStop(0.55, '#15151A');
  bg.addColorStop(1, '#0C0C0F');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 164, 314);

  // Un halo cálido muy suave, sin degradados llamativos.
  const halo = ctx.createRadialGradient(46, 62, 6, 46, 62, 132);
  halo.addColorStop(0, 'rgba(224, 86, 45, 0.26)');
  halo.addColorStop(0.55, 'rgba(196, 74, 34, 0.08)');
  halo.addColorStop(1, 'rgba(196, 74, 34, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 164, 314);

  mark(ctx, 24, 30, 1.7);

  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#F6F6F8';
  ctx.font = '650 23px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('CueStage', 24, 106);

  ctx.fillStyle = '#A2A2AA';
  ctx.font = '400 11.5px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Música y sonidos', 24, 130);
  ctx.fillText('para actuar en vivo', 24, 146);

  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.roundRect(24, 166, 32, 3, 1.5);
  ctx.fill();

  const features = ['Prepara la música', 'Lanza los sonidos', 'Actúa con un clic'];
  ctx.font = '400 11px "Segoe UI", system-ui, sans-serif';
  features.forEach((line, index) => {
    const y = 194 + index * 20;
    ctx.fillStyle = 'rgba(245, 197, 66, 0.85)';
    ctx.beginPath();
    ctx.arc(27, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8E8E97';
    ctx.fillText(line, 38, y);
  });

  // Distintivo: la aplicación es totalmente local.
  const pillW = 116;
  const pillH = 22;
  const pillY = 270;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.beginPath();
  ctx.roundRect(24, pillY, pillW, pillH, 11);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#9A9AA2';
  ctx.font = '500 9.5px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('100 % local · sin internet', 34, pillY + 11.5);
}

drawHeader();
drawSidebar();

async function post(id, name) {
  const c = document.getElementById(id);
  const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  await fetch('/save?name=' + name, { method: 'POST', body: data });
}

(async () => {
  await post('header', 'header');
  await post('sidebar', 'sidebar');
  document.title = 'LISTO';
})();
</script></body></html>`;

mkdirSync(outDir, { recursive: true });

/** Converts raw RGBA into a 24-bit BMP (bottom-up, as NSIS expects). */
function toBmp(rgba, width, height) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelSize = rowSize * height;
  const fileSize = 54 + pixelSize;
  const buffer = Buffer.alloc(fileSize);

  buffer.write('BM', 0, 'ascii');
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(54, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(pixelSize, 34);
  buffer.writeInt32LE(2835, 38);
  buffer.writeInt32LE(2835, 42);
  buffer.writeUInt32LE(0, 46);
  buffer.writeUInt32LE(0, 50);

  let offset = 54;
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      // BMP is BGR and the alpha is ignored.
      buffer[offset] = rgba[i + 2];
      buffer[offset + 1] = rgba[i + 1];
      buffer[offset + 2] = rgba[i];
      offset += 3;
    }
    offset += rowSize - width * 3;
  }

  return buffer;
}

const saved = new Set();

const server = createServer((request, response) => {
  if (request.method === 'GET') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(PAGE);
    return;
  }

  const name = new URL(request.url, 'http://localhost').searchParams.get('name');
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => {
    const rgba = Buffer.concat(chunks);
    const sizes = { header: [150, 57], sidebar: [164, 314] };
    const size = sizes[name];
    if (!size) {
      response.writeHead(400);
      response.end('nombre desconocido');
      return;
    }
    const bmp = toBmp(rgba, size[0], size[1]);
    const target = join(outDir, `${name}.bmp`);
    writeFileSync(target, bmp);
    saved.add(name);
    console.log(`  ${name}.bmp  ${size[0]}x${size[1]}  ${(bmp.length / 1024).toFixed(1)} KB`);
    response.writeHead(200);
    response.end('ok');
    if (saved.size === 2) {
      setTimeout(() => {
        server.close();
        console.log(`\nImágenes del instalador en: ${outDir}`);
        process.exit(0);
      }, 150);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n  Generador de imágenes del instalador`);
  console.log(`  Abre http://localhost:${PORT}/ en un navegador para dibujarlas.\n`);
});
