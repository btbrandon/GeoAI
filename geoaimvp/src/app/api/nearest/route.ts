import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/duckdb";

export async function POST(request: NextRequest) {
  try {
    const { location, k = 5 } = await request.json();
    const db = getDB();

    const rows = await new Promise<{ geojson: string }[]>((resolve, reject) => {
      db.all(
        `
        SELECT ST_AsGeoJSON(geom) AS geojson
        FROM points
        ORDER BY ST_Distance(
          geom,
          ST_GeomFromGeoJSON($1)
        )
        LIMIT $2
        `,
        [JSON.stringify(location), k],
        (err, _rows) => {
          if (err) return reject(err);
          resolve(_rows as any as { geojson: string }[]);
        }
      );
    });

    const features = rows.map((r) => ({
      type: "Feature" as const,
      geometry: JSON.parse(r.geojson),
      properties: {},
    }));

    return NextResponse.json({
      type: "FeatureCollection" as const,
      features,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
