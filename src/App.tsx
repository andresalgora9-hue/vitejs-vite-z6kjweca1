import React, { useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { db, STORAGE_URL } from "./supabase";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { UserRow, MessageRow, JobRow, CertRow, Plan, PhotoRow, LeadLogRow } from "./supabase";

const C = {
  bg:"#0A0A0F", surface:"#111118", card:"#16161F", cardHover:"#1C1C2A",
  border:"#1E1E30", accent:"#FFD700", orange:"#FF8C00",
  red:"#FF4455", green:"#00D68F", blue:"#3B82F6", purple:"#8B5CF6",
  cyan:"#06B6D4", pink:"#EC4899",
  text:"#F0F0FA", muted:"#44445A", mutedL:"#7777AA",
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
const PLAN_COLORS:Record<Plan,string> = {gratis:"#7777AA",basico:"#3B82F6",pro:"#FFD700",elite:"#FF8C00"};
const PLAN_PRICES:Record<Plan,number> = {gratis:0,basico:9.99,pro:24.99,elite:49.99};
const PLAN_FEATURES:Record<Plan,string[]> = {
  gratis:["Perfil básico","5 contactos/mes","Visible en búsquedas"],
  basico:["Perfil completo","20 contactos/mes","✓ Badge verificado","Estadísticas básicas","Chat con clientes","Galería 5 fotos","Gestión de trabajos"],
  pro:["Perfil destacado","Contactos ilimitados","✓✓ Badge PRO","Estadísticas avanzadas","Chat directo","Galería ilimitada","Primero en búsquedas","Panel de trabajos completo","Ranking público","Zonas de servicio múltiples"],
  elite:["Todo lo de Pro","⭐ Badge ÉLITE","Anuncios en portada","Top garantizado #1","Gestor reseñas avanzado","Facturación integrada","Soporte 24h","API de integración"],
};

const PLAN_GATES = {
  statsLevel: {gratis:0, basico:1, pro:2, elite:3} as Record<Plan,number>,
  contacts: {gratis:5, basico:15, pro:999, elite:999} as Record<Plan,number>,
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
function Sheet({children,onClose,title}:{children:ReactNode;onClose:()=>void;title?:string}){
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
function WorkerCard({w,onClick}:any){
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

// ─── WORKER DETAIL SHEET ───
function WorkerSheet({worker,onClose,onChat,onWhatsApp,currentUser}:{worker:UserRow;onClose:()=>void;onChat:(w:UserRow)=>void;onWhatsApp:(w:UserRow)=>void;currentUser:UserRow|null}){
  const [tab,setTab]=useState<"info"|"fotos"|"reviews"|"certs">("info");
  const [reviews,setReviews]=useState<any[]>([]);
  const [certs,setCerts]=useState<CertRow[]>([]);
  const [photos,setPhotos]=useState<PhotoRow[]>([]);
  const [leadsCount,setLeadsCount]=useState(0);
  const [isBlocked,setIsBlocked]=useState(false);
  const [hasContacted,setHasContacted]=useState(false);
  const [loadingLeads,setLoadingLeads]=useState(true);
  const [newRev,setNewRev]=useState("");
  const [selStars,setSelStars]=useState(5);
  const [saving,setSaving]=useState(false);
  const col=wColor(worker.id);

  const month = new Date().toISOString().substring(0,7);

  useEffect(()=>{
    const loadInfo=async()=>{
      setLoadingLeads(true);
      try {
        const [revs, cs, phs, leadsResult] = await Promise.all([
          db.from("reviews").select("*").eq("worker_id",worker.id).order("created_at",{ascending:false}),
          db.from("certificates").select("*").eq("worker_id",worker.id),
          db.from("photos").select("*").eq("worker_id",worker.id).order("created_at",{ascending:false}),
          db.from("leads_log").select("visitor_id").eq("pro_id",worker.id).eq("month",month).eq("blocked",false)
        ]);
        
        setReviews(revs.data||[]);
        setCerts(cs.data||[]);
        setPhotos(phs.data||[]);
        
        const uniqueLeads = new Set(leadsResult.data?.map(l=>l.visitor_id)).size;
        setLeadsCount(uniqueLeads);

        if(currentUser){
          // Check if I already have a lead or a chat
          const myLead = leadsResult.data?.some(l=>l.visitor_id===currentUser.id);
          const {count:msgs} = await db.from("messages").select("id",{count:"exact"}).or(`and(from_id.eq.${currentUser.id},to_id.eq.${worker.id}),and(from_id.eq.${worker.id},to_id.eq.${currentUser.id})`);
          const contacted = !!myLead || (msgs||0)>0;
          setHasContacted(contacted);

          const limit = PLAN_GATES.contacts[worker.plan as Plan];
          if(!contacted && uniqueLeads >= limit){
            setIsBlocked(true);
          }
        }
      } catch (e) {
        console.error("Error loading worker data", e);
      } finally {
        setLoadingLeads(false);
      }
    };
    loadInfo();
    db.from("visits").insert({page:"worker_"+worker.id,user_id:currentUser?.id||null}).then(()=>{});
  },[worker.id,currentUser,month]);

  const recordLead=async(type:'whatsapp'|'call'|'message')=>{
    if(!currentUser||hasContacted) return;
    await db.from("leads_log").insert({
      pro_id: worker.id,
      visitor_id: currentUser.id,
      visitor_zone: currentUser.zone||"Sevilla",
      type,
      blocked: isBlocked,
      month
    });
    if(!isBlocked) setHasContacted(true);
  };

  const submitReview=async()=>{
    if(!currentUser||!newRev.trim()) return;
    setSaving(true);
    const {data}=await db.from("reviews").insert({worker_id:worker.id,client_id:currentUser.id,client_name:currentUser.name,stars:selStars,text:newRev}).select().single();
    if(data) setReviews(p=>[data,...p]);
    setNewRev(""); setSaving(false);
  };

  const onHandleChat=()=>{ recordLead('message'); if(!isBlocked) onChat(worker); };
  const onHandleWhatsApp=()=>{ recordLead('whatsapp'); if(!isBlocked) onWhatsApp(worker); };

  const avgRating=reviews.length>0?reviews.reduce((s,r)=>s+r.stars,0)/reviews.length:worker.rating;

  return (
    <Sheet onClose={onClose}>
      <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:14}}>
        <Ava s={worker.name.substring(0,2).toUpperCase()} size={58} color={col} online={worker.available} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap",marginBottom:3}}>
            <p style={{fontWeight:800,fontSize:19,color:C.text}}>{worker.name}</p>
            {worker.verified&&<span style={{fontSize:10,color:C.green,border:"1px solid "+C.green+"44",padding:"1px 6px",borderRadius:99}}>✓ Verificado</span>}
            <Badge plan={worker.plan} />
          </div>
          <p style={{color:col,fontWeight:600,fontSize:13,marginBottom:3}}>{OFICIO_ICONS[worker.trade||""]||"🔧"} {worker.trade} · {worker.zone}</p>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <Stars n={avgRating} size={12} />
            <span style={{fontSize:12,color:C.text,fontWeight:700}}>{avgRating>0?avgRating.toFixed(1):"Nuevo"}</span>
            {reviews.length>0&&<span style={{fontSize:11,color:C.muted}}>({reviews.length} reseñas)</span>}
          </div>
        </div>
        <button onClick={onClose} style={{background:"none",border:"1px solid "+C.border,borderRadius:8,color:C.muted,cursor:"pointer",padding:"5px 10px",fontSize:14,flexShrink:0}}>✕</button>
      </div>

      {loadingLeads ? <Spin /> : (
        isBlocked ? (
          <div style={{background:C.red+"15",border:"1px solid "+C.red+"33",borderRadius:12,padding:16,textAlign:"center",marginBottom:14}}>
            <p style={{fontSize:24,marginBottom:8}}>🚫</p>
            <p style={{fontWeight:700,color:C.text,fontSize:14,marginBottom:4}}>Este profesional no está disponible ahora</p>
            <p style={{fontSize:12,color:C.mutedL}}>Ha alcanzado su límite de contactos mensual. Inténtalo con otro profesional verificado.</p>
          </div>
        ) : (
          currentUser&&currentUser.type==="cliente"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
              <Btn full onClick={onHandleChat} color={C.accent}>💬 Mensaje</Btn>
              <button onClick={onHandleWhatsApp} style={{padding:"12px",background:"#25D366"+"22",border:"1px solid #25D366"+"55",borderRadius:10,color:"#25D366",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer"}}>📱 WhatsApp</button>
            </div>
          )
        )
      )}
      {!currentUser&&<div style={{padding:"12px",background:C.surface,borderRadius:10,border:"1px solid "+C.border,textAlign:"center",marginBottom:14}}><p style={{fontSize:13,color:C.muted}}>Regístrate gratis para contactar</p></div>}

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
        {[{l:"Trabajos",v:String(worker.jobs)},{l:"Precio/h",v:(worker.price||30)+"€"},{l:"Valoración",v:avgRating>0?avgRating.toFixed(1)+"★":"Nuevo"}].map(s=>(
          <div key={s.l} style={{background:"linear-gradient(135deg,"+col+"15,transparent)",borderRadius:10,padding:"10px 6px",textAlign:"center",border:"1px solid "+col+"25"}}>
            <p style={{fontWeight:800,fontSize:18,color:col}}>{s.v}</p>
            <p style={{fontSize:10,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.06em"}}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* Service zones */}
      {worker.service_zones&&worker.service_zones.length>0&&(
        <div style={{marginBottom:14,padding:"10px 12px",background:C.surface,borderRadius:8,border:"1px solid "+C.border}}>
          <p style={{fontSize:11,color:C.muted,marginBottom:6,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.06em"}}>Zonas de servicio</p>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {worker.service_zones.map(z=><span key={z} style={{fontSize:11,color:C.mutedL,background:C.card,padding:"3px 9px",borderRadius:99,border:"1px solid "+C.border}}>📍{z}</span>)}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto"}}>
        {(["info","fotos","reviews","certs"] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{flexShrink:0,padding:"7px 12px",borderRadius:8,border:"1px solid "+(tab===t?col:C.border),background:tab===t?col+"20":"transparent",color:tab===t?col:C.muted,fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"uppercase" as const,letterSpacing:"0.06em",transition:"all 0.15s"}}>
            {t==="info"?"Sobre mí":t==="fotos"?("Fotos ("+photos.length+")"):t==="reviews"?("Reseñas ("+reviews.length+")"):"Títulos"}
          </button>
        ))}
      </div>

      {tab==="info"&&(<>
        <p style={{fontSize:13,color:C.mutedL,lineHeight:1.75,marginBottom:12}}>{worker.bio||"Profesional con experiencia contrastada. Presupuesto sin compromiso."}</p>
        {worker.specialties&&worker.specialties.length>0&&(
          <div>
            <p style={{fontSize:11,color:C.muted,marginBottom:6,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.06em"}}>Especialidades</p>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{worker.specialties.map(s=><span key={s} style={{fontSize:11,color:col,background:col+"15",padding:"3px 9px",borderRadius:99,border:"1px solid "+col+"33"}}>{s}</span>)}</div>
          </div>
        )}
      </>)}

      {tab==="fotos"&&(
        photos.length===0?<div style={{textAlign:"center",padding:"32px 0",color:C.muted}}>
          <p style={{fontSize:32,marginBottom:8}}>📸</p>
          <p style={{fontSize:13}}>Este profesional no ha subido fotos aún</p>
        </div>:
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
          {photos.map(p=>(
            <div key={p.id} style={{borderRadius:10,overflow:"hidden",border:"1px solid "+C.border,background:C.surface,aspectRatio:"4/3",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:C.muted,padding:8}}>
              {p.url?<img src={p.url} alt={p.caption} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={(e:any)=>{e.target.style.display="none";}} />:<span style={{textAlign:"center"}}>{p.caption||"Foto de trabajo"}</span>}
            </div>
          ))}
        </div>
      )}

      {tab==="reviews"&&(<>
        {currentUser&&currentUser.type==="cliente"&&(
          <GCard style={{marginBottom:12,padding:14}}>
            <p style={{color:C.text,fontSize:12,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Tu reseña</p>
            <Stars n={selStars} size={22} interactive onSet={setSelStars} />
            <div style={{marginTop:8}}><Inp label="" value={newRev} onChange={setNewRev} placeholder="Cuéntanos tu experiencia..." multiline /></div>
            <Btn full small disabled={saving} onClick={submitReview}>{saving?"Publicando...":"Publicar reseña"}</Btn>
          </GCard>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {reviews.map(r=>(
            <GCard key={r.id} style={{padding:12}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:col+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:col}}>{r.client_name[0]}</div>
                <div style={{flex:1}}><p style={{fontSize:13,fontWeight:700,color:C.text}}>{r.client_name}</p><p style={{fontSize:10,color:C.muted}}>{timeAgo(r.created_at)}</p></div>
                <Stars n={r.stars} size={11} />
              </div>
              {(r.photo_url||r.photo)&&<img src={r.photo_url||r.photo} alt="foto" style={{width:"100%",maxHeight:140,objectFit:"cover",borderRadius:8,marginBottom:8,border:"1px solid "+C.border}} onError={(e:any)=>{e.target.style.display="none";}} />}
              <p style={{fontSize:13,color:C.mutedL,lineHeight:1.6}}>{r.text}</p>
            </GCard>
          ))}
          {reviews.length===0&&<p style={{textAlign:"center",color:C.muted,fontSize:13,padding:16}}>Sin reseñas aún · Sé el primero</p>}
        </div>
      </>)}

      {tab==="certs"&&(
        certs.length===0?<p style={{textAlign:"center",color:C.muted,fontSize:13,padding:16}}>No ha subido títulos todavía</p>:
        certs.map(c=>(
          <GCard key={c.id} style={{padding:12,marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:22}}>📜</span>
              <div style={{flex:1}}><p style={{fontWeight:700,color:C.text,fontSize:13}}>{c.name}</p><p style={{fontSize:10,color:C.muted}}>{new Date(c.created_at).toLocaleDateString("es-ES")}</p></div>
              {c.verified&&<span style={{fontSize:10,color:C.green,fontWeight:700}}>✓ Verificado</span>}
            </div>
          </GCard>
        ))
      )}
    </Sheet>
  );
}

// ─── CHAT ───
function ChatPanel({toUser,currentUser,onClose}:{toUser:UserRow;currentUser:UserRow;onClose:()=>void}){
  const [msgs,setMsgs]=useState<MessageRow[]>([]);
  const [input,setInput]=useState(""); const [sending,setSending]=useState(false);
  const bottomRef=useRef<HTMLDivElement>(null);
  const col=wColor(toUser.id);

  const loadMsgs=useCallback(async()=>{
    const {data}=await db.from("messages").select("*")
      .or(`and(from_id.eq.${currentUser.id},to_id.eq.${toUser.id}),and(from_id.eq.${toUser.id},to_id.eq.${currentUser.id})`)
      .order("created_at",{ascending:true});
    if(data&&data.length>0){setMsgs(data);}
    else setMsgs([{id:"w0",from_id:toUser.id,to_id:currentUser.id,text:"¡Hola! Soy "+toUser.name+". ¿En qué puedo ayudarte?",read:true,created_at:new Date().toISOString()}]);
  },[currentUser.id,toUser.id,toUser.name]);

  useEffect(()=>{loadMsgs();},[loadMsgs]);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs.length]);

  const send=async()=>{
    if(!input.trim()||sending) return;
    const txt=input; setInput(""); setSending(true);
    const {data}=await db.from("messages").insert({from_id:currentUser.id,to_id:toUser.id,text:txt,read:false}).select().single();
    if(data) setMsgs(p=>[...p,data]);
    setSending(false);
    if(toUser.email.includes("@demo.com")){
      setTimeout(async()=>{
        const rs=["Perfecto, puedo verte esta semana.","¿Me das más detalles?","Son "+toUser.price+"€/h. ¿Te parece bien?","Sin problema, tengo disponibilidad.","Te llamo en un momento."];
        const {data:d2}=await db.from("messages").insert({from_id:toUser.id,to_id:currentUser.id,text:rs[Math.floor(Math.random()*rs.length)],read:false}).select().single();
        if(d2) setMsgs(p=>[...p,d2]);
      },1200);
    }
  };

  return (
    <div style={{position:"fixed",bottom:0,right:0,width:"100%",maxWidth:360,height:420,background:"linear-gradient(170deg,#12121E,#080810)",borderRadius:"18px 18px 0 0",border:"1px solid "+col+"44",borderBottom:"none",boxShadow:"0 -6px 30px "+col+"15",zIndex:400,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"10px 14px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:10,background:col+"10",borderRadius:"18px 18px 0 0"}}>
        <Ava s={toUser.name.substring(0,2).toUpperCase()} size={32} color={col} online />
        <div style={{flex:1}}><p style={{fontWeight:700,fontSize:14,color:C.text}}>{toUser.name}</p><p style={{fontSize:10,color:C.green}}>● En línea</p></div>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18}}>✕</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"10px 12px",display:"flex",flexDirection:"column",gap:7}}>
        {msgs.map((m,i)=>{
          const isMe=m.from_id===currentUser.id;
          return <div key={i} style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"78%",background:isMe?col+"44":C.card,border:"1px solid "+(isMe?col+"55":C.border),borderRadius:isMe?"12px 12px 2px 12px":"12px 12px 12px 2px",padding:"8px 11px"}}>
              <p style={{fontSize:12,color:isMe?C.accent:C.text,lineHeight:1.5}}>{m.text}</p>
              <p style={{fontSize:9,color:C.muted,marginTop:2,textAlign:"right"}}>{timeAgo(m.created_at)}</p>
            </div>
          </div>;
        })}
        <div ref={bottomRef} />
      </div>
      <div style={{padding:"8px 12px",borderTop:"1px solid "+C.border,display:"flex",gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Escribe un mensaje..." style={{flex:1,background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"9px 12px",color:C.text,fontFamily:"inherit",fontSize:13,outline:"none"}} />
        <button onClick={send} disabled={sending} style={{padding:"8px 14px",background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",border:"none",borderRadius:8,color:"#000",fontWeight:900,cursor:"pointer",fontSize:14,opacity:sending?0.5:1}}>→</button>
      </div>
    </div>
  );
}

// ─── CLIENT HOME ───
function ClientHome({user,onLogout}:{user:UserRow;onLogout:()=>void}){
  const [tab,setTab]=useState<"buscar"|"ranking"|"chats"|"perfil">("buscar");
  const [zona,setZona]=useState("Todas");
  const [oficio,setOficio]=useState("Todos");
  const [search,setSearch]=useState("");
  const [soloDisp,setSoloDisp]=useState(false);
  const [catFilter,setCatFilter]=useState("Todos");
  const [showMap,setShowMap]=useState(false);
  const [showQuickMatch,setShowQuickMatch]=useState(false);
  const [workers,setWorkers]=useState<UserRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [selectedWorker,setSelectedWorker]=useState<UserRow|null>(null);
  const [chatWorker,setChatWorker]=useState<UserRow|null>(null);
  const [chatPartners,setChatPartners]=useState<UserRow[]>([]);
  const [toast,setToast]=useState<string|null>(null);
  const showToast=(m:string)=>{setToast(m);setTimeout(()=>setToast(null),3000);};

  const loadWorkers=useCallback(async()=>{
    setLoading(true);
    let q=db.from("users").select("*").eq("type","profesional");
    if(zona!=="Todas") q=q.or(`zone.eq."${zona}",service_zones.cs.{"${zona}"}`);
    if(oficio!=="Todos") q=q.eq("trade",oficio);
    if(soloDisp) q=q.eq("available",true);
    if(search) q=q.ilike("name","%"+search+"%");
    const {data}=await q;
    const sorted=(data||[]).sort((a:UserRow,b:UserRow)=>{
      const order:Record<Plan,number>={elite:3,pro:2,basico:1,gratis:0};
      return order[b.plan as Plan]-order[a.plan as Plan]||b.rating-a.rating;
    });
    setWorkers(sorted); setLoading(false);
  },[zona,oficio,search,soloDisp]);

  useEffect(()=>{loadWorkers();},[loadWorkers]);

  const loadChats=useCallback(async()=>{
    const {data}=await db.from("messages").select("from_id,to_id").or("from_id.eq."+user.id+",to_id.eq."+user.id);
    if(!data?.length){setChatPartners([]);return;}
    const ids=[...new Set((data as any[]).map((m:any)=>m.from_id===user.id?m.to_id:m.from_id))];
    const {data:ws}=await db.from("users").select("*").in("id",ids);
    setChatPartners(ws||[]);
  },[user.id]);

  useEffect(()=>{if(tab==="chats")loadChats();},[tab,loadChats]);

  const handleWhatsApp=(w:UserRow)=>{
    const num=(w.whatsapp||w.phone).replace(/\D/g,"");
    const msg=encodeURIComponent("Hola "+w.name+", te contacto desde OfficioYa. Me gustaría solicitar un presupuesto.");
    window.open("https://wa.me/"+num+"?text="+msg,"_blank");
  };

  return (
    <div style={{minHeight:"100dvh",background:C.bg,backgroundImage:"radial-gradient(ellipse at 15% 0%,#1a0a3a22,transparent 50%),radial-gradient(ellipse at 85% 100%,#0a1a3a22,transparent 50%)",paddingBottom:72}}>
      <header style={{background:"rgba(10,10,15,0.94)",backdropFilter:"blur(20px)",borderBottom:"1px solid "+C.border,position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 20px rgba(0,0,0,0.4)"}}>
        <div style={{maxWidth:900,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
          <button onClick={()=>setTab("buscar")} style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"pointer",padding:0}}>
            <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🔨</div>
            <span style={{fontWeight:900,fontSize:19,letterSpacing:"-0.03em"}}><span style={{color:C.text}}>Oficio</span><span style={{color:C.accent}}>Ya</span></span>
            <span style={{fontSize:9,color:C.accent,background:C.accent+"15",padding:"2px 7px",borderRadius:3,fontWeight:700}}>SEVILLA</span>
          </button>
          <div style={{display:"flex",gap:10}}>
            <button onClick={()=>setShowQuickMatch(true)} style={{background:C.accent+"15",border:"1px solid "+C.accent+"33",borderRadius:6,color:C.accent,cursor:"pointer",padding:"4px 12px",fontSize:11,fontWeight:800}}>⚡ Mágico</button>
            <button onClick={onLogout} style={{background:"none",border:"1px solid "+C.border,borderRadius:6,color:C.muted,cursor:"pointer",padding:"4px 10px",fontSize:11}}>Salir</button>
          </div>
        </div>
      </header>

      <div style={{maxWidth:900,margin:"0 auto",padding:"0 16px"}}>
        {tab==="buscar"&&(<>
          <div style={{padding:"22px 0 16px"}}>
            <div style={{display:"inline-flex",gap:6,background:C.green+"15",border:"1px solid "+C.green+"30",borderRadius:6,padding:"4px 12px",marginBottom:12}}>
              <span style={{fontSize:8,color:C.green}}>●</span>
              <span style={{fontSize:11,color:C.green,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase" as const}}>{workers.filter(w=>w.available).length} disponibles ahora</span>
            </div>
            <h2 style={{fontWeight:900,fontSize:26,lineHeight:1.1,letterSpacing:"-0.02em",marginBottom:8,color:C.text}}>Encuentra al profesional ideal en Sevilla</h2>
            <p style={{fontSize:14,color:C.mutedL}}>Presupuesto gratis · Sin compromiso · Pago directo al profesional</p>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
            <div style={{display:"flex",background:C.card,borderRadius:10,border:"1px solid "+C.border,overflow:"hidden"}}>
              <span style={{padding:"0 12px",display:"flex",alignItems:"center",color:C.muted}}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Electricista, fontanero, pintor..." style={{flex:1,padding:"12px 0",background:"transparent",border:"none",color:C.text,fontFamily:"inherit",fontSize:14,outline:"none"}} />
              <button onClick={()=>setShowMap(!showMap)} style={{padding:"0 15px",background:showMap?C.accent:C.border,color:showMap?"#000":C.mutedL,border:"none",fontWeight:800,fontSize:11,cursor:"pointer",transition:"all 0.2s"}}>🗺 {showMap?"Ocultar Map":"Ver Mapa"}</button>
            </div>
            
            {showMap && <SevillaMap selectedZone={zona} onZoneSelect={z=>setZona(z||"Todas")} />}

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

          <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:14}}>
            {["Todos","⚡ Técnico","🌿 Servicios","🏺 Artesanía","👨‍🍳 Hostelería","🎪 Eventos"].map(cat=>(
              <button key={cat} onClick={()=>{setCatFilter(cat);setOficio("Todos");}} style={{flexShrink:0,padding:"6px 14px",borderRadius:99,border:"1px solid "+(catFilter===cat?C.accent:C.border),background:catFilter===cat?C.accent+"18":"transparent",color:catFilter===cat?C.accent:C.muted,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:catFilter===cat?700:400,whiteSpace:"nowrap"}}>
                {cat}
              </button>
            ))}
          </div>

          {loading?<Spin />:(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
              {workers.map(w=><WorkerCard key={w.id} w={w} onClick={()=>setSelectedWorker(w)} />)}
              {workers.length===0&&<p style={{textAlign:"center",color:C.muted,padding:40,gridColumn:"1/-1"}}>No se encuentran profesionales con estos filtros.</p>}
            </div>
          )}
        </>)}

        {tab==="ranking"&&(<>
          <div style={{padding:"22px 0 16px"}}><h2 style={{fontWeight:800,fontSize:22,color:C.text}}>🏆 Ranking de Profesores</h2></div>
          <RankingSection workers={workers} onSelect={setSelectedWorker} />
        </>)}

        {tab==="chats"&&(<>
          <div style={{padding:"22px 0 16px"}}><h2 style={{fontWeight:800,fontSize:22,color:C.text}}>Mis conversaciones</h2></div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {chatPartners.map(w=><GCard key={w.id} onClick={()=>setChatWorker(w)} glow={wColor(w.id)}>
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                <Ava s={w.name.substring(0,2).toUpperCase()} size={42} color={wColor(w.id)} />
                <div style={{flex:1}}><p style={{fontWeight:700,color:C.text}}>{w.name}</p><p style={{fontSize:12,color:C.muted}}>{w.trade}</p></div>
              </div>
            </GCard>)}
            {chatPartners.length===0&&<p style={{color:C.muted,textAlign:"center",padding:40}}>No tienes chats abiertos.</p>}
          </div>
        </>)}

        {tab==="perfil"&&(<>
           <div style={{padding:"22px 0 16px"}}><h2 style={{fontWeight:800,fontSize:22,color:C.text}}>Mi perfil</h2></div>
           <GCard>
              <p style={{fontWeight:800,fontSize:18,color:C.text,marginBottom:4}}>{user.name}</p>
              <p style={{color:C.muted,fontSize:13}}>{user.email}</p>
              <div style={{marginTop:10}}><Badge plan={user.plan} /></div>
           </GCard>
        </>)}
      </div>

      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(10,10,15,0.97)",backdropFilter:"blur(20px)",borderTop:"1px solid "+C.border,display:"flex",zIndex:200,height:72,justifyContent:"space-around",alignItems:"center"}}>
        {(["buscar","ranking","chats","perfil"] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{background:"none",border:"none",color:tab===t?C.accent:C.muted,fontSize:11,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <span style={{fontSize:20}}>{t==="buscar"?"🔍":t==="ranking"?"🏆":t==="chats"?"💬":"👤"}</span>
            <span style={{textTransform:"capitalize"}}>{t}</span>
          </button>
        ))}
      </nav>

      {selectedWorker&&<WorkerSheet worker={selectedWorker} onClose={()=>setSelectedWorker(null)} onChat={w=>{setChatWorker(w);setSelectedWorker(null);}} onWhatsApp={handleWhatsApp} currentUser={user} />}
      {chatWorker&&<ChatPanel toUser={chatWorker} currentUser={user} onClose={()=>setChatWorker(null)} />}
      {showQuickMatch && <QuickMatchModal workers={workers} onClose={()=>setShowQuickMatch(false)} onSelect={(w)=>{setSelectedWorker(w);setShowQuickMatch(false);}} />}
    </div>
  );
}

// ─── PRO DASHBOARD ───
function ProDashboard({user,onLogout,onUpdate}:{user:UserRow;onLogout:()=>void;onUpdate:(u:UserRow)=>void}){
  const [tab,setTab]=useState<"inicio"|"chats"|"trabajos"|"perfil"|"planes">("inicio");
  const [leads,setLeads]=useState<LeadLogRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [toast,setToast]=useState<string|null>(null);
  const [saving,setSaving]=useState(false);
  const [bio,setBio]=useState(user.bio||"");
  const [price,setPrice]=useState(String(user.price||30));
  const [available,setAvailable]=useState(user.available);
  const [schedule,setSchedule]=useState(user.schedule||"Lunes a Viernes");
  const [responseTime,setResponseTime]=useState(user.response_time||"24h");
  const [freeQuote,setFreeQuote]=useState(user.free_quote!==false);
  const [expYears,setExpYears]=useState(String(user.experience_years||0));
  const [specialties,setSpecialties]=useState<string[]>(user.specialties||[]);
  const [serviceZones,setServiceZones]=useState<string[]>(user.service_zones||[]);
  const [whatsapp,setWhatsapp]=useState(user.whatsapp||user.phone||"");
  const [certs,setCerts]=useState<CertRow[]>([]);
  const [certName,setCertName]=useState("");
  const [photos,setPhotos]=useState<PhotoRow[]>([]);
  const [photoCaption,setPhotoCaption]=useState("");
  const [jobs,setJobs]=useState<JobRow[]>([]);
  const [chatPartners,setChatPartners]=useState<UserRow[]>([]);
  const [chatUser,setChatUser]=useState<UserRow|null>(null);
  const [stats,setStats]=useState({visits:0,contacts:0,reviews:0});
  
  const month = new Date().toISOString().substring(0,7);
  const daysLeft=trialDaysLeft(user.trial_end);
  const showToast=(m:string)=>{setToast(m);setTimeout(()=>setToast(null),3000);};
  const canAccess=(feat:string)=>PLAN_FEATURES[user.plan].some(f=>f.toLowerCase().includes(feat.toLowerCase()));

  const leadsUsed = new Set(leads.filter(l=>!l.blocked).map(l=>l.visitor_id)).size;
  const leadLimit = PLAN_GATES.contacts[user.plan as Plan];
  const blockedLeads = leads.filter(l=>l.blocked);

  useEffect(()=>{
    const loadData=async()=>{
      setLoading(true);
      const [cs, phs, jbs, vs, ms, rs, ld] = await Promise.all([
        db.from("certificates").select("*").eq("worker_id",user.id),
        db.from("photos").select("*").eq("worker_id",user.id).order("created_at",{ascending:false}),
        db.from("jobs").select("*").eq("worker_id",user.id).order("created_at",{ascending:false}),
        db.from("visits").select("id",{count:"exact"} as any).eq("user_id",user.id),
        db.from("messages").select("id",{count:"exact"} as any).eq("to_id",user.id),
        db.from("reviews").select("id",{count:"exact"} as any).eq("worker_id",user.id),
        db.from("leads_log").select("*").eq("pro_id",user.id).eq("month",month).order("created_at",{ascending:false})
      ]);

      setCerts(cs.data||[]);
      setPhotos(phs.data||[]);
      setJobs(jbs.data||[]);
      setStats({visits:vs.count||0, contacts:ms.count||0, reviews:rs.count||0});
      setLeads(ld.data||[]);
      setLoading(false);
    };
    loadData();
  },[user.id,month]);

  const loadChats=useCallback(async()=>{
    const {data}=await db.from("messages").select("from_id").eq("to_id",user.id);
    if(!data?.length){setChatPartners([]);return;}
    const ids=[...new Set((data as any[]).map((m:any)=>m.from_id))];
    const {data:ws}=await db.from("users").select("*").in("id",ids);
    setChatPartners(ws||[]);
  },[user.id]);

  useEffect(()=>{if(tab==="chats")loadChats();},[tab,loadChats]);

  const saveProfile=async()=>{
    setSaving(true);
    const upd={bio,price:parseInt(price)||30,available,schedule,response_time:responseTime,free_quote:freeQuote,experience_years:parseInt(expYears)||0,specialties,service_zones:serviceZones,whatsapp};
    await db.from("users").update(upd).eq("id",user.id);
    onUpdate({...user,...upd});
    setSaving(false); showToast("✓ Perfil actualizado");
  };

  return (
    <div style={{minHeight:"100dvh",background:C.bg,paddingBottom:72}}>
      <header style={{background:C.card,padding:"10px 16px",borderBottom:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontWeight:900,color:C.text}}>OficioYa Pro</span>
        <button onClick={onLogout} style={{fontSize:11,color:C.muted}}>Cerrar sesión</button>
      </header>

      <div style={{padding:16,maxWidth:900,margin:"0 auto"}}>
        {tab==="inicio"&&(<>
           <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
             <GCard style={{textAlign:"center",padding:12}}>
               <p style={{fontSize:11,color:C.muted}}>Visitas</p>
               <p style={{fontSize:24,fontWeight:800,color:C.blue}}>{stats.visits}</p>
             </GCard>
             <GCard style={{textAlign:"center",padding:12}}>
               <p style={{fontSize:11,color:C.muted}}>Reseñas</p>
               <p style={{fontSize:24,fontWeight:800,color:C.accent}}>{stats.reviews}</p>
             </GCard>
           </div>

           {/* LEADS WIDGET */}
           <GCard glow={C.green} style={{marginBottom:16,padding:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <p style={{fontWeight:800,fontSize:15,color:C.text}}>Contactos de este mes</p>
                <Badge plan={user.plan} />
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:12,color:C.mutedL}}>{leadsUsed} de {leadLimit} leads usados</span>
                <span style={{fontSize:12,fontWeight:700,color:C.green}}>{Math.round(leadsUsed/leadLimit*100)}%</span>
              </div>
              <div style={{height:8,background:C.border,borderRadius:99,overflow:"hidden",marginBottom:14}}>
                <div style={{width:(Math.min(100,leadsUsed/leadLimit*100))+"%",height:"100%",background:"linear-gradient(90deg,"+C.green+","+C.blue+")",transition:"width 1s"}} />
              </div>
              {blockedLeads.length > 0 && (
                <div style={{background:C.orange+"15",border:"1px solid "+C.orange+"33",borderRadius:8,padding:10,marginBottom:14}}>
                  <p style={{fontSize:12,color:C.orange,fontWeight:700}}>⚠️ Tienes {blockedLeads.length} clientes bloqueados</p>
                  <p style={{fontSize:11,color:C.mutedL,marginTop:2}}>Has agotado tus leads. Mejora tu plan para contactar con ellos.</p>
                  <button onClick={()=>setTab("planes")} style={{marginTop:8,background:"none",border:"none",color:C.accent,fontSize:11,fontWeight:800,cursor:"pointer"}}>VER PLANES →</button>
                </div>
              )}

              {/* RECENT LEADS LIST */}
              <p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.06em",marginBottom:8,fontWeight:700}}>Últimos contactos</p>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {leads.slice(0,5).map(l=>(
                  <div key={l.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:l.blocked?C.red+"10":C.surface,borderRadius:8,border:"1px solid "+(l.blocked?C.red+"33":C.border)}}>
                     <span style={{fontSize:16}}>{l.type==='whatsapp'?'📱':'💬'}</span>
                     <div style={{flex:1}}>
                       <p style={{fontSize:12,fontWeight:700,color:l.blocked?C.red:C.text}}>{l.visitor_zone || 'Sevilla'}</p>
                       <p style={{fontSize:10,color:C.muted}}>{timeAgo(l.created_at)} · {l.type.toUpperCase()}</p>
                     </div>
                     {l.blocked && <span style={{fontSize:9,fontWeight:900,color:C.red,background:C.red+"22",padding:"2px 5px",borderRadius:4}}>BLOQUEADO</span>}
                  </div>
                ))}
                {leads.length===0 &&<p style={{fontSize:12,color:C.muted,textAlign:"center",padding:10}}>Aún no tienes contactos este mes.</p>}
              </div>
           </GCard>

           <div style={{display:"flex",flexDirection:"column",gap:10}}>
             <Btn full onClick={()=>setTab("perfil")}>Configurar Perfil →</Btn>
             <Btn full outline onClick={()=>setTab("planes")}>Mejorar mi Plan 💎</Btn>
           </div>
        </>)}

        {tab==="perfil"&&(<>
          <Inp label="Bio" value={bio} onChange={setBio} multiline />
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
             <Inp label="Precio/h" value={price} onChange={setPrice} type="number" />
             <Inp label="Años Exp." value={expYears} onChange={setExpYears} type="number" />
          </div>
          <Btn full onClick={saveProfile} disabled={saving}>{saving?"Guardando...":"Guardar Cambios"}</Btn>
        </>)}
      </div>

      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:C.card,borderTop:"1px solid "+C.border,display:"flex",zIndex:200,height:72,justifyContent:"space-around",alignItems:"center"}}>
        {(["inicio","chats","trabajos","perfil","planes"] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{background:"none",border:"none",color:tab===t?C.accent:C.muted,fontSize:10,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <span style={{fontSize:20}}>{t==="inicio"?"🏠":t==="chats"?"💬":t==="trabajos"?"🔨":t==="perfil"?"👤":"💎"}</span>
            <span style={{textTransform:"capitalize"}}>{t}</span>
          </button>
        ))}
      </nav>
      <Ping msg={toast} />
      {chatUser&&<ChatPanel toUser={chatUser} currentUser={user} onClose={()=>setChatUser(null)} />}
    </div>
  );
}

// ─── ADMIN CRM DASHBOARD ───
function Admin({onLogout}:{onLogout:()=>void}){
  type AdminTab = "overview"|"funnel"|"usuarios"|"registros"|"trabajos"|"mensajes"|"trafico";
  const [tab,setTab]=useState<AdminTab>("overview");
  const [users,setUsers]=useState<UserRow[]>([]);
  const [jobs,setJobs]=useState<JobRow[]>([]);
  const [msgs,setMsgs]=useState<MessageRow[]>([]);
  const [reviews,setReviews]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [period,setPeriod]=useState<"7d"|"30d"|"90d"|"all">("30d");

  // Filters
  const [filterType,setFilterType]=useState<"all"|"cliente"|"profesional">("all");
  const [filterPlan,setFilterPlan]=useState<"all"|Plan>("all");
  const [filterStatus,setFilterStatus]=useState<"all"|"paying"|"trial"|"expired">("all");
  const [filterZone,setFilterZone]=useState("all");
  const [filterTrade,setFilterTrade]=useState("all");
  const [filterSearch,setFilterSearch]=useState("");
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");

  // Detail panel
  const [selectedUser,setSelectedUser]=useState<UserRow|null>(null);
  const [supportMsg,setSupportMsg]=useState("");
  const [sendingMsg,setSendingMsg]=useState(false);

  useEffect(()=>{
    const load=async()=>{
      const [u,j,m,r]=await Promise.all([
        db.from("users").select("*").neq("type","admin").order("joined_at",{ascending:false}),
        db.from("jobs").select("*").order("created_at",{ascending:false}),
        db.from("messages").select("*").order("created_at",{ascending:false}),
        db.from("reviews").select("*").order("created_at",{ascending:false}),
      ]);
      setUsers((u.data||[]) as UserRow[]);
      setJobs((j.data||[]) as JobRow[]);
      setMsgs((m.data||[]) as MessageRow[]);
      setReviews((r.data||[]) as any[]);
      setLoading(false);
    };
    load();
  },[]);

  const payingUsers = users.filter(u=>u.type==="profesional"&&u.plan!=="gratis");
  const mrr = payingUsers.reduce((s,u)=>s+PLAN_PRICES[u.plan as Plan],0);

  return (
    <div style={{minHeight:"100dvh",background:C.bg,paddingBottom:72}}>
      <header style={{background:C.card,padding:"10px 16px",borderBottom:"1px solid "+C.border,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontWeight:900,color:C.accent}}>Admin CRM</span>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:11,color:C.green}}>MRR: {mrr}€</span>
          <button onClick={onLogout} style={{fontSize:11,color:C.muted}}>Salir</button>
        </div>
      </header>

      <div style={{padding:16,maxWidth:1100,margin:"0 auto"}}>
        {loading ? <Spin /> : (
          <>
            {tab==="overview"&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>
                 <GCard style={{textAlign:"center"}}>
                   <p style={{fontSize:11,color:C.muted}}>Usuarios Totales</p>
                   <p style={{fontSize:32,fontWeight:800,color:C.blue}}>{users.length}</p>
                 </GCard>
                 <GCard style={{textAlign:"center"}}>
                   <p style={{fontSize:11,color:C.muted}}>Profesionales</p>
                   <p style={{fontSize:32,fontWeight:800,color:C.accent}}>{users.filter(u=>u.type==="profesional").length}</p>
                 </GCard>
                 <GCard style={{textAlign:"center"}}>
                   <p style={{fontSize:11,color:C.muted}}>MRR Estimado</p>
                   <p style={{fontSize:32,fontWeight:800,color:C.green}}>{mrr}€</p>
                 </GCard>
              </div>
            )}
            {tab==="usuarios"&&(
               <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {users.map(u=>(
                    <GCard key={u.id} onClick={()=>setSelectedUser(u)}>
                       <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div>
                            <p style={{fontWeight:700}}>{u.name}</p>
                            <p style={{fontSize:12,color:C.muted}}>{u.email}</p>
                          </div>
                          <Badge plan={u.plan} />
                       </div>
                    </GCard>
                  ))}
               </div>
            )}
          </>
        )}
      </div>

      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:C.card,borderTop:"1px solid "+C.border,display:"flex",zIndex:200,height:72,justifyContent:"space-around",alignItems:"center",overflowX:"auto"}}>
        {(["overview","usuarios","registros","trabajos","mensajes","trafico"] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t as AdminTab)} style={{background:"none",border:"none",color:tab===t?C.accent:C.muted,fontSize:10,cursor:"pointer",padding:"0 10px"}}>
             {t.toUpperCase()}
          </button>
        ))}
      </nav>
    </div>
  );
}

