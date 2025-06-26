import { NextRequest, NextResponse } from "next/server";
import { getDuckDB } from "@/lib/duckdb";
import { Pin, ReferencePoint } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const {
      referencePoint,
      pins,
      k = 5,
    }: {
      referencePoint: ReferencePoint;
      pins: Pin[];
      k?: number;
    } = await request.json();

    if (!referencePoint || !pins || pins.length === 0) {
      return NextResponse.json(
        { error: "Reference point and pins are required" },
        { status: 400 }
      );
    }

    const db = await getDuckDB();

    const dataPoints = pins.slice(0, -1);

    if (dataPoints.length === 0) {
      return NextResponse.json(
        { error: "No data points available (only reference point exists)" },
        { status: 400 }
      );
    }

    const dataPointValues = dataPoints
      .map(
        (pin, index) =>
          `(${index}, ST_Point(${pin.longitude}, ${pin.latitude}))`
      )
      .join(", ");

    await db.run(`
      CREATE TEMP TABLE data_points AS 
      SELECT * FROM (VALUES ${dataPointValues}) AS t(id, geom)
    `);

    await db.run(`
      CREATE TEMP TABLE ref_point AS 
      SELECT ST_Point(${referencePoint.longitude}, ${referencePoint.latitude}) AS geom
    `);

    const rows = await new Promise<{ geojson: string }[]>((resolve, reject) => {
      db.all(
        `SELECT ST_AsGeoJSON(geom) AS geojson
         FROM data_points
         ORDER BY ST_Distance(
           geom,
           (SELECT geom FROM ref_point)
         )
         LIMIT $1`,
        [k],
        (err: any, _rows: any) => {
          if (err) return reject(err);
          resolve(_rows as any as { geojson: string }[]);
        }
      );
    });

    await db.run("DROP TABLE data_points");
    await db.run("DROP TABLE ref_point");

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
