// Unit tests written from spec.md only.
import assert from 'node:assert/strict';
import { exportCsv } from './csvExport.mjs';

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('ok   ' + name); }
  catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + e.message.split('\n').join('\n     ')); }
}
const cols = (...names) => names.map((n) => ({ columnName: n, dataType: 'text' }));

t('A2/A3 basic header + rows, LF, trailing newline', () => {
  assert.equal(exportCsv({ columns: cols('a', 'b'), rows: [[1, 'x'], [2, 'y']] }), 'a,b\n1,x\n2,y\n');
});
t('A2 header off', () => {
  assert.equal(exportCsv({ columns: cols('a'), rows: [[1]], header: false }), '1\n');
});
t('A2 header only when zero rows', () => {
  assert.equal(exportCsv({ columns: cols('a', 'b'), rows: [] }), 'a,b\n');
});
t('A2 no columns -> no header', () => {
  assert.equal(exportCsv({ columns: [], rows: [[1]] }), '1\n');
  assert.equal(exportCsv({ columns: null, rows: [[1]] }), '1\n');
});
t('A2 query export also writes header; duplicate names kept', () => {
  assert.equal(exportCsv({ columns: cols('id', 'id'), rows: [[1, 2]], fromQuery: true }), 'id,id\n1,2\n');
});
t('A2 header names escaped', () => {
  assert.equal(exportCsv({ columns: cols('a,b', 'q"x'), rows: [] }), '"a,b","q""x"\n');
});
t('A3 multi-char delimiter', () => {
  assert.equal(exportCsv({ columns: cols('a', 'b'), rows: [[1, 2]], delimiter: '||' }), 'a||b\n1||2\n');
});
t('A3 bad delimiter falls back to comma', () => {
  for (const d of ['\n', '\r', '"', '﻿', undefined, 5]) {
    assert.equal(exportCsv({ columns: cols('a', 'b'), rows: [[1, 2]], delimiter: d }), 'a,b\n1,2\n', String(d));
  }
});
t('A3 empty delimiter quotes every field', () => {
  assert.equal(exportCsv({ columns: cols('a'), rows: [['x', 'y']], delimiter: '', header: false }), '"x""y"\n');
});
t('A3 tab delimiter', () => {
  assert.equal(exportCsv({ columns: cols('a', 'b'), rows: [['x y', 'z']], delimiter: '\t', header: false }), 'x y\tz\n');
});
t('A3 empty row -> empty line', () => {
  assert.equal(exportCsv({ columns: cols('a'), rows: [[]], header: false }), '\n');
});
t('A4 quoting rules', () => {
  const r = exportCsv({ columns: cols('a'), header: false, rows: [
    [' lead'], ['trail '], ['tab\tv'], ['cr\rx'], ['lf\nx'], ['q"x'], ['=1+1'], ['a,b'],
  ] });
  assert.equal(r, '" lead"\n"trail "\ntab\tv\n"cr\rx"\n"lf\nx"\n"q""x"\n=1+1\n"a,b"\n');
});
t('A5 scalar conversions', () => {
  const r = exportCsv({ columns: cols('a','b','c','d','e','f','g','h','i'), header: false, rows: [[
    null, undefined, '', true, false, NaN, -0, 1e21, 0.1 + 0.2,
  ]] });
  assert.equal(r, ',,,true,false,NaN,0,1e+21,0.30000000000000004\n');
});
t('A5 BigInt and Date', () => {
  const r = exportCsv({ columns: cols('a', 'b'), header: false, rows: [[12345678901234567890n, new Date(Date.UTC(2024, 0, 2, 3, 4, 5, 6))]] });
  assert.equal(r, '12345678901234567000,2024-01-02T03:04:05.006Z\n');
});
t('A5 objects/arrays JSON with BigInt as "<n>n"', () => {
  const r = exportCsv({ columns: cols('a', 'b', 'c', 'd'), header: false, rows: [[{ k: 'v', n: 1n }, [], {}, [1, 2]]] });
  assert.equal(r, '"{""k"":""v"",""n"":""1n""}",[],{},"[1,2]"\n');
});
t('A5 Buffer UTF-8 decode, Uint8Array join, empty Buffer', () => {
  const r = exportCsv({ columns: cols('a', 'b', 'c'), header: false, rows: [[Buffer.from('hi'), new Uint8Array([104, 105]), Buffer.alloc(0)]] });
  assert.equal(r, 'hi,"104,105",\n');
});
t('A5 bit(1)', () => {
  const c = [{ columnName: 'b', dataType: 'bit(1)' }];
  const r = exportCsv({ columns: c, header: false, rows: [[null], [0], [Buffer.from([1])], ['1'], [1], [Buffer.alloc(0)]] });
  assert.equal(r, '0\n0\n1\n1\n1\nNaN\n');
});
t('A5 bit(n) binary string, sqlserver passthrough', () => {
  const c = [{ columnName: 'b', dataType: 'bit(16)' }];
  assert.equal(exportCsv({ columns: c, header: false, rows: [[Buffer.from([0xa0, 0x40])], [null], ['101']] }), "b'1010000001000000'\n\n101\n");
  assert.equal(exportCsv({ columns: [{ columnName: 'b', dataType: 'bit' }], header: false, rows: [[Buffer.from([1])]], dialect: 'mysql' }), "b'00000001'\n");
  assert.equal(exportCsv({ columns: [{ columnName: 'b', dataType: 'bit' }], header: false, rows: [[Buffer.from([0x41])], [true]], dialect: 'mssql' }), 'A\ntrue\n');
});
t('A5 json column stays generic', () => {
  const c = [{ columnName: 'j', dataType: 'jsonb' }];
  assert.equal(exportCsv({ columns: c, header: false, rows: [[{ a: 1 }], ['{"a":1}']] }), '"{""a"":1}"\n"{""a"":1}"\n');
});
t('A6 no BOM', () => {
  assert.notEqual(exportCsv({ columns: cols('a'), rows: [] }).charCodeAt(0), 0xfeff);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
