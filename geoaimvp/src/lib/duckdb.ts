import DuckDB from "duckdb";

let db: DuckDB.Database;

export function getDB() {
  if (!db) {
    const dbPath = process.env.DUCKDB_DATABASE_PATH!;
    db = new DuckDB.Database(dbPath);
    db.run(`INSTALL spatial; LOAD spatial;`);
  }
  return db;
}
