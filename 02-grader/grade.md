# Grade: analyst CSV-export spec vs Beekeeper Studio 6.2.0 source

Source root: `apps/studio/` (paths below are relative to it). Libraries: papaparse 5.5.3 (yarn.lock:11154, read from `rea-test/appx/node_modules/papaparse/papaparse.js`), tabulator-tables 6.7.1 (yarn.lock:13098, read from `rea-test/appx/node_modules/tabulator-tables/src`).

Short file aliases: **EXP** = `src/lib/export/export.ts`, **CSV** = `src/lib/export/formats/csv.ts`, **TOOLS** = `src/lib/data/tools.ts`, **PP** = `papaparse.js`, **HND** = `src-commercial/backend/handlers/exportHandlers.ts`, **MODAL** = `src/components/export/ExportModal.vue`, **FORM** = `src/components/export/forms/ExportFormCSV.vue`, **RT** = `src/components/editor/ResultTable.vue`, **TDL** = tabulator `modules/Download/Download.js`, **TCSV** = tabulator `modules/Download/defaults/downloaders/csv.js`, **TEXP** = tabulator `modules/Export/Export.js`.

Confidence is my confidence in the verdict, not in the spec.

## 1. Line-by-line verdicts

### Section 0 and A1: writers, entry point, data flow

| # | Spec claim (tag) | Verdict | Evidence | Conf |
|---|---|---|---|---|
| 1 | Two writers. A is utility-side `CsvExporter` via papaparse (SEEN) | CORRECT | CSV 1-58; HND 23-28 | 99% |
| 2 | B is the grid "Download as CSV" via the Tabulator csv downloader, no papaparse (SEEN) | CORRECT | RT 1041-1094; TCSV | 99% |
| 3 | Renderer sends `export/add` with that payload, then `export/start` (SEEN) | CORRECT | MODAL 307-317; ExportManager.vue 60-65 | 98% |
| 4 | Handler builds `new CsvExporter(...)` with `filters\|\|[]` and calls `exportToFile` (SEEN) | CORRECT | HND 53-65, 108-119 | 99% |
| 5 | Defaults `{chunkSize:100, deleteOnAbort:true, includeFilter:true}`, CSV `{header:true, delimiter:','}`, labels "Field Delimitor" and "Include Header" (SEEN) | CORRECT | MODAL 208; importexportdatabase/ExportOptions.vue 155; FORM 4, 25, 41-42 | 99% |
| 6 | initExport / exportData / finalizeExport pseudocode (SEEN) | CORRECT | EXP 126-229 | 98% |
| 7 | CSV keeps `needsFinalSeparator=true`, `rowSeparator="\n"`, so every row ends in LF (SEEN) | CORRECT | EXP 53, 196-206; CSV 15; integration test `tests/vitest/.../csv.spec.js` expects `'name\nfoo\nbar\n"ba\nz"\n'` | 99% |
| 8 | One `write` per row, no buffering, chunk size does not change bytes (SEEN) | CORRECT | EXP 197-205 | 97% |
| 9 | "On an error, or on abort with deleteOnAbort, the file is unlinked" (SEEN) | PARTLY CORRECT | EXP 239-251. The error path also unlinks **only if** `deleteOnAbort`. With it off, a partial file stays on disk. The sentence reads as if errors always delete. Abort-after-current-chunk and footer skip are right (EXP 214-224). | 90% |
| 10 | UNKNOWN: row shape (arrays vs objects) and `columns` / `dataType` strings per driver | Source answers it | pg `rowMode:'array'` (postgresql/PsqlCursor.ts 47), mysql `rowsAsArray:true` (mysql/MySqlCursor.ts 53), sqlite `statement.raw(true)` (sqlite/SqliteCursor.ts 42). All arrays. The dataType sources differ by path; see Miss M3. | 90% |

### A2: header

| # | Claim | Verdict | Evidence | Conf |
|---|---|---|---|---|
| 11 | Header only if columns are truthy, non-empty and `outputOptions.header`. Then unparse + `"\n"` (SEEN) | CORRECT | CSV 43-49 | 99% |
| 12 | `headerConfig.header = !!table` has no effect (array-of-arrays branch) (SEEN) | CORRECT | CSV 36; PP 307-308, 397 | 98% |
| 13 | Query header comes from `cursor.columns` after the first read. If absent, no header (SEEN) | CORRECT | EXP 156-158, 182-186. Every `queryStream` returns no `columns` (postgresql.ts 1022-1035, sqlite.ts 510-514) | 95% |
| 14 | Same `safe()` rules and delimiter for header. Duplicate names written as-is (SEEN) | CORRECT | CSV 46-47; `dedupedColumns` used only in EXP 60-80 | 97% |
| 15 | Header on, zero rows gives header + LF (SEEN) | CORRECT | CSV 47 | 97% |

