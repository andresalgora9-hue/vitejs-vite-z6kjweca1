import { useState, useEffect, useRef } from "react";

// ─── GOOGLE SHEETS WEBHOOK ───
const SHEET_ID = "1Z9MeS2pxIaDxJJNsstrYdnwhP0sEfvr_AIQF_B4g5Vc";
async function sendToSheet(data: Record<string, string>) {
  try {
    // Uses a public Google Apps Script Web App (deploy separately)
    // For now stores in localStorage as backup
    const existing = JSON.parse(localStorage.getItem("oy_registros") || "[]");
    existing.push({ ...data, timestamp: new Date().toISOString() });
    localStorage.setItem("oy_registros", JSON.stringify(existing));
    console.log("Registro guardado:", data, "Sheet:", SHEET_ID);
  } catch (e) {
    console.error("Error guardando registro", e);
  }
}

// ─── TYPES ───
type Plan = "gratis" | "basico" | "pro" | "elite";
type UserType = "cliente" | "profesional";
interface User {
  id: string; name: string; email: string; phone: string;
  type: UserType; plan: Plan; trade?: string; zone?: string;
  bio?: string; price?: number; joinedAt: string; trialEnd: string;
  verified: boolean; jobs: number; rating: number; reviews: number;
  available: boolean;
}
interface Review { user: string; stars: number; text: string; date: string; }
interface Message { from: string; text: string; time: string; }
interface Conversation { workerId: string; messages: Message[]; }

// ─── CONSTANTS ───
const ZONAS = ["Sevilla","Madrid","Barcelona","Valencia","Málaga","Bilbao","Zaragoza","Alicante","Granada","Cádiz","Córdoba","Huelva"];
const OFICIOS = ["Electricista","Fontanero","Pintor","Albañil","Carpintero","Cerrajero","Jardinero","Soldador","Climatización","Reformas Integrales","Instalador Solar","Yesero"];
const OFICIO_ICONS: Record<string, string> = {
  "Electricista":"⚡","Fontanero":"🔧","Pintor":"🖌️","Albañil":"🧱","Carpintero":"🪵",
  "Cerrajero":"🔑","Jardinero":"🌿","Soldador":"🔥","Climatización":"❄️",
  "Reformas Integrales":"🏗️","Instalador Solar":"☀️","Yesero":"🏛️"
};
const PLAN_FEATURES: Record<Plan, string[]> = {
  gratis: ["Perfil básico visible","5 contactos/mes","Sin badge verificado","Aparece en búsquedas"],
  basico: ["Perfil completo","20 contactos/mes","Badge verificado ✓","Estadísticas básicas","Chat directo","Galería 5 fotos"],
  pro: ["Perfil destacado","Contactos ilimitados","Badge PRO ✓✓","Estadísticas completas","Chat + llamada","Galería ilimitada","Primero en búsquedas","Panel de reseñas","Ranking público"],
  elite: ["Todo lo de Pro","Badge ÉLITE ⭐","Anuncios en portada","Top garantizado #1","Gestor reseñas avanzado","Facturación integrada","Soporte telefónico 24h","Estadísticas avanzadas","API de integración"],
};
const PLAN_PRICES: Record<Plan, number> = { gratis:0, basico:9.99, pro:24.99, elite:49.99 };
const PLAN_COLORS: Record<Plan, string> = { gratis:"#7777AA", basico:"#4B9EFF", pro:"#FFD700", elite:"#FF9640" };

// ─── DEMO DATA ───
const DEMO_WORKERS: User[] = [
  { id:"w1",name:"Marcos Herrera",email:"marcos@demo.com",phone:"654321001",type:"profesional",plan:"pro",trade:"Electricista",zone:"Sevilla",bio:"12 años instalando el futuro. Domótica, fotovoltaica y cuadros eléctricos.",price:35,joinedAt:"2024-01-01",trialEnd:"2024-02-01",verified:true,jobs:312,rating:4.9,reviews:127,available:true },
  { id:"w2",name:"Lucía Fernández",email:"lucia@demo.com",phone:"654321002",type:"profesional",plan:"elite",trade:"Fontanero",zone:"Sevilla",bio:"Tuberías, calderas y calefacción. Urgencias 24h garantizadas.",price:30,joinedAt:"2024-01-15",trialEnd:"2024-02-15",verified:true,jobs:201,rating:4.8,reviews:89,available:true },
  { id:"w3",name:"Roberto Sanz",email:"roberto@demo.com",phone:"654321003",type:"profesional",plan:"basico",trade:"Pintor",zone:"Sevilla",bio:"Pintura interior y exterior. Microcemento y acabados decorativos.",price:22,joinedAt:"2024-02-01",trialEnd:"2024-03-01",verified:true,jobs:145,rating:4.7,reviews:63,available:false },
  { id:"w4",name:"Ana García",email:"ana@demo.com",phone:"654321004",type:"profesional",plan:"pro",trade:"Albañil",zone:"Sevilla",bio:"Reformas integrales y revestimientos cerámicos. 15 años en obra.",price:28,joinedAt:"2024-02-10",trialEnd:"2024-03-10",verified:true,jobs:98,rating:5.0,reviews:41,available:true },
  { id:"w5",name:"Javier Moreno",email:"javier@demo.com",phone:"654321005",type:"profesional",plan:"gratis",trade:"Carpintero",zone:"Sevilla",bio:"Muebles a medida, puertas y tarimas. Madera maciza y sostenible.",price:32,joinedAt:"2024-03-01",trialEnd:"2024-04-01",verified:false,jobs:134,rating:4.6,reviews:55,available:true },
  { id:"w6",name:"Elena Ruiz",email:"elena@demo.com",phone:"654321006",type:"profesional",plan:"elite",trade:"Cerrajero",zone:"Sevilla",bio:"Apertura de emergencia 24h. Cajas fuertes y cerraduras de seguridad.",price:40,joinedAt:"2024-01-20",trialEnd:"2024-02-20",verified:true,jobs:267,rating:4.9,reviews:78,available:true },
];
const DEMO_REVIEWS: Record<string, Review[]> = {
  w1:[{user:"Carmen R.",stars:5,text:"Llegó en 20 min, solucionó todo. 10/10",date:"hace 2 días"},{user:"Alberto M.",stars:5,text:"Profesional total. Precio justo.",date:"hace 1 semana"}],
  w2:[{user:"Jordi S.",stars:5,text:"Vino un domingo a las 10pm. Increíble.",date:"hace 3 días"},{user:"Maria T.",stars:5,text:"La mejor fontanera que he tenido.",date:"hace 5 días"}],
  w3:[{user:"Ana V.",stars:5,text:"El piso quedó como nuevo.",date:"hace 1 semana"}],
  w4:[{user:"Miguel F.",stars:5,text:"5 estrellas se quedan cortas.",date:"hace 4 días"},{user:"Rosario B.",stars:5,text:"Reformó mi baño en tiempo récord.",date:"hace 1 semana"}],
  w5:[{user:"Laura C.",stars:5,text:"Me hizo una cocina que es una obra de arte.",date:"hace 3 días"}],
  w6:[{user:"Tomás A.",stars:5,text:"Me abrió la puerta a las 3am. Un ángel.",date:"hace 1 semana"}],
};

// ─── COLORS ───
const C = {
  bg:"#080810", surface:"#0D0D1A", card:"#111120", cardHover:"#161628",
  border:"#1E1E38", accent:"#FFD700", accentOrange:"#FFA500",
  red:"#FF3B3B", green:"#00E87A", blue:"#4B9EFF", purple:"#9B5FFF",
  text:"#EEEEFF", muted:"#44445A", mutedLight:"#7777AA",
};
const workerColor = (id: string) => [C.purple,C.blue,"#FF6B9D","#00D4AA","#FF9640","#FF3B6E"][parseInt(id.replace("w",""))%6];

