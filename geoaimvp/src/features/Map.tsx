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
  const deleteAllPins = () => {
    setPins([]);
  };

  const undoLatestPin = () => {
    if (pins.length > 0) {
      setPins((prev) => prev.slice(0, -1));
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

  const hasWithinResults =
    mapData &&
    mapData.type === "FeatureCollection" &&
    mapData.features &&
    mapData.features.length > 0;

  const hasNearestResults = lastSpatialOp === "nearest" && hasWithinResults;
  const hasWithinDistanceResults =
    lastSpatialOp === "within" && hasWithinResults;
  const hasBufferResults = lastSpatialOp === "buffer" && mapData;

  const resultPointIds =
    hasWithinDistanceResults || hasNearestResults
      ? new Set(
          mapData.features
            .map(
              (feature: {
                type: string;
                geometry?: { coordinates?: [number, number] };
                coordinates?: [number, number];
              }) => {
                const coords =
                  feature.geometry?.coordinates ||
                  (feature.type === "Point" &&
                  Array.isArray(feature.coordinates)
                    ? feature.coordinates
                    : undefined);

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

                const matchingPin = pins.find(
                  (pin) =>
                    Math.abs(pin.longitude - coords[0]) < 0.000001 &&
                    Math.abs(pin.latitude - coords[1]) < 0.000001
                );

                if (matchingPin) {
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

  const referencePoint = pins.length > 0 ? pins[pins.length - 1] : null;
  const dataPoints = pins.slice(0, -1);

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

  const resultPointsGeoJSON: FeatureCollection = {
    type: "FeatureCollection",
    features: dataPoints
      .filter(
        (pin) =>
          resultPointIds.has(pin.id) &&
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
          type: lastSpatialOp === "nearest" ? "nearest" : "within",
        },
      })),
  };

  const otherPointsGeoJSON: FeatureCollection = {
    type: "FeatureCollection",
    features: dataPoints
      .filter(
        (pin) =>
          !resultPointIds.has(pin.id) &&
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
          type: lastSpatialOp === "nearest" ? "not-nearest" : "outside",
        },
      })),
  };

  const referencePointLayer = referencePoint
    ? new GeoJsonLayer({
        id: "reference-point-layer",
        data: referencePointGeoJSON,
        stroked: true,
        filled: true,
        pointRadiusMinPixels: 10,
        getFillColor: [255, 0, 0, 200],
        getLineColor: [0, 0, 0, 255],
        getLineWidth: 2,
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

  const resultPointsLayer =
    (hasWithinDistanceResults || hasNearestResults) &&
    resultPointsGeoJSON.features.length > 0
      ? new GeoJsonLayer({
          id: "result-points-layer",
          data: resultPointsGeoJSON,
          stroked: false,
          filled: true,
          pointRadiusMinPixels: 8,
          getFillColor: (d) =>
            d.properties.type === "nearest"
              ? [0, 255, 0, 200]
              : [0, 255, 0, 200],
          pickable: true,
          onClick: (info) => {
            if (info.object) {
              const pin = info.object as {
                properties: {
                  id: string;
                  longitude: number;
                  latitude: number;
                  type: string;
                };
              };
              alert(
                `Point ${
                  pin.properties.type === "nearest" ? "Nearest" : "Within"
                }: ${
                  pin.properties.id
                }\nCoordinates: ${pin.properties.longitude.toFixed(
                  6
                )}, ${pin.properties.latitude.toFixed(6)}`
              );
            }
          },
        })
      : null;

  const otherPointsLayer =
    (hasWithinDistanceResults || hasNearestResults) &&
    otherPointsGeoJSON.features.length > 0
      ? new GeoJsonLayer({
          id: "other-points-layer",
          data: otherPointsGeoJSON,
          stroked: false,
          filled: true,
          pointRadiusMinPixels: 6,
          getFillColor: [128, 128, 128, 150],
          pickable: true,
          onClick: (info) => {
            if (info.object) {
              const pin = info.object as {
                properties: {
                  id: string;
                  longitude: number;
                  latitude: number;
                  type: string;
                };
              };
              alert(
                `Point ${
                  pin.properties.type === "not-nearest"
                    ? "Outside"
                    : "Not Nearest"
                }: ${
                  pin.properties.id
                }\nCoordinates: ${pin.properties.longitude.toFixed(
                  6
                )}, ${pin.properties.latitude.toFixed(6)}`
              );
            }
          },
        })
      : null;

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
                isReference: idx === pins.length - 1,
              },
            })),
          },
          stroked: false,
          filled: true,
          pointRadiusMinPixels: 8,
          getFillColor: (d) =>
            d.properties.isReference ? [255, 0, 0, 200] : [128, 128, 128, 150],
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

  // Buffer/other map data layer (blue) - only for buffer operations
  const mapDataLayer =
    mapData && lastSpatialOp === "buffer"
      ? new GeoJsonLayer({
          id: "map-data-layer",
          data: mapData,
          stroked: true,
          filled: true,
          lineWidthMinPixels: 2,
          getFillColor: [0, 100, 255, 100],
          getLineColor: [0, 100, 255, 255],
          pickable: true,
        })
      : null;

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
    ...(resultPointsLayer ? [resultPointsLayer] : []),
    ...(otherPointsLayer ? [otherPointsLayer] : []),
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
        controller={true}
        layers={layers}
        onClick={handleMapClick}
      />

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
                      resultPointIds.size === 1 ? "" : "s"
                    } (${resultPointIds.size})`
                  : `Within Distance (${resultPointIds.size})`}
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
                {lastSpatialOp === "nearest"
                  ? "Not Nearest"
                  : "Outside Distance"}
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
