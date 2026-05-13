import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { db, STORAGE_URL } from "./supabase";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { UserRow, MessageRow, JobRow, CertRow, Plan, PhotoRow } from "./supabase";

// ─── CONFIGURACIÓN DE ESTILO Y CONSTANTES ───
const C = {
  bg: "#0A0A0F", surface: "#111118", card: "#16161F", cardHover: "#1C1C2A",
  border: "#1E1E30", accent: "#FFD700", orange: "#FF8C00",
  red: "#FF4455", green: "#00D68F", blue: "#3B82F6", purple: "#8B5CF6",
  text: "#F0F0FA", muted: "#44445A", mutedL: "#7777AA",
};

const SEVILLA_ZONAS = [
  "Casco Antiguo", "Triana", "Los Remedios", "Nervión", "La Macarena",
  "San Pablo", "Bellavista", "Cerro-Amate", "Sur", "Este-Alcosa", "Norte"
];

const PUEBLOS_SEVILLA = [
  "Dos Hermanas", "Alcalá de Guadaíra", "Mairena del Aljarafe", "Camas",
  "San Juan de Aznalfarache", "Utrera", "Bormujos", "Tomares", "La Rinconada"
];

const OFICIOS = ["Electricista", "Fontanero", "Pintor", "Albañil", "Carpintero", "Cerrajero", "Jardinero", "Mecánico", "Climatización"];

const PLAN_COLORS: Record<Plan, string> = { gratis: "#7777AA", basico: "#3B82F6", pro: "#FFD700", elite: "#FF8C00" };

// ─── COMPONENTES ATÓMICOS DE UI ───
const Badge = ({ plan }: { plan: Plan }) => (
  <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 900, color: PLAN_COLORS[plan], background: `${PLAN_COLORS[plan]}15`, border: `1px solid ${PLAN_COLORS[plan]}44` }}>
    {plan.toUpperCase()}
  </span>
);

