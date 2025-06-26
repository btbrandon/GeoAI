"use client";

import { DeckGL } from "@deck.gl/react";
import { TileLayer } from "@deck.gl/geo-layers";
import { BitmapLayer, GeoJsonLayer } from "@deck.gl/layers";
import type { FeatureCollection } from "geojson";
import { MapComponentProps, Pin } from "@/lib/utils";

export default function MapComponent({
  pins,
  setPins,
  mapData,
  lastSpatialOp,
}: MapComponentProps) {
  console.log("Map component render - pins:", pins, "mapData:", mapData);

  const deleteAllPins = () => {
    setPins([]);
    console.log("All pins deleted");
  };

  const undoLatestPin = () => {
    if (pins.length > 0) {
      const removedPin = pins[pins.length - 1];
      setPins((prev) => prev.slice(0, -1));
      console.log(
        `Undid pin: ${removedPin.id} at ${removedPin.longitude.toFixed(
          6
        )}, ${removedPin.latitude.toFixed(6)}`
      );
    }
  };

  const osmLayer = new TileLayer({
    id: "osm-tiles",
    data: "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    pickable: false,
    opacity: 1,

    renderSubLayers: (props) => {
      const raw = props.tile.bbox as {
        west: number;
        south: number;
        east: number;
        north: number;
      };
      const [west, south, east, north] = Array.isArray(raw)
        ? raw
        : [raw.west, raw.south, raw.east, raw.north];

      const { x, y, z } = props.tile.index as {
        x: number;
        y: number;
        z: number;
      };

      return new BitmapLayer({
        id: `osm-tile-${z}-${x}-${y}`,
        data: undefined,
        image: props.data,
        bounds: [west, south, east, north],
        pickable: false,
        opacity: 1,
      });
    },
  });

  // Determine if we have "within" query results
  const hasWithinResults =
    mapData &&
    mapData.type === "FeatureCollection" &&
    mapData.features &&
    mapData.features.length > 0;

  // Get the IDs of points that are within the search distance
  const withinPointIds = hasWithinResults
    ? new Set(
        mapData.features
          .map(
            (feature: {
              type: string;
              geometry?: { coordinates?: [number, number] };
              coordinates?: [number, number];
            }) => {
              // Extract pin ID from the feature geometry coordinates or directly if geometry object
              const coords =
                feature.geometry?.coordinates ||
                (feature.type === "Point" && Array.isArray(feature.coordinates)
                  ? feature.coordinates
                  : undefined);
              console.log(
                "Processing within feature:",
                feature,
                "coords:",
                coords
              );

              if (!coords) {
                console.warn("Feature missing coordinates:", feature);
                return undefined;
              }

              if (!Array.isArray(coords) || coords.length < 2) {
                console.warn(
                  "Feature has invalid coordinates format:",
                  feature,
                  "coords:",
                  coords
                );
                return undefined;
              }

              // Find matching pin by coordinates
              const matchingPin = pins.find(
                (pin) =>
                  Math.abs(pin.longitude - coords[0]) < 0.000001 &&
                  Math.abs(pin.latitude - coords[1]) < 0.000001
              );

              if (matchingPin) {
                console.log(
                  "Found matching pin:",
                  matchingPin.id,
                  "for coords:",
                  coords
                );
                return matchingPin.id;
              } else {
                console.warn("No matching pin found for coords:", coords);
                return undefined;
              }
            }
          )
          .filter(Boolean)
      )
    : new Set();

  console.log("Points within distance:", withinPointIds);

  // Create separate GeoJSON for different pin types
  const referencePoint = pins.length > 0 ? pins[pins.length - 1] : null;
  const dataPoints = pins.slice(0, -1); // All pins except the reference point

  // Reference point (green)
  const referencePointGeoJSON: FeatureCollection = referencePoint
    ? {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: referencePoint.coordinates,
            },
            properties: {
              id: referencePoint.id,
              longitude: referencePoint.longitude,
              latitude: referencePoint.latitude,
              type: "reference",
            },
          },
        ],
      }
    : { type: "FeatureCollection", features: [] };

  // Data points within distance (yellow)
  const withinPointsGeoJSON: FeatureCollection = {
    type: "FeatureCollection",
    features: dataPoints
      .filter(
        (pin) =>
          withinPointIds.has(pin.id) &&
          Array.isArray(pin.coordinates) &&
          pin.coordinates.length === 2
      )
      .map((pin) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: pin.coordinates,
        },
        properties: {
          id: pin.id,
          longitude: pin.longitude,
          latitude: pin.latitude,
          type: "within",
        },
      })),
  };

  // Data points outside distance (gray)
  const outsidePointsGeoJSON: FeatureCollection = {
    type: "FeatureCollection",
    features: dataPoints
      .filter(
        (pin) =>
          !withinPointIds.has(pin.id) &&
          Array.isArray(pin.coordinates) &&
          pin.coordinates.length === 2
      )
      .map((pin) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: pin.coordinates,
        },
        properties: {
          id: pin.id,
          longitude: pin.longitude,
          latitude: pin.latitude,
          type: "outside",
        },
      })),
  };

  // Reference point layer (red)
  const referencePointLayer = referencePoint
    ? new GeoJsonLayer({
        id: "reference-point-layer",
        data: referencePointGeoJSON,
        stroked: true,
        filled: true,
        pointRadiusMinPixels: 10,
        getFillColor: [255, 0, 0, 200], // Red
        getLineColor: [0, 0, 0, 255], // Black outline
        getLineWidth: 2, // Outline thickness
        pickable: true,
        onClick: (info) => {
          if (info.object) {
            const pin = info.object as {
              properties: { id: string; longitude: number; latitude: number };
            };
            alert(
              `Reference Point: ${
                pin.properties.id
              }\nCoordinates: ${pin.properties.longitude.toFixed(
                6
              )}, ${pin.properties.latitude.toFixed(6)}`
            );
          }
        },
      })
    : null;

  // Within points layer (green)
  const withinPointsLayer =
    withinPointsGeoJSON.features.length > 0
      ? new GeoJsonLayer({
          id: "within-points-layer",
          data: withinPointsGeoJSON,
          stroked: false,
          filled: true,
          pointRadiusMinPixels: 8,
          getFillColor: [0, 255, 0, 200], // Green
          pickable: true,
          onClick: (info) => {
            if (info.object) {
              const pin = info.object as {
                properties: { id: string; longitude: number; latitude: number };
              };
              alert(
                `Point within distance: ${
                  pin.properties.id
                }\nCoordinates: ${pin.properties.longitude.toFixed(
                  6
                )}, ${pin.properties.latitude.toFixed(6)}`
              );
            }
          },
        })
      : null;

  // Outside points layer (gray)
  const outsidePointsLayer =
    outsidePointsGeoJSON.features.length > 0
      ? new GeoJsonLayer({
          id: "outside-points-layer",
          data: outsidePointsGeoJSON,
          stroked: false,
          filled: true,
          pointRadiusMinPixels: 6,
          getFillColor: [128, 128, 128, 150], // Gray
          pickable: true,
          onClick: (info) => {
            if (info.object) {
              const pin = info.object as {
                properties: { id: string; longitude: number; latitude: number };
              };
              alert(
                `Point outside distance: ${
                  pin.properties.id
                }\nCoordinates: ${pin.properties.longitude.toFixed(
                  6
                )}, ${pin.properties.latitude.toFixed(6)}`
              );
            }
          },
        })
      : null;

  // Default pins layer (red) - only show when no "within" results
  const defaultPinsLayer =
    !hasWithinResults && pins.length > 0
      ? new GeoJsonLayer({
          id: "default-pins-layer",
          data: {
            type: "FeatureCollection",
            features: pins.map((pin, idx) => ({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: pin.coordinates,
              },
              properties: {
                id: pin.id,
                longitude: pin.longitude,
                latitude: pin.latitude,
                isReference: idx === pins.length - 1, // last pin is reference
              },
            })),
          },
          stroked: false,
          filled: true,
          pointRadiusMinPixels: 8,
          getFillColor: (d) =>
            d.properties.isReference
              ? [255, 0, 0, 200] // Red for reference point
              : [128, 128, 128, 150], // Gray for others
          pickable: true,
          onClick: (info) => {
            if (info.object) {
              const pin = info.object as {
                properties: { id: string; longitude: number; latitude: number };
              };
              alert(
                `Pin ${
                  pin.properties.id
                }\nCoordinates: ${pin.properties.longitude.toFixed(
                  6
                )}, ${pin.properties.latitude.toFixed(6)}
                `
              );
            }
          },
        })
      : null;

  // Buffer/other map data layer (blue)
  const mapDataLayer =
    mapData && !hasWithinResults
      ? new GeoJsonLayer({
          id: "map-data-layer",
          data: mapData,
          stroked: true,
          filled: true,
          lineWidthMinPixels: 2,
          getFillColor: [0, 100, 255, 100], // Blue with transparency
          getLineColor: [0, 100, 255, 255], // Solid blue
          pickable: true,
        })
      : null;

  console.log("Map layers created:", {
    referencePointLayer: !!referencePointLayer,
    withinPointsLayer: !!withinPointsLayer,
    outsidePointsLayer: !!outsidePointsLayer,
    defaultPinsLayer: !!defaultPinsLayer,
    mapDataLayer: !!mapDataLayer,
  });

  const handleMapClick = (info: { coordinate?: number[] }) => {
    if (info.coordinate && info.coordinate.length >= 2) {
      const [longitude, latitude] = info.coordinate as [number, number];
      const newPin: Pin = {
        id: `pin-${Date.now()}`,
        longitude,
        latitude,
        coordinates: [longitude, latitude],
      };

      setPins((prev) => [...prev, newPin]);
    }
  };

  const layers = [
    osmLayer,
    ...(referencePointLayer ? [referencePointLayer] : []),
    ...(withinPointsLayer ? [withinPointsLayer] : []),
    ...(outsidePointsLayer ? [outsidePointsLayer] : []),
    ...(defaultPinsLayer ? [defaultPinsLayer] : []),
    ...(mapDataLayer ? [mapDataLayer] : []),
  ];

  return (
    <div style={{ position: "absolute", width: "100%", height: "100%" }}>
      <DeckGL
        initialViewState={{
          longitude: 103.8,
          latitude: 1.35,
          zoom: 10,
          pitch: 0,
          bearing: 0,
        }}
        controller
        layers={layers}
        onClick={handleMapClick}
      />

      {/* Display pins info */}
      {pins.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "white",
            padding: "10px",
            borderRadius: "5px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            maxHeight: "200px",
            overflowY: "auto",
            fontSize: "12px",
            minWidth: "200px",
          }}
        >
          <h3 style={{ margin: "0 0 10px 0" }}>Pins ({pins.length})</h3>

          {/* Control buttons */}
          <div style={{ marginBottom: "10px", display: "flex", gap: "5px" }}>
            <button
              onClick={undoLatestPin}
              style={{
                padding: "4px 8px",
                fontSize: "10px",
                backgroundColor: "#ff9800",
                color: "white",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
              }}
              title="Undo latest pin"
            >
              Undo
            </button>
            <button
              onClick={deleteAllPins}
              style={{
                padding: "4px 8px",
                fontSize: "10px",
                backgroundColor: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer",
              }}
              title="Delete all pins"
            >
              Clear All
            </button>
          </div>

          {/* Legend */}
          {hasWithinResults && (
            <div style={{ marginBottom: "10px", fontSize: "10px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "2px",
                }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    backgroundColor: "#ff0000",
                    borderRadius: "50%",
                    marginRight: "5px",
                  }}
                ></div>
                Reference Point
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "2px",
                }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    backgroundColor: "#00ff00",
                    borderRadius: "50%",
                    marginRight: "5px",
                  }}
                ></div>
                {lastSpatialOp === "nearest"
                  ? `Nearest Neighbour${
                      withinPointIds.size === 1 ? "" : "s"
                    } (${withinPointIds.size})`
                  : `Within Distance (${withinPointIds.size})`}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "2px",
                }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    backgroundColor: "#808080",
                    borderRadius: "50%",
                    marginRight: "5px",
                  }}
                ></div>
                Outside Distance
              </div>
            </div>
          )}

          {pins.map((pin) => (
            <div key={pin.id} style={{ marginBottom: "5px" }}>
              <strong>{pin.id}:</strong>
              <br />
              {pin.longitude.toFixed(6)}, {pin.latitude.toFixed(6)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
