"use client";

import type MapLibreGL from "maplibre-gl";

export type Theme = "light" | "dark";

export interface MapViewport {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

export type MapStyleOption = string | MapLibreGL.StyleSpecification;

export type MapRef = MapLibreGL.Map;

export interface MapArcDatum {
  id: string | number;
  from: [number, number];
  to: [number, number];
}

export interface MapArcEvent<T extends MapArcDatum = MapArcDatum> {
  arc: T;
  longitude: number;
  latitude: number;
  originalEvent: MapLibreGL.MapMouseEvent;
}
