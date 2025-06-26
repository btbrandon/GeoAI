import { NextRequest, NextResponse } from "next/server";
import { getDuckDB } from "@/lib/duckdb";

export async function POST(request: NextRequest) {
  try {
    const { point, polygon } = await request.json();
    const db = await getDuckDB();

    const rows = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT ST_Contains(
       ST_GeomFromGeoJSON($1),
       ST_GeomFromGeoJSON($2)
     ) AS inside`,
        [JSON.stringify(polygon), JSON.stringify(point)],
        (err: any, rows: any) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    const inside = Boolean(rows[0].inside);
    return NextResponse.json({ inside });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
