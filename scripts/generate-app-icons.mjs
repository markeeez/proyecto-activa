import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_SVG = path.join(ROOT, 'assets', 'images', 'logos', 'logo.svg');
const OUT_DIR = path.join(ROOT, 'assets', 'images', 'app-icons');

async function loadLogoSvg({ stripBackground }) {
  let svg = (await readFile(SRC_SVG)).toString('utf8');
  if (stripBackground) {
    svg = svg.replace(/<rect[^>]*fill="black"[^>]*\/>/i, '');
  }
  return Buffer.from(svg, 'utf8');
}

const SIZE = 1024;
const BG_BLACK = { r: 0, g: 0, b: 0, alpha: 1 };

async function renderLogo({ size, padding, background, stripBackground = false }) {
  const inner = Math.round(size * (1 - padding * 2));
  const svgBuffer = await loadLogoSvg({ stripBackground });
  const logo = await sharp(svgBuffer, { density: 300, limitInputPixels: false })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const base = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  const offset = Math.round((size - inner) / 2);
  return base
    .composite([{ input: logo, top: offset, left: offset }])
    .png()
    .toBuffer();
}

async function renderMonochrome({ size, padding }) {
  const inner = Math.round(size * (1 - padding * 2));
  const svgBuffer = await loadLogoSvg({ stripBackground: true });

  const logoRgba = await sharp(svgBuffer, { density: 300, limitInputPixels: false })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = logoRgba;
  // For monochrome: keep only opaque-ish pixels, paint them solid white, drop the rest.
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 32) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
    } else {
      data[i + 3] = 0;
    }
  }

  const whiteSilhouette = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer();

  const offset = Math.round((size - inner) / 2);
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: whiteSilhouette, top: offset, left: offset }])
    .png()
    .toBuffer();
}

async function run() {
  const targets = [
    {
      file: 'icon.png',
      buffer: await renderLogo({ size: SIZE, padding: 0.12, background: BG_BLACK }),
    },
    {
      file: 'splash-icon.png',
      buffer: await renderLogo({ size: SIZE, padding: 0.10, background: undefined, stripBackground: true }),
    },
    {
      file: 'android-icon-foreground.png',
      buffer: await renderLogo({ size: SIZE, padding: 0.26, background: undefined, stripBackground: true }),
    },
    {
      file: 'android-icon-background.png',
      buffer: await sharp({
        create: { width: SIZE, height: SIZE, channels: 4, background: BG_BLACK },
      }).png().toBuffer(),
    },
    {
      file: 'android-icon-monochrome.png',
      buffer: await renderMonochrome({ size: SIZE, padding: 0.26 }),
    },
    {
      file: 'favicon.png',
      buffer: await sharp(await renderLogo({ size: 256, padding: 0.12, background: BG_BLACK }))
        .resize(48, 48)
        .png()
        .toBuffer(),
    },
  ];

  for (const { file, buffer } of targets) {
    const out = path.join(OUT_DIR, file);
    await writeFile(out, buffer);
    console.log(`✓ ${file} (${(buffer.length / 1024).toFixed(1)} KB)`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
