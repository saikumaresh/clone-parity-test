# Beekeeper Studio 6.2.0: CSV export behaviour spec (clean-room, from packaged app only)

## How REA was used

Session ran 19:06Z to about 19:20Z on 2026-11-03. All commands are in `log.md`; REA outputs are in `rea-out/`.

**Worked**
- `rea analyze-javascript-application <carved dir> --artifact-format directory --max-heap-mb 3000 --detail summary --evidence_output ...`. Ran on `carved/csv-utility` (70 KB, 6 files) in 6 s and on `carved/csv-renderer` (5 KB) in 3 s. No memory problems.
- `rea inspect-analysis-view` with the `summary`, `javascript-facts` and `javascript modules/references` views. These worked once I found the input contract (`{"source":{"kind":"evidence-file","path":...},"view":{...}}`) by reading validation errors. The contract is not documented in `--help` or `--llms-full`.
- `rea trace-application-feature` with a `module` seed (`csv.js`). It recovered the module graph exportHandlers -> csv -> export -> tools -> helpers, and csv -> papaparse. It also produced noisy "require:" pseudo-edges inside papaparse.
- `rea trace-javascript-semantics`, which needs the full application Evidence record inline in a JSON file:
  - `property` seed `delimiter`: found `rowConfig.delimiter = outputOptions.delimiter` (csv.js line 19). Status "ambiguous". It did not connect this to papaparse's `_config.delimiter` across the call.
  - `function` seed for papaparse `safe`, direction `callers`: resolved both call sites (header loop and row loop in `serialize`).
  - `callers` for `formatRow` and `getHeader`, and `forward-influence` for `mutateRow`: returned only the seed. REA did not resolve `this.formatRow` subclass dispatch or the cross-module `Mutators.mutateRow` call.
  - On the renderer carve: `delimiter` and `bom` slots found in the Tabulator downloader. Provenance came back unknown.

**Failed**
- `rea search` and `rea trace` on JS files: `capability_unavailable`. They need the native providers ghidra, hopper, ida or kuna, none of which are configured.
- `rea recover-javascript-sources`: `capability_unavailable`. It needs `REA_WAKARU_COMMAND`, which is not installed.
- `trace-application-feature` with a `string` seed `unparse`: no match, because `unparse` is an identifier, not a string literal.
- I did not run whole-bundle analysis again, because the earlier attempts ran out of memory or time.

**What did not come from REA.** I located the modules with plain grep on the `sources` list in `utility.js.map`, which names `src/lib/export/formats/csv.ts`, and on esbuild `// path` comments in `utility.js`. Carving used `sed` line ranges for the utility bundle. For the minified renderer I used a `@babel/parser` AST carver, taking the parser from REA's own node_modules. **Nearly all behavioural detail below came from reading the compiled (non-minified) `dist/utility.js` and the minified renderer directly.** I then confirmed it by **running the carved packaged code under node with fake connections** (`rea-out/harness-*-output.txt`). REA only confirmed structure: the module graph, where the delimiter flows, and the call sites of `safe`.

`utility.js.map` does contain `sourcesContent`. I did not read it; I used only its `sources` names list.

Tags: **SEEN** means observed in packaged code (with a locator). **INFERRED** means reasoned (I say from what). **UNKNOWN** means not determined. "Harness" means confirmed by executing the carved packaged code.

---

## 0. There are two separate CSV writers

- **A. File export ("Export" modal, table export, multi-table export, Query-to-File).** This runs in the utility process: `CsvExporter` extends `Export`, and output is written by papaparse. SEEN: `utility.js` line 635072 `// src/lib/export/formats/csv.ts`; `ExportClassPicker.csv = CsvExporter` at line 635254.
- **B. Query result grid "Download as CSV".** This runs in the renderer. It calls the Tabulator built-in csv downloader and does not use papaparse. SEEN: renderer `index-wCthNREc.js` byte ~4562902 (`e.download('csv')`) -> `download(e)` at ~4063143 -> `this.tabulator.download(t, ..., 'all')` -> Tabulator `downloaders.csv = Ire` (byte ~528629; function at ~524446).

The rules differ, so sections 1-7 describe A first and B separately.

---

## Path A: utility-side Export (papaparse)

### A1. Entry point and data flow

