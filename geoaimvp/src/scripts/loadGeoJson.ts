import { getDuckDB } from "@/lib/duckdb";
import * as fs from "fs";
import * as path from "path";

async function loadGeoJson() {
  const conn = await getDuckDB();

  const geoJsonPath = path.join(process.cwd(), "data", "singapore.geojson");
  const geoJsonContent = fs.readFileSync(geoJsonPath, "utf8");
  const geoJson = JSON.parse(geoJsonContent);

  await conn.run(`
    CREATE TABLE IF NOT EXISTS singapore_points (
      id INTEGER,
      geometry GEOMETRY,
      properties JSON
    );
  `);

  for (let i = 0; i < geoJson.features.length; i++) {
    const feature = geoJson.features[i];
    await conn.run(
      `
      INSERT INTO singapore_points (id, geometry, properties)
      VALUES (?, ST_GeomFromGeoJSON(?), ?)
    `,
      [
        i,
        JSON.stringify(feature.geometry),
        JSON.stringify(feature.properties || {}),
      ]
    );
  }

  console.log(
    "✅ Loaded",
    geoJson.features.length,
    "features from GeoJSON into DuckDB"
  );
}

loadGeoJson().catch(console.error);
