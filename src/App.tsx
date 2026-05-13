import { useState, useEffect, useRef, useCallback } from "react";
import { db, STORAGE_URL } from "./supabase";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { UserRow, ReviewRow, MessageRow, JobRow, CertRow, Plan, PhotoRow } from "./supabase";

const C = {
  bg: "#0A0A0F",
  surface: "#111118",
  card: "#16161F",
  cardHover: "#1C1C2A",
  border: "#1E1E30",
  accent: "#D4AF37",        // Dorado elegante y profesional
  orange: "#FF8C00",
  red: "#FF4455",
  green: "#00D68F",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  cyan: "#06B6D4",
  pink: "#EC4899",
  text: "#F0F0FA",
  muted: "#44445A",
  mutedL: "#7777AA",
};

const ZONAS = [
  "Sevilla","Madrid","Barcelona","Valencia","Málaga","Bilbao","Zaragoza","Alicante","Granada","Cádiz","Córdoba","Huelva",
];

const SEVILLA_ZONAS = [
  "Centro / Casco Antiguo","Triana","Los Remedios","Nervión","La Macarena",
  "San Pablo / Santa Justa","Bellavista / La Palmera","Cerro-Amate","Sur","Este / Alcosa / Torreblanca",
  "Norte","Camas","Dos Hermanas","Alcalá de Guadaíra","Mairena del Aljarafe",
  "San Juan de Aznalfarache","Bormujos","Tomares","Gelves","La Rinconada"
];

const OFICIOS = [
  "Electricista","Fontanero","Pintor","Albañil","Carpintero","Cerrajero","Jardinero",
  "Soldador","Climatización","Reformas Integrales","Instalador Solar","Yesero",
  "Técnico de Gas","Fumigador","Techador","Tapicero","Mecánico","Cocinero","Zapatero",
  "Montador de Estructuras",
  "Ceramista / Alfarero","Bordador de Oro y Seda","Orfebre","Guarnicionero",
  "Costurero/a Flamenca","Lutier","Imaginero / Escultor","Abaniquero",
  "Encuadernador Artesanal","Tallista de Castañuelas","Otros servicios",
];

const OFICIO_CATEGORIES: Record<string,string> = {
  "Electricista":"⚡ Técnico","Fontanero":"🔧 Técnico","Pintor":"🖌️ Técnico",
  "Albañil":"🧱 Técnico","Carpintero":"🪵 Técnico","Cerrajero":"🔑 Técnico",
  "Jardinero":"🌿 Servicios","Soldador":"🔥 Técnico","Climatización":"❄️ Técnico",
  "Reformas Integrales":"🏗️ Técnico","Instalador Solar":"☀️ Técnico","Yesero":"🏛️ Técnico",
  "Técnico de Gas":"🔩 Técnico","Fumigador":"🪲 Servicios","Techador":"🏠 Técnico",
  "Tapicero":"🪑 Técnico","Mecánico":"🚗 Técnico","Cocinero":"👨‍🍳 Hostelería",
  "Zapatero":"👟 Servicios","Montador de Estructuras":"🎪 Eventos",
  "Ceramista / Alfarero":"🏺 Artesanía","Bordador de Oro y Seda":"🧵 Artesanía",
  "Orfebre":"💍 Artesanía","Guarnicionero":"🐴 Artesanía",
  "Costurero/a Flamenca":"💃 Artesanía","Lutier":"🎸 Artesanía",
  "Imaginero / Escultor":"⛪ Artesanía","Abaniquero":"🪭 Artesanía",
  "Encuadernador Artesanal":"📚 Artesanía","Tallista de Castañuelas":"🎵 Artesanía","Otros servicios":"🛠️ Servicios",
};

