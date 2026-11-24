import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Check, Copy, Download, ExternalLink, MapPin, Navigation } from 'lucide-react';
import type { Empresa, Vacante } from '../types';

interface OpenStreetMapViewProps {
  empresas: Empresa[];
  vacantes: Vacante[];
  initialEmpresaId?: number | null;
}

function buildGoogleMapsSearchUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function buildGoogleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function OpenStreetMapView({
  empresas,
  vacantes,
  initialEmpresaId,
}: OpenStreetMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [rubroFilter, setRubroFilter] = useState('');
  const [onlyWithOpenVacancies, setOnlyWithOpenVacancies] = useState(false);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(
    initialEmpresaId || (empresas[0]?.id ?? null)
  );
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    if (initialEmpresaId) {
      setSelectedEmpresaId(initialEmpresaId);
    }
  }, [initialEmpresaId]);

  const rubros = useMemo(
    () => Array.from(new Set(empresas.map((e) => e.rubro).filter(Boolean))).sort(),
    [empresas]
  );

  const filteredEmpresas = useMemo(() => {
    return empresas.filter((e) => {
      if (rubroFilter && e.rubro !== rubroFilter) return false;
      if (onlyWithOpenVacancies) {
        const hasOpen = vacantes.some((v) => v.empresa_id === e.id && v.estado === 'abierta');
        if (!hasOpen) return false;
      }
      return true;
    });
  }, [empresas, vacantes, rubroFilter, onlyWithOpenVacancies]);

  const selectedEmpresa = useMemo(
    () => filteredEmpresas.find((e) => e.id === selectedEmpresaId) || filteredEmpresas[0] || null,
    [filteredEmpresas, selectedEmpresaId]
  );

  const selectedEmpresaVacantes = useMemo(
    () => (selectedEmpresa ? vacantes.filter((v) => v.empresa_id === selectedEmpresa.id) : []),
    [selectedEmpresa, vacantes]
  );

  // Initialize Leaflet OpenStreetMap instance once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [-25.28646, -57.58],
      zoom: 12,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    markersLayerRef.current = layer;

    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  // Update markers when filtered list or selection changes
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    filteredEmpresas.forEach((emp) => {
      const openCount = vacantes.filter((v) => v.empresa_id === emp.id && v.estado === 'abierta').length;
      const isSelected = selectedEmpresa?.id === emp.id;

      const pinBg = isSelected ? '#1D4ED8' : openCount > 0 ? '#0F766E' : '#475569';
      const pinSize = isSelected ? 22 : 16;

      const icon = L.divIcon({
        className: 'osm-company-pin',
        html: `<div style="width:${pinSize}px;height:${pinSize}px;background:${pinBg};border:2.5px solid #FFFFFF;border-radius:4px;box-shadow:0 2px 6px rgba(15,23,42,0.4);"></div>`,
        iconSize: [pinSize, pinSize],
        iconAnchor: [pinSize / 2, pinSize / 2],
      });

      const marker = L.marker([emp.latitud, emp.longitud], { icon });
      const gmapsUrl = buildGoogleMapsSearchUrl(emp.latitud, emp.longitud);
      marker.bindPopup(
        `<div style="font-family:Public Sans,sans-serif;min-width:200px;">
          <strong style="font-size:13px;color:#0F172A;">${emp.nombre}</strong>
          <div style="font-size:11px;color:#475569;margin-top:2px;">${emp.rubro} · ${emp.ciudad}</div>
          <div style="font-size:11px;color:#334155;margin-top:4px;">${emp.direccion}</div>
          <div style="font-size:11px;color:#0F766E;font-weight:600;margin-top:6px;">${openCount} vacante(s) abierta(s)</div>
          <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;font-size:11px;font-weight:600;color:#1D4ED8;text-decoration:underline;">Abrir en Google Maps &rarr;</a>
        </div>`
      );
      marker.on('click', () => {
        setSelectedEmpresaId(emp.id);
      });
      marker.addTo(layer);

      if (isSelected) {
        map.flyTo([emp.latitud, emp.longitud], 14, { duration: 0.45 });
      }
    });
  }, [filteredEmpresas, selectedEmpresa?.id, vacantes]);

  function handleCopyGoogleMapsLink(emp: Empresa) {
    const url = buildGoogleMapsSearchUrl(emp.latitud, emp.longitud);
    void navigator.clipboard?.writeText(url);
    setCopiedId(emp.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleExportCsvForGoogleMyMaps() {
    const header = 'Nombre,Rubro,Ciudad,Direccion,Latitud,Longitud,GoogleMapsURL';
    const rows = filteredEmpresas.map((e) => {
      const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
      return [
        esc(e.nombre),
        esc(e.rubro),
        esc(e.ciudad),
        esc(e.direccion),
        e.latitud,
        e.longitud,
        esc(buildGoogleMapsSearchUrl(e.latitud, e.longitud)),
      ].join(',');
    });
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ubicaciones_empresas_google_maps.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportGeoJson() {
    const fc = {
      type: 'FeatureCollection',
      features: filteredEmpresas.map((e) => ({
        type: 'Feature',
        properties: {
          id: e.id,
          nombre: e.nombre,
          rubro: e.rubro,
          ciudad: e.ciudad,
          direccion: e.direccion,
          google_maps_url: buildGoogleMapsSearchUrl(e.latitud, e.longitud),
        },
        geometry: {
          type: 'Point',
          coordinates: [e.longitud, e.latitud],
        },
      })),
    };
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ubicaciones_empresas.geojson';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* Header + Export to Google Maps Actions */}
      <section className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl font-display font-bold text-slate-900">
            Mapa Geográfico de Empresas (OpenStreetMap)
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Visualización interactiva en OpenStreetMap con enlace directo y exportación de coordenadas a Google Maps.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCsvForGoogleMyMaps}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV para Google My Maps
          </button>
          <button
            type="button"
            onClick={handleExportGeoJson}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar GeoJSON
          </button>
        </div>
      </section>

      {/* Filters */}
      <section className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Filtrar empresas por rubro"
            value={rubroFilter}
            onChange={(e) => setRubroFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-md bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="">Todos los rubros ({empresas.length})</option>
            {rubros.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyWithOpenVacancies}
              onChange={(e) => setOnlyWithOpenVacancies(e.target.checked)}
              className="rounded border-slate-300 text-blue-700 focus:ring-blue-600"
            />
            Solo empresas con vacantes abiertas
          </label>
        </div>

        <p className="text-xs text-slate-500 tabular-nums">
          Mostrando {filteredEmpresas.length} ubicaciones en OpenStreetMap
        </p>
      </section>

      {/* Map + Directory & Google Maps Transfer Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
          <div ref={mapContainerRef} className="w-full h-[460px] bg-slate-100" />
          {selectedEmpresa && (
            <div className="p-4 border-t border-slate-200 bg-slate-50/60 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-700 shrink-0" />
                  <h2 className="text-sm font-display font-semibold text-slate-900">
                    {selectedEmpresa.nombre}
                  </h2>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  {selectedEmpresa.rubro} · {selectedEmpresa.direccion}, {selectedEmpresa.ciudad}
                </p>
                <p className="text-xs font-mono text-slate-500 mt-0.5 tabular-nums">
                  Coordenadas: {selectedEmpresa.latitud.toFixed(6)}, {selectedEmpresa.longitud.toFixed(6)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <a
                  href={buildGoogleMapsSearchUrl(selectedEmpresa.latitud, selectedEmpresa.longitud)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 transition-colors whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Ver en Google Maps
                </a>
                <a
                  href={buildGoogleMapsDirectionsUrl(selectedEmpresa.latitud, selectedEmpresa.longitud)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Cómo llegar
                </a>
                <button
                  type="button"
                  onClick={() => handleCopyGoogleMapsLink(selectedEmpresa)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {copiedId === selectedEmpresa.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar enlace
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Company Directory + Associated Vacancies */}
        <aside className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-3.5 border-b border-slate-200">
            <h2 className="text-sm font-display font-semibold text-slate-900">
              Ubicaciones y vacantes asociadas
            </h2>
            <p className="text-xs text-slate-500">
              Seleccione una empresa para enfocarla y transferir su ubicación a Google Maps
            </p>
          </div>

          <div className="divide-y divide-slate-200 overflow-y-auto max-h-[320px]">
            {filteredEmpresas.map((emp) => {
              const empOpen = vacantes.filter((v) => v.empresa_id === emp.id && v.estado === 'abierta');
              const isSelected = selectedEmpresa?.id === emp.id;
              return (
                <div
                  key={emp.id}
                  className={`p-3.5 transition-colors ${isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedEmpresaId(emp.id)}
                      className="text-left flex-1 cursor-pointer"
                    >
                      <div className="text-sm font-semibold text-slate-900">{emp.nombre}</div>
                      <div className="text-xs text-slate-500">
                        {emp.rubro} · {emp.ciudad}
                      </div>
                      <div className="text-xs text-slate-600 mt-1 tabular-nums">
                        {empOpen.length} vacante(s) abierta(s)
                      </div>
                    </button>
                    <a
                      href={buildGoogleMapsSearchUrl(emp.latitud, emp.longitud)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir en Google Maps"
                      className="px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200 bg-white rounded hover:bg-blue-50 whitespace-nowrap shrink-0"
                    >
                      Google Maps
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedEmpresa && (
            <div className="border-t border-slate-200 p-4 bg-slate-50/70 flex-1">
              <h3 className="text-xs font-semibold text-slate-700 mb-2">
                Vacantes en {selectedEmpresa.nombre}
              </h3>
              {selectedEmpresaVacantes.length === 0 ? (
                <p className="text-xs text-slate-500">Sin vacantes registradas en esta sede.</p>
              ) : (
                <ul className="space-y-2">
                  {selectedEmpresaVacantes.map((v) => (
                    <li key={v.id} className="text-xs bg-white border border-slate-200 rounded p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">{v.cargo}</span>
                        <span className={v.estado === 'abierta' ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>
                          {v.estado === 'abierta' ? 'Abierta' : 'Cerrada'}
                        </span>
                      </div>
                      <div className="text-slate-500 mt-1 tabular-nums">
                        Cierre: {v.cierre} · Cupos disp.: {v.cupos_disponibles}/{v.cupos}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
