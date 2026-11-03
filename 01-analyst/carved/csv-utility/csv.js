// CARVED from dist/utility.js lines 635072-635108 (src/lib/export/formats/csv.ts)
const { Export } = require("./export.js");
var import_papaparse = { default: require("./papaparse.js") };
var CsvExporter = class extends Export {
  constructor(filePath, connection, table, query, queryName, filters, options, outputOptions, managerNotify = true) {
    super(filePath, connection, table, query, queryName, filters, options, managerNotify);
    this.format = "csv";
    this.rowSeparator = "\n";
    this.preserveComplex = false;
    this.rowConfig = {
      header: false
    };
    this.headerConfig = {
      header: table ? true : false,
      // dont know columns for query
      delimiter: outputOptions.delimiter
    };
    this.outputOptions = outputOptions;
    this.rowConfig.delimiter = outputOptions.delimiter;
  }
  static {
    this.extension = "csv";
  }
  async getHeader(columns) {
    if (!columns) return "";
    const fields = columns.map((c6) => c6.columnName);
    if (fields.length > 0 && this.outputOptions.header) {
      return import_papaparse.default.unparse([fields], this.headerConfig) + this.rowSeparator;
    }
    return "";
  }
  getFooter() {
    return "";
  }
  formatRow(row) {
    return import_papaparse.default.unparse([row], this.rowConfig);
  }
};
module.exports = { CsvExporter };
