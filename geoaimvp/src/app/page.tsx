"use client";

import { useState, useEffect } from "react";
import ChatInterface from "@/components/ChatInterface";
import MapComponent from "@/components/Map";
import { Pin } from "@/lib/utils";

interface LLMOperation {
  op: string;
  params: Record<string, unknown>;
}

export default function HomePage() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [mapData, setMapData] = useState<Record<string, unknown> | null>(null);
  const [referencePoint, setReferencePoint] = useState<Pin | null>(null);
  const [lastSpatialOp, setLastSpatialOp] = useState<string | null>(null);

  // Update reference point whenever pins change
  useEffect(() => {
    console.log("Pins state changed:", pins.length, "pins");
    if (pins.length > 0) {
      const latestPin = pins[pins.length - 1];
      setReferencePoint(latestPin);
      console.log("Updated reference point:", latestPin);
    } else {
      setReferencePoint(null);
      console.log("Cleared reference point");
    }
  }, [pins]);

  // Wrapper function to track pin changes
  const handlePinsChange = (newPins: Pin[] | ((prevPins: Pin[]) => Pin[])) => {
    console.log(
      "handlePinsChange called with:",
      typeof newPins === "function" ? "function" : newPins.length,
      "items"
    );
    setPins(newPins);
  };

  const handleLLMResponse = async (response: { content: string }) => {
    try {
      console.log("=== LLM Response Debug ===");
      console.log("Response received:", response);
      console.log("Current pins at start:", pins.length, pins);

      // Try to parse JSON from the LLM response
      const content = response.content;
      console.log("Content:", content);

      let operation: LLMOperation | undefined;

      try {
        // Look for JSON in the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          operation = JSON.parse(jsonMatch[0]);
          console.log("Parsed operation:", operation);
        }
      } catch {
        console.log("No valid JSON found in response");
        return;
      }

      if (!operation || !operation.op) {
        console.log("No operation found in response");
        return;
      }

      console.log("Processing operation:", operation);
      console.log("Current pins before API call:", pins.length, pins);
      console.log("Reference point:", referencePoint);

      // Handle buffer operation around pins
      if (pins.length > 0 && operation.op === "buffer") {
        console.log("Creating buffer around pins:", pins);

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

        console.log("Buffer API response status:", response.status);

        if (response.ok) {
          const result = await response.json();
          console.log("Buffer result:", result);
          setMapData(result);
          setLastSpatialOp("buffer");
        } else {
          const errorText = await response.text();
          console.error("Buffer API error:", errorText);
        }
      }
      // Handle within operation using reference point
      else if (referencePoint && pins.length > 1 && operation.op === "within") {
        console.log("Finding points within distance of reference point");

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

        console.log("Within API response status:", response.status);

        if (response.ok) {
          const result = await response.json();
          console.log("Within result:", result);
          setMapData(result);
          console.log("MapData set, current pins:", pins.length, pins);
          setLastSpatialOp("within");
        } else {
          const errorText = await response.text();
          console.error("Within API error:", errorText);
        }
      }
      // Handle nearest operation using reference point and pins
      else if (
        referencePoint &&
        pins.length > 1 &&
        operation.op === "nearest"
      ) {
        console.log("Finding k nearest points to reference point");

        const response = await fetch("/api/nearest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            referencePoint: referencePoint,
            pins: pins,
            k: typeof operation.params.k === "number" ? operation.params.k : 5,
          }),
        });

        console.log("Nearest API response status:", response.status);

        if (response.ok) {
          const result = await response.json();
          console.log("Nearest result:", result);
          setMapData(result);
          console.log("MapData set, current pins:", pins.length, pins);
          setLastSpatialOp("nearest");
        } else {
          const errorText = await response.text();
          console.error("Nearest API error:", errorText);
        }
      }
      // Handle other operations
      else {
        console.log("No suitable data available or not a supported operation");

        const apiEndpoint = `/api/${operation.op}`;
        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(operation.params),
        });

        if (response.ok) {
          const result = await response.json();
          setMapData(result);
          console.log(`${operation.op} result:`, result);
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
      <div className="w-1/3 p-4 overflow-auto">
        <ChatInterface
          onResponse={handleLLMResponse}
          pins={pins}
          referencePoint={referencePoint}
        />
      </div>
    </div>
  );
}