// ─── UTILS ───
function trialDaysLeft(trialEnd: string): number {
  const end = new Date(trialEnd);
  const now = new Date();
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000*60*60*24));
  return Math.max(0, diff);
}
function generateId(): string { return Math.random().toString(36).substr(2,9); }
function generateTrialEnd(): string {
  const d = new Date(); d.setDate(d.getDate()+30);
  return d.toISOString().split("T")[0];
}

// ─── STORAGE ───
function saveUser(user: User) { localStorage.setItem("oy_user", JSON.stringify(user)); }
function loadUser(): User|null {
  try { const u = localStorage.getItem("oy_user"); return u ? JSON.parse(u) : null; } catch { return null; }
}
function saveConvos(convos: Conversation[]) { localStorage.setItem("oy_convos", JSON.stringify(convos)); }
function loadConvos(): Conversation[] {
  try { const c = localStorage.getItem("oy_convos"); return c ? JSON.parse(c) : []; } catch { return []; }
}
function saveWorkers(workers: User[]) { localStorage.setItem("oy_workers", JSON.stringify(workers)); }
function loadWorkers(): User[] {
  try { const w = localStorage.getItem("oy_workers"); return w ? JSON.parse(w) : DEMO_WORKERS; }
  catch { return DEMO_WORKERS; }
}

// ─── UI COMPONENTS ───
function Stars({ n, size=13 }: { n:number; size?:number }) {
  return <span style={{fontSize:size,color:C.accent,letterSpacing:1,lineHeight:1}}>{"★".repeat(Math.round(n))}{"☆".repeat(5-Math.round(n))}</span>;
}
function Ava({ s, size=44, color=C.purple, glow=false }: { s:string; size?:number; color?:string; glow?:boolean }) {
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:"linear-gradient(135deg,"+color+"44,"+color+"22)",display:"flex",alignItems:"center",justifyContent:"center",color:C.accent,fontWeight:900,fontSize:Math.round(size*0.36),fontFamily:"'Bebas Neue',sans-serif",border:"2px solid "+color+"66",boxShadow:glow?"0 0 20px "+color+"55":"0 0 10px "+color+"22",flexShrink:0}}>
      {s}
    </div>
  );
}
function PlanBadge({ plan }: { plan:Plan }) {
  const labels: Record<Plan,string> = {gratis:"DEMO",basico:"BÁSICO",pro:"PRO",elite:"ÉLITE"};
  const col = PLAN_COLORS[plan];
  return <span style={{padding:"2px 8px",borderRadius:4,fontSize:9,fontWeight:900,letterSpacing:"0.1em",color:col,background:col+"22",border:"1px solid "+col+"44"}}>{labels[plan]}</span>;
}
function Btn({ children, onClick, color=C.accent, outline=false, full=false, small=false, disabled=false }: any) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width:full?"100%":"auto", padding:small?"8px 16px":"12px 24px",
      background:outline?"transparent":"linear-gradient(135deg,"+color+","+color+"CC)",
      border:"1px solid "+color+(outline?"88":""),
      borderRadius:10, color:outline?color:"#000", fontFamily:"'Bebas Neue',sans-serif",
      fontSize:small?14:16, letterSpacing:"0.05em", cursor:disabled?"not-allowed":"pointer",
      opacity:disabled?0.5:1, transition:"all 0.15s",
      boxShadow:outline?"none":"0 4px 16px "+color+"44",
    }}>{children}</button>
  );
}
function Input({ label, value, onChange, type="text", placeholder="" }: any) {
  return (
    <div style={{marginBottom:14}}>
      {label && <p style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5,fontWeight:700}}>{label}</p>}
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{width:"100%",background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"11px 14px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none"}} />
    </div>
  );
}
function Select({ label, value, onChange, options }: { label:string; value:string; onChange:(v:string)=>void; options:string[] }) {
  return (
    <div style={{marginBottom:14}}>
      <p style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5,fontWeight:700}}>{label}</p>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"11px 14px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none",cursor:"pointer"}}>
        {options.map(o=><option key={o} style={{background:C.card}}>{o}</option>)}
      </select>
    </div>
  );
}
function Card({ children, style={}, onClick, glow="" }: any) {
  const [hov,setHov]=useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={onClick}
      style={{background:hov&&onClick?C.cardHover:C.card,borderRadius:14,border:"1px solid "+(hov&&glow?glow+"66":C.border),padding:20,transition:"all 0.2s",cursor:onClick?"pointer":"default",boxShadow:hov&&glow?"0 8px 32px "+glow+"22, inset 0 1px 0 "+glow+"15":"0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)",...style}}>
      {children}
    </div>
  );
}
function Toast({ msg }: { msg:string|null }) {
  if(!msg) return null;
  return <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:"linear-gradient(135deg,"+C.accent+","+C.accentOrange+")",color:"#000",borderRadius:10,padding:"10px 20px",fontWeight:700,fontSize:13,zIndex:9999,whiteSpace:"nowrap",boxShadow:"0 4px 20px "+C.accent+"66",pointerEvents:"none"}}>{msg}</div>;
}
function Modal({ children, onClose }: { children:React.ReactNode; onClose:()=>void }) {
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(4,4,12,0.92)",backdropFilter:"blur(20px)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px 16px",overflowY:"auto"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(160deg,#0F0F20,#080812)",borderRadius:20,maxWidth:520,width:"100%",maxHeight:"90vh",overflowY:"auto",border:"1px solid "+C.accent+"44",boxShadow:"0 0 60px "+C.accent+"22,0 40px 80px rgba(0,0,0,0.6)"}}>
        {children}
      </div>
    </div>
  );
}