// ─── ROOT ───
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

// ─── QUICK MATCH MODAL ───
function QuickMatchModal({workers,onClose,onSelect}:{workers:UserRow[];onClose:()=>void;onSelect:(w:UserRow)=>void}){
  const [step,setStep]=useState(0);
  const [trade,setTrade]=useState("");
  const [zone,setZone]=useState("");
  const [urgency,setUrgency]=useState<string>(""); void urgency;

  const topTrades = OFICIOS;
  
  const matches = workers.filter(w=>
    (!trade||w.trade===trade)&&
    (!zone||w.zone===zone||(w.service_zones||[]).includes(zone))&&
    w.available
  ).sort((a,b)=>b.rating-a.rating).slice(0,3);

  return (
    <Sheet onClose={onClose} title="⚡ Encuentra tu profesional">
      <div style={{display:"flex",gap:4,marginBottom:20}}>
        {[0,1,2,3].map(s=><div key={s} style={{flex:1,height:4,borderRadius:99,background:s<=step?C.accent:C.border,transition:"background 0.3s"}} />)}
      </div>

      {step===0&&(<>
        <p style={{fontWeight:700,color:C.text,fontSize:15,marginBottom:4}}>¿Qué profesional necesitas?</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20}}>
          {topTrades.map(t=>(
            <button key={t} onClick={()=>{setTrade(t);setStep(1);}} style={{padding:"10px 14px",borderRadius:10,border:"1px solid "+(trade===t?C.accent:C.border),background:trade===t?C.accent+"18":C.surface,color:trade===t?C.accent:C.text,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",gap:6}}>
              {OFICIO_ICONS[t]} {t}
            </button>
          ))}
        </div>
      </>)}

      {step===1&&(<>
        <p style={{fontWeight:700,color:C.text,fontSize:15,marginBottom:4}}>¿En qué zona?</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:20}}>
          {SEVILLA_ZONAS.map(z=>(
            <button key={z} onClick={()=>{setZone(z);setStep(2);}} style={{padding:"8px 12px",borderRadius:10,border:"1px solid "+(zone===z?C.blue:C.border),background:zone===z?C.blue+"18":C.surface,color:zone===z?C.blue:C.text,cursor:"pointer",fontSize:12}}>
              {z}
            </button>
          ))}
        </div>
      </>)}

      {step===2&&(<>
        <p style={{fontWeight:700,color:C.text,fontSize:15,marginBottom:4}}>Resultados</p>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
           {matches.map(w=><WorkerCard key={w.id} w={w} onClick={()=>onSelect(w)} />)}
           {matches.length===0&&<p style={{textAlign:"center",color:C.muted}}>No hay coincidencias inmediatas.</p>}
        </div>
        <Btn full onClick={onClose} style={{marginTop:14}}>Cerrar</Btn>
      </>)}
    </Sheet>
  );
}

