/**
 * Key near-black backgrounds to alpha for celestial PNGs (in place).
 * Safe for circular planets and Saturn rings / galaxy frames.
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const dir = path.join(__dirname, '..', 'poc', 'assets', 'celestial', 'images');
const files = [
  'Mercury.png', 'Venus.png', 'Mars.png', 'Jupiter.png', 'Saturn.png',
  'Uranus.png', 'Neptune.png', 'Moon.png', 'Sun.png',
  'Andromeda.png', 'Sombrero.png', 'Triangulum.png', 'Pinwheel.png'
];

const HARD = 14;   // fully transparent below this luminance
const SOFT = 28;   // feather up to this

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function cutout(file) {
  const full = path.join(dir, file);
  if (!fs.existsSync(full)) {
    console.log('skip missing', file);
    return;
  }
  const png = PNG.sync.read(fs.readFileSync(full));
  const { width, height, data } = png;
  let cleared = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = luminance(r, g, b);
    const mx = Math.max(r, g, b);
    // Near-black key (background). Keep dark maria / shadows that aren't pure black.
    if (lum <= HARD && mx <= HARD + 6) {
      data[i + 3] = 0;
      cleared += 1;
    } else if (lum < SOFT && mx < SOFT + 10) {
      const t = (lum - HARD) / (SOFT - HARD);
      data[i + 3] = Math.max(0, Math.min(255, Math.round(data[i + 3] * t)));
      if (data[i + 3] < 8) {
        data[i + 3] = 0;
        cleared += 1;
      }
    }
  }
  fs.writeFileSync(full, PNG.sync.write(png));
  console.log(file, width + 'x' + height, 'cleared~', cleared);
}

files.forEach(cutout);
console.log('done');