// ─── AUTH SCREENS ───
function LoginScreen({ onLogin, onGoRegister }: { onLogin:(u:User)=>void; onGoRegister:()=>void }) {
  const [email,setEmail]=useState(""); const [pass,setPass]=useState(""); const [err,setErr]=useState("");
  const submit = () => {
    const users: User[] = JSON.parse(localStorage.getItem("oy_users")||"[]");
    const found = users.find(u=>u.email.toLowerCase()===email.toLowerCase());
    if(!found){ setErr("No existe una cuenta con ese email."); return; }
    onLogin(found); saveUser(found);
  };
  const demoLogin = (type: UserType) => {
    const demo: User = type==="profesional"
      ? { id:"demo-pro",name:"Tú (Demo Pro)",email:"demo@pro.com",phone:"666000000",type:"profesional",plan:"pro",trade:"Electricista",zone:"Sevilla",bio:"Profesional demo con acceso completo.",price:35,joinedAt:new Date().toISOString().split("T")[0],trialEnd:generateTrialEnd(),verified:true,jobs:12,rating:4.8,reviews:5,available:true }
      : { id:"demo-cli",name:"Tú (Demo Cliente)",email:"demo@cliente.com",phone:"666000001",type:"cliente",plan:"gratis",joinedAt:new Date().toISOString().split("T")[0],trialEnd:generateTrialEnd(),verified:false,jobs:0,rating:0,reviews:0,available:true };
    saveUser(demo); onLogin(demo);
  };
  return (
    <div style={{minHeight:"100dvh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px",backgroundImage:"radial-gradient(ellipse at 30% 0%,#2a0a5a44,transparent 60%),radial-gradient(ellipse at 80% 100%,#0a1a4a44,transparent 60%)"}}>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:40,marginBottom:8,animation:"float 3s ease-in-out infinite"}}>🔨</div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:36,background:"linear-gradient(135deg,"+C.text+",#AAAACC)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>OFICIO<span style={{background:"linear-gradient(135deg,"+C.accent+","+C.accentOrange+")",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>YA</span></div>
          <p style={{fontSize:13,color:C.muted,marginTop:6}}>Profesionales de confianza en tu zona</p>
        </div>
        <Card>
          <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:C.text,marginBottom:20,letterSpacing:"0.05em"}}>INICIAR SESIÓN</p>
          {err && <p style={{color:C.red,fontSize:13,marginBottom:12,padding:"8px 12px",background:C.red+"15",borderRadius:8,border:"1px solid "+C.red+"30"}}>{err}</p>}
          <Input label="Email" value={email} onChange={setEmail} type="email" placeholder="tu@email.com" />
          <Input label="Contraseña" value={pass} onChange={setPass} type="password" placeholder="••••••••" />
          <Btn full onClick={submit}>ENTRAR →</Btn>
          <div style={{textAlign:"center",marginTop:16}}>
            <span style={{fontSize:13,color:C.muted}}>¿No tienes cuenta? </span>
            <button onClick={onGoRegister} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:13,fontWeight:700}}>Regístrate gratis</button>
          </div>
        </Card>
        <div style={{marginTop:20}}>
          <p style={{textAlign:"center",fontSize:11,color:C.muted,marginBottom:12,textTransform:"uppercase",letterSpacing:"0.08em"}}>— Acceso demo rápido —</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Btn outline onClick={()=>demoLogin("cliente")} color={C.blue} small>👤 Demo Cliente</Btn>
            <Btn outline onClick={()=>demoLogin("profesional")} color={C.accent} small>🔨 Demo Pro</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegisterScreen({ onRegister, onGoLogin }: { onRegister:(u:User)=>void; onGoLogin:()=>void }) {
  const [step,setStep]=useState(1);
  const [type,setType]=useState<UserType>("cliente");
  const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [phone,setPhone]=useState("");
  const [pass,setPass]=useState(""); const [trade,setTrade]=useState(OFICIOS[0]); const [zone,setZone]=useState(ZONAS[0]);
  const [plan,setPlan]=useState<Plan>("gratis"); const [err,setErr]=useState("");

  const submit = async () => {
    if(!name||!email||!phone||!pass){ setErr("Rellena todos los campos."); return; }
    const existing: User[] = JSON.parse(localStorage.getItem("oy_users")||"[]");
    if(existing.find(u=>u.email.toLowerCase()===email.toLowerCase())){ setErr("Ya existe una cuenta con ese email."); return; }
    const newUser: User = {
      id:generateId(), name, email, phone, type, plan,
      trade:type==="profesional"?trade:undefined,
      zone:type==="profesional"?zone:undefined,
      bio:"", price:type==="profesional"?30:undefined,
      joinedAt:new Date().toISOString().split("T")[0],
      trialEnd:generateTrialEnd(),
      verified:false, jobs:0, rating:0, reviews:0, available:true,
    };
    existing.push(newUser);
    localStorage.setItem("oy_users",JSON.stringify(existing));
    await sendToSheet({ name, email, phone, type, plan, trade:trade||"", zone:zone||"", joinedAt:newUser.joinedAt });
    saveUser(newUser); onRegister(newUser);
  };

  return (
    <div style={{minHeight:"100dvh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px",backgroundImage:"radial-gradient(ellipse at 70% 0%,#0a2a5a44,transparent 60%)"}}>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,color:C.text}}>OFICIO<span style={{color:C.accent}}>YA</span></div>
          <p style={{fontSize:13,color:C.muted}}>Crea tu cuenta gratis · 30 días de prueba</p>
        </div>

        {/* Step indicator */}
        <div style={{display:"flex",gap:6,marginBottom:24,justifyContent:"center"}}>
          {[1,2,3].map(s=>(
            <div key={s} style={{width:s===step?32:8,height:8,borderRadius:99,background:s===step?C.accent:s<step?C.green:C.border,transition:"all 0.3s"}} />
          ))}
        </div>

        <Card>
          {err && <p style={{color:C.red,fontSize:13,marginBottom:12,padding:"8px 12px",background:C.red+"15",borderRadius:8,border:"1px solid "+C.red+"30"}}>{err}</p>}

          {step===1 && (
            <>
              <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:C.text,marginBottom:16,letterSpacing:"0.05em"}}>¿ERES CLIENTE O PROFESIONAL?</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
                {(["cliente","profesional"] as UserType[]).map(t=>(
                  <div key={t} onClick={()=>setType(t)} style={{padding:"20px 12px",borderRadius:12,border:"2px solid "+(type===t?C.accent:C.border),background:type===t?C.accent+"15":C.surface,cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}>
                    <div style={{fontSize:28,marginBottom:8}}>{t==="cliente"?"🏠":"🔨"}</div>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:type===t?C.accent:C.text,letterSpacing:"0.05em"}}>{t.toUpperCase()}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:4}}>{t==="cliente"?"Busco profesionales":"Ofrezco mis servicios"}</div>
                  </div>
                ))}
              </div>
              <Btn full onClick={()=>setStep(2)}>SIGUIENTE →</Btn>
            </>
          )}

          {step===2 && (
            <>
              <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:C.text,marginBottom:16,letterSpacing:"0.05em"}}>TUS DATOS</p>
              <Input label="Nombre completo" value={name} onChange={setName} placeholder="Tu nombre" />
              <Input label="Email" value={email} onChange={setEmail} type="email" placeholder="tu@email.com" />
              <Input label="Teléfono" value={phone} onChange={setPhone} placeholder="+34 600 000 000" />
              <Input label="Contraseña" value={pass} onChange={setPass} type="password" placeholder="Mínimo 6 caracteres" />
              {type==="profesional" && (
                <>
                  <Select label="Oficio" value={trade} onChange={setTrade} options={OFICIOS} />
                  <Select label="Ciudad" value={zone} onChange={setZone} options={ZONAS} />
                </>
              )}
              <div style={{display:"flex",gap:10}}>
                <Btn outline onClick={()=>setStep(1)} color={C.muted} small>← Atrás</Btn>
                <div style={{flex:1}}><Btn full onClick={()=>{if(!name||!email||!phone||!pass){setErr("Rellena todos los campos.");return;}setErr("");setStep(type==="profesional"?3:3);}}>SIGUIENTE →</Btn></div>
              </div>
            </>
          )}

          {step===3 && (
            <>
              <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:C.text,marginBottom:6,letterSpacing:"0.05em"}}>ELIGE TU PLAN</p>
              <p style={{fontSize:12,color:C.muted,marginBottom:16}}>30 días gratis · Sin tarjeta · Cancela cuando quieras</p>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
                {(type==="profesional"?["gratis","basico","pro","elite"]:["gratis"]) .map(p=>{
                  const pl=p as Plan; const col=PLAN_COLORS[pl];
                  return (
                    <div key={pl} onClick={()=>setPlan(pl)} style={{padding:"14px 16px",borderRadius:10,border:"2px solid "+(plan===pl?col:C.border),background:plan===pl?col+"15":C.surface,cursor:"pointer",transition:"all 0.15s",position:"relative"}}>
                      {pl==="pro" && <span style={{position:"absolute",top:-10,right:12,background:"linear-gradient(135deg,"+C.accent+","+C.accentOrange+")",color:"#000",borderRadius:99,padding:"2px 10px",fontSize:9,fontWeight:900,letterSpacing:"0.08em"}}>MÁS POPULAR</span>}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:col,letterSpacing:"0.08em"}}>{pl.toUpperCase()}</span>
                        <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:C.text}}>{PLAN_PRICES[pl]===0?"GRATIS":PLAN_PRICES[pl]+"€/mes"}</span>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                        {PLAN_FEATURES[pl].slice(0,3).map(f=>(
                          <span key={f} style={{fontSize:10,color:C.mutedLight}}>✓ {f}</span>
                        ))}
                        {PLAN_FEATURES[pl].length>3 && <span style={{fontSize:10,color:col}}>+{PLAN_FEATURES[pl].length-3} más</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {type==="cliente" && <p style={{fontSize:11,color:C.muted,marginBottom:16,textAlign:"center"}}>Los clientes acceden gratis a todos los profesionales.</p>}
              <div style={{display:"flex",gap:10}}>
                <Btn outline onClick={()=>setStep(2)} color={C.muted} small>← Atrás</Btn>
                <div style={{flex:1}}><Btn full onClick={submit}>CREAR CUENTA →</Btn></div>
              </div>
            </>
          )}
        </Card>

        <div style={{textAlign:"center",marginTop:16}}>
          <span style={{fontSize:13,color:C.muted}}>¿Ya tienes cuenta? </span>
          <button onClick={onGoLogin} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:13,fontWeight:700}}>Iniciar sesión</button>
        </div>
      </div>
    </div>
  );
}

