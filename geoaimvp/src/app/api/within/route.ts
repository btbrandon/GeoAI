import { NextRequest, NextResponse } from "next/server";
import { getDuckDB } from "@/lib/duckdb";
import { Pin, ReferencePoint } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const {
      referencePoint,
      pins,
      distance_km,
    }: { referencePoint: ReferencePoint; pins: Pin[]; distance_km: number } =
      await request.json();

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

    const geojson: Record<string, unknown> = await new Promise(
      (resolve, reject) => {
        const distanceDegrees = distance_km / 111.0;

        db.all(
          `SELECT ST_AsGeoJSON(geom) AS geojson
        FROM data_points
        WHERE ST_DWithin(
          geom, 
          (SELECT geom FROM ref_point), 
          $1
        )`,
          [distanceDegrees],
          (err: Error | null, rows: { geojson: string }[]) => {
            if (err) {
              console.error("DuckDB error:", err);
              reject(err);
            } else {
              const features = rows.map((row) => ({
                type: "Feature",
                geometry: JSON.parse(row.geojson),
                properties: {},
              }));
              const featureCollection = {
                type: "FeatureCollection",
                features: features,
              };
              resolve(featureCollection);
            }
          }
        );
      }
    );

    await db.run("DROP TABLE data_points");
    await db.run("DROP TABLE ref_point");

    return NextResponse.json(geojson);
  } catch (err) {
    console.error("Within query error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
