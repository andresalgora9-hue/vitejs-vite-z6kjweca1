// ════════════════════════════════════════════════════════════════════
// MapaZonas.tsx — Mapa interactivo de municipios de Sevilla
// 
// INSTRUCCIONES DE INSTALACIÓN:
// 1. npm install leaflet react-leaflet @types/leaflet
// 2. En index.html añade dentro de <head>:
//    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
// 3. Copia sevillaGeoJSON.ts a src/sevillaGeoJSON.ts
// 4. Copia este archivo a src/MapaZonas.tsx
// 5. En App.tsx importa: import { MapaZonas } from './MapaZonas';
//    y import { MapaProModal } from './MapaZonas';
// ════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from "react-leaflet";
import type { Layer, LeafletMouseEvent } from "leaflet";
import L from "leaflet";
import { SEVILLA_GEOJSON } from "./sevillaGeoJSON";

// ── Paleta de colores OfficioYa ──
const C = {
  bg:"#0A0A0F", surface:"#111118", card:"#16161F",
  border:"#1E1E30", accent:"#FFD700", orange:"#FF8C00",
  red:"#FF4455", green:"#00D68F", blue:"#3B82F6",
  cyan:"#06B6D4", text:"#F0F0FA", muted:"#44445A", mutedL:"#7777AA",
};

// ── Colores para zonas del mapa ──
const ZONE_COLORS = [
  "#FFD700","#FF8C00","#00D68F","#3B82F6","#8B5CF6",
  "#EC4899","#06B6D4","#F59E0B","#10B981","#6366F1",
  "#EF4444","#84CC16","#F97316","#A78BFA","#34D399",
];
const zoneColor = (name: string) =>
  ZONE_COLORS[Math.abs([...name].reduce((a,c)=>a+c.charCodeAt(0),0)) % ZONE_COLORS.length];

// ── FlyTo helper ──
const proIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;background:linear-gradient(135deg,#FFD700,#FF8C00);border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px rgba(255,215,0,0.8);cursor:pointer;"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});
function FlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, zoom, { duration: 0.8 }); }, []);
  return null;
}

// ════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL: MapaZonas
// Uso: <MapaZonas selectedZones={[]} onZonesChange={fn} onSearch={fn} onClose={fn} prosByZone={fn} />
// ════════════════════════════════════════════════════════════════════
interface MapaZonasProps {
  selectedZones: string[];
  onZonesChange: (zones: string[]) => void;
  onSearch: (zones: string[]) => void;
  onClose: () => void;
  // Función que devuelve cuántos profesionales hay en una zona
  prosByZone: (zone: string) => number;
  workers?: any[];
  onWorkerSelect?: (w: any) => void;
}