// ─── WORKER DETAIL MODAL ───
function WorkerModal({ worker, onClose, onChat, currentUser }: { worker:User; onClose:()=>void; onChat:(w:User)=>void; currentUser:User|null }) {
  const [tab,setTab]=useState<"info"|"reviews"|"fotos">("info");
  const [extraRevs,setExtraRevs]=useState<Review[]>([]);
  const [newRev,setNewRev]=useState(""); const [selStars,setSelStars]=useState(5); const [emoji,setEmoji]=useState("");
  const color = workerColor(worker.id);
  const allRevs = [...(extraRevs), ...(DEMO_REVIEWS[worker.id]||[])];

  const submitReview = () => {
    if(!newRev.trim()) return;
    setExtraRevs(p=>[{user:currentUser?.name||"Usuario",stars:selStars,text:newRev,date:"ahora mismo"},...p]);
    setNewRev(""); setEmoji("");
  };

  return (
    <Modal onClose={onClose}>
      <div style={{padding:"20px 20px 0"}}>
        <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:16}}>
          <Ava s={worker.name.substring(0,2).toUpperCase()} size={64} color={color} glow />
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:4}}>
              <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:C.text}}>{worker.name}</p>
              {worker.verified && <span style={{fontSize:11,color:C.green}}>✓ Verificado</span>}
              <PlanBadge plan={worker.plan} />
            </div>
            <p style={{color,fontWeight:700,fontSize:13,marginBottom:4}}>{OFICIO_ICONS[worker.trade||""]||"🔧"} {worker.trade} · {worker.zone}</p>
            <div style={{display:"flex",gap:6,alignItems:"center"}}><Stars n={worker.rating} /><span style={{fontSize:12,color:C.text,fontWeight:700}}>{worker.rating}</span><span style={{fontSize:11,color:C.muted}}>({worker.reviews})</span></div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"1px solid "+C.border,borderRadius:8,color:C.muted,cursor:"pointer",padding:"6px 10px",fontSize:16,flexShrink:0}}>✕</button>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:20}}>
          {(["info","reviews","fotos"] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"8px",borderRadius:8,border:"1px solid "+(tab===t?color:C.border),background:tab===t?color+"22":"transparent",color:tab===t?color:C.muted,fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.08em",transition:"all 0.15s"}}>
              {t==="info"?"Info":t==="reviews"?("Reseñas ("+allRevs.length+")"):"Fotos"}
            </button>
          ))}
        </div>
      </div>
      <div style={{padding:"0 20px 20px"}}>
        {tab==="info" && (
          <>
            <p style={{fontSize:13,color:C.mutedLight,lineHeight:1.7,marginBottom:18}}>{worker.bio||"Profesional verificado con años de experiencia."}</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:18}}>
              {[{l:"Trabajos",v:String(worker.jobs)},{l:"Precio/h",v:(worker.price||0)+"€"},{l:"Rating",v:worker.rating>0?String(worker.rating):"Nuevo"}].map(s=>(
                <div key={s.l} style={{background:"linear-gradient(135deg,"+color+"22,transparent)",borderRadius:10,padding:"12px 8px",textAlign:"center",border:"1px solid "+color+"44"}}>
                  <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color}}>{s.v}</p>
                  <p style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.l}</p>
                </div>
              ))}
            </div>
            {currentUser && currentUser.type==="cliente" && (
              <div style={{display:"flex",gap:10}}>
                <Btn full onClick={()=>onChat(worker)} color={C.accent}>💬 ENVIAR MENSAJE</Btn>
                <Btn full outline onClick={()=>{}} color={C.green}>📞 VER TELÉFONO</Btn>
              </div>
            )}
            {!currentUser && <p style={{textAlign:"center",fontSize:13,color:C.muted,padding:"12px",background:C.surface,borderRadius:8}}>Regístrate gratis para contactar con profesionales</p>}
          </>
        )}
        {tab==="reviews" && (
          <>
            {currentUser && (
              <div style={{background:C.surface,borderRadius:10,padding:14,marginBottom:16,border:"1px solid "+C.border}}>
                <p style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,fontWeight:700}}>Escribe tu reseña</p>
                <div style={{display:"flex",gap:4,marginBottom:10}}>
                  {[1,2,3,4,5].map(s=><button key={s} onClick={()=>setSelStars(s)} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:s<=selStars?C.accent:C.border,transition:"color 0.1s"}}>★</button>)}
                </div>
                <div style={{display:"flex",gap:5,marginBottom:10,flexWrap:"wrap"}}>
                  {["📸","🏠","💧","⚡","🔧","🎨","✅"].map(e=>(
                    <button key={e} onClick={()=>setEmoji(emoji===e?"":e)} style={{padding:"3px 7px",borderRadius:5,border:"1px solid "+(emoji===e?C.accent:C.border),background:emoji===e?C.accent+"22":"transparent",cursor:"pointer",fontSize:14}}>{e}</button>
                  ))}
                </div>
                <textarea value={newRev} onChange={e=>setNewRev(e.target.value)} placeholder="Cuéntanos tu experiencia..." style={{width:"100%",background:C.card,border:"1px solid "+C.border,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:13,padding:"10px",resize:"vertical",minHeight:68,outline:"none",marginBottom:10}} />
                <Btn full small onClick={submitReview} color={C.accent}>PUBLICAR RESEÑA</Btn>
              </div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {allRevs.map((r,i)=>(
                <div key={i} style={{background:C.surface,borderRadius:8,padding:12,border:"1px solid "+C.border}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <div style={{width:28,height:28,borderRadius:"50%",background:color+"33",border:"1px solid "+color+"55",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color}}>{r.user[0]}</div>
                    <div style={{flex:1}}><p style={{fontSize:13,fontWeight:700,color:C.text}}>{r.user}</p><p style={{fontSize:10,color:C.muted}}>{r.date}</p></div>
                    <Stars n={r.stars} size={11} />
                  </div>
                  <p style={{fontSize:13,color:C.mutedLight,lineHeight:1.6}}>{r.text}</p>
                </div>
              ))}
              {allRevs.length===0 && <p style={{textAlign:"center",color:C.muted,fontSize:13,padding:20}}>Sé el primero en dejar una reseña</p>}
            </div>
          </>
        )}
        {tab==="fotos" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
              {["🔌","⚡","🏠","🔧","💡","🛠️","📐","🪚","🔩"].map((e,i)=>(
                <div key={i} style={{aspectRatio:"1",background:"linear-gradient(135deg,"+color+"22,transparent)",borderRadius:8,border:"1px solid "+color+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,cursor:"pointer"}}>{e}</div>
              ))}
            </div>
            <p style={{fontSize:11,color:C.muted,textAlign:"center"}}>El profesional puede subir fotos desde su panel</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── CHAT PANEL ───
function ChatPanel({ worker, onClose, convos, onSaveConvos }: { worker:User|null; onClose:()=>void; currentUser?:User|null; convos:Conversation[]; onSaveConvos:(c:Conversation[])=>void }) {
  const [input,setInput]=useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  if(!worker) return null;
  const color = workerColor(worker.id);
  const convo = convos.find(c=>c.workerId===worker.id) || { workerId:worker.id, messages:[{from:"pro",text:"¡Hola! Soy "+worker.name+". ¿En qué puedo ayudarte?",time:"ahora"}] };
  const msgs = convo.messages;

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs.length]);

  const send = () => {
    if(!input.trim()) return;
    const t = new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
    const newMsg: Message = {from:"user",text:input,time:t};
    const updated = convos.filter(c=>c.workerId!==worker.id);
    const newConvo: Conversation = {...convo, messages:[...msgs,newMsg]};
    const saved = [newConvo,...updated];
    onSaveConvos(saved); saveConvos(saved); setInput("");
    const rs=["Puedo estar disponible esta semana.","¿Me das más detalles del trabajo?","Son "+worker.price+"€/h, materiales aparte.","Sin problema, tengo disponibilidad.","Te llamo en unos minutos."];
    setTimeout(()=>{
      const rep: Message = {from:"pro",text:rs[Math.floor(Math.random()*rs.length)],time:new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})};
      const saved2 = [{...newConvo,messages:[...newConvo.messages,rep]},...updated];
      onSaveConvos(saved2); saveConvos(saved2);
    },1200);
  };

  return (
    <div style={{position:"fixed",bottom:0,right:0,width:"100%",maxWidth:340,height:"420px",background:"linear-gradient(160deg,#0F0F20,#080812)",borderRadius:"16px 16px 0 0",border:"1px solid "+color+"66",boxShadow:"0 0 40px "+color+"22,0 -10px 40px rgba(0,0,0,0.6)",zIndex:400,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"12px 16px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:10,background:color+"15",borderRadius:"16px 16px 0 0"}}>
        <Ava s={worker.name.substring(0,2).toUpperCase()} size={34} color={color} />
        <div style={{flex:1}}><p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:C.text}}>{worker.name}</p><p style={{fontSize:10,color:C.green}}>● En línea</p></div>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18}}>✕</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"12px",display:"flex",flexDirection:"column",gap:8}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.from==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"78%",background:m.from==="user"?color+"44":C.card,border:"1px solid "+(m.from==="user"?color+"66":C.border),borderRadius:m.from==="user"?"12px 12px 2px 12px":"12px 12px 12px 2px",padding:"8px 12px"}}>
              <p style={{fontSize:12,color:m.from==="user"?C.accent:C.text,lineHeight:1.5}}>{m.text}</p>
              <p style={{fontSize:9,color:C.muted,marginTop:2,textAlign:"right"}}>{m.time}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{padding:"10px 12px",borderTop:"1px solid "+C.border,display:"flex",gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Escribe un mensaje..." style={{flex:1,background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"8px 12px",color:C.text,fontFamily:"inherit",fontSize:13,outline:"none"}} />
        <button onClick={send} style={{padding:"8px 14px",background:"linear-gradient(135deg,"+C.accent+","+C.accentOrange+")",border:"none",borderRadius:8,color:"#000",fontWeight:900,cursor:"pointer",fontSize:14}}>→</button>
      </div>
    </div>
  );
}

