import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IMG = (name) => path.join(ROOT, 'assets', 'images', 'app-icons', name);
const OUT = (name) => path.join(ROOT, 'assets', 'images', `_preview_${name}`);

async function over(file, bg) {
  return sharp({
    create: { width: 1024, height: 1024, channels: 4, background: bg },
  })
    .composite([{ input: IMG(file) }])
    .png()
    .toBuffer();
}

await sharp(await over('splash-icon.png', { r: 0, g: 0, b: 0, alpha: 1 })).toFile(OUT('splash_on_black.png'));
await sharp(await over('android-icon-foreground.png', { r: 0, g: 0, b: 0, alpha: 1 })).toFile(OUT('fg_on_black.png'));
await sharp(await over('android-icon-monochrome.png', { r: 50, g: 50, b: 50, alpha: 1 })).toFile(OUT('mono_on_grey.png'));
console.log('previews ok');