const OFICIO_ICONS:Record<string,string> = {
  "Electricista":"⚡","Fontanero":"🔧","Pintor":"🖌️","Albañil":"🧱","Carpintero":"🪵",
  "Cerrajero":"🔑","Jardinero":"🌿","Soldador":"🔥","Climatización":"❄️",
  "Reformas Integrales":"🏗️","Instalador Solar":"☀️","Yesero":"🏛️",
  "Técnico de Gas":"🔩","Fumigador":"🪲","Techador":"🏠","Tapicero":"🪑",
  "Mecánico":"🚗","Cocinero":"👨‍🍳","Zapatero":"👟","Montador de Estructuras":"🎪",
  "Ceramista / Alfarero":"🏺","Bordador de Oro y Seda":"🧵","Orfebre":"💍",
  "Guarnicionero":"🐴","Costurero/a Flamenca":"💃","Lutier":"🎸",
  "Imaginero / Escultor":"⛪","Abaniquero":"🪭",
  "Encuadernador Artesanal":"📚","Tallista de Castañuelas":"🎵","Otros servicios":"🛠️",
};

const SCHEDULES = ["Lunes a Viernes","Lunes a Sábado","Todos los días","Fines de semana","Urgencias 24h"];
const RESPONSE_TIMES = ["Menos de 1h","Menos de 2h","Menos de 4h","Mismo día","24 horas"];

const PLAN_COLORS:Record<Plan,string> = {gratis:"#7777AA",basico:"#3B82F6",pro:"#D4AF37",elite:"#FF8C00"};
const PLAN_PRICES:Record<Plan,number> = {gratis:0,basico:9.99,pro:24.99,elite:49.99};
const PLAN_FEATURES:Record<Plan,string[]> = {
  gratis:["Perfil básico","5 contactos/mes","Visible en búsquedas"],
  basico:["Perfil completo","20 contactos/mes","✓ Badge verificado","Estadísticas básicas","Chat con clientes","Galería 5 fotos","Gestión de trabajos"],
  pro:["Perfil destacado","Contactos ilimitados","✓✓ Badge PRO","Estadísticas avanzadas","Chat directo","Galería ilimitada","Primero en búsquedas","Panel de trabajos completo","Ranking público","Zonas de servicio múltiples"],
  elite:["Todo lo de Pro","⭐ Badge ÉLITE","Anuncios en portada","Top garantizado #1","Gestor reseñas avanzado","Facturación integrada","Soporte 24h","API de integración"],
};

// ─── PLAN FEATURE GATES ───
const PLAN_GATES = {
  statsLevel: {gratis:0, basico:1, pro:2, elite:3} as Record<Plan,number>,
  contacts: {gratis:5, basico:20, pro:999, elite:999} as Record<Plan,number>,
  photos: {gratis:0, basico:5, pro:20, elite:999} as Record<Plan,number>,
  ranking: {gratis:false, basico:false, pro:true, elite:true} as Record<Plan,boolean>,
  priority: {gratis:0, basico:1, pro:2, elite:3} as Record<Plan,number>,
  chat: {gratis:false, basico:true, pro:true, elite:true} as Record<Plan,boolean>,
  analytics: {gratis:"none", basico:"basic", pro:"full", elite:"full"} as Record<Plan,string>,
};

// Upload image to Supabase Storage
async function uploadImage(file:File, path:string):Promise<string|null>{
  const ext = file.name.split('.').pop();
  const fileName = path+"/"+Date.now()+"."+ext;
  const {error} = await db.storage.from("photos").upload(fileName, file, {contentType:file.type, upsert:true});
  if(error){console.error("Upload error:",error);return null;}
  return STORAGE_URL + fileName;
}

const wColor = (id:string) => [C.purple,C.blue,C.pink,"#10B981",C.orange,C.cyan][id.charCodeAt(id.length-1)%6];
function trialDaysLeft(t:string){ return Math.max(0,Math.ceil((new Date(t).getTime()-Date.now())/86400000)); }
function timeAgo(iso:string){
  const d=(Date.now()-new Date(iso).getTime())/1000;
  if(d<60) return "ahora"; if(d<3600) return Math.floor(d/60)+"m";
  if(d<86400) return Math.floor(d/3600)+"h"; return Math.floor(d/86400)+"d";
}