- SEEN (renderer ~5064644, ~4846423): the renderer sends IPC `export/add` with `{filePath, table, query, queryName, filters, options, outputOptions, exporter:'csv'}`, then `export/start`.
- SEEN (exportHandlers.ts, utility.js ~635262): `new CsvExporter(filePath, connection, table, query, queryName, filters||[], options, outputOptions, managerNotify)`, then `exportToFile()`.
- SEEN defaults in the modal (renderer ~4828717 and ~5056572): `options = {chunkSize:100, deleteOnAbort:true, includeFilter:true}`. CSV `outputOptions` default to `{header:true, delimiter:','}` (CSV options component, renderer ~4820169). The delimiter is a free-text input labelled "Field Delimitor"; the header is a checkbox labelled "Include Header".
- SEEN pseudocode (export.ts `initExport` / `exportData` / `finalizeExport`):

```
fh = fs.promises.open(filePath, "w+")              // truncate/create
res = table ? conn.selectTopStream(table.name, [], filters, options.chunkSize, table.schema)
            : conn.queryStream(query, options.chunkSize)
columns = res.columns; cursor = res.cursor; await cursor.start()
if (columns) writeHeader()                          // once (headerWritten flag)
needsSeparator = false
do {
  rows = await cursor.read()
  if (!columns) { columns = cursor.columns; if (columns) writeHeader() }
  for (rI in rows) {
    mutated = Mutators.mutateRow(rows[rI], columns?.map(c=>c.dataType), preserveComplex /*false for CSV*/,
                                 dialectFor(conn.connectionType))
    out = formatRow(mutated)                        // Papa.unparse([mutated], rowConfig)
    if (needsSeparator) write(rowSeparator)
    write(out)
    if (rI == last && !needsFinalSeparator) needsSeparator = true
    else { write(rowSeparator); needsSeparator = false }
  }
} while (rows.length > 0 && status == "exporting")
cursor.close(); write(getFooter() /* "" */); close
```

- SEEN: CSV leaves `needsFinalSeparator = true` (base default) and sets `rowSeparator = "\n"`. Every row is therefore followed by `"\n"`.
- SEEN: each row is a separate `fileHandle.write(string)` call; there is no buffering layer. Chunking is up to the cursor (`chunkSize`) and does not affect the bytes. Harness confirmed this with 2 chunks.
- SEEN: on an error, or on abort with `deleteOnAbort`, the file is unlinked. On abort the loop stops after the current chunk, and the footer is skipped.
- UNKNOWN: whether `cursor.read()` returns arrays or objects for each driver, and the exact `columns[].columnName` and `dataType` strings per driver. Driver code was not analysed.

### A2. Header

- SEEN (csv.ts `getHeader`): a header is written only if `columns` is truthy, `columns.length > 0`, **and** `outputOptions.header` is truthy. It is then `Papa.unparse([columns.map(c=>c.columnName)], headerConfig) + "\n"`.
- SEEN: the same rule applies to table and query exports. `headerConfig.header = !!table` has **no effect**, because papaparse takes the array-of-arrays branch (`serialize(null, data)`), where the `header` flag is never consulted. Harness: a query export with `header:true` wrote the header.
- SEEN: for queries, if `res.columns` is empty, the header is taken from `cursor.columns` after the first `read()`. If it is still absent, no header is written. Harness: `query-cursorcols`, `nullcols`.
- SEEN: column names are escaped with the same `safe()` rules as data (A4). Header and rows use the same delimiter. Duplicate names are written as-is; `dedupedColumns` is only used by `rowToObject`, which is not CSV. Harness: `id,id`.
- SEEN (harness): with header on and zero rows, the file is just the header line plus `"\n"`.

### A3. Delimiter, row separator, newline

- SEEN (papaparse `unpackConfig`, utility.js ~564102): `delimiter` is used only if it is a string containing none of `"\r"`, `"\n"`, `'"'` or `"﻿"`. Otherwise it falls back to `","`. Multi-character delimiters are allowed. Harness: `"||"`, and `"\n"` fell back to `,`.
- SEEN plus harness: an **empty string `""` is accepted**. Fields are then concatenated with nothing between them, and **every field gets quoted**, because `indexOf("") > -1` is always true. Example: `"a""x""y"`.
- INFERRED (from the code): a non-string delimiter, such as undefined, gives `","`.
- SEEN: the row separator is always `"\n"` (LF), not papaparse's default CRLF. papaparse's `_newline` is never used, because `unparse` is called with one row at a time.
- SEEN: there is a **trailing `"\n"` after the last row**, and after the header. Nothing is written before the first row. There is no footer.
- SEEN: a zero-length row array produces an empty line, `"\n"`. INFERRED from papaparse's `nullLine` logic.

