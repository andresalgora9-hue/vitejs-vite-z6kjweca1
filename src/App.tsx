import { useState } from "react";

/* ─── DESIGN TOKENS ─── */
const C = {
  bg: "#F5F2EC",
  ink: "#1A1208",
  earth: "#8B5E3C",
  earthLight: "#C4956A",
  cream: "#FFFDF7",
  card: "#FFFFFF",
  border: "#E8E0D0",
  accent: "#E8500A",
  accentLight: "#FFF0EA",
  success: "#2D7A4F",
  successLight: "#E8F5EE",
  muted: "#8A8070",
  gold: "#C9A84C",
};

/* ─── DATA ─── */
const CATEGORIES = [
  { id: "all", label: "Todos", icon: "◈" },
  { id: "electricista", label: "Electricista", icon: "⚡" },
  { id: "fontanero", label: "Fontanero", icon: "🔧" },
  { id: "pintor", label: "Pintor", icon: "🖌" },
  { id: "albanil", label: "Albañil", icon: "🧱" },
  { id: "carpintero", label: "Carpintero", icon: "🪵" },
  { id: "cerrajero", label: "Cerrajero", icon: "🔑" },
  { id: "jardinero", label: "Jardinero", icon: "🌿" },
];

const WORKERS = [
  { id: 1, name: "Marcos Herrera", trade: "Electricista", city: "Madrid", rating: 4.9, reviews: 127, available: true, verified: true, price: 35, bio: "12 años de experiencia. Instalaciones, averías y domótica.", img: "MH", category: "electricista", jobs: 312 },
  { id: 2, name: "Lucía Fernández", trade: "Fontanera", city: "Barcelona", rating: 4.8, reviews: 89, available: true, verified: true, price: 30, bio: "Especialista en tuberías, calderas y sistemas de calefacción.", img: "LF", category: "fontanero", jobs: 201 },
  { id: 3, name: "Roberto Sanz", trade: "Pintor", city: "Valencia", rating: 4.7, reviews: 63, available: false, verified: true, price: 22, bio: "Pintura interior y exterior. Acabados impecables garantizados.", img: "RS", category: "pintor", jobs: 145 },
  { id: 4, name: "Ana García", trade: "Albañila", city: "Sevilla", rating: 5.0, reviews: 41, available: true, verified: true, price: 28, bio: "Reformas integrales, tabiques y revestimientos cerámicos.", img: "AG", category: "albanil", jobs: 98 },
  { id: 5, name: "Javier Moreno", trade: "Carpintero", city: "Málaga", rating: 4.6, reviews: 55, available: true, verified: false, price: 32, bio: "Muebles a medida, puertas y tarimas. Madera maciza.", img: "JM", category: "carpintero", jobs: 134 },
  { id: 6, name: "Elena Ruiz", trade: "Cerrajera", city: "Zaragoza", rating: 4.9, reviews: 78, available: true, verified: true, price: 40, bio: "Apertura de emergencia 24h. Instalación de cajas fuertes.", img: "ER", category: "cerrajero", jobs: 267 },
  { id: 7, name: "Carlos Díaz", trade: "Jardinero", city: "Bilbao", rating: 4.5, reviews: 32, available: false, verified: true, price: 18, bio: "Diseño y mantenimiento de jardines privados y comunidades.", img: "CD", category: "jardinero", jobs: 87 },
  { id: 8, name: "Isabel López", trade: "Electricista", city: "Alicante", rating: 4.8, reviews: 94, available: true, verified: true, price: 33, bio: "Certificada en baja tensión. Placas solares y eficiencia energética.", img: "IL", category: "electricista", jobs: 220 },
];

const PLANS = [
  { id: "basic", name: "Básico", price: 9.99, color: C.muted, features: ["Perfil visible", "5 contactos/mes", "Sin verificación", "Soporte email"] },
  { id: "pro", name: "Profesional", price: 24.99, color: C.accent, popular: true, features: ["Perfil destacado", "Contactos ilimitados", "Sello verificado ✓", "Primero en búsquedas", "Soporte prioritario", "Estadísticas de perfil"] },
  { id: "elite", name: "Élite", price: 49.99, color: C.gold, features: ["Todo lo de Pro", "Badge Élite 🥇", "Anuncios en portada", "Gestor de reseñas", "Facturación integrada", "Llamadas de soporte"] },
];

