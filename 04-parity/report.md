# Parity report: original Beekeeper Studio 6.2.0 CSV export vs AI clone

**Result: 18 of 18 cases byte-identical. 90 of 90 across five dialects (postgresql, sqlserver, mssql, mysql, cockroachdb). 11 of 11 supplementary probes identical. 0 mismatches.**
Independent re-check: `cmp` on all 18 output pairs, identical.

## Harness: the real original code, executed
- esbuild 0.24.2 bundles the real source files: `lib/export/formats/csv.ts`, `lib/export/export.ts`, `lib/data/tools.ts` (Mutators), `common/utils.ts`, `shared/lib/dialects/models.ts`. Inputs listed in `harness/bundle-inputs.txt`.
- papaparse 5.5.3 (the copy shipped in the app; matches the yarn.lock pin). lodash 4.18.1.
- Stubs: no-op logger; `vue` and `nearley` proxies (not on the CSV path); fake DB connection and cursor yielding the case rows in chunks.
- The real `CsvExporter` is constructed with the same arguments as the app backend and its real `exportToFile()` writes through real `fs.promises`; bytes are read back.
- UI defaults: options `{ chunkSize: 100, deleteOnAbort: true, includeFilter: true }`, output `{ header: true, delimiter: "," }`. Query exports get no table and late-arriving columns, exercising the original's late-header branch.
- Controls: the upstream unit-test expectation reproduces; a one-byte flip is detected.
- The clone bundles papaparse 5.4.1. The only difference between versions is parsing of the `escapeFormulae` option, which neither side sets.

## Cases
| id | match | output shows |
|---|---|---|
| basic | yes | plain |
| null_vs_empty | yes | null, "" and undefined are all an empty field |
| delimiter_in_text | yes | only the comma value is quoted |
| quotes | yes | quotes doubled |
| newlines | yes | LF, CRLF, CR values quoted; rows end LF |
| whitespace | yes | leading or trailing spaces quoted |
| unicode | yes | UTF-8, no BOM |
| numbers | yes | `1e+21`, `NaN`, `Infinity` written raw |
| bigint | yes | both lose precision: 9007199254740993 becomes 9007199254740992 |
| booleans | yes | true/false; bit(1) as 1/0 |
| dates | yes | UTC ISO with milliseconds |
| json | yes | stringified; nested BigInt becomes "9007199254740993n" |
| binary | yes | Buffer decoded as UTF-8; bit(8) as b'00000101' |
| custom_delimiter | yes | semicolon works |
| no_header | yes | header off |
| query_no_table | yes | header still written for query exports |
| empty_result | yes | header only |
| formula_injection | yes | no escaping |

## Behaviours the clone copied faithfully (arguably bugs in the original)
- BigInt precision loss at top level, while BigInt inside JSON becomes a string: one type, two treatments.
- NULL is not recoverable: NULL, empty string and undefined export identically.
- No spreadsheet formula-injection protection.
- Binary is lossy (invalid UTF-8 becomes U+FFFD); on SQL Server, bit columns write a raw control byte.
- An empty delimiter is accepted and yields a corrupt file (`"a""b"`).
- Invalid dates throw and the partial file is deleted.

## Non-visible differences
- `dialectFor`: the clone maps unknown names to themselves, the original to null. CSV only checks sqlserver, so output is unaffected. Caused by a spec gap (list of dialects not specified).
- `bitMutator` implementation differs (Array.from vs index loop); identical on realistic inputs.

## Reproduce
`cd parity/harness && node build.mjs && node run.mjs postgresql`
