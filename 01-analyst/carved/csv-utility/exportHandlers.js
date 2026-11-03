// CARVED from dist/utility.js lines 635253-635341 (exportHandlers.ts); Json/Sql/JsonLine exporters omitted
const { CsvExporter } = require("./csv.js");
const JsonExporter = null, SqlExporter = null, JsonLineExporter = null;
var ExportClassPicker = {
  "csv": CsvExporter,
  "json": JsonExporter,
  "sql": SqlExporter,
  "jsonl": JsonLineExporter
};
function getExporter(id2, sId) {
  const exporter = state2(sId).exports.get(id2);
  if (!exporter) {
    throw new Error(errorMessages.noExport);
  }
  return exporter;
}
var ExportHandlers = {
  "export/add": async function({ options, sId }) {
    checkConnection(sId);
    const exporter = new ExportClassPicker[options.exporter](
      options.filePath,
      state2(sId).connection,
      options.table,
      options.query,
      options.queryName,
      options.filters || [],
      options.options,
      options.outputOptions,
      options.managerNotify
    );
    state2(sId).exports.set(exporter.id, exporter);
    return {
      id: exporter.id,
      status: exporter.status,
      filePath: exporter.filePath,
      percentComplete: exporter.percentComplete
    };
  },
  "export/remove": async function({ id: id2, sId }) {
    state2(sId).exports.delete(id2);
  },
  "export/removeInactive": async function({ sId }) {
    state2(sId).exports = new Map([...state2(sId).exports.entries()].filter(([_key2, exp]) => exp.status === "exporting" /* Exporting */));
    return [...state2(sId).exports.entries()].map((value) => {
      return {
        id: value[0],
        status: value[1].status,
        filePath: value[1].filePath,
        percentComplete: value[1].percentComplete
      };
    });
  },
  "export/status": async function({ id: id2, sId }) {
    const exporter = getExporter(id2, sId);
    return exporter.status;
  },
  "export/error": async function({ id: id2, sId }) {
    const exporter = getExporter(id2, sId);
    return exporter.error;
  },
  "export/name": async function({ id: id2, sId }) {
    const exporter = getExporter(id2, sId);
    return exporter.table ? exporter.table.name : exporter.queryName;
  },
  "export/start": async function({ id: id2, sId }) {
    const exporter = getExporter(id2, sId);
    exporter.onProgress((progress) => {
      state2(sId).port.postMessage({
        type: `onExportProgress/${id2}`,
        input: progress
      });
    });
    await exporter.exportToFile();
  },
  "export/cancel": async function({ id: id2, sId }) {
    const exporter = getExporter(id2, sId);
    return exporter.abort();
  },
  "export/batch": async function({ ids, sId }) {
    await Promise.all(ids.map((id2) => {
      const exporter = getExporter(id2, sId);
      exporter.onProgress((progress) => {
        state2(sId).port.postMessage({
          type: `onExportProgress/${id2}`,
          input: progress
        });
      });
      return exporter.exportToFile();
    }));
  }
};
module.exports = { ExportHandlers };
