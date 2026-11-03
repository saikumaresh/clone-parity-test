# csvExport clone (clean room)

Standalone Node ES module that reproduces the **file export** CSV writer (Path A in `../spec.md`:
Export modal, table export, multi-table export, Query-to-File). It does not cover the grid
"Download as CSV" (Path B). Only `../spec.md` was used as input.

## Usage

```js
import { exportCsv } from './csvExport.mjs';
exportCsv({ columns, rows, header = true, delimiter = ',', fromQuery = false, dialect = undefined }) // -> string
```

Dependency: `papaparse@5.4.1` from npm, the library named in the spec. Each row goes through
`Papa.unparse([row], { delimiter })` one at a time. The library handles the delimiter fallback and
quoting/escaping (spec A3/A4) without changes.

## What it does
- Header (A2): written only if `columns` is truthy and non-empty and `header` is truthy. It is `Papa.unparse([names])` plus `"\n"`. Header and data use the same delimiter and escaping. Duplicate names are kept.
- Rows (A1/A3): each row is `Object.values(row)` run through the mutators, then `Papa.unparse([row])` plus `"\n"`. Every line, including the last, ends with LF. No BOM. No footer. Empty rows give an empty line.
- Mutators (A5): `bit(1)` -> bit1Mutator, `bit*` -> bitMutator(dialect), everything else (json included) -> genericMutator with preserveComplex=false. That means BigInt -> Number, Date -> ISO string, array/object -> compact JSON with BigInt as `"<digits>n"`, and Buffer/Uint8Array/scalars unchanged. papaparse's `toString()` then does the UTF-8 decode for Buffer and the comma-join for Uint8Array.
- `dialect` goes through `dialectFor` (A5 alias table: mssql->sqlserver, mariadb/tidb->mysql, and so on).

## Choices on INFERRED / UNKNOWN / ambiguous points
1. **papaparse version**: the spec names no version. I used 5.4.1. The spec's `unpackConfig`/`safe` description matches it.
2. **`dialect` parameter**: it can be a connectionType or a dialect name. Both go through `dialectFor`. The spec does not list the "known" dialect set, so any other non-empty string maps to itself and empty/undefined maps to null. Only `sqlserver` changes the output.
3. **`fromQuery`**: has no effect on output. The spec (A2) says `headerConfig.header = !!table` is ignored on the array-of-arrays path. It is still passed to papaparse for the header call, which matches the spec.
4. **Non-string delimiter** (INFERRED in spec): passed to papaparse, which falls back to `,`. Tested with `undefined` and `5`.
5. **bitMutator with non-byte values on non-sqlserver dialects** (`true`, numbers): the spec only defines byte sequences. I use `Array.from(value)`, which gives no bytes, so the output is `b''`. Unverified.
6. **bit(1) with `true`**: gives `NaN` (`Number(true[0])`), as the spec infers.
7. **Missing/non-string `dataType`**, or a row longer than `columns`: uses genericMutator. The original would probably throw on `undefined.startsWith`. Unverified.
8. **Invalid Date**: `toISOString()` throws RangeError and `exportCsv` throws. The original export would error out and unlink the file.
9. **Non-object row values** (e.g. a bare string as a row): passed to papaparse unchanged. Driver row shape is UNKNOWN in the spec, and the API says rows are arrays.
10. **Object rows**: `Object.values` order is used, not column order (spec A7).
11. Check order inside genericMutator (null, BigInt, Date, ArrayBuffer view, array/object, other) is my own. The spec gives a table, not the order. The order only matters for overlapping types, and none overlap here.
12. Chunking, file handling, abort/unlink (A1/A7) don't affect the bytes, so they are not modelled. The function returns the full string.

## Testing
`node test.mjs` (or `npm test`) runs 20 tests taken from the spec's examples and tables:
header rules, delimiters (multi-char, invalid, empty, tab), quoting triggers, scalar/BigInt/Date/JSON/Buffer/Uint8Array
conversions, bit(1), bit(n), the sqlserver passthrough, json columns, and no BOM. Result: **20 passed, 0 failed**.
