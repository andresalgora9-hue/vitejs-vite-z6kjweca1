import { useState, useEffect, useRef } from "react";
import { db } from "./supabase";
import { PRICE_MAP } from "./constants";

const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const STRIPE_PRICE_ID = PRICE_MAP.elite;

/* ─── TOKENS VISUALES ────────────────────────────────────────────── */
const C = {
  bg:       "#0d0d0d",
  surface:  "#161616",
  card:     "#1a1a1a",
  border:   "#2a2a2a",
  gold:     "#FFB800",
  goldDim:  "rgba(255,184,0,0.12)",
  goldGlow: "rgba(255,184,0,0.25)",
  green:    "#4ade80",
  red:      "#ef4444",
  white:    "#ffffff",
  muted:    "#888888",
  dim:      "#444444",
};

/* ════════════════════════════════════════════════════════════════════
   TRACKING CENTRAL — fuera de todos los componentes
   Dispara Meta Pixel + Google Analytics 4 simultáneamente
═══════════════════════════════════════════════════════════════════ */
const track = (evento: string, datos: Record<string, any> = {}) => {
  if (typeof window === "undefined") return;
  // Meta Pixel
  if ((window as any).fbq) (window as any).fbq("track", evento, datos);
  // Google Analytics 4
  if ((window as any).gtag) (window as any).gtag("event", evento, datos);
};

/* ─── GUARDAR LEAD CON UTMs ──────────────────────────────────────── */
const saveLead = async (form: any) => {
  try {
    const params = new URLSearchParams(window.location.search);
    await db.from("leads_landing").insert({
      nombre:       form.nombre,
      email:        form.email,
      telefono:     form.telefono,
      oficio:       form.oficio,
      convirtio:    false,
      utm_source:   params.get("utm_source")   || "directo",
      utm_medium:   params.get("utm_medium")   || null,
      utm_campaign: params.get("utm_campaign") || null,
      utm_content:  params.get("utm_content")  || null,
    });
  } catch(e) { console.log("Lead save error", e); }
};

/* ─── GLOW LABEL ─────────────────────────────────────────────────── */
function GlowLabel({ children, mb = 8 }: any) {
  return (
    <div style={{ textAlign:"center", marginBottom:mb }}>
      <span style={{
        display:"inline-block",
        fontSize:11, fontWeight:800, letterSpacing:2.5,
        backgroundImage:"linear-gradient(90deg, #888 0%, #FFB800 30%, #fff8e0 50%, #FFB800 70%, #888 100%)",
        backgroundSize:"250% auto",
        WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
        backgroundClip:"text",
        animation:"shimmer 3.5s linear infinite",
        textTransform:"uppercase" as const,
      }}>{children}</span>
    </div>
  );
}

/* ─── FUENTES ────────────────────────────────────────────────────── */
function FontLoader() {
  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap";
    document.head.appendChild(l);
  }, []);
  return null;
}

/* ─── ORBS FLOTANTES ─────────────────────────────────────────────── */
function Orbs() {
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
      <div style={{ position:"absolute", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle,rgba(255,184,0,0.06) 0%,transparent 70%)", top:"-150px", left:"-150px", animation:"orb1 14s ease-in-out infinite" }}/>
      <div style={{ position:"absolute", width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle,rgba(255,184,0,0.04) 0%,transparent 70%)", bottom:"5%", right:"-100px", animation:"orb2 18s ease-in-out infinite" }}/>
      <div style={{ position:"absolute", width:1, height:"35vh", background:"linear-gradient(to bottom,transparent,rgba(255,184,0,0.12),transparent)", top:"20%", right:"15%", animation:"line1 9s ease-in-out infinite" }}/>
      <div style={{ position:"absolute", width:1, height:"22vh", background:"linear-gradient(to bottom,transparent,rgba(255,184,0,0.08),transparent)", top:"55%", left:"10%", animation:"line1 12s ease-in-out infinite 3s" }}/>
      {[[8,3,"18%","7%","6s","0s"],[6,2,"42%","91%","8s","1s"],[8,3,"70%","4%","10s","2s"],[5,2,"82%","75%","7s","0.5s"],[7,3,"12%","68%","9s","3s"]].map(([fs,w,t,l,dur,del],i)=>(
        <div key={i} style={{ position:"absolute", width:w as any, height:w as any, borderRadius:"50%", background:C.gold, opacity:0.3, top:t as any, left:l as any, animation:`dot ${dur} ease-in-out infinite ${del}` }}/>
      ))}
      <style>{`
        @keyframes orb1  {0%,100%{transform:translate(0,0)}50%{transform:translate(35px,-45px)}}
        @keyframes orb2  {0%,100%{transform:translate(0,0)}50%{transform:translate(-28px,38px)}}
        @keyframes line1 {0%,100%{opacity:0.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-28px)}}
        @keyframes dot   {0%,100%{opacity:0.2;transform:translateY(0) scale(1)}50%{opacity:0.7;transform:translateY(-16px) scale(1.5)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:translateX(0)}}
        @keyframes float {0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes pulse2{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.85)}}
        @keyframes ring  {0%{transform:scale(1);opacity:1}100%{transform:scale(2.2);opacity:0}}
        @keyframes shake {0%,100%{transform:rotate(0)}20%,60%{transform:rotate(-12deg)}40%,80%{transform:rotate(12deg)}}
        @keyframes pop   {0%{transform:scale(0.6);opacity:0}100%{transform:scale(1);opacity:1}}
        @keyframes shimmer{0%{background-position:200% center}100%{background-position:-200% center}}
      `}</style>
    </div>
  );
}

/* ─── BADGE ÉLITE ────────────────────────────────────────────────── */
function EliteBadge({ size = 13 }: any) {
  return (
    <span style={{
      background: `linear-gradient(135deg, ${C.gold}, #ff8c00)`,
      color:"#000", fontWeight:800, fontSize:size, letterSpacing:0.5,
      padding:"3px 9px", borderRadius:5, display:"inline-block",
    }}>ELITE</span>
  );
}

/* ─── MOCK ALERTA URGENTE ────────────────────────────────────────── */
function AlertCard({ oficio, emoji, nombre, distancia, urgente, delay="0s" }: any) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), parseFloat(delay)*1000 + 300);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${urgente ? "rgba(255,184,0,0.35)" : C.border}`,
      borderRadius: 16, padding: "14px 16px",
      display: "flex", alignItems: "center", gap: 14,
      opacity: visible ? 1 : 0,
      transform: visible ? "translateX(0)" : "translateX(50px)",
      transition: "all 0.5s cubic-bezier(0.34,1.56,0.64,1)",
      boxShadow: urgente ? `0 0 20px rgba(255,184,0,0.08)` : "none",
    }}>
      <div style={{
        width:44, height:44, borderRadius:"50%", flexShrink:0,
        background:`linear-gradient(135deg, #1e1e1e, #2a2a2a)`,
        border:`1.5px solid ${urgente ? C.gold : C.border}`,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:20, position:"relative",
      }}>
        {emoji}
        {urgente && (
          <>
            <div style={{ position:"absolute", inset:-4, borderRadius:"50%", border:`1px solid ${C.gold}`, animation:"ring 1.5s ease-out infinite" }}/>
            <div style={{ position:"absolute", inset:-4, borderRadius:"50%", border:`1px solid ${C.gold}`, animation:"ring 1.5s ease-out infinite 0.75s" }}/>
          </>
        )}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
          <span style={{ color:C.white, fontWeight:700, fontSize:14, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{nombre}</span>
          {urgente && <span style={{ background:"rgba(239,68,68,0.15)", color:C.red, fontSize:9, fontWeight:700, letterSpacing:1, padding:"2px 7px", borderRadius:4 }}>⚡ URGENTE</span>}
        </div>
        <div style={{ color:C.muted, fontSize:12 }}>Necesita {oficio} · {distancia}</div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        <button style={{ background:C.gold, color:"#000", border:"none", borderRadius:8, padding:"6px 12px", fontSize:11, fontWeight:800, cursor:"pointer", whiteSpace:"nowrap" }}>Aceptar</button>
        <button style={{ background:"transparent", color:C.dim, border:`1px solid ${C.border}`, borderRadius:8, padding:"5px 12px", fontSize:11, cursor:"pointer" }}>Rechazar</button>
      </div>
    </div>
  );
}

