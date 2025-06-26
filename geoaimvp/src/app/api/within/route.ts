import { NextRequest, NextResponse } from "next/server";
import { getDuckDB } from "@/lib/duckdb";

interface Pin {
  id: string;
  longitude: number;
  latitude: number;
  coordinates: [number, number];
}

interface ReferencePoint {
  id: string;
  longitude: number;
  latitude: number;
  coordinates: [number, number];
}

export async function POST(request: NextRequest) {
  try {
    const {
      referencePoint,
      pins,
      distance_km,
    }: { referencePoint: ReferencePoint; pins: Pin[]; distance_km: number } =
      await request.json();
    console.log("Within request:", { referencePoint, pins, distance_km });

    if (!referencePoint || !pins || pins.length === 0) {
      return NextResponse.json(
        { error: "Reference point and pins are required" },
        { status: 400 }
      );
    }

    const db = await getDuckDB();

    // Filter out the reference point from the pins (exclude the latest pin)
    const dataPoints = pins.slice(0, -1); // All pins except the last one (reference point)

    if (dataPoints.length === 0) {
      return NextResponse.json(
        { error: "No data points available (only reference point exists)" },
        { status: 400 }
      );
    }

    console.log("Data points to search:", dataPoints.length);
    console.log("Reference point:", referencePoint);

    // Create temporary tables
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

    // Create reference point
    await db.run(`
      CREATE TEMP TABLE ref_point AS 
      SELECT ST_Point(${referencePoint.longitude}, ${referencePoint.latitude}) AS geom
    `);

    // Find points within the specified distance
    const geojson: Record<string, unknown> = await new Promise(
      (resolve, reject) => {
        const distanceDegrees = distance_km / 111.0; // Convert km to degrees (approximate)

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
              console.log("Found points within distance:", rows.length);
              // Convert to FeatureCollection format
              const features = rows.map((row) => JSON.parse(row.geojson));
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

    // Cleanup
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