// ─── SEVILLA MAP COMPONENT ───
const PUEBLOS_CERCANOS = [
  {id:"Dos Hermanas",label:"Dos Hermanas",lat:37.296,lng:-5.922},
  {id:"Alcalá de Guadaíra",label:"Alcalá de Guadaíra",lat:37.339,lng:-5.840},
  {id:"Mairena del Aljarafe",label:"Mairena del Aljarafe",lat:37.347,lng:-6.062},
  {id:"Camas",label:"Camas",lat:37.399,lng:-6.031},
  {id:"San Juan de Aznalfarache",label:"San Juan de Aznalfarache",lat:37.370,lng:-6.025},
  {id:"Bormujos",label:"Bormujos",lat:37.362,lng:-6.071},
  {id:"Tomares",label:"Tomares",lat:37.371,lng:-6.047},
  {id:"Gelves",label:"Gelves",lat:37.340,lng:-6.013},
  {id:"La Rinconada",label:"La Rinconada",lat:37.476,lng:-5.981},
  {id:"Mairena del Alcor",label:"Mairena del Alcor",lat:37.369,lng:-5.757},
  {id:"Utrera",label:"Utrera",lat:37.185,lng:-5.781},
  {id:"Carmona",label:"Carmona",lat:37.471,lng:-5.644},
  {id:"Écija",label:"Écija",lat:37.541,lng:-5.082},
  {id:"Morón de la Frontera",label:"Morón de la Frontera",lat:37.125,lng:-5.453},
  {id:"Lebrija",label:"Lebrija",lat:36.921,lng:-6.081},
];