/* ─── COMPONENTS ─── */
function Avatar({ initials, size = 48, color = C.earth }: any) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, ${color}, ${C.earthLight})`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 700, fontSize: size * 0.33,
      fontFamily: "'Playfair Display', serif", flexShrink: 0,
      border: `2px solid ${C.cream}`,
      boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
    }}>{initials}</div>
  );
}

function Stars({ rating }: any) {
  return (
    <span style={{ color: C.gold, fontSize: 12, letterSpacing: 1 }}>
      {"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))}
    </span>
  );
}

function Badge({ children, color = C.accent, bg }: any) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 99, fontSize: 10,
      fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
      color: color, background: bg || `${color}18`,
      border: `1px solid ${color}30`,
    }}>{children}</span>
  );
}

function WorkerCard({ worker, onContact, index }: any) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: C.card,
        borderRadius: 16,
        border: `1px solid ${hovered ? C.earthLight : C.border}`,
        padding: "20px",
        cursor: "pointer",
        transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
        transform: hovered ? "translateY(-4px)" : "none",
        boxShadow: hovered ? "0 12px 32px rgba(139,94,60,0.15)" : "0 2px 8px rgba(0,0,0,0.04)",
        animation: `fadeUp 0.4s ease ${index * 0.07}s both`,
        position: "relative", overflow: "hidden",
      }}
    >
      {worker.verified && (
        <div style={{ position: "absolute", top: 12, right: 12 }}>
          <Badge color={C.success} bg={C.successLight}>✓ Verificado</Badge>
        </div>
      )}

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 12 }}>
        <Avatar initials={worker.img} size={52} color={worker.available ? C.earth : C.muted} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: C.ink, marginBottom: 2 }}>{worker.name}</p>
          <p style={{ fontSize: 13, color: C.earth, fontWeight: 600, marginBottom: 3 }}>{worker.trade}</p>
          <p style={{ fontSize: 12, color: C.muted }}>📍 {worker.city}</p>
        </div>
      </div>

      <p style={{ fontSize: 12.5, color: C.muted, marginBottom: 14, lineHeight: 1.55 }}>{worker.bio}</p>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <Stars rating={worker.rating} />
        <span style={{ fontSize: 12, color: C.ink, fontWeight: 600 }}>{worker.rating}</span>
        <span style={{ fontSize: 12, color: C.muted }}>({worker.reviews} reseñas)</span>
        <span style={{ fontSize: 11, color: C.muted, marginLeft: "auto" }}>{worker.jobs} trabajos</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <span style={{ fontSize: 20, fontWeight: 800, color: C.ink, fontFamily: "'Playfair Display', serif" }}>{worker.price}€</span>
          <span style={{ fontSize: 12, color: C.muted }}>/hora</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%",
            background: worker.available ? C.success : C.muted,
            display: "inline-block",
            boxShadow: worker.available ? `0 0 6px ${C.success}80` : "none",
          }} />
          <span style={{ fontSize: 11, color: worker.available ? C.success : C.muted, fontWeight: 600 }}>
            {worker.available ? "Disponible" : "Ocupado"}
          </span>
        </div>
      </div>

      {worker.available && (
        <button
          onClick={(e) => { e.stopPropagation(); onContact(worker); }}
          style={{
            marginTop: 14, width: "100%",
            background: hovered ? C.accent : C.ink,
            color: "#fff", border: "none", borderRadius: 10,
            padding: "10px", fontFamily: "inherit", fontSize: 13,
            fontWeight: 700, cursor: "pointer", transition: "background 0.2s",
            letterSpacing: "0.02em",
          }}
        >
          Contactar →
        </button>
      )}
    </div>
  );
}

function PlanCard({ plan, onSelect }: any) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: plan.popular ? C.ink : C.card,
        borderRadius: 20,
        border: `2px solid ${plan.popular ? C.accent : hovered ? plan.color : C.border}`,
        padding: "28px 24px",
        transition: "all 0.25s ease",
        transform: plan.popular ? "scale(1.04)" : hovered ? "translateY(-4px)" : "none",
        boxShadow: plan.popular ? `0 20px 48px rgba(232,80,10,0.2)` : hovered ? "0 8px 24px rgba(0,0,0,0.08)" : "none",
        position: "relative",
      }}
    >
      {plan.popular && (
        <div style={{
          position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
          background: C.accent, color: "#fff", borderRadius: 99,
          padding: "3px 14px", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em",
          textTransform: "uppercase", whiteSpace: "nowrap",
        }}>★ Más popular</div>
      )}

      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: plan.color, marginBottom: 8 }}>{plan.name}</p>
      <div style={{ marginBottom: 20 }}>
        <span style={{ fontSize: 38, fontWeight: 900, color: plan.popular ? "#fff" : C.ink, fontFamily: "'Playfair Display', serif" }}>{plan.price}€</span>
        <span style={{ fontSize: 13, color: plan.popular ? "#ffffff80" : C.muted }}>/mes</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 24 }}>
        {plan.features.map(f => (
          <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ color: plan.color, fontSize: 14, marginTop: 1 }}>✓</span>
            <span style={{ fontSize: 13, color: plan.popular ? "#ffffffCC" : C.muted, lineHeight: 1.4 }}>{f}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => onSelect(plan)}
        style={{
          width: "100%", padding: "12px",
          background: plan.popular ? C.accent : "transparent",
          border: `2px solid ${plan.popular ? C.accent : plan.color}`,
          borderRadius: 10, color: plan.popular ? "#fff" : plan.color,
          fontFamily: "inherit", fontSize: 13, fontWeight: 800,
          cursor: "pointer", transition: "all 0.2s", letterSpacing: "0.02em",
        }}
      >
        Empezar ahora →
      </button>
    </div>
  );
}

function Modal({ worker, onClose }: any) {
  if (!worker) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(26,18,8,0.6)",
        backdropFilter: "blur(8px)", zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.cream, borderRadius: 24, padding: "32px",
          maxWidth: 420, width: "100%",
          boxShadow: "0 40px 80px rgba(0,0,0,0.3)",
          animation: "slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 20 }}>
          <Avatar initials={worker.img} size={64} />
          <div>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 800, color: C.ink }}>{worker.name}</p>
            <p style={{ color: C.earth, fontWeight: 600, fontSize: 14 }}>{worker.trade} · {worker.city}</p>
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <Stars rating={worker.rating} />
              <span style={{ fontSize: 12, color: C.muted }}>{worker.rating} ({worker.reviews})</span>
            </div>
          </div>
        </div>

        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 20 }}>{worker.bio}</p>

        <div style={{ background: C.accentLight, borderRadius: 12, padding: "14px 16px", marginBottom: 20, border: `1px solid ${C.accent}20` }}>
          <p style={{ fontSize: 12, color: C.accent, fontWeight: 700, marginBottom: 4 }}>💡 Para contactar a {worker.name.split(" ")[0]}</p>
          <p style={{ fontSize: 13, color: C.ink }}>El profesional necesita una suscripción activa. Tú como cliente contactas gratis.</p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${C.border}`,
            background: "transparent", color: C.muted, fontFamily: "inherit",
            fontSize: 13, cursor: "pointer",
          }}>Cerrar</button>
          <button style={{
            flex: 2, padding: "12px", borderRadius: 10, border: "none",
            background: C.accent, color: "#fff", fontFamily: "inherit",
            fontSize: 13, fontWeight: 800, cursor: "pointer",
          }}>📞 Ver teléfono</button>
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN APP ─── */
export default function App() {
  const [tab, setTab] = useState("buscar");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [toast, setToast] = useState(null);

  const filtered = WORKERS.filter(w => {
    const matchCat = category === "all" || w.category === category;
    const matchSearch = !search || w.name.toLowerCase().includes(search.toLowerCase()) || w.trade.toLowerCase().includes(search.toLowerCase()) || w.city.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const totalMRR = WORKERS.length * 24.99;

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Lato:wght@400;500;600;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.bg}; font-family: 'Lato', sans-serif; color: ${C.ink}; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: none; } }
        @keyframes toastIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: none; } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        input::placeholder { color: ${C.muted}88; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 99px; }
      `}</style>

      {/* TOAST */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 200,
          background: C.success, color: "#fff", borderRadius: 12,
          padding: "12px 20px", fontSize: 14, fontWeight: 700,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          animation: "toastIn 0.3s ease",
        }}>{toast}</div>
      )}

      <Modal worker={selectedWorker} onClose={() => setSelectedWorker(null)} />

      {/* HEADER */}
      <header style={{
        background: C.cream, borderBottom: `1px solid ${C.border}`,
        position: "sticky", top: 0, zIndex: 50,
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: C.accent, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 18,
            }}>🔨</div>
            <div>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: C.ink, letterSpacing: "-0.03em" }}>Oficio</span>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 900, color: C.accent, letterSpacing: "-0.03em" }}>Ya</span>
            </div>
            <span style={{ fontSize: 10, background: C.accentLight, color: C.accent, padding: "2px 8px", borderRadius: 99, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>España</span>
          </div>

          <nav style={{ display: "flex", gap: 4 }}>
            {[
              { id: "buscar", label: "Buscar" },
              { id: "profesionales", label: "Soy Profesional" },
              { id: "planes", label: "Planes" },
              { id: "negocio", label: "Mi Negocio" },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "8px 16px", borderRadius: 8, border: "none",
                background: tab === t.id ? C.ink : "transparent",
                color: tab === t.id ? "#fff" : C.muted,
                fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                cursor: "pointer", transition: "all 0.2s",
              }}>{t.label}</button>
            ))}
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 60px" }}>

        {/* ── BUSCAR TAB ── */}
        {tab === "buscar" && (
          <>
            {/* Hero */}
            <div style={{
              textAlign: "center", padding: "56px 20px 40px",
              animation: "fadeUp 0.5s ease",
            }}>
              <div style={{ display: "inline-flex", gap: 6, background: C.accentLight, border: `1px solid ${C.accent}30`, borderRadius: 99, padding: "6px 16px", marginBottom: 20 }}>
                <span style={{ animation: "pulse 2s infinite", fontSize: 10 }}>●</span>
                <span style={{ fontSize: 12, color: C.accent, fontWeight: 700 }}>{WORKERS.filter(w=>w.available).length} profesionales disponibles ahora</span>
              </div>
              <h1 style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(32px, 5vw, 54px)", fontWeight: 900,
                color: C.ink, lineHeight: 1.1, marginBottom: 16,
                letterSpacing: "-0.03em",
              }}>
                El profesional que necesitas,<br />
                <span style={{ color: C.accent }}>a un clic de distancia.</span>
              </h1>
              <p style={{ fontSize: 17, color: C.muted, maxWidth: 520, margin: "0 auto 32px", lineHeight: 1.6 }}>
                Electricistas, fontaneros, carpinteros y más. Verificados, con reseñas reales y disponibilidad en tiempo real.
              </p>

              {/* Search */}
              <div style={{
                display: "flex", gap: 0, maxWidth: 520, margin: "0 auto",
                background: C.card, borderRadius: 14,
                border: `2px solid ${C.border}`,
                boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
                overflow: "hidden",
              }}>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Busca por oficio o ciudad..."
                  style={{
                    flex: 1, padding: "14px 18px", border: "none",
                    background: "transparent", fontFamily: "inherit",
                    fontSize: 15, color: C.ink, outline: "none",
                  }}
                />
                <button style={{
                  padding: "14px 24px", background: C.accent, border: "none",
                  color: "#fff", fontFamily: "inherit", fontSize: 14,
                  fontWeight: 800, cursor: "pointer",
                }}>Buscar</button>
              </div>
            </div>

            {/* Category pills */}
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 28 }}>
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setCategory(cat.id)} style={{
                  flexShrink: 0, padding: "8px 16px", borderRadius: 99,
                  border: `1.5px solid ${category === cat.id ? C.earth : C.border}`,
                  background: category === cat.id ? C.earth : C.card,
                  color: category === cat.id ? "#fff" : C.muted,
                  fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", transition: "all 0.2s",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>

            {/* Stats bar */}
            <div style={{
              background: C.card, borderRadius: 14, border: `1px solid ${C.border}`,
              padding: "16px 24px", marginBottom: 28,
              display: "flex", gap: 0,
            }}>
              {[
                { label: "Profesionales registrados", val: WORKERS.length + "+" },
                { label: "Trabajos completados", val: "1.200+" },
                { label: "Ciudades activas", val: "52" },
                { label: "Valoración media", val: "4.8 ★" },
              ].map((s, i) => (
                <div key={s.label} style={{
                  flex: 1, textAlign: "center",
                  borderLeft: i > 0 ? `1px solid ${C.border}` : "none",
                  padding: "0 16px",
                }}>
                  <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 800, color: C.accent }}>{s.val}</p>
                  <p style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.label}</p>
                </div>
              ))}
            </div>

            {/* Results */}
            <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: 14, color: C.muted }}><strong style={{ color: C.ink }}>{filtered.length}</strong> profesionales encontrados</p>
              <select style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", fontFamily: "inherit", fontSize: 13, color: C.ink, cursor: "pointer" }}>
                <option>Más valorados</option>
                <option>Disponibles primero</option>
                <option>Precio: menor a mayor</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {filtered.map((w, i) => (
                <WorkerCard key={w.id} worker={w} index={i} onContact={setSelectedWorker} />
              ))}
              {filtered.length === 0 && (
                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 60, color: C.muted }}>
                  <p style={{ fontSize: 40, marginBottom: 12 }}>🔍</p>
                  <p style={{ fontSize: 16, fontWeight: 600 }}>No encontramos resultados</p>
                  <p style={{ fontSize: 14, marginTop: 6 }}>Prueba con otro oficio o ciudad</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── PROFESIONALES TAB ── */}
        {tab === "profesionales" && (
          <div style={{ padding: "48px 0", animation: "fadeUp 0.4s ease" }}>
            <div style={{ maxWidth: 620, margin: "0 auto", textAlign: "center", marginBottom: 48 }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 900, color: C.ink, letterSpacing: "-0.03em", marginBottom: 16 }}>
                Más clientes,<br /><span style={{ color: C.accent }}>más ingresos.</span>
              </h2>
              <p style={{ fontSize: 16, color: C.muted, lineHeight: 1.7 }}>
                Únete a los mejores profesionales de España. Tu perfil verificado llega a miles de clientes que buscan exactamente lo que tú ofreces.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 40 }}>
              {[
                { icon: "🏆", title: "Clientes verificados", desc: "Solo contactos reales. Sin spam, sin pérdida de tiempo." },
                { icon: "📊", title: "Estadísticas de perfil", desc: "Sabe cuántos clientes vieron tu perfil esta semana." },
                { icon: "⭐", title: "Sistema de reseñas", desc: "Las buenas valoraciones son tu mejor carta de presentación." },
                { icon: "🔔", title: "Notificaciones en tiempo real", desc: "Recibe avisos cuando alguien te contacta o te puntúa." },
              ].map((f, i) => (
                <div key={i} style={{
                  background: C.card, borderRadius: 16, padding: "24px",
                  border: `1px solid ${C.border}`,
                  animation: `fadeUp 0.4s ease ${i * 0.08}s both`,
                }}>
                  <p style={{ fontSize: 28, marginBottom: 10 }}>{f.icon}</p>
                  <p style={{ fontWeight: 700, color: C.ink, marginBottom: 6 }}>{f.title}</p>
                  <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              ))}
            </div>

            <div style={{ textAlign: "center" }}>
              <button onClick={() => setTab("planes")} style={{
                padding: "16px 40px", background: C.accent, color: "#fff",
                border: "none", borderRadius: 14, fontFamily: "inherit",
                fontSize: 15, fontWeight: 800, cursor: "pointer",
                boxShadow: `0 8px 24px ${C.accent}40`,
              }}>
                Ver planes y precios →
              </button>
            </div>
          </div>
        )}

        {/* ── PLANES TAB ── */}
        {tab === "planes" && (
          <div style={{ padding: "48px 0", animation: "fadeUp 0.4s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 900, color: C.ink, letterSpacing: "-0.03em", marginBottom: 12 }}>
                Elige tu plan
              </h2>
              <p style={{ fontSize: 16, color: C.muted }}>Sin permanencia. Cancela cuando quieras.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, maxWidth: 860, margin: "0 auto", alignItems: "center" }}>
              {PLANS.map(plan => (
                <PlanCard key={plan.id} plan={plan} onSelect={(p) => showToast(`✓ Plan ${p.name} seleccionado — integrando pago...`)} />
              ))}
            </div>

            <div style={{ textAlign: "center", marginTop: 32, padding: "20px", background: C.successLight, borderRadius: 14, maxWidth: 500, margin: "32px auto 0", border: `1px solid ${C.success}30` }}>
              <p style={{ fontSize: 14, color: C.success, fontWeight: 700 }}>✓ Pago 100% seguro · Factura incluida · Soporte en español</p>
            </div>
          </div>
        )}

        {/* ── NEGOCIO TAB ── */}
        {tab === "negocio" && (
          <div style={{ padding: "48px 0", animation: "fadeUp 0.4s ease" }}>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 900, color: C.ink, marginBottom: 6 }}>Dashboard del Negocio</h2>
              <p style={{ color: C.muted, fontSize: 14 }}>Proyecciones en tiempo real de OfficioYa</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
              {[
                { label: "Profesionales activos", val: WORKERS.length, suffix: "", color: C.earth },
                { label: "MRR estimado", val: `${(WORKERS.length * 24.99).toFixed(0)}€`, suffix: "/mes", color: C.accent },
                { label: "ARR estimado", val: `${(WORKERS.length * 24.99 * 12).toFixed(0)}€`, suffix: "/año", color: C.success },
                { label: "Ciudad objetivo", val: "Madrid", suffix: "", color: C.gold },
              ].map((s, i) => (
                <div key={i} style={{
                  background: C.card, borderRadius: 14, padding: "20px",
                  border: `1px solid ${C.border}`,
                  animation: `fadeUp 0.4s ease ${i * 0.08}s both`,
                }}>
                  <p style={{ fontSize: 11, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{s.label}</p>
                  <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 900, color: s.color }}>{s.val}<span style={{ fontSize: 13, fontFamily: "Lato", color: C.muted }}>{s.suffix}</span></p>
                </div>
              ))}
            </div>

            {/* Growth projections */}
            <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: "24px", marginBottom: 20 }}>
              <p style={{ fontWeight: 700, color: C.ink, marginBottom: 20, fontSize: 15 }}>📈 Proyección de crecimiento (Plan Pro · 24,99€/mes)</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { mes: "Mes 1", pros: 20, mrr: 499, label: "Arranque" },
                  { mes: "Mes 3", pros: 100, mrr: 2499, label: "Tracción" },
                  { mes: "Mes 6", pros: 300, mrr: 7497, label: "Crecimiento" },
                  { mes: "Mes 12", pros: 800, mrr: 19992, label: "Escala" },
                  { mes: "Mes 24", pros: 2500, mrr: 62475, label: "🚀 Lanzados" },
                ].map((row) => (
                  <div key={row.mes} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ width: 60, fontSize: 12, color: C.muted, flexShrink: 0 }}>{row.mes}</span>
                    <div style={{ flex: 1, height: 10, background: C.bg, borderRadius: 99, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 99,
                        background: `linear-gradient(90deg, ${C.earth}, ${C.accent})`,
                        width: `${(row.pros / 2500) * 100}%`,
                        transition: "width 1s ease",
                      }} />
                    </div>
                    <span style={{ width: 90, fontSize: 13, fontWeight: 700, color: C.accent, textAlign: "right", fontFamily: "monospace" }}>{row.mrr.toLocaleString()}€/m</span>
                    <span style={{ width: 80, fontSize: 11, color: C.muted }}>{row.pros} pros</span>
                    <Badge color={row.mes === "Mes 24" ? C.accent : C.earth}>{row.label}</Badge>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ background: C.accentLight, borderRadius: 14, padding: "20px", border: `1px solid ${C.accent}20` }}>
                <p style={{ fontWeight: 800, color: C.accent, marginBottom: 8 }}>💡 Próximos pasos</p>
                {["Crear cuenta en Stripe para cobros", "Publicar en grupos de Facebook de oficios", "Contactar gremios locales (electricistas, fontaneros)", "Lanzar en Madrid → Barcelona → Valencia"].map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: C.accent, fontWeight: 700 }}>{i + 1}.</span>
                    <span style={{ fontSize: 13, color: C.ink }}>{s}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: C.successLight, borderRadius: 14, padding: "20px", border: `1px solid ${C.success}20` }}>
                <p style={{ fontWeight: 800, color: C.success, marginBottom: 8 }}>✓ Ventaja competitiva</p>
                {["Sin inversión inicial necesaria", "Modelo SaaS con ingresos recurrentes", "Mercado fragmentado (sin líder claro)", "Alta demanda de mano de obra cualificada"].map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: C.success }}>✓</span>
                    <span style={{ fontSize: 13, color: C.ink }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
