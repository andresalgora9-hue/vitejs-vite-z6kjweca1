import { useState, useEffect, useRef, useCallback } from "react";
import { db, STORAGE_URL } from "./supabase";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { UserRow, MessageRow, JobRow, CertRow, Plan, PhotoRow } from "./supabase";

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

// ─── PLAN FEATURE GATES ───
const PLAN_GATES = {
  contacts: {gratis:5, basico:20, pro:9999, elite:9999} as Record<Plan,number>,
  photos: {gratis:0, basico:5, pro:20, elite:999} as Record<Plan,number>,
  ranking: {gratis:false, basico:false, pro:true, elite:true} as Record<Plan,boolean>,
  chat: {gratis:false, basico:true, pro:true, elite:true} as Record<Plan,boolean>,
};

// ─── LEAD SYSTEM ───
async function getLeadsThisMonth(proId:string):Promise<number>{
  const now=new Date();
  const monthStart=new Date(now.getFullYear(),now.getMonth(),1).toISOString();
  const {count}=await db.from("leads_log").select("id",{count:"exact"} as any).eq("pro_id",proId).gte("created_at",monthStart);
  return count||0;
}

async function logLead(proId:string, visitorId:string|null, type:"whatsapp"|"call"|"message"):Promise<boolean>{
  const now=new Date();
  const monthStr=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0");
  const {data:pro}=await db.from("users").select("plan").eq("id",proId).single();
  if(!pro) return false;
  const limit=PLAN_GATES.contacts[pro.plan as Plan];
  const used=await getLeadsThisMonth(proId);
  if(used>=limit&&limit<9999){
    await db.from("leads_log").insert({pro_id:proId,visitor_id:visitorId,type,blocked:true,month:monthStr});
    return false;
  }
  await db.from("leads_log").insert({pro_id:proId,visitor_id:visitorId,type,blocked:false,month:monthStr});
  return true;
}

async function uploadImage(file:File, path:string):Promise<string|null>{
  const ext=file.name.split('.').pop();
  const fileName=path+"/"+Date.now()+"."+ext;
  const {error}=await db.storage.from("photos").upload(fileName, file, {contentType:file.type, upsert:true});
  if(error){console.error("Upload error:",error);return null;}
  return STORAGE_URL+fileName;
}

