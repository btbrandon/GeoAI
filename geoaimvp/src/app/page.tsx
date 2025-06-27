"use client";

import { useState, useEffect } from "react";
import StructuredChatInterface from "@/features/StructuredChatInterface";
import MapComponent from "@/features/Map";
import { Pin } from "@/lib/utils";

export default function HomePage() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [mapData, setMapData] = useState<Record<string, unknown> | null>(null);
  const [referencePoint, setReferencePoint] = useState<Pin | null>(null);
  const [lastSpatialOp, setLastSpatialOp] = useState<string | null>(null);

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

  const handleMapDataUpdate = (data: any) => {
    setMapData(data);
  };

  const handleSpatialOpUpdate = (op: string) => {
    setLastSpatialOp(op === "" ? null : op);
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
        <StructuredChatInterface
          pins={pins}
          referencePoint={referencePoint}
          onMapDataUpdate={handleMapDataUpdate}
          onSpatialOpUpdate={handleSpatialOpUpdate}
        />
      </div>
    </div>
  );
}