/* ─── MOCK PERFIL PROFESIONAL ────────────────────────────────────── */
function MockPerfil({ nombre, oficio, emoji, precio, rating, trabajos, ini }: any) {
  return (
    <div style={{ background: C.card, border:`1px solid ${C.border}`, borderLeft:`3px solid ${C.gold}`, borderRadius:16, padding:"16px", animation:"fadeUp 0.6s ease both" }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
        <div style={{ width:52, height:52, borderRadius:"50%", flexShrink:0, background:"linear-gradient(135deg,#1e3a2e,#0f2a1f)", border:`1.5px solid ${C.gold}`, display:"flex", alignItems:"center", justifyContent:"center", color:C.gold, fontWeight:800, fontSize:16, position:"relative" }}>
          {ini}
          <div style={{ position:"absolute", bottom:0, right:0, width:12, height:12, borderRadius:"50%", background:C.green, border:`2px solid ${C.card}` }}/>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
            <span style={{ color:C.white, fontWeight:700, fontSize:15 }}>{nombre} ✓</span>
            <EliteBadge size={11}/>
          </div>
          <div style={{ color:C.gold, fontSize:13, marginBottom:4 }}>{emoji} {oficio}</div>
          <div style={{ color:"#aaa", fontSize:12 }}><span style={{ color:C.gold }}>★★★★★</span> {rating} · {trabajos} trabajos</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ color:C.gold, fontWeight:800, fontSize:20 }}>{precio}€</div>
          <div style={{ color:C.muted, fontSize:10 }}>/hora</div>
          <div style={{ color:C.green, fontSize:10, marginTop:2 }}>Ppto. gratis</div>
        </div>
      </div>
    </div>
  );
}