// ─── UI ATOMS ───
function Stars({n,size=13,interactive=false,onSet}:{n:number;size?:number;interactive?:boolean;onSet?:(n:number)=>void}){
  return <span style={{fontSize:size,letterSpacing:1,cursor:interactive?"pointer":"default"}}>
    {[1,2,3,4,5].map(i=><span key={i} onClick={()=>interactive&&onSet&&onSet(i)} style={{color:i<=Math.round(n)?C.accent:C.border}}>{i<=Math.round(n)?"★":"☆"}</span>)}
  </span>;
}
function Ava({s,size=44,color=C.purple,online=false}:{s:string;size?:number;color?:string;online?:boolean}){
  return <div style={{position:"relative",flexShrink:0}}>
    <div style={{width:size,height:size,borderRadius:"50%",background:"linear-gradient(135deg,"+color+"55,"+color+"22)",display:"flex",alignItems:"center",justifyContent:"center",color:C.accent,fontWeight:900,fontSize:Math.round(size*0.35),border:"2px solid "+color+"55",boxShadow:"0 0 12px "+color+"22",flexShrink:0}}>{s}</div>
    {online&&<div style={{position:"absolute",bottom:0,right:0,width:10,height:10,borderRadius:"50%",background:C.green,border:"2px solid "+C.bg}} />}
  </div>;
}
function Badge({plan}:{plan:Plan}){
  const col=PLAN_COLORS[plan];
  return <span style={{padding:"2px 7px",borderRadius:4,fontSize:9,fontWeight:900,letterSpacing:"0.08em",color:col,background:col+"22",border:"1px solid "+col+"44"}}>{plan.toUpperCase()}</span>;
}
function StatusDot({status}:{status:string}){
  const cols:Record<string,string>={pending:C.orange,in_progress:C.blue,done:C.green,cancelled:C.red};
  const labels:Record<string,string>={pending:"Pendiente",in_progress:"En progreso",done:"Completado",cancelled:"Cancelado"};
  const col=cols[status]||C.muted;
  return <span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:col,fontWeight:600}}>
    <span style={{width:6,height:6,borderRadius:"50%",background:col,display:"inline-block"}} />{labels[status]||status}
  </span>;
}
function Spin(){return <div style={{display:"flex",justifyContent:"center",padding:40}}><div style={{width:28,height:28,border:"3px solid "+C.border,borderTop:"3px solid "+C.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite"}} /></div>;}
function Ping({msg}:{msg:string|null}){
  if(!msg) return null;
  return <div style={{position:"fixed",bottom:88,left:"50%",transform:"translateX(-50%)",background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",color:"#000",borderRadius:10,padding:"10px 20px",fontWeight:700,fontSize:13,zIndex:9999,whiteSpace:"nowrap",boxShadow:"0 4px 20px "+C.accent+"55",pointerEvents:"none"}}>{msg}</div>;
}
function Sheet({children,onClose,title}:{children:React.ReactNode;onClose:()=>void;title?:string}){
  return <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(4,4,12,0.88)",backdropFilter:"blur(16px)",zIndex:500,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
    <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(170deg,#14141F,#0A0A14)",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto",border:"1px solid "+C.accent+"22",borderBottom:"none",boxShadow:"0 -8px 40px rgba(0,0,0,0.6)"}}>
      {title&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 20px 0"}}>
        <p style={{fontWeight:800,fontSize:17,color:C.text}}>{title}</p>
        <button onClick={onClose} style={{background:"none",border:"1px solid "+C.border,borderRadius:8,color:C.muted,cursor:"pointer",padding:"5px 10px",fontSize:14}}>✕</button>
      </div>}
      <div style={{padding:20}}>{children}</div>
    </div>
  </div>;
}
function Btn({children,onClick,color=C.accent,outline=false,full=false,small=false,disabled=false,danger=false}:any){
  const bg=danger?C.red:color;
  return <button onClick={onClick} disabled={disabled} style={{width:full?"100%":"auto",padding:small?"8px 14px":"12px 22px",background:outline?"transparent":"linear-gradient(135deg,"+bg+","+bg+"BB)",border:"1px solid "+bg+(outline?"66":"22"),borderRadius:10,color:outline?bg:"#000",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:small?13:14,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,transition:"all 0.15s",boxShadow:outline?"none":"0 4px 14px "+bg+"33",whiteSpace:"nowrap"}}>{children}</button>;
}
function Inp({label,value,onChange,type="text",placeholder="",required=false,multiline=false}:any){
  const s:any={width:"100%",background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"11px 14px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none"};
  return <div style={{marginBottom:14}}>
    {label&&<p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:5,fontWeight:700}}>{label}{required&&<span style={{color:C.red}}> *</span>}</p>}
    {multiline?<textarea value={value} onChange={(e:any)=>onChange(e.target.value)} placeholder={placeholder} style={{...s,resize:"vertical",minHeight:80}} />:<input type={type} value={value} onChange={(e:any)=>onChange(e.target.value)} placeholder={placeholder} style={s} />}
  </div>;
}
function GCard({children,style={},onClick,glow=""}:any){
  const [hov,setHov]=useState(false);
  return <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={onClick}
    style={{background:hov&&onClick?C.cardHover:C.card,borderRadius:14,border:"1px solid "+(hov&&glow?glow+"44":C.border),padding:18,transition:"all 0.2s",cursor:onClick?"pointer":"default",boxShadow:hov&&glow?"0 6px 24px "+glow+"18":"0 2px 12px rgba(0,0,0,0.25),inset 0 1px 0 rgba(255,255,255,0.02)",...style}}>{children}</div>;
}
function Toggle({value,onChange,label}:{value:boolean;onChange:(v:boolean)=>void;label:string}){
  return <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0"}}>
    <span style={{flex:1,fontSize:13,color:C.text}}>{label}</span>
    <button onClick={()=>onChange(!value)} style={{width:40,height:22,borderRadius:99,background:value?C.green:C.border,border:"none",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}>
      <div style={{width:14,height:14,borderRadius:"50%",background:"#fff",position:"absolute",top:4,left:value?22:4,transition:"left 0.2s"}} />
    </button>
  </div>;
}
function MultiSelect({label,options,selected,onChange}:{label:string;options:string[];selected:string[];onChange:(v:string[])=>void}){
  const toggle=(o:string)=>onChange(selected.includes(o)?selected.filter(x=>x!==o):[...selected,o]);
  return <div style={{marginBottom:14}}>
    <p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>{label}</p>
    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
      {options.map(o=><button key={o} onClick={()=>toggle(o)} style={{padding:"5px 12px",borderRadius:99,border:"1px solid "+(selected.includes(o)?C.accent:C.border),background:selected.includes(o)?C.accent+"18":"transparent",color:selected.includes(o)?C.accent:C.muted,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:selected.includes(o)?700:400,transition:"all 0.15s"}}>{o}</button>)}
    </div>
  </div>;
}

// ─── AUTH ───
function Auth({onLogin}:{onLogin:(u:UserRow)=>void}){
  const [mode,setMode]=useState<"login"|"register">("login");
  const [step,setStep]=useState(1);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const [uType,setUType]=useState<"cliente"|"profesional">("cliente");
  const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [phone,setPhone]=useState("");
  const [pass,setPass]=useState(""); const [trade,setTrade]=useState(OFICIOS[0]); const [zone,setZone]=useState(ZONAS[0]);
  const [plan,setPlan]=useState<Plan>("gratis");

  const login=async()=>{
    if(!email||!pass){setErr("Introduce email y contraseña.");return;}
    setLoading(true);setErr("");
    const {data,error}=await db.from("users").select("*").eq("email",email.toLowerCase()).eq("password",pass).single();
    setLoading(false);
    if(error||!data){setErr("Email o contraseña incorrectos.");return;}
    localStorage.setItem("oy_user",JSON.stringify(data));
    onLogin(data as UserRow);
  };

  const demoLogin=async(t:"cliente"|"profesional")=>{
    setLoading(true);
    const em=t==="profesional"?"marcos@demo.com":"demo_cli@demo.com";
    let {data}=await db.from("users").select("*").eq("email",em).single();
    if(!data&&t==="cliente"){
      const {data:d2}=await db.from("users").insert({name:"Cliente Demo",email:"demo_cli@demo.com",phone:"600000000",password:"demo123",type:"cliente",plan:"gratis",trial_end:new Date(Date.now()+30*86400000).toISOString().split("T")[0],available:true,verified:false,jobs:0,rating:0,reviews:0}).select().single();
      data=d2;
    }
    setLoading(false);
    if(data){localStorage.setItem("oy_user",JSON.stringify(data));onLogin(data as UserRow);}
  };

  const register=async()=>{
    if(!name||!email||!phone||!pass){setErr("Rellena todos los campos.");return;}
    if(pass.length<6){setErr("Mínimo 6 caracteres en la contraseña.");return;}
    setLoading(true);setErr("");
    const {data:ex}=await db.from("users").select("id").eq("email",email.toLowerCase()).maybeSingle();
    if(ex){setLoading(false);setErr("Ya existe una cuenta con ese email.");return;}
    const trial_end=new Date(Date.now()+30*86400000).toISOString().split("T")[0];
    const {data,error}=await db.from("users").insert({name,email:email.toLowerCase(),phone,password:pass,type:uType,plan,trade:uType==="profesional"?trade:null,zone:uType==="profesional"?zone:null,bio:"",price:30,available:true,verified:false,jobs:0,rating:0,reviews:0,trial_end,service_zones:[],schedule:"Lunes a Viernes",response_time:"24h",free_quote:true,experience_years:0,specialties:[],whatsapp:phone}).select().single();
    setLoading(false);
    if(error||!data){setErr("Error creando cuenta. Inténtalo de nuevo.");return;}
    localStorage.setItem("oy_user",JSON.stringify(data));
    onLogin(data as UserRow);
  };

  return (
    <div style={{minHeight:"100dvh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px",backgroundImage:"radial-gradient(ellipse at 20% 0%,#2a0a5a22,transparent 55%),radial-gradient(ellipse at 80% 100%,#0a2a4a22,transparent 55%)"}}>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:54,height:54,borderRadius:16,background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 12px",boxShadow:"0 8px 28px "+C.accent+"44"}}>🔨</div>
          <h1 style={{fontWeight:900,fontSize:28,letterSpacing:"-0.03em",marginBottom:4}}><span style={{color:C.text}}>Oficio</span><span style={{color:C.accent}}>Ya</span></h1>
          <p style={{fontSize:13,color:C.muted}}>Profesionales verificados en tu zona · Sevilla</p>
        </div>
        <div style={{display:"flex",background:C.card,borderRadius:10,padding:4,border:"1px solid "+C.border,marginBottom:18}}>
          {(["login","register"] as const).map(m=>(
            <button key={m} onClick={()=>{setMode(m);setErr("");setStep(1);}} style={{flex:1,padding:"9px",borderRadius:8,border:"none",background:mode===m?"linear-gradient(135deg,"+C.accent+","+C.orange+")":"transparent",color:mode===m?"#000":C.muted,fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",transition:"all 0.2s"}}>
              {m==="login"?"Iniciar sesión":"Crear cuenta"}
            </button>
          ))}
        </div>
        <GCard>
          {err&&<div style={{color:C.red,fontSize:13,marginBottom:12,padding:"10px 12px",background:C.red+"15",borderRadius:8,border:"1px solid "+C.red+"33"}}>{err}</div>}
          {mode==="login"&&(<>
            <Inp label="Email" value={email} onChange={setEmail} type="email" placeholder="tu@email.com" />
            <Inp label="Contraseña" value={pass} onChange={setPass} type="password" placeholder="••••••••" />
            <Btn full disabled={loading} onClick={login}>{loading?"Entrando...":"Entrar →"}</Btn>
            <div style={{margin:"14px 0",display:"flex",alignItems:"center",gap:10}}>
              <div style={{flex:1,height:1,background:C.border}} /><span style={{fontSize:10,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Demo</span><div style={{flex:1,height:1,background:C.border}} />
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
              <Btn outline small onClick={()=>demoLogin("cliente")} color={C.blue} disabled={loading}>👤 Demo Cliente</Btn>
              <Btn outline small onClick={()=>demoLogin("profesional")} color={C.accent} disabled={loading}>🔨 Demo Pro</Btn>
            </div>
            <p style={{textAlign:"center",fontSize:11,color:C.muted}}>Admin: admin@oficioya.es / Admin2026!</p>
          </>)}
          {mode==="register"&&(<>
            <div style={{display:"flex",gap:5,marginBottom:16,justifyContent:"center"}}>
              {[1,2,3].map(s=><div key={s} style={{width:s===step?24:7,height:7,borderRadius:99,background:s===step?C.accent:s<step?C.green:C.border,transition:"all 0.3s"}} />)}
            </div>
            {step===1&&(<>
              <p style={{fontWeight:700,color:C.text,marginBottom:12,fontSize:14}}>¿Cómo vas a usar OfficioYa?</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                {(["cliente","profesional"] as const).map(t=>(
                  <div key={t} onClick={()=>setUType(t)} style={{padding:"16px 10px",borderRadius:12,border:"2px solid "+(uType===t?C.accent:C.border),background:uType===t?C.accent+"15":C.surface,cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}>
                    <div style={{fontSize:24,marginBottom:6}}>{t==="cliente"?"🏠":"🔨"}</div>
                    <div style={{fontWeight:700,fontSize:13,color:uType===t?C.accent:C.text}}>{t==="cliente"?"Soy cliente":"Soy profesional"}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:3}}>{t==="cliente"?"Busco profesionales":"Ofrezco servicios"}</div>
                  </div>
                ))}
              </div>
              <Btn full onClick={()=>setStep(2)}>Siguiente →</Btn>
            </>)}
            {step===2&&(<>
              <p style={{fontWeight:700,color:C.text,marginBottom:12,fontSize:14}}>Tus datos</p>
              <Inp label="Nombre completo" value={name} onChange={setName} placeholder="Tu nombre" required />
              <Inp label="Email" value={email} onChange={setEmail} type="email" placeholder="tu@email.com" required />
              <Inp label="Teléfono / WhatsApp" value={phone} onChange={setPhone} placeholder="+34 600 000 000" required />
              <Inp label="Contraseña" value={pass} onChange={setPass} type="password" placeholder="Mínimo 6 caracteres" required />
              {uType==="profesional"&&<>
                <div style={{marginBottom:14}}>
                  <p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Tu oficio</p>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {OFICIOS.map(o=><button key={o} onClick={()=>setTrade(o)} style={{padding:"6px 12px",borderRadius:99,border:"1px solid "+(trade===o?C.accent:C.border),background:trade===o?C.accent+"22":"transparent",color:trade===o?C.accent:C.muted,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:trade===o?700:400,transition:"all 0.15s"}}>{OFICIO_ICONS[o]} {o}</button>)}
                  </div>
                </div>
                <div style={{marginBottom:14}}>
                  <p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Ciudad principal</p>
                  <select value={zone} onChange={e=>setZone(e.target.value)} style={{width:"100%",background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"11px 14px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none",cursor:"pointer"}}>
                    {ZONAS.map(z=><option key={z} style={{background:C.card}}>{z}</option>)}
                  </select>
                </div>
              </>}
              <div style={{display:"flex",gap:8}}>
                <Btn outline small onClick={()=>setStep(1)} color={C.muted}>← Atrás</Btn>
                <div style={{flex:1}}><Btn full onClick={()=>{if(!name||!email||!phone||!pass){setErr("Rellena todos los campos.");return;}setErr("");setStep(3);}}>Siguiente →</Btn></div>
              </div>
            </>)}
            {step===3&&(<>
              <p style={{fontWeight:700,color:C.text,marginBottom:4,fontSize:14}}>Elige tu plan</p>
              <p style={{fontSize:12,color:C.muted,marginBottom:14}}>30 días gratis · Sin tarjeta · Cancela cuando quieras</p>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
                {(uType==="profesional"?["gratis","basico","pro","elite"]:["gratis"] as Plan[]).map(p=>{
                  const pl=p as Plan;const col=PLAN_COLORS[pl];
                  return <div key={pl} onClick={()=>setPlan(pl)} style={{padding:"12px 14px",borderRadius:10,border:"2px solid "+(plan===pl?col:C.border),background:plan===pl?col+"12":C.surface,cursor:"pointer",transition:"all 0.15s",position:"relative"}}>
                    {pl==="pro"&&<span style={{position:"absolute",top:-9,right:10,background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",color:"#000",borderRadius:99,padding:"1px 9px",fontSize:8,fontWeight:900}}>POPULAR</span>}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <span style={{fontWeight:800,fontSize:14,color:col}}>{pl.toUpperCase()}</span>
                      <span style={{fontWeight:700,fontSize:15,color:C.text}}>{PLAN_PRICES[pl]===0?"GRATIS":PLAN_PRICES[pl]+"€/mes"}</span>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                      {PLAN_FEATURES[pl].slice(0,3).map(f=><span key={f} style={{fontSize:10,color:C.mutedL}}>✓ {f}</span>)}
                      {PLAN_FEATURES[pl].length>3&&<span style={{fontSize:10,color:col}}>+{PLAN_FEATURES[pl].length-3} más</span>}
                    </div>
                  </div>;
                })}
              </div>
              <div style={{display:"flex",gap:8}}>
                <Btn outline small onClick={()=>setStep(2)} color={C.muted}>← Atrás</Btn>
                <div style={{flex:1}}><Btn full disabled={loading} onClick={register}>{loading?"Creando cuenta...":"Crear cuenta →"}</Btn></div>
              </div>
            </>)}
          </>)}
        </GCard>
        <p style={{textAlign:"center",fontSize:11,color:C.muted,marginTop:14}}>Al continuar aceptas los Términos de Uso y la Política de Privacidad</p>
      </div>
    </div>
  );
}

// ─── WORKER CARD ───
function WorkerCard({w,onClick}:{w:UserRow;onClick:()=>void}){
  const col=wColor(w.id);
  const badges=[];
  if(w.free_quote) badges.push({t:"Presupuesto gratis",c:C.green});
  if(w.response_time&&w.response_time.includes("1h")) badges.push({t:"Responde en 1h",c:C.cyan});
  if(w.schedule&&w.schedule.includes("24h")) badges.push({t:"Urgencias 24h",c:C.red});
  return (
    <GCard onClick={onClick} glow={col} style={{position:"relative",overflow:"hidden",padding:16}}>
      <div style={{position:"absolute",top:-20,right:-20,width:70,height:70,borderRadius:"50%",background:"radial-gradient(circle,"+col+"15,transparent 70%)",pointerEvents:"none"}} />
      <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
        {w.plan==="elite"&&<Badge plan="elite" />}
        {w.plan==="pro"&&<Badge plan="pro" />}
        {badges.slice(0,2).map(b=><span key={b.t} style={{padding:"2px 7px",borderRadius:4,fontSize:9,fontWeight:700,color:b.c,background:b.c+"18",border:"1px solid "+b.c+"33"}}>{b.t}</span>)}
      </div>
      <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10}}>
        <Ava s={w.name.substring(0,2).toUpperCase()} size={46} color={col} online={w.available} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:2}}>
            <p style={{fontWeight:700,fontSize:15,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{w.name}</p>
            {w.verified&&<span style={{fontSize:10,color:C.green,flexShrink:0}}>✓</span>}
          </div>
          <p style={{fontSize:12,color:col,fontWeight:600,marginBottom:2}}>{OFICIO_ICONS[w.trade||""]||"🔧"} {w.trade}</p>
          <p style={{fontSize:11,color:C.muted}}>📍 {w.zone}{w.experience_years&&w.experience_years>0?" · "+w.experience_years+" años exp.":""}</p>
        </div>
      </div>
      <p style={{fontSize:12,color:C.mutedL,marginBottom:10,lineHeight:1.55,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{w.bio||"Profesional verificado con experiencia."}</p>
      {w.service_zones&&w.service_zones.length>0&&(
        <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
          {w.service_zones.slice(0,3).map(z=><span key={z} style={{fontSize:10,color:C.mutedL,background:C.surface,padding:"2px 7px",borderRadius:99,border:"1px solid "+C.border}}>📍{z}</span>)}
          {w.service_zones.length>3&&<span style={{fontSize:10,color:C.muted}}>+{w.service_zones.length-3}</span>}
        </div>
      )}
      <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8}}>
        <Stars n={w.rating} size={11} />
        <span style={{fontSize:11,color:C.text,fontWeight:700}}>{w.rating>0?w.rating.toFixed(1):"Nuevo"}</span>
        {w.reviews>0&&<span style={{fontSize:10,color:C.muted}}>({w.reviews} reseñas)</span>}
        {w.jobs>0&&<span style={{fontSize:10,color:C.muted}}>· {w.jobs} trabajos</span>}
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:8,borderTop:"1px solid "+C.border}}>
        <div>
          <span style={{fontWeight:800,fontSize:20,color:C.accent}}>{w.price}€</span>
          <span style={{fontSize:11,color:C.muted}}>/h</span>
          {w.free_quote&&<span style={{fontSize:10,color:C.green,marginLeft:6}}>· Presupuesto gratis</span>}
        </div>
        <div style={{display:"flex",gap:5,alignItems:"center"}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:w.available?C.green:C.red,display:"inline-block"}} />
          <span style={{fontSize:11,color:w.available?C.green:C.red,fontWeight:600}}>{w.available?"Disponible":"Ocupado"}</span>
        </div>
      </div>
    </GCard>
  );
}

// El resto del código (WorkerSheet, ChatPanel, ClientHome, ProDashboard, Admin, QuickMatchModal, SevillaMap, RankingSection, etc.) es exactamente el mismo que me pasaste en el archivo original.

export default function App(){
  const [user,setUser]=useState<UserRow|null>(null);
  const [ready,setReady]=useState(false);

  useEffect(()=>{
    const s=localStorage.getItem("oy_user");
    if(s){try{setUser(JSON.parse(s));}catch{localStorage.removeItem("oy_user");}}
    setReady(true);
    db.from("visits").insert({page:"home",user_id:null}).then(()=>{});
  },[]);

  const login=(u:UserRow)=>{setUser(u);localStorage.setItem("oy_user",JSON.stringify(u));};
  const logout=()=>{setUser(null);localStorage.removeItem("oy_user");};
  const update=(u:UserRow)=>{setUser(u);localStorage.setItem("oy_user",JSON.stringify(u));};

  if(!ready) return <div style={{minHeight:"100dvh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><Spin /></div>;

  return (<>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
      *{box-sizing:border-box;margin:0;padding:0;}
      html{overflow-x:hidden;background:#0A0A0F;}
      body{background:#0A0A0F;color:#F0F0FA;font-family:'DM Sans',sans-serif;overflow-x:hidden;min-height:100dvh;}
      #root{min-height:100dvh;background:#0A0A0F;}
      input,textarea,select{box-sizing:border-box;}
      input::placeholder,textarea::placeholder{color:#44445A;}
      select option{background:#16161F;color:#F0F0FA;}
      ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#1E1E30;border-radius:99px;}
      @keyframes spin{to{transform:rotate(360deg);}}
      @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}
    `}</style>
    {!user&&<Auth onLogin={login} />}
    {user&&user.type==="admin"&&<Admin onLogout={logout} />}
    {user&&user.type==="profesional"&&<ProDashboard user={user} onLogout={logout} onUpdate={update} />}
    {user&&user.type==="cliente"&&<ClientHome user={user} onLogout={logout} />}
  </>);
}