### A4. Quoting and escaping (papaparse `safe`, utility.js ~564176; no config overrides passed)

SEEN pseudocode, with defaults `quotes=false`, `quoteChar='"'`, `escapedQuote='""'`, `escapeFormulae=false`:

```
safe(v):
  if v === undefined || v === null: return ""
  if v.constructor === Date: return JSON.stringify(v).slice(1,25)   // unreachable for top-level values; see A5
  s = v.toString().replace(/"/g, '""')
  quote = s contains any of ["\r","\n",'"',"﻿"]
       || s.indexOf(delimiter) > -1
       || s[0] === " " || s[s.length-1] === " "
  return quote ? '"' + s + '"' : s
```

- SEEN plus harness: only a leading or trailing **space (U+0020)** triggers quoting. A tab does not: `tab\tv` was written unquoted. A lone CR is quoted. Embedded LF is written raw inside quotes. There is no escape character other than doubling the quote.
- SEEN: **no formula-injection protection**. `escapeFormulae` is not set; harness wrote `=1+1` raw.
- SEEN: the check runs **after** quotes are doubled. INFERRED: this makes no practical difference, because `"` itself forces quoting.

### A5. Value conversion before quoting (`Mutators`, `src/lib/data/tools.ts`, utility.js ~634770)

**Row shape.** SEEN: if `_.isObject(row)` (true for arrays as well), `row = Object.values(row)`. Values are then mapped by index against `columns[i].dataType`.

**Mutator selection**, SEEN in `resolveDataMutator(dataType, dialect, mutateJSON=false)`:

1. `dataType === "bit(1)"` -> `bit1Mutator`
2. otherwise `dataType.startsWith("bit")` -> `bitMutator(dialect)`
3. `json*` -> `jsonMutator`, **only if mutateJSON**. CSV passes false, so it is never used here.
4. everything else -> `genericMutator(value, preserveComplex=false)`

`dialect = dialectFor(connectionType)`. SEEN (~586279): cockroachdb->postgresql, mariadb/tidb->mysql, libsql/bedrock->sqlite, mssql->sqlserver, scylladb->cassandra; other names map to themselves if known, else null.

**genericMutator, then papaparse.** SEEN; output column confirmed by the harness:

| Input | After mutator | CSV text |
|---|---|---|
| null / undefined | unchanged | empty field |
| `""` | `""` | empty field (cannot be told apart from null) |
| boolean | unchanged | `true` / `false` |
| number | unchanged | JS `toString`: `NaN`, `Infinity`, `-Infinity`, `1e+21`, `0.30000000000000004`, `-0` -> `0` |
| BigInt | `Number(v)` (loses precision) | `12345678901234567000` |
| Date | `toISOString()` | `2024-01-02T03:04:05.006Z` (UTC, ms, Z) |
| Array or plain object | `JSON.stringify` with BigInt replaced by `"<digits>n"` | e.g. `"{""k"":""v"",""n"":""1n""}"`; `[]` -> `[]`, `{}` -> `{}` (unquoted) |
| Buffer | unchanged (ArrayBuffer view) | `Buffer.toString()`, i.e. **UTF-8 decode** of the bytes (invalid bytes become U+FFFD) |
| Uint8Array (non-Buffer) | unchanged | `"104,105"`, decimal bytes joined by commas, then quoted because of the comma |
| empty Buffer | unchanged | empty field |

- SEEN: JSON stringification is compact `JSON.stringify` output. Inner `"` become `\"`, and CSV doubling then makes them `\""`.
- SEEN: `jsonb`/`json` typed columns get the same generic treatment: an object becomes JSON, a string passes through.

**bit(1)** `bit1Mutator`, SEEN plus harness:
- falsy values (null, undefined, `0`, `""`, `false`) -> `0`. **A NULL bit(1) exports as `0`, not as an empty field.**
- a number is returned unchanged
- anything else -> `Number(v[0])`: Buffer `[1]` -> `1`, string `"1"` -> `1`, `true` -> `NaN` (INFERRED), empty Buffer -> `NaN` (harness)

**Other bit types** (`bit(n)`, `bit varying`, plain `bit`) use `bitMutator`, SEEN plus harness:
- falsy -> unchanged (null gives an empty field)
- dialect `sqlserver` -> unchanged. A Buffer then goes through UTF-8 decode, so `[5]` gives byte 0x05. A boolean gives `true`/`false`.
- a string is unchanged
- otherwise each byte becomes 8-bit binary with leading zeros, concatenated as `b'<bits>'`. Example: `[0xA0,0x40]` -> `b'1010000001000000'`; on MySQL `bit` `[1]` -> `b'00000001'`. The result contains `'` but nothing that triggers quoting.

