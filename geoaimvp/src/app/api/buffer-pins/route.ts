import { NextRequest, NextResponse } from "next/server";
import { getDuckDB } from "@/lib/duckdb";

interface Pin {
  id: string;
  longitude: number;
  latitude: number;
  coordinates: [number, number];
}

export async function POST(request: NextRequest) {
  try {
    const { pins, distance }: { pins: Pin[]; distance: number } =
      await request.json();
    console.log("Buffer-pins request:", { pins, distance });
    console.log("Number of pins:", pins.length);

    const db = await getDuckDB();

    if (!pins || pins.length === 0) {
      return NextResponse.json({ error: "No pins provided" }, { status: 400 });
    }

    // Create a temporary table with the pins
    const pinValues = pins
      .map(
        (pin, index) =>
          `(${index}, ST_Point(${pin.longitude}, ${pin.latitude}))`
      )
      .join(", ");

    await db.run(`
      CREATE TEMP TABLE temp_pins AS 
      SELECT * FROM (VALUES ${pinValues}) AS t(id, geom)
    `);

    // Create buffers around all pins and union them
    const geojson: Record<string, unknown> = await new Promise(
      (resolve, reject) => {
        const bufferDistance = distance / 111.0; // convert km to degrees approx.

        if (pins.length === 1) {
          db.all(
            `SELECT ST_AsGeoJSON(ST_Buffer(geom, $1)) AS geojson FROM temp_pins`,
            [bufferDistance],
            (err: Error | null, rows: { geojson: string }[]) => {
              if (err) {
                console.error("DuckDB error (single):", err);
                reject(err);
              } else {
                resolve(JSON.parse(rows[0].geojson));
              }
            }
          );
        } else {
          // For multiple pins, use a recursive approach with ST_Union
          // First create a table with buffered geometries
          db.run(
            `CREATE TEMP TABLE buffered_pins AS
           SELECT id, ST_Buffer(geom, $1) AS buffered_geom
           FROM temp_pins`,
            [bufferDistance],
            (err: Error | null) => {
              if (err) {
                console.error("Error creating buffered table:", err);
                reject(err);
                return;
              }

              // Now use a recursive CTE to union all geometries
              db.all(
                `WITH RECURSIVE union_geoms AS (
                SELECT id, buffered_geom AS result_geom
                FROM buffered_pins
                WHERE id = 0
                
                UNION ALL
                
                SELECT bp.id, ST_Union(ug.result_geom, bp.buffered_geom) AS result_geom
                FROM buffered_pins bp
                JOIN union_geoms ug ON bp.id = ug.id + 1
                WHERE bp.id <= (SELECT MAX(id) FROM buffered_pins)
              )
              SELECT ST_AsGeoJSON(result_geom) AS geojson
              FROM union_geoms
              WHERE id = (SELECT MAX(id) FROM buffered_pins)`,
                (err: Error | null, rows: { geojson: string }[]) => {
                  if (err) {
                    console.error("DuckDB error (multi):", err);
                    reject(err);
                  } else {
                    resolve(JSON.parse(rows[0].geojson));
                  }
                }
              );
            }
          );
        }
      }
    );

    // Clean up temporary table
    await db.run("DROP TABLE temp_pins");
    if (pins.length > 1) {
      await db.run("DROP TABLE buffered_pins");
    }

    return NextResponse.json(geojson);
  } catch (err) {
    console.error("Buffer pins error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
