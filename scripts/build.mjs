// dist/ = web lista para Render y para el APK.
//  - Render: `npm run build` → dist/ + dist/update/{version.json, feynman-<v>.zip} (lo que las apps bajan).
//  - APK (APK=1): mete private/seed.js (tus datos y claves, NUNCA en el repo) y no genera dist/update.
// FORCE=1 permite que las apps bajen a una versión menor (para revertir). NOTES="..." agrega notas.
import { build } from 'esbuild';
import { cp, rm, mkdir, readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { zipSync } from 'fflate';
import pkg from '../package.json' with { type: 'json' };

const apk = process.env.APK === '1';
await rm('dist', { recursive: true, force: true });
await cp('web', 'dist', { recursive: true });
await build({ entryPoints: ['src/ota.js'], bundle: true, minify: true, format: 'iife', target: 'es2019', outfile: 'dist/ota.js', define: { __APP_VERSION__: JSON.stringify(pkg.version) } });

async function collect(dir, prefix = '') {
  const out = {};
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === 'update') continue;
    if (e.isDirectory()) Object.assign(out, await collect(`${dir}/${e.name}`, `${prefix}${e.name}/`));
    else out[prefix + e.name] = new Uint8Array(await readFile(`${dir}/${e.name}`));
  }
  return out;
}

if (!apk) {
  const files = await collect('dist');
  const zip = zipSync(files, { level: 9 });
  const name = `feynman-${pkg.version}.zip`;
  await mkdir('dist/update', { recursive: true });
  await writeFile(`dist/update/${name}`, zip);
  const checksum = createHash('sha256').update(zip).digest('hex');
  const force = ['1', 'true'].includes(String(process.env.FORCE || '').toLowerCase());
  await writeFile('dist/update/version.json', JSON.stringify({ version: pkg.version, url: name, checksum, notes: process.env.NOTES || '', ...(force ? { force: true } : {}) }, null, 2));
  console.log(`update ${pkg.version}: ${name} (${((await stat(`dist/update/${name}`)).size / 1024).toFixed(0)} KB, ${Object.keys(files).length} archivos)`);
} else {
  if (!existsSync('private/seed.js')) throw new Error('Falta private/seed.js');
  const keys = existsSync('private/keys.json') ? await readFile('private/keys.json', 'utf8') : '{}';
  await writeFile('dist/seed.js', (await readFile('private/seed.js', 'utf8')) + `\nObject.assign(window.__FEYNMAN_DISK_BACKUP__, ${keys});\n`);
  console.log('APK: dist listo con seed privado (versión ' + pkg.version + ')');
}
