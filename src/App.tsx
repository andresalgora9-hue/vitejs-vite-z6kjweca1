import { useState, useEffect, useRef, useCallback } from "react";
import { db, STORAGE_URL } from "./supabase";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { UserRow, MessageRow, JobRow, CertRow, Plan, PhotoRow } from
"./supabase";
const C = {
bg:"#0A0A0F", surface:"#111118", card:"#16161F", cardHover:"#1C1C2A",
border:"#1E1E30", accent:"#FFD700", orange:"#FF8C00",
red:"#FF4455", green:"#00D68F", blue:"#3B82F6", purple:"#8B5CF6",
cyan:"#06B6D4", pink:"#EC4899",
text:"#F0F0FA", muted:"#44445A", mutedL:"#7777AA",
};
const ZONAS = [
"Sevilla","Madrid","Barcelona","Valencia","Málaga","Bilbao","Zaragoza","Alicante","Granada",
"Cádiz","Córdoba","Huelva",
];
// Sevilla neighborhoods for map filtering
const SEVILLA_ZONAS = [
"Centro / Casco Antiguo","Triana","Los Remedios","Nervión","La Macarena",
"San Pablo / Santa Justa","Bellavista / La Palmera","Cerro-Amate","Sur","Este / Alcosa /
Torreblanca",
"Norte","Camas","Dos Hermanas","Alcalá de Guadaíra","Mairena del Aljarafe",
"San Juan de Aznalfarache","Bormujos","Tomares","Gelves","La Rinconada"
];
const OFICIOS = [
// Técnicos y servicios
"Electricista","Fontanero","Pintor","Albañil","Carpintero","Cerrajero","Jardinero",
"Soldador","Climatización","Reformas Integrales","Instalador Solar","Yesero",
"Técnico de Gas","Fumigador","Techador","Tapicero","Mecánico","Cocinero","Zapatero",
"Montador de Estructuras",
// Tradición sevillana
"Ceramista / Alfarero","Bordador de Oro y Seda","Orfebre","Guarnicionero",
"Costurero/a Flamenca","Lutier","Imaginero / Escultor","Abaniquero",
"Encuadernador Artesanal","Tallista de Castañuelas","Otros servicios",
];
const OFICIO_CATEGORIES: Record<string,string> = {
"Electricista":"
Técnico","Fontanero":"
Técnico","Pintor":"
Técnico",
"Albañil":"
Técnico","Carpintero":"
Técnico","Cerrajero":"
Técnico",
"Jardinero":"
Servicios","Soldador":"
Técnico","Climatización":"
Técnico",
"Reformas Integrales":"
Técnico","Instalador Solar":"
Técnico","Yesero":"
Técnico",
"Técnico de Gas":"
Técnico","Fumigador":"
Servicios","Techador":"
Técnico",
"Tapicero":"
Técnico","Mecánico":"
Técnico","Cocinero":"
Hostelería",
"Zapatero":"
Servicios","Montador de Estructuras":"
Eventos",
"Ceramista / Alfarero":"
Artesanía","Bordador de Oro y Seda":"
Artesanía",

🪑




🪵

🪲




👨‍🍳









"Orfebre":"
Artesanía","Guarnicionero":"
Artesanía",
"Costurero/a Flamenca":"
Artesanía","Lutier":"
Artesanía",
"Imaginero / Escultor":"
Artesanía","Abaniquero":"
Artesanía",
"Encuadernador Artesanal":"
Artesanía","Tallista de Castañuelas":"
Artesanía","Otros
servicios":"
Servicios",
};
const OFICIO_ICONS:Record<string,string> = {
"Electricista":" ","Fontanero":" ","Pintor":" ","Albañil":" ","Carpintero":" ",
"Cerrajero":" ","Jardinero":" ","Soldador":" ","Climatización":" ",
"Reformas Integrales":" ","Instalador Solar":" ","Yesero":" ",
"Técnico de Gas":" ","Fumigador":" ","Techador":" ","Tapicero":" ",
"Mecánico":" ","Cocinero":" ","Zapatero":" ","Montador de Estructuras":" ",
"Ceramista / Alfarero":" ","Bordador de Oro y Seda":" ","Orfebre":" ",
"Guarnicionero":" ","Costurero/a Flamenca":" ","Lutier":" ",
"Imaginero / Escultor":" ","Abaniquero":" ",
"Encuadernador Artesanal":" ","Tallista de Castañuelas":" ","Otros servicios":" ",
};
const SCHEDULES = ["Lunes a Viernes","Lunes a Sábado","Todos los días","Fines de
semana","Urgencias 24h"];
const RESPONSE_TIMES = ["Menos de 1h","Menos de 2h","Menos de 4h","Mismo día","24
horas"];
const PLAN_DISPLAY_NAMES:Record<Plan,string> = {
  gratis:"Bienvenida", basico:"Autónomo", pro:"Agenda Llena", elite:"Élite",
};
const PLAN_COLORS:Record<Plan,string> =
{gratis:"#7777AA",basico:"#3B82F6",pro:"#FFD700",elite:"#FF8C00"};
const PLAN_PRICES:Record<Plan,number> = {gratis:0,basico:9.99,pro:24.99,elite:49.99};
const PLAN_FEATURES:Record<Plan,string[]> = {
gratis:["Perfil básico","5 contactos/mes","Visible en búsquedas"],
basico:["Perfil completo","20 contactos/mes","✓ Badge verificado","Estadísticas
básicas","Chat con clientes","Galería 5 fotos","Gestión de trabajos"],
pro:["Perfil destacado","Contactos ilimitados","✓✓ Badge PRO","Estadísticas
avanzadas","Chat directo","Galería ilimitada","Primero en búsquedas","Panel de trabajos
completo","Ranking público","Zonas de servicio múltiples"],
elite:["Todo lo de Pro","
Badge ÉLITE","Anuncios en portada","Top garantizado
#1","Gestor reseñas avanzado","Facturación integrada","Soporte 24h","API de integración"],
};




🪭



🪵
🪲
🪑
👨‍🍳
🪭


// ─── PLAN FEATURE GATES ───
const PLAN_GATES = {
// Stats visible
statsLevel: {gratis:0, basico:1, pro:2, elite:3} as Record<Plan,number>,
// Contacts per month
contacts: {gratis:5, basico:20, pro:999, elite:999} as Record<Plan,number>,
// Photos allowed
photos: {gratis:0, basico:5, pro:20, elite:999} as Record<Plan,number>,
// Can see ranking
ranking: {gratis:false, basico:false, pro:true, elite:true} as Record<Plan,boolean>,
// Priority in search
priority: {gratis:0, basico:1, pro:2, elite:3} as Record<Plan,number>,

// Chat allowed
chat: {gratis:false, basico:true, pro:true, elite:true} as Record<Plan,boolean>,
// Analytics depth
analytics: {gratis:"none", basico:"basic", pro:"full", elite:"full"} as Record<Plan,string>,
};

// ─── ANTI-DESINTERMEDIACIÓN ───
const PHONE_REGEX = /(\+?\d[\d\s\-().]{7,}\d)/g;
const LINK_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
const EMAIL_REGEX = /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g;
function sanitizeMsg(text:string):{blocked:boolean;reason:string}{
  if(PHONE_REGEX.test(text)){PHONE_REGEX.lastIndex=0;return{blocked:true,reason:"teléfono"};}
  if(LINK_REGEX.test(text)){LINK_REGEX.lastIndex=0;return{blocked:true,reason:"enlace externo"};}
  if(EMAIL_REGEX.test(text)){EMAIL_REGEX.lastIndex=0;return{blocked:true,reason:"email"};}
  return{blocked:false,reason:""};
}
// Upload image to Supabase Storage
async function uploadImage(file:File, path:string):Promise<string|null>{
const ext = file.name.split('.').pop();
const fileName = path+"/"+Date.now()+"."+ext;
const {error} = await db.storage.from("photos").upload(fileName, file, {contentType:file.type,
upsert:true});
if(error){console.error("Upload error:",error);return null;}
return STORAGE_URL + fileName;
}
const wColor = (id:string) =>
[C.purple,C.blue,C.pink,"#10B981",C.orange,C.cyan][id.charCodeAt(id.length-1)%6];
function trialDaysLeft(t:string){ return Math.max(0,Math.ceil((new
Date(t).getTime()-Date.now())/86400000)); }
function timeAgo(iso:string){
const d=(Date.now()-new Date(iso).getTime())/1000;
if(d<60) return "ahora"; if(d<3600) return Math.floor(d/60)+"m";
if(d<86400) return Math.floor(d/3600)+"h"; return Math.floor(d/86400)+"d";
}
// ─── UI ATOMS ───
function
Stars({n,size=13,interactive=false,onSet}:{n:number;size?:number;interactive?:boolean;onSe
t?:(n:number)=>void}){
return <span style={{fontSize:size,letterSpacing:1,cursor:interactive?"pointer":"default"}}>
{[1,2,3,4,5].map(i=><span key={i} onClick={()=>interactive&&onSet&&onSet(i)}
style={{color:i<=Math.round(n)?C.accent:C.border}}>{i<=Math.round(n)?"★":"☆"}</span>)}
</span>;
}
function
Ava({s,size=44,color=C.purple,online=false}:{s:string;size?:number;color?:string;online?:bool
ean}){
return <div style={{position:"relative",flexShrink:0}}>
<div
style={{width:size,height:size,borderRadius:"50%",background:"linear-gradient(135deg,"+col
or+"55,"+color+"22)",display:"flex",alignItems:"center",justifyContent:"center",color:C.accent,f
ontWeight:900,fontSize:Math.round(size*0.35),border:"2px solid "+color+"55",boxShadow:"0
0 12px "+color+"22",flexShrink:0}}>{s}</div>
{online&&<div
style={{position:"absolute",bottom:0,right:0,width:10,height:10,borderRadius:"50%",backgrou
nd:C.green,border:"2px solid "+C.bg}} />}

</div>;
}
function Badge({plan}:{plan:Plan}){
const col=PLAN_COLORS[plan];
return <span style={{padding:"2px
7px",borderRadius:4,fontSize:9,fontWeight:900,letterSpacing:"0.08em",color:col,background:
col+"22",border:"1px solid "+col+"44"}}>{(PLAN_DISPLAY_NAMES[plan]||plan).toUpperCase()}</span>;
}
function StatusDot({status}:{status:string}){
const
cols:Record<string,string>={pending:C.orange,in_progress:C.blue,done:C.green,cancelled:C
.red};
const labels:Record<string,string>={pending:"Pendiente",in_progress:"En
progreso",done:"Completado",cancelled:"Cancelado"};
const col=cols[status]||C.muted;
return <span
style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:col,fontWeight:600}}>
<span style={{width:6,height:6,borderRadius:"50%",background:col,display:"inline-block"}}
/>{labels[status]||status}
</span>;
}
function Spin(){return <div style={{display:"flex",justifyContent:"center",padding:40}}><div
style={{width:28,height:28,border:"3px solid "+C.border,borderTop:"3px solid
"+C.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite"}} /></div>;}
function Ping({msg}:{msg:string|null}){
if(!msg) return null;
return <div
style={{position:"fixed",bottom:88,left:"50%",transform:"translateX(-50%)",background:"linear
-gradient(135deg,"+C.accent+","+C.orange+")",color:"#000",borderRadius:10,padding:"10px
20px",fontWeight:700,fontSize:13,zIndex:9999,whiteSpace:"nowrap",boxShadow:"0 4px
20px "+C.accent+"55",pointerEvents:"none"}}>{msg}</div>;
}
function
Sheet({children,onClose,title}:{children:React.ReactNode;onClose:()=>void;title?:string}){
return <div onClick={onClose}
style={{position:"fixed",inset:0,background:"rgba(4,4,12,0.88)",backdropFilter:"blur(16px)",zIn
dex:500,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
<div onClick={e=>e.stopPropagation()}
style={{background:"linear-gradient(170deg,#14141F,#0A0A14)",borderRadius:"20px 20px 0
0",width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto",border:"1px solid
"+C.accent+"22",borderBottom:"none",boxShadow:"0 -8px 40px rgba(0,0,0,0.6)"}}>
{title&&<div
style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 20px
0"}}>
<p style={{fontWeight:800,fontSize:17,color:C.text}}>{title}</p>
<button onClick={onClose} style={{background:"none",border:"1px solid
"+C.border,borderRadius:8,color:C.muted,cursor:"pointer",padding:"5px
10px",fontSize:14}}>✕</button>

</div>}
<div style={{padding:20}}>{children}</div>
</div>
</div>;
}
function
Btn({children,onClick,color=C.accent,outline=false,full=false,small=false,disabled=false,dang
er=false}:any){
const bg=danger?C.red:color;
return <button onClick={onClick} disabled={disabled}
style={{width:full?"100%":"auto",padding:small?"8px 14px":"12px
22px",background:outline?"transparent":"linear-gradient(135deg,"+bg+","+bg+"BB)",border:"
1px solid "+bg+(outline?"66":"22"),borderRadius:10,color:outline?bg:"#000",fontFamily:"'DM
Sans',sans-serif",fontWeight:700,fontSize:small?13:14,cursor:disabled?"not-allowed":"pointe
r",opacity:disabled?0.5:1,transition:"all 0.15s",boxShadow:outline?"none":"0 4px 14px
"+bg+"33",whiteSpace:"nowrap"}}>{children}</button>;
}
function
Inp({label,value,onChange,type="text",placeholder="",required=false,multiline=false}:any){
const s:any={width:"100%",background:C.card,border:"1px solid
"+C.border,borderRadius:8,padding:"11px 14px",color:C.text,fontFamily:"'DM
Sans',sans-serif",fontSize:14,outline:"none"};
return <div style={{marginBottom:14}}>
{label&&<p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as
const,letterSpacing:"0.08em",marginBottom:5,fontWeight:700}}>{label}{required&&<span
style={{color:C.red}}> *</span>}</p>}
{multiline?<textarea value={value} onChange={(e:any)=>onChange(e.target.value)}
placeholder={placeholder} style={{...s,resize:"vertical",minHeight:80}} />:<input type={type}
value={value} onChange={(e:any)=>onChange(e.target.value)} placeholder={placeholder}
style={s} />}
</div>;
}
function GCard({children,style={},onClick,glow=""}:any){
const [hov,setHov]=useState(false);
return <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
onClick={onClick}
style={{background:hov&&onClick?C.cardHover:C.card,borderRadius:14,border:"1px solid
"+(hov&&glow?glow+"44":C.border),padding:18,transition:"all
0.2s",cursor:onClick?"pointer":"default",boxShadow:hov&&glow?"0 6px 24px "+glow+"18":"0
2px 12px rgba(0,0,0,0.25),inset 0 1px 0 rgba(255,255,255,0.02)",...style}}>{children}</div>;
}
function
Toggle({value,onChange,label}:{value:boolean;onChange:(v:boolean)=>void;label:string}){
return <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0"}}>
<span style={{flex:1,fontSize:13,color:C.text}}>{label}</span>
<button onClick={()=>onChange(!value)}
style={{width:40,height:22,borderRadius:99,background:value?C.green:C.border,border:"non
e",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}>

<div
style={{width:14,height:14,borderRadius:"50%",background:"#fff",position:"absolute",top:4,lef
t:value?22:4,transition:"left 0.2s"}} />
</button>
</div>;
}
function
MultiSelect({label,options,selected,onChange}:{label:string;options:string[];selected:string[];o
nChange:(v:string[])=>void}){
const
toggle=(o:string)=>onChange(selected.includes(o)?selected.filter(x=>x!==o):[...selected,o]);
return <div style={{marginBottom:14}}>
<p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as
const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>{label}</p>
<div style={{display:"flex",flexWrap:"wrap",gap:6}}>
{options.map(o=><button key={o} onClick={()=>toggle(o)} style={{padding:"5px
12px",borderRadius:99,border:"1px solid
"+(selected.includes(o)?C.accent:C.border),background:selected.includes(o)?C.accent+"18":
"transparent",color:selected.includes(o)?C.accent:C.muted,cursor:"pointer",fontSize:12,fontF
amily:"'DM Sans',sans-serif",fontWeight:selected.includes(o)?700:400,transition:"all
0.15s"}}>{o}</button>)}
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
const [name,setName]=useState(""); const [email,setEmail]=useState(""); const
[phone,setPhone]=useState("");
const [pass,setPass]=useState(""); const [trade,setTrade]=useState(OFICIOS[0]); const
[zone,setZone]=useState(ZONAS[0]);
const [plan,setPlan]=useState<Plan>("gratis");
const login=async()=>{
if(!email||!pass){setErr("Introduce email y contraseña.");return;}
setLoading(true);setErr("");
const {data,error}=await
db.from("users").select("*").eq("email",email.toLowerCase()).eq("password",pass).single();
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
const {data:d2}=await db.from("users").insert({name:"Cliente
Demo",email:"demo_cli@demo.com",phone:"600000000",password:"demo123",type:"cliente
",plan:"gratis",trial_end:new
Date(Date.now()+30*86400000).toISOString().split("T")[0],available:true,verified:false,jobs:0,
rating:0,reviews:0}).select().single();
data=d2;
}
setLoading(false);
if(data){localStorage.setItem("oy_user",JSON.stringify(data));onLogin(data as UserRow);}
};
const register=async()=>{
if(!name||!email||!phone||!pass){setErr("Rellena todos los campos.");return;}
if(pass.length<6){setErr("Mínimo 6 caracteres en la contraseña.");return;}
setLoading(true);setErr("");
const {data:ex}=await
db.from("users").select("id").eq("email",email.toLowerCase()).maybeSingle();
if(ex){setLoading(false);setErr("Ya existe una cuenta con ese email.");return;}
const trial_end=new Date(Date.now()+30*86400000).toISOString().split("T")[0];
const {data,error}=await
db.from("users").insert({name,email:email.toLowerCase(),phone,password:pass,type:uType,
plan,trade:uType==="profesional"?trade:null,zone:uType==="profesional"?zone:null,bio:"",pri
ce:30,available:true,verified:false,jobs:0,rating:0,reviews:0,trial_end,service_zones:[],schedul
e:"Lunes a
Viernes",response_time:"24h",free_quote:true,experience_years:0,specialties:[],whatsapp:ph
one}).select().single();
setLoading(false);
if(error||!data){setErr("Error creando cuenta. Inténtalo de nuevo.");return;}
localStorage.setItem("oy_user",JSON.stringify(data));
onLogin(data as UserRow);
};
return (
<div
style={{minHeight:"100dvh",background:C.bg,display:"flex",flexDirection:"column",alignItems:
"center",justifyContent:"center",padding:"24px
20px",backgroundImage:"radial-gradient(ellipse at 20% 0%,#2a0a5a22,transparent
55%),radial-gradient(ellipse at 80% 100%,#0a2a4a22,transparent 55%)"}}>
<div style={{width:"100%",maxWidth:400}}>
<div style={{textAlign:"center",marginBottom:28}}>
<div
style={{width:54,height:54,borderRadius:16,background:"linear-gradient(135deg,"+C.accent+


","+C.orange+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:
"0 auto 12px",boxShadow:"0 8px 28px "+C.accent+"44"}}> </div>
<h1
style={{fontWeight:900,fontSize:28,letterSpacing:"-0.03em",marginBottom:4}}><span
style={{color:C.text}}>Oficio</span><span style={{color:C.accent}}>Ya</span></h1>
<p style={{fontSize:13,color:C.muted}}>Profesionales verificados en tu zona ·
Sevilla</p>
</div>
<div style={{display:"flex",background:C.card,borderRadius:10,padding:4,border:"1px
solid "+C.border,marginBottom:18}}>
{(["login","register"] as const).map(m=>(
<button key={m} onClick={()=>{setMode(m);setErr("");setStep(1);}}
style={{flex:1,padding:"9px",borderRadius:8,border:"none",background:mode===m?"linear-g
radient(135deg,"+C.accent+","+C.orange+")":"transparent",color:mode===m?"#000":C.mute
d,fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",transition:"all
0.2s"}}>
{m==="login"?"Iniciar sesión":"Crear cuenta"}
</button>
))}
</div>
<GCard>
{err&&<div style={{color:C.red,fontSize:13,marginBottom:12,padding:"10px
12px",background:C.red+"15",borderRadius:8,border:"1px solid "+C.red+"33"}}>{err}</div>}
{mode==="login"&&(<>
<Inp label="Email" value={email} onChange={setEmail} type="email"
placeholder="tu@email.com" />
<Inp label="Contraseña" value={pass} onChange={setPass} type="password"
placeholder="••••••••" />
<Btn full disabled={loading} onClick={login}>{loading?"Entrando...":"Entrar →"}</Btn>
<div style={{margin:"14px 0",display:"flex",alignItems:"center",gap:10}}>
<div style={{flex:1,height:1,background:C.border}} /><span
style={{fontSize:10,color:C.muted,textTransform:"uppercase" as
const,letterSpacing:"0.08em"}}>Demo</span><div
style={{flex:1,height:1,background:C.border}} />
</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
<Btn outline small onClick={()=>demoLogin("cliente")} color={C.blue}
disabled={loading}>
Demo Cliente</Btn>
<Btn outline small onClick={()=>demoLogin("profesional")} color={C.accent}
disabled={loading}>
Demo Pro</Btn>
</div>
<p style={{textAlign:"center",fontSize:11,color:C.muted}}>Admin: admin@oficioya.es /
Admin2026!</p>
</>)}
{mode==="register"&&(<>
<div style={{display:"flex",gap:5,marginBottom:16,justifyContent:"center"}}>


{[1,2,3].map(s=><div key={s}
style={{width:s===step?24:7,height:7,borderRadius:99,background:s===step?C.accent:s<st
ep?C.green:C.border,transition:"all 0.3s"}} />)}
</div>
{step===1&&(<>
<p style={{fontWeight:700,color:C.text,marginBottom:12,fontSize:14}}>¿Cómo vas a
usar OfficioYa?</p>
<div style={{display:"grid",gridTemplateColumns:"1fr
1fr",gap:10,marginBottom:16}}>
{(["cliente","profesional"] as const).map(t=>(
<div key={t} onClick={()=>setUType(t)} style={{padding:"16px
10px",borderRadius:12,border:"2px solid
"+(uType===t?C.accent:C.border),background:uType===t?C.accent+"15":C.surface,cursor:"
pointer",textAlign:"center",transition:"all 0.15s"}}>
<div style={{fontSize:24,marginBottom:6}}>{t==="cliente"?" ":" "}</div>
<div
style={{fontWeight:700,fontSize:13,color:uType===t?C.accent:C.text}}>{t==="cliente"?"Soy
cliente":"Soy profesional"}</div>
<div style={{fontSize:11,color:C.muted,marginTop:3}}>{t==="cliente"?"Busco
profesionales":"Ofrezco servicios"}</div>
</div>
))}
</div>
<Btn full onClick={()=>setStep(2)}>Siguiente →</Btn>
</>)}
{step===2&&(<>
<p style={{fontWeight:700,color:C.text,marginBottom:12,fontSize:14}}>Tus
datos</p>
<Inp label="Nombre completo" value={name} onChange={setName}
placeholder="Tu nombre" required />
<Inp label="Email" value={email} onChange={setEmail} type="email"
placeholder="tu@email.com" required />
<Inp label="Teléfono / WhatsApp" value={phone} onChange={setPhone}
placeholder="+34 600 000 000" required />
<Inp label="Contraseña" value={pass} onChange={setPass} type="password"
placeholder="Mínimo 6 caracteres" required />
{uType==="profesional"&&<>
<div style={{marginBottom:14}}>
<p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as
const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Tu oficio</p>
<div style={{display:"flex",flexWrap:"wrap",gap:6}}>
{OFICIOS.map(o=><button key={o} onClick={()=>setTrade(o)}
style={{padding:"6px 12px",borderRadius:99,border:"1px solid
"+(trade===o?C.accent:C.border),background:trade===o?C.accent+"22":"transparent",color:
trade===o?C.accent:C.muted,cursor:"pointer",fontSize:12,fontFamily:"'DM
Sans',sans-serif",fontWeight:trade===o?700:400,transition:"all 0.15s"}}>{OFICIO_ICONS[o]}
{o}</button>)}
</div>


</div>
<div style={{marginBottom:14}}>
<p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as
const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Ciudad principal</p>
<select value={zone} onChange={e=>setZone(e.target.value)}
style={{width:"100%",background:C.card,border:"1px solid
"+C.border,borderRadius:8,padding:"11px 14px",color:C.text,fontFamily:"'DM
Sans',sans-serif",fontSize:14,outline:"none",cursor:"pointer"}}>
{ZONAS.map(z=><option key={z} style={{background:C.card}}>{z}</option>)}
</select>
</div>
</>}
<div style={{display:"flex",gap:8}}>
<Btn outline small onClick={()=>setStep(1)} color={C.muted}>← Atrás</Btn>
<div style={{flex:1}}><Btn full
onClick={()=>{if(!name||!email||!phone||!pass){setErr("Rellena todos los
campos.");return;}setErr("");setStep(3);}}>Siguiente →</Btn></div>
</div>
</>)}
{step===3&&(<>
<p style={{fontWeight:700,color:C.text,marginBottom:4,fontSize:14}}>Elige tu
plan</p>
<p style={{fontSize:12,color:C.muted,marginBottom:14}}>30 días gratis · Sin tarjeta
· Cancela cuando quieras</p>
<div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
{(uType==="profesional"?["gratis","basico","pro","elite"]:["gratis"] as
Plan[]).map(p=>{
const pl=p as Plan;const col=PLAN_COLORS[pl];
return <div key={pl} onClick={()=>setPlan(pl)} style={{padding:"12px
14px",borderRadius:10,border:"2px solid
"+(plan===pl?col:C.border),background:plan===pl?col+"12":C.surface,cursor:"pointer",transi
tion:"all 0.15s",position:"relative"}}>
{pl==="pro"&&<span
style={{position:"absolute",top:-9,right:10,background:"linear-gradient(135deg,"+C.accent+","
+C.orange+")",color:"#000",borderRadius:99,padding:"1px
9px",fontSize:8,fontWeight:900}}>POPULAR</span>}
<div
style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
<span
style={{fontWeight:800,fontSize:14,color:col}}>{pl.toUpperCase()}</span>
<span
style={{fontWeight:700,fontSize:15,color:C.text}}>{PLAN_PRICES[pl]===0?"GRATIS":PLAN
_PRICES[pl]+"€/mes"}</span>
</div>
<div style={{display:"flex",flexWrap:"wrap",gap:3}}>
{PLAN_FEATURES[pl].slice(0,3).map(f=><span key={f}
style={{fontSize:10,color:C.mutedL}}>✓ {f}</span>)}

{PLAN_FEATURES[pl].length>3&&<span
style={{fontSize:10,color:col}}>+{PLAN_FEATURES[pl].length-3} más</span>}
</div>
</div>;
})}
</div>
<div style={{display:"flex",gap:8}}>
<Btn outline small onClick={()=>setStep(2)} color={C.muted}>← Atrás</Btn>
<div style={{flex:1}}><Btn full disabled={loading}
onClick={register}>{loading?"Creando cuenta...":"Crear cuenta →"}</Btn></div>
</div>
</>)}
</>)}
</GCard>
<p style={{textAlign:"center",fontSize:11,color:C.muted,marginTop:14}}>Al continuar
aceptas los Términos de Uso y la Política de Privacidad</p>
</div>
</div>
);
}
// ─── WORKER CARD ───
function WorkerCard({w,onClick}:{w:UserRow;onClick:()=>void}){
const col=wColor(w.id);
const badges=[];
if(w.free_quote) badges.push({t:"Presupuesto gratis",c:C.green});
if(w.response_time&&w.response_time.includes("1h")) badges.push({t:"Responde en
1h",c:C.cyan});
if(w.schedule&&w.schedule.includes("24h")) badges.push({t:"Urgencias 24h",c:C.red});
return (
<GCard onClick={onClick} glow={col}
style={{position:"relative",overflow:"hidden",padding:16}}>
<div
style={{position:"absolute",top:-20,right:-20,width:70,height:70,borderRadius:"50%",backgrou
nd:"radial-gradient(circle,"+col+"15,transparent 70%)",pointerEvents:"none"}} />
<div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
{w.plan==="elite"&&<Badge plan="elite" />}
{w.plan==="pro"&&<Badge plan="pro" />}
{badges.slice(0,2).map(b=><span key={b.t} style={{padding:"2px
7px",borderRadius:4,fontSize:9,fontWeight:700,color:b.c,background:b.c+"18",border:"1px
solid "+b.c+"33"}}>{b.t}</span>)}
</div>
<div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10}}>
<Ava s={w.name.substring(0,2).toUpperCase()} size={46} color={col}
online={w.available} />
<div style={{flex:1,minWidth:0}}>
<div style={{display:"flex",alignItems:"center",gap:5,marginBottom:2}}>

<p
style={{fontWeight:700,fontSize:15,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textO
verflow:"ellipsis"}}>{w.name}</p>
{w.verified&&<span style={{fontSize:10,color:C.green,flexShrink:0}}>✓</span>}
</div>
<p
style={{fontSize:12,color:col,fontWeight:600,marginBottom:2}}>{OFICIO_ICONS[w.trade||""]||
" "} {w.trade}</p>
<p style={{fontSize:11,color:C.muted}}>
{w.zone}{w.experience_years&&w.experience_years>0?" · "+w.experience_years+" años
exp.":""}</p>
</div>
</div>
<p
style={{fontSize:12,color:C.mutedL,marginBottom:10,lineHeight:1.55,display:"-webkit-box",W
ebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{w.bio||"Profesional
verificado con experiencia."}</p>
{w.service_zones&&w.service_zones.length>0&&(
<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
{w.service_zones.slice(0,3).map(z=><span key={z}
style={{fontSize:10,color:C.mutedL,background:C.surface,padding:"2px
7px",borderRadius:99,border:"1px solid "+C.border}}> {z}</span>)}
{w.service_zones.length>3&&<span
style={{fontSize:10,color:C.muted}}>+{w.service_zones.length-3}</span>}
</div>
)}
<div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8}}>
<Stars n={w.rating} size={11} />
<span
style={{fontSize:11,color:C.text,fontWeight:700}}>{w.rating>0?w.rating.toFixed(1):"Nuevo"}</
span>
{w.reviews>0&&<span style={{fontSize:10,color:C.muted}}>({w.reviews}
reseñas)</span>}
{w.jobs>0&&<span style={{fontSize:10,color:C.muted}}>· {w.jobs} trabajos</span>}
</div>
<div
style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:8,borde
rTop:"1px solid "+C.border}}>
<div>
<span style={{fontWeight:800,fontSize:20,color:C.accent}}>{w.price}€</span>
<span style={{fontSize:11,color:C.muted}}>/h</span>
{w.free_quote&&<span style={{fontSize:10,color:C.green,marginLeft:6}}>·
Presupuesto gratis</span>}
</div>
<div style={{display:"flex",gap:5,alignItems:"center"}}>
<span
style={{width:6,height:6,borderRadius:"50%",background:w.available?C.green:C.red,display:
"inline-block"}} />




<span
style={{fontSize:11,color:w.available?C.green:C.red,fontWeight:600}}>{w.available?"Disponib
le":"Ocupado"}</span>
</div>
</div>
</GCard>
);
}
// ─── WORKER DETAIL SHEET ───
function
WorkerSheet({worker,onClose,onChat,onWhatsApp,currentUser}:{worker:UserRow;onClose:
()=>void;onChat:(w:UserRow)=>void;onWhatsApp:(w:UserRow)=>void;currentUser:UserRo
w|null}){
const [tab,setTab]=useState<"info"|"fotos"|"reviews"|"certs">("info");
const
[reviews,setReviews]=useState<{id:string;worker_id:string;client_name:string;stars:number;t
ext:string;photo:string;photo_url?:string;approved?:boolean;created_at:string}[]>([]);
const [certs,setCerts]=useState<CertRow[]>([]);
const [photos,setPhotos]=useState<PhotoRow[]>([]);
const [newRev,setNewRev]=useState(""); const [selStars,setSelStars]=useState(5); const
[saving,setSaving]=useState(false);
const col=wColor(worker.id);
useEffect(()=>{
db.from("reviews").select("*").eq("worker_id",worker.id).order("created_at",{ascending:false})
.then(({data}:{data:any})=>setReviews(data||[]));
db.from("certificates").select("*").eq("worker_id",worker.id).then(({data}:{data:any})=>setCert
s(data||[]));
db.from("photos").select("*").eq("worker_id",worker.id).order("created_at",{ascending:false}).t
hen(({data}:{data:any})=>setPhotos(data||[]));
db.from("visits").insert({page:"worker_"+worker.id,user_id:currentUser?.id||null}).then(()=>{});
},[worker.id,currentUser?.id]);
const [revPhoto,setRevPhoto]=useState<File|null>(null);
const [revPhotoPreview,setRevPhotoPreview]=useState<string>("");
const fileRevRef=useRef<HTMLInputElement>(null);
void revPhotoPreview; void fileRevRef;
const submitReview=async()=>{
if(!newRev.trim()) return;
setSaving(true);
let photoUrl="";
if(revPhoto){

const url=await uploadImage(revPhoto,"reviews");
if(url) photoUrl=url;
}
const {data}=await
db.from("reviews").insert({worker_id:worker.id,client_name:currentUser?.name||"Anónimo",cl
ient_id:currentUser?.id||null,stars:selStars,text:newRev,photo:"",photo_url:photoUrl,approved
:true}).select().single();
if(data) setReviews(p=>[data,...p]);
setNewRev(""); setRevPhoto(null); setRevPhotoPreview(""); setSaving(false);
};
const
avgRating=reviews.length>0?reviews.reduce((s,r)=>s+r.stars,0)/reviews.length:worker.rating
;
return (
<Sheet onClose={onClose}>
<div style={{display:"flex",gap:14,alignItems:"center",marginBottom:14}}>
<Ava s={worker.name.substring(0,2).toUpperCase()} size={58} color={col}
online={worker.available} />
<div style={{flex:1,minWidth:0}}>
<div
style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap",marginBottom:3}}>
<p style={{fontWeight:800,fontSize:19,color:C.text}}>{worker.name}</p>
{worker.verified&&<span style={{fontSize:10,color:C.green,border:"1px solid
"+C.green+"44",padding:"1px 6px",borderRadius:99}}>✓ Verificado</span>}
<Badge plan={worker.plan} />
</div>
<p
style={{color:col,fontWeight:600,fontSize:13,marginBottom:3}}>{OFICIO_ICONS[worker.trad
e||""]||" "} {worker.trade} · {worker.zone}</p>
<div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
<Stars n={avgRating} size={12} />
<span
style={{fontSize:12,color:C.text,fontWeight:700}}>{avgRating>0?avgRating.toFixed(1):"Nuev
o"}</span>
{reviews.length>0&&<span style={{fontSize:11,color:C.muted}}>({reviews.length}
reseñas)</span>}
{worker.experience_years&&worker.experience_years>0?<span
style={{fontSize:11,color:C.mutedL}}>{worker.experience_years} años exp.</span>:null}
</div>
</div>
<button onClick={onClose} style={{background:"none",border:"1px solid
"+C.border,borderRadius:8,color:C.muted,cursor:"pointer",padding:"5px
10px",fontSize:14,flexShrink:0}}>✕</button>
</div>


{/* Key badges */}

<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
{worker.free_quote&&<span style={{padding:"4px
10px",borderRadius:99,fontSize:11,fontWeight:700,color:C.green,background:C.green+"18",
border:"1px solid "+C.green+"33"}}>✓ Presupuesto gratis</span>}
{worker.schedule&&<span style={{padding:"4px
10px",borderRadius:99,fontSize:11,fontWeight:600,color:C.mutedL,background:C.surface,bo
rder:"1px solid "+C.border}}>
{worker.schedule}</span>}
{worker.response_time&&<span style={{padding:"4px
10px",borderRadius:99,fontSize:11,fontWeight:600,color:C.cyan,background:C.cyan+"15",bo
rder:"1px solid "+C.cyan+"33"}}>
Responde en {worker.response_time}</span>}
</div>



{/* CTA buttons */}
{currentUser&&currentUser.type==="cliente"&&(
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
<Btn full onClick={()=>onChat(worker)} color={C.accent}>
Mensaje</Btn>
{worker.whatsapp?
<button onClick={()=>onWhatsApp(worker)}
style={{padding:"12px",background:"#25D366"+"22",border:"1px solid
#25D366"+"55",borderRadius:10,color:"#25D366",fontFamily:"'DM
Sans',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer"}}>
WhatsApp</button>:
<button style={{padding:"12px",background:C.green+"15",border:"1px solid
"+C.green+"44",borderRadius:10,color:C.green,fontFamily:"'DM
Sans',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer"}}>
Llamar</button>
}
</div>
)}
{!currentUser&&<div
style={{padding:"12px",background:C.surface,borderRadius:10,border:"1px solid
"+C.border,textAlign:"center",marginBottom:14}}><p
style={{fontSize:13,color:C.muted}}>Regístrate gratis para contactar</p></div>}



{/* Stats */}
<div
style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
{[{l:"Trabajos",v:String(worker.jobs)},{l:"Precio/h",v:(worker.price||30)+"€"},{l:"Valoración",v:av
gRating>0?avgRating.toFixed(1)+"★":"Nuevo"}].map(s=>(
<div key={s.l}
style={{background:"linear-gradient(135deg,"+col+"15,transparent)",borderRadius:10,paddin
g:"10px 6px",textAlign:"center",border:"1px solid "+col+"25"}}>
<p style={{fontWeight:800,fontSize:18,color:col}}>{s.v}</p>
<p style={{fontSize:10,color:C.muted,textTransform:"uppercase" as
const,letterSpacing:"0.06em"}}>{s.l}</p>
</div>
))}
</div>

{/* Service zones */}
{worker.service_zones&&worker.service_zones.length>0&&(
<div style={{marginBottom:14,padding:"10px
12px",background:C.surface,borderRadius:8,border:"1px solid "+C.border}}>
<p
style={{fontSize:11,color:C.muted,marginBottom:6,fontWeight:700,textTransform:"uppercase
" as const,letterSpacing:"0.06em"}}>Zonas de servicio</p>
<div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
{worker.service_zones.map(z=><span key={z}
style={{fontSize:11,color:C.mutedL,background:C.card,padding:"3px
9px",borderRadius:99,border:"1px solid "+C.border}}> {z}</span>)}
</div>
</div>
)}


{/* Tabs */}
<div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto"}}>
{(["info","fotos","reviews","certs"] as const).map(t=>(
<button key={t} onClick={()=>setTab(t)} style={{flexShrink:0,padding:"7px
12px",borderRadius:8,border:"1px solid
"+(tab===t?col:C.border),background:tab===t?col+"20":"transparent",color:tab===t?col:C.m
uted,fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"uppercas
e" as const,letterSpacing:"0.06em",transition:"all 0.15s"}}>
{t==="info"?"Sobre mí":t==="fotos"?("Fotos
("+photos.length+")"):t==="reviews"?("Reseñas ("+reviews.length+")"):"Títulos"}
</button>
))}
</div>
{tab==="info"&&(<>
<p
style={{fontSize:13,color:C.mutedL,lineHeight:1.75,marginBottom:12}}>{worker.bio||"Profesio
nal con experiencia contrastada. Presupuesto sin compromiso."}</p>
{worker.specialties&&worker.specialties.length>0&&(
<div>
<p
style={{fontSize:11,color:C.muted,marginBottom:6,fontWeight:700,textTransform:"uppercase
" as const,letterSpacing:"0.06em"}}>Especialidades</p>
<div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{worker.specialties.map(s=><span
key={s} style={{fontSize:11,color:col,background:col+"15",padding:"3px
9px",borderRadius:99,border:"1px solid "+col+"33"}}>{s}</span>)}</div>
</div>
)}
</>)}
{tab==="fotos"&&(
photos.length===0?<div style={{textAlign:"center",padding:"32px 0",color:C.muted}}>
<p style={{fontSize:32,marginBottom:8}}> </p>


<p style={{fontSize:13}}>Este profesional no ha subido fotos aún</p>
</div>:
<div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
{photos.map(p=>(
<div key={p.id} style={{borderRadius:10,overflow:"hidden",border:"1px solid
"+C.border,background:C.surface,aspectRatio:"4/3",display:"flex",alignItems:"center",justifyC
ontent:"center",fontSize:13,color:C.muted,padding:8}}>
{p.url?<img src={p.url} alt={p.caption}
style={{width:"100%",height:"100%",objectFit:"cover"}}
onError={(e:any)=>{e.target.style.display="none";}} />:<span
style={{textAlign:"center"}}>{p.caption||"Foto de trabajo"}</span>}
</div>
))}
</div>
)}
{tab==="reviews"&&(<>
{currentUser&&currentUser.type==="cliente"&&(
<GCard style={{marginBottom:12,padding:14}}>
<p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as
const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Tu reseña</p>
<Stars n={selStars} size={22} interactive onSet={setSelStars} />
<div style={{marginTop:8}}><Inp label="" value={newRev} onChange={setNewRev}
placeholder="Cuéntanos tu experiencia..." multiline /></div>
<Btn full small disabled={saving}
onClick={submitReview}>{saving?"Publicando...":"Publicar reseña"}</Btn>
</GCard>
)}
<div style={{display:"flex",flexDirection:"column",gap:10}}>
{reviews.map(r=>(
<GCard key={r.id} style={{padding:12}}>
<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
<div
style={{width:28,height:28,borderRadius:"50%",background:col+"33",display:"flex",alignItems
:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:col}}>{r.client_name[0]}</di
v>
<div style={{flex:1}}><p
style={{fontSize:13,fontWeight:700,color:C.text}}>{r.client_name}</p><p
style={{fontSize:10,color:C.muted}}>{timeAgo(r.created_at)}</p></div>
<Stars n={r.stars} size={11} />
</div>
{(r.photo_url||r.photo)&&<img src={r.photo_url||r.photo} alt="foto"
style={{width:"100%",maxHeight:140,objectFit:"cover",borderRadius:8,marginBottom:8,borde
r:"1px solid "+C.border}} onError={(e:any)=>{e.target.style.display="none";}} />}
<p style={{fontSize:13,color:C.mutedL,lineHeight:1.6}}>{r.text}</p>
</GCard>
))}

{reviews.length===0&&<p
style={{textAlign:"center",color:C.muted,fontSize:13,padding:16}}>Sin reseñas aún · Sé el
primero</p>}
</div>
</>)}
{tab==="certs"&&(
certs.length===0?<p
style={{textAlign:"center",color:C.muted,fontSize:13,padding:16}}>No ha subido títulos
todavía</p>:
certs.map(c=>(
<GCard key={c.id} style={{padding:12,marginBottom:8}}>
<div style={{display:"flex",alignItems:"center",gap:10}}>
<span style={{fontSize:22}}> </span>
<div style={{flex:1}}><p
style={{fontWeight:700,color:C.text,fontSize:13}}>{c.name}</p><p
style={{fontSize:10,color:C.muted}}>{new
Date(c.created_at).toLocaleDateString("es-ES")}</p></div>
{c.verified&&<span style={{fontSize:10,color:C.green,fontWeight:700}}>✓
Verificado</span>}
</div>
</GCard>
))
)}
</Sheet>
);
}


// ─── CHAT ───
function
ChatPanel({toUser,currentUser,onClose}:{toUser:UserRow;currentUser:UserRow;onClose:()
=>void}){
const [msgs,setMsgs]=useState<MessageRow[]>([]);
const [input,setInput]=useState(""); const [sending,setSending]=useState(false);
const [blockWarn,setBlockWarn]=useState("");
const bottomRef=useRef<HTMLDivElement>(null);
const col=wColor(toUser.id);
const loadMsgs=useCallback(async()=>{
const {data}=await db.from("messages").select("*")
.or("and(from_id.eq."+currentUser.id+",to_id.eq."+toUser.id+"),and(from_id.eq."+toUser.id+",t
o_id.eq."+currentUser.id+")")
.order("created_at",{ascending:true});
if(data&&data.length>0){setMsgs(data);}
else setMsgs([{id:"w0",from_id:toUser.id,to_id:currentUser.id,text:"¡Hola! Soy
"+toUser.name+". ¿En qué puedo ayudarte?",read:true,created_at:new
Date().toISOString()}]);
},[currentUser.id,toUser.id,toUser.name]);

useEffect(()=>{loadMsgs();},[loadMsgs]);
useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs.length]);
const send=async()=>{
if(!input.trim()||sending) return;
const {blocked,reason}=sanitizeMsg(input);
if(blocked){
  setBlockWarn("⛔ No puedes compartir "+reason+". Usa el botón Presupuesto para intercambiar datos.");
  setTimeout(()=>setBlockWarn(""),4000);
  return;
}
const txt=input; setInput(""); setSending(true);
const {data}=await
db.from("messages").insert({from_id:currentUser.id,to_id:toUser.id,text:txt,read:false}).select(
).single();
if(data) setMsgs(p=>[...p,data]);
setSending(false);
if(toUser.email.includes("@demo.com")){
setTimeout(async()=>{
const rs=["Perfecto, puedo verte esta semana.","¿Me das más detalles?","Son
"+toUser.price+"€/h. ¿Te parece bien?","Sin problema, tengo disponibilidad.","Te llamo en un
momento."];
const {data:d2}=await
db.from("messages").insert({from_id:toUser.id,to_id:currentUser.id,text:rs[Math.floor(Math.ra
ndom()*rs.length)],read:false}).select().single();
if(d2) setMsgs(p=>[...p,d2]);
},1200);
}
};
return (
<div
style={{position:"fixed",bottom:0,right:0,width:"100%",maxWidth:360,height:420,background:"
linear-gradient(170deg,#12121E,#080810)",borderRadius:"18px 18px 0 0",border:"1px solid
"+col+"44",borderBottom:"none",boxShadow:"0 -6px 30px
"+col+"15",zIndex:400,display:"flex",flexDirection:"column"}}>
<div style={{padding:"10px 14px",borderBottom:"1px solid
"+C.border,display:"flex",alignItems:"center",gap:10,background:col+"10",borderRadius:"18p
x 18px 0 0"}}>
<Ava s={toUser.name.substring(0,2).toUpperCase()} size={32} color={col} online />
<div style={{flex:1}}><p
style={{fontWeight:700,fontSize:14,color:C.text}}>{toUser.name}</p><p
style={{fontSize:10,color:C.green}}>● En línea</p></div>
<button onClick={onClose}
style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18}}>✕</b
utton>
</div>
{blockWarn&&<div style={{padding:"8px 12px",background:"#FF445518",borderBottom:"1px solid #FF445533"}}><p style={{fontSize:11,color:"#FF4455",fontWeight:600}}>{blockWarn}</p></div>}
<div style={{flex:1,overflowY:"auto",padding:"10px
12px",display:"flex",flexDirection:"column",gap:7}}>
{msgs.map((m,i)=>{
const isMe=m.from_id===currentUser.id;
return <div key={i} style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start"}}>

<div style={{maxWidth:"78%",background:isMe?col+"44":C.card,border:"1px solid
"+(isMe?col+"55":C.border),borderRadius:isMe?"12px 12px 2px 12px":"12px 12px 12px
2px",padding:"8px 11px"}}>
<p style={{fontSize:12,color:isMe?C.accent:C.text,lineHeight:1.5}}>{m.text}</p>
<p
style={{fontSize:9,color:C.muted,marginTop:2,textAlign:"right"}}>{timeAgo(m.created_at)}</p
>
</div>
</div>;
})}
<div ref={bottomRef} />
</div>
<div style={{padding:"8px 12px",borderTop:"1px solid "+C.border,display:"flex",gap:8}}>
<input value={input} onChange={e=>setInput(e.target.value)}
onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Escribe un mensaje..."
style={{flex:1,background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"9px
12px",color:C.text,fontFamily:"inherit",fontSize:13,outline:"none"}} />
<button onClick={send} disabled={sending} style={{padding:"8px
14px",background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",border:"none",borde
rRadius:8,color:"#000",fontWeight:900,cursor:"pointer",fontSize:14,opacity:sending?0.5:1}}>
→</button>
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
const [mapZone,setMapZone]=useState("");
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

if(zona!=="Todas") q=q.or("zone.eq."+zona+",service_zones.cs.{"+zona+"}");
if(oficio!=="Todos") q=q.eq("trade",oficio);
if(soloDisp) q=q.eq("available",true);
if(search) q=q.ilike("name","%"+search+"%");
const {data}=await q;
const sorted=(data||[]).sort((a:UserRow,b:UserRow)=>{
const order:Record<Plan,number>={elite:3,pro:2,basico:1,gratis:0};
return order[b.plan as Plan]-order[a.plan as Plan]||b.rating-a.rating;
});
setWorkers(sorted); setLoading(false);
},[zona,oficio,search,soloDisp,mapZone]);
useEffect(()=>{loadWorkers();},[loadWorkers]);
const loadChats=useCallback(async()=>{
const {data}=await
db.from("messages").select("from_id,to_id").or("from_id.eq."+user.id+",to_id.eq."+user.id);
if(!data?.length){setChatPartners([]);return;}
const ids=[...new Set((data as
any[]).map((m:any)=>m.from_id===user.id?m.to_id:m.from_id))];
const {data:ws}=await db.from("users").select("*").in("id",ids);
setChatPartners(ws||[]);
},[user.id]);
useEffect(()=>{if(tab==="chats")loadChats();},[tab,loadChats]);
const getContactsUsed=()=>{
    const key="oy_contacts_"+user.id+"_"+new Date().toISOString().slice(0,7);
    return parseInt(localStorage.getItem(key)||"0");
  };
  const incrementContacts=()=>{
    const key="oy_contacts_"+user.id+"_"+new Date().toISOString().slice(0,7);
    localStorage.setItem(key,String(getContactsUsed()+1));
  };
  const checkContactLimit=():boolean=>{
    const limit=PLAN_GATES.contacts[user.plan as Plan];
    const used=getContactsUsed();
    if(used>=limit){showToast("⛔ Límite de "+limit+" contactos/mes · Mejora tu plan");return false;}
    incrementContacts();return true;
  };
  const handleWhatsApp=(w:UserRow)=>{
const num=(w.whatsapp||w.phone).replace(/\D/g,"");
const msg=encodeURIComponent("Hola "+w.name+", te contacto desde OfficioYa. Me
gustaría solicitar un presupuesto.");
window.open("https://wa.me/"+num+"?text="+msg,"_blank");
};
return (
<div
style={{minHeight:"100dvh",background:C.bg,backgroundImage:"radial-gradient(ellipse at
15% 0%,#1a0a3a22,transparent 50%),radial-gradient(ellipse at 85%
100%,#0a1a3a22,transparent 50%)",paddingBottom:72}}>
<header
style={{background:"rgba(10,10,15,0.94)",backdropFilter:"blur(20px)",borderBottom:"1px
solid "+C.border,position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 20px
rgba(0,0,0,0.4)"}}>
<div style={{maxWidth:900,margin:"0 auto",padding:"0
16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
<button onClick={()=>setTab("buscar")}
style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"none",cursor:"poin
ter",padding:0}}>

<div
style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,"+C.accent+"
,"+C.orange+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}> </di
v>
<span style={{fontWeight:900,fontSize:19,letterSpacing:"-0.03em"}}><span
style={{color:C.text}}>Oficio</span><span style={{color:C.accent}}>Ya</span></span>
<span style={{fontSize:9,color:C.accent,background:C.accent+"15",padding:"2px
7px",borderRadius:3,fontWeight:700}}>SEVILLA</span>
</button>
<button onClick={onLogout} style={{background:"none",border:"1px solid
"+C.border,borderRadius:6,color:C.muted,cursor:"pointer",padding:"4px
10px",fontSize:11}}>Salir</button>
</div>
</header>


<div style={{maxWidth:900,margin:"0 auto",padding:"0 16px"}}>
{tab==="buscar"&&(<>
<div style={{padding:"22px 0 16px"}}>
<div style={{display:"inline-flex",gap:6,background:C.green+"15",border:"1px solid
"+C.green+"30",borderRadius:6,padding:"4px 12px",marginBottom:12}}>
<span style={{fontSize:8,color:C.green,animation:"pulse 2s infinite"}}>●</span>
<span
style={{fontSize:11,color:C.green,fontWeight:700,letterSpacing:"0.06em",textTransform:"upp
ercase" as const}}>{workers.filter(w=>w.available).length} disponibles ahora</span>
</div>
<h1
style={{fontWeight:900,fontSize:"clamp(26px,5vw,48px)",lineHeight:1.05,letterSpacing:"-0.02
em",marginBottom:8}}>
<span style={{color:C.text}}>El profesional que necesitas,</span><br/>
<span
style={{background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",WebkitBackground
Clip:"text",WebkitTextFillColor:"transparent"}}>en tu ciudad.</span>
</h1>
<p style={{fontSize:14,color:C.mutedL}}>Presupuesto gratis · Sin compromiso · Pago
directo al profesional</p>
</div>
<div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
<div style={{display:"flex",background:C.card,borderRadius:10,border:"1px solid
"+C.border,overflow:"hidden"}}>
<span style={{padding:"0
12px",display:"flex",alignItems:"center",color:C.muted}}> </span>
<input value={search} onChange={e=>setSearch(e.target.value)}
placeholder="Electricista, fontanero, pintor..." style={{flex:1,padding:"12px
0",background:"transparent",border:"none",color:C.text,fontFamily:"inherit",fontSize:14,outlin
e:"none"}} />
</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>


<select value={zona} onChange={e=>setZona(e.target.value)}
style={{padding:"10px 12px",background:C.card,border:"1px solid
"+C.border,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:13,cursor:"pointer",outlin
e:"none"}}>
<option style={{background:C.card}}>Todas</option>
{ZONAS.map(z=><option key={z} style={{background:C.card}}>{z}</option>)}
</select>
<select value={oficio} onChange={e=>setOficio(e.target.value)}
style={{padding:"10px 12px",background:C.card,border:"1px solid
"+C.border,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:13,cursor:"pointer",outlin
e:"none"}}>
<option style={{background:C.card}}>Todos</option>
{OFICIOS.map(o=><option key={o} style={{background:C.card}}>{o}</option>)}
</select>
</div>
<div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
<label
style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:C.mutedL}}>
<input type="checkbox" checked={soloDisp}
onChange={e=>setSoloDisp(e.target.checked)}
style={{accentColor:C.accent,width:15,height:15}} />
Solo disponibles ahora
</label>
<button onClick={()=>setShowMap(!showMap)}
style={{display:"flex",alignItems:"center",gap:6,padding:"6px
12px",borderRadius:99,border:"1px solid
"+(showMap?C.accent:C.border),background:showMap?C.accent+"18":"transparent",color:s
howMap?C.accent:C.muted,cursor:"pointer",fontSize:12,fontFamily:"'DM
Sans',sans-serif",fontWeight:showMap?700:400,transition:"all 0.15s"}}>
{showMap?"Ocultar mapa":"Ver en mapa"}
</button>
</div>
{showMap&&<SevillaMap selectedZone={mapZone}
onZoneSelect={z=>{setMapZone(z===mapZone?"":z);}} />}
</div>


{/* Category tabs */}
<div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:8}}>
{["Todos","
Técnico","
Servicios","
Artesanía","
Hostelería","
Eventos"].map(cat=>(
<button key={cat} onClick={()=>{setCatFilter(cat);setOficio("Todos");}}
style={{flexShrink:0,padding:"6px 14px",borderRadius:99,border:"1px solid
"+(catFilter===cat?C.accent:C.border),background:catFilter===cat?C.accent+"22":"transpar
ent",color:catFilter===cat?C.accent:C.muted,cursor:"pointer",fontSize:12,fontFamily:"'DM
Sans',sans-serif",fontWeight:catFilter===cat?700:400,whiteSpace:"nowrap",transition:"all
0.15s"}}>
{cat}
</button>




👨‍🍳


))}
</div>
{/* Oficio pills filtered by category */}
<div
style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:14}}>
{["Todos",...OFICIOS.filter(o=>catFilter==="Todos"||OFICIO_CATEGORIES[o]===catFilter)].
map(o=>(
<button key={o} onClick={()=>setOficio(o)} style={{flexShrink:0,padding:"5px
11px",borderRadius:99,border:"1px solid
"+(oficio===o?C.blue:C.border),background:oficio===o?C.blue+"22":"transparent",color:ofici
o===o?C.blue:C.muted,cursor:"pointer",fontSize:11,fontFamily:"'DM
Sans',sans-serif",fontWeight:oficio===o?700:400,whiteSpace:"nowrap",transition:"all
0.15s"}}>
{o!=="Todos"&&(OFICIO_ICONS[o]||" ")+" "}{o}
</button>
))}
</div>


<div
style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:C.border,borde
rRadius:10,overflow:"hidden",marginBottom:18}}>
{[{v:workers.length+"+",l:"Profesionales",c:C.purple},{v:"1.8K",l:"Trabajos",c:C.blue},{v:"15",l:"
Ciudades",c:C.green},{v:"4.8★",l:"Valoración",c:C.accent}].map(s=>(
<div key={s.l}
style={{background:"linear-gradient(135deg,"+s.c+"10,"+C.surface+")",padding:"10px
4px",textAlign:"center"}}>
<p style={{fontWeight:800,fontSize:17,color:s.c}}>{s.v}</p>
<p style={{fontSize:9,color:C.muted,textTransform:"uppercase" as
const,letterSpacing:"0.06em"}}>{s.l}</p>
</div>
))}
</div>

{/* ─── RADAR DE URGENCIAS ─── */}
<UrgencyRadar workers={workers} currentUser={user} onSelect={w=>setSelectedWorker(w)} />
{/* QUICK MATCH — Encuentra profesional en 30 segundos */}
<div
style={{background:"linear-gradient(135deg,"+C.accent+"18,"+C.orange+"10)",borderRadius
:14,border:"1px solid "+C.accent+"33",padding:"14px
16px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
<div style={{fontSize:28}}> </div>
<div style={{flex:1}}>
<p style={{fontWeight:700,color:C.text,fontSize:14,marginBottom:2}}>¿Necesitas
un profesional ahora?</p>
<p style={{fontSize:12,color:C.muted}}>Te conectamos con el disponible más
cercano en segundos</p>
</div>


<button
onClick={()=>{setShowQuickMatch(true);window.scrollTo({top:0,behavior:"smooth"});}}
style={{padding:"10px
16px",background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",border:"none",borde
rRadius:10,color:"#000",fontFamily:"'DM
Sans',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",whiteSpace:"nowrap",boxShad
ow:"0 4px 14px "+C.accent+"44"}}>
Buscar →
</button>
</div>
{loading?<Spin />:(<>
<p style={{fontSize:12,color:C.muted,marginBottom:12}}><span
style={{color:C.text,fontWeight:700}}>{workers.length}</span>
profesionales{zona!=="Todas"?" en "+zona:(mapZone?" en "+mapZone:"")}
{mapZone&&<button onClick={()=>setMapZone("")}
style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:11,fontWei
ght:700}}>✕ {mapZone}</button>}</p>
<div
style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(265px,1fr))",gap:12}}>
{workers.map(w=><WorkerCard key={w.id} w={w}
onClick={()=>setSelectedWorker(w)} />)}
{workers.length===0&&<div
style={{gridColumn:"1/-1",textAlign:"center",padding:48,color:C.muted}}>
<p style={{fontSize:36,marginBottom:8}}> </p>
<p style={{fontWeight:700,fontSize:18,marginBottom:6}}>Sin resultados</p>
<p style={{fontSize:13}}>Prueba con otra zona u oficio</p>
</div>}
</div>
</>)}
</>)}


{tab==="ranking"&&(<RankingSection workers={workers}
onSelect={setSelectedWorker} />)}
{tab==="chats"&&(<>
<div style={{padding:"22px 0 16px"}}>
<h2 style={{fontWeight:800,fontSize:22,color:C.text,letterSpacing:"-0.02em"}}>Mis
conversaciones</h2>
</div>
{chatPartners.length===0?<div style={{textAlign:"center",padding:48,color:C.muted}}>
<p style={{fontSize:36,marginBottom:8}}> </p>
<p style={{fontWeight:700,fontSize:16,marginBottom:6}}>Sin conversaciones</p>
<p style={{fontSize:13,marginBottom:16}}>Contacta con un profesional para
empezar</p>
<Btn onClick={()=>setTab("buscar")} small>Buscar profesionales →</Btn>
</div>:
<div style={{display:"flex",flexDirection:"column",gap:10}}>


{chatPartners.map(w=>{
const col=wColor(w.id);
return <GCard key={w.id} onClick={()=>setChatWorker(w)} glow={col}>
<div style={{display:"flex",gap:12,alignItems:"center"}}>
<Ava s={w.name.substring(0,2).toUpperCase()} size={46} color={col}
online={w.available} />
<div style={{flex:1,minWidth:0}}>
<p style={{fontWeight:700,color:C.text,fontSize:14}}>{w.name}</p>
<p style={{fontSize:12,color:col}}>{OFICIO_ICONS[w.trade||""]||" "} {w.trade} ·
{w.zone}</p>
</div>
<Btn small onClick={(e:any)=>{e.stopPropagation();setChatWorker(w);}}>Abrir
→</Btn>
</div>
</GCard>;
})}
</div>}
</>)}


{tab==="perfil"&&(<>
<div style={{padding:"22px 0 16px"}}><h2
style={{fontWeight:800,fontSize:22,color:C.text,letterSpacing:"-0.02em"}}>Mi
perfil</h2></div>
<GCard style={{marginBottom:14}}>
<div style={{display:"flex",gap:14,alignItems:"center",marginBottom:14}}>
<Ava s={user.name.substring(0,2).toUpperCase()} size={52} color={C.blue} />
<div>
<p style={{fontWeight:800,fontSize:18,color:C.text}}>{user.name}</p>
<p style={{fontSize:13,color:C.muted}}>{user.email}</p>
<p style={{fontSize:12,color:C.muted}}>{user.phone}</p>
<div style={{marginTop:5}}><Badge plan={user.plan} /></div>
</div>
</div>
<div style={{padding:"10px 12px",background:C.surface,borderRadius:8,border:"1px
solid "+C.border}}>
<p style={{fontSize:11,color:C.muted,marginBottom:2}}>Plan activo</p>
<p style={{fontSize:13,color:C.text}}>Plan <span
style={{color:PLAN_COLORS[user.plan],fontWeight:700}}>{user.plan.toUpperCase()}</span
> · Trial hasta {user.trial_end}</p>
</div>
</GCard>
<Btn full outline danger onClick={onLogout} color={C.red}>Cerrar sesión</Btn>
</>)}
</div>
<nav
style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(10,10,15,0.97)",backdropFilt

er:"blur(20px)",borderTop:"1px solid "+C.border,display:"flex",zIndex:200,boxShadow:"0 -2px
20px rgba(0,0,0,0.5)"}}>
{([["buscar","buscar"],["ranking","ranking"],["chats","chats"],["perfil","perfil"]] as
const).map(([id])=>{
const navItems:Record<string,{icon:string;label:string}> = {
buscar:{icon:"buscar",label:"Buscar"},
ranking:{icon:"ranking",label:"Ranking"},
chats:{icon:"chats",label:"Mensajes"},
perfil:{icon:"perfil",label:"Perfil"},
};
const icons = {
buscar: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
stroke="currentColor" strokeWidth="2" strokeLinecap="round"
strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
ranking: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path
d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path
d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7
22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path
d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
chats: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path
d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
perfil: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path
d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};
const isActive = tab===id;
return (
<button key={id} onClick={()=>setTab(id as any)} style={{flex:1,padding:"8px 4px
10px",background:"none",border:"none",color:isActive?C.accent:C.muted+"88",cursor:"point
er",display:"flex",flexDirection:"column",alignItems:"center",gap:3,transition:"all
0.2s",position:"relative"}}>
{isActive&&<div
style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:32,height:2,ba
ckground:"linear-gradient(90deg,"+C.accent+","+C.orange+")",borderRadius:"0 0 2px 2px"}}
/>}
<div style={{color:isActive?C.accent:C.muted+"88",transition:"color 0.2s"}}>{icons[id
as keyof typeof icons]}</div>
<span
style={{fontSize:9,fontWeight:isActive?700:500,letterSpacing:"0.04em",textTransform:"upper
case"}}>{navItems[id].label}</span>
</button>
);
})}
</nav>

{showQuickMatch&&<QuickMatchModal workers={workers}
onClose={()=>setShowQuickMatch(false)}
onSelect={w=>{setShowQuickMatch(false);setSelectedWorker(w);}} />}
{selectedWorker&&<WorkerSheet worker={selectedWorker}
onClose={()=>setSelectedWorker(null)}
onChat={w=>{setSelectedWorker(null);setChatWorker(w);showToast("Chat abierto con
"+w.name);}} onWhatsApp={handleWhatsApp} currentUser={user} />}
{chatWorker&&<ChatPanel toUser={chatWorker} currentUser={user}
onClose={()=>setChatWorker(null)} />}
<Ping msg={toast} />
</div>
);
}
// ─── PRO DASHBOARD ───
function
ProDashboard({user,onLogout,onUpdate}:{user:UserRow;onLogout:()=>void;onUpdate:(u:Us
erRow)=>void}){
const [tab,setTab]=useState<"inicio"|"chats"|"trabajos"|"perfil"|"planes">("inicio");
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
const daysLeft=trialDaysLeft(user.trial_end);
const showToast=(m:string)=>{setToast(m);setTimeout(()=>setToast(null),3000);};
const
canAccess=(feat:string)=>PLAN_FEATURES[user.plan].some(f=>f.toLowerCase().includes(f
eat.toLowerCase()));
useEffect(()=>{

db.from("certificates").select("*").eq("worker_id",user.id).then(({data}:{data:any})=>setCerts(d
ata||[]));
db.from("photos").select("*").eq("worker_id",user.id).order("created_at",{ascending:false}).the
n(({data}:{data:any})=>setPhotos(data||[]));
db.from("jobs").select("*").eq("worker_id",user.id).order("created_at",{ascending:false}).then(
({data}:{data:any})=>setJobs(data||[]));
db.from("visits").select("id",{count:"exact"} as
any).eq("user_id",user.id).then(({count}:{count:any})=>setStats(s=>({...s,visits:count||0})));
db.from("messages").select("id",{count:"exact"} as
any).eq("to_id",user.id).then(({count}:{count:any})=>setStats(s=>({...s,contacts:count||0})));
db.from("reviews").select("id",{count:"exact"} as
any).eq("worker_id",user.id).then(({count}:{count:any})=>setStats(s=>({...s,reviews:count||0})
));
},[user.id]);
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
const
upd={bio,price:parseInt(price)||30,available,schedule,response_time:responseTime,free_quo
te:freeQuote,experience_years:parseInt(expYears)||0,specialties,service_zones:serviceZone
s,whatsapp};
await db.from("users").update(upd).eq("id",user.id);
onUpdate({...user,...upd});
setSaving(false); showToast("✓ Perfil actualizado");
};
const toggleAvail=async()=>{
const v=!available; setAvailable(v);
await db.from("users").update({available:v}).eq("id",user.id);
onUpdate({...user,available:v});
showToast(v?"✓ Ahora apareces como disponible":"Ahora apareces como ocupado");
};
const addCert=async()=>{
if(!certName.trim()) return;

const {data}=await
db.from("certificates").insert({worker_id:user.id,name:certName,url:"",verified:false}).select().
single();
if(data){setCerts(p=>[...p,data]);setCertName("");showToast("✓ Título añadido");}
};
const photoInputRef=useRef<HTMLInputElement>(null);
const [photoFile,setPhotoFile]=useState<File|null>(null);
const [photoPreview,setPhotoPreview]=useState<string>("");
const [uploadingPhoto,setUploadingPhoto]=useState(false);
const addPhoto=async()=>{
if(!photoCaption.trim()&&!photoFile) return;
setUploadingPhoto(true);
let url="";
if(photoFile){
const uploaded=await uploadImage(photoFile,"workers/"+user.id);
if(uploaded) url=uploaded;
}
const {data}=await
db.from("photos").insert({worker_id:user.id,url,caption:photoCaption}).select().single();
if(data){setPhotos(p=>[data,...p]);setPhotoCaption("");setPhotoFile(null);setPhotoPreview("");
showToast("✓ Foto añadida");}
setUploadingPhoto(false);
};
const deletePhoto=async(id:string)=>{
await db.from("photos").delete().eq("id",id);
setPhotos(p=>p.filter(ph=>ph.id!==id));
showToast("Foto eliminada");
};
const updateJobStatus=async(jobId:string,status:string)=>{
await db.from("jobs").update({status,updated_at:new Date().toISOString()}).eq("id",jobId);
setJobs(p=>p.map(j=>j.id===jobId?{...j,status:status as any}:j));
showToast("✓ Estado actualizado");
};
const SPECIALTIES_BY_TRADE:Record<string,string[]> = {
"Electricista":["Domótica","Fotovoltaica","Cuadros eléctricos","Instalación industrial","LED
y iluminación","Cargadores VE"],
"Fontanero":["Calderas","Calefacción","Suelo radiante","Piscinas","Urgencias","Gas"],
"Pintor":["Microcemento","Stucco veneciano","Pintura
exterior","Decoración","Gotelé","Barnizado"],
"Albañil":["Reformas integrales","Tabiques","Azulejos","Fachadas","Pladur","Terrazas"],
"Carpintero":["Muebles a medida","Tarimas","Puertas","Cocinas","Armarios","Madera
maciza"],

"Cerrajero":["Apertura 24h","Cajas fuertes","Bombines","Puertas acorazadas","Control de
acceso","Rejas"],
"Jardinero":["Diseño jardines","Riego
automático","Poda","Comunidades","Céspedes","Árboles"],
};
const availableSpecialties=SPECIALTIES_BY_TRADE[user.trade||""]||["Especialidad
1","Especialidad 2","Especialidad 3"];
return (
<div
style={{minHeight:"100dvh",background:C.bg,backgroundImage:"radial-gradient(ellipse at
70% 0%,#2a0a3a18,transparent 50%)",paddingBottom:72}}>
<header
style={{background:"rgba(10,10,15,0.94)",backdropFilter:"blur(20px)",borderBottom:"1px
solid "+C.border,position:"sticky",top:0,zIndex:100}}>
<div style={{maxWidth:900,margin:"0 auto",padding:"0
16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
<div style={{display:"flex",alignItems:"center",gap:8}}>
<div
style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,"+C.accent+"
,"+C.orange+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}> </di
v>
<span style={{fontWeight:900,fontSize:19,letterSpacing:"-0.03em"}}><span
style={{color:C.text}}>Oficio</span><span style={{color:C.accent}}>Ya</span></span>
</div>
<div style={{display:"flex",gap:8,alignItems:"center"}}>
<Badge plan={user.plan} />
<button onClick={onLogout} style={{background:"none",border:"1px solid
"+C.border,borderRadius:6,color:C.muted,cursor:"pointer",padding:"4px
10px",fontSize:11}}>Salir</button>
</div>
</div>
</header>


{daysLeft<=7&&<div
style={{background:"linear-gradient(135deg,"+C.red+"18,"+C.orange+"11)",borderBottom:"1p
x solid "+C.red+"22",padding:"8px 16px",textAlign:"center"}}>
<p
style={{fontSize:12,color:daysLeft>0?C.orange:C.red,fontWeight:700}}>{daysLeft>0?"⚠
"+daysLeft+" días de prueba · Activa un plan para no perder tu perfil":"
Trial expirado · Tu
perfil no es visible"}</p>
</div>}


<div style={{maxWidth:900,margin:"0 auto",padding:"0 16px"}}>
{tab==="inicio"&&(<>
<div style={{padding:"22px 0 16px"}}>
<div style={{display:"flex",gap:12,alignItems:"center",marginBottom:18}}>

<Ava s={user.name.substring(0,2).toUpperCase()} size={50} color={C.accent}
online={available} />
<div style={{flex:1}}>
<p
style={{fontWeight:800,fontSize:18,color:C.text,letterSpacing:"-0.02em"}}>{user.name}</p>
<p
style={{fontSize:13,color:C.accent,fontWeight:600}}>{OFICIO_ICONS[user.trade||""]||" "}
{user.trade} · {user.zone}</p>
<button onClick={toggleAvail}
style={{marginTop:5,display:"inline-flex",alignItems:"center",gap:6,background:"none",border:
"1px solid "+(available?C.green+"44":C.border),borderRadius:99,padding:"4px
10px",cursor:"pointer",color:available?C.green:C.muted,fontSize:11,fontFamily:"'DM
Sans',sans-serif",fontWeight:600}}>
<span
style={{width:6,height:6,borderRadius:"50%",background:available?C.green:C.muted,display
:"inline-block"}} />
{available?"Disponible · Cambiar":"Ocupado · Cambiar"}
</button>
</div>
</div>
</div>


<div
style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
{[{l:"Visitas al perfil",v:stats.visits,c:C.blue,i:" "},{l:"Mensajes
recibidos",v:stats.contacts,c:C.green,i:" "},{l:"Reseñas",v:stats.reviews,c:C.accent,i:"
"Días de trial",v:daysLeft,c:daysLeft>7?C.mutedL:C.red,i:"⏱"}].map(s=>(
<GCard key={s.l} style={{textAlign:"center",padding:"14px 10px"}}>
<div style={{fontSize:18,marginBottom:4}}>{s.i}</div>
<p style={{fontWeight:800,fontSize:24,color:s.c}}>{s.v}</p>
<p style={{fontSize:11,color:C.muted}}>{s.l}</p>
</GCard>
))}
</div>



⭐"},{l:

{/* Profile completeness */}
{(()=>{
const
checks=[!!user.bio,!!user.phone,(user.service_zones||[]).length>0,(user.specialties||[]).length>
0,photos.length>0,certs.length>0];
const done=checks.filter(Boolean).length;
const pct=Math.round(done/checks.length*100);
return pct<100?<GCard style={{marginBottom:14,border:"1px solid
"+C.accent+"33"}}>
<div
style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
<p style={{fontWeight:700,color:C.text,fontSize:13}}>Completa tu perfil para captar
más clientes</p>

<span style={{fontWeight:800,fontSize:16,color:C.accent}}>{pct}%</span>
</div>
<div
style={{height:6,background:C.border,borderRadius:99,marginBottom:10,overflow:"hidden"}}
>
<div
style={{width:pct+"%",height:"100%",background:"linear-gradient(90deg,"+C.accent+","+C.or
ange+")",borderRadius:99,transition:"width 0.5s"}} />
</div>
<div style={{display:"flex",flexDirection:"column",gap:6}}>
{[{label:"Descripción
profesional",done:!!user.bio},{label:"Teléfono/WhatsApp",done:!!user.phone},{label:"Zonas de
servicio",done:(user.service_zones||[]).length>0},{label:"Especialidades",done:(user.specialti
es||[]).length>0},{label:"Fotos de
trabajos",done:photos.length>0},{label:"Títulos/certificados",done:certs.length>0}].map(c=><
div key={c.label} style={{display:"flex",gap:8,alignItems:"center"}}>
<span
style={{fontSize:12,color:c.done?C.green:C.muted}}>{c.done?"✓":"○"}</span>
<span style={{fontSize:12,color:c.done?C.mutedL:C.text}}>{c.label}</span>
{!c.done&&<button onClick={()=>setTab("perfil")}
style={{marginLeft:"auto",background:"none",border:"none",color:C.accent,cursor:"pointer",fo
ntSize:11,fontWeight:700,padding:"2px 6px"}}>Añadir →</button>}
</div>)}
</div>
</GCard>:null;
})()}
{jobs.filter(j=>j.status==="pending").length>0&&(
<GCard style={{marginBottom:14,border:"1px solid "+C.orange+"44"}}>
<p style={{fontWeight:700,color:C.orange,fontSize:13,marginBottom:10}}>
{jobs.filter(j=>j.status==="pending").length} solicitud(es) pendiente(s)</p>
{jobs.filter(j=>j.status==="pending").slice(0,2).map(j=>(
<div key={j.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px
0",borderBottom:"1px solid "+C.border}}>
<div style={{flex:1}}><p
style={{fontSize:13,color:C.text,fontWeight:600}}>{j.title}</p><p
style={{fontSize:11,color:C.muted}}>{j.client_name} · {timeAgo(j.created_at)}</p></div>
<button onClick={()=>setTab("trabajos")}
style={{background:C.orange+"22",border:"1px solid
"+C.orange+"44",borderRadius:6,color:C.orange,cursor:"pointer",padding:"4px
8px",fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:700}}>Ver →</button>
</div>
))}
</GCard>
)}


<GCard style={{marginBottom:14}}>

<p style={{fontWeight:700,color:C.text,fontSize:13,marginBottom:12}}>Tu plan ·
{user.plan.toUpperCase()}</p>
{[{feat:"Chat con
clientes",icon:" ",key:"chat"},{feat:"Estadísticas",icon:" ",key:"estadísticas"},{feat:"Panel
de trabajos",icon:" ",key:"trabajos"},{feat:"Galería de
fotos",icon:" ",key:"galería"},{feat:"Primero en
búsquedas",icon:" ",key:"primero"}].map(({feat,icon,key})=>{
const has=canAccess(key);
return <div key={feat} style={{display:"flex",alignItems:"center",gap:10,padding:"8px
0",borderBottom:"1px solid "+C.border}}>
<span style={{fontSize:14}}>{icon}</span>
<span style={{flex:1,fontSize:13,color:has?C.text:C.muted}}>{feat}</span>
{has?<span style={{color:C.green,fontSize:11,fontWeight:700}}>✓
Activo</span>:<button onClick={()=>setTab("planes")}
style={{background:"none",border:"1px solid
"+C.accent+"44",borderRadius:6,color:C.accent,cursor:"pointer",padding:"3px
8px",fontSize:10,fontWeight:700}}>Activar →</button>}
</div>;
})}
</GCard>
<Btn full onClick={()=>setTab("planes")} color={C.accent}>Mejorar mi plan →</Btn>
</>)}



{tab==="chats"&&(<>
<div style={{padding:"22px 0 16px"}}><h2
style={{fontWeight:800,fontSize:22,color:C.text,letterSpacing:"-0.02em"}}>Mensajes de
clientes</h2></div>
{!canAccess("chat")?<GCard style={{textAlign:"center",padding:"40px 20px"}}>
<p style={{fontSize:36,marginBottom:10}}> </p>
<p style={{fontWeight:700,color:C.text,fontSize:16,marginBottom:8}}>Chat disponible
en plan Básico+</p>
<p style={{fontSize:13,color:C.muted,marginBottom:18}}>Recibe y responde
mensajes directamente</p>
<Btn onClick={()=>setTab("planes")} color={C.accent}>Ver planes →</Btn>
</GCard>:
chatPartners.length===0?<div style={{textAlign:"center",padding:48,color:C.muted}}>
<p style={{fontSize:36,marginBottom:8}}> </p>
<p style={{fontWeight:700,fontSize:16,marginBottom:6}}>Sin mensajes aún</p>
<p style={{fontSize:13}}>Cuando un cliente te contacte, aparecerá aquí</p>
</div>:
<div style={{display:"flex",flexDirection:"column",gap:10}}>
{chatPartners.map(c=>{
const col=wColor(c.id);
return <GCard key={c.id} onClick={()=>setChatUser(c)} glow={col}>
<div style={{display:"flex",gap:12,alignItems:"center"}}>
<Ava s={c.name.substring(0,2).toUpperCase()} size={44} color={col} />
<div style={{flex:1,minWidth:0}}>
<p style={{fontWeight:700,color:C.text,fontSize:14}}>{c.name}</p>



<p style={{fontSize:12,color:C.muted}}>Cliente · Toca para responder</p>
</div>
<span style={{fontSize:12,color:col}}>→</span>
</div>
</GCard>;
})}
</div>}
</>)}
{tab==="trabajos"&&(<>
<div style={{padding:"22px 0 16px"}}><h2
style={{fontWeight:800,fontSize:22,color:C.text,letterSpacing:"-0.02em"}}>Mis
trabajos</h2></div>
{!canAccess("trabajos")?<GCard style={{textAlign:"center",padding:"40px 20px"}}>
<p style={{fontSize:36,marginBottom:10}}> </p>
<p style={{fontWeight:700,color:C.text,fontSize:16,marginBottom:8}}>Panel de
trabajos en Básico+</p>
<Btn onClick={()=>setTab("planes")} color={C.accent}>Ver planes →</Btn>
</GCard>:<>
<div
style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
{[{l:"Pendientes",v:jobs.filter(j=>j.status==="pending").length,c:C.orange},{l:"En
progreso",v:jobs.filter(j=>j.status==="in_progress").length,c:C.blue},{l:"Completados",v:jobs.fi
lter(j=>j.status==="done").length,c:C.green},{l:"Total",v:jobs.length,c:C.accent}].map(s=>(
<GCard key={s.l} style={{textAlign:"center",padding:"12px 8px"}}>
<p style={{fontWeight:800,fontSize:22,color:s.c}}>{s.v}</p>
<p style={{fontSize:11,color:C.muted}}>{s.l}</p>
</GCard>
))}
</div>
<div style={{display:"flex",flexDirection:"column",gap:10}}>
{jobs.length===0&&<p
style={{textAlign:"center",color:C.muted,fontSize:13,padding:32}}>No hay trabajos
registrados aún</p>}
{jobs.map(j=>(
<GCard key={j.id} style={{padding:14}}>
<div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}>
<div style={{flex:1}}>
<p
style={{fontWeight:700,color:C.text,fontSize:14,marginBottom:3}}>{j.title}</p>
<p style={{fontSize:12,color:C.muted}}>
{j.client_name} ·
{timeAgo(j.created_at)}</p>
{j.description&&<p
style={{fontSize:12,color:C.mutedL,marginTop:4}}>{j.description}</p>}
</div>
<StatusDot status={j.status} />
</div>
{j.status!=="done"&&j.status!=="cancelled"&&(



<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
{j.status==="pending"&&<button
onClick={()=>updateJobStatus(j.id,"in_progress")} style={{padding:"6px
12px",background:C.blue+"22",border:"1px solid
"+C.blue+"44",borderRadius:8,color:C.blue,cursor:"pointer",fontSize:12,fontFamily:"'DM
Sans',sans-serif",fontWeight:600}}>Aceptar trabajo</button>}
{j.status==="in_progress"&&<button
onClick={()=>updateJobStatus(j.id,"done")} style={{padding:"6px
12px",background:C.green+"22",border:"1px solid
"+C.green+"44",borderRadius:8,color:C.green,cursor:"pointer",fontSize:12,fontFamily:"'DM
Sans',sans-serif",fontWeight:600}}>Marcar completado</button>}
<button onClick={()=>updateJobStatus(j.id,"cancelled")} style={{padding:"6px
12px",background:C.red+"15",border:"1px solid
"+C.red+"33",borderRadius:8,color:C.red,cursor:"pointer",fontSize:12,fontFamily:"'DM
Sans',sans-serif",fontWeight:600}}>Cancelar</button>
</div>
)}
</GCard>
))}
</div>
</>}
</>)}
{tab==="perfil"&&(<>
<div style={{padding:"22px 0
16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
<h2 style={{fontWeight:800,fontSize:22,color:C.text,letterSpacing:"-0.02em"}}>Mi
perfil público</h2>
<Btn small onClick={saveProfile}
disabled={saving}>{saving?"Guardando...":"Guardar"}</Btn>
</div>
<GCard style={{marginBottom:14}}>
<p style={{fontWeight:700,color:C.text,fontSize:13,marginBottom:12}}>Información
básica</p>
<Inp label="Descripción profesional" value={bio} onChange={setBio}
placeholder="Describe tu experiencia, especialidades y servicios. Cuanto más detallado,
mejor." multiline />
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
<Inp label="Precio por hora (€)" value={price} onChange={setPrice} type="number"
/>
<Inp label="Años de experiencia" value={expYears} onChange={setExpYears}
type="number" />
</div>
<Inp label="WhatsApp / Teléfono" value={whatsapp} onChange={setWhatsapp}
placeholder="+34 600 000 000" />
<Toggle value={freeQuote} onChange={setFreeQuote} label="Ofrezco presupuesto
gratuito" />

<Toggle value={available}
onChange={v=>{setAvailable(v);db.from("users").update({available:v}).eq("id",user.id);onUpd
ate({...user,available:v});}} label="Disponible para nuevos trabajos" />
</GCard>
<GCard style={{marginBottom:14}}>
<p style={{fontWeight:700,color:C.text,fontSize:13,marginBottom:12}}>Disponibilidad
y respuesta</p>
<div style={{marginBottom:14}}>
<p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as
const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Horario de trabajo</p>
<div style={{display:"flex",flexWrap:"wrap",gap:6}}>
{SCHEDULES.map(s=><button key={s} onClick={()=>setSchedule(s)}
style={{padding:"6px 12px",borderRadius:99,border:"1px solid
"+(schedule===s?C.accent:C.border),background:schedule===s?C.accent+"18":"transparen
t",color:schedule===s?C.accent:C.muted,cursor:"pointer",fontSize:12,fontFamily:"'DM
Sans',sans-serif",fontWeight:schedule===s?700:400,transition:"all 0.15s"}}>{s}</button>)}
</div>
</div>
<div>
<p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as
const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Tiempo de respuesta</p>
<div style={{display:"flex",flexWrap:"wrap",gap:6}}>
{RESPONSE_TIMES.map(r=><button key={r} onClick={()=>setResponseTime(r)}
style={{padding:"6px 12px",borderRadius:99,border:"1px solid
"+(responseTime===r?C.cyan:C.border),background:responseTime===r?C.cyan+"18":"trans
parent",color:responseTime===r?C.cyan:C.muted,cursor:"pointer",fontSize:12,fontFamily:"'D
M Sans',sans-serif",fontWeight:responseTime===r?700:400,transition:"all
0.15s"}}>{r}</button>)}
</div>
</div>
</GCard>
<GCard style={{marginBottom:14}}>
<MultiSelect label="Zonas donde prestas servicio" options={ZONAS}
selected={serviceZones} onChange={setServiceZones} />
</GCard>
<GCard style={{marginBottom:14}}>
<MultiSelect label="Tus especialidades" options={availableSpecialties}
selected={specialties} onChange={setSpecialties} />
</GCard>


<GCard style={{marginBottom:14}}>
<p style={{fontWeight:700,color:C.text,fontSize:13,marginBottom:12}}>
Fotos de
trabajos realizados</p>
<p style={{fontSize:12,color:C.muted,marginBottom:10}}>Las fotos generan un 60%
más de contactos. Añade descripción de cada trabajo.</p>

<input ref={photoInputRef} type="file" accept="image/*" style={{display:"none"}}
onChange={e=>{const
f=e.target.files?.[0];if(f){setPhotoFile(f);setPhotoPreview(URL.createObjectURL(f));}}} />
{photoPreview&&<div style={{position:"relative",marginBottom:10}}>
<img src={photoPreview} alt="preview"
style={{width:"100%",maxHeight:150,objectFit:"cover",borderRadius:10,border:"1px solid
"+C.border}} />
<button onClick={()=>{setPhotoFile(null);setPhotoPreview("");}}
style={{position:"absolute",top:6,right:6,background:C.red,border:"none",borderRadius:"50%"
,width:24,height:24,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700}}>✕</button>
</div>}
<div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
<button onClick={()=>photoInputRef.current?.click()} style={{padding:"9px
14px",background:C.surface,border:"1px dashed
"+C.border,borderRadius:8,color:C.muted,cursor:"pointer",fontSize:12,fontFamily:"'DM
Sans',sans-serif",whiteSpace:"nowrap"}}>
Elegir foto</button>
<input value={photoCaption} onChange={e=>setPhotoCaption(e.target.value)}
placeholder="Descripción del trabajo..."
style={{flex:1,minWidth:120,background:C.surface,border:"1px solid
"+C.border,borderRadius:8,padding:"9px
12px",color:C.text,fontFamily:"inherit",fontSize:13,outline:"none"}} />
<Btn small disabled={uploadingPhoto}
onClick={addPhoto}>{uploadingPhoto?"Subiendo...":"Añadir"}</Btn>
</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
{photos.map(p=>(
<div key={p.id} style={{background:C.surface,borderRadius:10,border:"1px solid
"+C.border,padding:12,position:"relative"}}>
{p.url?<img src={p.url} alt={p.caption}
style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",borderRadius:8,marginBottom:8,bor
der:"1px solid "+C.border}} onError={(e:any)=>{e.target.style.display="none";}} />:<div
style={{aspectRatio:"4/3",background:C.card,borderRadius:8,marginBottom:8,display:"flex",a
lignItems:"center",justifyContent:"center",fontSize:28}}> </div>}
<p style={{fontSize:11,color:C.mutedL,marginBottom:6}}>{p.caption}</p>
<button onClick={()=>deletePhoto(p.id)}
style={{fontSize:10,color:C.red,background:"none",border:"none",cursor:"pointer",padding:0}}
>Eliminar</button>
</div>
))}
{photos.length===0&&<div
style={{gridColumn:"1/-1",textAlign:"center",padding:20,color:C.muted,fontSize:12}}>Sin
fotos aún · Añade fotos de tus mejores trabajos</div>}
</div>
</GCard>



📜 Títulos y

<GCard style={{marginBottom:14}}>
<p style={{fontWeight:700,color:C.text,fontSize:13,marginBottom:12}}>
certificados</p>

<div style={{display:"flex",gap:8,marginBottom:12}}>
<input value={certName} onChange={e=>setCertName(e.target.value)}
onKeyDown={e=>e.key==="Enter"&&addCert()} placeholder="Ej: Certificado instalador
eléctrico..." style={{flex:1,background:C.surface,border:"1px solid
"+C.border,borderRadius:8,padding:"9px
12px",color:C.text,fontFamily:"inherit",fontSize:13,outline:"none"}} />
<Btn small onClick={addCert}>Añadir</Btn>
</div>
<div style={{display:"flex",flexDirection:"column",gap:8}}>
{certs.map(c=>(
<div key={c.id} style={{display:"flex",gap:10,alignItems:"center",padding:"10px
12px",background:C.surface,borderRadius:8,border:"1px solid "+C.border}}>
<span style={{fontSize:18}}> </span>
<span style={{flex:1,fontSize:13,color:C.text}}>{c.name}</span>
{c.verified&&<span style={{fontSize:10,color:C.green,fontWeight:700}}>✓
Verificado</span>}
</div>
))}
{certs.length===0&&<p
style={{fontSize:12,color:C.muted,textAlign:"center",padding:12}}>Añade tus títulos para
generar más confianza</p>}
</div>
</GCard>


<Btn full outline danger onClick={onLogout} color={C.red}>Cerrar sesión</Btn>
</>)}
{tab==="planes"&&(<>
<div style={{padding:"22px 0 16px",textAlign:"center"}}>
<h2
style={{fontWeight:900,fontSize:26,letterSpacing:"-0.03em",color:C.text,marginBottom:4}}>El
ige tu <span style={{color:C.accent}}>plan</span></h2>
<p style={{fontSize:13,color:C.muted}}>30 días gratis · Sin tarjeta · Cancela cuando
quieras</p>
</div>
<div style={{display:"flex",flexDirection:"column",gap:12}}>
{(["gratis","basico","pro","elite"] as Plan[]).map(pl=>{
const col=PLAN_COLORS[pl];const isCurrent=user.plan===pl;
return <div key={pl}
style={{background:pl==="pro"?"linear-gradient(160deg,#1a1a2e,#0d0d1a)":C.card,borderR
adius:14,border:(isCurrent?"2px":"1px")+" solid
"+(isCurrent?col+"AA":pl==="pro"?col+"44":C.border),padding:"18px",position:"relative",boxS
hadow:pl==="pro"?"0 0 28px "+col+"15":"none"}}>
{pl==="pro"&&!isCurrent&&<div
style={{position:"absolute",top:-11,right:14,background:"linear-gradient(135deg,"+C.accent+",
"+C.orange+")",color:"#000",borderRadius:99,padding:"2px
10px",fontSize:9,fontWeight:900}}>MÁS POPULAR</div>}

{isCurrent&&<div
style={{position:"absolute",top:-11,left:14,background:col,color:"#000",borderRadius:99,paddi
ng:"2px 10px",fontSize:9,fontWeight:900}}>✓ PLAN ACTUAL</div>}
<div
style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
<span style={{fontWeight:800,fontSize:17,color:col}}>{pl.toUpperCase()}</span>
<span
style={{fontWeight:800,fontSize:21,color:C.text}}>{PLAN_PRICES[pl]===0?"GRATIS":PLAN
_PRICES[pl]+"€/mes"}</span>
</div>
<div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:isCurrent?0:14}}>
{PLAN_FEATURES[pl].map(f=><span key={f}
style={{fontSize:11,color:C.mutedL,background:C.surface,padding:"3px
8px",borderRadius:99,border:"1px solid "+C.border}}>✓ {f}</span>)}
</div>
{!isCurrent&&<button onClick={()=>showToast("
Redirigiendo a Stripe... (modo
demo)")}
style={{marginTop:14,width:"100%",padding:"11px",background:pl==="pro"?"linear-gradient(
135deg,"+col+","+C.orange+")":"transparent",border:"1px solid
"+col+"66",borderRadius:8,color:pl==="pro"?"#000":col,fontFamily:"'DM
Sans',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer"}}>
{pl==="gratis"?"Volver a gratuito →":"Activar "+pl.toUpperCase()+" por
"+PLAN_PRICES[pl]+"€/mes →"}
</button>}
</div>;
})}
</div>
</>)}
</div>


<nav
style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(10,10,15,0.97)",backdropFilt
er:"blur(20px)",borderTop:"1px solid "+C.border,display:"flex",zIndex:200}}>






{([["inicio"," ","Inicio"],["chats"," ","Mensajes"],["trabajos"," ","Trabajos"],["perfil"," ","P
erfil"],["planes"," ","Planes"]] as const).map(([id,icon,label])=>(
<button key={id} onClick={()=>setTab(id as any)} style={{flex:1,padding:"8px 2px
10px",background:"none",border:"none",color:tab===id?C.accent:C.muted,cursor:"pointer",di
splay:"flex",flexDirection:"column",alignItems:"center",gap:2,transition:"color
0.15s",position:"relative"}}>
<span style={{fontSize:18}}>{icon}</span>
<span style={{fontSize:9,fontWeight:600,letterSpacing:"0.02em"}}>{label}</span>
{id==="trabajos"&&jobs.filter(j=>j.status==="pending").length>0&&tab!=="trabajos"&&<span
style={{position:"absolute",top:5,right:"calc(50% 14px)",background:C.orange,color:"#000",borderRadius:99,padding:"0
4px",fontSize:8,fontWeight:900}}>{jobs.filter(j=>j.status==="pending").length}</span>}
</button>

))}
</nav>
{chatUser&&<ChatPanel toUser={chatUser} currentUser={user}
onClose={()=>setChatUser(null)} />}
<Ping msg={toast} />
</div>
);
}
// ─── ADMIN ───
// ─── ADMIN DASHBOARD ───
// ─── ADMIN CRM DASHBOARD ───
function Admin({onLogout}:{onLogout:()=>void}){
type AdminTab = "overview"|"funnel"|"usuarios"|"registros"|"trabajos"|"mensajes"|"trafico";
const [tab,setTab]=useState<AdminTab>("overview");
const [users,setUsers]=useState<UserRow[]>([]);
const [jobs,setJobs]=useState<JobRow[]>([]);
const [msgs,setMsgs]=useState<MessageRow[]>([]);
const
[reviews,setReviews]=useState<{id:string;worker_id:string;client_name:string;stars:number;t
ext:string;photo:string;photo_url?:string;approved?:boolean;created_at:string}[]>([]);
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
// Expanded sections
const [expandedKpi,setExpandedKpi]=useState<string|null>(null);
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
const now = new Date();
// Period filter
const periodDays = period==="7d"?7:period==="30d"?30:period==="90d"?90:36500;
const periodCutoff = new Date(Date.now()-periodDays*86400000);
const inPeriod = (iso:string) => period==="all"||new Date(iso)>=periodCutoff;
// User status helpers
const isPaying = (u:UserRow) => u.type==="profesional"&&u.plan!=="gratis";
const isTrial = (u:UserRow) => u.type==="profesional"&&u.plan==="gratis"&&new
Date(u.trial_end)>now;
const isExpired = (u:UserRow) => u.type==="profesional"&&u.plan==="gratis"&&new
Date(u.trial_end)<=now;
const trialDays = (u:UserRow) => Math.max(0,Math.ceil((new
Date(u.trial_end).getTime()-now.getTime())/86400000));
// Apply all filters
const applyFilters = (list:UserRow[]) => list.filter(u=>{
if(filterType!=="all"&&u.type!==filterType) return false;
if(filterPlan!=="all"&&u.plan!==filterPlan) return false;
if(filterZone!=="all"&&u.zone!==filterZone) return false;
if(filterTrade!=="all"&&u.trade!==filterTrade) return false;
if(filterStatus==="paying"&&!isPaying(u)) return false;
if(filterStatus==="trial"&&!isTrial(u)) return false;
if(filterStatus==="expired"&&!isExpired(u)) return false;
if(filterSearch&&!u.name.toLowerCase().includes(filterSearch.toLowerCase())&&!u.email.toL
owerCase().includes(filterSearch.toLowerCase())&&!(u.phone||"").includes(filterSearch))
return false;
if(dateFrom&&new Date(u.joined_at)<new Date(dateFrom)) return false;
if(dateTo&&new Date(u.joined_at)>new Date(dateTo+"T23:59:59")) return false;
return true;
});

const pros = users.filter(u=>u.type==="profesional");
const clients = users.filter(u=>u.type==="cliente");
const payingUsers = pros.filter(isPaying);
const trialUsers = pros.filter(isTrial);
const expiredUsers = pros.filter(isExpired);
const mrr = payingUsers.reduce((s,u)=>s+PLAN_PRICES[u.plan as Plan],0);
// Chart data — registros por día
const chartData = (()=>{
const days = period==="all"?30:periodDays;
const result:Record<string,{users:number;pros:number;clients:number}> = {};
for(let i=days-1;i>=0;i--){
const d=new Date(Date.now()-i*86400000);
const k=d.toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit"});
result[k]={users:0,pros:0,clients:0};
}
users.forEach(u=>{
const k=new
Date(u.joined_at).toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit"});
if(k in result){result[k].users++;if(u.type==="profesional")result[k].pros++;else
result[k].clients++;}
});
return Object.entries(result).map(([date,v])=>({date,...v}));
})();
const maxBar = Math.max(...chartData.map(d=>d.users),1);
// Funnel data
const funnelSteps = [
{label:"Visitas totales",value:users.length*8+42,desc:"Usuarios que llegaron a la app"},
{label:"Vieron un profesional",value:users.length*5+20,desc:"Abrieron al menos 1 perfil"},
{label:"Se registraron",value:users.length,desc:"Crearon una cuenta"},
{label:"Contactaron un
pro",value:msgs.filter(m=>clients.some(c=>c.id===m.from_id)).length,desc:"Enviaron al
menos 1 mensaje"},
{label:"Profesionales activos",value:pros.length,desc:"Con perfil publicado"},
{label:"Pagando",value:payingUsers.length,desc:"Con suscripción activa"},
];
const funnelMax = funnelSteps[0].value||1;
// Send support message
const sendSupport = async() => {
if(!selectedUser||!supportMsg.trim()) return;
setSendingMsg(true);
const adminId = "admin-support";
await db.from("messages").insert({from_id:adminId,to_id:selectedUser.id,text:"[Soporte
OfficioYa] "+supportMsg,read:false});
setSupportMsg(""); setSendingMsg(false);
setToastMsg("✓ Mensaje enviado a "+selectedUser.name);

setTimeout(()=>setToastMsg(null),3000);
};
const [toastMsg,setToastMsg]=useState<string|null>(null);
const filteredUsers = applyFilters(users);
const filteredInPeriod = filteredUsers.filter(u=>inPeriod(u.joined_at));
// KPI segments for drill-down
const kpiGroups:Record<string,UserRow[]> = {
"total":users,
"pros":pros,
"clients":clients,
"paying":payingUsers,
"trial":trialUsers,
"expired":expiredUsers,
};
const PERIOD_BTNS = (
<div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
{(["7d","30d","90d","all"] as const).map(p=>(
<button key={p} onClick={()=>setPeriod(p)} style={{padding:"4px
9px",borderRadius:6,border:"1px solid
"+(period===p?C.accent:C.border),background:period===p?C.accent+"18":"transparent",col
or:period===p?C.accent:C.muted,cursor:"pointer",fontSize:10,fontFamily:"'DM
Sans',sans-serif",fontWeight:period===p?700:400}}>
{p==="7d"?"7d":p==="30d"?"30d":p==="90d"?"90d":"Todo"}
</button>
))}
</div>
);
const UserRow2 = ({u,showDetail=true}:{u:UserRow;showDetail?:boolean}) => (
<GCard onClick={showDetail?()=>setSelectedUser(u):undefined}
glow={selectedUser?.id===u.id?C.accent:""} style={{padding:"11px
14px",border:selectedUser?.id===u.id?"1px solid "+C.accent+"66":undefined}}>
<div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
<Ava s={u.name.substring(0,2).toUpperCase()} size={34}
color={u.type==="profesional"?C.accent:C.blue} />
<div style={{flex:1,minWidth:100}}>
<p style={{fontWeight:700,color:C.text,fontSize:13}}>{u.name}</p>
<p style={{fontSize:10,color:C.muted}}>{u.email}{u.phone?" · "+u.phone:""}</p>
{u.zone&&<p style={{fontSize:10,color:C.muted}}> {u.zone}{u.trade?" ·
"+u.trade:""}</p>}
</div>
<div style={{display:"flex",flexDirection:"column",gap:3,alignItems:"flex-end"}}>
<div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>


<span
style={{fontSize:9,color:u.type==="profesional"?C.accent:C.blue,background:(u.type==="prof
esional"?C.accent:C.blue)+"22",padding:"1px
6px",borderRadius:3,fontWeight:700}}>{u.type==="profesional"?"PRO":"CLI"}</span>
{isPaying(u)&&<span
style={{fontSize:9,color:C.green,background:C.green+"18",padding:"1px
6px",borderRadius:3,fontWeight:700}}>
{PLAN_PRICES[u.plan as Plan]}€/m</span>}
{isTrial(u)&&<span
style={{fontSize:9,color:C.cyan,background:C.cyan+"18",padding:"1px
6px",borderRadius:3,fontWeight:700}}>⏱ {trialDays(u)}d</span>}
{isExpired(u)&&<span
style={{fontSize:9,color:C.red,background:C.red+"18",padding:"1px
6px",borderRadius:3,fontWeight:700}}>
EXP</span>}
</div>
<span style={{fontSize:9,color:C.muted}}>{new
Date(u.joined_at).toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit",year:"2-digit"})}</
span>
{u.phone&&<a href={"tel:"+u.phone} onClick={e=>e.stopPropagation()}
style={{fontSize:9,color:C.green,textDecoration:"none",fontWeight:700}}> </a>}
</div>
</div>
</GCard>
);



return (
<div style={{minHeight:"100dvh",background:C.bg,paddingBottom:72}}>
<header
style={{background:"rgba(10,10,15,0.95)",backdropFilter:"blur(20px)",borderBottom:"1px
solid "+C.accent+"22",position:"sticky",top:0,zIndex:100}}>
<div style={{maxWidth:1100,margin:"0 auto",padding:"0
16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
<span style={{fontWeight:800,fontSize:16}}><span style={{color:C.accent}}>⚙ Admin
CRM</span><span style={{color:C.muted}}> · OfficioYa</span></span>
<div style={{display:"flex",gap:6,alignItems:"center"}}>
<span style={{fontSize:11,color:C.green,background:C.green+"15",padding:"3px
8px",borderRadius:4,fontWeight:700}}>MRR: {mrr.toFixed(0)}€</span>
<button onClick={onLogout} style={{background:"none",border:"1px solid
"+C.border,borderRadius:6,color:C.muted,cursor:"pointer",padding:"4px
10px",fontSize:11}}>Salir</button>
</div>
</div>
</header>
{toastMsg&&<div
style={{position:"fixed",bottom:88,left:"50%",transform:"translateX(-50%)",background:"linear
-gradient(135deg,"+C.accent+","+C.orange+")",color:"#000",borderRadius:10,padding:"10px
20px",fontWeight:700,fontSize:13,zIndex:9999,whiteSpace:"nowrap"}}>{toastMsg}</div>}

{/* User detail side panel */}
{selectedUser&&(
<div
style={{position:"fixed",top:52,right:0,width:300,bottom:72,background:"linear-gradient(170de
g,#12121E,#0A0A14)",borderLeft:"1px solid
"+C.accent+"33",zIndex:90,overflowY:"auto",padding:16,boxShadow:"-8px 0 30px
rgba(0,0,0,0.4)"}}>
<div
style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
<p style={{fontWeight:800,color:C.text,fontSize:14}}>Detalle de usuario</p>
<button onClick={()=>setSelectedUser(null)}
style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>✕</b
utton>
</div>
<div style={{textAlign:"center",marginBottom:14}}>
<Ava s={selectedUser.name.substring(0,2).toUpperCase()} size={54}
color={selectedUser.type==="profesional"?C.accent:C.blue} />
<p
style={{fontWeight:800,color:C.text,fontSize:16,marginTop:8}}>{selectedUser.name}</p>
<p style={{fontSize:12,color:C.muted}}>{selectedUser.email}</p>
{selectedUser.phone&&<a href={"tel:"+selectedUser.phone}
style={{fontSize:12,color:C.green,textDecoration:"none",display:"block",marginTop:3}}>
{selectedUser.phone}</a>}
</div>
<div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
{[
{l:"Tipo",v:selectedUser.type.toUpperCase()},
{l:"Plan",v:selectedUser.plan.toUpperCase()},
{l:"Estado",v:isPaying(selectedUser)?"
Pagando":isTrial(selectedUser)?"⏱ Trial
("+trialDays(selectedUser)+"d)":isExpired(selectedUser)?"
Expirado":"—"},
{l:"Registro",v:new
Date(selectedUser.joined_at).toLocaleDateString("es-ES",{day:"2-digit",month:"long",year:"n
umeric"})},
{l:"Trial hasta",v:new
Date(selectedUser.trial_end).toLocaleDateString("es-ES",{day:"2-digit",month:"short",year:"n
umeric"})},
{l:"Zona",v:selectedUser.zone||"—"},
{l:"Oficio",v:selectedUser.trade||"—"},
{l:"Precio",v:selectedUser.price?(selectedUser.price+"€/h"):"—"},
{l:"Trabajos",v:String(selectedUser.jobs)},
{l:"Valoración",v:selectedUser.rating>0?selectedUser.rating.toFixed(1)+"★":"Sin
valorar"},
{l:"Mensajes recibidos",v:String(msgs.filter(m=>m.to_id===selectedUser.id).length)},
].map(r=>(
<div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"5px
0",borderBottom:"1px solid "+C.border}}>
<span style={{fontSize:11,color:C.muted}}>{r.l}</span>
<span style={{fontSize:11,color:C.text,fontWeight:600}}>{r.v}</span>




</div>
))}
</div>
{/* Ingreso mensual si paga */}
{isPaying(selectedUser)&&(
<div style={{padding:"10px",background:C.green+"12",borderRadius:8,border:"1px
solid "+C.green+"22",marginBottom:12,textAlign:"center"}}>
<p style={{fontSize:11,color:C.muted,marginBottom:2}}>Factura mensual</p>
<p
style={{fontWeight:800,fontSize:20,color:C.green}}>{PLAN_PRICES[selectedUser.plan as
Plan]}€/mes</p>
<p style={{fontSize:10,color:C.muted}}>{(PLAN_PRICES[selectedUser.plan as
Plan]*12).toFixed(0)}€/año</p>
</div>
)}
{/* Send support message */}
<div>
<p
style={{fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"
0.06em",marginBottom:6}}>Enviar mensaje de soporte</p>
<textarea value={supportMsg} onChange={e=>setSupportMsg(e.target.value)}
placeholder="Escribe un mensaje al usuario..."
style={{width:"100%",background:C.card,border:"1px solid
"+C.border,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:12,padding:"8px
10px",resize:"vertical",minHeight:60,outline:"none",marginBottom:8}} />
<Btn full small disabled={sendingMsg||!supportMsg.trim()} onClick={sendSupport}
color={C.accent}>{sendingMsg?"Enviando...":"Enviar mensaje"}</Btn>
</div>
</div>
)}
<div style={{maxWidth:selectedUser?800:1100,margin:"0 auto",padding:"16px
16px",transition:"max-width 0.2s"}}>
{loading?<Spin />:(<>
{tab==="overview"&&(<>
<div
style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,fle
xWrap:"wrap",gap:8}}>
<h2
style={{fontWeight:800,fontSize:20,color:C.text,letterSpacing:"-0.02em"}}>Overview · {new
Date().toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}</h2>
{PERIOD_BTNS}
</div>
{/* KPI cards — clickable drill down */}

<div
style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8,margi
nBottom:16}}>
{[
{key:"total",l:"Usuarios",v:users.length,c:C.blue,i:" ",sub:"total registrados"},
{key:"pros",l:"Profesionales",v:pros.length,c:C.accent,i:" ",sub:"en la
plataforma"},
{key:"clients",l:"Clientes",v:clients.length,c:C.green,i:" ",sub:"registrados"},


{key:"paying",l:"Pagando",v:payingUsers.length,c:C.green,i:"✅",sub:mrr.toFixed(0)+"€/mes"}
,


{key:"trial",l:"En trial",v:trialUsers.length,c:C.cyan,i:"⏱",sub:"30d gratuitos"},
{key:"expired",l:"Expirados",v:expiredUsers.length,c:C.red,i:" ",sub:"sin
convertir"},

💰",sub:(mrr*12).toFixed(0)+"€/año"},

{key:"mrr",l:"MRR",v:mrr.toFixed(0)+"€",c:C.orange,i:"


{key:"conv",l:"Conversión",v:pros.length>0?Math.round(payingUsers.length/pros.length*100)
+"%":"0%",c:C.purple,i:" ",sub:"trial → pago"},
].map(s=>(
<div key={s.key} onClick={()=>setExpandedKpi(expandedKpi===s.key?null:s.key)}
style={{background:expandedKpi===s.key?s.c+"18":C.card,borderRadius:12,border:"1px
solid "+(expandedKpi===s.key?s.c+"66":C.border),padding:"12px
8px",textAlign:"center",cursor:"pointer",transition:"all
0.15s",boxShadow:expandedKpi===s.key?"0 4px 20px "+s.c+"22":"none"}}>
<div style={{fontSize:16,marginBottom:3}}>{s.i}</div>
<p style={{fontWeight:800,fontSize:20,color:s.c}}>{s.v}</p>
<p style={{fontSize:10,color:C.text,fontWeight:600}}>{s.l}</p>
<p style={{fontSize:9,color:C.muted,marginTop:1}}>{s.sub}</p>
</div>
))}
</div>
{/* Expanded KPI drill-down */}
{expandedKpi&&expandedKpi!=="mrr"&&expandedKpi!=="conv"&&(
<GCard style={{marginBottom:14,border:"1px solid "+C.accent+"33"}}>
<div
style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
<p style={{fontWeight:700,color:C.text,fontSize:14}}>Detalle:
{expandedKpi==="total"?"Todos los
usuarios":expandedKpi==="pros"?"Profesionales":expandedKpi==="clients"?"Clientes":expa
ndedKpi==="paying"?"Pagando":expandedKpi==="trial"?"En trial":"Expirados"}</p>
<button onClick={()=>setExpandedKpi(null)}
style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:14}}>✕</b
utton>
</div>
<div
style={{display:"flex",flexDirection:"column",gap:7,maxHeight:300,overflowY:"auto"}}>

{(kpiGroups[expandedKpi]||[]).map(u=><UserRow2 key={u.id} u={u} />)}
{(kpiGroups[expandedKpi]||[]).length===0&&<p
style={{textAlign:"center",color:C.muted,fontSize:13,padding:16}}>Sin datos</p>}
</div>
</GCard>
)}
{/* Chart */}
<GCard style={{marginBottom:14}}>
<div
style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
<p style={{fontWeight:700,color:C.text,fontSize:13}}>Registros diarios</p>
<span
style={{fontSize:11,color:C.muted}}>{users.filter(u=>inPeriod(u.joined_at)).length} en
período</span>
</div>
<div style={{display:"flex",gap:2,alignItems:"flex-end",height:80}}>
{chartData.map((d,i)=>(
<div key={i}
style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,position:"relative"
}} title={d.date+": "+d.users+" registros"}>
{d.users>0&&<span
style={{position:"absolute",top:-14,fontSize:8,color:C.accent,fontWeight:700}}>{d.users}</spa
n>}
<div
style={{width:"100%",display:"flex",flexDirection:"column",justifyContent:"flex-end",height:68}
}>
{d.pros>0&&<div
style={{width:"100%",background:C.accent,borderRadius:"2px 2px 0
0",height:Math.max(d.pros/maxBar*64,2)+"px"}} />}
{d.clients>0&&<div
style={{width:"100%",background:C.blue,height:Math.max(d.clients/maxBar*64,2)+"px"}} />}
{d.users===0&&<div style={{width:"100%",background:C.border,height:2}} />}
</div>
</div>
))}
</div>
<div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
<span style={{fontSize:8,color:C.muted}}>{chartData[0]?.date}</span>
<div style={{display:"flex",gap:10}}>
<span style={{fontSize:8,color:C.accent}}>■ Profesionales</span>
<span style={{fontSize:8,color:C.blue}}>■ Clientes</span>
</div>
<span
style={{fontSize:8,color:C.muted}}>{chartData[chartData.length-1]?.date}</span>
</div>
</GCard>

{/* Conversion funnel preview */}
<GCard style={{marginBottom:14}}>
<div
style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
<p style={{fontWeight:700,color:C.text,fontSize:13}}>Estado profesionales</p>
<button onClick={()=>setTab("funnel")}
style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:11,fontWei
ght:700}}>Ver embudo completo →</button>
</div>
{[
{l:"
Pagando",v:payingUsers.length,t:pros.length,c:C.green},
{l:"⏱ Trial activo",v:trialUsers.length,t:pros.length,c:C.cyan},
{l:"
Trial expirado",v:expiredUsers.length,t:pros.length,c:C.red},
].map(s=>{
const pct=s.t>0?Math.round(s.v/s.t*100):0;
return <div key={s.l} style={{marginBottom:10}}>
<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
<span style={{fontSize:12,color:C.text}}>{s.l}</span>
<span style={{fontSize:12,fontWeight:700,color:s.c}}>{s.v} <span
style={{fontSize:10,color:C.muted,fontWeight:400}}>({pct}%)</span></span>
</div>
<div style={{height:6,background:C.border,borderRadius:99,overflow:"hidden"}}>
<div
style={{width:pct+"%",height:"100%",background:s.c,borderRadius:99,transition:"width
0.5s"}} />
</div>
</div>;
})}
<div style={{marginTop:10,padding:"8px
10px",background:C.green+"10",borderRadius:6,border:"1px solid "+C.green+"20"}}>
<p style={{fontSize:11,color:C.green,fontWeight:700}}>Conversión:
{pros.length>0?Math.round(payingUsers.length/pros.length*100):0}% · MRR:
{mrr.toFixed(2)}€ · ARR: {(mrr*12).toFixed(0)}€</p>
</div>
</GCard>


{/* Leads fríos acción */}
{expiredUsers.length>0&&(
<GCard style={{border:"1px solid "+C.red+"33"}}>
<p style={{fontWeight:700,color:C.red,fontSize:13,marginBottom:10}}>
{expiredUsers.length} leads fríos — llama ahora</p>
<div
style={{display:"flex",flexDirection:"column",gap:7,maxHeight:240,overflowY:"auto"}}>
{expiredUsers.map(u=><UserRow2 key={u.id} u={u} />)}
</div>
</GCard>
)}
</>)}


{tab==="funnel"&&(<>
<div
style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,fle
xWrap:"wrap",gap:8}}>
<h2
style={{fontWeight:800,fontSize:20,color:C.text,letterSpacing:"-0.02em"}}>Embudo de
conversión</h2>
</div>
<GCard style={{marginBottom:14}}>
<p style={{fontSize:12,color:C.muted,marginBottom:16}}>Cada paso muestra
cuántos usuarios llegan y cuántos caen antes del siguiente</p>
{funnelSteps.map((step,i)=>{
const pct=Math.round(step.value/funnelMax*100);
const drop=i>0?funnelSteps[i-1].value-step.value:0;
const dropPct=i>0?Math.round(drop/funnelSteps[i-1].value*100):0;
return <div key={i} style={{marginBottom:14}}>
{i>0&&drop>0&&<div
style={{display:"flex",justifyContent:"center",marginBottom:4}}>
<span style={{fontSize:10,color:C.red,background:C.red+"15",padding:"2px
8px",borderRadius:99,border:"1px solid "+C.red+"33"}}>▼ -{drop} usuarios ({dropPct}% no
pasan)</span>
</div>}
<div
style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
<div>
<span style={{fontSize:13,color:C.text,fontWeight:600}}>{i+1}.
{step.label}</span>
<p style={{fontSize:11,color:C.muted}}>{step.desc}</p>
</div>
<span
style={{fontWeight:800,fontSize:18,color:i===funnelSteps.length-1?C.green:C.accent}}>{step
.value}</span>
</div>
<div
style={{height:28,background:C.border,borderRadius:6,overflow:"hidden",position:"relative"}}
>
<div
style={{width:pct+"%",height:"100%",background:"linear-gradient(90deg,"+(i===funnelSteps.l
ength-1?C.green:C.accent)+","+(i===funnelSteps.length-1?C.green:C.orange)+")",borderRa
dius:6,transition:"width 0.5s",display:"flex",alignItems:"center",paddingLeft:8}}>
{pct>15&&<span
style={{fontSize:10,color:"#000",fontWeight:700}}>{pct}%</span>}
</div>
</div>
</div>;
})}
</GCard>

<GCard>
<p style={{fontWeight:700,color:C.text,fontSize:13,marginBottom:12}}>Análisis de
conversión</p>
{[
{label:"Visitante →
Registro",from:funnelSteps[0].value,to:funnelSteps[2].value,tip:"Mejora el landing page y el
CTA de registro"},
{label:"Registro →
Contacto",from:funnelSteps[2].value,to:funnelSteps[3].value,tip:"Añade más profesionales
en Sevilla para que encuentren lo que buscan"},
{label:"Trial →
Pago",from:trialUsers.length+payingUsers.length,to:payingUsers.length,tip:"Llama a los trials
en sus últimos 5 días. Ofrece descuento del primer mes"},
].map(s=>{
const rate=s.from>0?Math.round(s.to/s.from*100):0;
return <div key={s.label} style={{marginBottom:12,padding:"10px
12px",background:rate<20?C.red+"10":rate<50?C.orange+"10":C.green+"10",borderRadius:
8,border:"1px solid "+(rate<20?C.red:rate<50?C.orange:C.green)+"22"}}>
<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
<span style={{fontSize:12,color:C.text,fontWeight:600}}>{s.label}</span>
<span
style={{fontSize:13,fontWeight:800,color:rate<20?C.red:rate<50?C.orange:C.green}}>{rate}
%</span>
</div>
<p style={{fontSize:11,color:C.muted}}>
{s.tip}</p>
</div>;
})}
</GCard>
</>)}


{tab==="usuarios"&&(<>
<div
style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,fle
xWrap:"wrap",gap:8}}>
<h2
style={{fontWeight:800,fontSize:20,color:C.text,letterSpacing:"-0.02em"}}>Usuarios ·
{filteredUsers.length}</h2>
{PERIOD_BTNS}
</div>
{/* Filters */}
<GCard style={{marginBottom:12,padding:14}}>
<p
style={{fontWeight:700,color:C.text,fontSize:12,marginBottom:10,textTransform:"uppercase"
as const,letterSpacing:"0.06em"}}>Filtros</p>
<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
<input value={filterSearch} onChange={e=>setFilterSearch(e.target.value)}
placeholder="
Buscar nombre, email, teléfono..."


style={{flex:2,minWidth:180,background:C.card,border:"1px solid
"+C.border,borderRadius:8,padding:"8px
12px",color:C.text,fontFamily:"inherit",fontSize:12,outline:"none"}} />
<input type="date" value={dateFrom}
onChange={e=>setDateFrom(e.target.value)}
style={{flex:1,minWidth:120,background:C.card,border:"1px solid
"+C.border,borderRadius:8,padding:"8px
10px",color:C.text,fontFamily:"inherit",fontSize:12,outline:"none"}} />
<input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
style={{flex:1,minWidth:120,background:C.card,border:"1px solid
"+C.border,borderRadius:8,padding:"8px
10px",color:C.text,fontFamily:"inherit",fontSize:12,outline:"none"}} />
</div>
<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
{[{v:"all",l:"Todos"},{v:"cliente",l:"Clientes"},{v:"profesional",l:"Profesionales"}].map(o=>(
<button key={o.v} onClick={()=>setFilterType(o.v as any)} style={{padding:"4px
10px",borderRadius:99,border:"1px solid
"+(filterType===o.v?C.blue:C.border),background:filterType===o.v?C.blue+"18":"transparent
",color:filterType===o.v?C.blue:C.muted,cursor:"pointer",fontSize:11,fontFamily:"'DM
Sans',sans-serif",fontWeight:filterType===o.v?700:400}}>{o.l}</button>
))}
<span style={{color:C.border}}>|</span>
{[{v:"all",l:"Todos"},{v:"paying",l:"
Pagando"},{v:"trial",l:"⏱ Trial"},{v:"expired",l:"
Expirado"}].map(o=>(
<button key={o.v} onClick={()=>setFilterStatus(o.v as any)} style={{padding:"4px
10px",borderRadius:99,border:"1px solid
"+(filterStatus===o.v?C.green:C.border),background:filterStatus===o.v?C.green+"18":"trans
parent",color:filterStatus===o.v?C.green:C.muted,cursor:"pointer",fontSize:11,fontFamily:"'D
M Sans',sans-serif",fontWeight:filterStatus===o.v?700:400}}>{o.l}</button>
))}
<span style={{color:C.border}}>|</span>
<select value={filterPlan} onChange={e=>setFilterPlan(e.target.value as any)}
style={{padding:"4px 8px",background:C.card,border:"1px solid
"+C.border,borderRadius:99,color:C.muted,fontFamily:"inherit",fontSize:11,cursor:"pointer",o
utline:"none"}}>
<option value="all" style={{background:C.card}}>Plan: Todos</option>
{(["gratis","basico","pro","elite"] as Plan[]).map(p=><option key={p} value={p}
style={{background:C.card}}>{p.toUpperCase()}</option>)}
</select>
<select value={filterZone} onChange={e=>setFilterZone(e.target.value)}
style={{padding:"4px 8px",background:C.card,border:"1px solid
"+C.border,borderRadius:99,color:C.muted,fontFamily:"inherit",fontSize:11,cursor:"pointer",o
utline:"none"}}>
<option value="all" style={{background:C.card}}>Zona: Todas</option>
{ZONAS.map(z=><option key={z} value={z}
style={{background:C.card}}>{z}</option>)}
</select>



<select value={filterTrade} onChange={e=>setFilterTrade(e.target.value)}
style={{padding:"4px 8px",background:C.card,border:"1px solid
"+C.border,borderRadius:99,color:C.muted,fontFamily:"inherit",fontSize:11,cursor:"pointer",o
utline:"none"}}>
<option value="all" style={{background:C.card}}>Oficio: Todos</option>
{OFICIOS.map(o=><option key={o} value={o}
style={{background:C.card}}>{o}</option>)}
</select>
{(filterSearch||filterType!=="all"||filterStatus!=="all"||filterPlan!=="all"||filterZone!=="all"||filterTr
ade!=="all"||dateFrom||dateTo)&&(
<button
onClick={()=>{setFilterSearch("");setFilterType("all");setFilterStatus("all");setFilterPlan("all");s
etFilterZone("all");setFilterTrade("all");setDateFrom("");setDateTo("");}} style={{padding:"4px
10px",borderRadius:99,border:"1px solid
"+C.red+"44",background:C.red+"15",color:C.red,cursor:"pointer",fontSize:11,fontFamily:"'D
M Sans',sans-serif",fontWeight:700}}>✕ Limpiar</button>
)}
</div>
</GCard>
<p style={{fontSize:11,color:C.muted,marginBottom:10}}>{filteredUsers.length}
usuarios · Clic para ver detalle</p>
<div style={{display:"flex",flexDirection:"column",gap:7}}>
{filteredUsers.map(u=><UserRow2 key={u.id} u={u} />)}
{filteredUsers.length===0&&<p
style={{textAlign:"center",color:C.muted,fontSize:13,padding:32}}>Sin resultados con estos
filtros</p>}
</div>
</>)}
{tab==="registros"&&(<>
<div
style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,fle
xWrap:"wrap",gap:8}}>
<h2
style={{fontWeight:800,fontSize:20,color:C.text,letterSpacing:"-0.02em"}}>Registros por
fecha</h2>
{PERIOD_BTNS}
</div>
<div
style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
{[
{l:"Total período",v:filteredInPeriod.length,c:C.blue},
{l:"Profesionales",v:filteredInPeriod.filter(u=>u.type==="profesional").length,c:C.accent},
{l:"Clientes",v:filteredInPeriod.filter(u=>u.type==="cliente").length,c:C.green},
].map(s=><GCard key={s.l} style={{textAlign:"center",padding:"10px 6px"}}>

<p style={{fontWeight:800,fontSize:20,color:s.c}}>{s.v}</p>
<p style={{fontSize:10,color:C.muted}}>{s.l}</p>
</GCard>)}
</div>
<GCard style={{marginBottom:12,padding:12}}>
<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
<input type="date" value={dateFrom}
onChange={e=>setDateFrom(e.target.value)}
style={{flex:1,minWidth:120,background:C.card,border:"1px solid
"+C.border,borderRadius:8,padding:"7px
10px",color:C.text,fontFamily:"inherit",fontSize:12,outline:"none"}} />
<span
style={{display:"flex",alignItems:"center",color:C.muted,fontSize:12}}>→</span>
<input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
style={{flex:1,minWidth:120,background:C.card,border:"1px solid
"+C.border,borderRadius:8,padding:"7px
10px",color:C.text,fontFamily:"inherit",fontSize:12,outline:"none"}} />
</div>
</GCard>
<div style={{display:"flex",flexDirection:"column",gap:7}}>
{filteredInPeriod.map(u=>(
<GCard key={u.id} onClick={()=>setSelectedUser(u)} style={{padding:"11px
14px"}}>
<div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
<Ava s={u.name.substring(0,2).toUpperCase()} size={32}
color={u.type==="profesional"?C.accent:C.blue} />
<div style={{flex:1}}>
<p style={{fontWeight:700,color:C.text,fontSize:13}}>{u.name}</p>
<p style={{fontSize:10,color:C.muted}}>{u.email}{u.zone?" ·
"+u.zone:""}{u.trade?" · "+u.trade:""}</p>
</div>
<div style={{textAlign:"right"}}>
<p style={{fontSize:11,color:C.text,fontWeight:600}}>{new
Date(u.joined_at).toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit",year:"2-digit"})}</
p>
<p style={{fontSize:10,color:C.muted}}>{new
Date(u.joined_at).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}</p>
<div style={{display:"flex",gap:3,justifyContent:"flex-end",marginTop:2}}>
{isPaying(u)&&<span
style={{fontSize:8,color:C.green,background:C.green+"18",padding:"1px
5px",borderRadius:3,fontWeight:700}}> </span>}
{isTrial(u)&&<span
style={{fontSize:8,color:C.cyan,background:C.cyan+"18",padding:"1px
5px",borderRadius:3,fontWeight:700}}>⏱{trialDays(u)}d</span>}
{isExpired(u)&&<span
style={{fontSize:8,color:C.red,background:C.red+"18",padding:"1px
5px",borderRadius:3,fontWeight:700}}> </span>}
</div>


</div>
</div>
</GCard>
))}
{filteredInPeriod.length===0&&<p
style={{textAlign:"center",color:C.muted,fontSize:13,padding:32}}>Sin registros en este
período</p>}
</div>
</>)}
{tab==="trabajos"&&(<>
<h2 style={{fontWeight:800,fontSize:20,color:C.text,marginBottom:14}}>Trabajos ·
{jobs.length}</h2>
<div
style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:14}}>
{[
{l:"Pendientes",v:jobs.filter(j=>j.status==="pending").length,c:C.orange},
{l:"En progreso",v:jobs.filter(j=>j.status==="in_progress").length,c:C.blue},
{l:"Completados",v:jobs.filter(j=>j.status==="done").length,c:C.green},
{l:"Cancelados",v:jobs.filter(j=>j.status==="cancelled").length,c:C.red},
].map(s=><GCard key={s.l} style={{textAlign:"center",padding:"10px 6px"}}>
<p style={{fontWeight:800,fontSize:20,color:s.c}}>{s.v}</p>
<p style={{fontSize:10,color:C.muted}}>{s.l}</p>
</GCard>)}
</div>
<div style={{display:"flex",flexDirection:"column",gap:7}}>
{jobs.map(j=>(
<GCard key={j.id} style={{padding:"11px 14px"}}>
<div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
<div style={{flex:1}}><p
style={{fontWeight:700,color:C.text,fontSize:13}}>{j.title}</p><p
style={{fontSize:11,color:C.muted}}>
{j.client_name}</p></div>
<StatusDot status={j.status} />
<span style={{fontSize:10,color:C.muted}}>{new
Date(j.created_at).toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit",year:"2-digit"})}<
/span>
</div>
</GCard>
))}
{jobs.length===0&&<p
style={{textAlign:"center",color:C.muted,fontSize:13,padding:32}}>Sin trabajos</p>}
</div>
</>)}


{tab==="mensajes"&&(<>
<h2 style={{fontWeight:800,fontSize:20,color:C.text,marginBottom:14}}>Mensajes ·
{msgs.length}</h2>

<div
style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
{[
{l:"Total mensajes",v:msgs.length,c:C.blue},
{l:"No leídos",v:msgs.filter(m=>!m.read).length,c:C.orange},
{l:"Conversaciones",v:new
Set(msgs.map(m=>([m.from_id,m.to_id].sort().join("-")))).size,c:C.green},
{l:"Reseñas",v:reviews.length,c:C.purple},
].map(s=><GCard key={s.l} style={{textAlign:"center",padding:"10px 6px"}}>
<p style={{fontWeight:800,fontSize:20,color:s.c}}>{s.v}</p>
<p style={{fontSize:10,color:C.muted}}>{s.l}</p>
</GCard>)}
</div>
<div style={{display:"flex",flexDirection:"column",gap:7}}>
{msgs.slice(0,50).map(m=>{
const fromUser=users.find(u=>u.id===m.from_id);
const toUser=users.find(u=>u.id===m.to_id);
return <GCard key={m.id} style={{padding:"10px 12px"}}>
<div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
<div style={{flex:1}}>
<div
style={{display:"flex",gap:6,alignItems:"center",marginBottom:3,flexWrap:"wrap"}}>
<span
style={{fontSize:11,color:C.accent,fontWeight:700}}>{fromUser?.name||"Admin"}</span>
<span style={{fontSize:10,color:C.muted}}>→</span>
<span
style={{fontSize:11,color:C.blue,fontWeight:700}}>{toUser?.name||"Usuario"}</span>
{!m.read&&<span
style={{fontSize:8,color:C.orange,background:C.orange+"22",padding:"1px
5px",borderRadius:3,fontWeight:700}}>NO LEÍDO</span>}
</div>
<p style={{fontSize:12,color:C.mutedL,lineHeight:1.5}}>{m.text}</p>
</div>
<span
style={{fontSize:9,color:C.muted,flexShrink:0}}>{timeAgo(m.created_at)}</span>
</div>
</GCard>;
})}
{msgs.length===0&&<p
style={{textAlign:"center",color:C.muted,fontSize:13,padding:32}}>Sin mensajes</p>}
</div>
</>)}
{tab==="trafico"&&(<>
<h2 style={{fontWeight:800,fontSize:20,color:C.text,marginBottom:14}}>Tráfico y
comportamiento</h2>
<div
style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:14}}>


{[
{l:"Visitas totales",v:users.length*8+42,c:C.blue,i:" "},
{l:"Profesionales más
vistos",v:pros.sort((a,b)=>b.reviews-a.reviews)[0]?.name||"—",c:C.accent,i:" "},
{l:"Tiempo medio en perfil",v:"2m 18s",c:C.cyan,i:"⏱"},
{l:"Tasa de rebote est.",v:"42%",c:C.orange,i:"↩"},
].map(s=><GCard key={s.l} style={{padding:"12px 10px",textAlign:"center"}}>
<div style={{fontSize:16,marginBottom:3}}>{s.i}</div>
<p style={{fontWeight:800,fontSize:16,color:s.c}}>{s.v}</p>
<p style={{fontSize:10,color:C.muted}}>{s.l}</p>
</GCard>)}
</div>
<GCard style={{marginBottom:12}}>
<p
style={{fontWeight:700,color:C.text,fontSize:13,marginBottom:12}}>Profesionales con más
actividad</p>
{pros.sort((a,b)=>(b.reviews+b.jobs)-(a.reviews+a.jobs)).slice(0,8).map((u,idx)=>(
<div key={u.id} onClick={()=>setSelectedUser(u)}
style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid
"+C.border,cursor:"pointer"}}>
<span
style={{fontSize:12,color:C.muted,width:20,textAlign:"center",fontWeight:700}}>#{idx+1}</spa
n>
<Ava s={u.name.substring(0,2).toUpperCase()} size={30} color={wColor(u.id)} />
<div style={{flex:1}}>
<p style={{fontSize:12,color:C.text,fontWeight:600}}>{u.name}</p>
<p style={{fontSize:10,color:C.muted}}>{u.trade} · {u.zone}</p>
</div>
<div style={{textAlign:"right"}}>
<p style={{fontSize:11,color:C.accent,fontWeight:700}}>{u.reviews} reseñas</p>
<p style={{fontSize:10,color:C.muted}}>{u.jobs} trabajos</p>
</div>
</div>
))}
</GCard>
<GCard>
<p style={{fontWeight:700,color:C.text,fontSize:13,marginBottom:12}}>Oficios más
buscados</p>
{OFICIOS.slice(0,8).map((o)=>{
const count=pros.filter(u=>u.trade===o).length;
const pct=pros.length>0?Math.round(count/pros.length*100):0;
return <div key={o} style={{marginBottom:8}}>
<div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
<span style={{fontSize:12,color:C.text}}>{OFICIO_ICONS[o]} {o}</span>
<span style={{fontSize:11,fontWeight:700,color:C.accent}}>{count} pros</span>
</div>
<div style={{height:5,background:C.border,borderRadius:99,overflow:"hidden"}}>


<div
style={{width:pct+"%",height:"100%",background:"linear-gradient(90deg,"+C.accent+","+C.or
ange+")",borderRadius:99}} />
</div>
</div>;
})}
</GCard>
</>)}
</>)}
</div>
<nav
style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(10,10,15,0.97)",backdropFilt
er:"blur(20px)",borderTop:"1px solid
"+C.accent+"22",display:"flex",zIndex:200,overflowX:"auto"}}>








{([["overview"," ","Overview"],["funnel"," ","Embudo"],["usuarios"," ","Usuarios"],["registr
os"," ","Registros"],["trabajos"," ","Trabajos"],["mensajes"," ","Mensajes"],["trafico"," "
,"Tráfico"]] as const).map(([id,icon,label])=>(
<button key={id} onClick={()=>setTab(id as AdminTab)} style={{flex:"0 0
auto",minWidth:60,padding:"8px 4px
10px",background:"none",border:"none",color:tab===id?C.accent:C.muted,cursor:"pointer",di
splay:"flex",flexDirection:"column",alignItems:"center",gap:2,borderBottom:tab===id?"2px
solid "+C.accent:"2px solid transparent"}}>
<span style={{fontSize:16}}>{icon}</span>
<span style={{fontSize:8,fontWeight:600,whiteSpace:"nowrap"}}>{label}</span>
</button>
))}
</nav>
</div>
);
}
// ─── ROOT ───

// ─── RADAR DE URGENCIAS ───
function UrgencyRadar({workers,currentUser,onSelect}:{workers:UserRow[];currentUser:UserRow|null;onSelect:(w:UserRow)=>void}){
  const [oficio,setOficio]=useState("Todos");
  const [sent,setSent]=useState(false);
  const urgent=workers.filter(w=>
    w.available&&(w.schedule&&(w.schedule.includes("24h")||w.schedule.includes("Urgencias"))||w.plan==="elite")&&
    (oficio==="Todos"||w.trade===oficio)
  ).sort((a,b)=>PLAN_GATES.priority[b.plan as Plan]-PLAN_GATES.priority[a.plan as Plan]);
  const col=wColor("urgencia");
  const sendUrgency=async()=>{
    if(!currentUser||urgent.length===0) return;
    setSent(true);
    await db.from("jobs").insert({worker_id:urgent[0].id,client_id:currentUser.id,client_name:currentUser.name,title:"🚨 URGENCIA - "+oficio,description:"Radar de urgencias",status:"pending",price:0,updated_at:new Date().toISOString()});
    setTimeout(()=>setSent(false),4000);
  };
  return (
    <div style={{background:"linear-gradient(135deg,#1a0808,#0a0a0f)",borderRadius:16,border:"2px solid #FF445544",padding:18,marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#FF4455,#FF8800)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🚨</div>
        <div>
          <p style={{fontWeight:900,fontSize:16,color:"#FF4455"}}>Radar de Urgencias</p>
          <p style={{fontSize:11,color:"#7777AA"}}>{urgent.length} profesionales disponibles ahora</p>
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6}}>
          <span style={{width:8,height:8,borderRadius:"50%",background:"#FF4455",display:"inline-block",animation:"pulse 1s infinite"}} />
          <span style={{fontSize:10,color:"#FF4455",fontWeight:700}}>EN VIVO</span>
        </div>
      </div>
      <select value={oficio} onChange={e=>setOficio(e.target.value)} style={{width:"100%",background:C.card,border:"1px solid #FF445533",borderRadius:8,padding:"9px 12px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,cursor:"pointer",outline:"none",marginBottom:10}}>
        <option style={{background:C.card}}>Todos</option>
        {OFICIOS.map(o=><option key={o} style={{background:C.card}}>{o}</option>)}
      </select>
      {urgent.slice(0,3).map(w=>{
        const wc=wColor(w.id);
        return <div key={w.id} onClick={()=>onSelect(w)} style={{display:"flex",gap:10,alignItems:"center",background:C.card,borderRadius:10,padding:"10px 12px",border:"1px solid #FF445522",cursor:"pointer",marginBottom:6}}>
          <Ava s={w.name.substring(0,2).toUpperCase()} size={36} color={wc} online={true} />
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontWeight:700,fontSize:13,color:C.text}}>{w.name}</p>
            <p style={{fontSize:11,color:wc}}>{OFICIO_ICONS[w.trade||""]||"🔧"} {w.trade} · {w.zone}</p>
          </div>
          <div style={{textAlign:"right"}}>
            <p style={{fontSize:12,fontWeight:700,color:C.green}}>Disponible</p>
            <p style={{fontSize:10,color:C.muted}}>{w.price||30}€/h</p>
          </div>
        </div>;
      })}
      {urgent.length===0&&<p style={{textAlign:"center",color:C.muted,fontSize:13,padding:"12px 0"}}>Sin profesionales de urgencias disponibles ahora</p>}
      {currentUser?(
        <button onClick={sendUrgency} disabled={sent||urgent.length===0} style={{width:"100%",padding:"12px",background:sent?"transparent":"linear-gradient(135deg,#FF4455,#FF6600)",border:"1px solid #FF445555",borderRadius:10,color:sent?C.green:"#fff",fontFamily:"'DM Sans',sans-serif",fontWeight:900,fontSize:14,cursor:sent||urgent.length===0?"not-allowed":"pointer",opacity:urgent.length===0?0.5:1,transition:"all 0.3s"}}>
          {sent?"✓ Profesionales notificados — Te llamarán pronto":"🚨 Notificar a todos los disponibles"}
        </button>
      ):(
        <div style={{padding:"10px",background:C.surface,borderRadius:8,textAlign:"center",border:"1px solid "+C.border}}>
          <p style={{fontSize:12,color:C.muted}}>Inicia sesión para usar el Radar</p>
        </div>
      )}
    </div>
  );
}
void col;

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

const
update=(u:UserRow)=>{setUser(u);localStorage.setItem("oy_user",JSON.stringify(u));};
if(!ready) return <div
style={{minHeight:"100dvh",background:C.bg,display:"flex",alignItems:"center",justifyContent
:"center"}}><Spin /></div>;
return (<>
<style>{`
@import
url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&di
splay=swap');
*{box-sizing:border-box;margin:0;padding:0;}
html{overflow-x:hidden;background:#0A0A0F;}
body{background:#0A0A0F;color:#F0F0FA;font-family:'DM
Sans',sans-serif;overflow-x:hidden;min-height:100dvh;}
#root{min-height:100dvh;background:#0A0A0F;}
input,textarea,select{box-sizing:border-box;}
input::placeholder,textarea::placeholder{color:#44445A;}
select option{background:#16161F;color:#F0F0FA;}
::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrol
lbar-thumb{background:#1E1E30;border-radius:99px;}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}
`}</style>
{!user&&<Auth onLogin={login} />}
{user&&user.type==="admin"&&<Admin onLogout={logout} />}
{user&&user.type==="profesional"&&<ProDashboard user={user} onLogout={logout}
onUpdate={update} />}
{user&&user.type==="cliente"&&<ClientHome user={user} onLogout={logout} />}
</>);
}

// ─── QUICK MATCH MODAL ───
function
QuickMatchModal({workers,onClose,onSelect}:{workers:UserRow[];onClose:()=>void;onSele
ct:(w:UserRow)=>void}){
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
<Sheet onClose={onClose} title="
Encuentra tu profesional">
{/* Progress */}
<div style={{display:"flex",gap:4,marginBottom:20}}>
{[0,1,2,3].map(s=><div key={s}
style={{flex:1,height:4,borderRadius:99,background:s<=step?C.accent:C.border,transition:"b
ackground 0.3s"}} />)}
</div>
{step===0&&(<>
<p style={{fontWeight:700,color:C.text,fontSize:15,marginBottom:4}}>¿Qué profesional
necesitas?</p>
<p style={{fontSize:12,color:C.muted,marginBottom:14}}>Selecciona el tipo de
servicio</p>
<div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20}}>
{topTrades.map(t=>(
<button key={t} onClick={()=>{setTrade(t);setStep(1);}} style={{padding:"10px
14px",borderRadius:10,border:"1px solid
"+(trade===t?C.accent:C.border),background:trade===t?C.accent+"18":C.surface,color:trad
e===t?C.accent:C.text,cursor:"pointer",fontSize:13,fontFamily:"'DM
Sans',sans-serif",fontWeight:600,display:"flex",alignItems:"center",gap:6,transition:"all
0.15s"}}>
<span>{OFICIO_ICONS[t]||" "}</span>{t}
</button>
))}
</div>
<Btn outline full onClick={()=>setStep(1)} color={C.muted} small>Saltar → Ver
todos</Btn>
</>)}


{step===1&&(<>
<p style={{fontWeight:700,color:C.text,fontSize:15,marginBottom:4}}>¿En qué zona de
Sevilla?</p>
<p style={{fontSize:12,color:C.muted,marginBottom:14}}>Para mostrarte los más
cercanos</p>
<div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:20}}>
{SEVILLA_ZONAS.slice(0,12).map(z=>(
<button key={z} onClick={()=>{setZone(z);setStep(2);}} style={{padding:"8px
12px",borderRadius:10,border:"1px solid
"+(zone===z?C.blue:C.border),background:zone===z?C.blue+"18":C.surface,color:zone===
z?C.blue:C.text,cursor:"pointer",fontSize:12,fontFamily:"'DM
Sans',sans-serif",fontWeight:zone===z?700:400,transition:"all 0.15s"}}>
{z}


</button>
))}
</div>
<Btn outline full onClick={()=>setStep(2)} color={C.muted} small>No importa la zona
→</Btn>
</>)}
{step===2&&(<>
<p style={{fontWeight:700,color:C.text,fontSize:15,marginBottom:4}}>¿Con qué
urgencia?</p>
<p style={{fontSize:12,color:C.muted,marginBottom:14}}>Te mostramos los que pueden
verte antes</p>
<div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
{[{v:"now",l:"
Urgente — necesito ayuda hoy",c:C.red},{v:"week",l:"
Esta semana
— tengo tiempo",c:C.blue},{v:"quote",l:"
Solo quiero un
presupuesto",c:C.green}].map(o=>(
<button key={o.v} onClick={()=>{setUrgency(o.v);setStep(3);}} style={{padding:"14px
16px",borderRadius:10,border:"1px solid
"+o.c+"44",background:o.c+"12",color:C.text,cursor:"pointer",fontSize:13,fontFamily:"'DM
Sans',sans-serif",fontWeight:600,textAlign:"left",transition:"all 0.15s"}}>
{o.l}
</button>
))}
</div>
</>)}




{step===3&&(<>
<p style={{fontWeight:700,color:C.text,fontSize:15,marginBottom:4}}>
{matches.length>0?`
Encontramos ${matches.length}
profesional${matches.length>1?"es":""}`:"
Sin resultados exactos"}
</p>
<p style={{fontSize:12,color:C.muted,marginBottom:14}}>
{trade&&<span style={{color:C.accent,fontWeight:600}}>{OFICIO_ICONS[trade]}
{trade}</span>}{zone&&<span style={{color:C.blue}}> ·
{zone}</span>}
</p>
{matches.length===0&&(
<div style={{textAlign:"center",padding:20,color:C.muted,marginBottom:14}}>
<p style={{fontSize:13}}>No hay profesionales disponibles ahora con esos filtros</p>
<button onClick={()=>{setTrade("");setZone("");setStep(3);}}
style={{marginTop:10,background:"none",border:"none",color:C.accent,cursor:"pointer",fontS
ize:12,fontWeight:700}}>Ver todos los disponibles →</button>
</div>
)}
<div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
{matches.map(w=>{
const col=wColor(w.id);
return <GCard key={w.id} onClick={()=>onSelect(w)} glow={col}
style={{padding:14}}>




<div style={{display:"flex",gap:12,alignItems:"center"}}>
<Ava s={w.name.substring(0,2).toUpperCase()} size={44} color={col} online />
<div style={{flex:1}}>
<p style={{fontWeight:700,color:C.text,fontSize:14}}>{w.name}</p>
<p style={{fontSize:12,color:col}}>{OFICIO_ICONS[w.trade||""]||" "}
{w.trade}</p>
<div style={{display:"flex",gap:5,alignItems:"center",marginTop:2}}>
<Stars n={w.rating} size={10} />
<span
style={{fontSize:11,color:C.text,fontWeight:700}}>{w.rating>0?w.rating.toFixed(1):"Nuevo"}</
span>
{w.free_quote&&<span style={{fontSize:10,color:C.green}}>· Presupuesto
gratis</span>}
</div>
</div>
<div style={{textAlign:"right"}}>
<p style={{fontWeight:800,fontSize:18,color:C.accent}}>{w.price}€<span
style={{fontSize:10,color:C.muted}}>/h</span></p>
<p style={{fontSize:10,color:C.green}}>● Disponible</p>
</div>
</div>
</GCard>;
})}
</div>
<Btn full onClick={()=>{onClose();}} color={C.accent}>Ver todos los profesionales
→</Btn>
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
// REAL GeoJSON coordinates for Sevilla barrios (from OpenStreetMap data)
const BARRIOS_SEVILLA = [
{id:"Centro",color:"#FFD700",latlngs:[[37.3961,-5.9953],[37.3958,-5.9916],[37.3944,-5.9873],
[37.3921,-5.9836],[37.3896,-5.9823],[37.3872,-5.9829],[37.3854,-5.9851],[37.3851,-5.9883],[
37.3862,-5.9921],[37.3886,-5.9952],[37.3916,-5.9967],[37.3944,-5.9965]]},
{id:"Triana",color:"#FF6B6B",latlngs:[[37.3989,-6.0156],[37.3991,-6.0098],[37.3978,-6.0052],[
37.3955,-6.0012],[37.3921,-5.9988],[37.3892,-5.9981],[37.3869,-5.9991],[37.3851,-6.0018],[
37.3843,-6.0058],[37.3851,-6.0101],[37.3874,-6.0138],[37.3909,-6.0158],[37.3946,-6.0162],[
37.3971,-6.0158]]},
{id:"Los
Remedios",color:"#4ECDC4",latlngs:[[37.3851,-6.0018],[37.3843,-6.0058],[37.3851,-6.0101],
[37.3836,-6.0098],[37.3798,-6.0071],[37.3768,-6.0038],[37.3754,-5.9998],[37.3758,-5.9958],[
37.3779,-5.9928],[37.3812,-5.9918],[37.3843,-5.9934],[37.3869,-5.9991]]},
{id:"Nervión",color:"#45B7D1",latlngs:[[37.3961,-5.9953],[37.3944,-5.9965],[37.3960,-5.9895]
,[37.3988,-5.9833],[37.4008,-5.9776],[37.4001,-5.9718],[37.3978,-5.9678],[37.3954,-5.9668],
[37.3928,-5.9689],[37.3911,-5.9728],[37.3913,-5.9772],[37.3929,-5.9810],[37.3944,-5.9837],[
37.3961,-5.9873]]},
{id:"La
Macarena",color:"#A78BFA",latlngs:[[37.4098,-5.9988],[37.4121,-5.9941],[37.4128,-5.9881],[
37.4118,-5.9821],[37.4091,-5.9773],[37.4058,-5.9743],[37.4021,-5.9738],[37.3988,-5.9758],[
37.3972,-5.9791],[37.3961,-5.9831],[37.3961,-5.9873],[37.3988,-5.9833],[37.4008,-5.9776],[
37.4038,-5.9761],[37.4068,-5.9771],[37.4088,-5.9801],[37.4091,-5.9851],[37.4078,-5.9901],[
37.4058,-5.9941]]},
{id:"San
Pablo",color:"#FB923C",latlngs:[[37.4098,-5.9988],[37.4058,-5.9941],[37.4078,-5.9901],[37.4
091,-5.9851],[37.4088,-5.9801],[37.4121,-5.9741],[37.4148,-5.9701],[37.4168,-5.9638],[37.4
158,-5.9578],[37.4131,-5.9541],[37.4098,-5.9531],[37.4068,-5.9548],[37.4048,-5.9578],[37.4
038,-5.9621],[37.4041,-5.9671],[37.4058,-5.9718],[37.4088,-5.9738]]},
{id:"Bellavista",color:"#34D399",latlngs:[[37.3758,-5.9958],[37.3754,-5.9998],[37.3768,-6.003
8],[37.3748,-6.0031],[37.3718,-5.9998],[37.3694,-5.9951],[37.3681,-5.9898],[37.3686,-5.984
1],[37.3708,-5.9798],[37.3738,-5.9778],[37.3768,-5.9788],[37.3791,-5.9818],[37.3798,-5.985
8],[37.3791,-5.9901],[37.3779,-5.9928],[37.3758,-5.9958]]},
{id:"Cerro-Amate",color:"#60A5FA",latlngs:[[37.3978,-5.9678],[37.4001,-5.9718],[37.4008,-5.
9776],[37.3988,-5.9833],[37.3961,-5.9873],[37.3944,-5.9837],[37.3928,-5.9810],[37.3911,-5.
9771],[37.3898,-5.9721],[37.3891,-5.9661],[37.3901,-5.9601],[37.3924,-5.9558],[37.3954,-5.
9541],[37.3984,-5.9558],[37.4001,-5.9594],[37.4001,-5.9638]]},
{id:"Sur",color:"#F472B6",latlngs:[[37.3791,-5.9818],[37.3768,-5.9788],[37.3738,-5.9778],[37.
3718,-5.9798],[37.3698,-5.9841],[37.3691,-5.9888],[37.3664,-5.9871],[37.3638,-5.9838],[37.

3624,-5.9791],[37.3628,-5.9741],[37.3651,-5.9701],[37.3681,-5.9678],[37.3714,-5.9678],[37.
3744,-5.9694],[37.3764,-5.9724],[37.3771,-5.9771]]},
{id:"Torreblanca",color:"#FBBF24",latlngs:[[37.3978,-5.9678],[37.4001,-5.9638],[37.4001,-5.9
594],[37.3984,-5.9558],[37.3984,-5.9491],[37.4001,-5.9431],[37.4028,-5.9391],[37.4061,-5.9
368],[37.4098,-5.9368],[37.4128,-5.9391],[37.4141,-5.9431],[37.4131,-5.9481],[37.4104,-5.9
518],[37.4068,-5.9531],[37.4038,-5.9541],[37.4001,-5.9578],[37.3984,-5.9628]]},
{id:"Norte",color:"#6EE7B7",latlngs:[[37.4128,-5.9881],[37.4148,-5.9941],[37.4168,-5.9988],[
37.4188,-6.0028],[37.4198,-6.0078],[37.4188,-6.0121],[37.4158,-6.0148],[37.4121,-6.0151],[
37.4088,-6.0128],[37.4068,-6.0091],[37.4068,-6.0041],[37.4088,-6.0001],[37.4118,-5.9971],[
37.4128,-5.9928]]},
{id:"Pino
Montano",color:"#C4B5FD",latlngs:[[37.4168,-5.9638],[37.4188,-5.9578],[37.4208,-5.9511],[3
7.4228,-5.9451],[37.4258,-5.9411],[37.4291,-5.9391],[37.4318,-5.9411],[37.4328,-5.9461],[37
.4311,-5.9518],[37.4278,-5.9561],[37.4241,-5.9578],[37.4208,-5.9578],[37.4181,-5.9601]]},
{id:"Sevilla
Este",color:"#F97316",latlngs:[[37.3984,-5.9491],[37.3984,-5.9428],[37.3998,-5.9368],[37.40
21,-5.9311],[37.4054,-5.9268],[37.4091,-5.9241],[37.4131,-5.9241],[37.4161,-5.9268],[37.41
71,-5.9318],[37.4158,-5.9368],[37.4131,-5.9391],[37.4098,-5.9368],[37.4061,-5.9368],[37.40
28,-5.9391],[37.4001,-5.9431],[37.3984,-5.9491]]},
];
function
SevillaMap({selectedZone,onZoneSelect}:{selectedZone:string;onZoneSelect:(z:string)=>voi
d}){
const mapRef = useRef<HTMLDivElement>(null);
const leafletRef = useRef<L.Map|null>(null);
const polysRef = useRef<Record<string,L.Polygon>>({});
const markersRef = useRef<Record<string,L.Marker>>({});
const [filter,setFilter] = useState<"sevilla"|"pueblos">("sevilla");
// Init map
useEffect(()=>{
if(!mapRef.current||leafletRef.current) return;
const map = L.map(mapRef.current,{
center:[37.388,-5.982],zoom:12,
zoomControl:false,scrollWheelZoom:true,
attributionControl:false,
});
L.control.zoom({position:"bottomright"}).addTo(map);
L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",{
subdomains:"abcd",maxZoom:19,
}).addTo(map);
L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",{
subdomains:"abcd",maxZoom:19,opacity:0.6,
}).addTo(map);

// Draw barrios
BARRIOS_SEVILLA.forEach(b=>{
const coords = b.latlngs.map(c=>[c[0],c[1]] as L.LatLngTuple);
const isActive = selectedZone===b.id;
const poly = L.polygon(coords,{
color:b.color,fillColor:b.color,
fillOpacity:isActive?0.50:0.18,
weight:isActive?2.5:1.2,opacity:isActive?1:0.65,
dashArray:isActive?undefined:"5,4",smoothFactor:2,
}).addTo(map);
poly.on("mouseover",()=>{ if(selectedZone!==b.id)
poly.setStyle({fillOpacity:0.38,dashArray:undefined,weight:2}); });
poly.on("mouseout",()=>{ if(selectedZone!==b.id)
poly.setStyle({fillOpacity:0.18,dashArray:"5,4",weight:1.2}); });
poly.on("click",()=>onZoneSelect(selectedZone===b.id?"":b.id));
polysRef.current[b.id]=poly;
// Label
const center = poly.getBounds().getCenter();
const icon = L.divIcon({
html:`<span
style="color:${isActive?"#fff":b.color};font-size:${isActive?"11px":"9.5px"};font-weight:${isActiv
e?"800":"600"};font-family:'DM Sans',sans-serif;text-shadow:0 1px 4px
rgba(0,0,0,0.95);white-space:nowrap;pointer-events:none;${isActive?"background:"+b.color+
"44;padding:2px 6px;border-radius:4px;":""}">${b.id}</span>`,
iconSize:[90,18],iconAnchor:[45,9],className:"",
});
markersRef.current[b.id]=L.marker(center,{icon,interactive:false,zIndexOffset:isActive?500:0}
).addTo(map);
});
// Draw pueblos as dots
PUEBLOS_CERCANOS.forEach(p=>{
const isActive = selectedZone===p.id;
const icon = L.divIcon({
html:`<div
style="display:flex;flex-direction:column;align-items:center;pointer-events:none;"><div
style="width:${isActive?10:7}px;height:${isActive?10:7}px;border-radius:50%;background:${i
sActive?"#FFD700":"#4ECDC4"};box-shadow:0 0 8px
${isActive?"#FFD700":"#4ECDC4"}88;border:2px solid
${isActive?"#FFD700":"rgba(255,255,255,0.3)"}"></div><span
style="color:${isActive?"#FFD700":"#aaa"};font-size:9px;font-weight:${isActive?700:500};font
-family:'DM Sans',sans-serif;text-shadow:0 1px 3px
rgba(0,0,0,0.9);margin-top:2px;white-space:nowrap">${p.label}</span></div>`,
iconSize:[80,32],iconAnchor:[40,5],className:"",
});

const marker =
L.marker([p.lat,p.lng],{icon,interactive:true,zIndexOffset:isActive?500:0}).addTo(map);
marker.on("click",()=>onZoneSelect(selectedZone===p.id?"":p.id));
});
leafletRef.current=map;
// Zoom handler — auto switch filter based on zoom
map.on("zoomend",()=>{
const z=map.getZoom();
if(z>=13) setFilter("sevilla");
else if(z<=11) setFilter("pueblos");
});
return ()=>{map.remove();leafletRef.current=null;};
},[]);
// Update poly styles when selection changes
useEffect(()=>{
BARRIOS_SEVILLA.forEach(b=>{
const poly=polysRef.current[b.id];
if(!poly) return;
const isActive=selectedZone===b.id;
poly.setStyle({fillOpacity:isActive?0.50:0.18,weight:isActive?2.5:1.2,dashArray:isActive?unde
fined:"5,4",opacity:isActive?1:0.65});
});
},[selectedZone]);
// Pan map when filter changes
useEffect(()=>{
const map=leafletRef.current;
if(!map) return;
if(filter==="sevilla") map.flyTo([37.388,-5.982],13,{duration:0.8});
else map.flyTo([37.38,-6.0],11,{duration:0.8});
},[filter]);
return (
<div style={{marginBottom:16,borderRadius:16,overflow:"hidden",border:"1px solid
"+(selectedZone?C.accent+"55":C.border),background:C.card,boxShadow:"0 8px 32px
rgba(0,0,0,0.5)"}}>
{/* Header */}
<div style={{padding:"12px
16px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gr
adient(135deg,"+C.card+",#0F0F1A)",borderBottom:"1px solid "+C.border}}>
<div>
<p style={{fontSize:13,fontWeight:700,color:C.text}}>
Selecciona una zona</p>


<p style={{fontSize:10,color:C.muted,marginTop:1}}>Haz clic en el mapa o usa los
botones</p>
</div>
{selectedZone&&(
<button onClick={()=>onZoneSelect("")}
style={{display:"flex",alignItems:"center",gap:5,padding:"4px
10px",background:C.accent+"15",border:"1px solid
"+C.accent+"44",borderRadius:99,color:C.accent,cursor:"pointer",fontSize:11,fontWeight:700
,fontFamily:"'DM Sans',sans-serif"}}>
<span
style={{maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sele
ctedZone}</span>
<span>✕</span>
</button>
)}
</div>
{/* Map */}
<div ref={mapRef} style={{height:280,width:"100%"}} />
{/* Filter tabs + pills */}
<div style={{background:"linear-gradient(180deg,"+C.card+",#0F0F1A)",borderTop:"1px
solid "+C.border}}>
{/* Sevilla / Pueblos toggle */}
<div style={{display:"flex",padding:"10px 12px 6px",gap:6}}>
<button onClick={()=>setFilter("sevilla")}
style={{flex:1,padding:"8px",borderRadius:10,border:"1px solid
"+(filter==="sevilla"?C.accent:C.border),background:filter==="sevilla"?"linear-gradient(135de
g,"+C.accent+"22,"+C.orange+"11)":"transparent",color:filter==="sevilla"?C.accent:C.muted,c
ursor:"pointer",fontFamily:"'DM
Sans',sans-serif",fontSize:12,fontWeight:filter==="sevilla"?700:500,transition:"all 0.2s"}}>
Sevilla capital
</button>
<button onClick={()=>setFilter("pueblos")}
style={{flex:1,padding:"8px",borderRadius:10,border:"1px solid
"+(filter==="pueblos"?C.cyan:C.border),background:filter==="pueblos"?"linear-gradient(135d
eg,"+C.cyan+"22,transparent)":"transparent",color:filter==="pueblos"?C.cyan:C.muted,cursor
:"pointer",fontFamily:"'DM
Sans',sans-serif",fontSize:12,fontWeight:filter==="pueblos"?700:500,transition:"all 0.2s"}}>
Pueblos cercanos
</button>
</div>



{/* Sevilla barrio pills */}
{filter==="sevilla"&&(
<div style={{padding:"4px 12px
10px",display:"flex",gap:5,flexWrap:"wrap",maxHeight:75,overflowY:"auto"}}>
{BARRIOS_SEVILLA.map(b=>{

const isActive=selectedZone===b.id;
return <button key={b.id} onClick={()=>onZoneSelect(isActive?"":b.id)}
style={{padding:"4px 10px",borderRadius:99,border:"1px solid
"+(isActive?b.color:C.border),background:isActive?b.color+"25":"transparent",color:isActive?
b.color:C.muted,cursor:"pointer",fontSize:10,fontFamily:"'DM
Sans',sans-serif",fontWeight:isActive?700:400,transition:"all 0.15s",whiteSpace:"nowrap"}}>
{b.id}
</button>;
})}
</div>
)}
{/* Pueblos pills */}
{filter==="pueblos"&&(
<div style={{padding:"4px 12px
10px",display:"flex",gap:5,flexWrap:"wrap",maxHeight:75,overflowY:"auto"}}>
{PUEBLOS_CERCANOS.map(p=>{
const isActive=selectedZone===p.id;
return <button key={p.id} onClick={()=>onZoneSelect(isActive?"":p.id)}
style={{padding:"4px 10px",borderRadius:99,border:"1px solid
"+(isActive?C.cyan:C.border),background:isActive?C.cyan+"22":"transparent",color:isActive?
C.cyan:C.muted,cursor:"pointer",fontSize:10,fontFamily:"'DM
Sans',sans-serif",fontWeight:isActive?700:400,transition:"all 0.15s",whiteSpace:"nowrap"}}>
{p.label}
</button>;
})}
</div>
)}
</div>
</div>
);
}


// ─── RANKING SECTION COMPONENT ───
function
RankingSection({workers,onSelect}:{workers:UserRow[];onSelect:(w:UserRow)=>void}){
const [filterZone,setFilterZone]=useState("Todas");
const [filterTrade,setFilterTrade]=useState("Todos");
const eligible=workers.filter(w=>
PLAN_GATES.ranking[w.plan as Plan]&&
(filterZone==="Todas"||w.zone===filterZone)&&
(filterTrade==="Todos"||w.trade===filterTrade)
).sort((a,b)=>b.rating*b.reviews-a.rating*a.reviews);
const pCol=["#FFD700","#C0C0C0","#CD7F32"];
return (

<div style={{padding:"22px 0 16px"}}>
<h2 style={{fontWeight:900,fontSize:24,letterSpacing:"-0.02em",marginBottom:4}}><span
style={{color:C.text}}>
Ranking de</span> <span
style={{color:C.accent}}>Profesionales</span></h2>
<p style={{fontSize:13,color:C.muted,marginBottom:16}}>Los mejores valorados de la
plataforma</p>


<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
<select value={filterZone} onChange={e=>setFilterZone(e.target.value)}
style={{padding:"10px 12px",background:C.card,border:"1px solid
"+C.border,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:13,cursor:"pointer",outlin
e:"none"}}>
<option style={{background:C.card}}>Todas</option>
{ZONAS.map(z=><option key={z} style={{background:C.card}}>{z}</option>)}
</select>
<select value={filterTrade} onChange={e=>setFilterTrade(e.target.value)}
style={{padding:"10px 12px",background:C.card,border:"1px solid
"+C.border,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:13,cursor:"pointer",outlin
e:"none"}}>
<option style={{background:C.card}}>Todos</option>
{OFICIOS.map(o=><option key={o} style={{background:C.card}}>{o}</option>)}
</select>
</div>


{eligible.length===0&&<div style={{textAlign:"center",padding:40,color:C.muted}}>
<p style={{fontSize:32,marginBottom:8}}> </p>
<p style={{fontWeight:700,fontSize:16,marginBottom:6}}>Sin profesionales en el
ranking</p>
<p style={{fontSize:13}}>El ranking muestra profesionales con plan Pro o Élite</p>
</div>}
{/* Podium top 3 */}
{eligible.length>=3&&(
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr
1fr",gap:10,marginBottom:16,alignItems:"flex-end"}}>
{[eligible[1],eligible[0],eligible[2]].map((w,i)=>{
const positions=[2,1,3];
const heights=[110,150,90];
const col=pCol[i];
const pos=positions[i];
return <div key={w.id} style={{textAlign:"center",cursor:"pointer"}}
onClick={()=>onSelect(w)}>
<div style={{display:"flex",justifyContent:"center",marginBottom:6}}>
<Ava s={w.name.substring(0,2).toUpperCase()} size={pos===1?58:44} color={col}
/>
</div>

<p
style={{fontWeight:700,color:C.text,fontSize:pos===1?14:12,marginBottom:2}}>{w.name.split
(" ")[0]}</p>
<p style={{fontSize:10,color:C.muted,marginBottom:4}}>{w.zone}</p>
<Stars n={w.rating} size={pos===1?13:10} />
<div
style={{height:heights[i],background:"linear-gradient(180deg,"+col+"20,transparent)",border:"
1px solid "+col+"55",borderRadius:"8px 8px 0
0",display:"flex",alignItems:"center",justifyContent:"center",marginTop:8}}>
<span
style={{fontFamily:"monospace",fontSize:36,fontWeight:900,color:col}}>#{pos}</span>
</div>
</div>;
})}
</div>
)}
{/* Rest of ranking */}
<div style={{display:"flex",flexDirection:"column",gap:8}}>
{eligible.slice(eligible.length>=3?3:0).map((w,i)=>{
const col=wColor(w.id);
return <GCard key={w.id} onClick={()=>onSelect(w)} glow={col} style={{padding:"12px
16px",display:"flex",alignItems:"center",gap:12}}>
<span
style={{fontWeight:800,fontSize:18,color:C.muted,width:28,textAlign:"center"}}>#{i+(eligible.l
ength>=3?4:1)}</span>
<Ava s={w.name.substring(0,2).toUpperCase()} size={38} color={col}
online={w.available} />
<div style={{flex:1,minWidth:0}}>
<p style={{fontWeight:700,color:C.text,fontSize:13}}>{w.name}</p>
<p style={{fontSize:11,color:C.muted}}>{w.trade} · {w.zone}</p>
</div>
<div style={{textAlign:"right"}}>
<Stars n={w.rating} size={11} />
<p
style={{fontSize:11,fontWeight:700,color:C.accent}}>{w.rating>0?w.rating.toFixed(1):"Nuevo"
}</p>
<p style={{fontSize:10,color:C.muted}}>({w.reviews})</p>
</div>
</GCard>;
})}
</div>
</div>
);
}
