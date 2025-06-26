import { streamText, CoreMessage } from "ai";
import { openai } from "@ai-sdk/openai";

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

interface LLMRequestBody {
  messages: CoreMessage[];
  pins?: Pin[];
  referencePoint?: ReferencePoint;
}

export async function POST(req: Request) {
  const { messages, pins, referencePoint }: LLMRequestBody = await req.json();

  console.log("LLM API - Received request:", {
    messages,
    pins,
    referencePoint,
  });

  // Create a system prompt that includes pin information if available
  let systemPrompt = `You are a GeoAI assistant. When a user asks for a spatial operation, respond with a JSON object containing the operation and parameters.

  **For any distance parameter, always convert the value to kilometers (km) as a number, regardless of the unit the user provides.**
  - Accept units like 'km', 'kms', 'kilometer', 'kilometers', 'm', 'meter', 'meters', 'metre', 'metres', 'cm', 'centimeter', 'centimeters', 'centimetre', 'centimetres', 'mm', 'millimeter', 'millimeters', 'millimetre', 'millimetres', and their common typos (e.g., 'kilometre', 'kilometres', 'kms', 'meters', 'metres', 'centimetres', 'milimeters', etc.).
  - If the user gives a value in meters, centimeters, or millimeters, convert it to kilometers (e.g., 1000 meters = 1 km, 10 cm = 0.0001 km, 1 mm = 0.000001 km).
  - If the unit is ambiguous, misspelled, or unrecognized, ask the user to clarify.
  - If the user gives a value without a unit, assume kilometers unless context suggests otherwise.
  - Always output the converted value as a number in kilometers in the JSON response.

  Available operations:
  - "within": Find all points within X km of a location. Params: { distance_km: number }
  - "nearest": Find k nearest points to a location. Params: { location: GeoJSON Point, k: number }
  - "buffer": Create a buffer around a geometry. Params: { distance: number }

  Examples:
  User: "within 5 km" → {"op": "within", "params": {"distance_km": 5}}
  User: "within 10 cm" → {"op": "within", "params": {"distance_km": 0.0001}}
  User: "within 2 kms" → {"op": "within", "params": {"distance_km": 2}}
  User: "within 100 milimeters" → {"op": "within", "params": {"distance_km": 0.0001}}
  User: "within 5 meters" → {"op": "within", "params": {"distance_km": 0.005}}
  User: "within 1 kilometre" → {"op": "within", "params": {"distance_km": 1}}
  User: "within 10" → {"op": "within", "params": {"distance_km": 10}} (assume km)
  User: "within 10 sm" → "I'm sorry, I didn't recognize the unit 'sm'. Could you clarify the distance and unit?"
  User: "within 10cm" → {"op": "within", "params": {"distance_km": 0.0001}}
  User: "within 10 centimeters" → {"op": "within", "params": {"distance_km": 0.0001}}
  User: "within 10 millimeters" → {"op": "within", "params": {"distance_km": 0.00001}}
  User: "within 10 m" → {"op": "within", "params": {"distance_km": 0.01}}
  User: "within 10 kilometre" → {"op": "within", "params": {"distance_km": 10}}
  User: "within 10 kilometers" → {"op": "within", "params": {"distance_km": 10}}
  User: "within 10 kmz" → "I'm sorry, I didn't recognize the unit 'kmz'. Could you clarify the distance and unit?"
  User: "within 10" → {"op": "within", "params": {"distance_km": 10}}
  User: "within 10.5 km" → {"op": "within", "params": {"distance_km": 10.5}}
  User: "within 10,5 km" → {"op": "within", "params": {"distance_km": 10.5}}
  User: "within 10.0km" → {"op": "within", "params": {"distance_km": 10}}
  User: "within 10km" → {"op": "within", "params": {"distance_km": 10}}
  User: "within 10 mms" → {"op": "within", "params": {"distance_km": 0.00001}}
  User: "within 10 centimeters" → {"op": "within", "params": {"distance_km": 0.0001}}
  User: "within 10 centimetrs" → {"op": "within", "params": {"distance_km": 0.0001}}
  User: "within 10 metrs" → {"op": "within", "params": {"distance_km": 0.01}}
  User: "within 10 kilometters" → {"op": "within", "params": {"distance_km": 10}}
  User: "within 10 kilometerss" → {"op": "within", "params": {"distance_km": 10}}
  User: "within 10 mm" → {"op": "within", "params": {"distance_km": 0.00001}}
  User: "within 10 cm" → {"op": "within", "params": {"distance_km": 0.0001}}
  User: "within 10 m" → {"op": "within", "params": {"distance_km": 0.01}}
  User: "within 10 km" → {"op": "within", "params": {"distance_km": 10}}
  User: "within 10" → {"op": "within", "params": {"distance_km": 10}}
  User: "within 10.5" → {"op": "within", "params": {"distance_km": 10.5}}
  User: "within 10,5" → {"op": "within", "params": {"distance_km": 10.5}}
  User: "within 10.0" → {"op": "within", "params": {"distance_km": 10}}
  User: "within 10km" → {"op": "within", "params": {"distance_km": 10}}
  User: "within 10 mms" → {"op": "within", "params": {"distance_km": 0.00001}}
  User: "within 10 centimeters" → {"op": "within", "params": {"distance_km": 0.0001}}
  User: "within 10 centimetrs" → {"op": "within", "params": {"distance_km": 0.0001}}
  User: "within 10 metrs" → {"op": "within", "params": {"distance_km": 0.01}}
  User: "within 10 kilometters" → {"op": "within", "params": {"distance_km": 10}}
  User: "within 10 kilometerss" → {"op": "within", "params": {"distance_km": 10}}
  User: "within 10 mm" → {"op": "within", "params": {"distance_km": 0.00001}}
  User: "within 10 cm" → {"op": "within", "params": {"distance_km": 0.0001}}
  User: "within 10 m" → {"op": "within", "params": {"distance_km": 0.01}}
  User: "within 10 km" → {"op": "within", "params": {"distance_km": 10}}
  User: "within 10" → {"op": "within", "params": {"distance_km": 10}}
  User: "within 10.5" → {"op": "within", "params": {"distance_km": 10.5}}
  User: "within 10,5" → {"op": "within", "params": {"distance_km": 10.5}}
  User: "within 10.0" → {"op": "within", "params": {"distance_km": 10}}
  User: "within 10km" → {"op": "within", "params": {"distance_km": 10}}
  User: "within 10 mms" → {"op": "within", "params": {"distance_km": 0.00001}}
  User: "within 10 centimeters" → {"op": "within", "params": {"distance_km": 0.0001}}
  User: "within 10 centimetrs" → {"op": "within", "params": {"distance_km": 0.0001}}
  User: "within 10 metrs" → {"op": "within", "params": {"distance_km": 0.01}}
  User: "within 10 kilometters" → {"op": "within", "params": {"distance_km": 10}}
  User: "within 10 kilometerss" → {"op": "within", "params": {"distance_km": 10}}
  User: "within 10 mm" → {"op": "within", "params": {"distance_km": 0.00001}}

  Respond only with the JSON object for the operation, or a clarification question if the unit is ambiguous.`;

  // If pins are available, add them to the context
  if (pins && pins.length > 0) {
    const pinCoordinates = pins
      .map((pin) => `${pin.longitude.toFixed(6)}, ${pin.latitude.toFixed(6)}`)
      .join("; ");
    systemPrompt += `\n\nUser has dropped ${pins.length} pin(s) on the map with coordinates: ${pinCoordinates}. When the user asks for spatial operations like "add a buffer around these features" or "create a buffer around the pins", use these coordinates as the geometry for the operation.\n\nFor buffer operations around pins, respond with: {"op": "buffer", "params": {"distance": 10}} (the distance in kilometers)`;
  }

  // If reference point is available, add it to the context
  if (referencePoint) {
    systemPrompt += `\n\nUser has set a reference point at coordinates: ${referencePoint.longitude.toFixed(
      6
    )}, ${referencePoint.latitude.toFixed(
      6
    )}. When the user asks for operations relative to "the reference point", "the last pin", "the marked location", "this location", or similar, use this reference point.\n\nFor "within" operations using the reference point (e.g., "show all points within 5km of this location"), respond with: {"op": "within", "params": {"distance_km": 5}} where the distance_km is the distance specified by the user.\n\nThe system will automatically use the reference point and find all other pins within the specified distance.`;
  }

  try {
    const result = await streamText({
      model: openai("gpt-4.1-mini"),
      system: systemPrompt,
      messages,
    });

    console.log("LLM API - Streaming response");
    return result.toDataStreamResponse();
  } catch (err) {
    console.error("LLM error:", err);
    return new Response(err instanceof Error ? err.message : String(err), {
      status: 500,
    });
  }
}
