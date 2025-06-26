import { Database } from "duckdb";

let db: Database;
let conn: any;

export async function getDuckDB() {
  if (!conn) {
    db = new Database(":memory:");
    conn = db.connect();
    await conn.run("INSTALL spatial;");
    await conn.run("LOAD spatial;");
  }
  return conn;
}
