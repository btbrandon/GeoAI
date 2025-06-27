import { z } from "zod";
import { tool, streamText } from "ai";
import { getDuckDB } from "@/lib/duckdb";
import { requestBodySchema } from "@/lib/schemas";
import { openai } from "@ai-sdk/openai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = requestBodySchema.parse(body);
    const { messages, pins, referencePoint } = validated;

    const db = await getDuckDB();

    let systemPrompt = `You are a GeoAI assistant. When users ask for spatial operations, use the appropriate tool to execute them.

      Available operations:
      - "within X km" or "within X kilometers" → Use the 'within' tool with distance_km parameter
      - "nearest X" or "find X nearest" → Use the 'nearest' tool with k parameter  
      - "buffer X km" or "create buffer X km" → Use the 'buffer' tool with distance parameter

      Examples:
      - "within 5 km" → Use within tool with distance_km: 5
      - "nearest 3" → Use nearest tool with k: 3
      - "buffer 2km" → Use buffer tool with distance: 2

      Always convert units to kilometers if needed. If the user doesn't specify a unit, assume kilometers.
      
      CRITICAL: After using any tool, you MUST provide a text response explaining what operation was performed and what the results show. Do not just use the tool without providing a text explanation.`;

    if (pins && pins.length > 0) {
      systemPrompt += `\n\nUser has ${pins.length} pin(s) on the map.`;
    }

    if (referencePoint) {
      systemPrompt += `\n\nUser has set a reference point at coordinates: ${referencePoint.longitude.toFixed(
        6
      )}, ${referencePoint.latitude.toFixed(6)}.`;
    }

    const result = await streamText({
      model: openai("gpt-4.1-mini"),
      system: systemPrompt,
      messages,
      tools: {
        buffer: tool({
          description: "Create a buffer around selected pins",
          parameters: z.object({
            distance: z.number().describe("Buffer radius in kilometers"),
          }),
          execute: async ({ distance }) => {
            if (!pins?.length) throw new Error("No pins provided");

            const values = pins
              .map((p, i) => `(${i}, ST_Point(${p.longitude}, ${p.latitude}))`)
              .join(", ");

            await db.run(
              `CREATE TEMP TABLE temp_pins AS 
               SELECT * FROM (VALUES ${values}) AS t(id, geom)`
            );

            const bufferDistance = distance / 111;

            const geojson = await new Promise<{
              type: string;
              coordinates: number[];
            }>((resolve, reject) => {
              if (pins.length === 1) {
                db.all(
                  `SELECT ST_AsGeoJSON(ST_Buffer(geom, $1)) AS geojson FROM temp_pins`,
                  [bufferDistance],
                  (err: Error | null, rows: Array<{ geojson: string }>) => {
                    if (err) reject(err);
                    else resolve(JSON.parse(rows[0].geojson));
                  }
                );
              } else {
                db.run(
                  `CREATE TEMP TABLE buffered_pins AS
                   SELECT id, ST_Buffer(geom, $1) AS buffered_geom
                   FROM temp_pins`,
                  [bufferDistance],
                  (err: Error | null) => {
                    if (err) {
                      reject(err);
                      return;
                    }

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
                      (err: Error | null, rows: Array<{ geojson: string }>) => {
                        if (err) {
                          reject(err);
                        } else {
                          resolve(JSON.parse(rows[0].geojson));
                        }
                      }
                    );
                  }
                );
              }
            });

            await db.run("DROP TABLE temp_pins");
            if (pins.length > 1) {
              await db.run("DROP TABLE buffered_pins");
            }

            return {
              mapData: geojson,
              explanation: `Buffered ${pins.length} pin(s) by ${distance}km.`,
              count: pins.length,
            };
          },
        }),

        within: tool({
          description:
            "Find all pins within a certain distance from a reference point",
          parameters: z.object({
            distance_km: z.number().describe("Search radius in kilometers"),
          }),
          execute: async ({ distance_km }) => {
            if (!pins?.length || !referencePoint)
              throw new Error("Pins and reference point are required");

            const dataPoints = pins.slice(0, -1);

            if (dataPoints.length === 0) {
              throw new Error(
                "No data points available (only reference point exists)"
              );
            }

            const values = dataPoints
              .map((p, i) => `(${i}, ST_Point(${p.longitude}, ${p.latitude}))`)
              .join(", ");

            await db.run(
              `CREATE TEMP TABLE data_points AS 
               SELECT * FROM (VALUES ${values}) AS t(id, geom)`
            );

            await db.run(
              `CREATE TEMP TABLE ref_point AS 
               SELECT ST_Point(${referencePoint.longitude}, ${referencePoint.latitude}) AS geom`
            );

            const radiusDeg = distance_km / 111;

            const rows = await new Promise<Array<{ geojson: string }>>(
              (resolve, reject) => {
                db.all(
                  `SELECT ST_AsGeoJSON(geom) AS geojson
                 FROM data_points
                 WHERE ST_DWithin(geom, (SELECT geom FROM ref_point), $1)`,
                  [radiusDeg],
                  (err: Error | null, rows: Array<{ geojson: string }>) =>
                    err ? reject(err) : resolve(rows)
                );
              }
            );

            await db.run("DROP TABLE data_points");
            await db.run("DROP TABLE ref_point");

            return {
              mapData: {
                type: "FeatureCollection",
                features: rows.map((r) => ({
                  type: "Feature",
                  geometry: JSON.parse(r.geojson),
                  properties: {},
                })),
              },
              explanation: `Found ${rows.length} pins within ${distance_km}km.`,
              count: rows.length,
            };
          },
        }),

        nearest: tool({
          description: "Find the k nearest pins to a reference point",
          parameters: z.object({
            k: z
              .number()
              .int()
              .positive()
              .describe("Number of nearest pins to return"),
          }),
          execute: async ({ k }) => {
            if (!pins?.length || !referencePoint)
              throw new Error("Pins and reference point are required");

            const dataPoints = pins.slice(0, -1);

            if (dataPoints.length === 0) {
              throw new Error(
                "No data points available (only reference point exists)"
              );
            }

            const values = dataPoints
              .map((p, i) => `(${i}, ST_Point(${p.longitude}, ${p.latitude}))`)
              .join(", ");

            await db.run(
              `CREATE TEMP TABLE data_points AS 
               SELECT * FROM (VALUES ${values}) AS t(id, geom)`
            );

            await db.run(
              `CREATE TEMP TABLE ref_point AS 
               SELECT ST_Point(${referencePoint.longitude}, ${referencePoint.latitude}) AS geom`
            );

            const rows = await new Promise<Array<{ geojson: string }>>(
              (resolve, reject) => {
                db.all(
                  `SELECT ST_AsGeoJSON(geom) AS geojson
                 FROM data_points
                 ORDER BY ST_Distance(geom, (SELECT geom FROM ref_point))
                 LIMIT $1`,
                  [k],
                  (err: Error | null, rows: Array<{ geojson: string }>) =>
                    err ? reject(err) : resolve(rows)
                );
              }
            );

            await db.run("DROP TABLE data_points");
            await db.run("DROP TABLE ref_point");

            return {
              mapData: {
                type: "FeatureCollection",
                features: rows.map((r) => ({
                  type: "Feature",
                  geometry: JSON.parse(r.geojson),
                  properties: {},
                })),
              },
              explanation: `Returned ${rows.length} nearest pins.`,
              count: rows.length,
            };
          },
        }),
      },
    });

    return result.toDataStreamResponse();
  } catch (err) {
    console.error("GeoAI Tool Error:", err);
    return Response.json(
      {
        error: "LLM error",
        message: err instanceof Error ? err.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