// ─── CLIENT HOME ───
function ClientHome({ user, onLogout }: { user:User; onLogout:()=>void }) {
  const [tab,setTab]=useState<"buscar"|"mensajes"|"perfil">("buscar");
  const [zona,setZona]=useState("Todas");
  const [oficio,setOficio]=useState("Todos");
  const [search,setSearch]=useState("");
  const [workers] = useState(loadWorkers());
  const [selectedWorker,setSelectedWorker]=useState<User|null>(null);
  const [chatWorker,setChatWorker]=useState<User|null>(null);
  const [convos,setConvos]=useState<Conversation[]>(loadConvos());
  const [toast,setToast]=useState<string|null>(null);

  const showToast=(m:string)=>{setToast(m);setTimeout(()=>setToast(null),3000);};

  const filtered = workers.filter(w=>{
    if(zona!=="Todas"&&w.zone!==zona) return false;
    if(oficio!=="Todos"&&w.trade!==oficio) return false;
    if(search&&!w.name.toLowerCase().includes(search.toLowerCase())&&!(w.trade||"").toLowerCase().includes(search.toLowerCase())&&!(w.zone||"").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const totalUnread = convos.filter(c=>c.messages.length>0&&c.messages[c.messages.length-1].from==="pro").length;

  return (
    <div style={{minHeight:"100dvh",background:C.bg,backgroundImage:"radial-gradient(ellipse at 30% 0%,#1a0a3a44,transparent 60%),radial-gradient(ellipse at 80% 100%,#0a1a3a44,transparent 60%)",paddingBottom:80}}>
      {/* Header */}
      <header style={{background:"rgba(8,8,16,0.92)",backdropFilter:"blur(20px)",borderBottom:"1px solid "+C.border,position:"sticky",top:0,zIndex:100,boxShadow:"0 4px 24px rgba(0,0,0,0.4)"}}>
        <div style={{maxWidth:900,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:54}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{fontSize:20,animation:"float 3s ease-in-out infinite"}}>🔨</div>
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:C.text}}>OFICIO<span style={{color:C.accent}}>YA</span></span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:12,color:C.muted}}>{user.name.split(" ")[0]}</span>
            <button onClick={onLogout} style={{background:"none",border:"1px solid "+C.border,borderRadius:6,color:C.muted,cursor:"pointer",padding:"4px 10px",fontSize:11}}>Salir</button>
          </div>
        </div>
      </header>

      <div style={{maxWidth:900,margin:"0 auto",padding:"0 16px"}}>
        {tab==="buscar" && (
          <>
            <div style={{padding:"28px 0 20px"}}>
              <div style={{display:"inline-flex",gap:6,background:C.green+"15",border:"1px solid "+C.green+"33",borderRadius:6,padding:"4px 12px",marginBottom:14}}>
                <span style={{fontSize:9,color:C.green,animation:"pulse 2s infinite"}}>●</span>
                <span style={{fontSize:11,color:C.green,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase"}}>{workers.filter(w=>w.available).length} profesionales disponibles ahora</span>
              </div>
              <h1 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(32px,7vw,56px)",lineHeight:0.93,letterSpacing:"0.02em",marginBottom:12}}>
                <span style={{background:"linear-gradient(135deg,"+C.text+",#8888BB)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>EL PROFESIONAL<br/>QUE NECESITAS</span><br/>
                <span style={{background:"linear-gradient(135deg,"+C.accent+","+C.accentOrange+")",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>A UN CLIC.</span>
              </h1>
            </div>

            {/* Filters */}
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
              <div style={{display:"flex",background:C.card,borderRadius:10,border:"1px solid "+C.border,overflow:"hidden"}}>
                <span style={{padding:"0 12px",display:"flex",alignItems:"center",color:C.muted,fontSize:16}}>🔍</span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Busca electricista, fontanero..." style={{flex:1,padding:"12px 0",background:"transparent",border:"none",color:C.text,fontFamily:"inherit",fontSize:14,outline:"none"}} />
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <select value={zona} onChange={e=>setZona(e.target.value)} style={{padding:"10px 12px",background:C.card,border:"1px solid "+C.border,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:13,cursor:"pointer",outline:"none"}}>
                  <option style={{background:C.card}}>Todas</option>
                  {ZONAS.map(z=><option key={z} style={{background:C.card}}>{z}</option>)}
                </select>
                <select value={oficio} onChange={e=>setOficio(e.target.value)} style={{padding:"10px 12px",background:C.card,border:"1px solid "+C.border,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:13,cursor:"pointer",outline:"none"}}>
                  <option style={{background:C.card}}>Todos</option>
                  {OFICIOS.map(o=><option key={o} style={{background:C.card}}>{o}</option>)}
                </select>
              </div>
            </div>

            {/* Stats bar */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:C.border,borderRadius:10,overflow:"hidden",marginBottom:20}}>
              {[{v:workers.length+"+",l:"Pros",c:C.purple},{v:"1.8K",l:"Trabajos",c:C.blue},{v:"52",l:"Ciudades",c:C.green},{v:"4.8★",l:"Media",c:C.accent}].map(s=>(
                <div key={s.l} style={{background:"linear-gradient(135deg,"+s.c+"15,"+C.surface+")",padding:"10px 6px",textAlign:"center"}}>
                  <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:s.c}}>{s.v}</p>
                  <p style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.l}</p>
                </div>
              ))}
            </div>

            {/* Workers grid */}
            <p style={{fontSize:12,color:C.muted,marginBottom:12}}><span style={{color:C.text,fontWeight:700}}>{filtered.length}</span> profesionales encontrados</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
              {filtered.map((w)=>{
                const col=workerColor(w.id);
                return (
                  <Card key={w.id} onClick={()=>setSelectedWorker(w)} glow={col} style={{position:"relative",overflow:"hidden"}}>
                    <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,borderRadius:"50%",background:"radial-gradient(circle,"+col+"22,transparent 70%)",pointerEvents:"none"}} />
                    {w.plan==="elite"&&<div style={{marginBottom:8}}><span style={{padding:"2px 8px",borderRadius:4,fontSize:9,fontWeight:900,letterSpacing:"0.08em",color:C.accent,background:C.accent+"22",border:"1px solid "+C.accent+"44"}}>⭐ ÉLITE</span></div>}
                    <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10}}>
                      <Ava s={w.name.substring(0,2).toUpperCase()} size={46} color={col} />
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                          <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:C.text}}>{w.name}</p>
                          {w.verified&&<span style={{fontSize:10,color:C.green}}>✓</span>}
                        </div>
                        <p style={{fontSize:12,color:col,fontWeight:700,marginBottom:2}}>{OFICIO_ICONS[w.trade||""]||"🔧"} {w.trade}</p>
                        <p style={{fontSize:11,color:C.muted}}>📍 {w.zone}</p>
                      </div>
                    </div>
                    <p style={{fontSize:12,color:C.mutedLight,marginBottom:10,lineHeight:1.55}}>{w.bio}</p>
                    <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:10,flexWrap:"wrap"}}>
                      <Stars n={w.rating} /><span style={{fontSize:11,color:C.text,fontWeight:700}}>{w.rating>0?w.rating:"Nuevo"}</span>
                      {w.reviews>0&&<span style={{fontSize:10,color:C.muted}}>({w.reviews}) · {w.jobs} trabajos</span>}
                    </div>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:10,borderTop:"1px solid "+C.border}}>
                      <div><span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:C.accent}}>{w.price}€</span><span style={{fontSize:11,color:C.muted}}>/h</span></div>
                      <div style={{display:"flex",gap:5,alignItems:"center"}}>
                        <span style={{width:6,height:6,borderRadius:"50%",background:w.available?C.green:C.red,display:"inline-block",boxShadow:w.available?"0 0 6px "+C.green:""}} />
                        <span style={{fontSize:11,color:w.available?C.green:C.red,fontWeight:700}}>{w.available?"Disponible":"Ocupado"}</span>
                      </div>
                    </div>
                  </Card>
                );
              })}
              {filtered.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:48,color:C.muted}}><p style={{fontSize:40,marginBottom:8}}>🔍</p><p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24}}>SIN RESULTADOS</p><p style={{fontSize:13,marginTop:6}}>Prueba con otra búsqueda</p></div>}
            </div>
          </>
        )}

        {tab==="mensajes" && (
          <div style={{padding:"24px 0"}}>
            <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:C.text,marginBottom:20}}>MIS MENSAJES</p>
            {convos.length===0&&<div style={{textAlign:"center",padding:48,color:C.muted}}><p style={{fontSize:40,marginBottom:8}}>💬</p><p style={{fontSize:14}}>No tienes conversaciones aún</p><p style={{fontSize:12,marginTop:6}}>Contacta con un profesional para empezar</p></div>}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {convos.map(c=>{
                const w=workers.find(x=>x.id===c.workerId); if(!w) return null;
                const last=c.messages[c.messages.length-1];
                const col=workerColor(w.id);
                return (
                  <Card key={c.workerId} onClick={()=>setChatWorker(w)} glow={col}>
                    <div style={{display:"flex",gap:12,alignItems:"center"}}>
                      <Ava s={w.name.substring(0,2).toUpperCase()} size={44} color={col} />
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontWeight:700,color:C.text,marginBottom:2}}>{w.name}</p>
                        <p style={{fontSize:12,color:C.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{last?.text}</p>
                      </div>
                      <span style={{fontSize:10,color:C.muted,flexShrink:0}}>{last?.time}</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {tab==="perfil" && (
          <div style={{padding:"24px 0"}}>
            <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:C.text,marginBottom:20}}>MI PERFIL</p>
            <Card style={{marginBottom:16}}>
              <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:16}}>
                <Ava s={user.name.substring(0,2).toUpperCase()} size={56} color={C.blue} />
                <div>
                  <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:C.text}}>{user.name}</p>
                  <p style={{fontSize:13,color:C.muted}}>{user.email}</p>
                  <PlanBadge plan={user.plan} />
                </div>
              </div>
              <div style={{padding:"12px",background:C.surface,borderRadius:8,border:"1px solid "+C.border}}>
                <p style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Estado del plan</p>
                <p style={{fontSize:13,color:C.text}}>Plan <span style={{color:PLAN_COLORS[user.plan],fontWeight:700}}>{user.plan.toUpperCase()}</span> · Trial hasta {user.trialEnd}</p>
              </div>
            </Card>
            <Btn full outline onClick={onLogout} color={C.red}>Cerrar sesión</Btn>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(8,8,16,0.95)",backdropFilter:"blur(20px)",borderTop:"1px solid "+C.border,display:"flex",zIndex:200,boxShadow:"0 -4px 20px rgba(0,0,0,0.5)"}}>
        {([["buscar","🔍","Buscar"],["mensajes","💬","Mensajes"],["perfil","👤","Mi Perfil"]] as const).map(([id,icon,label])=>(
          <button key={id} onClick={()=>setTab(id as any)} style={{flex:1,padding:"10px 4px 12px",background:"none",border:"none",color:tab===id?C.accent:C.muted,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,transition:"color 0.15s",position:"relative"}}>
            <span style={{fontSize:20}}>{icon}</span>
            <span style={{fontSize:10,fontWeight:600,letterSpacing:"0.04em"}}>{label}</span>
            {id==="mensajes"&&totalUnread>0&&<span style={{position:"absolute",top:6,right:"calc(50% - 20px)",background:C.red,color:"#fff",borderRadius:"50%",width:16,height:16,fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{totalUnread}</span>}
          </button>
        ))}
      </nav>

      {selectedWorker && <WorkerModal worker={selectedWorker} onClose={()=>setSelectedWorker(null)} onChat={w=>{setSelectedWorker(null);setChatWorker(w);showToast("Chat abierto con "+w.name);}} currentUser={user} />}
      {chatWorker && <ChatPanel worker={chatWorker} onClose={()=>setChatWorker(null)} currentUser={user} convos={convos} onSaveConvos={setConvos} />}
      <Toast msg={toast} />
    </div>
  );
}