const BARRIOS_SEVILLA = [
  {id:"Centro",color:"#FFD700",latlngs:[[37.3961,-5.9953],[37.3958,-5.9916],[37.3944,-5.9873],[37.3921,-5.9836],[37.3896,-5.9823],[37.3872,-5.9829],[37.3854,-5.9851],[37.3851,-5.9883],[37.3862,-5.9921],[37.3886,-5.9952],[37.3916,-5.9967],[37.3944,-5.9965]]},
  {id:"Triana",color:"#FF6B6B",latlngs:[[37.3989,-6.0156],[37.3991,-6.0098],[37.3978,-6.0052],[37.3955,-6.0012],[37.3921,-5.9988],[37.3892,-5.9981],[37.3869,-5.9991],[37.3851,-6.0018],[37.3843,-6.0058],[37.3851,-6.0101],[37.3874,-6.0138],[37.3909,-6.0158],[37.3946,-6.0162],[37.3971,-6.0158]]},
  {id:"Los Remedios",color:"#4ECDC4",latlngs:[[37.3851,-6.0018],[37.3843,-6.0058],[37.3851,-6.0101],[37.3836,-6.0098],[37.3798,-6.0071],[37.3768,-6.0038],[37.3754,-5.9998],[37.3758,-5.9958],[37.3779,-5.9928],[37.3812,-5.9918],[37.3843,-5.9934],[37.3869,-5.9991]]},
  {id:"Nervión",color:"#45B7D1",latlngs:[[37.3961,-5.9953],[37.3944,-5.9965],[37.3960,-5.9895],[37.3988,-5.9833],[37.4008,-5.9776],[37.4001,-5.9718],[37.3978,-5.9678],[37.3954,-5.9668],[37.3928,-5.9689],[37.3911,-5.9728],[37.3913,-5.9772],[37.3929,-5.9810],[37.3944,-5.9837],[37.3961,-5.9873]]},
  {id:"La Macarena",color:"#A78BFA",latlngs:[[37.4098,-5.9988],[37.4121,-5.9941],[37.4128,-5.9881],[37.4118,-5.9821],[37.4091,-5.9773],[37.4058,-5.9743],[37.4021,-5.9738],[37.3988,-5.9758],[37.3972,-5.9791],[37.3961,-5.9831],[37.3961,-5.9873],[37.3988,-5.9833],[37.4008,-5.9776],[37.4038,-5.9761],[37.4068,-5.9771],[37.4088,-5.9801],[37.4091,-5.9851],[37.4078,-5.9901],[37.4058,-5.9941]]},
  {id:"San Pablo",color:"#FB923C",latlngs:[[37.4098,-5.9988],[37.4058,-5.9941],[37.4078,-5.9901],[37.4091,-5.9851],[37.4088,-5.9801],[37.4121,-5.9741],[37.4148,-5.9701],[37.4168,-5.9638],[37.4158,-5.9578],[37.4131,-5.9541],[37.4098,-5.9531],[37.4068,-5.9548],[37.4048,-5.9578],[37.4038,-5.9621],[37.4041,-5.9671],[37.4058,-5.9718],[37.4088,-5.9738]]},
  {id:"Bellavista",color:"#34D399",latlngs:[[37.3758,-5.9958],[37.3754,-5.9998],[37.3768,-6.0038],[37.3748,-6.0031],[37.3718,-5.9998],[37.3694,-5.9951],[37.3681,-5.9898],[37.3686,-5.9841],[37.3708,-5.9798],[37.3738,-5.9778],[37.3768,-5.9788],[37.3791,-5.9818],[37.3798,-5.9858],[37.3791,-5.9901],[37.3779,-5.9928],[37.3758,-5.9958]]},
  {id:"Cerro-Amate",color:"#60A5FA",latlngs:[[37.3978,-5.9678],[37.4001,-5.9718],[37.4008,-5.9776],[37.3988,-5.9833],[37.3961,-5.9873],[37.3944,-5.9837],[37.3928,-5.9810],[37.3911,-5.9771],[37.3898,-5.9721],[37.3891,-5.9661],[37.3901,-5.9601],[37.3924,-5.9558],[37.3954,-5.9541],[37.3984,-5.9558],[37.4001,-5.9594],[37.4001,-5.9638]]},
  {id:"Sur",color:"#F472B6",latlngs:[[37.3791,-5.9818],[37.3768,-5.9788],[37.3738,-5.9778],[37.3718,-5.9798],[37.3698,-5.9841],[37.3691,-5.9888],[37.3664,-5.9871],[37.3638,-5.9838],[37.3624,-5.9791],[37.3628,-5.9741],[37.3651,-5.9701],[37.3681,-5.9678],[37.3714,-5.9678],[37.3744,-5.9694],[37.3764,-5.9724],[37.3771,-5.9771]]},
  {id:"Torreblanca",color:"#FBBF24",latlngs:[[37.3978,-5.9678],[37.4001,-5.9638],[37.4001,-5.9594],[37.3984,-5.9558],[37.3984,-5.9491],[37.4001,-5.9431],[37.4028,-5.9391],[37.4061,-5.9368],[37.4098,-5.9368],[37.4128,-5.9391],[37.4141,-5.9431],[37.4131,-5.9481],[37.4104,-5.9518],[37.4068,-5.9531],[37.4038,-5.9541],[37.4001,-5.9578],[37.3984,-5.9628]]},
  {id:"Norte",color:"#6EE7B7",latlngs:[[37.4128,-5.9881],[37.4148,-5.9941],[37.4168,-5.9988],[37.4188,-6.0028],[37.4198,-6.0078],[37.4188,-6.0121],[37.4158,-6.0148],[37.4121,-6.0151],[37.4088,-6.0128],[37.4068,-6.0091],[37.4068,-6.0041],[37.4088,-6.0001],[37.4118,-5.9971],[37.4128,-5.9928]]},
  {id:"Pino Montano",color:"#C4B5FD",latlngs:[[37.4168,-5.9638],[37.4188,-5.9578],[37.4208,-5.9511],[37.4228,-5.9451],[37.4258,-5.9411],[37.4291,-5.9391],[37.4318,-5.9411],[37.4328,-5.9461],[37.4311,-5.9518],[37.4278,-5.9561],[37.4241,-5.9578],[37.4208,-5.9578],[37.4181,-5.9601]]},
  {id:"Sevilla Este",color:"#F97316",latlngs:[[37.3984,-5.9491],[37.3984,-5.9428],[37.3998,-5.9368],[37.4021,-5.9311],[37.4054,-5.9268],[37.4091,-5.9241],[37.4131,-5.9241],[37.4161,-5.9268],[37.4171,-5.9318],[37.4158,-5.9368],[37.4131,-5.9391],[37.4098,-5.9368],[37.4061,-5.9368],[37.4028,-5.9391],[37.4001,-5.9431],[37.3984,-5.9491]]},
];

