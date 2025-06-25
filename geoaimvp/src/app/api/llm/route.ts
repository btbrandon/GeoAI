import { streamText, CoreMessage } from "ai";
import { openai } from "@ai-sdk/openai";

export async function POST(req: Request) {
  const { messages }: { messages: CoreMessage[] } = await req.json();

  const result = await streamText({
    model: openai("gpt-4o-mini"),
    system: "You are a helpful GeoAI assistant.",
    messages,
  });

  // this returns a ReadableStream that Next can stream
  return result.toDataStreamResponse();
}
