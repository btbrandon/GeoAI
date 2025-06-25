"use client";

import { useState } from "react";
import ChatInterface from "@/components/ChatInterface";
import MapComponent from "@/components/Map";
import { FeatureCollection } from "geojson";

export default function HomePage() {
  const [data, setData] = useState<FeatureCollection>();

  // each time the LLM replies, we look for a JSON payload describing
  // which spatial op to call, then fetch that endpoint and render on the map:
  async function handleLLMResponse({
    content,
  }: {
    role: string;
    content: string;
  }) {
    if (content.startsWith("{")) {
      try {
        const { op, params } = JSON.parse(content);
        const res = await fetch(`/api/${op}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        const geo = await res.json();
        setData(
          geo.type === "FeatureCollection"
            ? geo
            : {
                type: "FeatureCollection",
                features: [{ type: "Feature", geometry: geo, properties: {} }],
              }
        );
      } catch (e) {
        console.error("failed to parse LLM JSON or fetch spatial op", e);
      }
    }
  }

  return (
    <div className="h-screen flex">
      <div className="w-1/4 p-4 overflow-auto">
        <ChatInterface onResponse={handleLLMResponse} />
      </div>
      <div className="flex-1 relative">
        <MapComponent data={data} />
      </div>
    </div>
  );
}
