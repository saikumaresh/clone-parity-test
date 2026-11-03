// CARVED from dist/utility.js lines 634756-634761, 634854-635070 (src/lib/export/export.ts)
var import_fs18 = { default: require("fs") };
var import_path10 = { default: require("path") };
var import_crypto7 = { default: require("crypto") };
var import_fs19 = require("fs");
var import_lodash59 = { default: require("lodash") };
const utilityLogger_default = { scope: () => console };
const { Mutators } = require("./tools.js");
const { dialectFor } = require("./helpers.js");
var log54 = utilityLogger_default.scope("export/export");
var Export = class {
  constructor(filePath, connection, table, query, queryName, filters, options, managerNotify = true) {
    this.filePath = filePath;
    this.connection = connection;
    this.table = table;
    this.query = query;
    this.queryName = queryName;
    this.filters = filters;
    this.options = options;
    this.managerNotify = managerNotify;
    this.countExported = 0;
    this.countTotal = 0;
    this.error = null;
    this.fileSize = 0;
    this.lastChunkTime = 0;
    this.preserveComplex = true;
    // see set status()
    this._status = "idle" /* Idle */;
    this.timeElapsed = 0;
    this.timeLeft = 0;
    this.callbacks = {
      progress: Array()
    };
    this.headerWritten = false;
    this.needsFinalSeparator = true;
    this.id = this.generateId();
  }
  rowToObject(row) {
    const columns = this.dedupedColumns?.length ? this.dedupedColumns : row.map((_r2, i7) => {
      return { dataType: "unknown", columnName: `col_${i7 + 1}` };
    });
    const names = columns.map((c6) => c6.columnName);
    return import_lodash59.default.zipObject(names, row);
  }
  get dedupedColumns() {
    if (!this.columns) return [];
    const found = /* @__PURE__ */ new Map();
    return this.columns.map((c6) => {
      const nuCol = { ...c6 };
      found.set(c6.columnName, (found.get(c6.columnName) || 0) + 1);
      const counter = found.get(c6.columnName) || 0;
      if (counter > 1) {
        nuCol.columnName = `${c6.columnName}_${counter}`;
      }
      return nuCol;
    });
  }
  set status(status) {
    this._status = status;
    this.notify();
  }
  get status() {
    return this._status;
  }
  get percentComplete() {
    if (["completed" /* Completed */, "aborted" /* Aborted */, "error" /* Error */].includes(this.status)) {
      return 100;
    }
    if (this.countTotal === 0 || this.countTotal === -1) return this.countTotal;
    return Math.min(100, Math.round(this.countExported / this.countTotal * 100));
  }
  notify() {
    const payload2 = {
      totalRecords: this.countTotal,
      countExported: this.countExported,
      secondsElapsed: this.timeElapsed,
      secondsRemaining: this.timeLeft,
      status: this.status,
      percentComplete: this.percentComplete
    };
    this.callbacks.progress.forEach((c6) => c6(payload2));
  }
  generateId() {
    const md5sum = import_crypto7.default.createHash("md5");
    md5sum.update(Date.now().toString(), "utf8");
    md5sum.update(this.table ? this.table.name : this.queryName);
    md5sum.update(this.filePath);
    return md5sum.digest("hex");
  }
  async initExport() {
    this.status = "exporting" /* Exporting */;
    this.countExported = 0;
    this.fileHandle = await import_fs18.default.promises.open(this.filePath, "w+");
    let results;
    if (this.table) {
      results = await this.connection.selectTopStream(
        this.table.name,
        [],
        this.filters,
        this.options.chunkSize,
        this.table.schema
      );
    } else {
      results = await this.connection.queryStream(
        this.query,
        this.options.chunkSize
      );
    }
    this.columns = results.columns;
    this.cursor = results.cursor;
    this.countTotal = results.totalRows ?? -1;
    await this.cursor?.start();
    if (this.columns) {
      await this.writeHeader();
    }
  }
  async writeHeader() {
    if (this.headerWritten) return;
    const header = await this.getHeader(this.columns);
    if (header) {
      await this.fileHandle.write(header);
    }
    this.headerWritten = true;
  }
  async exportData() {
    log54.debug("running export");
    let rows;
    let needsSeparator = false;
    do {
      if (!this.cursor) {
        throw new Error("Something went wrong");
      }
      rows = await this.cursor?.read();
      if (!this.columns) {
        this.columns = this.cursor.columns;
        if (this.columns) {
          await this.writeHeader();
        }
      }
      for (let rI = 0; rI < rows.length; rI++) {
        const row = rows[rI];
        const mutated = Mutators.mutateRow(row, this.columns?.map((c6) => c6.dataType), this.preserveComplex, dialectFor(this.connection.connectionType));
        const formatted = this.formatRow(mutated, this.columns);
        if (needsSeparator === true) {
          await this.fileHandle?.write(this.rowSeparator);
        }
        await this.fileHandle?.write(formatted);
        if (rI === rows.length - 1 && !this.needsFinalSeparator) {
          needsSeparator = true;
        } else {
          await this.fileHandle?.write(this.rowSeparator);
          needsSeparator = false;
        }
      }
      this.countExported += rows.length;
      this.calculateTimeLeft();
      this.notify();
    } while (rows.length > 0 && this.status === "exporting" /* Exporting */);
    await this.cursor?.close();
  }
  async finalizeExport() {
    if (this.status === "aborted" /* Aborted */) {
      return;
    }
    const footer = await this.getFooter();
    await this.fileHandle?.write(footer);
    this.status = "completed" /* Completed */;
  }
  async exportToFile() {
    try {
      log54.debug("starting export");
      await this.initExport();
      await this.exportData();
      await this.finalizeExport();
      await this.fileHandle?.close();
      if (this.status === "aborted" /* Aborted */) {
        if (this.options.deleteOnAbort) {
          await import_fs19.promises.unlink(this.filePath);
        }
      }
    } catch (error2) {
      this.status = "error" /* Error */;
      this.error = error2;
      log54.error(error2);
      await this.fileHandle?.close();
      if (this.options.deleteOnAbort) {
        await import_fs19.promises.unlink(this.filePath);
      }
    } finally {
      this.fileHandle = void 0;
    }
  }
  calculateTimeLeft() {
    if (this.lastChunkTime) {
      this.timeElapsed += Date.now() - this.lastChunkTime;
      if (this.countTotal !== -1) {
        const recordsLeft = this.countTotal - this.countExported;
        const timePerRecord = this.timeElapsed / this.countExported;
        this.timeLeft = Math.round(timePerRecord * recordsLeft);
      }
    }
    this.lastChunkTime = Date.now();
  }
  onProgress(func) {
    this.callbacks.progress.push(func);
  }
  offProgress(func) {
    this.callbacks.progress = this.callbacks.progress.filter((f10) => f10 !== func);
  }
  abort() {
    this.status = "aborted" /* Aborted */;
  }
  pause() {
    this.status = "paused" /* Paused */;
  }
  getFileName() {
    return import_path10.default.basename(this.filePath);
  }
  getFilterString() {
    if (typeof this.filters === "object") {
      return JSON.stringify(this.filters);
    }
    return this.filters;
  }
};
module.exports = { Export };
