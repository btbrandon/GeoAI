"use client";

import { useState, useEffect } from "react";
import ChatInterface from "@/features/ChatInterface";
import MapComponent from "@/features/Map";
import { Pin, LLMOperation } from "@/lib/utils";

export default function HomePage() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [mapData, setMapData] = useState<Record<string, unknown> | null>(null);
  const [referencePoint, setReferencePoint] = useState<Pin | null>(null);
  const [lastSpatialOp, setLastSpatialOp] = useState<string | null>(null);
  const [chatEvents, setChatEvents] = useState<
    { role: "user" | "assistant"; content: string; timestamp: string }[]
  >([]);

  useEffect(() => {
    if (pins.length > 0) {
      const latestPin = pins[pins.length - 1];
      setReferencePoint(latestPin);
    } else {
      setReferencePoint(null);
    }
  }, [pins]);

  const handlePinsChange = (newPins: Pin[] | ((prevPins: Pin[]) => Pin[])) => {
    setPins(newPins);
  };

  const handleUserMessage = (text: string) => {
    setChatEvents((prev) => [
      ...prev,
      {
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const handleLLMResponse = async (response: { content: string }) => {
    try {
      const content = response.content;

      let operation: LLMOperation | undefined;

      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          operation = JSON.parse(jsonMatch[0]);
        }
      } catch {
        console.log("No valid JSON found in response");
        return;
      }

      if (!operation || !operation.op) {
        console.log("No operation found in response");
        return;
      }

      if (pins.length > 0 && operation.op === "buffer") {
        const response = await fetch("/api/buffer-pins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pins: pins,
            distance:
              typeof operation.params.distance === "number"
                ? operation.params.distance
                : 10,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          setMapData(result);
          setLastSpatialOp("buffer");
          setChatEvents((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `✅ Buffer created around ${pins.length} pin(s) with a distance of ${operation.params.distance} km.`,
              timestamp: new Date().toISOString(),
            },
          ]);
        } else {
          const errorText = await response.text();
          console.error("Buffer API error:", errorText);
        }
      } else if (
        referencePoint &&
        pins.length > 1 &&
        operation.op === "within"
      ) {
        const response = await fetch("/api/within", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            referencePoint: referencePoint,
            pins: pins,
            distance_km:
              typeof operation.params.distance_km === "number"
                ? operation.params.distance_km
                : 5,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          setMapData(result);
          setLastSpatialOp("within");
          const matched = result.features || [];
          const matchedPins = pins.filter((pin) =>
            matched.some(
              (f: any) =>
                f.geometry?.coordinates &&
                Math.abs(f.geometry.coordinates[0] - pin.longitude) <
                  0.000001 &&
                Math.abs(f.geometry.coordinates[1] - pin.latitude) < 0.000001
            )
          );
          const pinList = matchedPins.map(
            (p) =>
              `• ${p.id}: (${p.longitude.toFixed(4)}, ${p.latitude.toFixed(4)})`
          );
          setChatEvents((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `✅ Found ${matchedPins.length} point(s) within ${
                operation.params.distance_km
              }km:\n${pinList.join("\n")}`,
              timestamp: new Date().toISOString(),
            },
          ]);
        } else {
          const errorText = await response.text();
          console.error("Within API error:", errorText);
        }
      } else if (
        referencePoint &&
        pins.length > 1 &&
        operation.op === "nearest"
      ) {
        const response = await fetch("/api/nearest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            referencePoint: referencePoint,
            pins: pins,
            k: typeof operation.params.k === "number" ? operation.params.k : 5,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          setMapData(result);
          setLastSpatialOp("nearest");
          const matched = result.features || [];
          const matchedPins = pins.filter((pin) =>
            matched.some(
              (f: any) =>
                f.geometry?.coordinates &&
                Math.abs(f.geometry.coordinates[0] - pin.longitude) <
                  0.000001 &&
                Math.abs(f.geometry.coordinates[1] - pin.latitude) < 0.000001
            )
          );
          const pinList = matchedPins.map(
            (p) =>
              `• ${p.id}: (${p.longitude.toFixed(4)}, ${p.latitude.toFixed(4)})`
          );
          setChatEvents((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `✅ Found ${
                matchedPins.length
              } nearest point(s):\n${pinList.join("\n")}`,
              timestamp: new Date().toISOString(),
            },
          ]);
        } else {
          const errorText = await response.text();
          console.error("Nearest API error:", errorText);
        }
      } else {
        const apiEndpoint = `/api/${operation.op}`;
        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(operation.params),
        });

        if (response.ok) {
          const result = await response.json();
          setMapData(result);
          setLastSpatialOp(operation.op);
        }
      }
    } catch (error) {
      console.error("Error processing LLM response:", error);
    }
  };

  return (
    <div className="h-screen flex">
      <div className="flex-1 relative">
        <MapComponent
          pins={pins}
          setPins={handlePinsChange}
          mapData={mapData}
          lastSpatialOp={lastSpatialOp}
        />
      </div>
      <div className="w-1/3 p-4 flex flex-col h-screen overflow-hidden">
        <ChatInterface
          onResponse={handleLLMResponse}
          onUserMessage={handleUserMessage}
          pins={pins}
          referencePoint={referencePoint}
          chatEvents={chatEvents}
        />
      </div>
    </div>
  );
}
