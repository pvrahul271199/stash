// Runs after `next build`: injects the precache list and a content-hash version into out/sw.js.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const OUT = 'out';
if (!existsSync(join(OUT, 'sw.js'))) {
  console.error('out/sw.js not found. Run `next build` first.');
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(OUT)
  .map((p) => relative(OUT, p).split(sep).join('/'))
  .filter((f) => f !== 'sw.js' && !f.endsWith('.map') && !f.endsWith('.DS_Store'))
  .sort();

const hash = createHash('sha1');
for (const f of files) {
  hash.update(f);
  hash.update(readFileSync(join(OUT, f)));
}
const version = hash.digest('hex').slice(0, 10);

const urls = files.map((f) => {
  if (f === 'index.html') return '/';
  if (f.endsWith('/index.html')) return '/' + f.slice(0, -'index.html'.length);
  return '/' + f;
});

let sw = readFileSync(join(OUT, 'sw.js'), 'utf8');
sw = sw.replace('__VERSION__', version).replace('/*__PRECACHE__*/ []', JSON.stringify(urls));
writeFileSync(join(OUT, 'sw.js'), sw);
console.log(`sw.js: version ${version}, precaching ${urls.length} files`);