export function MapaZonas({ selectedZones, onZonesChange, onSearch, onClose, prosByZone, workers=[], onWorkerSelect }: MapaZonasProps) {
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const toggleZone = useCallback((name: string) => {
    onZonesChange(
      selectedZones.includes(name)
        ? selectedZones.filter(z => z !== name)
        : [...selectedZones, name]
    );
  }, [selectedZones, onZonesChange]);

  const styleFeature = useCallback((feature: any) => {
    const name = feature.properties.name;
    const isSelected = selectedZones.includes(name);
    const isHovered = hoveredZone === name;
    const col = zoneColor(name);
    const proCount = prosByZone(name);

    return {
      fillColor: isSelected ? col : isHovered ? col + "88" : col + "18",
      fillOpacity: isSelected ? 0.55 : isHovered ? 0.35 : proCount > 0 ? 0.2 : 0.08,
      color: isSelected ? col : isHovered ? col + "CC" : col + "44",
      weight: isSelected ? 2.5 : isHovered ? 1.5 : 0.8,
      dashArray: isSelected ? undefined : "3,4",
    };
  }, [selectedZones, hoveredZone, prosByZone]);

  const onEachFeature = useCallback((feature: any, layer: Layer) => {
    const name = feature.properties.name;
    const proCount = prosByZone(name);
    const col = zoneColor(name);

    // Tooltip
    layer.bindTooltip(
      `<div style="background:#14141F;border:1px solid ${col}44;border-radius:8px;padding:7px 11px;font-family:'DM Sans',sans-serif;box-shadow:0 4px 16px rgba(0,0,0,0.6)">
        <p style="font-weight:800;font-size:13px;color:${C.text};margin:0 0 3px">${name}</p>
        <p style="font-size:11px;color:${proCount > 0 ? C.green : C.muted};margin:0">${proCount > 0 ? `✓ ${proCount} profesional${proCount > 1 ? "es" : ""}` : "Sin profesionales aún"}</p>
      </div>`,
      { permanent: false, sticky: true, opacity: 1, className: "oy-tooltip" }
    );

    layer.on({
      mouseover: (e: LeafletMouseEvent) => {
        setHoveredZone(name);
        (e.target as any).setStyle({
          fillOpacity: selectedZones.includes(name) ? 0.65 : 0.4,
          weight: selectedZones.includes(name) ? 3 : 2,
        });
      },
      mouseout: (e: LeafletMouseEvent) => {
        setHoveredZone(null);
        (e.target as any).setStyle(styleFeature(feature));
      },
      click: () => toggleZone(name),
    });
  }, [selectedZones, hoveredZone, toggleZone, styleFeature, prosByZone]);

  const totalPros = selectedZones.reduce((sum, z) => sum + prosByZone(z), 0);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 900,
      background: "rgba(4,4,12,0.88)", backdropFilter: "blur(16px)",
      display: "flex", flexDirection: "column",
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: "12px 16px",
        background: "rgba(10,10,15,0.97)",
        borderBottom: "1px solid " + C.border,
        display: "flex", alignItems: "center", gap: 10,
        flexShrink: 0, backdropFilter: "blur(20px)",
        paddingTop: "max(12px, env(safe-area-inset-top))",
        boxShadow: "0 2px 20px rgba(0,0,0,0.5)",
      }}>
        <button onClick={onClose} style={{
          background: "none", border: "1px solid " + C.border + "88",
          borderRadius: 8, color: C.mutedL, cursor: "pointer",
          padding: "6px 12px", fontSize: 13, fontFamily: "'DM Sans',sans-serif",
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
            <path d="M8.5 1.5L1.5 8L8.5 14.5" stroke={C.mutedL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Atrás
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 800, fontSize: 15, color: C.text, lineHeight: 1 }}>
            🗺️ Mapa de Sevilla
          </p>
          <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            Toca una zona para seleccionarla
          </p>
        </div>
        {selectedZones.length > 0 && (
          <button onClick={() => onZonesChange([])} style={{
            background: "none", border: "1px solid " + C.red + "44",
            borderRadius: 8, color: C.red, cursor: "pointer",
            padding: "5px 10px", fontSize: 11, fontFamily: "'DM Sans',sans-serif",
          }}>
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* ── Mapa ── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <MapContainer
          center={[37.35, -5.98]}
          zoom={9}
          style={{ width: "100%", height: "100%", background: "#0A0A0F" }}
          zoomControl={false}
          attributionControl={false}
          whenReady={() => setMapReady(true)}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution=""
          />
          <GeoJSON
            key={selectedZones.join(",") + hoveredZone}
            data={SEVILLA_GEOJSON as any}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
          {workers.filter((w:any)=>w.show_on_map&&w.map_lat&&w.map_lng).map((w:any)=>(
            <Marker key={w.id} position={[w.map_lat,w.map_lng]} icon={proIcon}>
              <Popup>
                <div style={{background:"#14141F",border:"1px solid #FFD70044",borderRadius:10,padding:"10px 12px",fontFamily:"'DM Sans',sans-serif",minWidth:160}}>
                  <p style={{fontWeight:800,fontSize:13,color:"#F0F0FA",margin:"0 0 3px"}}>{w.name}</p>
                  <p style={{fontSize:11,color:"#FFD700",margin:"0 0 8px"}}>{w.trade} · {w.zone}</p>
                  <p style={{fontSize:11,color:"#00D68F",margin:"0 0 8px"}}>⭐ {w.rating>0?w.rating.toFixed(1):"Nuevo"} · {w.price}€/h</p>
                  {onWorkerSelect&&<button onClick={()=>{onWorkerSelect(w);onClose();}} style={{width:"100%",padding:"7px",background:"linear-gradient(135deg,#FFD700,#FF8C00)",border:"none",borderRadius:7,color:"#000",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:12,cursor:"pointer"}}>Ver perfil →</button>}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Zoom controls custom */}
        <div style={{
          position: "absolute", top: 12, right: 12, zIndex: 1000,
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {["+", "−"].map((sym, i) => (
            <button key={sym} onClick={() => {
              const maps = document.querySelectorAll(".leaflet-container");
              if (maps[0]) {
                const m = (maps[0] as any)._leaflet_map;
                if (m) i === 0 ? m.zoomIn() : m.zoomOut();
              }
            }} style={{
              width: 36, height: 36,
              background: "rgba(16,16,28,0.95)",
              border: "1px solid " + C.border,
              borderRadius: 8, color: C.text,
              cursor: "pointer", fontSize: 18, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
            }}>{sym}</button>
          ))}
        </div>
      </div>

      {/* ── Panel inferior: zonas seleccionadas + botón buscar ── */}
      <div style={{
        background: "rgba(10,10,15,0.97)",
        borderTop: "1px solid " + C.border,
        padding: "12px 16px",
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        flexShrink: 0,
        backdropFilter: "blur(20px)",
      }}>
        {selectedZones.length === 0 ? (
          <p style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "6px 0" }}>
            Toca en el mapa para seleccionar zonas
          </p>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {selectedZones.map(z => {
                const col = zoneColor(z);
                const count = prosByZone(z);
                return (
                  <div key={z} style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "5px 10px", borderRadius: 99,
                    background: col + "18", border: "1px solid " + col + "55",
                  }}>
                    <span style={{ fontSize: 11, color: col, fontWeight: 700 }}>{z}</span>
                    {count > 0 && (
                      <span style={{
                        fontSize: 9, color: C.green,
                        background: C.green + "22", borderRadius: 99,
                        padding: "1px 5px", fontWeight: 800,
                      }}>{count}</span>
                    )}
                    <button onClick={() => toggleZone(z)} style={{
                      background: "none", border: "none",
                      color: col + "99", cursor: "pointer",
                      fontSize: 12, padding: 0, lineHeight: 1,
                    }}>✕</button>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => onSearch(selectedZones)}
              style={{
                width: "100%", padding: "14px",
                background: "linear-gradient(135deg," + C.accent + "," + C.orange + ")",
                border: "none", borderRadius: 12,
                color: "#000", fontFamily: "'DM Sans',sans-serif",
                fontWeight: 900, fontSize: 15,
                cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 6px 20px " + C.accent + "44",
              }}
            >
              🔍 Buscar en {selectedZones.length > 1 ? selectedZones.length + " zonas" : selectedZones[0]}
              {totalPros > 0 && (
                <span style={{
                  background: "rgba(0,0,0,0.2)", borderRadius: 99,
                  padding: "2px 10px", fontSize: 12, fontWeight: 700,
                }}>
                  {totalPros} profesional{totalPros > 1 ? "es" : ""}
                </span>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════
// COMPONENTE: MapaProModal
// Para que el profesional elija su zona de servicio desde su perfil
// Uso: <MapaProModal currentZones={user.service_zones} onSave={fn} onClose={fn} />
// ════════════════════════════════════════════════════════════════════
interface MapaProModalProps {
  currentZones: string[];
  onSave: (zones: string[]) => void;
  onClose: () => void;
}

export function MapaProModal({ currentZones, onSave, onClose }: MapaProModalProps) {
  const [selectedZones, setSelectedZones] = useState<string[]>(currentZones);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

  const toggleZone = useCallback((name: string) => {
    setSelectedZones(prev =>
      prev.includes(name) ? prev.filter(z => z !== name) : [...prev, name]
    );
  }, []);

  const styleFeature = useCallback((feature: any) => {
    const name = feature.properties.name;
    const isSelected = selectedZones.includes(name);
    const isHovered = hoveredZone === name;
    const col = zoneColor(name);
    return {
      fillColor: col,
      fillOpacity: isSelected ? 0.55 : isHovered ? 0.35 : 0.1,
      color: isSelected ? col : col + "44",
      weight: isSelected ? 2.5 : 0.8,
      dashArray: isSelected ? undefined : "3,4",
    };
  }, [selectedZones, hoveredZone]);

  const onEachFeature = useCallback((feature: any, layer: Layer) => {
    const name = feature.properties.name;
    const col = zoneColor(name);

    layer.bindTooltip(
      `<div style="background:#14141F;border:1px solid ${col}55;border-radius:8px;padding:6px 10px;font-family:'DM Sans',sans-serif">
        <p style="font-weight:800;font-size:12px;color:${C.text};margin:0">${name}</p>
        <p style="font-size:10px;color:${selectedZones.includes(name) ? C.green : C.muted};margin:2px 0 0">${selectedZones.includes(name) ? "✓ En tu zona" : "Toca para añadir"}</p>
      </div>`,
      { permanent: false, sticky: true, opacity: 1, className: "oy-tooltip" }
    );

    layer.on({
      mouseover: (e: LeafletMouseEvent) => {
        setHoveredZone(name);
        (e.target as any).setStyle({ fillOpacity: 0.45, weight: 2 });
      },
      mouseout: (e: LeafletMouseEvent) => {
        setHoveredZone(null);
        (e.target as any).setStyle(styleFeature(feature));
      },
      click: () => toggleZone(name),
    });
  }, [selectedZones, toggleZone, styleFeature]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 700,
      background: "rgba(4,4,12,0.88)", backdropFilter: "blur(16px)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        paddingTop: "max(12px, env(safe-area-inset-top))",
        background: "rgba(10,10,15,0.97)",
        borderBottom: "1px solid " + C.border,
        display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          background: "none", border: "1px solid " + C.border,
          borderRadius: 8, color: C.muted, cursor: "pointer",
          padding: "6px 10px", fontSize: 13,
        }}>← Atrás</button>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 800, fontSize: 15, color: C.text, lineHeight: 1 }}>
            📍 Tus zonas de servicio
          </p>
          <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
            Selecciona los municipios donde trabajas
          </p>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: C.accent, background: C.accent + "18",
          padding: "3px 9px", borderRadius: 99,
          border: "1px solid " + C.accent + "33",
        }}>
          {selectedZones.length} zonas
        </span>
      </div>

      {/* Mapa */}
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer
          center={[37.35, -5.98]}
          zoom={9}
          style={{ width: "100%", height: "100%", background: "#0A0A0F" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution=""
          />
          <GeoJSON
            key={selectedZones.join(",") + hoveredZone}
            data={SEVILLA_GEOJSON as any}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        </MapContainer>

        {/* Zoom controls */}
        <div style={{
          position: "absolute", top: 12, right: 12, zIndex: 1000,
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {["+", "−"].map((sym, i) => (
            <button key={sym} onClick={() => {
              const maps = document.querySelectorAll(".leaflet-container");
              if (maps[0]) {
                const m = (maps[0] as any)._leaflet_map;
                if (m) i === 0 ? m.zoomIn() : m.zoomOut();
              }
            }} style={{
              width: 36, height: 36,
              background: "rgba(16,16,28,0.95)",
              border: "1px solid " + C.border,
              borderRadius: 8, color: C.text,
              cursor: "pointer", fontSize: 18, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{sym}</button>
          ))}
        </div>
      </div>

      {/* Panel inferior */}
      <div style={{
        background: "rgba(10,10,15,0.97)",
        borderTop: "1px solid " + C.border,
        padding: "12px 16px",
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        flexShrink: 0,
      }}>
        {/* Opción "Toda la provincia" */}
        <button
          onClick={() => {
            const allNames = (SEVILLA_GEOJSON as any).features.map((f: any) => f.properties.name);
            const allSelected = allNames.every((n: string) => selectedZones.includes(n));
            setSelectedZones(allSelected ? [] : allNames);
          }}
          style={{
            width: "100%", padding: "9px",
            background: "transparent",
            border: "1px solid " + C.border,
            borderRadius: 8, color: C.mutedL,
            fontFamily: "'DM Sans',sans-serif",
            fontWeight: 600, fontSize: 12,
            cursor: "pointer", marginBottom: 8,
          }}
        >
          🌍 Seleccionar toda la provincia de Sevilla
        </button>

        {/* Pills zonas seleccionadas */}
        {selectedZones.length > 0 && (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 5,
            maxHeight: 72, overflowY: "auto", marginBottom: 10,
          }}>
            {selectedZones.map(z => {
              const col = zoneColor(z);
              return (
                <div key={z} style={{
                  display: "flex", alignItems: "center", gap: 4,
                  padding: "3px 8px", borderRadius: 99,
                  background: col + "18", border: "1px solid " + col + "44",
                }}>
                  <span style={{ fontSize: 10, color: col, fontWeight: 600 }}>{z}</span>
                  <button onClick={() => toggleZone(z)} style={{
                    background: "none", border: "none",
                    color: col + "88", cursor: "pointer", fontSize: 11, padding: 0,
                  }}>✕</button>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={() => onSave(selectedZones)}
          disabled={selectedZones.length === 0}
          style={{
            width: "100%", padding: "13px",
            background: selectedZones.length > 0
              ? "linear-gradient(135deg," + C.accent + "," + C.orange + ")"
              : C.surface,
            border: "none", borderRadius: 12,
            color: selectedZones.length > 0 ? "#000" : C.muted,
            fontFamily: "'DM Sans',sans-serif",
            fontWeight: 800, fontSize: 14,
            cursor: selectedZones.length > 0 ? "pointer" : "not-allowed",
            boxShadow: selectedZones.length > 0 ? "0 6px 20px " + C.accent + "44" : "none",
            transition: "all 0.2s",
          }}
        >
          {selectedZones.length > 0
            ? `Guardar ${selectedZones.length} zona${selectedZones.length > 1 ? "s" : ""} →`
            : "Selecciona al menos una zona"}
        </button>
      </div>
    </div>
  );
}