### A3: delimiter, separators

| # | Claim | Verdict | Evidence | Conf |
|---|---|---|---|---|
| 16 | Delimiter must be a string with none of CR, LF, `"`, BOM, else `,`. Multi-char allowed (SEEN) | CORRECT | PP 68, 345-349 | 99% |
| 17 | Empty delimiter is accepted and **every field** gets quoted (SEEN) | PARTLY CORRECT | PP 453-454: `null`/`undefined` return `''` before the quote test, so NULL cells stay empty and unquoted. Non-null fields are quoted (`indexOf("")` is 0). | 95% |
| 18 | Non-string delimiter gives `,` (INFERRED) | CORRECT | PP 345 | 98% |
| 19 | Row separator always LF; papaparse `_newline` never used (SEEN) | CORRECT | CSV 47, 55; PP 441 (only between rows of one call) | 98% |
| 20 | Trailing LF after the last row and after the header; nothing before; footer `""` (SEEN) | CORRECT | EXP 204, 226-227; CSV 52 | 99% |
| 21 | Zero-length row gives an empty line (INFERRED) | CORRECT | PP 419, 436 give `""`; EXP 204 adds LF | 95% |

### A4: quoting

| # | Claim | Verdict | Evidence | Conf |
|---|---|---|---|---|
| 22 | `safe()` pseudocode with defaults; no overrides passed (SEEN) | CORRECT | PP 451-477; CSV 19-21, 35-40 | 99% |
| 23 | Only leading/trailing U+0020 quotes; tab unquoted; lone CR quoted; LF raw in quotes; only quote-doubling (SEEN) | CORRECT | PP 472-475 | 98% |
| 24 | No formula-injection escaping (SEEN) | CORRECT | `escapeFormulae` absent from CSV configs; PP 296, 461 | 99% |
| 25 | Check runs after doubling; no practical effect (SEEN + INFERRED) | CORRECT | PP 466-472 | 97% |

### A5: value conversion

| # | Claim | Verdict | Evidence | Conf |
|---|---|---|---|---|
| 26 | `_.isObject(row)` gives `Object.values(row)`, mapped by index to `columns[i].dataType` (SEEN) | CORRECT | TOOLS 36-44; EXP 191 | 99% |
| 27 | Mutator selection order; json only if mutateJSON, false for CSV (SEEN) | CORRECT | TOOLS 22-33, 42 | 99% |
| 28 | `dialectFor` mapping (SEEN) | CORRECT | `src/shared/lib/dialects/models.ts` 27-48 (also greengage, starrocks; covered by "map to themselves") | 97% |
| 29 | null/undefined/""/boolean/number rows of the table (SEEN) | CORRECT | TOOLS 54-65; PP 453 | 98% |
| 30 | BigInt goes to `Number(v)` with precision loss (SEEN) | CORRECT | TOOLS 59 | 99% |
| 31 | Date goes to `toISOString()` (SEEN) | CORRECT | TOOLS 60 | 99% |
| 32 | Array/object go to `JSON.stringify` with BigInt as `"<digits>n"` (SEEN) | CORRECT | TOOLS 61-62; `src/common/utils.ts` 297-302. No `BigInt.prototype.toJSON` in the utility process (only `src-commercial/entrypoints/renderer.ts` 31 imports it) | 95% |
| 33 | Buffer passes through, then UTF-8 decode via `toString()` (SEEN) | CORRECT | TOOLS 56-57; PP 466 | 97% |
| 34 | Non-Buffer Uint8Array gives `"104,105"` quoted (SEEN) | CORRECT | same | 97% |
| 35 | Empty Buffer gives an empty field (SEEN) | CORRECT | same | 95% |
| 36 | Compact JSON; inner `"` become `\""` after doubling (SEEN) | CORRECT | utils.ts 298 | 97% |
| 37 | json/jsonb get generic treatment (SEEN) | CORRECT | TOOLS 29, 42 | 98% |
| 38 | bit(1): falsy gives 0 (NULL exports as `0`) (SEEN) | CORRECT | TOOLS 72-73 | 99% |
| 39 | bit(1): number unchanged, else `Number(v[0])`; `true` and empty Buffer give NaN (SEEN/INFERRED) | CORRECT | TOOLS 76-78 | 98% |
| 40 | bitMutator: falsy unchanged; sqlserver unchanged; string unchanged (SEEN) | CORRECT | TOOLS 91-96 | 99% |
| 41 | Else 8-bit binary per byte as `b'...'` (SEEN) | CORRECT | TOOLS 10-12, 98-103. Not mentioned: number or boolean input gives `b''` (see M12). | 97% |
| 42 | UNKNOWN: which JS types drivers return | Source partly answers it | pg DATE, TIMESTAMP, TIMESTAMPTZ and INTERVAL are kept as raw text (postgresql.ts 1731-1734). MySQL uses `dateStrings`, `supportBigNumbers`, `bigNumberStrings` (mysql.ts 285-287). The Date and BigInt branches are rarely hit on these drivers. | 85% |