function SevillaMap({selectedZone,onZoneSelect}:{selectedZone:string;onZoneSelect:(z:string)=>void}){
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map|null>(null);

  useEffect(()=>{
    if(!mapRef.current||leafletRef.current) return;
    const map = L.map(mapRef.current,{
      center:[37.388,-5.982],
      zoom:12,
      zoomControl: false,
      attributionControl: false
    });
    
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png").addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",{opacity:0.6}).addTo(map);

    BARRIOS_SEVILLA.forEach(b=>{
      const isActive = selectedZone === b.id;
      const poly = L.polygon(b.latlngs as any,{
        color: b.color,
        fillColor: b.color,
        fillOpacity: isActive ? 0.45 : 0.15,
        weight: isActive ? 3 : 1,
        dashArray: isActive ? undefined : "5,5"
      }).addTo(map);
      
      poly.on("mouseover", () => { if(!isActive) poly.setStyle({fillOpacity: 0.3}) });
      poly.on("mouseout", () => { if(!isActive) poly.setStyle({fillOpacity: 0.15}) });
      poly.on("click",()=>onZoneSelect(isActive ? "" : b.id));
    });

    // Pueblos markers
    PUEBLOS_CERCANOS.forEach(p=>{
      const icon = L.divIcon({
        html: `<div style="width:10px;height:10px;background:#FFD700;border-radius:50%;box-shadow:0 0 8px #FFD700"></div>`,
        className: ''
      });
      L.marker([p.lat, p.lng], {icon}).addTo(map).on('click', ()=>onZoneSelect(p.id));
    });

    leafletRef.current=map;
    return ()=>{map.remove();leafletRef.current=null;};
  }, [selectedZone, onZoneSelect]);

  return (
    <div style={{position:'relative', marginBottom: 16}}>
      <div ref={mapRef} style={{height:300,borderRadius:16,overflow:"hidden", border:"1px solid "+C.border}} />
      <div style={{position:'absolute', bottom: 10, left: 10, background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: 4, pointerEvents:'none'}}>
        <p style={{fontSize:10, color:'#fff'}}>📍 Sevilla Interactiva</p>
      </div>
    </div>
  );
}

// ─── RANKING SECTION COMPONENT ───
function RankingSection({workers,onSelect}:{workers:UserRow[];onSelect:(w:UserRow)=>void}){
  const eligible=workers.filter(w=>w.plan==="pro"||w.plan==="elite").sort((a,b)=>b.rating-a.rating);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {eligible.map((w,i)=>(
         <GCard key={w.id} onClick={()=>onSelect(w)}>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
               <span style={{fontWeight:800,fontSize:18,color:C.accent}}>#{i+1}</span>
               <Ava s={w.name.substring(0,2).toUpperCase()} size={40} color={wColor(w.id)} />
               <div style={{flex:1}}><p style={{fontWeight:700}}>{w.name}</p><p style={{fontSize:12,color:C.muted}}>{w.trade}</p></div>
            </div>
         </GCard>
      ))}
      {eligible.length===0&&<p style={{textAlign:"center",padding:40,color:C.muted}}>No hay profesionales en el ranking.</p>}
    </div>
  );
}
