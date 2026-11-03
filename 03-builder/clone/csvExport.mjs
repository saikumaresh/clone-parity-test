// Clean-room clone of the FILE export CSV writer (Path A in spec.md).
// Built only from /home/claude/rea-test/builder/spec.md.
import Papa from 'papaparse';

// spec A5: dialectFor(connectionType)
const DIALECT_ALIASES = {
  cockroachdb: 'postgresql',
  mariadb: 'mysql',
  tidb: 'mysql',
  libsql: 'sqlite',
  bedrock: 'sqlite',
  mssql: 'sqlserver',
  scylladb: 'cassandra',
};
// CHOICE: spec says "other names map to themselves if known, else null" but does
// not list the known set. Any non-empty string not in the alias table maps to itself.
export function dialectFor(name) {
  if (name === undefined || name === null || name === '') return null;
  if (typeof name !== 'string') return null;
  return DIALECT_ALIASES[name] ?? name;
}

function isPlainObjectLike(v) {
  // lodash _.isObject: non-null object or function
  return v !== null && (typeof v === 'object' || typeof v === 'function');
}

// spec A5 genericMutator, preserveComplex = false
export function genericMutator(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString(); // CHOICE: Invalid Date throws (RangeError), as toISOString does
  if (ArrayBuffer.isView(value)) return value; // Buffer / Uint8Array left as-is
  if (Array.isArray(value) || isPlainObjectLike(value)) {
    return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v));
  }
  return value;
}

// spec A5 bit(1)
export function bit1Mutator(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  return Number(value[0]);
}

// spec A5 other bit types
export function bitMutator(dialect) {
  return (value) => {
    if (!value) return value;
    if (dialect === 'sqlserver') return value;
    if (typeof value === 'string') return value;
    // CHOICE: spec only describes byte sequences. Non-iterable values (true, numbers)
    // are treated as an empty byte list via Array.from, giving "b''".
    let bytes;
    try { bytes = Array.from(value); } catch { bytes = []; }
    const bits = bytes.map((b) => (Number(b) & 0xff).toString(2).padStart(8, '0')).join('');
    return `b'${bits}'`;
  };
}

export function resolveDataMutator(dataType, dialect) {
  if (dataType === 'bit(1)') return bit1Mutator;
  // CHOICE: a missing / non-string dataType falls through to the generic mutator.
  if (typeof dataType === 'string' && dataType.startsWith('bit')) return bitMutator(dialect);
  // json* -> jsonMutator only when mutateJSON; CSV passes false, so never here.
  return genericMutator;
}

export function mutateRow(row, dataTypes = [], dialect = null) {
  if (!isPlainObjectLike(row)) return row; // CHOICE: non-object rows pass through
  const values = Object.values(row);
  return values.map((v, i) => resolveDataMutator(dataTypes?.[i], dialect)(v));
}

// spec A3: papaparse validates the delimiter itself; we pass it straight through.
function rowConfig(delimiter) {
  return { delimiter };
}

function unparseOne(arr, delimiter, header) {
  return Papa.unparse([arr], { ...rowConfig(delimiter), header });
}

/**
 * Returns the exact file contents the Export modal path would write.
 * fromQuery: table exports set headerConfig.header = !!table, which has no effect
 * (spec A2); it is accepted for API symmetry only.
 * dialect: a connectionType or dialect name; passed through dialectFor().
 */
export function exportCsv({ columns, rows, header = true, delimiter = ',', fromQuery = false, dialect = undefined } = {}) {
  const ROW_SEP = '\n';
  let out = '';
  // spec A2: header only if columns truthy, non-empty, and header truthy
  if (columns && columns.length > 0 && header) {
    out += unparseOne(columns.map((c) => c?.columnName), delimiter, !fromQuery) + ROW_SEP;
  }
  const dataTypes = columns ? columns.map((c) => c?.dataType) : undefined;
  const d = dialectFor(dialect);
  // needsFinalSeparator = true for CSV, so every row is followed by "\n"
  for (const row of rows || []) {
    const mutated = mutateRow(row, dataTypes, d);
    out += Papa.unparse([mutated], rowConfig(delimiter)) + ROW_SEP;
  }
  return out; // footer is ""
}

export default exportCsv;
