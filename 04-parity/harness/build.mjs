import * as esbuild from 'esbuild';
import { createRequire } from 'module'; const require_ = (m) => createRequire('/home/claude/rea-test/appx/package.json').resolve(m);
import path from 'path';
const SRC = '/home/claude/vault/bk-source/beekeeper-studio-6.2.0/apps/studio';
const APPX = '/home/claude/rea-test/appx/node_modules';
const H = path.dirname(new URL(import.meta.url).pathname);
const stubbed = [];
const plugin = { name: 'bks', setup(b) {
  b.onResolve({ filter: /^@bksLogger$/ }, () => ({ path: H + '/stubs/logger.js' }));
  b.onResolve({ filter: /^@shared\// }, a => ({ path: res(SRC + '/src/shared/' + a.path.slice(8)) }));
  b.onResolve({ filter: /^@\// }, a => ({ path: res(SRC + '/src/' + a.path.slice(2)) }));
  b.onResolve({ filter: /^(papaparse|lodash)$/ }, a => ({ path: APPX + '/' + a.path + '/' + (a.path==='papaparse'?'papaparse.js':'lodash.js') }));
  b.onResolve({ filter: /^[^./]/ }, a => {
    if (a.path === 'sql-formatter') return { path: require_('sql-formatter') };
    if (['fs','path','crypto','stream','os','util','events'].includes(a.path)) return { external: true };
    stubbed.push(a.path + '  <- ' + path.relative(SRC, a.importer)); return { path: H + '/stubs/generic.js' };
  });
}};
import fs from 'fs';
function res(p) { for (const ext of ['', '.ts', '.js', '/index.ts', '/index.js']) { if (fs.existsSync(p+ext) && fs.statSync(p+ext).isFile()) return p+ext; } throw new Error('unresolved '+p); }
await esbuild.build({ entryPoints: [H + '/entry.ts'], bundle: true, platform: 'node', format: 'cjs', target: 'node22', outfile: H + '/original.bundle.cjs', plugins: [plugin], logLevel: 'warning', metafile: true }).then(r => {
  fs.writeFileSync(H + '/bundle-inputs.txt', Object.keys(r.metafile.inputs).join('\n') + '\n\nSTUBBED BARE IMPORTS:\n' + [...new Set(stubbed)].join('\n') + '\n');
});
console.log('built');