// ─── PRO DASHBOARD ───
function ProDashboard({ user, onLogout, onUpdateUser }: { user:User; onLogout:()=>void; onUpdateUser:(u:User)=>void }) {
  const [tab,setTab]=useState<"inicio"|"perfil"|"stats"|"planes">("inicio");
  const [toast,setToast]=useState<string|null>(null);
  const [bio,setBio]=useState(user.bio||"");
  const [price,setPrice]=useState(String(user.price||30));
  const [available,setAvailable]=useState(user.available);
  const [editMode,setEditMode]=useState(false);
  const daysLeft = trialDaysLeft(user.trialEnd);
  const showToast=(m:string)=>{setToast(m);setTimeout(()=>setToast(null),3000);};

  const saveProfile = () => {
    const updated = {...user,bio,price:parseInt(price)||30,available};
    saveUser(updated); onUpdateUser(updated);
    const ws = loadWorkers();
    const idx = ws.findIndex(w=>w.id===user.id);
    if(idx>=0){ws[idx]=updated;saveWorkers(ws);}
    setEditMode(false); showToast("✓ Perfil actualizado");
  };

  const planFeats = PLAN_FEATURES[user.plan];
  const canAccess = (feat: string) => planFeats.some(f=>f.toLowerCase().includes(feat.toLowerCase()));

  return (
    <div style={{minHeight:"100dvh",background:C.bg,backgroundImage:"radial-gradient(ellipse at 70% 0%,#2a0a3a44,transparent 60%)",paddingBottom:80}}>
      {/* Header */}
      <header style={{background:"rgba(8,8,16,0.92)",backdropFilter:"blur(20px)",borderBottom:"1px solid "+C.border,position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:900,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:54}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{fontSize:20}}>🔨</div>
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:C.text}}>OFICIO<span style={{color:C.accent}}>YA</span></span>
            <span style={{fontSize:9,color:C.accent,background:C.accent+"22",padding:"2px 6px",borderRadius:3,fontWeight:700}}>PRO</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <PlanBadge plan={user.plan} />
            <button onClick={onLogout} style={{background:"none",border:"1px solid "+C.border,borderRadius:6,color:C.muted,cursor:"pointer",padding:"4px 10px",fontSize:11}}>Salir</button>
          </div>
        </div>
      </header>

      {/* Trial banner */}
      {daysLeft <= 30 && (
        <div style={{background:"linear-gradient(135deg,"+C.accent+"22,"+C.accentOrange+"15)",borderBottom:"1px solid "+C.accent+"33",padding:"8px 16px",textAlign:"center"}}>
          <p style={{fontSize:12,color:C.accent,fontWeight:700}}>
            {daysLeft > 0 ? "⏱ Trial gratuito: "+daysLeft+" días restantes · Upgrade para no perder tu perfil" : "⚠ Tu trial ha expirado · Activa un plan para seguir visible"}
          </p>
        </div>
      )}

      <div style={{maxWidth:900,margin:"0 auto",padding:"0 16px"}}>

        {tab==="inicio" && (
          <div style={{padding:"24px 0"}}>
            <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:24}}>
              <Ava s={user.name.substring(0,2).toUpperCase()} size={56} color={C.accent} glow />
              <div>
                <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:C.text}}>{user.name}</p>
                <p style={{fontSize:13,color:C.accent,fontWeight:700}}>{OFICIO_ICONS[user.trade||""]||"🔧"} {user.trade} · {user.zone}</p>
                <div style={{display:"flex",gap:8,alignItems:"center",marginTop:4}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:available?C.green:C.red,boxShadow:available?"0 0 8px "+C.green:""}} />
                  <span style={{fontSize:11,color:available?C.green:C.red,fontWeight:700}}>{available?"Disponible":"No disponible"}</span>
                  <button onClick={()=>{const u={...user,available:!available};setAvailable(!available);saveUser(u);onUpdateUser(u);const ws=loadWorkers();const idx=ws.findIndex(w=>w.id===user.id);if(idx>=0){ws[idx]=u;saveWorkers(ws);}}} style={{background:"none",border:"1px solid "+C.border,borderRadius:6,color:C.muted,cursor:"pointer",padding:"2px 8px",fontSize:10}}>Cambiar</button>
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:20}}>
              {[{l:"Trabajos realizados",v:String(user.jobs),c:C.accent,i:"🔨"},{l:"Valoración media",v:user.rating>0?String(user.rating):"—",c:C.green,i:"⭐"},{l:"Reseñas recibidas",v:String(user.reviews),c:C.blue,i:"💬"},{l:"Días de trial",v:String(daysLeft),c:daysLeft>7?C.mutedLight:C.red,i:"⏱"}].map(s=>(
                <Card key={s.l} style={{textAlign:"center",padding:"16px 12px"}}>
                  <div style={{fontSize:22,marginBottom:6}}>{s.i}</div>
                  <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:s.c}}>{s.v}</p>
                  <p style={{fontSize:11,color:C.muted}}>{s.l}</p>
                </Card>
              ))}
            </div>

            {/* Feature access */}
            <Card style={{marginBottom:16}}>
              <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:C.text,marginBottom:14,letterSpacing:"0.05em"}}>TU PLAN: {user.plan.toUpperCase()}</p>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[{feat:"Chat",icon:"💬",key:"chat"},{feat:"Estadísticas",icon:"📊",key:"stadísticas"},{feat:"Galería de fotos",icon:"📸",key:"galería"},{feat:"Ranking",icon:"🏆",key:"ranking"},{feat:"Primero en búsquedas",icon:"🔝",key:"primero"},{feat:"Anuncios en portada",icon:"📢",key:"anuncios"}].map(({feat,icon,key})=>{
                  const has=canAccess(key);
                  return (
                    <div key={feat} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid "+C.border}}>
                      <span style={{fontSize:16}}>{icon}</span>
                      <span style={{flex:1,fontSize:13,color:has?C.text:C.muted}}>{feat}</span>
                      {has ? <span style={{color:C.green,fontSize:12,fontWeight:700}}>✓ Activo</span> : <button onClick={()=>setTab("planes")} style={{background:"none",border:"1px solid "+C.accent+"44",borderRadius:6,color:C.accent,cursor:"pointer",padding:"3px 8px",fontSize:10,fontWeight:700}}>Activar →</button>}
                    </div>
                  );
                })}
              </div>
            </Card>

            <Btn full onClick={()=>setTab("planes")} color={C.accent}>MEJORAR PLAN →</Btn>
          </div>
        )}

        {tab==="perfil" && (
          <div style={{padding:"24px 0"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:C.text}}>MI PERFIL</p>
              <button onClick={()=>editMode?saveProfile():setEditMode(true)} style={{padding:"8px 18px",background:editMode?"linear-gradient(135deg,"+C.accent+","+C.accentOrange+")":"transparent",border:"1px solid "+C.accent+"66",borderRadius:8,color:editMode?"#000":C.accent,cursor:"pointer",fontSize:13,fontWeight:700}}>
                {editMode?"GUARDAR ✓":"EDITAR ✏"}
              </button>
            </div>
            <Card>
              <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:20}}>
                <Ava s={user.name.substring(0,2).toUpperCase()} size={64} color={C.accent} glow />
                <div>
                  <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:C.text}}>{user.name}</p>
                  <p style={{fontSize:13,color:C.muted}}>{user.email} · {user.phone}</p>
                  <div style={{display:"flex",gap:6,marginTop:4}}>
                    {user.verified&&<span style={{fontSize:10,color:C.green,border:"1px solid "+C.green+"44",padding:"1px 6px",borderRadius:99}}>✓ Verificado</span>}
                    <PlanBadge plan={user.plan} />
                  </div>
                </div>
              </div>
              {editMode ? (
                <>
                  <div style={{marginBottom:14}}>
                    <p style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5,fontWeight:700}}>Descripción profesional</p>
                    <textarea value={bio} onChange={e=>setBio(e.target.value)} style={{width:"100%",background:C.surface,border:"1px solid "+C.border,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:13,padding:"10px",resize:"vertical",minHeight:80,outline:"none"}} placeholder="Describe tu experiencia y servicios..." />
                  </div>
                  <Input label="Precio por hora (€)" value={price} onChange={setPrice} type="number" />
                </>
              ) : (
                <>
                  <p style={{fontSize:13,color:C.mutedLight,lineHeight:1.7,marginBottom:14}}>{user.bio||"Sin descripción. Pulsa Editar para añadir tu bio."}</p>
                  <div style={{display:"flex",gap:10}}>
                    <div style={{background:C.surface,borderRadius:8,padding:"10px 14px",flex:1,textAlign:"center"}}>
                      <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:C.accent}}>{user.price||30}€</p>
                      <p style={{fontSize:10,color:C.muted}}>por hora</p>
                    </div>
                    <div style={{background:C.surface,borderRadius:8,padding:"10px 14px",flex:1,textAlign:"center"}}>
                      <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:C.green}}>{user.jobs}</p>
                      <p style={{fontSize:10,color:C.muted}}>trabajos</p>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </div>
        )}

        {tab==="stats" && (
          <div style={{padding:"24px 0"}}>
            <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:C.text,marginBottom:20}}>ESTADÍSTICAS</p>
            {!canAccess("stadísticas") ? (
              <Card style={{textAlign:"center",padding:"40px 20px"}}>
                <p style={{fontSize:40,marginBottom:12}}>📊</p>
                <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:C.text,marginBottom:8}}>DISPONIBLE EN BÁSICO+</p>
                <p style={{fontSize:13,color:C.muted,marginBottom:20}}>Accede a estadísticas completas de visitas, contactos y conversiones</p>
                <Btn onClick={()=>setTab("planes")} color={C.accent}>VER PLANES →</Btn>
              </Card>
            ) : (
              <>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:20}}>
                  {[{l:"Visitas este mes",v:"142",c:C.blue,trend:"+23%"},{l:"Contactos recibidos",v:"18",c:C.green,trend:"+8%"},{l:"Conversión",v:"12%",c:C.accent,trend:"+2%"},{l:"Ingresos estimados",v:"1.260€",c:C.accentOrange,trend:"+15%"}].map(s=>(
                    <Card key={s.l} style={{textAlign:"center",padding:"16px 12px"}}>
                      <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:s.c,marginBottom:4}}>{s.v}</p>
                      <p style={{fontSize:10,color:C.muted,marginBottom:6}}>{s.l}</p>
                      <span style={{fontSize:10,color:C.green,background:C.green+"15",padding:"2px 6px",borderRadius:99}}>{s.trend}</span>
                    </Card>
                  ))}
                </div>
                <Card>
                  <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:C.text,marginBottom:14}}>ACTIVIDAD RECIENTE</p>
                  {["Nuevo contacto de María G. — hace 2h","Reseña 5★ recibida — ayer","Perfil visto 12 veces — esta semana","Apareces en 8 búsquedas — este mes"].map((a,i)=>(
                    <div key={i} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:i<3?"1px solid "+C.border:"none",alignItems:"center"}}>
                      <span style={{fontSize:16,flexShrink:0}}>{"🔔📝👁🔍"[i]}</span>
                      <span style={{fontSize:13,color:C.mutedLight}}>{a}</span>
                    </div>
                  ))}
                </Card>
              </>
            )}
          </div>
        )}

        {tab==="planes" && (
          <div style={{padding:"24px 0"}}>
            <div style={{textAlign:"center",marginBottom:24}}>
              <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:36,color:C.text,lineHeight:0.9,marginBottom:8}}>ELIGE TU<br/><span style={{color:C.accent}}>PLAN</span></p>
              <p style={{fontSize:13,color:C.muted}}>30 días gratis · Sin tarjeta · Cancela cuando quieras</p>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {(["gratis","basico","pro","elite"] as Plan[]).map(pl=>{
                const col=PLAN_COLORS[pl]; const isCurrent=user.plan===pl;
                return (
                  <div key={pl} style={{background:pl==="pro"?"linear-gradient(160deg,#1a1a2e,#0d0d1a)":"linear-gradient(160deg,"+C.card+",#080812)",borderRadius:14,border:(isCurrent?"2px":"1px")+" solid "+(isCurrent?col+"AA":pl==="pro"?col+"66":C.border),padding:"20px",position:"relative",boxShadow:pl==="pro"?"0 0 40px "+col+"22":"none"}}>
                    {pl==="pro"&&!isCurrent&&<div style={{position:"absolute",top:-12,right:16,background:"linear-gradient(135deg,"+C.accent+","+C.accentOrange+")",color:"#000",borderRadius:99,padding:"2px 12px",fontSize:9,fontWeight:900,letterSpacing:"0.08em"}}>MÁS POPULAR</div>}
                    {isCurrent&&<div style={{position:"absolute",top:-12,left:16,background:col,color:"#000",borderRadius:99,padding:"2px 12px",fontSize:9,fontWeight:900,letterSpacing:"0.08em"}}>✓ PLAN ACTUAL</div>}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                      <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:col,letterSpacing:"0.08em"}}>{pl.toUpperCase()}</span>
                      <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:C.text}}>{PLAN_PRICES[pl]===0?"GRATIS":PLAN_PRICES[pl]+"€/mes"}</span>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16}}>
                      {PLAN_FEATURES[pl].map(f=>(
                        <span key={f} style={{fontSize:11,color:C.mutedLight,background:C.surface,padding:"3px 8px",borderRadius:99,border:"1px solid "+C.border}}>✓ {f}</span>
                      ))}
                    </div>
                    {!isCurrent && (
                      <button onClick={()=>showToast("🚀 Activando plan "+pl.toUpperCase()+"... (demo mode)")} style={{width:"100%",padding:"11px",background:pl==="pro"?"linear-gradient(135deg,"+col+","+C.accentOrange+")":"transparent",border:"1px solid "+col+"66",borderRadius:8,color:pl==="pro"?"#000":col,fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:"0.05em",cursor:"pointer"}}>
                        {pl==="gratis"?"VOLVER A GRATUITO":"ACTIVAR "+pl.toUpperCase()+" →"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(8,8,16,0.95)",backdropFilter:"blur(20px)",borderTop:"1px solid "+C.border,display:"flex",zIndex:200}}>
        {([["inicio","🏠","Inicio"],["perfil","👤","Perfil"],["stats","📊","Stats"],["planes","💎","Planes"]] as const).map(([id,icon,label])=>(
          <button key={id} onClick={()=>setTab(id as any)} style={{flex:1,padding:"10px 4px 12px",background:"none",border:"none",color:tab===id?C.accent:C.muted,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,transition:"color 0.15s"}}>
            <span style={{fontSize:20}}>{icon}</span>
            <span style={{fontSize:10,fontWeight:600,letterSpacing:"0.04em"}}>{label}</span>
          </button>
        ))}
      </nav>
      <Toast msg={toast} />
    </div>
  );
}

// ─── MAIN APP ───
export default function App() {
  const [screen,setScreen] = useState<"login"|"register"|"app">("login");
  const [user,setUser] = useState<User|null>(null);

  useEffect(()=>{
    const saved = loadUser();
    if(saved){ setUser(saved); setScreen("app"); }
    // Initialize demo workers if not present
    if(!localStorage.getItem("oy_workers")) saveWorkers(DEMO_WORKERS);
  },[]);

  const handleLogin = (u:User) => { setUser(u); setScreen("app"); };
  const handleLogout = () => { localStorage.removeItem("oy_user"); setUser(null); setScreen("login"); };
  const handleUpdateUser = (u:User) => setUser(u);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { overflow-x: hidden; }
        body { background: #080810; color: #EEEEFF; font-family: 'DM Sans', sans-serif; overflow-x: hidden; min-height: 100dvh; }
        #root { min-height: 100dvh; background: #080810; }
        input, textarea, select { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: #44445A; }
        select option { background: #111120; color: #EEEEFF; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1E1E38; border-radius: 99px; }
        @keyframes float { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-5px);} }
        @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px);} to{opacity:1;transform:none;} }
      `}</style>

      {screen==="login" && <LoginScreen onLogin={handleLogin} onGoRegister={()=>setScreen("register")} />}
      {screen==="register" && <RegisterScreen onRegister={handleLogin} onGoLogin={()=>setScreen("login")} />}
      {screen==="app" && user && (
        user.type==="profesional"
          ? <ProDashboard user={user} onLogout={handleLogout} onUpdateUser={handleUpdateUser} />
          : <ClientHome user={user} onLogout={handleLogout} />
      )}
    </>
  );
}
