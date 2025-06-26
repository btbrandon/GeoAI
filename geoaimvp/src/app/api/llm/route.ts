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
  let systemPrompt = `You are a GeoAI assistant. When a user asks for a spatial operation, respond with a JSON object containing the operation and parameters. Available operations:
- "within": Find all points within X km of a location. Params: { distance_km: number }
- "nearest": Find k nearest points to a location. Params: { location: GeoJSON Point, k: number }
- "buffer": Create a buffer around a geometry. Params: { distance: number }

Example: {"op": "within", "params": {"distance_km": 5}}`;

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
