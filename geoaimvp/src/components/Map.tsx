"use client";

import { DeckGL } from "@deck.gl/react";
import { TileLayer } from "@deck.gl/geo-layers";
import { BitmapLayer, GeoJsonLayer } from "@deck.gl/layers";
import type { FeatureCollection } from "geojson";

interface MapProps {
  data?: FeatureCollection;
}

export default function MapComponent({ data }: MapProps) {
  const osmLayer = new TileLayer({
    id: "osm-tiles",
    data: "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    pickable: false,
    opacity: 1,

    renderSubLayers: (props) => {
      const raw = props.tile.bbox as any;
      const [west, south, east, north] = Array.isArray(raw)
        ? raw
        : [raw.west, raw.south, raw.east, raw.north];

      const { x, y, z } = props.tile.index as any;

      return new BitmapLayer({
        id: `osm-tile-${z}-${x}-${y}`,
        data: null,
        image: props.data,
        bounds: [west, south, east, north],
        pickable: false,
        opacity: 1,
      });
    },
  });

  const overlayLayer = data
    ? new GeoJsonLayer({
        id: "geojson-overlay",
        data,
        stroked: true,
        filled: false,
        pointRadiusMinPixels: 5,
        getLineColor: [255, 0, 0],
        pickable: true,
      })
    : null;

  const layers = overlayLayer ? [osmLayer, overlayLayer] : [osmLayer];

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
      />
    </div>
  );
}
