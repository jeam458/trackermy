'use client'

import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Mock Data for a trail
const startCoord: [number, number] = [-16.409047, -71.537451] // Arequipa, PE example
const endCoord: [number, number] = [-16.429047, -71.557451]

// Fix for default Leaflet icons in Next.js
const makeIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-icon',
    html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

export default function MapPlaceholder() {
  return (
    <div className="w-full h-72">
      <MapContainer 
        center={[-16.419047, -71.547451]} 
        zoom={13} 
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        
        {/* Draw mock trail line */}
        <Polyline 
          positions={[
            [-16.409047, -71.537451],
            [-16.415047, -71.542451],
            [-16.422047, -71.549451],
            [-16.429047, -71.557451],
          ]} 
          color="#0ea5e9" // Sky blue
          weight={4}
          opacity={0.8}
        />
        
        {/* Start point */}
        <Marker position={startCoord} icon={makeIcon('#10b981')}>
          <Popup className="bg-slate-800 text-white border-0 rounded-xl">
            <span className="font-bold">Start</span>
          </Popup>
        </Marker>

        {/* End point */}
        <Marker position={endCoord} icon={makeIcon('#ef4444')}>
          <Popup className="bg-slate-800 text-white border-0 rounded-xl">
            <span className="font-bold">Finish</span>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}