UNKNOWN: which JS types each driver actually returns for these SQL types (for example, whether pg returns bytea as Buffer, or timestamps as Date or string).

### A6. Encoding and BOM

- SEEN: `fileHandle.write(string)` with no encoding argument. INFERRED from Node semantics: the file is UTF-8.
- SEEN: no BOM is written. papaparse's `BYTE_ORDER_MARK` is only used as a "bad delimiter" and quote trigger. Harness: the first bytes are data.

### A7. Other byte-affecting details

- SEEN: the file is opened with `"w+"`, so it is truncated. The file name and extension come from the renderer: `extension = "csv"` and `filePath/name`.
- SEEN: there is no per-dialect rule other than bit/sqlserver and the `dialectFor` mapping.
- INFERRED from `Object.values`: an object row whose keys collide loses columns. Cell order follows the object's key order, not `columns`.
- SEEN: papaparse `skipEmptyLines` is unset, so empty rows are kept.

---

## Path B: renderer "Download as CSV" (Tabulator `Ire`)

- SEEN (`download(e)`, ~4063143): the file name is `${snakeCase(query.title) || 'query_results'}-${dateformat(now,'yyyy-mm-dd_hMMss')}.csv`, and the call is `tabulator.download('csv', name, 'all')`.
- SEEN (Tabulator `download(t,n,r,i,a)`, ~529312): the third argument is the **downloader options**, not the row range. `'all'` therefore arrives as the options object `t='all'`; `t.delimiter` and `t.bom` are undefined, giving delimiter `,` and no BOM. The row range is `undefined`, so `generateExportList` uses table option `downloadRowRange`, whose Tabulator default is `'active'` (SEEN at ~528651). INFERRED: the export contains the currently filtered and sorted rows.
- SEEN: the table is created with `downloadConfig:{columnHeaders:true}` (~4049802). A header is always written while columns exist.
- SEEN: the header text is `definition.titleDownload || definition.title`. `titleDownload = Dx(e.name)`, an **HTML-escaping** function (`& < > " '` -> `&amp; &lt; &gt; &quot; &#039;`, ~1515117). Harness: `a&b` -> `"a&amp;b"`. If the name is empty, `Dx` returns null and the header falls back to `title`.
- SEEN (`Ire` pseudocode):

```
d = opts.delimiter || ","
header[i] = (v==null) ? "" : '"' + String(v).split('"').join('""') + '"'    // depth-1 columns only
cell: if typeof v=="object": v = (v===null) ? "" : JSON.stringify(v)
      if typeof v=="undefined": v = ""
      '"' + String(v).replaceAll('"','""') + '"'
rows joined by d; lines = [header?, ...rows].join("\n")   // NO trailing newline
if opts.bom: prefix "﻿"
callback(lines, "text/csv")
```

- SEEN plus harness: **every field is quoted, nulls included** (`""`). Lines end with LF. There is **no trailing newline**. Group and calc rows are skipped with a warning.
- SEEN: values are first passed through the column `mutator = resolveTabulatorMutator(dataType, dialect)`. This is the renderer copy of Mutators (~3724264) with `preserveComplex=true` and `mutateJSON=true`, so arrays and objects stay as objects and are then `JSON.stringify`'d by `Ire`. For example, a Uint8Array becomes `{"0":104,"1":105}`, and BigInt becomes Number. `json*` columns go through `friendlyJsonObject`, whose added `toString` is ignored by `JSON.stringify`. INFERRED from the harness: a BigInt nested inside an object makes `JSON.stringify` throw.
- SEEN: no accessorDownload is set in the result column definition (~4054786). INFERRED: values reach the downloader as mutated.
- SEEN: the default `downloadEncoder` is `new Blob([s], {type:'text/csv'})`, and I found no override. INFERRED: Blob encodes the string as UTF-8, with no BOM.
- UNKNOWN: how the Blob is saved to disk in Electron (`triggerDownload` was not carved), and whether any column (for example a row-header column) is included. `columnVisCheck` excludes columns without a `field` and is SEEN; whether the result grid has such columns is UNKNOWN.

---

## Tally

These counts are tag occurrences in this file, excluding the legend. Some bullets carry more than one tag.
- SEEN: 47, of which about 19 were also confirmed by the harness
- INFERRED: 11
- UNKNOWN: 5
