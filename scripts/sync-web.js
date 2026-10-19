const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const www = path.join(root, 'www');
const vendorDest = path.join(www, 'vendor', 'skyengine');

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else copyFile(src, dest);
  }
}

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });

const html = fs.readFileSync(path.join(root, 'poc', 'index.html'), 'utf8')
  .replaceAll('../vendor/skyengine/', 'vendor/skyengine/');
fs.writeFileSync(path.join(www, 'index.html'), html);

[
  'adapter.js',
  'app.js',
  'events.js',
  'home.js',
  'celestial.js'
].forEach((name) => {
  copyFile(path.join(root, 'poc', name), path.join(www, name));
});

copyDir(path.join(root, 'poc', 'styles'), path.join(www, 'styles'));
copyDir(path.join(root, 'poc', 'data'), path.join(www, 'data'));
copyDir(path.join(root, 'poc', 'assets'), path.join(www, 'assets'));
copyDir(path.join(root, 'poc', 'vendor'), path.join(www, 'vendor'));
copyDir(path.join(root, 'vendor', 'skyengine'), vendorDest);

const index = fs.readFileSync(path.join(www, 'index.html'), 'utf8');
if (index.includes('../vendor/') || !index.includes('vendor/skyengine/sky-engine.js')) {
  throw new Error('Mobile page is still pointing outside the app bundle.');
}
if (!fs.existsSync(path.join(www, 'styles', 'tokens.css'))) {
  throw new Error('Design tokens were not copied into www/.');
}
if (!fs.existsSync(path.join(www, 'data', 'events.json'))) {
  throw new Error('Event catalogue was not copied into www/.');
}
if (!fs.existsSync(path.join(www, 'assets', 'moon_small.glb'))) {
  throw new Error('Moon GLB was not copied into www/assets.');
}
if (!fs.existsSync(path.join(www, 'vendor', 'model-viewer', 'model-viewer-umd.min.js'))) {
  throw new Error('model-viewer was not copied into www/vendor.');
}
console.log('Copied Unite web app (events + sky + moon) into www/.');
