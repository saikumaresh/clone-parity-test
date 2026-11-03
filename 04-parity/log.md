# Parity run log

Times are UTC from the container clock (`date -u`).

| Time (UTC) | Step |
|---|---|
| 2026-11-03T19:35:46Z | Started. Inspected `parity/cases.mjs` (18 cases), clone `builder/clone/csvExport.mjs`, clone `package.json` (papaparse ^5.4.1, installed 5.4.1). |
| ~19:36 | Read original sources: `lib/export/export.ts`, `lib/export/formats/csv.ts`, `lib/data/tools.ts` (Mutators), `common/utils.ts` (stringifyWithBigInt), `shared/lib/dialects/models.ts` (dialectFor), `components/export/forms/ExportFormCSV.vue` (UI defaults header:true, delimiter:","), `components/export/ExportModal.vue` (options chunkSize 100, deleteOnAbort true, includeFilter true), `src-commercial/backend/handlers/exportHandlers.ts` (constructor argument order), `lib/db/clients/postgresql.ts` + PsqlCursor (table path returns columns up front, query path returns only a cursor whose columns appear after the first read). |
| ~19:36 | Papaparse: root `yarn.lock` pins `papaparse@^5.3.0 -> 5.5.3`; `appx/node_modules/papaparse` is also 5.5.3. Used appx copy. lodash: yarn.lock 4.18.1 = appx 4.18.1, used appx copy. |
| ~19:36 | Installed esbuild 0.24.2 in `parity/harness`. Wrote `build.mjs` (alias + stub plugin). |
| ~19:37 | First bundle failed at load: generic Proxy stub for `sql-formatter` broke a top-level `expandPhrases()` call in `partiqlFormatter.ts`. Switched to real `sql-formatter` 15.9.0 from appx; rebuilt. Stubs left: `@bksLogger`, `vue`, `nearley`. |
| 2026-11-03T19:37:34Z | Main run, connectionType `postgresql`: 18/18 byte-identical. Outputs in `out/original/`, `out/clone/`, `out/results-postgresql.json`. |
| 2026-11-03T19:37:50Z | Dialect variants `sqlserver`, `mssql`, `mysql`, `none` (undefined), `cockroachdb`: 18/18 each. Outputs in `out/variants/<type>/`. |
| ~19:37 | Diffed papaparse 5.4.1 vs 5.5.3 `JsonToCsv`: only the `escapeFormulae` option parsing differs; neither side sets it, so no effect. |
| 2026-11-03T19:38:05Z | Supplementary probes (11 extra inputs in `harness/probes.mjs`, not part of the dataset): 11/11 identical, including both throwing the same RangeError on an Invalid Date. Outputs in `out/probes/`. |
| 2026-11-03T19:38:14Z | Independent `cmp` over `out/original/*.csv` vs `out/clone/*.csv`: no differences. |
| ~19:39 | Controls: the upstream `csv.spec.js` expectation (`name\nfoo\nbar\n"ba\nz"\n`) reproduced through the bundled original. Negative control: a one-byte flip is detected by the comparator. |
| ~19:40 | Wrote `report.md`. |
