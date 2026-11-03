// CARVED from dist/utility.js lines 586274-586301 and 586507-586541
// src/shared/lib/dialects/models.ts
var communityDialects = ["postgresql", "greengage", "sqlite", "sqlserver", "mysql", "starrocks", "redshift", "bigquery", "bedrock", "redis"];
var ultimateDialects = ["oracle", "cassandra", "firebird", "clickhouse", "mongodb", "duckdb", "sqlanywhere", "surrealdb", "trino", "dynamodb", "snowflake"];
var Dialects = [...communityDialects, ...ultimateDialects];
var SpecialTypes = ["autoincrement"];
function dialectFor(s3) {
  switch (s3) {
    case "cockroachdb":
      return "postgresql";
    case "greengage":
      return "greengage";
    case "mariadb":
    case "tidb":
      return "mysql";
    case "starrocks":
      return "starrocks";
    case "libsql":
      return "sqlite";
    case "mssql":
      return "sqlserver";
    case "scylladb":
      return "cassandra";
    case "bedrock":
      return "sqlite";
    default:
      return Dialects.find((d6) => d6 === s3) || null;
  }
}
function friendlyJsonObject(obj2) {
  Object.defineProperties(obj2, {
    [Symbol.toPrimitive]() {
      try {
        return stringifyWithBigInt(obj2);
      } catch (ex) {
        console.warn("Error serializing object:", obj2, ex);
        return "[object Object]";
      }
    }
  });
  if (!Object.prototype.hasOwnProperty.call(obj2, "toString")) {
    Object.defineProperties(obj2, {
      toString: {
        value() {
          try {
            return stringifyWithBigInt(obj2);
          } catch (ex) {
            console.warn("Error serializing object:", obj2, ex);
            return "[object Object]";
          }
        },
        enumerable: false
        // This tells js to not clone this property. Useful when we want to send this object to utility.
      }
    });
  }
  return obj2;
}
function stringifyWithBigInt(value) {
  return JSON.stringify(
    value,
    (_key2, val2) => typeof val2 === "bigint" ? `${val2}n` : val2
  );
}
module.exports = { dialectFor, friendlyJsonObject, stringifyWithBigInt };
