// Parity runner. ORIGINAL = real Beekeeper 6.2.0 CsvExporter/Export/Mutators bundled by build.mjs.
import { createRequire } from 'module';
import fs from 'fs'; import os from 'os'; import path from 'path';
const require = createRequire(import.meta.url);
const orig = require('./original.bundle.cjs');
const { exportCsv } = await import('/home/claude/rea-test/builder/clone/csvExport.mjs');
const { cases } = await import(process.env.CASES ?? '/home/claude/rea-test/parity/cases.mjs');

const connType = process.argv[2] ?? 'postgresql';      // connection.connectionType; "none" => undefined
const outRoot = process.argv[3] ?? '/home/claude/rea-test/parity/out';
const ct = connType === 'none' ? undefined : connType;

class FakeCursor {           // stands in for BeeCursor (PsqlCursor-like: rowMode array, chunked)
  constructor(rows, cols, colsAfterRead, chunkSize) { this.rows = rows; this.cols = cols; this.colsAfterRead = colsAfterRead; this.chunkSize = chunkSize; this.pos = 0; this.readOnce = false; }
  get columns() { return (!this.colsAfterRead || this.readOnce) ? this.cols : null; }
  async start() {}
  async read() { this.readOnce = true; const r = this.rows.slice(this.pos, this.pos + this.chunkSize); this.pos += r.length; return r; }
  async cancel() {} async close() {}
}
function fakeConnection(c) {
  return {
    connectionType: ct,
    // table export: columns known up front (like postgresql.selectTopStream -> listTableColumns)
    async selectTopStream(table, orderBy, filters, chunkSize, schema) { return { columns: c.columns, totalRows: c.rows.length, cursor: new FakeCursor(c.rows, c.columns, false, chunkSize) }; },
    // query export: only a cursor; columns appear after first read (like postgresql.queryStream/PsqlCursor)
    async queryStream(query, chunkSize) { return { cursor: new FakeCursor(c.rows, c.columns, true, chunkSize) }; },
  };
}
async function runOriginal(c, file) {
  const header = c.header ?? true, delimiter = c.delimiter ?? ',';
  const table = c.fromQuery ? undefined : { name: 'parity_' + c.id, schema: 'public', entityType: 'table' };
  const ex = new orig.CsvExporter(file, fakeConnection(c), table, c.fromQuery ? 'select * from x' : undefined,
    c.fromQuery ? 'Query #1' : undefined, [], { chunkSize: 100, deleteOnAbort: true, includeFilter: true },
    { header, delimiter }, false);
  globalThis.__bksErrors = [];
  await ex.exportToFile();
  if (ex.status !== 'completed') return { error: `status=${ex.status} ${ex.error && (ex.error.stack || ex.error)}` };
  return { buf: fs.readFileSync(file) };
}
function runClone(c) {
  try { return { buf: Buffer.from(exportCsv({ columns: c.columns, rows: c.rows, header: c.header ?? true, delimiter: c.delimiter ?? ',', fromQuery: !!c.fromQuery, dialect: ct }), 'utf8') }; }
  catch (e) { return { error: String(e.stack || e) }; }
}
const esc = b => [...b.toString('utf8')].map(ch => ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : ch === '\t' ? '\\t' : ch).join('');
fs.mkdirSync(outRoot + '/original', { recursive: true }); fs.mkdirSync(outRoot + '/clone', { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bkcsv-'));
const results = [];
for (const c of cases) {
  const o = await runOriginal(c, path.join(tmp, c.id + '.csv'));
  const k = runClone(c);
  if (o.buf) fs.writeFileSync(`${outRoot}/original/${c.id}.csv`, o.buf); else fs.writeFileSync(`${outRoot}/original/${c.id}.csv.error.txt`, o.error);
  if (k.buf) fs.writeFileSync(`${outRoot}/clone/${c.id}.csv`, k.buf); else fs.writeFileSync(`${outRoot}/clone/${c.id}.csv.error.txt`, k.error);
  const match = !!(o.buf && k.buf && Buffer.compare(o.buf, k.buf) === 0) || (!!o.error && !!k.error);
  results.push({ id: c.id, match, oLen: o.buf?.length, kLen: k.buf?.length, orig: o.buf ? esc(o.buf) : 'ERROR ' + o.error, clone: k.buf ? esc(k.buf) : 'ERROR ' + k.error });
}
for (const r of results) console.log(`${r.match ? 'MATCH   ' : 'MISMATCH'} ${r.id.padEnd(18)} orig=${r.oLen} clone=${r.kLen}\n   O: ${r.orig}\n   C: ${r.clone}`);
console.log(`connectionType=${connType} total=${results.length} match=${results.filter(r=>r.match).length} mismatch=${results.filter(r=>!r.match).length}`);
fs.writeFileSync(`${outRoot}/results-${connType}.json`, JSON.stringify(results, null, 1));
