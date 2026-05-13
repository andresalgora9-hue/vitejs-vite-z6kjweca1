import { useState, useEffect } from "react";
import { db } from "./supabase";
import type { UserRow, Plan } from "./supabase";

// ─── CONFIGURACIÓN DE ESTILO ───
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

const PLAN_COLORS: Record<string, string> = { gratis: "#7777AA", basico: "#3B82F6", pro: "#FFD700", elite: "#FF8C00" };

// ─── COMPONENTES DE UI ───
const Badge = ({ plan }: { plan: string }) => (
  <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 900, color: PLAN_COLORS[plan] || C.muted, background: `${PLAN_COLORS[plan] || C.muted}15`, border: `1px solid ${PLAN_COLORS[plan] || C.muted}44` }}>
    {plan.toUpperCase()}
  </span>
);

const Ava = ({ s, size = 44, color = C.purple, online = false }: any) => (
  <div style={{ position: "relative", flexShrink: 0 }}>
    <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg, ${color}55, ${color}22)`, display: "flex", alignItems: "center", justifyContent: "center", color: C.accent, fontWeight: 900, fontSize: size * 0.35, border: `2px solid ${color}44` }}>{s}</div>
    {online && <div style={{ position: "absolute", bottom: 2, right: 2, width: 10, height: 10, borderRadius: "50%", background: C.green, border: `2px solid ${C.bg}` }} />}
  </div>
);

function SmartMapSelector({ onLocationSelect, selectedLocation }: any) {
  const [view, setView] = useState<"province" | "city">("province");

  return (
    <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 20 }}>
      <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0F0F1A" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
          {view === "province" ? "📍 Selecciona zona en Sevilla" : "🏙️ Barrios de la Capital"}
        </p>
        {view === "city" && (
          <button onClick={() => setView("province")} style={{ background: C.border, border: "none", color: C.text, padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>
            ← Volver
          </button>
        )}
      </div>

      <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
        {view === "province" ? (
          <>
            <button onClick={() => setView("city")} style={{ padding: 16, background: `linear-gradient(135deg, ${C.accent}22, ${C.orange}11)`, border: `2px solid ${C.accent}44`, borderRadius: 12, color: C.accent, fontWeight: 800, cursor: "pointer" }}>
              🏢 SEVILLA CAPITAL <br/> <span style={{ fontSize: 9, opacity: 0.7 }}>Ver barrios</span>
            </button>
            {PUEBLOS_SEVILLA.map(p => (
              <button key={p} onClick={() => onLocationSelect(p)} style={{ padding: 12, background: selectedLocation === p ? C.blue + "22" : C.surface, border: `1px solid ${selectedLocation === p ? C.blue : C.border}`, borderRadius: 12, color: selectedLocation === p ? C.blue : C.mutedL, cursor: "pointer" }}>
                🏘️ {p}
              </button>
            ))}
          </>
        ) : (
          <>
            <button onClick={() => onLocationSelect("Sevilla Capital")} style={{ gridColumn: "1 / -1", padding: 12, background: selectedLocation === "Sevilla Capital" ? C.accent + "22" : C.surface, border: `1px solid ${selectedLocation === "Sevilla Capital" ? C.accent : C.border}`, borderRadius: 12, color: C.accent, fontWeight: 700, cursor: "pointer" }}>
              📍 TODA LA CAPITAL
            </button>
            {SEVILLA_ZONAS.map(z => (
              <button key={z} onClick={() => onLocationSelect(z)} style={{ padding: 10, background: selectedLocation === z ? C.accent + "11" : C.surface, border: `1px solid ${selectedLocation === z ? C.accent : C.border}`, borderRadius: 10, color: selectedLocation === z ? C.accent : C.mutedL, fontSize: 11, cursor: "pointer" }}>
                {z}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [selectedLoc, setSelectedLoc] = useState("Todas las zonas");
  const [trade, setTrade] = useState("Todos");
  const [workers, setWorkers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      let q = db.from("users").select("*").eq("type", "profesional");
      if (selectedLoc !== "Todas las zonas") {
        q = q.or(`zone.eq."${selectedLoc}",service_zones.cs.{"${selectedLoc}"}`);
      }
      if (trade !== "Todos") q = q.eq("trade", trade);
      const { data } = await q;
      const sorted = (data || []).sort((a, b) => {
        const plans: Record<string, number> = { elite: 3, pro: 2, basico: 1, gratis: 0 };
        return (plans[b.plan as string] || 0) - (plans[a.plan as string] || 0);
      });
      setWorkers(sorted);
      setLoading(false);
    }
    fetchData();
  }, [selectedLoc, trade]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, paddingBottom: 80 }}>
      <header style={{ padding: "16px 20px", background: "rgba(10,10,15,0.8)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100, borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, background: `linear-gradient(135deg, ${C.accent}, ${C.orange})`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔨</div>
          <h1 style={{ fontSize: 20, fontWeight: 900 }}>Oficio<span style={{ color: C.accent }}>Ya</span></h1>
        </div>
      </header>

      <main style={{ maxWidth: 600, margin: "0 auto", padding: 20 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>¿Qué necesitas?</h2>
        <SmartMapSelector onLocationSelect={setSelectedLoc} selectedLocation={selectedLoc} />

        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 15 }}>
          <button onClick={() => setTrade("Todos")} style={{ padding: "8px 16px", borderRadius: 99, background: trade === "Todos" ? C.accent : C.surface, color: trade === "Todos" ? "#000" : C.mutedL, border: "none", fontWeight: 700, whiteSpace: "nowrap" }}>Todos</button>
          {OFICIOS.map(o => (
            <button key={o} onClick={() => setTrade(o)} style={{ padding: "8px 16px", borderRadius: 99, background: trade === o ? C.accent : C.surface, color: trade === o ? "#000" : C.mutedL, border: "none", fontWeight: 700, whiteSpace: "nowrap" }}>{o}</button>
          ))}
        </div>

        <section>
          <p style={{ fontSize: 13, color: C.mutedL, marginBottom: 16 }}>{workers.length} profesionales encontrados</p>
          {loading ? <p>Cargando...</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {workers.map(w => (
                <div key={w.id} style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", gap: 12 }}>
                    <Ava s={w.name[0]} online={w.available} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <h3 style={{ fontWeight: 800 }}>{w.name}</h3>
                        <Badge plan={w.plan as Plan} />
                      </div>
                      <p style={{ color: C.accent, fontSize: 12 }}>{w.trade} · {w.zone}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
