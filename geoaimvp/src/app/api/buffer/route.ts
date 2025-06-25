import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/duckdb";

export async function POST(request: NextRequest) {
  try {
    const { geometry, distance } = await request.json();
    const db = getDB();

    const geojson: any = await new Promise((resolve, reject) => {
      db.all(
        `SELECT ST_AsGeoJSON(
           ST_Buffer(
             ST_GeomFromGeoJSON($1),
             $2
           )
         ) AS geojson`,
        [JSON.stringify(geometry), distance],
        (err, rows) => {
          if (err) reject(err);
          else resolve(JSON.parse(rows[0].geojson));
        }
      );
    });

    return NextResponse.json(geojson);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