### A6 and A7

| # | Claim | Verdict | Evidence | Conf |
|---|---|---|---|---|
| 43 | `write(string)` with no encoding gives UTF-8 (SEEN/INFERRED) | CORRECT | EXP 166, 199 | 97% |
| 44 | No BOM (SEEN) | CORRECT | CSV has none; PP BOM only in BAD_DELIMITERS | 99% |
| 45 | `"w+"` truncation; name and extension from the renderer (SEEN) | CORRECT | EXP 131; MODAL 241-263 | 98% |
| 46 | No per-dialect writer rule beyond bit/sqlserver and dialectFor (SEEN) | CORRECT for the writer | TOOLS 93. Dialect still changes bytes through driver dataType strings (M3). | 85% |
| 47 | Object row with colliding keys loses columns (INFERRED) | CORRECT as logic, moot in practice | All shipped cursors return arrays (item 10) | 85% |
| 48 | `skipEmptyLines` unset (SEEN) | CORRECT | CSV 19-21, 35-38 | 99% |

### Path B

| # | Claim | Verdict | Evidence | Conf |
|---|---|---|---|---|
| 49 | Filename `${snakeCase(title) \|\| 'query_results'}-yyyy-mm-dd_hMMss.csv` (SEEN) | PARTLY CORRECT | RT 1043-1044 tests `this.query.title ?` **before** snakeCase. A title like `"!!!"` gives `-<date>.csv`, not `query_results-...`. Date mask `hMMss` is right. | 92% |
| 50 | Third arg `'all'` lands in downloader **options**. Delimiter `,`, no BOM, range falls to `downloadRowRange` `'active'` (SEEN) | CORRECT | RT 1094; TDL 19, 49-83 | 97% |
| 51 | Active means the currently filtered and sorted rows (INFERRED) | CORRECT | TDL 19, 83 | 90% |
| 52 | `downloadConfig:{columnHeaders:true}` (SEEN) | CORRECT | RT 278-280 | 99% |
| 53 | Header is `titleDownload \|\| title`; `titleDownload = escapeHtml(name)`; empty name gives null and falls back (SEEN) | CORRECT | RT 552; `src/shared/lib/tabulator.ts` 14-16; TEXP 114 | 97% |
| 54 | `Ire` pseudocode (SEEN) | CORRECT | TCSV 1-61 | 99% |
| 55 | Every field quoted (nulls too), LF, no trailing newline, group/calc skipped (SEEN) | CORRECT | TCSV 8-14, 29-41, 52 | 99% |
| 56 | Column mutator is `resolveTabulatorMutator` with preserveComplex and mutateJSON true (SEEN) | CORRECT | TOOLS 17-20; RT 555 | 98% |
| 57 | Uint8Array gives `{"0":104,...}`; BigInt gives Number; json goes through `friendlyJsonObject` (SEEN) | CORRECT | TOOLS 56-62, 108-116; TCSV 32-34 | 93% |
| 58 | "A BigInt nested inside an object makes JSON.stringify throw" (INFERRED) | **WRONG** | The renderer installs `BigInt.prototype.toJSON` (`src/common/initializers/big_int_initializer.ts` 16, imported at `src-commercial/entrypoints/renderer.ts` 31), so a nested BigInt serialises as `"123"`. Also, with preserveComplex, `genericMutator` already maps nested BigInt to Number (TOOLS 61-62). The harness lacked the initializer. | 92% |
| 59 | No `accessorDownload`; values are the mutated values (SEEN/INFERRED) | CORRECT | RT 544-570 | 92% |
| 60 | Default `downloadEncoder` is a Blob with `text/csv`; UTF-8, no BOM (SEEN/INFERRED) | CORRECT | TDL 15-17 | 95% |
| 61 | UNKNOWN: how the Blob is saved | Source answers it | TDL 107-133 uses a hidden `<a download>` with an object URL. The app has no `will-download` handler (grep of src and src-commercial), so Electron's default save flow writes the Blob bytes unchanged. | 85% |
| 62 | UNKNOWN: whether row-header or other no-field columns are included | Source answers it: excluded | Row header has `download:false` (`src/common/tabulator.ts` 74-84, kept by `_.merge` at 94). The internal tracker column has `download:false` (RT 220-231). TEXP 155-170. | 95% |

## 2. What the spec missed

Ordered by impact on bytes or data flow.