const wColor=(id:string)=>[C.purple,C.blue,C.pink,"#10B981",C.orange,C.cyan][id.charCodeAt(id.length-1)%6];
function trialDaysLeft(t:string){return Math.max(0,Math.ceil((new Date(t).getTime()-Date.now())/86400000));}
function timeAgo(iso:string){
  const d=(Date.now()-new Date(iso).getTime())/1000;
  if(d<60)return"ahora";if(d<3600)return Math.floor(d/60)+"m";
  if(d<86400)return Math.floor(d/3600)+"h";return Math.floor(d/86400)+"d";
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
  if(!msg)return null;
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

// ─── LEADS COUNTER COMPONENT ───
function LeadsCounter({user,onUpgrade}:{user:UserRow;onUpgrade:()=>void}){
  const [used,setUsed]=useState(0);
  const [loading,setLoading]=useState(true);
  const limit=PLAN_GATES.contacts[user.plan as Plan];
  const isUnlimited=limit>=9999;

  useEffect(()=>{
    getLeadsThisMonth(user.id).then(n=>{setUsed(n);setLoading(false);});
  },[user.id]);

  if(loading)return null;
  if(isUnlimited)return(
    <div style={{padding:"8px 12px",background:C.green+"12",borderRadius:8,border:"1px solid "+C.green+"22",display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
      <span style={{fontSize:12}}>♾️</span>
      <span style={{fontSize:12,color:C.green,fontWeight:700}}>Contactos ilimitados este mes</span>
    </div>
  );
  const pct=Math.min(100,Math.round(used/limit*100));
  const col=pct>=100?C.red:pct>=80?C.orange:C.green;
  return(
    <div style={{padding:"10px 14px",background:col+"10",borderRadius:10,border:"1px solid "+col+"25",marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <span style={{fontSize:12,color:C.text,fontWeight:700}}>📊 Contactos este mes</span>
        <span style={{fontSize:13,fontWeight:800,color:col}}>{used}/{limit}</span>
      </div>
      <div style={{height:6,background:C.border,borderRadius:99,overflow:"hidden",marginBottom:6}}>
        <div style={{width:pct+"%",height:"100%",background:col,borderRadius:99,transition:"width 0.5s"}} />
      </div>
      {pct>=80&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:11,color:col}}>{pct>=100?"⛔ Límite alcanzado":"⚠️ Casi agotado"}</span>
        <button onClick={onUpgrade} style={{background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",border:"none",borderRadius:6,color:"#000",cursor:"pointer",padding:"4px 10px",fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:700}}>Mejorar plan →</button>
      </div>}
    </div>
  );
}

// ─── VISIT REQUEST MODAL ───
function VisitRequestModal({worker,currentUser,onClose,onSuccess}:{worker:UserRow;currentUser:UserRow;onClose:()=>void;onSuccess:()=>void}){
  const [desc,setDesc]=useState("");
  const [date,setDate]=useState("");
  const [slot,setSlot]=useState<"mañana"|"tarde">("mañana");
  const [photo,setPhoto]=useState<File|null>(null);
  const [photoPreview,setPhotoPreview]=useState("");
  const [saving,setSaving]=useState(false);
  const [leadBlocked,setLeadBlocked]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);

  const handleSubmit=async()=>{
    if(!desc.trim()||!date){return;}
    setSaving(true);
    // Check lead limit
    const ok=await logLead(worker.id,currentUser.id,"message");
    if(!ok){setLeadBlocked(true);setSaving(false);return;}
    let photoUrl="";
    if(photo){
      const url=await uploadImage(photo,"visits");
      if(url)photoUrl=url;
    }
    // Create job request
    await db.from("jobs").insert({
      worker_id:worker.id,
      client_id:currentUser.id,
      client_name:currentUser.name,
      title:"Solicitud de visita · "+date+" ("+slot+")",
      description:desc+(photoUrl?"\nFoto adjunta: "+photoUrl:""),
      status:"pending",
    });
    // Send message
    await db.from("messages").insert({
      from_id:currentUser.id,
      to_id:worker.id,
      text:"📅 Solicitud de visita para el "+date+" por la "+slot+".\n\n"+desc+(photoUrl?"\n📸 Foto adjunta.":""),
      read:false,
    });
    setSaving(false);
    onSuccess();
  };

  if(leadBlocked)return(
    <Sheet onClose={onClose} title="⛔ Límite alcanzado">
      <div style={{textAlign:"center",padding:"20px 0"}}>
        <p style={{fontSize:36,marginBottom:12}}>🔒</p>
        <p style={{fontWeight:700,color:C.text,fontSize:16,marginBottom:8}}>Este profesional ha alcanzado su límite de contactos este mes</p>
        <p style={{fontSize:13,color:C.muted,marginBottom:20}}>Inténtalo el próximo mes o contacta con otro profesional</p>
        <Btn full onClick={onClose}>Entendido</Btn>
      </div>
    </Sheet>
  );

  return(
    <Sheet onClose={onClose} title={"📅 Solicitar visita a "+worker.name}>
      <p style={{fontSize:12,color:C.muted,marginBottom:16}}>El profesional recibirá tu solicitud y confirmará la fecha</p>
      <Inp label="¿Qué trabajo necesitas? *" value={desc} onChange={setDesc} placeholder="Ej: Tengo una fuga en la cocina, necesito revisar las tuberías debajo del fregadero..." multiline required />
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <div>
          <p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Fecha *</p>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} min={new Date().toISOString().split("T")[0]} style={{width:"100%",background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"11px 14px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none"}} />
        </div>
        <div>
          <p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Franja horaria</p>
          <div style={{display:"flex",gap:6}}>
            {(["mañana","tarde"] as const).map(s=>(
              <button key={s} onClick={()=>setSlot(s)} style={{flex:1,padding:"11px 8px",borderRadius:8,border:"1px solid "+(slot===s?C.accent:C.border),background:slot===s?C.accent+"18":"transparent",color:slot===s?C.accent:C.muted,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:slot===s?700:400}}>
                {s==="mañana"?"🌅 Mañana":"🌆 Tarde"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div style={{marginBottom:14}}>
        <p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Foto del problema (opcional)</p>
        <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f){setPhoto(f);setPhotoPreview(URL.createObjectURL(f));}}} />
        {photoPreview?<div style={{position:"relative",marginBottom:8}}>
          <img src={photoPreview} alt="preview" style={{width:"100%",maxHeight:140,objectFit:"cover",borderRadius:10,border:"1px solid "+C.border}} />
          <button onClick={()=>{setPhoto(null);setPhotoPreview("");}} style={{position:"absolute",top:6,right:6,background:C.red,border:"none",borderRadius:"50%",width:24,height:24,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700}}>✕</button>
        </div>:
        <button onClick={()=>fileRef.current?.click()} style={{width:"100%",padding:"12px",background:C.surface,border:"1px dashed "+C.border,borderRadius:8,color:C.muted,cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif"}}>📸 Adjuntar foto del trabajo</button>}
      </div>
      <div style={{background:C.surface,borderRadius:8,padding:"10px 12px",marginBottom:14,border:"1px solid "+C.border}}>
        <p style={{fontSize:11,color:C.muted}}>📋 Tu solicitud se enviará a <strong style={{color:C.text}}>{worker.name}</strong> y quedará registrada en su panel de trabajos</p>
      </div>
      <Btn full disabled={saving||!desc.trim()||!date} onClick={handleSubmit}>{saving?"Enviando solicitud...":"Enviar solicitud de visita 📅"}</Btn>
    </Sheet>
  );
}

// ─── AUTH ───
function Auth({onLogin}:{onLogin:(u:UserRow)=>void}){
  const [mode,setMode]=useState<"login"|"pick"|"register_cliente"|"register_pro">("login");
  const [proStep,setProStep]=useState(1); // 1=datos, 2=oficio+zona, 3=plan
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  // shared fields
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [phone,setPhone]=useState("");
  const [pass,setPass]=useState("");
  // pro-only fields
  const [trade,setTrade]=useState(OFICIOS[0]);
  const [zone,setZone]=useState(ZONAS[0]);
  const [plan,setPlan]=useState<Plan>("gratis");
  const [showPlanDetail,setShowPlanDetail]=useState<Plan|null>(null);

  const resetForm=()=>{
    setName("");setEmail("");setPhone("");setPass("");
    setTrade(OFICIOS[0]);setZone(ZONAS[0]);setPlan("gratis");
    setErr("");setProStep(1);
  };

  const login=async()=>{
    if(!email||!pass){setErr("Introduce email y contraseña.");return;}
    setLoading(true);setErr("");
    if(email.toLowerCase()==="andresalgora9@gmail.com"&&pass==="Oficiooficio9"){
      const adminUser:UserRow={
        id:"admin-001",name:"Andrés Admin",email:"andresalgora9@gmail.com",
        password:"",phone:"",type:"admin",plan:"elite",bio:"",price:0,
        trade:"",zone:"Sevilla",rating:0,reviews:0,jobs:0,verified:true,
        available:true,whatsapp:"",service_zones:[],schedule:"",
        response_time:"",free_quote:false,experience_years:0,specialties:[],
        trial_end:"2099-12-31",joined_at:new Date().toISOString(),
      };
      setLoading(false);
      localStorage.setItem("oy_user",JSON.stringify(adminUser));
      onLogin(adminUser);
      return;
    }
    const {data,error}=await db.from("users").select("*").eq("email",email.toLowerCase()).eq("password",pass).single();
    setLoading(false);
    if(error||!data){setErr("Email o contraseña incorrectos.");return;}
    localStorage.setItem("oy_user",JSON.stringify(data));
    onLogin(data as UserRow);
  };

  const registerCliente=async()=>{
    if(!name||!email||!pass){setErr("Nombre, email y contraseña son obligatorios.");return;}
    if(pass.length<6){setErr("Mínimo 6 caracteres en la contraseña.");return;}
    if(!/\S+@\S+\.\S+/.test(email)){setErr("Introduce un email válido.");return;}
    setLoading(true);setErr("");
    try{
      const {data:ex}=await db.from("users").select("id").eq("email",email.toLowerCase()).maybeSingle();
      if(ex){setLoading(false);setErr("Ya existe una cuenta con ese email.");return;}
      const trial_end=new Date(Date.now()+365*86400000).toISOString().split("T")[0];
      const insertData:any={
        name:name.trim(),
        email:email.toLowerCase().trim(),
        password:pass,
        type:"cliente",
        plan:"gratis",
        bio:"",
        price:0,
        available:true,
        verified:false,
        jobs:0,
        rating:0,
        reviews:0,
        trial_end,
      };
      if(phone) insertData.phone=phone.trim();
      if(phone) insertData.whatsapp=phone.trim();
      const {data,error}=await db.from("users").insert(insertData).select().single();
      setLoading(false);
      if(error){console.error("Register error:",error);setErr("Error: "+error.message);return;}
      if(!data){setErr("Error creando cuenta. Inténtalo de nuevo.");return;}
      localStorage.setItem("oy_user",JSON.stringify(data));
      onLogin(data as UserRow);
    }catch(e:any){setLoading(false);setErr("Error de conexión. Inténtalo de nuevo.");}
  };

  const registerPro=async()=>{
    if(!name||!email||!phone||!pass){setErr("Rellena todos los campos obligatorios.");return;}
    if(pass.length<6){setErr("Mínimo 6 caracteres en la contraseña.");return;}
    if(!/\S+@\S+\.\S+/.test(email)){setErr("Introduce un email válido.");return;}
    setLoading(true);setErr("");
    try{
      const {data:ex}=await db.from("users").select("id").eq("email",email.toLowerCase()).maybeSingle();
      if(ex){setLoading(false);setErr("Ya existe una cuenta con ese email.");return;}
      const trial_end=new Date(Date.now()+30*86400000).toISOString().split("T")[0];
      const insertData:any={
        name:name.trim(),
        email:email.toLowerCase().trim(),
        password:pass,
        phone:phone.trim(),
        type:"profesional",
        plan,
        trade,
        zone,
        bio:"",
        price:30,
        available:true,
        verified:false,
        jobs:0,
        rating:0,
        reviews:0,
        trial_end,
        whatsapp:phone.trim(),
        free_quote:true,
      };
      // Only add optional fields if they exist in schema
      try{insertData.service_zones=[zone];}catch{}
      try{insertData.schedule="Lunes a Viernes";}catch{}
      try{insertData.response_time="24h";}catch{}
      try{insertData.experience_years=0;}catch{}
      try{insertData.specialties=[];}catch{}
      const {data,error}=await db.from("users").insert(insertData).select().single();
      setLoading(false);
      if(error){console.error("Register pro error:",error);setErr("Error: "+error.message);return;}
      if(!data){setErr("Error creando cuenta. Inténtalo de nuevo.");return;}
      localStorage.setItem("oy_user",JSON.stringify(data));
      onLogin(data as UserRow);
    }catch(e:any){setLoading(false);setErr("Error de conexión. Inténtalo de nuevo.");}
  };

  // Plan detail modal
  const PlanDetailModal=({pl,onClose}:{pl:Plan;onClose:()=>void})=>{
    const col=PLAN_COLORS[pl];
    return <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(4,4,12,0.9)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(170deg,#14141F,#0A0A14)",borderRadius:16,width:"100%",maxWidth:360,border:"2px solid "+col+"44",padding:24,boxShadow:"0 0 40px "+col+"22"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div>
            <p style={{fontWeight:900,fontSize:22,color:col}}>{pl.toUpperCase()}</p>
            <p style={{fontSize:18,fontWeight:800,color:C.text}}>{PLAN_PRICES[pl]===0?"GRATIS":PLAN_PRICES[pl]+"€/mes"}</p>
          </div>
          {pl==="elite"&&<div style={{background:"linear-gradient(135deg,"+C.orange+","+C.red+")",borderRadius:10,padding:"8px 12px",textAlign:"center"}}>
            <p style={{fontSize:9,color:"#fff",fontWeight:700,textTransform:"uppercase" as const}}>1er mes</p>
            <p style={{fontSize:18,fontWeight:900,color:"#fff"}}>GRATIS</p>
          </div>}
          {pl==="pro"&&<div style={{background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",borderRadius:10,padding:"8px 12px",textAlign:"center"}}>
            <p style={{fontSize:9,color:"#000",fontWeight:700,textTransform:"uppercase" as const}}>Más popular</p>
            <p style={{fontSize:12,fontWeight:900,color:"#000"}}>⭐ Recomendado</p>
          </div>}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
          {PLAN_FEATURES[pl].map(f=>(
            <div key={f} style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{color:col,fontSize:13,flexShrink:0}}>✓</span>
              <span style={{fontSize:13,color:C.text}}>{f}</span>
            </div>
          ))}
        </div>
        <Btn full onClick={()=>{setPlan(pl);onClose();}} color={col}>
          Elegir {pl.toUpperCase()} {pl==="elite"?"— 1er mes gratis →":"→"}
        </Btn>
      </div>
    </div>;
  };

  const Logo=()=>(
    <div style={{textAlign:"center",marginBottom:24}}>
      <div style={{width:52,height:52,borderRadius:16,background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 10px",boxShadow:"0 8px 28px "+C.accent+"44"}}>🔨</div>
      <h1 style={{fontWeight:900,fontSize:26,letterSpacing:"-0.03em",marginBottom:3}}><span style={{color:C.text}}>Oficio</span><span style={{color:C.accent}}>Ya</span></h1>
      <p style={{fontSize:12,color:C.muted}}>Profesionales verificados en tu zona · Sevilla</p>
    </div>
  );

  return (
    <div style={{minHeight:"100dvh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px",backgroundImage:"radial-gradient(ellipse at 20% 0%,#2a0a5a22,transparent 55%),radial-gradient(ellipse at 80% 100%,#0a2a4a22,transparent 55%)",overflowY:"auto"}}>
      {showPlanDetail&&<PlanDetailModal pl={showPlanDetail} onClose={()=>setShowPlanDetail(null)} />}
      <div style={{width:"100%",maxWidth:420}}>
        <Logo />

        {/* ─── LOGIN ─── */}
        {mode==="login"&&(
          <GCard>
            <p style={{fontWeight:800,fontSize:17,color:C.text,marginBottom:16,textAlign:"center"}}>Bienvenido de nuevo</p>
            {err&&<div style={{color:C.red,fontSize:13,marginBottom:12,padding:"10px 12px",background:C.red+"15",borderRadius:8,border:"1px solid "+C.red+"33"}}>{err}</div>}
            <Inp label="Email" value={email} onChange={setEmail} type="email" placeholder="tu@email.com" />
            <Inp label="Contraseña" value={pass} onChange={setPass} type="password" placeholder="••••••••" />
            <Btn full disabled={loading} onClick={login}>{loading?"Entrando...":"Entrar →"}</Btn>
            <div style={{textAlign:"center",marginTop:16}}>
              <p style={{fontSize:13,color:C.muted}}>¿No tienes cuenta? <button onClick={()=>{setMode("pick");resetForm();}} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:13,fontWeight:700}}>Regístrate gratis</button></p>
            </div>
          </GCard>
        )}

        {/* ─── PICK TYPE ─── */}
        {mode==="pick"&&(
          <div>
            <p style={{fontWeight:800,fontSize:18,color:C.text,marginBottom:6,textAlign:"center"}}>¿Cómo quieres usar OfficioYa?</p>
            <p style={{fontSize:13,color:C.muted,marginBottom:20,textAlign:"center"}}>Es gratis registrarse. Elige cómo quieres continuar:</p>
            <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
              {/* CLIENTE */}
              <div onClick={()=>setMode("register_cliente")} style={{padding:"20px 18px",borderRadius:14,border:"2px solid "+C.blue+"44",background:"linear-gradient(135deg,"+C.blue+"12,"+C.surface+")",cursor:"pointer",transition:"all 0.15s",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:-10,right:-10,width:60,height:60,borderRadius:"50%",background:C.blue+"12",pointerEvents:"none"}} />
                <div style={{display:"flex",gap:14,alignItems:"center"}}>
                  <div style={{width:48,height:48,borderRadius:12,background:C.blue+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>🏠</div>
                  <div>
                    <p style={{fontWeight:800,fontSize:15,color:C.text,marginBottom:3}}>Soy cliente</p>
                    <p style={{fontSize:12,color:C.muted}}>Busco profesionales para mis trabajos</p>
                    <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                      {["Gratis","Sin límites","Acceso inmediato"].map(b=><span key={b} style={{fontSize:10,color:C.green,background:C.green+"15",padding:"2px 7px",borderRadius:99,fontWeight:600}}>✓ {b}</span>)}
                    </div>
                  </div>
                  <span style={{marginLeft:"auto",fontSize:18,color:C.blue,flexShrink:0}}>→</span>
                </div>
              </div>
              {/* PROFESIONAL */}
              <div onClick={()=>setMode("register_pro")} style={{padding:"20px 18px",borderRadius:14,border:"2px solid "+C.accent+"44",background:"linear-gradient(135deg,"+C.accent+"12,"+C.surface+")",cursor:"pointer",transition:"all 0.15s",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:-10,right:-10,width:60,height:60,borderRadius:"50%",background:C.accent+"12",pointerEvents:"none"}} />
                <div style={{display:"flex",gap:14,alignItems:"center"}}>
                  <div style={{width:48,height:48,borderRadius:12,background:C.accent+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>🔨</div>
                  <div>
                    <p style={{fontWeight:800,fontSize:15,color:C.text,marginBottom:3}}>Soy profesional</p>
                    <p style={{fontSize:12,color:C.muted}}>Ofrezco mis servicios y capto clientes</p>
                    <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                      {["30 días gratis","Perfil público","Panel de gestión"].map(b=><span key={b} style={{fontSize:10,color:C.accent,background:C.accent+"15",padding:"2px 7px",borderRadius:99,fontWeight:600}}>✓ {b}</span>)}
                    </div>
                  </div>
                  <span style={{marginLeft:"auto",fontSize:18,color:C.accent,flexShrink:0}}>→</span>
                </div>
              </div>
            </div>
            <p style={{textAlign:"center",fontSize:13,color:C.muted}}>¿Ya tienes cuenta? <button onClick={()=>setMode("login")} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:13,fontWeight:700}}>Inicia sesión</button></p>
          </div>
        )}

        {/* ─── REGISTER CLIENTE ─── */}
        {mode==="register_cliente"&&(
          <GCard>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <button onClick={()=>setMode("pick")} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18,padding:0}}>←</button>
              <p style={{fontWeight:800,fontSize:16,color:C.text}}>Crear cuenta de cliente</p>
              <span style={{marginLeft:"auto",fontSize:10,color:C.green,background:C.green+"15",padding:"3px 8px",borderRadius:99,fontWeight:700}}>100% Gratis</span>
            </div>
            {err&&<div style={{color:C.red,fontSize:13,marginBottom:12,padding:"10px 12px",background:C.red+"15",borderRadius:8,border:"1px solid "+C.red+"33"}}>{err}</div>}
            <Inp label="Nombre completo *" value={name} onChange={setName} placeholder="Tu nombre" required />
            <Inp label="Email *" value={email} onChange={setEmail} type="email" placeholder="tu@email.com" required />
            <Inp label="Teléfono (opcional)" value={phone} onChange={setPhone} placeholder="+34 600 000 000" />
            <Inp label="Contraseña *" value={pass} onChange={setPass} type="password" placeholder="Mínimo 6 caracteres" required />
            <div style={{background:C.green+"10",border:"1px solid "+C.green+"22",borderRadius:8,padding:"10px 12px",marginBottom:14}}>
              <p style={{fontSize:12,color:C.green,fontWeight:600}}>✓ El registro es completamente gratuito · Sin tarjeta · Sin compromisos</p>
            </div>
            <Btn full disabled={loading} onClick={registerCliente}>{loading?"Creando tu cuenta...":"Crear cuenta gratis →"}</Btn>
          </GCard>
        )}

        {/* ─── REGISTER PROFESIONAL ─── */}
        {mode==="register_pro"&&(
          <GCard style={{padding:20}}>
            {/* Steps */}
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:20}}>
              <button onClick={()=>{if(proStep===1)setMode("pick");else setProStep(p=>p-1);}} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18,padding:0,flexShrink:0}}>←</button>
              <div style={{flex:1,display:"flex",gap:4}}>
                {[1,2,3].map(s=>(
                  <div key={s} style={{flex:1,height:4,borderRadius:99,background:s<=proStep?"linear-gradient(90deg,"+C.accent+","+C.orange+")":C.border,transition:"background 0.3s"}} />
                ))}
              </div>
              <span style={{fontSize:10,color:C.muted,flexShrink:0,fontWeight:600}}>Paso {proStep}/3</span>
            </div>

            {err&&<div style={{color:C.red,fontSize:13,marginBottom:12,padding:"10px 12px",background:C.red+"15",borderRadius:8,border:"1px solid "+C.red+"33"}}>{err}</div>}

            {/* PASO 1 — Datos personales */}
            {proStep===1&&(<>
              <p style={{fontWeight:800,fontSize:16,color:C.text,marginBottom:4}}>Tus datos</p>
              <p style={{fontSize:12,color:C.muted,marginBottom:16}}>Solo te llevará 1 minuto</p>
              <Inp label="Nombre completo *" value={name} onChange={setName} placeholder="Ej: Juan García" required />
              <Inp label="Email *" value={email} onChange={setEmail} type="email" placeholder="tu@email.com" required />
              <Inp label="Teléfono / WhatsApp *" value={phone} onChange={setPhone} placeholder="+34 600 000 000" required />
              <Inp label="Contraseña *" value={pass} onChange={setPass} type="password" placeholder="Mínimo 6 caracteres" required />
              <Btn full onClick={()=>{
                if(!name||!email||!phone||!pass){setErr("Rellena todos los campos.");return;}
                if(pass.length<6){setErr("Mínimo 6 caracteres.");return;}
                setErr("");setProStep(2);
              }}>Continuar →</Btn>
            </>)}

            {/* PASO 2 — Oficio y zona */}
            {proStep===2&&(<>
              <p style={{fontWeight:800,fontSize:16,color:C.text,marginBottom:4}}>Tu oficio y zona</p>
              <p style={{fontSize:12,color:C.muted,marginBottom:16}}>Así te encontrarán tus clientes</p>
              <div style={{marginBottom:14}}>
                <p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Tu oficio *</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,maxHeight:180,overflowY:"auto",paddingRight:4}}>
                  {OFICIOS.map(o=>(
                    <button key={o} onClick={()=>setTrade(o)} style={{padding:"6px 12px",borderRadius:99,border:"1px solid "+(trade===o?C.accent:C.border),background:trade===o?C.accent+"22":"transparent",color:trade===o?C.accent:C.muted,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:trade===o?700:400,transition:"all 0.15s",flexShrink:0}}>
                      {OFICIO_ICONS[o]} {o}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{marginBottom:14}}>
                <p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Ciudad principal *</p>
                <select value={zone} onChange={e=>setZone(e.target.value)} style={{width:"100%",background:C.surface,border:"1px solid "+C.border,borderRadius:8,padding:"11px 14px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none",cursor:"pointer"}}>
                  {ZONAS.map(z=><option key={z} style={{background:C.card}}>{z}</option>)}
                </select>
              </div>
              <Btn full onClick={()=>{setErr("");setProStep(3);}}>Elegir plan →</Btn>
            </>)}

            {/* PASO 3 — Plan */}
            {proStep===3&&(<>
              <p style={{fontWeight:800,fontSize:16,color:C.text,marginBottom:2}}>Elige tu plan</p>
              <p style={{fontSize:12,color:C.muted,marginBottom:16}}>Empieza gratis · Sin tarjeta · Cancela cuando quieras</p>

              {/* Elite highlight banner */}
              <div style={{background:"linear-gradient(135deg,"+C.orange+"22,"+C.red+"15)",borderRadius:12,border:"2px solid "+C.orange+"44",padding:"12px 14px",marginBottom:14,position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:-8,right:-8,width:40,height:40,borderRadius:"50%",background:C.orange+"22",pointerEvents:"none"}} />
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:22}}>⭐</span>
                  <div style={{flex:1}}>
                    <p style={{fontWeight:800,color:C.orange,fontSize:13}}>Plan ÉLITE — 1er mes GRATIS</p>
                    <p style={{fontSize:11,color:C.mutedL}}>El más completo · Cancela antes del día 30 si no te convence</p>
                  </div>
                  <button onClick={()=>setShowPlanDetail("elite")} style={{background:"none",border:"1px solid "+C.orange+"44",borderRadius:6,color:C.orange,cursor:"pointer",fontSize:10,padding:"4px 8px",fontFamily:"'DM Sans',sans-serif",fontWeight:700,flexShrink:0}}>Ver →</button>
                </div>
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                {(["gratis","basico","pro","elite"] as Plan[]).map(pl=>{
                  const col=PLAN_COLORS[pl];
                  const isSelected=plan===pl;
                  return (
                    <div key={pl} onClick={()=>setPlan(pl)} style={{padding:"12px 14px",borderRadius:12,border:"2px solid "+(isSelected?col:C.border),background:isSelected?col+"15":C.surface,cursor:"pointer",transition:"all 0.15s",position:"relative"}}>
                      {pl==="elite"&&<span style={{position:"absolute",top:-9,left:12,background:"linear-gradient(135deg,"+C.orange+","+C.red+")",color:"#fff",borderRadius:99,padding:"1px 9px",fontSize:8,fontWeight:900}}>1 MES GRATIS</span>}
                      {pl==="pro"&&<span style={{position:"absolute",top:-9,right:12,background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",color:"#000",borderRadius:99,padding:"1px 9px",fontSize:8,fontWeight:900}}>MÁS POPULAR</span>}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                        <div style={{display:"flex",gap:7,alignItems:"center"}}>
                          {isSelected&&<span style={{width:8,height:8,borderRadius:"50%",background:col,display:"inline-block"}} />}
                          <span style={{fontWeight:800,fontSize:14,color:col}}>{pl.toUpperCase()}</span>
                        </div>
                        <div style={{textAlign:"right"}}>
                          {pl==="elite"&&<p style={{fontSize:9,color:C.mutedL,textDecoration:"line-through"}}>{PLAN_PRICES[pl]}€</p>}
                          <span style={{fontWeight:800,fontSize:15,color:pl==="elite"?C.orange:C.text}}>
                            {PLAN_PRICES[pl]===0?"GRATIS":pl==="elite"?"0€ 1er mes":PLAN_PRICES[pl]+"€/mes"}
                          </span>
                        </div>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:5}}>
                        {PLAN_FEATURES[pl].slice(0,3).map(f=><span key={f} style={{fontSize:10,color:isSelected?col:C.mutedL}}>✓ {f}</span>)}
                        {PLAN_FEATURES[pl].length>3&&<span style={{fontSize:10,color:col}}>+{PLAN_FEATURES[pl].length-3} más</span>}
                      </div>
                      <button onClick={e=>{e.stopPropagation();setShowPlanDetail(pl);}} style={{background:"none",border:"none",color:isSelected?col:C.muted,cursor:"pointer",fontSize:10,padding:0,fontFamily:"'DM Sans',sans-serif",fontWeight:600,textDecoration:"underline"}}>
                        Ver todo lo incluido →
                      </button>
                    </div>
                  );
                })}
              </div>

              {plan==="elite"&&(
                <div style={{background:C.orange+"12",border:"1px solid "+C.orange+"33",borderRadius:8,padding:"10px 12px",marginBottom:14}}>
                  <p style={{fontSize:12,color:C.orange,fontWeight:700}}>⭐ Has elegido ÉLITE — tu primer mes es completamente gratis</p>
                  <p style={{fontSize:11,color:C.mutedL,marginTop:3}}>Cancela antes del día 30 y no se te cobrará nada</p>
                </div>
              )}
              {plan==="pro"&&(
                <div style={{background:C.accent+"12",border:"1px solid "+C.accent+"33",borderRadius:8,padding:"10px 12px",marginBottom:14}}>
                  <p style={{fontSize:12,color:C.accent,fontWeight:700}}>✓ Has elegido PRO — contactos ilimitados y primero en búsquedas</p>
                </div>
              )}
              {plan==="gratis"&&(
                <div style={{background:C.surface,border:"1px solid "+C.border,borderRadius:8,padding:"10px 12px",marginBottom:14}}>
                  <p style={{fontSize:12,color:C.muted}}>Plan gratis · 5 contactos/mes · Puedes mejorar en cualquier momento</p>
                </div>
              )}

              <Btn full disabled={loading} onClick={registerPro}>{loading?"Creando tu perfil...":"Crear perfil profesional →"}</Btn>
            </>)}
          </GCard>
        )}

        <p style={{textAlign:"center",fontSize:11,color:C.muted,marginTop:14}}>Al continuar aceptas los <span style={{color:C.accent,cursor:"pointer"}}>Términos de Uso</span> y la <span style={{color:C.accent,cursor:"pointer"}}>Política de Privacidad</span></p>
      </div>
    </div>
  );
}

// ─── WORKER CARD ───
function WorkerCard({w,onClick}:{w:UserRow;onClick:()=>void}){
  const col=wColor(w.id);
  const badges=[];
  if(w.free_quote)badges.push({t:"Presupuesto gratis",c:C.green});
  if(w.response_time&&w.response_time.includes("1h"))badges.push({t:"Responde en 1h",c:C.cyan});
  if(w.schedule&&w.schedule.includes("24h"))badges.push({t:"Urgencias 24h",c:C.red});
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
function WorkerSheet({worker,onClose,onChat,onWhatsApp,onVisitRequest,currentUser}:{worker:UserRow;onClose:()=>void;onChat:(w:UserRow)=>void;onWhatsApp:(w:UserRow)=>void;onVisitRequest:(w:UserRow)=>void;currentUser:UserRow|null}){
  const [tab,setTab]=useState<"info"|"fotos"|"reviews"|"certs">("info");
  const [reviews,setReviews]=useState<any[]>([]);
  const [certs,setCerts]=useState<CertRow[]>([]);
  const [photos,setPhotos]=useState<PhotoRow[]>([]);
  const [newRev,setNewRev]=useState(""); const [selStars,setSelStars]=useState(5); const [saving,setSaving]=useState(false);
  const col=wColor(worker.id);

  useEffect(()=>{
    db.from("reviews").select("*").eq("worker_id",worker.id).eq("approved",true).order("created_at",{ascending:false}).then(({data}:any)=>setReviews(data||[]));
    db.from("certificates").select("*").eq("worker_id",worker.id).then(({data}:any)=>setCerts(data||[]));
    db.from("photos").select("*").eq("worker_id",worker.id).order("created_at",{ascending:false}).then(({data}:any)=>setPhotos(data||[]));
    db.from("visits").insert({page:"worker_"+worker.id,user_id:currentUser?.id||null}).then(()=>{});
  },[worker.id,currentUser?.id]);

  const submitReview=async()=>{
    if(!newRev.trim())return;
    setSaving(true);
    const {data}=await db.from("reviews").insert({worker_id:worker.id,client_name:currentUser?.name||"Anónimo",client_id:currentUser?.id||null,stars:selStars,text:newRev,photo:"",photo_url:"",approved:true}).select().single();
    if(data)setReviews(p=>[data,...p]);
    setNewRev(""); setSaving(false);
  };

  const avgRating=reviews.length>0?reviews.reduce((s:number,r:any)=>s+r.stars,0)/reviews.length:worker.rating;

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

      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
        {worker.free_quote&&<span style={{padding:"4px 10px",borderRadius:99,fontSize:11,fontWeight:700,color:C.green,background:C.green+"18",border:"1px solid "+C.green+"33"}}>✓ Presupuesto gratis</span>}
        {worker.schedule&&<span style={{padding:"4px 10px",borderRadius:99,fontSize:11,fontWeight:600,color:C.mutedL,background:C.surface,border:"1px solid "+C.border}}>🕐 {worker.schedule}</span>}
        {worker.response_time&&<span style={{padding:"4px 10px",borderRadius:99,fontSize:11,fontWeight:600,color:C.cyan,background:C.cyan+"15",border:"1px solid "+C.cyan+"33"}}>⚡ Responde en {worker.response_time}</span>}
      </div>

      {currentUser&&currentUser.type==="cliente"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
          <Btn full onClick={()=>onChat(worker)} color={C.accent} small>💬 Mensaje</Btn>
          <button onClick={()=>onVisitRequest(worker)} style={{padding:"10px 8px",background:"linear-gradient(135deg,"+C.blue+"22,"+C.purple+"15)",border:"1px solid "+C.blue+"44",borderRadius:10,color:C.blue,fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:12,cursor:"pointer",transition:"all 0.15s"}}>📅 Visita</button>
          {worker.whatsapp?
            <button onClick={()=>onWhatsApp(worker)} style={{padding:"10px 8px",background:"#25D366"+"22",border:"1px solid #25D366"+"55",borderRadius:10,color:"#25D366",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:12,cursor:"pointer"}}>📱 WhatsApp</button>:
            <button style={{padding:"10px 8px",background:C.green+"15",border:"1px solid "+C.green+"44",borderRadius:10,color:C.green,fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:12,cursor:"pointer"}}>📞 Llamar</button>
          }
        </div>
      )}
      {!currentUser&&<div style={{padding:"12px",background:C.surface,borderRadius:10,border:"1px solid "+C.border,textAlign:"center",marginBottom:14}}><p style={{fontSize:13,color:C.muted}}>Regístrate gratis para contactar</p></div>}

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
        {[{l:"Trabajos",v:String(worker.jobs)},{l:"Precio/h",v:(worker.price||30)+"€"},{l:"Valoración",v:avgRating>0?avgRating.toFixed(1)+"★":"Nuevo"}].map(s=>(
          <div key={s.l} style={{background:"linear-gradient(135deg,"+col+"15,transparent)",borderRadius:10,padding:"10px 6px",textAlign:"center",border:"1px solid "+col+"25"}}>
            <p style={{fontWeight:800,fontSize:18,color:col}}>{s.v}</p>
            <p style={{fontSize:10,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.06em"}}>{s.l}</p>
          </div>
        ))}
      </div>

      {worker.service_zones&&worker.service_zones.length>0&&(
        <div style={{marginBottom:14,padding:"10px 12px",background:C.surface,borderRadius:8,border:"1px solid "+C.border}}>
          <p style={{fontSize:11,color:C.muted,marginBottom:6,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.06em"}}>Zonas de servicio</p>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {worker.service_zones.map(z=><span key={z} style={{fontSize:11,color:C.mutedL,background:C.card,padding:"3px 9px",borderRadius:99,border:"1px solid "+C.border}}>📍{z}</span>)}
          </div>
        </div>
      )}

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
            <p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Tu reseña</p>
            <Stars n={selStars} size={22} interactive onSet={setSelStars} />
            <div style={{marginTop:8}}><Inp label="" value={newRev} onChange={setNewRev} placeholder="Cuéntanos tu experiencia..." multiline /></div>
            <Btn full small disabled={saving} onClick={submitReview}>{saving?"Publicando...":"Publicar reseña"}</Btn>
          </GCard>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {reviews.map((r:any)=>(
            <GCard key={r.id} style={{padding:12}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:col+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:col}}>{r.client_name[0]}</div>
                <div style={{flex:1}}><p style={{fontSize:13,fontWeight:700,color:C.text}}>{r.client_name}</p><p style={{fontSize:10,color:C.muted}}>{timeAgo(r.created_at)}</p></div>
                <Stars n={r.stars} size={11} />
              </div>
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

// ─── CHAT (con Realtime) ───
function ChatPanel({toUser,currentUser,onClose}:{toUser:UserRow;currentUser:UserRow;onClose:()=>void}){
  const [msgs,setMsgs]=useState<MessageRow[]>([]);
  const [input,setInput]=useState(""); const [sending,setSending]=useState(false);
  const bottomRef=useRef<HTMLDivElement>(null);
  const col=wColor(toUser.id);

  const loadMsgs=useCallback(async()=>{
    const {data}=await db.from("messages").select("*")
      .or("and(from_id.eq."+currentUser.id+",to_id.eq."+toUser.id+"),and(from_id.eq."+toUser.id+",to_id.eq."+currentUser.id+")")
      .order("created_at",{ascending:true});
    if(data&&data.length>0){setMsgs(data);}
    else setMsgs([{id:"w0",from_id:toUser.id,to_id:currentUser.id,text:"¡Hola! Soy "+toUser.name+". ¿En qué puedo ayudarte?",read:true,created_at:new Date().toISOString()}]);
  },[currentUser.id,toUser.id,toUser.name]);

  useEffect(()=>{
    loadMsgs();
    // Supabase Realtime
    const channel=db.channel("chat-"+[currentUser.id,toUser.id].sort().join("-"))
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},(payload:any)=>{
        const m=payload.new as MessageRow;
        if((m.from_id===currentUser.id&&m.to_id===toUser.id)||(m.from_id===toUser.id&&m.to_id===currentUser.id)){
          setMsgs(prev=>{
            if(prev.find(x=>x.id===m.id))return prev;
            return [...prev,m];
          });
        }
      }).subscribe();
    return ()=>{db.removeChannel(channel);};
  },[loadMsgs,currentUser.id,toUser.id]);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs.length]);

  const send=async()=>{
    if(!input.trim()||sending)return;
    const txt=input; setInput(""); setSending(true);
    await db.from("messages").insert({from_id:currentUser.id,to_id:toUser.id,text:txt,read:false});
    setSending(false);
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
  const [mapZone,setMapZone]=useState("");
  const [showQuickMatch,setShowQuickMatch]=useState(false);
  const [workers,setWorkers]=useState<UserRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [selectedWorker,setSelectedWorker]=useState<UserRow|null>(null);
  const [chatWorker,setChatWorker]=useState<UserRow|null>(null);
  const [visitWorker,setVisitWorker]=useState<UserRow|null>(null);
  const [chatPartners,setChatPartners]=useState<UserRow[]>([]);
  const [toast,setToast]=useState<string|null>(null);
  const showToast=(m:string)=>{setToast(m);setTimeout(()=>setToast(null),3000);};

  const loadWorkers=useCallback(async()=>{
    setLoading(true);
    let q=db.from("users").select("*").eq("type","profesional");
    if(zona!=="Todas")q=q.or("zone.eq."+zona+",service_zones.cs.{"+zona+"}");
    if(oficio!=="Todos")q=q.eq("trade",oficio);
    if(soloDisp)q=q.eq("available",true);
    if(search)q=q.ilike("name","%"+search+"%");
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

  const handleWhatsApp=async(w:UserRow)=>{
    await logLead(w.id,user.id,"whatsapp");
    const num=(w.whatsapp||w.phone).replace(/\D/g,"");
    const msg=encodeURIComponent("Hola "+w.name+", te contacto desde OfficioYa. Me gustaría solicitar un presupuesto.");
    window.open("https://wa.me/"+num+"?text="+msg,"_blank");
  };

  const handleChat=async(w:UserRow)=>{
    const ok=await logLead(w.id,user.id,"message");
    if(!ok){showToast("⛔ Este profesional ha alcanzado su límite de contactos este mes");return;}
    setSelectedWorker(null); setChatWorker(w); showToast("Chat abierto con "+w.name);
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
          <button onClick={onLogout} style={{background:"none",border:"1px solid "+C.border,borderRadius:6,color:C.muted,cursor:"pointer",padding:"4px 10px",fontSize:11}}>Salir</button>
        </div>
      </header>

      <div style={{maxWidth:900,margin:"0 auto",padding:"0 16px"}}>
        {tab==="buscar"&&(<>
          <div style={{padding:"16px 0 12px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <div style={{display:"inline-flex",gap:5,background:C.green+"15",border:"1px solid "+C.green+"30",borderRadius:99,padding:"4px 10px"}}>
                <span style={{fontSize:8,color:C.green,animation:"pulse 2s infinite"}}>●</span>
                <span style={{fontSize:11,color:C.green,fontWeight:700,letterSpacing:"0.04em"}}>{workers.filter(w=>w.available).length} disponibles ahora</span>
              </div>
            </div>
            <h1 style={{fontWeight:900,fontSize:"clamp(22px,5vw,42px)",lineHeight:1.1,letterSpacing:"-0.02em",marginBottom:6}}>
              <span style={{color:C.text}}>El profesional que necesitas,</span><br/>
              <span style={{background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>en tu ciudad.</span>
            </h1>
            <p style={{fontSize:13,color:C.mutedL,marginBottom:0}}>Presupuesto gratis · Sin compromiso · Pago directo</p>
          </div>

          {/* BUSCADOR PRINCIPAL */}
          <div style={{marginBottom:14}}>
            {/* Barra de búsqueda grande */}
            <div style={{display:"flex",background:C.card,borderRadius:14,border:"1px solid "+C.border,overflow:"hidden",marginBottom:8,boxShadow:"0 4px 20px rgba(0,0,0,0.3)"}}>
              <span style={{padding:"0 14px",display:"flex",alignItems:"center",color:C.muted,fontSize:18}}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="¿Qué profesional necesitas?" style={{flex:1,padding:"15px 0",background:"transparent",border:"none",color:C.text,fontFamily:"inherit",fontSize:15,outline:"none"}} />
              {search&&<button onClick={()=>setSearch("")} style={{padding:"0 14px",background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>✕</button>}
            </div>
            {/* Filtros secundarios en una línea */}
            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
              <select value={zona} onChange={e=>setZona(e.target.value)} style={{flex:1,minWidth:100,padding:"8px 10px",background:C.surface,border:"1px solid "+C.border,borderRadius:8,color:zona==="Todas"?C.muted:C.text,fontFamily:"inherit",fontSize:12,cursor:"pointer",outline:"none"}}>
                <option style={{background:C.card}}>Todas</option>
                {ZONAS.map(z=><option key={z} style={{background:C.card}}>{z}</option>)}
              </select>
              <select value={oficio} onChange={e=>setOficio(e.target.value)} style={{flex:1,minWidth:100,padding:"8px 10px",background:C.surface,border:"1px solid "+C.border,borderRadius:8,color:oficio==="Todos"?C.muted:C.text,fontFamily:"inherit",fontSize:12,cursor:"pointer",outline:"none"}}>
                <option style={{background:C.card}}>Todos</option>
                {OFICIOS.map(o=><option key={o} style={{background:C.card}}>{o}</option>)}
              </select>
              <label style={{display:"flex",alignItems:"center",gap:5,cursor:"pointer",fontSize:12,color:C.mutedL,flexShrink:0}}>
                <input type="checkbox" checked={soloDisp} onChange={e=>setSoloDisp(e.target.checked)} style={{accentColor:C.accent,width:14,height:14}} />
                Disponibles
              </label>
              <button onClick={()=>setShowMap(!showMap)} style={{flexShrink:0,padding:"7px 10px",borderRadius:8,border:"1px solid "+(showMap?C.accent:C.border),background:showMap?C.accent+"15":"transparent",color:showMap?C.accent:C.muted,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",transition:"all 0.15s"}}>
                🗺️
              </button>
            </div>
            {showMap&&<div style={{marginTop:8}}><SevillaMap selectedZone={mapZone} onZoneSelect={z=>{setMapZone(z===mapZone?"":z);}} /></div>}
          </div>


          <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:14}}>
            {["Todos","⚡ Técnico","🌿 Servicios","🏺 Artesanía","👨‍🍳 Hostelería","🎪 Eventos"].map(cat=>(
              <button key={cat} onClick={()=>{setCatFilter(cat);setOficio("Todos");}} style={{flexShrink:0,padding:"7px 16px",borderRadius:99,border:"1px solid "+(catFilter===cat?C.accent:C.border),background:catFilter===cat?"linear-gradient(135deg,"+C.accent+"33,"+C.orange+"22)":"transparent",color:catFilter===cat?C.accent:C.muted,cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif",fontWeight:catFilter===cat?700:400,whiteSpace:"nowrap",transition:"all 0.15s",boxShadow:catFilter===cat?"0 2px 10px "+C.accent+"22":"none"}}>
                {cat}
              </button>
            ))}
          </div>

          <div style={{background:"linear-gradient(135deg,"+C.accent+"18,"+C.orange+"10)",borderRadius:14,border:"1px solid "+C.accent+"33",padding:"14px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:28}}>⚡</div>
            <div style={{flex:1}}>
              <p style={{fontWeight:700,color:C.text,fontSize:14,marginBottom:2}}>¿Necesitas un profesional ahora?</p>
              <p style={{fontSize:12,color:C.muted}}>Te conectamos con el disponible más cercano en segundos</p>
            </div>
            <button onClick={()=>setShowQuickMatch(true)} style={{padding:"10px 16px",background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",border:"none",borderRadius:10,color:"#000",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",whiteSpace:"nowrap",boxShadow:"0 4px 14px "+C.accent+"44"}}>
              Buscar →
            </button>
          </div>

          {loading?<Spin />:(<>
            <p style={{fontSize:12,color:C.muted,marginBottom:12}}><span style={{color:C.text,fontWeight:700}}>{workers.length}</span> profesionales{zona!=="Todas"?" en "+zona:""}{mapZone?" · "+mapZone:""} {mapZone&&<button onClick={()=>setMapZone("")} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:11,fontWeight:700}}>✕</button>}</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(265px,1fr))",gap:12}}>
              {workers.map(w=><WorkerCard key={w.id} w={w} onClick={()=>setSelectedWorker(w)} />)}
              {workers.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:48,color:C.muted}}>
                <p style={{fontSize:36,marginBottom:8}}>🔍</p>
                <p style={{fontWeight:700,fontSize:18,marginBottom:6}}>Sin resultados</p>
                <p style={{fontSize:13}}>Prueba con otra zona u oficio</p>
              </div>}
            </div>
          </>)}
        </>)}

        {tab==="ranking"&&<RankingSection workers={workers} onSelect={setSelectedWorker} />}

        {tab==="chats"&&(<>
          <div style={{padding:"22px 0 16px"}}><h2 style={{fontWeight:800,fontSize:22,color:C.text}}>Mis conversaciones</h2></div>
          {chatPartners.length===0?<div style={{textAlign:"center",padding:48,color:C.muted}}>
            <p style={{fontSize:36,marginBottom:8}}>💬</p>
            <p style={{fontWeight:700,fontSize:16,marginBottom:6}}>Sin conversaciones</p>
            <Btn onClick={()=>setTab("buscar")} small>Buscar profesionales →</Btn>
          </div>:
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {chatPartners.map(w=>{
              const col=wColor(w.id);
              return <GCard key={w.id} onClick={()=>setChatWorker(w)} glow={col}>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <Ava s={w.name.substring(0,2).toUpperCase()} size={46} color={col} online={w.available} />
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontWeight:700,color:C.text,fontSize:14}}>{w.name}</p>
                    <p style={{fontSize:12,color:col}}>{OFICIO_ICONS[w.trade||""]||"🔧"} {w.trade} · {w.zone}</p>
                  </div>
                  <Btn small onClick={(e:any)=>{e.stopPropagation();setChatWorker(w);}}>Abrir →</Btn>
                </div>
              </GCard>;
            })}
          </div>}
        </>)}

        {tab==="perfil"&&(<>
          <div style={{padding:"22px 0 16px"}}><h2 style={{fontWeight:800,fontSize:22,color:C.text}}>Mi perfil</h2></div>
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
          </GCard>
          <Btn full outline danger onClick={onLogout} color={C.red}>Cerrar sesión</Btn>
        </>)}
      </div>

      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(10,10,15,0.97)",backdropFilter:"blur(20px)",borderTop:"1px solid "+C.border,display:"flex",zIndex:200}}>
        {([["buscar","buscar"],["ranking","ranking"],["chats","chats"],["perfil","perfil"]] as const).map(([id])=>{
          const icons:Record<string,React.ReactNode>={
            buscar:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
            ranking:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
            chats:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
            perfil:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
          };
          const labels:Record<string,string>={buscar:"Buscar",ranking:"Ranking",chats:"Mensajes",perfil:"Perfil"};
          const isActive=tab===id;
          return (
            <button key={id} onClick={()=>setTab(id as any)} style={{flex:1,padding:"8px 4px 10px",background:"none",border:"none",color:isActive?C.accent:C.muted+"88",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,transition:"all 0.2s",position:"relative"}}>
              {isActive&&<div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:32,height:2,background:"linear-gradient(90deg,"+C.accent+","+C.orange+")",borderRadius:"0 0 2px 2px"}} />}
              <div style={{color:isActive?C.accent:C.muted+"88"}}>{icons[id]}</div>
              <span style={{fontSize:9,fontWeight:isActive?700:500,letterSpacing:"0.04em",textTransform:"uppercase"}}>{labels[id]}</span>
            </button>
          );
        })}
      </nav>

      {showQuickMatch&&<QuickMatchModal workers={workers} onClose={()=>setShowQuickMatch(false)} onSelect={w=>{setShowQuickMatch(false);setSelectedWorker(w);}} />}
      {selectedWorker&&<WorkerSheet worker={selectedWorker} onClose={()=>setSelectedWorker(null)} onChat={handleChat} onWhatsApp={handleWhatsApp} onVisitRequest={w=>{setSelectedWorker(null);setVisitWorker(w);}} currentUser={user} />}
      {chatWorker&&<ChatPanel toUser={chatWorker} currentUser={user} onClose={()=>setChatWorker(null)} />}
      {visitWorker&&<VisitRequestModal worker={visitWorker} currentUser={user} onClose={()=>setVisitWorker(null)} onSuccess={()=>{setVisitWorker(null);showToast("✓ Solicitud enviada a "+visitWorker.name);}} />}
      <Ping msg={toast} />
    </div>
  );
}

// ─── PRO DASHBOARD ───
function ProDashboard({user,onLogout,onUpdate}:{user:UserRow;onLogout:()=>void;onUpdate:(u:UserRow)=>void}){
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
  const photoLimit=PLAN_GATES.photos[user.plan as Plan];
  const canAddPhoto=photoLimit===999||photos.length<photoLimit;

  useEffect(()=>{
    db.from("certificates").select("*").eq("worker_id",user.id).then(({data}:any)=>setCerts(data||[]));
    db.from("photos").select("*").eq("worker_id",user.id).order("created_at",{ascending:false}).then(({data}:any)=>setPhotos(data||[]));
    db.from("jobs").select("*").eq("worker_id",user.id).order("created_at",{ascending:false}).then(({data}:any)=>setJobs(data||[]));
    db.from("visits").select("id",{count:"exact"} as any).eq("user_id",user.id).then(({count}:any)=>setStats(s=>({...s,visits:count||0})));
    db.from("messages").select("id",{count:"exact"} as any).eq("to_id",user.id).then(({count}:any)=>setStats(s=>({...s,contacts:count||0})));
    db.from("reviews").select("id",{count:"exact"} as any).eq("worker_id",user.id).then(({count}:any)=>setStats(s=>({...s,reviews:count||0})));
    // Realtime para nuevos jobs/mensajes
    const ch=db.channel("pro-"+user.id)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"jobs",filter:"worker_id=eq."+user.id},(p:any)=>{
        setJobs(prev=>[p.new,...prev]);
        showToast("🔔 Nueva solicitud de trabajo de "+p.new.client_name);
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"to_id=eq."+user.id},(p:any)=>{
        showToast("💬 Nuevo mensaje de un cliente");
      }).subscribe();
    return ()=>{db.removeChannel(ch);};
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
    const upd={bio,price:parseInt(price)||30,available,schedule,response_time:responseTime,free_quote:freeQuote,experience_years:parseInt(expYears)||0,specialties,service_zones:serviceZones,whatsapp};
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
    if(!certName.trim())return;
    const {data}=await db.from("certificates").insert({worker_id:user.id,name:certName,url:"",verified:false}).select().single();
    if(data){setCerts(p=>[...p,data]);setCertName("");showToast("✓ Título añadido");}
  };

  const photoInputRef=useRef<HTMLInputElement>(null);
  const [photoFile,setPhotoFile]=useState<File|null>(null);
  const [photoPreview,setPhotoPreview]=useState<string>("");
  const [uploadingPhoto,setUploadingPhoto]=useState(false);

  const addPhoto=async()=>{
    if(!canAddPhoto){showToast("⛔ Límite de fotos alcanzado para tu plan. Mejora a Pro para más fotos.");return;}
    if(!photoCaption.trim()&&!photoFile)return;
    setUploadingPhoto(true);
    let url="";
    if(photoFile){
      // Validate size (5MB max)
      if(photoFile.size>5*1024*1024){showToast("⛔ La imagen es demasiado grande (máx. 5MB)");setUploadingPhoto(false);return;}
      const uploaded=await uploadImage(photoFile,"workers/"+user.id);
      if(uploaded)url=uploaded;
    }
    const {data}=await db.from("photos").insert({worker_id:user.id,url,caption:photoCaption}).select().single();
    if(data){setPhotos(p=>[data,...p]);setPhotoCaption("");setPhotoFile(null);setPhotoPreview("");showToast("✓ Foto añadida");}
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

  const SPECIALTIES_BY_TRADE:Record<string,string[]>={
    "Electricista":["Domótica","Fotovoltaica","Cuadros eléctricos","Instalación industrial","LED y iluminación","Cargadores VE"],
    "Fontanero":["Calderas","Calefacción","Suelo radiante","Piscinas","Urgencias","Gas"],
    "Pintor":["Microcemento","Stucco veneciano","Pintura exterior","Decoración","Gotelé","Barnizado"],
    "Albañil":["Reformas integrales","Tabiques","Azulejos","Fachadas","Pladur","Terrazas"],
    "Carpintero":["Muebles a medida","Tarimas","Puertas","Cocinas","Armarios","Madera maciza"],
    "Cerrajero":["Apertura 24h","Cajas fuertes","Bombines","Puertas acorazadas","Control de acceso","Rejas"],
    "Jardinero":["Diseño jardines","Riego automático","Poda","Comunidades","Céspedes","Árboles"],
  };
  const availableSpecialties=SPECIALTIES_BY_TRADE[user.trade||""]||["Especialidad 1","Especialidad 2","Especialidad 3"];

  return (
    <div style={{minHeight:"100dvh",background:C.bg,backgroundImage:"radial-gradient(ellipse at 70% 0%,#2a0a3a18,transparent 50%)",paddingBottom:72}}>
      <header style={{background:"rgba(10,10,15,0.94)",backdropFilter:"blur(20px)",borderBottom:"1px solid "+C.border,position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:900,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🔨</div>
            <span style={{fontWeight:900,fontSize:19,letterSpacing:"-0.03em"}}><span style={{color:C.text}}>Oficio</span><span style={{color:C.accent}}>Ya</span></span>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <Badge plan={user.plan} />
            <button onClick={onLogout} style={{background:"none",border:"1px solid "+C.border,borderRadius:6,color:C.muted,cursor:"pointer",padding:"4px 10px",fontSize:11}}>Salir</button>
          </div>
        </div>
      </header>

      {daysLeft<=7&&<div style={{background:"linear-gradient(135deg,"+C.red+"18,"+C.orange+"11)",borderBottom:"1px solid "+C.red+"22",padding:"8px 16px",textAlign:"center"}}>
        <p style={{fontSize:12,color:daysLeft>0?C.orange:C.red,fontWeight:700}}>{daysLeft>0?"⚠ "+daysLeft+" días de prueba · Activa un plan para no perder tu perfil":"⛔ Trial expirado · Tu perfil no es visible"}</p>
      </div>}

      <div style={{maxWidth:900,margin:"0 auto",padding:"0 16px"}}>

        {tab==="inicio"&&(<>
          <div style={{padding:"22px 0 16px"}}>
            <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:18}}>
              <Ava s={user.name.substring(0,2).toUpperCase()} size={50} color={C.accent} online={available} />
              <div style={{flex:1}}>
                <p style={{fontWeight:800,fontSize:18,color:C.text}}>{user.name}</p>
                <p style={{fontSize:13,color:C.accent,fontWeight:600}}>{OFICIO_ICONS[user.trade||""]||"🔧"} {user.trade} · {user.zone}</p>
                <button onClick={toggleAvail} style={{marginTop:5,display:"inline-flex",alignItems:"center",gap:6,background:"none",border:"1px solid "+(available?C.green+"44":C.border),borderRadius:99,padding:"4px 10px",cursor:"pointer",color:available?C.green:C.muted,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>
                  <span style={{width:6,height:6,borderRadius:"50%",background:available?C.green:C.muted,display:"inline-block"}} />
                  {available?"Disponible · Cambiar":"Ocupado · Cambiar"}
                </button>
              </div>
            </div>
          </div>

          {/* Leads counter */}
          <LeadsCounter user={user} onUpgrade={()=>setTab("planes")} />

          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
            {[{l:"Visitas al perfil",v:stats.visits,c:C.blue,i:"👁"},{l:"Mensajes recibidos",v:stats.contacts,c:C.green,i:"💬"},{l:"Reseñas",v:stats.reviews,c:C.accent,i:"⭐"},{l:"Días de trial",v:daysLeft,c:daysLeft>7?C.mutedL:C.red,i:"⏱"}].map(s=>(
              <GCard key={s.l} style={{textAlign:"center",padding:"14px 10px"}}>
                <div style={{fontSize:18,marginBottom:4}}>{s.i}</div>
                <p style={{fontWeight:800,fontSize:24,color:s.c}}>{s.v}</p>
                <p style={{fontSize:11,color:C.muted}}>{s.l}</p>
              </GCard>
            ))}
          </div>

          {/* Profile completeness */}
          {(()=>{
            const checks=[!!user.bio,!!user.phone,(user.service_zones||[]).length>0,(user.specialties||[]).length>0,photos.length>0,certs.length>0];
            const done=checks.filter(Boolean).length;
            const pct=Math.round(done/checks.length*100);
            return pct<100?<GCard style={{marginBottom:14,border:"1px solid "+C.accent+"33"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <p style={{fontWeight:700,color:C.text,fontSize:13}}>Completa tu perfil para captar más clientes</p>
                <span style={{fontWeight:800,fontSize:16,color:C.accent}}>{pct}%</span>
              </div>
              <div style={{height:6,background:C.border,borderRadius:99,marginBottom:10,overflow:"hidden"}}>
                <div style={{width:pct+"%",height:"100%",background:"linear-gradient(90deg,"+C.accent+","+C.orange+")",borderRadius:99,transition:"width 0.5s"}} />
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {[{label:"Descripción profesional",done:!!user.bio},{label:"Teléfono/WhatsApp",done:!!user.phone},{label:"Zonas de servicio",done:(user.service_zones||[]).length>0},{label:"Especialidades",done:(user.specialties||[]).length>0},{label:"Fotos de trabajos",done:photos.length>0},{label:"Títulos/certificados",done:certs.length>0}].map(c=><div key={c.label} style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:12,color:c.done?C.green:C.muted}}>{c.done?"✓":"○"}</span>
                  <span style={{fontSize:12,color:c.done?C.mutedL:C.text}}>{c.label}</span>
                  {!c.done&&<button onClick={()=>setTab("perfil")} style={{marginLeft:"auto",background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:11,fontWeight:700,padding:"2px 6px"}}>Añadir →</button>}
                </div>)}
              </div>
            </GCard>:null;
          })()}

          {jobs.filter(j=>j.status==="pending").length>0&&(
            <GCard style={{marginBottom:14,border:"1px solid "+C.orange+"44"}}>
              <p style={{fontWeight:700,color:C.orange,fontSize:13,marginBottom:10}}>🔔 {jobs.filter(j=>j.status==="pending").length} solicitud(es) pendiente(s)</p>
              {jobs.filter(j=>j.status==="pending").slice(0,2).map(j=>(
                <div key={j.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid "+C.border}}>
                  <div style={{flex:1}}><p style={{fontSize:13,color:C.text,fontWeight:600}}>{j.title}</p><p style={{fontSize:11,color:C.muted}}>{j.client_name} · {timeAgo(j.created_at)}</p></div>
                  <button onClick={()=>setTab("trabajos")} style={{background:C.orange+"22",border:"1px solid "+C.orange+"44",borderRadius:6,color:C.orange,cursor:"pointer",padding:"4px 8px",fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:700}}>Ver →</button>
                </div>
              ))}
            </GCard>
          )}

          <Btn full onClick={()=>setTab("planes")} color={C.accent}>Mejorar mi plan →</Btn>
        </>)}

        {tab==="chats"&&(<>
          <div style={{padding:"22px 0 16px"}}><h2 style={{fontWeight:800,fontSize:22,color:C.text}}>Mensajes de clientes</h2></div>
          {!PLAN_GATES.chat[user.plan as Plan]?<GCard style={{textAlign:"center",padding:"40px 20px"}}>
            <p style={{fontSize:36,marginBottom:10}}>💬</p>
            <p style={{fontWeight:700,color:C.text,fontSize:16,marginBottom:8}}>Chat disponible en plan Básico+</p>
            <Btn onClick={()=>setTab("planes")} color={C.accent}>Ver planes →</Btn>
          </GCard>:
          chatPartners.length===0?<div style={{textAlign:"center",padding:48,color:C.muted}}>
            <p style={{fontSize:36,marginBottom:8}}>💬</p>
            <p style={{fontWeight:700,fontSize:16,marginBottom:6}}>Sin mensajes aún</p>
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
          <div style={{padding:"22px 0 16px"}}><h2 style={{fontWeight:800,fontSize:22,color:C.text}}>Mis trabajos</h2></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
            {[{l:"Pendientes",v:jobs.filter(j=>j.status==="pending").length,c:C.orange},{l:"En progreso",v:jobs.filter(j=>j.status==="in_progress").length,c:C.blue},{l:"Completados",v:jobs.filter(j=>j.status==="done").length,c:C.green},{l:"Total",v:jobs.length,c:C.accent}].map(s=>(
              <GCard key={s.l} style={{textAlign:"center",padding:"12px 8px"}}>
                <p style={{fontWeight:800,fontSize:22,color:s.c}}>{s.v}</p>
                <p style={{fontSize:11,color:C.muted}}>{s.l}</p>
              </GCard>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {jobs.length===0&&<p style={{textAlign:"center",color:C.muted,fontSize:13,padding:32}}>No hay trabajos registrados aún</p>}
            {jobs.map(j=>(
              <GCard key={j.id} style={{padding:14}}>
                <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}>
                  <div style={{flex:1}}>
                    <p style={{fontWeight:700,color:C.text,fontSize:14,marginBottom:3}}>{j.title}</p>
                    <p style={{fontSize:12,color:C.muted}}>👤 {j.client_name} · {timeAgo(j.created_at)}</p>
                    {j.description&&<p style={{fontSize:12,color:C.mutedL,marginTop:4}}>{j.description}</p>}
                  </div>
                  <StatusDot status={j.status} />
                </div>
                {j.status!=="done"&&j.status!=="cancelled"&&(
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {j.status==="pending"&&<button onClick={()=>updateJobStatus(j.id,"in_progress")} style={{padding:"6px 12px",background:C.blue+"22",border:"1px solid "+C.blue+"44",borderRadius:8,color:C.blue,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Aceptar trabajo</button>}
                    {j.status==="in_progress"&&<button onClick={()=>updateJobStatus(j.id,"done")} style={{padding:"6px 12px",background:C.green+"22",border:"1px solid "+C.green+"44",borderRadius:8,color:C.green,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Marcar completado</button>}
                    <button onClick={()=>updateJobStatus(j.id,"cancelled")} style={{padding:"6px 12px",background:C.red+"15",border:"1px solid "+C.red+"33",borderRadius:8,color:C.red,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Cancelar</button>
                  </div>
                )}
              </GCard>
            ))}
          </div>
        </>)}

        {tab==="perfil"&&(<>
          <div style={{padding:"22px 0 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <h2 style={{fontWeight:800,fontSize:22,color:C.text}}>Mi perfil público</h2>
            <Btn small onClick={saveProfile} disabled={saving}>{saving?"Guardando...":"Guardar"}</Btn>
          </div>

          <GCard style={{marginBottom:14}}>
            <p style={{fontWeight:700,color:C.text,fontSize:13,marginBottom:12}}>Información básica</p>
            <Inp label="Descripción profesional" value={bio} onChange={setBio} placeholder="Describe tu experiencia, especialidades y servicios..." multiline />
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Inp label="Precio por hora (€)" value={price} onChange={setPrice} type="number" />
              <Inp label="Años de experiencia" value={expYears} onChange={setExpYears} type="number" />
            </div>
            <Inp label="WhatsApp / Teléfono" value={whatsapp} onChange={setWhatsapp} placeholder="+34 600 000 000" />
            <Toggle value={freeQuote} onChange={setFreeQuote} label="Ofrezco presupuesto gratuito" />
            <Toggle value={available} onChange={v=>{setAvailable(v);db.from("users").update({available:v}).eq("id",user.id);onUpdate({...user,available:v});}} label="Disponible para nuevos trabajos" />
          </GCard>

          <GCard style={{marginBottom:14}}>
            <p style={{fontWeight:700,color:C.text,fontSize:13,marginBottom:12}}>Disponibilidad y respuesta</p>
            <div style={{marginBottom:14}}>
              <p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Horario de trabajo</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {SCHEDULES.map(s=><button key={s} onClick={()=>setSchedule(s)} style={{padding:"6px 12px",borderRadius:99,border:"1px solid "+(schedule===s?C.accent:C.border),background:schedule===s?C.accent+"18":"transparent",color:schedule===s?C.accent:C.muted,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:schedule===s?700:400,transition:"all 0.15s"}}>{s}</button>)}
              </div>
            </div>
            <div>
              <p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Tiempo de respuesta</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {RESPONSE_TIMES.map(r=><button key={r} onClick={()=>setResponseTime(r)} style={{padding:"6px 12px",borderRadius:99,border:"1px solid "+(responseTime===r?C.cyan:C.border),background:responseTime===r?C.cyan+"18":"transparent",color:responseTime===r?C.cyan:C.muted,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:responseTime===r?700:400,transition:"all 0.15s"}}>{r}</button>)}
              </div>
            </div>
          </GCard>

          <GCard style={{marginBottom:14}}>
            <MultiSelect label="Zonas donde prestas servicio" options={ZONAS} selected={serviceZones} onChange={setServiceZones} />
          </GCard>

          <GCard style={{marginBottom:14}}>
            <MultiSelect label="Tus especialidades" options={availableSpecialties} selected={specialties} onChange={setSpecialties} />
          </GCard>

          <GCard style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <p style={{fontWeight:700,color:C.text,fontSize:13}}>📸 Fotos de trabajos realizados</p>
              <span style={{fontSize:10,color:photoLimit<999?C.muted:C.green,background:C.surface,padding:"2px 7px",borderRadius:4,border:"1px solid "+C.border}}>
                {photoLimit<999?photos.length+"/"+photoLimit+" fotos":"Sin límite"}
              </span>
            </div>
            {!canAddPhoto&&<div style={{padding:"10px 12px",background:C.orange+"12",borderRadius:8,border:"1px solid "+C.orange+"22",marginBottom:10}}>
              <p style={{fontSize:12,color:C.orange}}>⚠️ Límite de fotos alcanzado. <button onClick={()=>setTab("planes")} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:12,fontWeight:700,padding:0}}>Mejora tu plan →</button></p>
            </div>}
            <input ref={photoInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f){setPhotoFile(f);setPhotoPreview(URL.createObjectURL(f));}}} />
            {photoPreview&&<div style={{position:"relative",marginBottom:10}}>
              <img src={photoPreview} alt="preview" style={{width:"100%",maxHeight:150,objectFit:"cover",borderRadius:10,border:"1px solid "+C.border}} />
              <button onClick={()=>{setPhotoFile(null);setPhotoPreview("");}} style={{position:"absolute",top:6,right:6,background:C.red,border:"none",borderRadius:"50%",width:24,height:24,color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700}}>✕</button>
            </div>}
            {canAddPhoto&&<div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
              <button onClick={()=>photoInputRef.current?.click()} style={{padding:"9px 14px",background:C.surface,border:"1px dashed "+C.border,borderRadius:8,color:C.muted,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap"}}>📸 Elegir foto</button>
              <input value={photoCaption} onChange={e=>setPhotoCaption(e.target.value)} placeholder="Descripción del trabajo..." style={{flex:1,minWidth:120,background:C.surface,border:"1px solid "+C.border,borderRadius:8,padding:"9px 12px",color:C.text,fontFamily:"inherit",fontSize:13,outline:"none"}} />
              <Btn small disabled={uploadingPhoto} onClick={addPhoto}>{uploadingPhoto?"Subiendo...":"Añadir"}</Btn>
            </div>}
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
              {photos.map(p=>(
                <div key={p.id} style={{background:C.surface,borderRadius:10,border:"1px solid "+C.border,padding:12,position:"relative"}}>
                  {p.url?<img src={p.url} alt={p.caption} style={{width:"100%",aspectRatio:"4/3",objectFit:"cover",borderRadius:8,marginBottom:8}} onError={(e:any)=>{e.target.style.display="none";}} />:<div style={{aspectRatio:"4/3",background:C.card,borderRadius:8,marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>📸</div>}
                  <p style={{fontSize:11,color:C.mutedL,marginBottom:6}}>{p.caption}</p>
                  <button onClick={()=>deletePhoto(p.id)} style={{fontSize:10,color:C.red,background:"none",border:"none",cursor:"pointer",padding:0}}>Eliminar</button>
                </div>
              ))}
              {photos.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:20,color:C.muted,fontSize:12}}>Sin fotos aún · Añade fotos de tus mejores trabajos</div>}
            </div>
          </GCard>

          <GCard style={{marginBottom:14}}>
            <p style={{fontWeight:700,color:C.text,fontSize:13,marginBottom:12}}>📜 Títulos y certificados</p>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <input value={certName} onChange={e=>setCertName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCert()} placeholder="Ej: Certificado instalador eléctrico..." style={{flex:1,background:C.surface,border:"1px solid "+C.border,borderRadius:8,padding:"9px 12px",color:C.text,fontFamily:"inherit",fontSize:13,outline:"none"}} />
              <Btn small onClick={addCert}>Añadir</Btn>
            </div>
            {certs.map(c=>(
              <div key={c.id} style={{display:"flex",gap:10,alignItems:"center",padding:"10px 12px",background:C.surface,borderRadius:8,border:"1px solid "+C.border,marginBottom:6}}>
                <span style={{fontSize:18}}>📜</span>
                <span style={{flex:1,fontSize:13,color:C.text}}>{c.name}</span>
                {c.verified&&<span style={{fontSize:10,color:C.green,fontWeight:700}}>✓ Verificado</span>}
              </div>
            ))}
          </GCard>

          <Btn full outline danger onClick={onLogout} color={C.red}>Cerrar sesión</Btn>
        </>)}

        {tab==="planes"&&(<>
          <div style={{padding:"22px 0 16px",textAlign:"center"}}>
            <h2 style={{fontWeight:900,fontSize:26,letterSpacing:"-0.03em",color:C.text,marginBottom:4}}>Elige tu <span style={{color:C.accent}}>plan</span></h2>
            <p style={{fontSize:13,color:C.muted}}>30 días gratis · Sin tarjeta · Cancela cuando quieras</p>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {(["gratis","basico","pro","elite"] as Plan[]).map(pl=>{
              const col=PLAN_COLORS[pl]; const isCurrent=user.plan===pl;
              return <div key={pl} style={{background:pl==="pro"?"linear-gradient(160deg,#1a1a2e,#0d0d1a)":C.card,borderRadius:14,border:(isCurrent?"2px":"1px")+" solid "+(isCurrent?col+"AA":pl==="pro"?col+"44":C.border),padding:"18px",position:"relative",boxShadow:pl==="pro"?"0 0 28px "+col+"15":"none"}}>
                {pl==="pro"&&!isCurrent&&<div style={{position:"absolute",top:-11,right:14,background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",color:"#000",borderRadius:99,padding:"2px 10px",fontSize:9,fontWeight:900}}>MÁS POPULAR</div>}
                {isCurrent&&<div style={{position:"absolute",top:-11,left:14,background:col,color:"#000",borderRadius:99,padding:"2px 10px",fontSize:9,fontWeight:900}}>✓ PLAN ACTUAL</div>}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontWeight:800,fontSize:17,color:col}}>{pl.toUpperCase()}</span>
                  <span style={{fontWeight:800,fontSize:21,color:C.text}}>{PLAN_PRICES[pl]===0?"GRATIS":PLAN_PRICES[pl]+"€/mes"}</span>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:isCurrent?0:14}}>
                  {PLAN_FEATURES[pl].map(f=><span key={f} style={{fontSize:11,color:C.mutedL,background:C.surface,padding:"3px 8px",borderRadius:99,border:"1px solid "+C.border}}>✓ {f}</span>)}
                </div>
                {!isCurrent&&<button onClick={()=>showToast("🚀 Redirigiendo a Stripe...")} style={{marginTop:14,width:"100%",padding:"11px",background:pl==="pro"?"linear-gradient(135deg,"+col+","+C.orange+")":"transparent",border:"1px solid "+col+"66",borderRadius:8,color:pl==="pro"?"#000":col,fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer"}}>
                  {pl==="gratis"?"Volver a gratuito →":"Activar "+pl.toUpperCase()+" por "+PLAN_PRICES[pl]+"€/mes →"}
                </button>}
              </div>;
            })}
          </div>
        </>)}
      </div>

      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(10,10,15,0.97)",backdropFilter:"blur(20px)",borderTop:"1px solid "+C.border,display:"flex",zIndex:200}}>
        {([["inicio","🏠","Inicio"],["chats","💬","Mensajes"],["trabajos","🔨","Trabajos"],["perfil","👤","Perfil"],["planes","💎","Planes"]] as const).map(([id,icon,label])=>(
          <button key={id} onClick={()=>setTab(id as any)} style={{flex:1,padding:"8px 2px 10px",background:"none",border:"none",color:tab===id?C.accent:C.muted,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,transition:"color 0.15s",position:"relative"}}>
            <span style={{fontSize:18}}>{icon}</span>
            <span style={{fontSize:9,fontWeight:600,letterSpacing:"0.02em"}}>{label}</span>
            {id==="trabajos"&&jobs.filter(j=>j.status==="pending").length>0&&tab!=="trabajos"&&<span style={{position:"absolute",top:5,right:"calc(50% - 14px)",background:C.orange,color:"#000",borderRadius:99,padding:"0 4px",fontSize:8,fontWeight:900}}>{jobs.filter(j=>j.status==="pending").length}</span>}
          </button>
        ))}
      </nav>

      {chatUser&&<ChatPanel toUser={chatUser} currentUser={user} onClose={()=>setChatUser(null)} />}
      <Ping msg={toast} />
    </div>
  );
}

// ─── ADMIN ───
function Admin({onLogout}:{onLogout:()=>void}){
  type AdminTab="overview"|"funnel"|"usuarios"|"registros"|"trabajos"|"mensajes"|"reseñas";
  const [tab,setTab]=useState<AdminTab>("overview");
  const [users,setUsers]=useState<UserRow[]>([]);
  const [jobs,setJobs]=useState<JobRow[]>([]);
  const [msgs,setMsgs]=useState<MessageRow[]>([]);
  const [reviews,setReviews]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [period,setPeriod]=useState<"7d"|"30d"|"90d"|"all">("30d");
  const [filterType,setFilterType]=useState<"all"|"cliente"|"profesional">("all");
  const [filterStatus,setFilterStatus]=useState<"all"|"paying"|"trial"|"expired">("all");
  const [filterSearch,setFilterSearch]=useState("");
  const [selectedUser,setSelectedUser]=useState<UserRow|null>(null);
  const [supportMsg,setSupportMsg]=useState("");
  const [sendingMsg,setSendingMsg]=useState(false);
  const [toastMsg,setToastMsg]=useState<string|null>(null);

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

  const now=new Date();
  const periodDays=period==="7d"?7:period==="30d"?30:period==="90d"?90:36500;
  const periodCutoff=new Date(Date.now()-periodDays*86400000);
  const inPeriod=(iso:string)=>period==="all"||new Date(iso)>=periodCutoff;

  const isPaying=(u:UserRow)=>u.type==="profesional"&&u.plan!=="gratis";
  const isTrial=(u:UserRow)=>u.type==="profesional"&&u.plan==="gratis"&&new Date(u.trial_end)>now;
  const isExpired=(u:UserRow)=>u.type==="profesional"&&u.plan==="gratis"&&new Date(u.trial_end)<=now;
  const trialDaysU=(u:UserRow)=>Math.max(0,Math.ceil((new Date(u.trial_end).getTime()-now.getTime())/86400000));

  const pros=users.filter(u=>u.type==="profesional");
  const clients=users.filter(u=>u.type==="cliente");
  const payingUsers=users.filter(isPaying);
  const trialUsers=users.filter(isTrial);
  const expiredUsers=users.filter(isExpired);
  const mrr=payingUsers.reduce((s,u)=>s+PLAN_PRICES[u.plan as Plan],0);

  const applyFilters=(list:UserRow[])=>list.filter(u=>{
    if(filterType!=="all"&&u.type!==filterType)return false;
    if(filterStatus==="paying"&&!isPaying(u))return false;
    if(filterStatus==="trial"&&!isTrial(u))return false;
    if(filterStatus==="expired"&&!isExpired(u))return false;
    if(filterSearch&&!u.name.toLowerCase().includes(filterSearch.toLowerCase())&&!u.email.toLowerCase().includes(filterSearch.toLowerCase()))return false;
    return true;
  });

  // Chart
  const chartData=(()=>{
    const days=period==="all"?30:periodDays;
    const result:Record<string,{users:number;pros:number;clients:number}>={};
    for(let i=days-1;i>=0;i--){
      const d=new Date(Date.now()-i*86400000);
      const k=d.toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit"});
      result[k]={users:0,pros:0,clients:0};
    }
    users.forEach(u=>{
      const k=new Date(u.joined_at).toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit"});
      if(k in result){result[k].users++;if(u.type==="profesional")result[k].pros++;else result[k].clients++;}
    });
    return Object.entries(result).map(([date,v])=>({date,...v}));
  })();
  const maxBar=Math.max(...chartData.map(d=>d.users),1);

  const sendSupport=async()=>{
    if(!selectedUser||!supportMsg.trim())return;
    setSendingMsg(true);
    await db.from("messages").insert({from_id:"admin-001",to_id:selectedUser.id,text:"[Soporte OfficioYa] "+supportMsg,read:false});
    setSupportMsg(""); setSendingMsg(false);
    setToastMsg("✓ Mensaje enviado a "+selectedUser.name);
    setTimeout(()=>setToastMsg(null),3000);
  };

  // Review moderation
  const approveReview=async(id:string)=>{
    await db.from("reviews").update({approved:true}).eq("id",id);
    setReviews(p=>p.map(r=>r.id===id?{...r,approved:true}:r));
    setToastMsg("✓ Reseña aprobada");
    setTimeout(()=>setToastMsg(null),3000);
  };
  const rejectReview=async(id:string)=>{
    await db.from("reviews").update({approved:false}).eq("id",id);
    setReviews(p=>p.map(r=>r.id===id?{...r,approved:false}:r));
    setToastMsg("Reseña rechazada");
    setTimeout(()=>setToastMsg(null),3000);
  };
  const deleteReview=async(id:string)=>{
    await db.from("reviews").delete().eq("id",id);
    setReviews(p=>p.filter(r=>r.id!==id));
    setToastMsg("Reseña eliminada");
    setTimeout(()=>setToastMsg(null),3000);
  };

  const filteredUsers=applyFilters(users);

  const PERIOD_BTNS=(
    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
      {(["7d","30d","90d","all"] as const).map(p=>(
        <button key={p} onClick={()=>setPeriod(p)} style={{padding:"4px 9px",borderRadius:6,border:"1px solid "+(period===p?C.accent:C.border),background:period===p?C.accent+"18":"transparent",color:period===p?C.accent:C.muted,cursor:"pointer",fontSize:10,fontFamily:"'DM Sans',sans-serif",fontWeight:period===p?700:400}}>
          {p==="all"?"Todo":p}
        </button>
      ))}
    </div>
  );

  const UserRowItem=({u}:{u:UserRow})=>(
    <GCard onClick={()=>setSelectedUser(u)} glow={selectedUser?.id===u.id?C.accent:""} style={{padding:"11px 14px",border:selectedUser?.id===u.id?"1px solid "+C.accent+"66":undefined}}>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <Ava s={u.name.substring(0,2).toUpperCase()} size={34} color={u.type==="profesional"?C.accent:C.blue} />
        <div style={{flex:1}}>
          <p style={{fontWeight:700,color:C.text,fontSize:13}}>{u.name}</p>
          <p style={{fontSize:10,color:C.muted}}>{u.email}{u.zone?" · "+u.zone:""}{u.trade?" · "+u.trade:""}</p>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:3,alignItems:"flex-end"}}>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>
            <span style={{fontSize:9,color:u.type==="profesional"?C.accent:C.blue,background:(u.type==="profesional"?C.accent:C.blue)+"22",padding:"1px 6px",borderRadius:3,fontWeight:700}}>{u.type==="profesional"?"PRO":"CLI"}</span>
            {isPaying(u)&&<span style={{fontSize:9,color:C.green,background:C.green+"18",padding:"1px 6px",borderRadius:3,fontWeight:700}}>✅ {PLAN_PRICES[u.plan as Plan]}€/m</span>}
            {isTrial(u)&&<span style={{fontSize:9,color:C.cyan,background:C.cyan+"18",padding:"1px 6px",borderRadius:3,fontWeight:700}}>⏱{trialDaysU(u)}d</span>}
            {isExpired(u)&&<span style={{fontSize:9,color:C.red,background:C.red+"18",padding:"1px 6px",borderRadius:3,fontWeight:700}}>⛔</span>}
          </div>
          <span style={{fontSize:9,color:C.muted}}>{new Date(u.joined_at).toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit",year:"2-digit"})}</span>
        </div>
      </div>
    </GCard>
  );

  return (
    <div style={{minHeight:"100dvh",background:C.bg,paddingBottom:72}}>
      <header style={{background:"rgba(10,10,15,0.95)",backdropFilter:"blur(20px)",borderBottom:"1px solid "+C.accent+"22",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1100,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
          <span style={{fontWeight:800,fontSize:16}}><span style={{color:C.accent}}>⚙ Admin CRM</span><span style={{color:C.muted}}> · OfficioYa</span></span>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <span style={{fontSize:11,color:C.green,background:C.green+"15",padding:"3px 8px",borderRadius:4,fontWeight:700}}>MRR: {mrr.toFixed(0)}€</span>
            <button onClick={onLogout} style={{background:"none",border:"1px solid "+C.border,borderRadius:6,color:C.muted,cursor:"pointer",padding:"4px 10px",fontSize:11}}>Salir</button>
          </div>
        </div>
      </header>

      {toastMsg&&<div style={{position:"fixed",bottom:88,left:"50%",transform:"translateX(-50%)",background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",color:"#000",borderRadius:10,padding:"10px 20px",fontWeight:700,fontSize:13,zIndex:9999,whiteSpace:"nowrap"}}>{toastMsg}</div>}

      {/* Detail panel */}
      {selectedUser&&(
        <div style={{position:"fixed",top:52,right:0,width:280,bottom:72,background:"linear-gradient(170deg,#12121E,#0A0A14)",borderLeft:"1px solid "+C.accent+"33",zIndex:90,overflowY:"auto",padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <p style={{fontWeight:800,color:C.text,fontSize:14}}>Detalle</p>
            <button onClick={()=>setSelectedUser(null)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>✕</button>
          </div>
          <div style={{textAlign:"center",marginBottom:14}}>
            <Ava s={selectedUser.name.substring(0,2).toUpperCase()} size={50} color={selectedUser.type==="profesional"?C.accent:C.blue} />
            <p style={{fontWeight:800,color:C.text,fontSize:15,marginTop:8}}>{selectedUser.name}</p>
            <p style={{fontSize:11,color:C.muted}}>{selectedUser.email}</p>
            {selectedUser.phone&&<a href={"tel:"+selectedUser.phone} style={{fontSize:11,color:C.green,textDecoration:"none",display:"block",marginTop:3}}>📞 {selectedUser.phone}</a>}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:14}}>
            {[
              {l:"Tipo",v:selectedUser.type.toUpperCase()},
              {l:"Plan",v:selectedUser.plan.toUpperCase()},
              {l:"Estado",v:isPaying(selectedUser)?"✅ Pagando":isTrial(selectedUser)?"⏱ Trial ("+trialDaysU(selectedUser)+"d)":isExpired(selectedUser)?"⛔ Expirado":"—"},
              {l:"Registro",v:new Date(selectedUser.joined_at).toLocaleDateString("es-ES",{day:"2-digit",month:"short",year:"numeric"})},
              {l:"Zona",v:selectedUser.zone||"—"},
              {l:"Oficio",v:selectedUser.trade||"—"},
            ].map(r=>(
              <div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid "+C.border}}>
                <span style={{fontSize:11,color:C.muted}}>{r.l}</span>
                <span style={{fontSize:11,color:C.text,fontWeight:600}}>{r.v}</span>
              </div>
            ))}
          </div>
          {isPaying(selectedUser)&&(
            <div style={{padding:"10px",background:C.green+"12",borderRadius:8,border:"1px solid "+C.green+"22",marginBottom:12,textAlign:"center"}}>
              <p style={{fontSize:10,color:C.muted,marginBottom:2}}>Factura mensual</p>
              <p style={{fontWeight:800,fontSize:18,color:C.green}}>{PLAN_PRICES[selectedUser.plan as Plan]}€/mes</p>
            </div>
          )}
          <div>
            <p style={{fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.06em",marginBottom:6}}>Enviar soporte</p>
            <textarea value={supportMsg} onChange={e=>setSupportMsg(e.target.value)} placeholder="Mensaje al usuario..." style={{width:"100%",background:C.card,border:"1px solid "+C.border,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:12,padding:"8px 10px",resize:"vertical",minHeight:60,outline:"none",marginBottom:8}} />
            <Btn full small disabled={sendingMsg||!supportMsg.trim()} onClick={sendSupport} color={C.accent}>{sendingMsg?"Enviando...":"Enviar"}</Btn>
          </div>
        </div>
      )}

      <div style={{maxWidth:selectedUser?820:1100,margin:"0 auto",padding:"16px",transition:"max-width 0.2s"}}>
        {loading?<Spin />:(<>

          {tab==="overview"&&(<>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
              <h2 style={{fontWeight:800,fontSize:20,color:C.text}}>Overview</h2>
              {PERIOD_BTNS}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8,marginBottom:16}}>
              {[
                {l:"Usuarios",v:users.length,c:C.blue,i:"👥"},
                {l:"Profesionales",v:pros.length,c:C.accent,i:"🔨"},
                {l:"Clientes",v:clients.length,c:C.green,i:"🏠"},
                {l:"Pagando",v:payingUsers.length,c:C.green,i:"✅"},
                {l:"En trial",v:trialUsers.length,c:C.cyan,i:"⏱"},
                {l:"Expirados",v:expiredUsers.length,c:C.red,i:"⛔"},
                {l:"MRR",v:mrr.toFixed(0)+"€",c:C.orange,i:"💰"},
                {l:"Conversión",v:pros.length>0?Math.round(payingUsers.length/pros.length*100)+"%":"0%",c:C.purple,i:"📈"},
              ].map(s=>(
                <GCard key={s.l} style={{textAlign:"center",padding:"12px 8px"}}>
                  <div style={{fontSize:16,marginBottom:3}}>{s.i}</div>
                  <p style={{fontWeight:800,fontSize:20,color:s.c}}>{s.v}</p>
                  <p style={{fontSize:10,color:C.text,fontWeight:600}}>{s.l}</p>
                </GCard>
              ))}
            </div>

            <GCard style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <p style={{fontWeight:700,color:C.text,fontSize:13}}>Registros diarios</p>
                <span style={{fontSize:11,color:C.muted}}>{users.filter(u=>inPeriod(u.joined_at)).length} en período</span>
              </div>
              <div style={{display:"flex",gap:2,alignItems:"flex-end",height:80}}>
                {chartData.map((d,i)=>(
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,position:"relative"}} title={d.date+": "+d.users}>
                    {d.users>0&&<span style={{position:"absolute",top:-14,fontSize:8,color:C.accent,fontWeight:700}}>{d.users}</span>}
                    <div style={{width:"100%",display:"flex",flexDirection:"column",justifyContent:"flex-end",height:68}}>
                      {d.pros>0&&<div style={{width:"100%",background:C.accent,borderRadius:"2px 2px 0 0",height:Math.max(d.pros/maxBar*64,2)+"px"}} />}
                      {d.clients>0&&<div style={{width:"100%",background:C.blue,height:Math.max(d.clients/maxBar*64,2)+"px"}} />}
                      {d.users===0&&<div style={{width:"100%",background:C.border,height:2}} />}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                <span style={{fontSize:8,color:C.muted}}>{chartData[0]?.date}</span>
                <div style={{display:"flex",gap:10}}><span style={{fontSize:8,color:C.accent}}>■ Pros</span><span style={{fontSize:8,color:C.blue}}>■ Clientes</span></div>
                <span style={{fontSize:8,color:C.muted}}>{chartData[chartData.length-1]?.date}</span>
              </div>
            </GCard>

            <GCard style={{marginBottom:14}}>
              <p style={{fontWeight:700,color:C.text,fontSize:13,marginBottom:12}}>Estado profesionales</p>
              {[{l:"✅ Pagando",v:payingUsers.length,t:pros.length,c:C.green},{l:"⏱ Trial",v:trialUsers.length,t:pros.length,c:C.cyan},{l:"⛔ Expirado",v:expiredUsers.length,t:pros.length,c:C.red}].map(s=>{
                const pct=s.t>0?Math.round(s.v/s.t*100):0;
                return <div key={s.l} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:12,color:C.text}}>{s.l}</span>
                    <span style={{fontSize:12,fontWeight:700,color:s.c}}>{s.v} ({pct}%)</span>
                  </div>
                  <div style={{height:6,background:C.border,borderRadius:99,overflow:"hidden"}}>
                    <div style={{width:pct+"%",height:"100%",background:s.c,borderRadius:99}} />
                  </div>
                </div>;
              })}
            </GCard>

            {expiredUsers.length>0&&(
              <GCard style={{border:"1px solid "+C.red+"33"}}>
                <p style={{fontWeight:700,color:C.red,fontSize:13,marginBottom:10}}>⛔ {expiredUsers.length} leads fríos</p>
                <div style={{display:"flex",flexDirection:"column",gap:7,maxHeight:240,overflowY:"auto"}}>
                  {expiredUsers.map(u=><UserRowItem key={u.id} u={u} />)}
                </div>
              </GCard>
            )}
          </>)}

          {tab==="usuarios"&&(<>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
              <h2 style={{fontWeight:800,fontSize:20,color:C.text}}>Usuarios · {filteredUsers.length}</h2>
            </div>
            <GCard style={{marginBottom:12,padding:14}}>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
                <input value={filterSearch} onChange={e=>setFilterSearch(e.target.value)} placeholder="🔍 Buscar..." style={{flex:2,minWidth:150,background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"8px 12px",color:C.text,fontFamily:"inherit",fontSize:12,outline:"none"}} />
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[{v:"all",l:"Todos"},{v:"cliente",l:"Clientes"},{v:"profesional",l:"Profesionales"}].map(o=>(
                  <button key={o.v} onClick={()=>setFilterType(o.v as any)} style={{padding:"4px 10px",borderRadius:99,border:"1px solid "+(filterType===o.v?C.blue:C.border),background:filterType===o.v?C.blue+"18":"transparent",color:filterType===o.v?C.blue:C.muted,cursor:"pointer",fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:filterType===o.v?700:400}}>{o.l}</button>
                ))}
                {[{v:"all",l:"Todos"},{v:"paying",l:"✅ Pago"},{v:"trial",l:"⏱ Trial"},{v:"expired",l:"⛔ Exp."}].map(o=>(
                  <button key={o.v} onClick={()=>setFilterStatus(o.v as any)} style={{padding:"4px 10px",borderRadius:99,border:"1px solid "+(filterStatus===o.v?C.green:C.border),background:filterStatus===o.v?C.green+"18":"transparent",color:filterStatus===o.v?C.green:C.muted,cursor:"pointer",fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:filterStatus===o.v?700:400}}>{o.l}</button>
                ))}
              </div>
            </GCard>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {filteredUsers.map(u=><UserRowItem key={u.id} u={u} />)}
              {filteredUsers.length===0&&<p style={{textAlign:"center",color:C.muted,fontSize:13,padding:32}}>Sin resultados</p>}
            </div>
          </>)}

          {tab==="registros"&&(<>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
              <h2 style={{fontWeight:800,fontSize:20,color:C.text}}>Registros</h2>
              {PERIOD_BTNS}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {users.filter(u=>inPeriod(u.joined_at)).map(u=><UserRowItem key={u.id} u={u} />)}
              {users.filter(u=>inPeriod(u.joined_at)).length===0&&<p style={{textAlign:"center",color:C.muted,fontSize:13,padding:32}}>Sin registros en este período</p>}
            </div>
          </>)}

          {tab==="trabajos"&&(<>
            <h2 style={{fontWeight:800,fontSize:20,color:C.text,marginBottom:14}}>Trabajos · {jobs.length}</h2>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:14}}>
              {[{l:"Pendientes",v:jobs.filter(j=>j.status==="pending").length,c:C.orange},{l:"En progreso",v:jobs.filter(j=>j.status==="in_progress").length,c:C.blue},{l:"Completados",v:jobs.filter(j=>j.status==="done").length,c:C.green},{l:"Cancelados",v:jobs.filter(j=>j.status==="cancelled").length,c:C.red}].map(s=>(
                <GCard key={s.l} style={{textAlign:"center",padding:"10px 6px"}}>
                  <p style={{fontWeight:800,fontSize:20,color:s.c}}>{s.v}</p>
                  <p style={{fontSize:10,color:C.muted}}>{s.l}</p>
                </GCard>
              ))}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {jobs.map(j=>(
                <GCard key={j.id} style={{padding:"11px 14px"}}>
                  <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                    <div style={{flex:1}}><p style={{fontWeight:700,color:C.text,fontSize:13}}>{j.title}</p><p style={{fontSize:11,color:C.muted}}>👤 {j.client_name}</p></div>
                    <StatusDot status={j.status} />
                    <span style={{fontSize:10,color:C.muted}}>{timeAgo(j.created_at)}</span>
                  </div>
                </GCard>
              ))}
            </div>
          </>)}

          {tab==="mensajes"&&(<>
            <h2 style={{fontWeight:800,fontSize:20,color:C.text,marginBottom:14}}>Mensajes · {msgs.length}</h2>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {msgs.slice(0,50).map(m=>{
                const fromUser=users.find(u=>u.id===m.from_id);
                const toUser=users.find(u=>u.id===m.to_id);
                return <GCard key={m.id} style={{padding:"10px 12px"}}>
                  <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:3,flexWrap:"wrap"}}>
                        <span style={{fontSize:11,color:C.accent,fontWeight:700}}>{fromUser?.name||"Soporte"}</span>
                        <span style={{fontSize:10,color:C.muted}}>→</span>
                        <span style={{fontSize:11,color:C.blue,fontWeight:700}}>{toUser?.name||"Usuario"}</span>
                        {!m.read&&<span style={{fontSize:8,color:C.orange,background:C.orange+"22",padding:"1px 5px",borderRadius:3,fontWeight:700}}>NO LEÍDO</span>}
                      </div>
                      <p style={{fontSize:12,color:C.mutedL,lineHeight:1.5}}>{m.text}</p>
                    </div>
                    <span style={{fontSize:9,color:C.muted,flexShrink:0}}>{timeAgo(m.created_at)}</span>
                  </div>
                </GCard>;
              })}
            </div>
          </>)}

          {tab==="reseñas"&&(<>
            <h2 style={{fontWeight:800,fontSize:20,color:C.text,marginBottom:14}}>Moderación de reseñas · {reviews.length}</h2>
            <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
              {[
                {l:"Todas",v:reviews.length,c:C.blue},
                {l:"✓ Aprobadas",v:reviews.filter(r=>r.approved===true).length,c:C.green},
                {l:"Pendientes",v:reviews.filter(r=>r.approved===null||r.approved===undefined).length,c:C.orange},
                {l:"✗ Rechazadas",v:reviews.filter(r=>r.approved===false).length,c:C.red},
              ].map(s=>(
                <div key={s.l} style={{background:s.c+"12",border:"1px solid "+s.c+"22",borderRadius:8,padding:"8px 12px",textAlign:"center",minWidth:80}}>
                  <p style={{fontWeight:800,fontSize:18,color:s.c}}>{s.v}</p>
                  <p style={{fontSize:10,color:C.muted}}>{s.l}</p>
                </div>
              ))}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {reviews.map(r=>{
                const worker=users.find(u=>u.id===r.worker_id);
                return <GCard key={r.id} style={{padding:14,border:"1px solid "+(r.approved===true?C.green+"22":r.approved===false?C.red+"22":C.orange+"22")}}>
                  <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:8}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:4}}>
                        <span style={{fontWeight:700,color:C.text,fontSize:13}}>{r.client_name}</span>
                        <Stars n={r.stars} size={11} />
                        <span style={{fontSize:10,color:C.muted}}>{timeAgo(r.created_at)}</span>
                        {r.approved===true&&<span style={{fontSize:9,color:C.green,background:C.green+"18",padding:"1px 6px",borderRadius:3,fontWeight:700}}>✓ APROBADA</span>}
                        {r.approved===false&&<span style={{fontSize:9,color:C.red,background:C.red+"18",padding:"1px 6px",borderRadius:3,fontWeight:700}}>✗ RECHAZADA</span>}
                        {(r.approved===null||r.approved===undefined)&&<span style={{fontSize:9,color:C.orange,background:C.orange+"18",padding:"1px 6px",borderRadius:3,fontWeight:700}}>⏳ PENDIENTE</span>}
                      </div>
                      <p style={{fontSize:11,color:C.muted,marginBottom:4}}>Para: <span style={{color:C.accent}}>{worker?.name||r.worker_id}</span></p>
                      <p style={{fontSize:13,color:C.mutedL,lineHeight:1.6}}>{r.text}</p>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    {r.approved!==true&&<button onClick={()=>approveReview(r.id)} style={{padding:"6px 12px",background:C.green+"22",border:"1px solid "+C.green+"44",borderRadius:8,color:C.green,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>✓ Aprobar</button>}
                    {r.approved!==false&&<button onClick={()=>rejectReview(r.id)} style={{padding:"6px 12px",background:C.orange+"15",border:"1px solid "+C.orange+"33",borderRadius:8,color:C.orange,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>✗ Rechazar</button>}
                    <button onClick={()=>deleteReview(r.id)} style={{padding:"6px 12px",background:C.red+"12",border:"1px solid "+C.red+"25",borderRadius:8,color:C.red,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>🗑 Eliminar</button>
                  </div>
                </GCard>;
              })}
              {reviews.length===0&&<p style={{textAlign:"center",color:C.muted,fontSize:13,padding:32}}>No hay reseñas</p>}
            </div>
          </>)}

        </>)}
      </div>

      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(10,10,15,0.97)",backdropFilter:"blur(20px)",borderTop:"1px solid "+C.accent+"22",display:"flex",zIndex:200,overflowX:"auto"}}>
        {([["overview","📊","Overview"],["usuarios","👥","Usuarios"],["registros","📅","Registros"],["trabajos","🔨","Trabajos"],["mensajes","💬","Mensajes"],["reseñas","⭐","Reseñas"]] as const).map(([id,icon,label])=>(
          <button key={id} onClick={()=>setTab(id as AdminTab)} style={{flex:"0 0 auto",minWidth:60,padding:"8px 4px 10px",background:"none",border:"none",color:tab===id?C.accent:C.muted,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,borderBottom:tab===id?"2px solid "+C.accent:"2px solid transparent"}}>
            <span style={{fontSize:16}}>{icon}</span>
            <span style={{fontSize:8,fontWeight:600,whiteSpace:"nowrap"}}>{label}</span>
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

  if(!ready)return <div style={{minHeight:"100dvh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><Spin /></div>;

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
  const [urgency,setUrgency]=useState<string>("");void urgency;

  const matches=workers.filter(w=>
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
        <p style={{fontWeight:700,color:C.text,fontSize:15,marginBottom:14}}>¿Qué profesional necesitas?</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:20}}>
          {OFICIOS.map(t=>(
            <button key={t} onClick={()=>{setTrade(t);setStep(1);}} style={{padding:"10px 14px",borderRadius:10,border:"1px solid "+(trade===t?C.accent:C.border),background:trade===t?C.accent+"18":C.surface,color:trade===t?C.accent:C.text,cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif",fontWeight:600,display:"flex",alignItems:"center",gap:6,transition:"all 0.15s"}}>
              <span>{OFICIO_ICONS[t]||"🔧"}</span>{t}
            </button>
          ))}
        </div>
        <Btn outline full onClick={()=>setStep(1)} color={C.muted} small>Ver todos →</Btn>
      </>)}

      {step===1&&(<>
        <p style={{fontWeight:700,color:C.text,fontSize:15,marginBottom:14}}>¿En qué zona de Sevilla?</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:7,marginBottom:20}}>
          {SEVILLA_ZONAS.map(z=>(
            <button key={z} onClick={()=>{setZone(z);setStep(2);}} style={{padding:"8px 12px",borderRadius:10,border:"1px solid "+(zone===z?C.blue:C.border),background:zone===z?C.blue+"18":C.surface,color:zone===z?C.blue:C.text,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:zone===z?700:400,transition:"all 0.15s"}}>
              📍 {z}
            </button>
          ))}
        </div>
        <Btn outline full onClick={()=>setStep(2)} color={C.muted} small>Cualquier zona →</Btn>
      </>)}

      {step===2&&(<>
        <p style={{fontWeight:700,color:C.text,fontSize:15,marginBottom:14}}>¿Con qué urgencia?</p>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
          {[{v:"now",l:"🚨 Urgente — necesito ayuda hoy",c:C.red},{v:"week",l:"📅 Esta semana",c:C.blue},{v:"quote",l:"💬 Solo quiero presupuesto",c:C.green}].map(o=>(
            <button key={o.v} onClick={()=>{setUrgency(o.v);setStep(3);}} style={{padding:"14px 16px",borderRadius:10,border:"1px solid "+o.c+"44",background:o.c+"12",color:C.text,cursor:"pointer",fontSize:13,fontFamily:"'DM Sans',sans-serif",fontWeight:600,textAlign:"left"}}>
              {o.l}
            </button>
          ))}
        </div>
      </>)}

      {step===3&&(<>
        <p style={{fontWeight:700,color:C.text,fontSize:15,marginBottom:4}}>
          {matches.length>0?`✅ ${matches.length} profesional${matches.length>1?"es":""} disponible${matches.length>1?"s":""}`:"😕 Sin resultados exactos"}
        </p>
        <p style={{fontSize:12,color:C.muted,marginBottom:14}}>
          {trade&&<span style={{color:C.accent,fontWeight:600}}>{OFICIO_ICONS[trade]} {trade}</span>}{zone&&<span style={{color:C.blue}}> · 📍{zone}</span>}
        </p>
        {matches.length===0&&<div style={{textAlign:"center",padding:20,color:C.muted,marginBottom:14}}>
          <p style={{fontSize:13}}>No hay profesionales disponibles con esos filtros</p>
          <button onClick={()=>{setTrade("");setZone("");setStep(3);}} style={{marginTop:10,background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:12,fontWeight:700}}>Ver todos los disponibles →</button>
        </div>}
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
          {matches.map(w=>{
            const col=wColor(w.id);
            return <GCard key={w.id} onClick={()=>onSelect(w)} glow={col} style={{padding:14}}>
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                <Ava s={w.name.substring(0,2).toUpperCase()} size={44} color={col} online />
                <div style={{flex:1}}>
                  <p style={{fontWeight:700,color:C.text,fontSize:14}}>{w.name}</p>
                  <p style={{fontSize:12,color:col}}>{OFICIO_ICONS[w.trade||""]||"🔧"} {w.trade}</p>
                  <div style={{display:"flex",gap:5,alignItems:"center",marginTop:2}}>
                    <Stars n={w.rating} size={10} />
                    <span style={{fontSize:11,color:C.text,fontWeight:700}}>{w.rating>0?w.rating.toFixed(1):"Nuevo"}</span>
                    {w.free_quote&&<span style={{fontSize:10,color:C.green}}>· Presupuesto gratis</span>}
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <p style={{fontWeight:800,fontSize:18,color:C.accent}}>{w.price}€<span style={{fontSize:10,color:C.muted}}>/h</span></p>
                  <p style={{fontSize:10,color:C.green}}>● Disponible</p>
                </div>
              </div>
            </GCard>;
          })}
        </div>
        <Btn full onClick={onClose} color={C.accent}>Ver todos los profesionales →</Btn>
      </>)}
    </Sheet>
  );
}

// ─── SEVILLA MAP ───
const PUEBLOS_CERCANOS=[
  {id:"Dos Hermanas",label:"Dos Hermanas",lat:37.296,lng:-5.922},
  {id:"Alcalá de Guadaíra",label:"Alcalá de Guadaíra",lat:37.339,lng:-5.840},
  {id:"Mairena del Aljarafe",label:"Mairena del Aljarafe",lat:37.347,lng:-6.062},
  {id:"Camas",label:"Camas",lat:37.399,lng:-6.031},
  {id:"San Juan de Aznalfarache",label:"San Juan",lat:37.370,lng:-6.025},
  {id:"Bormujos",label:"Bormujos",lat:37.362,lng:-6.071},
  {id:"Tomares",label:"Tomares",lat:37.371,lng:-6.047},
  {id:"Gelves",label:"Gelves",lat:37.340,lng:-6.013},
  {id:"La Rinconada",label:"La Rinconada",lat:37.476,lng:-5.981},
];

const BARRIOS_SEVILLA=[
  {id:"Centro",color:"#FFD700",latlngs:[[37.3961,-5.9953],[37.3958,-5.9916],[37.3944,-5.9873],[37.3921,-5.9836],[37.3896,-5.9823],[37.3872,-5.9829],[37.3854,-5.9851],[37.3851,-5.9883],[37.3862,-5.9921],[37.3886,-5.9952],[37.3916,-5.9967],[37.3944,-5.9965]]},
  {id:"Triana",color:"#FF6B6B",latlngs:[[37.3989,-6.0156],[37.3991,-6.0098],[37.3978,-6.0052],[37.3955,-6.0012],[37.3921,-5.9988],[37.3892,-5.9981],[37.3869,-5.9991],[37.3851,-6.0018],[37.3843,-6.0058],[37.3851,-6.0101],[37.3874,-6.0138],[37.3909,-6.0158],[37.3946,-6.0162],[37.3971,-6.0158]]},
  {id:"Los Remedios",color:"#4ECDC4",latlngs:[[37.3851,-6.0018],[37.3843,-6.0058],[37.3851,-6.0101],[37.3836,-6.0098],[37.3798,-6.0071],[37.3768,-6.0038],[37.3754,-5.9998],[37.3758,-5.9958],[37.3779,-5.9928],[37.3812,-5.9918],[37.3843,-5.9934],[37.3869,-5.9991]]},
  {id:"Nervión",color:"#45B7D1",latlngs:[[37.3961,-5.9953],[37.3944,-5.9965],[37.3960,-5.9895],[37.3988,-5.9833],[37.4008,-5.9776],[37.4001,-5.9718],[37.3978,-5.9678],[37.3954,-5.9668],[37.3928,-5.9689],[37.3911,-5.9728],[37.3913,-5.9772],[37.3929,-5.9810],[37.3944,-5.9837],[37.3961,-5.9873]]},
  {id:"La Macarena",color:"#A78BFA",latlngs:[[37.4098,-5.9988],[37.4121,-5.9941],[37.4128,-5.9881],[37.4118,-5.9821],[37.4091,-5.9773],[37.4058,-5.9743],[37.4021,-5.9738],[37.3988,-5.9758],[37.3972,-5.9791],[37.3961,-5.9831],[37.3961,-5.9873],[37.3988,-5.9833],[37.4008,-5.9776],[37.4038,-5.9761],[37.4068,-5.9771],[37.4088,-5.9801],[37.4091,-5.9851],[37.4078,-5.9901],[37.4058,-5.9941]]},
  {id:"San Pablo",color:"#FB923C",latlngs:[[37.4098,-5.9988],[37.4058,-5.9941],[37.4078,-5.9901],[37.4091,-5.9851],[37.4088,-5.9801],[37.4121,-5.9741],[37.4148,-5.9701],[37.4168,-5.9638],[37.4158,-5.9578],[37.4131,-5.9541],[37.4098,-5.9531],[37.4068,-5.9548],[37.4048,-5.9578],[37.4038,-5.9621],[37.4041,-5.9671],[37.4058,-5.9718],[37.4088,-5.9738]]},
  {id:"Bellavista",color:"#34D399",latlngs:[[37.3758,-5.9958],[37.3754,-5.9998],[37.3768,-6.0038],[37.3748,-6.0031],[37.3718,-5.9998],[37.3694,-5.9951],[37.3681,-5.9898],[37.3686,-5.9841],[37.3708,-5.9798],[37.3738,-5.9778],[37.3768,-5.9788],[37.3791,-5.9818],[37.3798,-5.9858],[37.3791,-5.9901],[37.3779,-5.9928]]},
  {id:"Cerro-Amate",color:"#60A5FA",latlngs:[[37.3978,-5.9678],[37.4001,-5.9718],[37.4008,-5.9776],[37.3988,-5.9833],[37.3961,-5.9873],[37.3944,-5.9837],[37.3928,-5.9810],[37.3911,-5.9771],[37.3898,-5.9721],[37.3891,-5.9661],[37.3901,-5.9601],[37.3924,-5.9558],[37.3954,-5.9541],[37.3984,-5.9558],[37.4001,-5.9594],[37.4001,-5.9638]]},
  {id:"Sur",color:"#F472B6",latlngs:[[37.3791,-5.9818],[37.3768,-5.9788],[37.3738,-5.9778],[37.3718,-5.9798],[37.3698,-5.9841],[37.3691,-5.9888],[37.3664,-5.9871],[37.3638,-5.9838],[37.3624,-5.9791],[37.3628,-5.9741],[37.3651,-5.9701],[37.3681,-5.9678],[37.3714,-5.9678],[37.3744,-5.9694],[37.3764,-5.9724],[37.3771,-5.9771]]},
  {id:"Norte",color:"#6EE7B7",latlngs:[[37.4128,-5.9881],[37.4148,-5.9941],[37.4168,-5.9988],[37.4188,-6.0028],[37.4198,-6.0078],[37.4188,-6.0121],[37.4158,-6.0148],[37.4121,-6.0151],[37.4088,-6.0128],[37.4068,-6.0091],[37.4068,-6.0041],[37.4088,-6.0001],[37.4118,-5.9971],[37.4128,-5.9928]]},
];

function SevillaMap({selectedZone,onZoneSelect}:{selectedZone:string;onZoneSelect:(z:string)=>void}){
  const mapRef=useRef<HTMLDivElement>(null);
  const leafletRef=useRef<L.Map|null>(null);
  const polysRef=useRef<Record<string,L.Polygon>>({});
  const [filter,setFilter]=useState<"sevilla"|"pueblos">("sevilla");

  useEffect(()=>{
    if(!mapRef.current||leafletRef.current)return;
    const map=L.map(mapRef.current,{center:[37.388,-5.982],zoom:12,zoomControl:false,scrollWheelZoom:true,attributionControl:false});
    L.control.zoom({position:"bottomright"}).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",{subdomains:"abcd",maxZoom:19}).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",{subdomains:"abcd",maxZoom:19,opacity:0.6}).addTo(map);

    BARRIOS_SEVILLA.forEach(b=>{
      const coords=b.latlngs.map(c=>[c[0],c[1]] as L.LatLngTuple);
      const isActive=selectedZone===b.id;
      const poly=L.polygon(coords,{color:b.color,fillColor:b.color,fillOpacity:isActive?0.50:0.18,weight:isActive?2.5:1.2,opacity:isActive?1:0.65,dashArray:isActive?undefined:"5,4",smoothFactor:2}).addTo(map);
      poly.on("mouseover",()=>{if(selectedZone!==b.id)poly.setStyle({fillOpacity:0.38,dashArray:undefined,weight:2});});
      poly.on("mouseout",()=>{if(selectedZone!==b.id)poly.setStyle({fillOpacity:0.18,dashArray:"5,4",weight:1.2});});
      poly.on("click",()=>onZoneSelect(selectedZone===b.id?"":b.id));
      polysRef.current[b.id]=poly;
      const center=poly.getBounds().getCenter();
      const icon=L.divIcon({html:`<span style="color:${isActive?"#fff":b.color};font-size:${isActive?"11px":"9.5px"};font-weight:${isActive?"800":"600"};font-family:'DM Sans',sans-serif;text-shadow:0 1px 4px rgba(0,0,0,0.95);white-space:nowrap;pointer-events:none">${b.id}</span>`,iconSize:[90,18],iconAnchor:[45,9],className:""});
      L.marker(center,{icon,interactive:false}).addTo(map);
    });

    PUEBLOS_CERCANOS.forEach(p=>{
      const isActive=selectedZone===p.id;
      const icon=L.divIcon({html:`<div style="display:flex;flex-direction:column;align-items:center;pointer-events:none"><div style="width:${isActive?10:7}px;height:${isActive?10:7}px;border-radius:50%;background:${isActive?"#FFD700":"#4ECDC4"};box-shadow:0 0 8px ${isActive?"#FFD700":"#4ECDC4"}88;border:2px solid ${isActive?"#FFD700":"rgba(255,255,255,0.3)"}"></div><span style="color:${isActive?"#FFD700":"#aaa"};font-size:9px;font-weight:${isActive?700:500};font-family:'DM Sans',sans-serif;text-shadow:0 1px 3px rgba(0,0,0,0.9);margin-top:2px;white-space:nowrap">${p.label}</span></div>`,iconSize:[80,32],iconAnchor:[40,5],className:""});
      const marker=L.marker([p.lat,p.lng],{icon,interactive:true}).addTo(map);
      marker.on("click",()=>onZoneSelect(selectedZone===p.id?"":p.id));
    });

    leafletRef.current=map;
    return ()=>{map.remove();leafletRef.current=null;};
  },[]);

  useEffect(()=>{
    BARRIOS_SEVILLA.forEach(b=>{
      const poly=polysRef.current[b.id];
      if(!poly)return;
      const isActive=selectedZone===b.id;
      poly.setStyle({fillOpacity:isActive?0.50:0.18,weight:isActive?2.5:1.2,dashArray:isActive?undefined:"5,4",opacity:isActive?1:0.65});
    });
  },[selectedZone]);

  useEffect(()=>{
    const map=leafletRef.current;
    if(!map)return;
    if(filter==="sevilla")map.flyTo([37.388,-5.982],13,{duration:0.8});
    else map.flyTo([37.38,-6.0],11,{duration:0.8});
  },[filter]);

  return (
    <div style={{marginBottom:16,borderRadius:16,overflow:"hidden",border:"1px solid "+(selectedZone?C.accent+"55":C.border),background:C.card,boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
      <div style={{padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(135deg,"+C.card+",#0F0F1A)",borderBottom:"1px solid "+C.border}}>
        <div>
          <p style={{fontSize:13,fontWeight:700,color:C.text}}>🗺️ Selecciona una zona</p>
          <p style={{fontSize:10,color:C.muted,marginTop:1}}>Haz clic en el mapa o usa los botones</p>
        </div>
        {selectedZone&&(
          <button onClick={()=>onZoneSelect("")} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",background:C.accent+"15",border:"1px solid "+C.accent+"44",borderRadius:99,color:C.accent,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>
            <span style={{maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selectedZone}</span>
            <span>✕</span>
          </button>
        )}
      </div>
      <div ref={mapRef} style={{height:260,width:"100%"}} />
      <div style={{background:"linear-gradient(180deg,"+C.card+",#0F0F1A)",borderTop:"1px solid "+C.border}}>
        <div style={{display:"flex",padding:"10px 12px 6px",gap:6}}>
          <button onClick={()=>setFilter("sevilla")} style={{flex:1,padding:"8px",borderRadius:10,border:"1px solid "+(filter==="sevilla"?C.accent:C.border),background:filter==="sevilla"?"linear-gradient(135deg,"+C.accent+"22,"+C.orange+"11)":"transparent",color:filter==="sevilla"?C.accent:C.muted,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:filter==="sevilla"?700:500}}>🏙️ Sevilla capital</button>
          <button onClick={()=>setFilter("pueblos")} style={{flex:1,padding:"8px",borderRadius:10,border:"1px solid "+(filter==="pueblos"?C.cyan:C.border),background:filter==="pueblos"?"linear-gradient(135deg,"+C.cyan+"22,transparent)":"transparent",color:filter==="pueblos"?C.cyan:C.muted,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:filter==="pueblos"?700:500}}>🏘️ Pueblos cercanos</button>
        </div>
        {filter==="sevilla"&&(
          <div style={{padding:"4px 12px 10px",display:"flex",gap:5,flexWrap:"wrap",maxHeight:70,overflowY:"auto"}}>
            {BARRIOS_SEVILLA.map(b=>{
              const isActive=selectedZone===b.id;
              return <button key={b.id} onClick={()=>onZoneSelect(isActive?"":b.id)} style={{padding:"4px 10px",borderRadius:99,border:"1px solid "+(isActive?b.color:C.border),background:isActive?b.color+"25":"transparent",color:isActive?b.color:C.muted,cursor:"pointer",fontSize:10,fontFamily:"'DM Sans',sans-serif",fontWeight:isActive?700:400,transition:"all 0.15s",whiteSpace:"nowrap"}}>
                {b.id}
              </button>;
            })}
          </div>
        )}
        {filter==="pueblos"&&(
          <div style={{padding:"4px 12px 10px",display:"flex",gap:5,flexWrap:"wrap",maxHeight:70,overflowY:"auto"}}>
            {PUEBLOS_CERCANOS.map(p=>{
              const isActive=selectedZone===p.id;
              return <button key={p.id} onClick={()=>onZoneSelect(isActive?"":p.id)} style={{padding:"4px 10px",borderRadius:99,border:"1px solid "+(isActive?C.cyan:C.border),background:isActive?C.cyan+"22":"transparent",color:isActive?C.cyan:C.muted,cursor:"pointer",fontSize:10,fontFamily:"'DM Sans',sans-serif",fontWeight:isActive?700:400,transition:"all 0.15s",whiteSpace:"nowrap"}}>
                📍 {p.label}
              </button>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── RANKING SECTION ───
function RankingSection({workers,onSelect}:{workers:UserRow[];onSelect:(w:UserRow)=>void}){
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
      <h2 style={{fontWeight:900,fontSize:24,letterSpacing:"-0.02em",marginBottom:4}}><span style={{color:C.text}}>🏆 Ranking de</span> <span style={{color:C.accent}}>Profesionales</span></h2>
      <p style={{fontSize:13,color:C.muted,marginBottom:16}}>Los mejores valorados de la plataforma</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
        <select value={filterZone} onChange={e=>setFilterZone(e.target.value)} style={{padding:"10px 12px",background:C.card,border:"1px solid "+C.border,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:13,cursor:"pointer",outline:"none"}}>
          <option style={{background:C.card}}>Todas</option>
          {ZONAS.map(z=><option key={z} style={{background:C.card}}>{z}</option>)}
        </select>
        <select value={filterTrade} onChange={e=>setFilterTrade(e.target.value)} style={{padding:"10px 12px",background:C.card,border:"1px solid "+C.border,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:13,cursor:"pointer",outline:"none"}}>
          <option style={{background:C.card}}>Todos</option>
          {OFICIOS.map(o=><option key={o} style={{background:C.card}}>{o}</option>)}
        </select>
      </div>

      {eligible.length===0&&<div style={{textAlign:"center",padding:40,color:C.muted}}>
        <p style={{fontSize:32,marginBottom:8}}>🏆</p>
        <p style={{fontWeight:700,fontSize:16,marginBottom:6}}>Sin profesionales en el ranking</p>
        <p style={{fontSize:13}}>El ranking muestra profesionales con plan Pro o Élite</p>
      </div>}

      {eligible.length>=3&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16,alignItems:"flex-end"}}>
          {[eligible[1],eligible[0],eligible[2]].map((w,i)=>{
            const positions=[2,1,3];const heights=[110,150,90];const col=pCol[i];const pos=positions[i];
            return <div key={w.id} style={{textAlign:"center",cursor:"pointer"}} onClick={()=>onSelect(w)}>
              <div style={{display:"flex",justifyContent:"center",marginBottom:6}}><Ava s={w.name.substring(0,2).toUpperCase()} size={pos===1?58:44} color={col} /></div>
              <p style={{fontWeight:700,color:C.text,fontSize:pos===1?14:12,marginBottom:2}}>{w.name.split(" ")[0]}</p>
              <p style={{fontSize:10,color:C.muted,marginBottom:4}}>{w.zone}</p>
              <Stars n={w.rating} size={pos===1?13:10} />
              <div style={{height:heights[i],background:"linear-gradient(180deg,"+col+"20,transparent)",border:"1px solid "+col+"55",borderRadius:"8px 8px 0 0",display:"flex",alignItems:"center",justifyContent:"center",marginTop:8}}>
                <span style={{fontFamily:"monospace",fontSize:36,fontWeight:900,color:col}}>#{pos}</span>
              </div>
            </div>;
          })}
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {eligible.slice(eligible.length>=3?3:0).map((w,i)=>{
          const col=wColor(w.id);
          return <GCard key={w.id} onClick={()=>onSelect(w)} glow={col} style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontWeight:800,fontSize:18,color:C.muted,width:28,textAlign:"center"}}>#{i+(eligible.length>=3?4:1)}</span>
            <Ava s={w.name.substring(0,2).toUpperCase()} size={38} color={col} online={w.available} />
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontWeight:700,color:C.text,fontSize:13}}>{w.name}</p>
              <p style={{fontSize:11,color:C.muted}}>{w.trade} · {w.zone}</p>
            </div>
            <div style={{textAlign:"right"}}>
              <Stars n={w.rating} size={11} />
              <p style={{fontSize:11,fontWeight:700,color:C.accent}}>{w.rating>0?w.rating.toFixed(1):"Nuevo"}</p>
              <p style={{fontSize:10,color:C.muted}}>({w.reviews})</p>
            </div>
          </GCard>;
        })}
      </div>
    </div>
  );
}