const Ava = ({ s, size = 44, color = C.purple, online = false }: any) => (
  <div style={{ position: "relative", flexShrink: 0 }}>
    <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg, ${color}55, ${color}22)`, display: "flex", alignItems: "center", justifyContent: "center", color: C.accent, fontWeight: 900, fontSize: size * 0.35, border: `2px solid ${color}44` }}>{s}</div>
    {online && <div style={{ position: "absolute", bottom: 2, right: 2, width: 10, height: 10, borderRadius: "50%", background: C.green, border: `2px solid ${C.bg}` }} />}
  </div>
);

// ─── COMPONENTE DE MAPA "IDEALISTA STYLE" ───
function SmartMapSelector({ onLocationSelect, selectedLocation }: any) {
  const [view, setView] = useState<"province" | "city">("province");

  return (
    <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 20 }}>
      {/* Header del Mapa */}
      <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0F0F1A" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
          {view === "province" ? "📍 Selecciona zona en Sevilla" : "🏙️ Barrios de la Capital"}
        </p>
        {view === "city" && (
          <button onClick={() => setView("province")} style={{ background: C.border, border: "none", color: C.text, padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
            ← Volver a Pueblos
          </button>
        )}
      </div>

      {/* Grid de Selección Visual (Simulando Mapa Dinámico) */}
      <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
        {view === "province" ? (
          <>
            <button 
              onClick={() => setView("city")}
              style={{ padding: 16, background: `linear-gradient(135deg, ${C.accent}22, ${C.orange}11)`, border: `2px solid ${C.accent}44`, borderRadius: 12, color: C.accent, fontWeight: 800, cursor: "pointer" }}
            >
              🏢 SEVILLA CAPITAL <br/> <span style={{ fontSize: 10, opacity: 0.7 }}>Ver barrios</span>
            </button>
            {PUEBLOS_SEVILLA.map(p => (
              <button 
                key={p} 
                onClick={() => onLocationSelect(p)}
                style={{ padding: 12, background: selectedLocation === p ? C.blue + "22" : C.surface, border: `1px solid ${selectedLocation === p ? C.blue : C.border}`, borderRadius: 12, color: selectedLocation === p ? C.blue : C.mutedL, cursor: "pointer", transition: "0.2s" }}
              >
                🏘️ {p}
              </button>
            ))}
          </>
        ) : (
          <>
            <button 
              onClick={() => onLocationSelect("Sevilla Capital")}
              style={{ gridColumn: "1 / -1", padding: 12, background: selectedLocation === "Sevilla Capital" ? C.accent + "22" : C.surface, border: `1px solid ${selectedLocation === "Sevilla Capital" ? C.accent : C.border}`, borderRadius: 12, color: C.accent, fontWeight: 700, cursor: "pointer" }}
            >
              📍 TODA LA CAPITAL
            </button>
            {SEVILLA_ZONAS.map(z => (
              <button 
                key={z} 
                onClick={() => onLocationSelect(z)}
                style={{ padding: 10, background: selectedLocation === z ? C.accent + "11" : C.surface, border: `1px solid ${selectedLocation === z ? C.accent : C.border}`, borderRadius: 10, color: selectedLocation === z ? C.accent : C.mutedL, fontSize: 12, cursor: "pointer" }}
              >
                {z}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── HOME PRINCIPAL DEL CLIENTE ───
function ClientHome({ user, onLogout }: any) {
  const [selectedLoc, setSelectedLoc] = useState("Todas las zonas");
  const [trade, setTrade] = useState("Todos");
  const [workers, setWorkers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Lógica de búsqueda optimizada
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      let q = db.from("users").select("*").eq("type", "profesional");
      
      if (selectedLoc !== "Todas las zonas") {
        q = q.or(`zone.eq."${selectedLoc}",service_zones.cs.{"${selectedLoc}"}`);
      }
      if (trade !== "Todos") q = q.eq("trade", trade);

      const { data } = await q;
      // Priorizar por Plan y Disponibilidad
      const sorted = (data || []).sort((a, b) => {
        const plans: any = { elite: 3, pro: 2, basico: 1, gratis: 0 };
        return plans[b.plan] - plans[a.plan] || (b.available ? 1 : -1);
      });
      setWorkers(sorted);
      setLoading(false);
    }
    fetchData();
  }, [selectedLoc, trade]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'DM Sans', sans-serif", paddingBottom: 80 }}>
      {/* Header Estilo App */}
      <header style={{ padding: "16px 20px", background: "rgba(10,10,15,0.8)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100, borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, background: `linear-gradient(135deg, ${C.accent}, ${C.orange})`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔨</div>
          <h1 style={{ fontSize: 20, fontWeight: 900 }}>Oficio<span style={{ color: C.accent }}>Ya</span></h1>
        </div>
        <Ava s={user.name[0]} size={36} color={C.blue} />
      </header>

      <main style={{ maxWidth: 600, margin: "0 auto", padding: 20 }}>
        {/* Selector de Ubicación Inteligente */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800 }}>¿Qué necesitas?</h2>
            {selectedLoc !== "Todas las zonas" && (
              <button onClick={() => setSelectedLoc("Todas las zonas")} style={{ color: C.accent, fontSize: 12, background: "none", border: "none", cursor: "pointer" }}>✕ Limpiar zona</button>
            )}
          </div>
          
          <SmartMapSelector onLocationSelect={setSelectedLoc} selectedLocation={selectedLoc} />

          {/* Selector de Oficio Rápido */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10 }}>
            <button onClick={() => setTrade("Todos")} style={{ padding: "8px 16px", borderRadius: 99, background: trade === "Todos" ? C.accent : C.surface, color: trade === "Todos" ? "#000" : C.mutedL, border: "none", fontWeight: 700, whiteSpace: "nowrap" }}>Todos</button>
            {OFICIOS.map(o => (
              <button key={o} onClick={() => setTrade(o)} style={{ padding: "8px 16px", borderRadius: 99, background: trade === o ? C.accent : C.surface, color: trade === o ? "#000" : C.mutedL, border: "none", fontWeight: 700, whiteSpace: "nowrap" }}>{o}</button>
            ))}
          </div>
        </div>

        {/* Listado de Resultados */}
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: C.mutedL }}>{workers.length} profesionales encontrados</p>
            <p style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>● {workers.filter(w => w.available).length} Online</p>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: 40 }}>Buscando los mejores profesionales...</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {workers.map(w => (
                <div key={w.id} style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.border}`, position: "relative", transition: "0.2s" }}>
                  <div style={{ display: "flex", gap: 12 }}>
                    <Ava s={w.name[0]} online={w.available} color={PLAN_COLORS[w.plan as Plan]} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <h3 style={{ fontWeight: 800, fontSize: 16 }}>{w.name}</h3>
                        <Badge plan={w.plan as Plan} />
                      </div>
                      <p style={{ color: C.accent, fontSize: 12, fontWeight: 700 }}>{w.trade} · {w.zone}</p>
                      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                        <span style={{ fontSize: 12, color: C.mutedL }}>⭐ {w.rating || "N/A"}</span>
                        <span style={{ fontSize: 12, color: C.mutedL }}>💼 {w.jobs} trabajos</span>
                        <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>{w.price}€/h</span>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
                    <button style={{ padding: "10px", borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontWeight: 700, cursor: "pointer" }}>💬 Perfil</button>
                    <button style={{ padding: "10px", borderRadius: 8, background: `linear-gradient(135deg, ${C.accent}, ${C.orange})`, border: "none", color: "#000", fontWeight: 900, cursor: "pointer" }}>📱 Contactar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Barra de Navegación Inferior */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 70, background: "#0F0F1A", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-around", alignItems: "center", padding: "0 20px" }}>
        <button style={{ color: C.accent, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 20 }}>🔍</span><span style={{ fontSize: 10, fontWeight: 800 }}>BUSCAR</span>
        </button>
        <button style={{ color: C.mutedL, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 20 }}>💬</span><span style={{ fontSize: 10 }}>CHATS</span>
        </button>
        <button style={{ color: C.mutedL, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 20 }}>🏆</span><span style={{ fontSize: 10 }}>RANKING</span>
        </button>
      </nav>
    </div>
  );
}

export default ClientHome;
