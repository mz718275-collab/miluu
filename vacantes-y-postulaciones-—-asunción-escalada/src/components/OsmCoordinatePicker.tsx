import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface OsmCoordinatePickerProps {
  latitud: number;
  longitud: number;
  onChange: (lat: number, lng: number) => void;
}

export function OsmCoordinatePicker({ latitud, longitud, onChange }: OsmCoordinatePickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [latitud, longitud],
      zoom: 13,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const icon = L.divIcon({
      className: 'custom-osm-pin',
      html: '<div style="width:18px;height:18px;background:#1D4ED8;border:2px solid #FFFFFF;border-radius:4px;box-shadow:0 2px 6px rgba(15,23,42,0.35);"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    const marker = L.marker([latitud, longitud], { icon, draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onChange(Number(pos.lat.toFixed(6)), Number(pos.lng.toFixed(6)));
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = Number(e.latlng.lat.toFixed(6));
      const lng = Number(e.latlng.lng.toFixed(6));
      marker.setLatLng([lat, lng]);
      onChange(lat, lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (markerRef.current && mapRef.current) {
      markerRef.current.setLatLng([latitud, longitud]);
    }
  }, [latitud, longitud]);

  return (
    <div className="space-y-1.5">
      <div
        ref={containerRef}
        className="w-full h-48 rounded-md border border-slate-300 overflow-hidden bg-slate-100"
      />
      <p className="text-xs text-slate-500">
        Haga clic en el mapa OpenStreetMap o arrastre el marcador azul para ubicar la empresa.
      </p>
    </div>
  );
}