/* ─── STEPPER ────────────────────────────────────────────────────── */
function Stepper({ step }: any) {
  const steps = ["Datos","Tarjeta","¡Listo!"];
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", marginBottom:32 }}>
      {steps.map((s,i)=>(
        <div key={s} style={{ display:"flex", alignItems:"center" }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ width:32, height:32, borderRadius:"50%", background: i<step ? C.gold : "transparent", border:`2px solid ${i<=step ? C.gold : C.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color: i<step ? "#000" : i===step ? C.gold : C.dim, margin:"0 auto 5px", boxShadow: i===step ? `0 0 14px ${C.goldGlow}` : "none" }}>
              {i<step ? "✓" : i+1}
            </div>
            <div style={{ fontSize:10, letterSpacing:1.5, textTransform:"uppercase" as const, color:i<=step?C.gold:C.dim }}>{s}</div>
          </div>
          {i<steps.length-1 && <div style={{ width:44, height:1, margin:"0 6px 16px", background:i<step?C.gold:C.border, transition:"background 0.4s" }}/>}
        </div>
      ))}
    </div>
  );
}

/* ─── CAMPO INPUT ────────────────────────────────────────────────── */
function Field({ label, name, type="text", placeholder, value, onChange, error, required }: any) {
  const [foc, setFoc] = useState(false);
  return (
    <div>
      <label style={{ display:"block", marginBottom:6, fontSize:11, letterSpacing:1.5, textTransform:"uppercase" as const, color:foc?C.gold:C.dim, transition:"color 0.2s", fontWeight:600 }}>
        {label}{required && <span style={{ color:C.gold }}> *</span>}
      </label>
      <input
        name={name} type={type} placeholder={placeholder}
        value={value} onChange={onChange}
        onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)}
        style={{ width:"100%", boxSizing:"border-box" as const, background: C.surface, border:`1.5px solid ${error ? C.red : foc ? C.gold : C.border}`, borderRadius:12, padding:"13px 16px", color:C.white, fontSize:15, outline:"none", transition:"border-color 0.2s", fontFamily:"'Inter', sans-serif" }}
      />
      {error && <span style={{ color:C.red, fontSize:11, marginTop:4, display:"block" }}>⚠ {error}</span>}
    </div>
  );
}

/* ─── BOTÓN PRINCIPAL ────────────────────────────────────────────── */
function Btn({ children, onClick, disabled, secondary }: any) {
  const [hov, setHov] = useState(false);
  if (secondary) return (
    <button onClick={onClick} style={{ background:"transparent", border:`1.5px solid ${C.border}`, borderRadius:12, padding:"13px", color:C.muted, fontSize:14, cursor:"pointer", width:"100%", fontFamily:"'Inter', sans-serif" }}>
      {children}
    </button>
  );
  return (
    <button onClick={onClick} disabled={disabled} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{ width:"100%", padding:"16px", background: disabled ? "#222" : hov ? "#ffca2c" : C.gold, border:"none", borderRadius:14, color: disabled ? C.dim : "#000", fontSize:15, fontWeight:800, letterSpacing:0.3, cursor:disabled?"not-allowed":"pointer", transition:"all 0.2s", boxShadow: disabled ? "none" : hov ? `0 6px 28px ${C.goldGlow}` : `0 4px 18px ${C.goldGlow}`, fontFamily:"'Inter', sans-serif" }}>
      {children}
    </button>
  );
}

/* ─── STEP 1: DATOS ──────────────────────────────────────────────── */
function StepDatos({ onNext }: any) {
  const [form, setForm] = useState({ nombre:"", oficio:"", telefono:"", email:"", password:"" });
  const [errors, setErrors] = useState<any>({});

  const OFICIOS = [
    "Electricista","Fontanero","Cerrajero","Pintor","Albañil","Carpintero",
    "Reformas Integrales","Climatización","Técnico de Gas","Desatascos y Camión Cuba",
    "Soldador","Instalador Solar","Yesero","Techador","Montador de Pladur",
    "Parquetista / Pulidor de Suelos","Cristalero","Manitas a Domicilio",
    "Jardinero","Fumigador","Tapicero","Otros"
  ];

  const validate = () => {
    const e: any = {};
    if (!form.nombre.trim())                                 e.nombre   = "Obligatorio";
    if (!form.oficio)                                        e.oficio   = "Selecciona tu oficio";
    if (!/^\d{9}$/.test(form.telefono.replace(/\s/g,"")))   e.telefono = "Teléfono no válido (9 dígitos)";
    if (!form.email.includes("@"))                          e.email    = "Email inválido";
    if (form.password.length < 6)                           e.password = "Mínimo 6 caracteres";
    return e;
  };

  const change = (e: any) => {
    setForm(p => ({...p, [e.target.name]: e.target.value}));
    setErrors((p: any) => ({...p, [e.target.name]: null}));
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <Field label="Nombre completo" name="nombre" placeholder="Tu nombre y apellidos" value={form.nombre} onChange={change} error={errors.nombre} required/>
      <div>
        <label style={{ display:"block", marginBottom:6, fontSize:11, letterSpacing:1.5, textTransform:"uppercase" as const, color:errors.oficio?C.red:C.dim, fontWeight:600 }}>
          Tu oficio <span style={{ color:C.gold }}>*</span>
        </label>
        <select name="oficio" value={form.oficio} onChange={change} style={{ width:"100%", background:C.surface, border:`1.5px solid ${errors.oficio?C.red:C.border}`, borderRadius:12, padding:"13px 16px", color:form.oficio?C.white:C.dim, fontSize:15, outline:"none", fontFamily:"'Inter', sans-serif" }}>
          <option value="">Selecciona tu oficio…</option>
          {OFICIOS.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
        {errors.oficio && <span style={{ color:C.red, fontSize:11, marginTop:4, display:"block" }}>⚠ {errors.oficio}</span>}
      </div>
      <Field label="Teléfono" name="telefono" type="tel" placeholder="612 345 678" value={form.telefono} onChange={change} error={errors.telefono} required/>
      <Field label="Email" name="email" type="email" placeholder="tu@email.com" value={form.email} onChange={change} error={errors.email} required/>
      <Field label="Contraseña" name="password" type="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={change} error={errors.password} required/>

      <div style={{ marginTop:4 }}>
        <Btn onClick={async () => {
          const e = validate();
          if (Object.keys(e).length) { setErrors(e); return; }

          // 🎯 EVENTO: Lead — usuario completó paso 1
          track("Lead", {
            content_name:     "registro_paso1",
            content_category: form.oficio,
            currency:         "EUR",
            value:            0,
          });

          await saveLead(form);
          onNext(form);
        }}>
          Siguiente → Añadir tarjeta
        </Btn>
        <p style={{ color:C.dim, fontSize:11, textAlign:"center", marginTop:12, letterSpacing:0.5 }}>
          🔒 No se realiza ningún cargo hoy
        </p>
      </div>
    </div>
  );
}

/* ─── STEP 2: TARJETA ────────────────────────────────────────────── */
function StepTarjeta({ datos, onSuccess }: any) {
  const cardRef  = useRef<any>(null);
  const stripeRef = useRef<any>(null);
  const cardEl   = useRef<any>(null);
  const [ready,   setReady]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState<string|null>(null);

  useEffect(() => {
    const init = () => {
      stripeRef.current = (window as any).Stripe(STRIPE_PUBLIC_KEY);
      cardEl.current = stripeRef.current.elements().create("card", {
        style: {
          base: { color:C.white, fontFamily:"'Inter', sans-serif", fontSize:"16px", "::placeholder":{color:C.dim}, iconColor:C.gold },
          invalid: { color:C.red },
        },
        hidePostalCode: true,
      });
      cardEl.current.mount(cardRef.current);
      cardEl.current.on("ready",  () => setReady(true));
      cardEl.current.on("change", (e: any) => setErr(e.error?.message || null));
    };
    if ((window as any).Stripe) { init(); return; }
    const s = document.createElement("script");
    s.src = "https://js.stripe.com/v3/";
    s.onload = init;
    document.head.appendChild(s);
  }, []);

  const pay = async () => {
    if (!ready) return;
    setLoading(true); setErr(null);

    const { paymentMethod, error } = await stripeRef.current.createPaymentMethod({
      type: "card", card: cardEl.current,
      billing_details: { name:datos.nombre, email:datos.email, phone:datos.telefono },
    });
    if (error) { setErr(error.message); setLoading(false); return; }

    const res = await fetch("https://rjwojxwrsbvwwshwwpvq.supabase.co/functions/v1/dynamic-handler", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentMethodId: paymentMethod.id,
        email:    datos.email,
        nombre:   datos.nombre,
        telefono: datos.telefono || "",
        priceId:  STRIPE_PRICE_ID,
        userId:   "",
      }),
    });
    const result = await res.json();
    if (!result.ok) { setErr(result.error || "Error al procesar el pago"); setLoading(false); return; }

    // 🎯 EVENTO: Purchase — el más importante para Meta y Google
    track("Purchase", {
      currency:         "EUR",
      value:            0,
      content_name:     "elite_30dias_gratis",
      content_category: datos.oficio,
    });

    // 🎯 EVENTO: Conversión específica de Google Ads
    // Sustituye AW-XXXXXXXXX/YYYYYYY por tu ID real cuando tengas la cuenta
    if ((window as any).gtag) {
      (window as any).gtag("event", "conversion", {
        send_to: "AW-XXXXXXXXX/YYYYYYY",
        value:    0.0,
        currency: "EUR",
      });
    }

    // Marcar lead como convertido en Supabase
    try {
      await db.from("leads_landing").update({ convirtio: true }).eq("email", datos.email);
    } catch(e) {}

    onSuccess();
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ background:C.surface, border:`1.5px solid rgba(255,184,0,0.3)`, borderRadius:16, padding:"16px 18px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}><EliteBadge/></div>
          <div style={{ color:C.muted, fontSize:12 }}>30 días gratis · luego 49,99€/mes</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ color:C.green, fontSize:26, fontWeight:900 }}>0,00€</div>
          <div style={{ color:C.dim, fontSize:10 }}>hoy</div>
        </div>
      </div>

      <div style={{ background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:16, padding:"18px 16px" }}>
        <label style={{ display:"block", marginBottom:12, fontSize:11, letterSpacing:1.5, textTransform:"uppercase" as const, color:C.dim, fontWeight:600 }}>
          Datos de tarjeta
        </label>
        <div ref={cardRef} style={{ minHeight:28 }}/>
        {!ready && <p style={{ color:C.dim, fontSize:11, marginTop:8 }}>Cargando formulario seguro…</p>}
        {err   && <p style={{ color:C.red,  fontSize:12, marginTop:8 }}>⚠ {err}</p>}
        <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:14, paddingTop:14, borderTop:`1px solid ${C.border}` }}>
          <span style={{ fontSize:14 }}>🔒</span>
          <span style={{ color:C.dim, fontSize:11 }}>Pago cifrado con Stripe · Tus datos están seguros</span>
        </div>
      </div>

      <div style={{ display:"flex", gap:8 }}>
        {["VISA","Mastercard","AMEX"].map(c=>(
          <span key={c} style={{ border:`1px solid ${C.border}`, borderRadius:6, padding:"3px 10px", color:C.dim, fontSize:10, letterSpacing:1 }}>{c}</span>
        ))}
      </div>

      <Btn onClick={pay} disabled={!ready||loading}>
        {loading ? "⟳  Activando tu cuenta…" : "Activar 30 días gratis →"}
      </Btn>
      <p style={{ color:C.dim, fontSize:11, textAlign:"center", lineHeight:1.8 }}>
        <div style={{ background:"transparent", border:"none", borderRadius:8, padding:"8px 0", marginBottom:4 }}>
          <p style={{ color:"#444", fontSize:10, lineHeight:1.6, margin:0, textAlign:"center" as const }}>
            ⚠ Dispones de los primeros <strong style={{color:"#555"}}>15 días naturales</strong> para cancelar sin coste.
            A partir del día 16, aunque canceles, se realizará el cargo de <strong style={{color:"#555"}}>49,99€</strong> al vencimiento del período de prueba.
            La cancelación debe solicitarse con <strong style={{color:"#555"}}>15 días de antelación</strong> al siguiente cobro.
            Al activar aceptas los{" "}
            <a href="/terminos"    target="_blank" style={{color:"#FFB800"}}>Términos</a>,{" "}
            <a href="/privacidad"  target="_blank" style={{color:"#FFB800"}}>Privacidad</a> y{" "}
            <a href="/cancelacion" target="_blank" style={{color:"#FFB800"}}>Política de Cancelación</a>.
          </p>
        </div>
      </p>
    </div>
  );
}

/* ─── STEP 3: ÉXITO ──────────────────────────────────────────────── */
function StepExito({ nombre, oficio }: any) {
  return (
    <div style={{ textAlign:"center", animation:"pop 0.4s ease both" }}>
      <div style={{ fontSize:56, marginBottom:16 }}>🎉</div>
      <h2 style={{ color:C.gold, fontSize:26, fontWeight:900, margin:"0 0 8px" }}>
        ¡Bienvenido, {nombre.split(" ")[0]}!
      </h2>
      <p style={{ color:C.muted, fontSize:14, marginBottom:8 }}>
        Tu plan <EliteBadge size={12}/> está activo
      </p>
      <p style={{ color:C.white, fontSize:14, marginBottom:28, lineHeight:1.7 }}>
        A partir de ahora recibirás alertas de clientes que necesitan un <strong style={{ color:C.gold }}>{oficio||"profesional"}</strong> en tu zona. Solo acepta y trabaja.
      </p>

      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:28, textAlign:"left" }}>
        {[
          ["⭐","Perfil destacado activo","Apareces primero en búsquedas"],
          ["🔔","Alertas urgentes activas","Los trabajos llegan a tu móvil"],
          ["✅","Badge verificado","Los clientes confían más en ti"],
          ["💬","Chat ilimitado","Sin límites, sin comisiones"],
          ["🚫","0% de comisión","Tú cobras el 100% siempre"],
        ].map(([ic,t,d])=>(
          <div key={t} style={{ display:"flex", alignItems:"center", gap:14, padding:"12px 14px", background:C.surface, borderRadius:12, border:`1px solid ${C.border}` }}>
            <span style={{ fontSize:18 }}>{ic}</span>
            <div style={{ flex:1 }}>
              <div style={{ color:C.white, fontSize:13, fontWeight:700 }}>{t}</div>
              <div style={{ color:C.dim,   fontSize:11, marginTop:2 }}>{d}</div>
            </div>
            <span style={{ color:C.green, fontWeight:700 }}>✓</span>
          </div>
        ))}
      </div>

      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"20px", marginBottom:20, textAlign:"left" }}>
        <p style={{ color:C.gold, fontWeight:800, fontSize:14, marginBottom:16, textAlign:"center" }}>📲 Descarga la app y empieza a recibir clientes</p>
        <a href="https://play.google.com/store/apps/details?id=com.aficioya.twa" target="_blank" style={{ display:"flex", alignItems:"center", gap:12, background:"rgba(255,184,0,0.08)", border:`1px solid rgba(255,184,0,0.25)`, borderRadius:12, padding:"12px 16px", marginBottom:10, textDecoration:"none" }}>
          <span style={{ fontSize:24 }}>🤖</span>
          <div>
            <p style={{ color:C.white, fontWeight:700, fontSize:13, margin:0 }}>Descargar en Android</p>
            <p style={{ color:C.muted, fontSize:11, margin:0 }}>Google Play Store</p>
          </div>
          <span style={{ color:C.gold, marginLeft:"auto", fontSize:16 }}>→</span>
        </a>
        <div style={{ background:"rgba(255,255,255,0.03)", border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 16px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
            <span style={{ fontSize:24 }}>🍎</span>
            <div>
              <p style={{ color:C.white, fontWeight:700, fontSize:13, margin:0 }}>Instalar en iPhone</p>
              <p style={{ color:C.muted, fontSize:11, margin:0 }}>Sigue estos 3 pasos en Safari</p>
            </div>
          </div>
          {[
            ["⬆️","Pulsa el botón Compartir","El botón está en la barra inferior de Safari"],
            ["➕","Toca \"Añadir a inicio\"","Desplázate abajo en el menú compartir"],
            ["✅","Pulsa Añadir","La app aparecerá en tu pantalla de inicio"],
          ].map(([ic,t,d],i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderTop:i>0?`1px solid ${C.border}`:"none" }}>
              <span style={{ fontSize:18, width:28, textAlign:"center" as const }}>{ic}</span>
              <div>
                <p style={{ color:C.white, fontSize:12, fontWeight:700, margin:0 }}>{t}</p>
                <p style={{ color:C.muted, fontSize:11, margin:0 }}>{d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Btn onClick={() => window.location.href = "/"}>Ir a mi perfil →</Btn>
      <p style={{ color:C.dim, fontSize:11, marginTop:12 }}>
        Te avisaremos 3 días antes de que termine el periodo gratis
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   LANDING PRINCIPAL
═══════════════════════════════════════════════════════════════════ */
export default function EliteLanding() {
  const [step,  setStep]  = useState(0);
  const [datos, setDatos] = useState<any>(null);

  // 🎯 EVENTO: ViewContent + Scroll Depth — se ejecuta al montar la landing
  useEffect(() => {
    track("ViewContent", {
      content_name: "landing_elite",
      content_type: "landing_page",
    });

    // Scroll depth — saber hasta dónde llegan antes de rebotar
    const checkpoints = [25, 50, 75, 100];
    const fired = new Set<number>();
    const onScroll = () => {
      const total = document.body.scrollHeight - window.innerHeight;
      if (total <= 0) return;
      const pct = Math.round((window.scrollY / total) * 100);
      checkpoints.forEach(cp => {
        if (pct >= cp && !fired.has(cp)) {
          fired.add(cp);
          track("scroll_depth", { percent: cp, page: "landing_elite" });
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── PANTALLAS DE REGISTRO (steps 1-3) ── */
  if (step >= 1) {
    return (
      <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Inter', sans-serif", color:C.white }}>
        <FontLoader/><Orbs/>
        <div style={{ position:"relative", zIndex:1, maxWidth:460, margin:"0 auto", padding:"32px 20px 80px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:36 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:32, height:32, borderRadius:8, background:C.gold, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🔨</div>
              <span style={{ fontWeight:900, fontSize:18 }}>oficioya</span>
            </div>
            {step < 3 && <button onClick={()=>setStep(0)} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, color:C.muted, fontSize:12, padding:"6px 12px", cursor:"pointer" }}>Cancelar</button>}
          </div>
          <Stepper step={step-1}/>
          {step===1 && <StepDatos onNext={(d: any)=>{ setDatos(d); setStep(2); }}/>}
          {step===2 && <StepTarjeta datos={datos} onSuccess={()=>setStep(3)}/>}
          {step===3 && <StepExito nombre={datos?.nombre||"profesional"} oficio={datos?.oficio}/>}
        </div>
      </div>
    );
  }

  /* ── HERO ── */
  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Inter', sans-serif", color:C.white, overflowX:"hidden" }}>
      <FontLoader/><Orbs/>
      <div style={{ position:"relative", zIndex:1 }}>

        {/* TOPBAR */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 24px", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:34, height:34, borderRadius:8, background:C.gold, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🔨</div>
            <span style={{ fontWeight:900, fontSize:18 }}>oficioya</span>
            <span style={{ background:"#1a1a1a", border:`1px solid ${C.border}`, borderRadius:6, padding:"2px 8px", fontSize:10, color:C.muted, letterSpacing:1 }}>SEVILLA</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:C.green, boxShadow:`0 0 8px ${C.green}`, animation:"pulse2 2s infinite" }}/>
            <span style={{ color:C.muted, fontSize:11, letterSpacing:1.5 }}>NUEVO LANZAMIENTO</span>
          </div>
        </div>

        {/* HERO SECTION */}
        <div style={{ maxWidth:540, margin:"0 auto", padding:"52px 24px 44px", textAlign:"center" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:C.goldDim, border:`1px solid rgba(255,184,0,0.25)`, borderRadius:40, padding:"8px 18px", marginBottom:28, animation:"float 5s ease-in-out infinite" }}>
            <EliteBadge size={11}/>
            <span style={{ color:"#aaa", fontSize:11, letterSpacing:1 }}>1 MES GRATIS · SOLO LANZAMIENTO</span>
          </div>
          <h1 style={{ fontSize:"clamp(32px,8vw,54px)", fontWeight:900, lineHeight:1.1, margin:"0 0 10px", letterSpacing:-1, animation:"fadeUp 0.7s ease both" }}>
            Solo acepta.<br/>
            <span style={{ color:C.gold }}>Tú a trabajar.</span>
          </h1>
          <p style={{ color:C.muted, fontSize:17, lineHeight:1.75, margin:"0 auto 36px", maxWidth:400, animation:"fadeUp 0.7s ease both 0.1s" }}>
            Los clientes que necesitan un profesional como tú llegan solos a tu móvil. Sin buscar, sin esperar, sin perder tiempo.
          </p>
          <div style={{ animation:"fadeUp 0.7s ease both 0.2s", maxWidth:320, margin:"0 auto 14px" }}>
            {/* 🎯 EVENTO: InitiateCheckout — clic en CTA principal */}
            <Btn onClick={() => {
              track("InitiateCheckout", {
                content_name: "cta_hero",
                currency:     "EUR",
                value:        0,
              });
              setStep(1);
            }}>
              Activar mi mes Élite gratis →
            </Btn>
          </div>
          <p style={{ color:C.dim, fontSize:12 }}>Sin cargo hoy · Sin permanencia · Cancela cuando quieras</p>
        </div>

        {/* MOCK ALERTAS */}
        <div style={{ maxWidth:540, margin:"0 auto", padding:"0 24px 56px" }}>
          <GlowLabel mb={18}>ASÍ LLEGAN LOS TRABAJOS A TU MÓVIL</GlowLabel>
          <div style={{ textAlign:"center", marginBottom:22 }}>
            <div style={{ display:"inline-block", animation:"shake 2s ease-in-out infinite 1s", fontSize:28 }}>🔔</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <AlertCard emoji="💧" oficio="fontanero urgente" nombre="Cliente en Triana"   distancia="800m"  urgente={true}  delay="0.3"/>
            <AlertCard emoji="⚡" oficio="electricista"      nombre="Cliente en Nervión"  distancia="1.2km" urgente={false} delay="0.7"/>
            <AlertCard emoji="🔑" oficio="cerrajero 24h"     nombre="Cliente en Macarena" distancia="600m"  urgente={true}  delay="1.1"/>
          </div>
          <div style={{ textAlign:"center", marginTop:18 }}>
            <span style={{ background:"rgba(255,184,0,0.06)", border:"1px solid rgba(255,184,0,0.35)", borderRadius:40, padding:"10px 24px", display:"inline-block", fontSize:13, fontWeight:700, letterSpacing:1, boxShadow:"0 0 24px rgba(255,184,0,0.15)", backgroundImage:"linear-gradient(90deg, #888 0%, #FFB800 30%, #fff8e0 50%, #FFB800 70%, #888 100%)", backgroundSize:"250% auto", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text", animation:"shimmer 3.5s linear infinite" }}>
              ✦ Solo tú decides qué aceptar
            </span>
          </div>
        </div>

        {/* DIVIDER */}
        <div style={{ display:"flex", alignItems:"center", maxWidth:540, margin:"0 auto 56px", padding:"0 24px" }}>
          <div style={{ flex:1, height:1, background:`linear-gradient(to right,transparent,${C.border})` }}/>
          <span style={{ color:C.border, margin:"0 14px", fontSize:16 }}>✦</span>
          <div style={{ flex:1, height:1, background:`linear-gradient(to left,transparent,${C.border})` }}/>
        </div>

        {/* PAIN POINTS */}
        <div style={{ maxWidth:540, margin:"0 auto", padding:"0 24px 56px" }}>
          <GlowLabel mb={8}>¿TE SUENA ESTO?</GlowLabel>
          <p style={{ color:C.white, fontSize:22, fontWeight:800, textAlign:"center", marginBottom:32, lineHeight:1.3 }}>
            Lo que te frena hoy<br/><span style={{ color:C.gold }}>lo resolvemos nosotros.</span>
          </p>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {[
              { emoji:"🔧", oficio:"Fontanero / Electricista / Cerrajero", pain:"Cuando me avisan, el trabajo ya está cogido. Siempre llego tarde.", fix:"Las alertas urgentes del plan Élite te avisan antes que a nadie. Primero en ver, primero en ganar." },
              { emoji:"🎨", oficio:"Pintor / Albañil / Carpintero", pain:"Paso días haciendo presupuestos que no cierran. Tiempo perdido.", fix:"Los clientes de oficioya ya saben lo que quieren y piden presupuesto directo a ti. Sin reuniones innecesarias." },
              { emoji:"❄️", oficio:"Instalador A/C / Técnico", pain:"El boca a boca ya no es suficiente. Los meses flojos me matan.", fix:"Tu perfil Élite trabaja por ti 24/7. Cuando no estás buscando, oficioya busca por ti." },
              { emoji:"🏗️", oficio:"Techador / Cristalero / Soldador", pain:"Compito por precio con cualquiera y acabo cobrando menos de lo que vale mi trabajo.", fix:"Un badge verificado y reseñas reales te convierten en la opción premium. Los clientes pagan más por confianza." },
              { emoji:"🏠", oficio:"Cualquier profesional", pain:"Termino la semana sin saber si el mes siguiente tendré trabajo.", fix:"Agenda llena = menos estrés. oficioya te da visibilidad constante sin que tengas que hacer nada." },
            ].map((p,i)=>(
              <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`, borderLeft:`3px solid ${C.gold}`, borderRadius:16, padding:"20px 18px", animation:`fadeUp 0.6s ease both ${i*0.08}s` }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                  <span style={{ fontSize:22 }}>{p.emoji}</span>
                  <span style={{ color:C.muted, fontSize:11, letterSpacing:1 }}>{p.oficio.toUpperCase()}</span>
                </div>
                <p style={{ color:"#666", fontSize:14, lineHeight:1.7, fontStyle:"italic", margin:"0 0 12px", paddingLeft:4, borderLeft:`2px solid #2a2a2a` }}>"{p.pain}"</p>
                <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                  <span style={{ color:C.gold, fontSize:14, flexShrink:0, marginTop:1 }}>→</span>
                  <p style={{ color:"#bbb", fontSize:14, lineHeight:1.7, margin:0 }}>{p.fix}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CÓMO FUNCIONA */}
        <div style={{ background:C.surface, borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`, padding:"48px 24px" }}>
          <div style={{ maxWidth:540, margin:"0 auto" }}>
            <GlowLabel mb={8}>ASÍ DE FÁCIL</GlowLabel>
            <p style={{ color:C.white, fontSize:20, fontWeight:800, textAlign:"center", marginBottom:32 }}>Regístrate y empieza a trabajar</p>
            <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
              {[
                { n:"01", title:"Te registras gratis",        desc:"En menos de 2 minutos. Completas tu perfil y activas el mes Élite." },
                { n:"02", title:"Los clientes te encuentran", desc:"Tu perfil aparece el primero en búsquedas de tu zona. Sin hacer nada." },
                { n:"03", title:"Recibes alertas urgentes",   desc:"Cuando alguien necesita tu oficio, te llega una notificación. Aceptas o rechazas tú." },
                { n:"04", title:"Solo trabajas y cobras",     desc:"Sin comisiones, sin intermediarios. El 100% del trabajo es tuyo." },
              ].map((s,i,arr)=>(
                <div key={s.n} style={{ display:"flex", gap:20, paddingBottom: i<arr.length-1 ? 24 : 0 }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
                    <div style={{ width:40, height:40, borderRadius:"50%", background:C.goldDim, border:`1.5px solid rgba(255,184,0,0.3)`, display:"flex", alignItems:"center", justifyContent:"center", color:C.gold, fontWeight:900, fontSize:13, flexShrink:0 }}>{s.n}</div>
                    {i<arr.length-1 && <div style={{ width:1, flex:1, marginTop:4, background:`linear-gradient(to bottom,rgba(255,184,0,0.2),transparent)` }}/>}
                  </div>
                  <div style={{ paddingBottom: i<arr.length-1 ? 20 : 0 }}>
                    <div style={{ color:C.white, fontWeight:700, fontSize:15, marginBottom:4 }}>{s.title}</div>
                    <div style={{ color:C.muted, fontSize:13, lineHeight:1.6 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MOCK PERFIL */}
        <div style={{ maxWidth:540, margin:"0 auto", padding:"48px 24px" }}>
          <GlowLabel mb={8}>ASÍ SE VE TU PERFIL</GlowLabel>
          <p style={{ color:C.white, fontSize:18, fontWeight:800, textAlign:"center", marginBottom:24 }}>
            Así te ven los clientes con <EliteBadge/>
          </p>
          <MockPerfil nombre="Tu nombre" oficio="Tu oficio" emoji="⚡" precio="35" rating="4.9" trabajos="0 de momento" ini="TN"/>
          <p style={{ color:"#888", fontSize:12, textAlign:"center", marginTop:14 }}>
            Con el badge Élite apareces antes que cualquier perfil sin verificar
          </p>
        </div>

        {/* PLAN */}
        <div style={{ maxWidth:540, margin:"0 auto", padding:"0 24px 56px" }}>
          <div style={{ background:C.card, border:`1.5px solid rgba(255,184,0,0.3)`, borderRadius:20, padding:"28px 24px", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:"-60px", right:"-60px", width:180, height:180, borderRadius:"50%", background:"radial-gradient(circle,rgba(255,184,0,0.08) 0%,transparent 70%)", pointerEvents:"none" }}/>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
              <div>
                <EliteBadge size={14}/>
                <div style={{ color:C.muted, fontSize:12, marginTop:6 }}>Primer mes · Sin compromiso</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ color:C.dim, fontSize:13, textDecoration:"line-through" }}>49,99€/mes</div>
                <div style={{ color:C.green, fontSize:28, fontWeight:900, lineHeight:1 }}>GRATIS</div>
                <div style={{ color:C.dim, fontSize:11 }}>30 días</div>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 }}>
              {[
                ["⭐","Perfil destacado","Primero en búsquedas de tu zona"],
                ["🔔","Alertas prioritarias","Recibe trabajos antes que nadie"],
                ["✅","Badge verificado","Los clientes confían más en ti"],
                ["📊","Estadísticas","Ve cuántos clientes te han visto"],
                ["💬","Chat ilimitado","Sin límite de conversaciones"],
                ["🚫","Sin comisiones","Tú cobras el 100% siempre"],
              ].map(([ic,t,d])=>(
                <div key={t} style={{ display:"flex", alignItems:"center", gap:14, padding:"10px 12px", borderRadius:10, background:"rgba(255,184,0,0.03)", border:"1px solid rgba(255,184,0,0.08)" }}>
                  <span style={{ fontSize:18, width:22 }}>{ic}</span>
                  <div style={{ flex:1 }}>
                    <span style={{ color:"#f0f0f0", fontSize:13, fontWeight:700 }}>{t}</span>
                    <span style={{ color:"#aaaaaa", fontSize:12 }}> — {d}</span>
                  </div>
                  <span style={{ color:C.gold, fontSize:13, fontWeight:800 }}>✓</span>
                </div>
              ))}
            </div>
            {/* 🎯 EVENTO: InitiateCheckout — CTA del plan */}
            <Btn onClick={() => {
              track("InitiateCheckout", {
                content_name: "cta_plan",
                currency:     "EUR",
                value:        0,
              });
              setStep(1);
            }}>
              Activar 1 mes Élite gratis →
            </Btn>
            <p style={{ color:C.dim, fontSize:11, textAlign:"center", marginTop:10 }}>
              🔒 Pago seguro con Stripe · Cancela cuando quieras
            </p>
          </div>
        </div>

        {/* TESTIMONIOS */}
        <div style={{ background:C.surface, borderTop:`1px solid ${C.border}`, padding:"48px 24px" }}>
          <div style={{ maxWidth:540, margin:"0 auto" }}>
            <GlowLabel mb={32}>LO QUE DICEN NUESTROS PROFESIONALES</GlowLabel>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {[
                { ini:"C", name:"Carlos R.", job:"Electricista · Nervión",    text:"Antes pasaba horas en grupos de WhatsApp. Ahora me llegan las alertas y solo acepto lo que me interesa. Esta semana ya tengo 3 trabajos." },
                { ini:"M", name:"María T.",  job:"Pintora · Triana",          text:"El badge verificado hace que los clientes me llamen a mí primero. Cobro más que antes y trabajo menos horas buscando." },
                { ini:"P", name:"Paco L.",   job:"Fontanero · Los Remedios",  text:"En el primer mes sin pagar ya recuperé el tiempo que perdía buscando clientes. Ahora la agenda se llena sola." },
              ].map(t=>(
                <div key={t.name} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:"18px 16px", display:"flex", gap:14 }}>
                  <div style={{ width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg,#1e2a3a,#0f1a2a)", border:`1.5px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", color:C.gold, fontWeight:800, fontSize:15, flexShrink:0 }}>{t.ini}</div>
                  <div>
                    <span style={{ color:C.gold, fontSize:12 }}>★★★★★</span>
                    <p style={{ color:"#aaa", fontSize:13, lineHeight:1.7, margin:"8px 0 8px", fontStyle:"italic" }}>"{t.text}"</p>
                    <span style={{ color:C.muted, fontSize:11 }}>{t.name} · {t.job}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA FINAL */}
        <div style={{ maxWidth:540, margin:"0 auto", padding:"52px 24px 80px", textAlign:"center" }}>
          <p style={{ color:C.white, fontSize:24, fontWeight:900, margin:"0 0 8px", lineHeight:1.3 }}>
            Esta semana podrías tener<br/><span style={{ color:C.gold }}>tu primera alerta.</span>
          </p>
          <p style={{ color:C.muted, fontSize:14, margin:"0 0 28px", lineHeight:1.7 }}>
            Regístrate gratis. Completa tu perfil. Espera la primera notificación.<br/>Así de simple.
          </p>
          {/* 🎯 EVENTO: InitiateCheckout — CTA final */}
          <Btn onClick={() => {
            track("InitiateCheckout", {
              content_name: "cta_final",
              currency:     "EUR",
              value:        0,
            });
            setStep(1);
          }}>
            Quiero mi mes Élite gratis →
          </Btn>
          <p style={{ color:C.dim, fontSize:11, marginTop:12 }}>
            🔒 Pago seguro con Stripe · Sin permanencia · Cancela cuando quieras
          </p>
        </div>

      </div>
    </div>
  );
}