**M1. Grid download includes only visible columns, in the user's on-screen order.** `columnVisCheck` returns `column.visible && column.field` (TEXP 155-170). The grid uses `movableColumns:true` and persists `width`/`visible` per table id (`src/common/tabulator.ts` 38-62; RT 274). Hiding or dragging a column changes the CSV. Path A ignores all of this (`SELECT *`).

**M2. Grid download is capped; Query-to-File is not.** Path B exports only rows already in the grid. Results are truncated to `ui.queryEditor.maxResults = 50000` (`default.config.ini` 40; `src/handlers/queryHandlers.ts` 25-26). Unsaved in-grid edits are also in the data. Query-to-File re-runs the SQL with no cap: selected text, the whole tab, or the current statement (`src/components/TabQueryEditor.vue` 1650-1686).

**M3. Table and query exports get dataType from different places, so bit handling differs.**
- Table export: header names and dataTypes come from `listTableColumns` metadata. Data comes from a separate `SELECT *` with `orderBy: []` (EXP 135-141; postgresql.ts 997-1019; mysql.ts 682, 486 `column_type`).
- Query export: dataTypes come from the cursor. pg maps OIDs only for types **outside** `pg_catalog`, so built-in types become `'user-defined'` (postgresql.ts 1487-1499; PsqlCursor.ts 35-41). SQL Server sets `dataType: ''` (SqlServerCursor.ts 22-28). MySQL uses `typeName`.
- The `'bit(1)'` / `startsWith('bit')` test is case-sensitive (TOOLS 23-27). The same column can be mutated in a table export and not in a query export.

**M4. Plain "Export" on a table sends no filters.** Only "Export filtered view" passes the grid filters. Grid sort is never applied (`src/components/tableview/TableTable.vue` 2248-2253; EXP 137).

**M5. `includeFilter` is dead.** It is set in both UIs but never read (grep: only MODAL 208, ExportOptions.vue 155, models.ts 27).

**M6. Feature and dialect gating.**
- Query-to-File and multi-table export are paid features. Community builds get the upgrade modal (TabQueryEditor.vue 1651-1654; ImportExportDatabase.vue 3).
- Run-to-file is disabled where `disabledFeatures.export.stream` is set: ClickHouse, Redis, Trino (TabQueryEditor.vue 803-804; dialect files).
- The chunk-size field is hidden for `chunkSizeStream` dialects (MODAL 118).
- The multi-table format list drops dialect-disabled formats (ExportOptions.vue 165-169).

**M7. Error handling.** Without `deleteOnAbort`, a failed export leaves a truncated file. The UI shows a fixed "An unexpected error occurred" message, not the real error (ExportManager.vue 68-79).

**M8. Multi-table specifics.**
- Exports run concurrently (`export/batch` uses `Promise.all`, HND 126-138).
- Path is `${dir}/${schema_}${table}_${fileNameOptions}.csv` joined with a literal `/` (ImportExportDatabase.vue 165-172, 261-271).
- Filters are always `[]`.

**M9. Single-export default file name.** Table: `${schema}_${table}_export_yyyy-mm-dd_HHMMss.csv`. Query: a sanitised query name plus the date. Changing the format rewrites the extension (MODAL 232-258).

**M10. Nested values in JSON cells (Path A).** `JSON.stringify` turns a nested Buffer into `{"type":"Buffer","data":[...]}` and a nested Date into a quoted ISO string. Not stated.

**M11. chunkSize becomes a string after editing.** `v-model` on `type=number` has no `.number` modifier (MODAL 120-121), so the value is a string. Cursors coerce it, so bytes do not change.

**M12. bitMutator on numbers or booleans.** For a number or boolean on a non-sqlserver dialect, `value.length` is undefined, so the loop never runs and the output is `b''` (TOOLS 98-103).

## 3. Summary

| Verdict | Count |
|---|---|
| CORRECT | 52 |
| PARTLY CORRECT | 3 (#9, #17, #49) |
| WRONG | 1 (#58) |
| UNKNOWN items | 4 (#10, #42, #61, #62). The source answers all four, #42 only partly. |
| Total graded | 56 SEEN/INFERRED + 4 UNKNOWN |

- **Accuracy**, counting PARTLY as half: (52 + 1.5) / 56 = **95.5%**.
- **Strict accuracy**, CORRECT only: 52 / 56 = **92.9%**.

By tag: SEEN claims had no WRONG verdicts; all three PARTLY verdicts went to SEEN claims (#9, #17, #49). The one WRONG item was INFERRED from a harness that did not reproduce the renderer's runtime.

**Overall.** The byte-level writer behaviour (papaparse quoting, separators, mutators, Tabulator `Ire`) is very accurate. The gaps are upstream of the writer:
- which columns and rows reach it (M1-M4)
- where dataType strings come from (M3)
- UI and dialect gating (M5-M6)
