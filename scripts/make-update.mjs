// Después de `vite build`: crea dist/update/feynman-<versión>.zip y version.json (lo que las apps instaladas bajan de Render).
// FORCE=1 permite bajar a una versión menor (revertir). NOTES="..." agrega notas.
// dist/update es solo para Render: el paso del APK debe excluirlo (ver scripts/apk.mjs).
import { readdir, readFile, rm, mkdir, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { zipSync } from 'fflate';
import pkg from '../package.json' with { type: 'json' };

async function collect(dir, prefix = '') {
  const out = {};
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === 'update') continue;
    if (e.isDirectory()) Object.assign(out, await collect(`${dir}/${e.name}`, `${prefix}${e.name}/`));
    else out[prefix + e.name] = new Uint8Array(await readFile(`${dir}/${e.name}`));
  }
  return out;
}
await rm('dist/update', { recursive: true, force: true });
const files = await collect('dist');
const zip = zipSync(files, { level: 9 });
const name = `feynman-${pkg.version}.zip`;
await mkdir('dist/update', { recursive: true });
await writeFile(`dist/update/${name}`, zip);
const checksum = createHash('sha256').update(zip).digest('hex');
const force = ['1', 'true'].includes(String(process.env.FORCE || '').toLowerCase());
await writeFile('dist/update/version.json', JSON.stringify({ version: pkg.version, url: name, checksum, notes: process.env.NOTES || '', ...(force ? { force: true } : {}) }, null, 2));
console.log(`update ${pkg.version}: ${name} (${((await stat(`dist/update/${name}`)).size / 1024).toFixed(0)} KB, ${Object.keys(files).length} archivos)`);
