import React, { useState, useEffect, useRef, useCallback } from "react";
import EliteLanding from "./EliteLanding";
import Terminos from "./Terminos";
import Privacidad from "./Privacidad";
import Cancelacion from "./Cancelacion";
import { db, STORAGE_URL } from "./supabase";
import type { UserRow, MessageRow, JobRow, CertRow, Plan, PhotoRow } from "./supabase";
import { MapaZonas, MapaProModal } from './MapaZonas';

// ── DIM PREMIUM palette — slate/zinc, legible bajo el sol ──
const C = {
  bg:"#0F1117",       // slate-950 oscuro pero no negro puro
  surface:"#161B27",  // slate-900
  card:"#1E2536",     // slate-850 aprox (tarjetas)
  cardHover:"#263148",// slate-800 hover
  border:"#2D3A52",   // slate-700/800 borde fino
  accent:"#FFD700", orange:"#FF8C00",
  red:"#FF4455", green:"#00D68F", blue:"#3B82F6", purple:"#8B5CF6",
  cyan:"#06B6D4", pink:"#EC4899",
  text:"#E8EDF5",     // slate-100 — blanco suave, no cegador
  muted:"#5A6A8A",    // slate-500
  mutedL:"#8899BB",   // slate-400
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
  "Electricista","Fontanero","Cerrajero","Desatascos y Camión Cuba","Técnico de Gas","Climatización",
  "Albañil","Pintor","Carpintero","Reformas Integrales","Soldador","Instalador Solar",
  "Yesero","Techador","Montador de Pladur","Parquetista / Pulidor de Suelos","Cristalero",
  "Manitas a Domicilio","Jardinero","Fumigador","Tapicero","Mecánico",
  "Mudanzas y Portes","Servicio Doméstico / Limpieza","Limpieza de Cristales y Fachadas",
  "Informático / Reparación de PC","Configuración de Domótica y WiFi","Instalador de Antenas y Satélite",
  "Cuidado de Mayores y Dependientes","Niñera / Babysitter",
  "Fisioterapeuta a Domicilio","Peluquería y Estética a Domicilio",
  "Peluquería Canina a Domicilio","Cuidador / Paseador de Perros","Adiestrador Canino","Veterinario a Domicilio",
  "Cocinero","Zapatero","Montador de Estructuras",
  "Ceramista / Alfarero","Bordador de Oro y Seda","Orfebre","Guarnicionero",
  "Costurero/a Flamenca","Lutier","Imaginero / Escultor","Abaniquero",
  "Encuadernador Artesanal","Tallista de Castañuelas","Otros servicios",
];

const OFICIOS_TOP = [
  "Fontanero","Electricista","Cerrajero","Manitas a Domicilio",
  "Pintor","Albañil","Reformas Integrales","Climatización",
  "Servicio Doméstico / Limpieza","Jardinero","Peluquería Canina a Domicilio","Desatascos y Camión Cuba",
];

const OFICIO_CATEGORIES: Record<string,string> = {
  "Electricista":"⚡ Técnico","Fontanero":"🔧 Técnico","Cerrajero":"🔑 Técnico",
  "Desatascos y Camión Cuba":"🌊 Técnico","Técnico de Gas":"🔩 Técnico","Climatización":"❄️ Técnico",
  "Albañil":"🧱 Obras","Pintor":"🖌️ Obras","Carpintero":"🪵 Obras",
  "Reformas Integrales":"🏗️ Obras","Soldador":"🔥 Obras","Instalador Solar":"☀️ Obras",
  "Yesero":"🏛️ Obras","Techador":"🏠 Obras","Montador de Pladur":"📐 Obras",
  "Parquetista / Pulidor de Suelos":"✨ Obras","Cristalero":"💎 Obras",
  "Manitas a Domicilio":"🔨 Servicios","Jardinero":"🌿 Servicios","Fumigador":"🪲 Servicios",
  "Tapicero":"🪑 Servicios","Mecánico":"🚗 Servicios","Mudanzas y Portes":"📦 Servicios",
  "Servicio Doméstico / Limpieza":"🧹 Servicios","Limpieza de Cristales y Fachadas":"🪟 Servicios",
  "Informático / Reparación de PC":"💻 Tecnología","Configuración de Domótica y WiFi":"🌐 Tecnología",
  "Instalador de Antenas y Satélite":"📡 Tecnología",
  "Cuidado de Mayores y Dependientes":"👵 Cuidados","Niñera / Babysitter":"👶 Cuidados",
  "Fisioterapeuta a Domicilio":"💆‍♂️ Cuidados","Peluquería y Estética a Domicilio":"💇‍♀️ Cuidados",
  "Peluquería Canina a Domicilio":"✂️ Mascotas","Cuidador / Paseador de Perros":"🐕 Mascotas",
  "Adiestrador Canino":"🦮 Mascotas","Veterinario a Domicilio":"🩺 Mascotas",
  "Cocinero":"👨‍🍳 Hostelería","Zapatero":"👟 Servicios","Montador de Estructuras":"🎪 Eventos",
  "Ceramista / Alfarero":"🏺 Artesanía","Bordador de Oro y Seda":"🧵 Artesanía",
  "Orfebre":"💍 Artesanía","Guarnicionero":"🐴 Artesanía",
  "Costurero/a Flamenca":"💃 Artesanía","Lutier":"🎸 Artesanía",
  "Imaginero / Escultor":"⛪ Artesanía","Abaniquero":"🪭 Artesanía",
  "Encuadernador Artesanal":"📚 Artesanía","Tallista de Castañuelas":"🎵 Artesanía",
  "Otros servicios":"🛠️ Servicios",
};

const OFICIO_ICONS: Record<string,string> = {
  "Electricista":"⚡","Fontanero":"🔧","Cerrajero":"🔑","Desatascos y Camión Cuba":"🌊",
  "Técnico de Gas":"🔩","Climatización":"❄️","Albañil":"🧱","Pintor":"🖌️",
  "Carpintero":"🪵","Reformas Integrales":"🏗️","Soldador":"🔥","Instalador Solar":"☀️",
  "Yesero":"🏛️","Techador":"🏠","Montador de Pladur":"📐",
  "Parquetista / Pulidor de Suelos":"✨","Cristalero":"💎",
  "Manitas a Domicilio":"🔨","Jardinero":"🌿","Fumigador":"🪲",
  "Tapicero":"🪑","Mecánico":"🚗","Mudanzas y Portes":"📦",
  "Servicio Doméstico / Limpieza":"🧹","Limpieza de Cristales y Fachadas":"🪟",
  "Informático / Reparación de PC":"💻","Configuración de Domótica y WiFi":"🌐",
  "Instalador de Antenas y Satélite":"📡",
  "Cuidado de Mayores y Dependientes":"👵","Niñera / Babysitter":"👶",
  "Fisioterapeuta a Domicilio":"💆‍♂️","Peluquería y Estética a Domicilio":"💇‍♀️",
  "Peluquería Canina a Domicilio":"✂️","Cuidador / Paseador de Perros":"🐕",
  "Adiestrador Canino":"🦮","Veterinario a Domicilio":"🩺","Cocinero":"👨‍🍳",
  "Zapatero":"👟","Montador de Estructuras":"🎪",
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
  contacts: {gratis:5, basico:20, pro:9999, elite:9999} as Record<Plan,number>,
  photos: {gratis:0, basico:5, pro:20, elite:999} as Record<Plan,boolean|number>,
  ranking: {gratis:false, basico:false, pro:true, elite:true} as Record<Plan,boolean>,
  chat: {gratis:false, basico:true, pro:true, elite:true} as Record<Plan,boolean>,
};

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

async function compressImage(file:File, maxWidth=1200, quality=0.82):Promise<File>{
  return new Promise(resolve=>{
    const img=new Image();
    const url=URL.createObjectURL(file);
    img.onload=()=>{
      const ratio=Math.min(1,maxWidth/img.width);
      const canvas=document.createElement("canvas");
      canvas.width=img.width*ratio;
      canvas.height=img.height*ratio;
      const ctx=canvas.getContext("2d");
      if(!ctx){resolve(file);return;}
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      canvas.toBlob(blob=>{
        if(!blob){resolve(file);return;}
        resolve(new File([blob],file.name,{type:"image/jpeg"}));
      },"image/jpeg",quality);
      URL.revokeObjectURL(url);
    };
    img.onerror=()=>resolve(file);
    img.src=url;
  });
}

async function uploadImage(file:File, path:string):Promise<string|null>{
  const compressed=await compressImage(file);
  const fileName=path+"/"+Date.now()+".jpg";
  const {error}=await db.storage.from("photos").upload(fileName, compressed, {contentType:"image/jpeg", upsert:true});
  if(error){console.error("Upload error:",error);return null;}
  return STORAGE_URL+fileName;
}

// ── NEW: send urgent lead notification to pro via a special system message ──
async function notifyProOfNewLead(proId:string, clientName:string, oficio:string):Promise<void>{
  const txt=`🔴 *NUEVO CLIENTE INTERESADO*\n\n👤 ${clientName} quiere contactarte para tu servicio de ${oficio}.\n\n⚡ Responde cuanto antes para no perder este lead.`;
  await db.from("messages").insert({
    from_id:"00000000-0000-0000-0000-000000000001",
    to_id:proId,
    text:txt,
    read:false,
    is_lead_alert:true,
  });
}

function showPushNotification(title:string, body:string):void{
  // 1. Si tiene permiso → notificación nativa del sistema
  if("Notification" in window && Notification.permission==="granted"){
    // Intentar via Service Worker primero (funciona con móvil bloqueado)
    if("serviceWorker" in navigator){
      navigator.serviceWorker.ready.then(sw=>{
        sw.showNotification(title,{
          body,
          icon:"/icon-192.png",
          badge:"/icon-192.png",
          vibrate:[200,100,200],
          requireInteraction:true,
          tag:"officioya-notif",
        } as any).catch(()=>{
          // Fallback: notificación directa
          new Notification(title,{body,icon:"/icon-192.png"});
        });
      }).catch(()=>{
        new Notification(title,{body,icon:"/icon-192.png"});
      });
    } else {
      new Notification(title,{body,icon:"/icon-192.png"});
    }
  }
}
const wColor=(id:string)=>[C.purple,C.blue,C.pink,"#10B981",C.orange,C.cyan][id.charCodeAt(id.length-1)%6];
function trialDaysLeft(t:string){return Math.max(0,Math.ceil((new Date(t).getTime()-Date.now())/86400000));}
function timeAgo(iso:string){
  const d=(Date.now()-new Date(iso).getTime())/1000;
  if(d<60)return"ahora";if(d<3600)return Math.floor(d/60)+"m";
  if(d<86400)return Math.floor(d/3600)+"h";return Math.floor(d/86400)+"d";
}
function formatTime(iso:string){
  return new Date(iso).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
}
function isSameDay(a:string,b:string){
  const da=new Date(a), db2=new Date(b);
  return da.getFullYear()===db2.getFullYear()&&da.getMonth()===db2.getMonth()&&da.getDate()===db2.getDate();
}
function formatDateLabel(iso:string){
  const d=new Date(iso);
  const today=new Date();
  if(isSameDay(iso,today.toISOString()))return "Hoy";
  const yesterday=new Date(today); yesterday.setDate(today.getDate()-1);
  if(isSameDay(iso,yesterday.toISOString()))return "Ayer";
  return d.toLocaleDateString("es-ES",{day:"numeric",month:"long"});
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
function InstallBanner(){
  const [show,setShow]=useState(false);
  const [deferredPrompt,setDeferredPrompt]=useState<any>(null);

  useEffect(()=>{
    // Ya instalada o ya cerrada → no mostrar
    if(localStorage.getItem("oy_install_dismissed"))return;
    if(window.matchMedia("(display-mode: standalone)").matches)return;

    const handler=(e:any)=>{
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt",handler);
    return()=>window.removeEventListener("beforeinstallprompt",handler);
  },[]);

  const install=async()=>{
    if(!deferredPrompt)return;
    deferredPrompt.prompt();
    const {outcome}=await deferredPrompt.userChoice;
    if(outcome==="accepted"){
      // Pedir permisos de notificaciones tras instalar
      if("Notification" in window){
        await Notification.requestPermission();
      }
    }
    setShow(false);
    localStorage.setItem("oy_install_dismissed","1");
  };

  const dismiss=()=>{
    setShow(false);
    localStorage.setItem("oy_install_dismissed","1");
  };

  if(!show)return null;

  return(
    <div style={{
      position:"fixed",bottom:72,left:12,right:12,zIndex:300,
      background:"linear-gradient(135deg,#14141F,#0d0d1a)",
      border:"1px solid #FFD70044",
      borderRadius:16,padding:"14px 16px",
      boxShadow:"0 -4px 30px rgba(255,215,0,0.12)",
      display:"flex",alignItems:"center",gap:12,
      animation:"slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)",
    }}>
      <div style={{width:40,height:40,borderRadius:10,background:"linear-gradient(135deg,#FFD700,#FF8C00)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🔨</div>
      <div style={{flex:1,minWidth:0}}>
        <p style={{fontWeight:800,color:"#F0F0FA",fontSize:13,margin:0,lineHeight:1.3}}>Instala OfficioYa</p>
        <p style={{fontSize:11,color:"#7777AA",margin:"2px 0 0"}}>Recibe alertas aunque el móvil esté bloqueado</p>
      </div>
      <button onClick={install} style={{
        background:"linear-gradient(135deg,#FFD700,#FF8C00)",
        border:"none",borderRadius:8,padding:"8px 14px",
        color:"#000",fontFamily:"'DM Sans',sans-serif",
        fontWeight:800,fontSize:12,cursor:"pointer",
        whiteSpace:"nowrap" as const,flexShrink:0,
      }}>
        Instalar
      </button>
      <button onClick={dismiss} style={{background:"none",border:"none",color:"#44445A",cursor:"pointer",fontSize:18,padding:"0 2px",flexShrink:0}}>✕</button>
      <style>{`@keyframes slideUp{from{transform:translateY(100px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
}
function LegalFooter(){
  return(
    <div style={{padding:"24px 20px",borderTop:"1px solid #1E1E30",textAlign:"center" as const,background:"#080810",marginTop:40}}>
      <p style={{fontSize:12,color:"#44445A",marginBottom:10}}>© {new Date().getFullYear()} OfficioYa. Todos los derechos reservados.</p>
      <div style={{display:"flex",justifyContent:"center",gap:16,flexWrap:"wrap" as const}}>
        {[["Términos y Condiciones","/terminos"],["Política de Privacidad","/privacidad"],["Política de Cancelación","/cancelacion"]].map(([l,h])=>(
          <a key={l} href={h} style={{color:"#44445A",fontSize:11,textDecoration:"none"}}>{l}</a>
        ))}
      </div>
    </div>
  );
}
function Sheet({children,onClose,title}:{children:React.ReactNode;onClose:()=>void;title?:string}){
  const startY=useRef(0);
  const handleTouchStart=(e:any)=>{startY.current=e.touches[0].clientY;};
  const handleTouchEnd=(e:any)=>{if(e.changedTouches[0].clientY-startY.current>80)onClose();};
  return <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(4,4,12,0.88)",backdropFilter:"blur(16px)",zIndex:500,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
    <div onClick={e=>e.stopPropagation()} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} style={{background:"linear-gradient(170deg,#14141F,#0A0A14)",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto",border:"1px solid "+C.accent+"22",borderBottom:"none",boxShadow:"0 -8px 40px rgba(0,0,0,0.6)"}}>
      <div style={{width:36,height:4,borderRadius:2,background:C.border,margin:"10px auto 0"}} />
      {title&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px 0"}}>
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
  const s:any={width:"100%",background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"11px 14px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none",boxSizing:"border-box"};
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

// ─── URGENT LEAD BANNER (aparece encima de todo, rojo pulsante) ───
function UrgentLeadBanner({msg,onClose,onClick}:{msg:string;onClose:()=>void;onClick:()=>void;}){
  useEffect(()=>{
    if(navigator.vibrate) navigator.vibrate([200,100,200,100,400]);
    const t=setTimeout(onClose,15000);
    return()=>clearTimeout(t);
  },[onClose]);

  return(
    <div style={{
      position:"fixed",top:0,left:0,right:0,zIndex:99999,
      background:"linear-gradient(135deg,#1a0000,#2d0000)",
      borderBottom:"2px solid #FF4444",
      padding:"14px 16px",
      boxShadow:"0 4px 24px #FF444466",
      animation:"pulse 1.5s ease-in-out infinite",
    }}>
      <style>{`@keyframes pulse{0%,100%{box-shadow:0 4px 24px #FF444466}50%{box-shadow:0 4px 40px #FF4444AA}}`}</style>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
        <span style={{fontSize:22}}>🔔</span>
        <div style={{flex:1}}>
          <p style={{fontWeight:900,color:"#FF4444",fontSize:11,textTransform:"uppercase" as const,letterSpacing:"0.1em",margin:0}}>Nuevo cliente</p>
          <p style={{fontWeight:800,color:"#fff",fontSize:15,margin:"2px 0 0",lineHeight:1.3}}>{msg}</p>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#aaa",cursor:"pointer",fontSize:18,padding:4}}>✕</button>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={onClick} style={{
          flex:2,padding:"10px",
          background:"linear-gradient(135deg,#FF4444,#FF6B35)",
          border:"none",borderRadius:10,color:"#fff",
          fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:800,
          cursor:"pointer",boxShadow:"0 4px 12px #FF444444",
        }}>✓ Aceptar y chatear</button>
        <button onClick={onClose} style={{
          flex:1,padding:"10px",
          background:"transparent",border:"1px solid #FF444444",
          borderRadius:10,color:"#FF4444",
          fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,cursor:"pointer",
        }}>Ignorar</button>
      </div>
    </div>
  );
}
    // Leer estado actual del servidor para evitar colisiones
    const {data:job}=await db.from("jobs").select("*").eq("id",jobId).single();
    if(job){
      const lista=job.profesionales_aceptados||[];
      if(lista.length>=4){
        alert("Este trabajo ya tiene 4 profesionales asignados.");
        onClose(); setProcesando(false); return;
      }
      if(lista.includes(proId)){
        onClick(); onClose(); return;
      }
      await db.from("jobs").update({profesionales_aceptados:[...lista,proId]}).eq("id",jobId);
    }
    setProcesando(false);
    onClick();
    onClose();
  };

  return(
    <div style={{
      position:"fixed",bottom:88,right:16,zIndex:20000,
      background:"#111118",border:"2px solid #FF4455",
      borderRadius:16,padding:"16px",maxWidth:320,
      boxShadow:"0 10px 30px rgba(255,68,85,0.35)",
      animation:"urgentPulse 2s ease-in-out infinite",
    }}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(255,68,85,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,animation:"urgentBell 0.5s ease-in-out infinite"}}>🔔</div>
        <div>
          <p style={{fontWeight:900,color:"#FF4455",fontSize:13,margin:0}}>🔴 CLIENTE NUEVO</p>
          {slots<4&&<p style={{fontSize:10,color:"#FF8C00",margin:0}}>⚡ Quedan {slots} de 4 plazas</p>}
        </div>
        <button onClick={e=>{e.stopPropagation();onClose();}} style={{marginLeft:"auto",background:"none",border:"none",color:"#44445A",cursor:"pointer",fontSize:16}}>✕</button>
      </div>
      <p style={{fontSize:12,color:"#F0F0FA",lineHeight:1.6,marginBottom:14,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical" as any}}>{msg.replace("🔴 *NUEVO CLIENTE INTERESADO*\n\n","")}</p>
      <div style={{display:"flex",gap:8}}>
        <button onClick={aceptar} disabled={procesando} style={{flex:1,background:"#00D68F",color:"#000",border:"none",borderRadius:8,padding:"9px",fontWeight:800,fontSize:13,cursor:procesando?"not-allowed":"pointer",opacity:procesando?0.6:1}}>
          {procesando?"Conectando...":"✓ Aceptar y chatear"}
        </button>
        <button onClick={onClose} style={{background:"transparent",color:"#44445A",border:"1px solid #1E1E30",borderRadius:8,padding:"9px 12px",cursor:"pointer",fontSize:12}}>
          Ignorar
        </button>
      </div>
    </div>
  );
}

// ─── IN-APP NOTIFICATION (normal, desde arriba) ───
function InAppNotification({msg,from,onClose,onClick,isAdmin=false}:{msg:string;from:string;onClose:()=>void;onClick:()=>void;isAdmin?:boolean}){
  useEffect(()=>{const t=setTimeout(onClose,6000);return()=>clearTimeout(t);},[onClose]);
  const borderColor=isAdmin?C.orange:C.accent;
  const icon=isAdmin?"👑":"💬";
  return(
    <div onClick={onClick} style={{
      position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:10000,
      background:"linear-gradient(135deg,#1A1A2E,#12121E)",
      border:"1px solid "+borderColor+"66",
      borderRadius:16,padding:"12px 16px",display:"flex",gap:12,alignItems:"center",
      boxShadow:"0 8px 32px rgba(0,0,0,0.7),0 0 0 1px "+borderColor+"22",
      cursor:"pointer",maxWidth:"calc(100vw - 32px)",width:360,
      animation:"slideDownNotif 0.35s cubic-bezier(0.34,1.56,0.64,1)",
    }}>
      <div style={{width:40,height:40,borderRadius:"50%",background:"linear-gradient(135deg,"+borderColor+"33,"+borderColor+"18)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,border:"1px solid "+borderColor+"33"}}>{icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <p style={{fontSize:11,fontWeight:800,color:borderColor,marginBottom:2}}>{from}</p>
        <p style={{fontSize:13,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{msg}</p>
      </div>
      <button onClick={e=>{e.stopPropagation();onClose();}} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16,padding:"0 4px",flexShrink:0}}>✕</button>
    </div>
  );
}

// ─── LEADS COUNTER ───
function LeadsCounter({user,onUpgrade}:{user:UserRow;onUpgrade:()=>void}){
  const [used,setUsed]=useState(0);
  const limit=PLAN_GATES.contacts[user.plan as Plan];
  useEffect(()=>{getLeadsThisMonth(user.id).then(setUsed);},[user.id]);
  const pct=limit>=9999?0:Math.min(100,Math.round((used/limit)*100));
  const isUnlimited=limit>=9999;
  const isWarning=!isUnlimited&&pct>=80;
  return(
    <GCard style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <p style={{fontWeight:700,color:C.text,fontSize:13}}>📊 Contactos este mes</p>
        <span style={{fontSize:12,fontWeight:700,color:isUnlimited?C.green:isWarning?C.orange:C.muted}}>{isUnlimited?"Ilimitados":used+"/"+limit}</span>
      </div>
      {!isUnlimited&&(
        <div style={{height:6,background:C.border,borderRadius:99,overflow:"hidden",marginBottom:8}}>
          <div style={{height:"100%",width:pct+"%",background:isWarning?"linear-gradient(90deg,"+C.orange+","+C.red+")":"linear-gradient(90deg,"+C.accent+","+C.green+")",borderRadius:99,transition:"width 0.5s"}} />
        </div>
      )}
      {isWarning&&(
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <p style={{fontSize:11,color:C.orange}}>⚠️ Casi sin contactos disponibles</p>
          <button onClick={onUpgrade} style={{fontSize:11,color:C.accent,background:"none",border:"none",cursor:"pointer",fontWeight:700,padding:0}}>Mejorar plan →</button>
        </div>
      )}
    </GCard>
  );
}

// ─── TYPING INDICATOR ───
function TypingIndicator(){
  return(
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0"}}>
      <div style={{display:"flex",gap:4,padding:"10px 14px",background:C.card,borderRadius:"16px 16px 16px 2px",border:"1px solid "+C.border}}>
        {[0,1,2].map(i=>(
          <div key={i} style={{width:6,height:6,borderRadius:"50%",background:C.muted,animation:`typingDot 1.2s ease-in-out ${i*0.2}s infinite`}} />
        ))}
      </div>
    </div>
  );
}

// ─── CHAT FULL-SCREEN — iPhone style ───
function ChatPanel({toUser,currentUser,onClose}:{toUser:UserRow;currentUser:UserRow;onClose:()=>void}){
  const [msgs,setMsgs]=useState<MessageRow[]>([]);
  const [input,setInput]=useState("");
  const [sending,setSending]=useState(false);
  const [isTyping,setIsTyping]=useState(false);
  const [showVisitForm,setShowVisitForm]=useState(false);
  const [showAnticipoForm,setShowAnticipoForm]=useState(false);
  const [showSolicitarAnticipo,setShowSolicitarAnticipo]=useState(false);
  const [anticipoAmount,setAnticipoAmount]=useState("");
  const [anticipoMotivo,setAnticipoMotivo]=useState("");
  const [procesandoAnticipo,setProcesandoAnticipo]=useState(false);
  const [visitDate,setVisitDate]=useState("");
  const [visitSlot,setVisitSlot]=useState<"mañana"|"tarde">("mañana");
  const [visitDesc,setVisitDesc]=useState("");
  const [sendingVisit,setSendingVisit]=useState(false);
  const [inputFocused,setInputFocused]=useState(false);
  const bottomRef=useRef<HTMLDivElement>(null);
  const inputRef=useRef<HTMLInputElement>(null);
  const col=wColor(toUser.id);
  const startX=useRef(0);
  const typingTimer=useRef<any>(null);

  const isSystem=toUser.id==="00000000-0000-0000-0000-000000000001"||toUser.id==="00000000-0000-0000-0000-000000000002";
  const displayColor=isSystem?C.orange:col;

  const loadMsgs=useCallback(async()=>{
    const {data}=await db.from("messages").select("*")
      .or("and(from_id.eq."+currentUser.id+",to_id.eq."+toUser.id+"),and(from_id.eq."+toUser.id+",to_id.eq."+currentUser.id+")")
      .order("created_at",{ascending:true});
    if(data&&data.length>0){setMsgs(data as MessageRow[]);}
    else if(!isSystem){
      setMsgs([{id:"w0",from_id:toUser.id,to_id:currentUser.id,text:"¡Hola! Soy "+toUser.name+". ¿En qué puedo ayudarte?",read:true,created_at:new Date().toISOString()} as MessageRow]);
    }
  },[currentUser.id,toUser.id,toUser.name,isSystem]);

  useEffect(()=>{
    loadMsgs();
    // ── Marcar TODOS los mensajes de esta conv como leídos al abrir ──
    db.from("messages")
      .update({read:true})
      .eq("to_id",currentUser.id)
      .eq("from_id",toUser.id)
      .eq("read",false)
      .then(()=>{});

    const channelName="chat-"+[currentUser.id,toUser.id].sort().join("-");
    const channel=db.channel(channelName)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"to_id=eq."+currentUser.id},(payload:any)=>{
        const m=payload.new as MessageRow;
        if(m.from_id===toUser.id){
          setMsgs(prev=>{
            if(prev.find(x=>x.id===m.id))return prev;
            return [...prev,m];
          });
          setIsTyping(false);
          // Marcar como leído inmediatamente al recibir en chat abierto
          db.from("messages").update({read:true}).eq("id",m.id).then(()=>{});
          showPushNotification("💬 "+toUser.name,m.text.substring(0,80));
        }
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages",filter:"from_id=eq."+currentUser.id},(payload:any)=>{
        const m=payload.new as MessageRow;
        // Actualizar estado leído de mensajes propios (doble check)
        setMsgs(prev=>prev.map(x=>x.id===m.id?{...x,read:m.read}:x));
      })
      .subscribe();
    const poll=setInterval(()=>loadMsgs(),2000);
    return ()=>{db.removeChannel(channel);clearInterval(poll);};
  },[loadMsgs,currentUser.id,toUser.id,toUser.name]);

  useEffect(()=>{
    setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:"smooth"}),80);
  },[msgs.length]);

  const handleInput=(v:string)=>{
    setInput(v);
    // Simulate "typing" to other user (in a real app you'd broadcast this)
    clearTimeout(typingTimer.current);
  };

  const send=async()=>{
    if(!input.trim()||sending)return;
    const txt=input.trim();
    setInput("");
    setSending(true);
    const tempId="tmp-"+Date.now();
    const tempMsg:MessageRow={id:tempId,from_id:currentUser.id,to_id:toUser.id,text:txt,read:false,created_at:new Date().toISOString()} as any;
    setMsgs(prev=>[...prev,tempMsg]);
    await db.from("messages").insert({from_id:currentUser.id,to_id:toUser.id,text:txt,read:false});
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown=(e:React.KeyboardEvent)=>{
    if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}
  };

  const handleTouchStart=(e:React.TouchEvent)=>{startX.current=e.touches[0].clientX;};
  const handleTouchEnd=(e:React.TouchEvent)=>{if(e.changedTouches[0].clientX-startX.current>80)onClose();};

  const groupedMsgs=msgs.reduce((acc:(MessageRow|{type:"date";label:string})[],m,i)=>{
    if(i===0||!isSameDay(m.created_at,msgs[i-1].created_at)){
      acc.push({type:"date",label:formatDateLabel(m.created_at)});
    }
    acc.push(m);
    return acc;
  },[]);

  // Detect lead alert messages
  const isLeadAlert=(text:string)=>text.includes("NUEVO CLIENTE INTERESADO")||text.includes("is_lead_alert");
  const isAnticipoMsg=(text:string)=>text.includes("ANTICIPO_PAGADO:")||text.includes("ANTICIPO_SOLICITADO:");

  return(
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
      style={{position:"fixed",inset:0,background:C.bg,zIndex:600,display:"flex",flexDirection:"column",animation:"slideInFromRight 0.3s cubic-bezier(0.34,1.56,0.64,1)"}}>

      {/* ── iPhone-style header ── */}
      <div style={{
        padding:"10px 12px 10px",borderBottom:"1px solid "+C.border+"66",
        background:"rgba(10,10,15,0.85)",backdropFilter:"blur(24px) saturate(180%)",
        display:"flex",alignItems:"center",gap:10,flexShrink:0,
        boxShadow:"0 1px 0 rgba(255,255,255,0.04)",
        paddingTop:"max(10px, env(safe-area-inset-top))",
      }}>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.blue,cursor:"pointer",fontSize:16,padding:"4px 6px 4px 0",display:"flex",alignItems:"center",gap:4,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none"><path d="M8.5 1.5L1.5 8L8.5 14.5" stroke={C.blue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Atrás
        </button>

        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",cursor:"pointer"}}>
          <div style={{position:"relative",marginBottom:2}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,"+displayColor+"66,"+displayColor+"33)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:13,border:"1.5px solid "+displayColor+"55"}}>
              {isSystem?"🛡":toUser.name.substring(0,2).toUpperCase()}
            </div>
            {toUser.available&&!isSystem&&<div style={{position:"absolute",bottom:0,right:0,width:9,height:9,borderRadius:"50%",background:C.green,border:"2px solid "+C.bg}} />}
          </div>
          <p style={{fontWeight:700,fontSize:14,color:C.text,lineHeight:1}}>{isSystem?"OfficioYa Soporte":toUser.name}</p>
          <p style={{fontSize:10,color:isTyping?C.green:toUser.available?C.green:C.muted,transition:"color 0.3s"}}>
            {isTyping?"escribiendo...":(isSystem?"Soporte oficial":toUser.available?"En línea":"Última vez "+timeAgo(new Date().toISOString()))}
          </p>
        </div>

        {!isSystem&&(
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>setShowVisitForm(!showVisitForm)} style={{
              padding:"7px 11px",background:showVisitForm?C.accent+"22":"transparent",
              border:"1px solid "+(showVisitForm?C.accent+"66":C.border+"66"),
              borderRadius:10,color:showVisitForm?C.accent:C.mutedL,
              cursor:"pointer",fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:700,
            }}>📅 Cita</button>
            {currentUser.type==="cliente"&&(
              <button onClick={()=>setShowAnticipoForm(!showAnticipoForm)} style={{
                padding:"7px 11px",background:showAnticipoForm?"#FFD70022":"transparent",
                border:"1px solid "+(showAnticipoForm?"#FFD70066":C.border+"66"),
                borderRadius:10,color:showAnticipoForm?"#FFD700":C.mutedL,
                cursor:"pointer",fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:700,
              }}>💰 Anticipo</button>
            )}
            {currentUser.type==="profesional"&&(
              <button onClick={()=>setShowSolicitarAnticipo(!showSolicitarAnticipo)} style={{
                padding:"7px 11px",background:showSolicitarAnticipo?"#FFD70022":"transparent",
                border:"1px solid "+(showSolicitarAnticipo?"#FFD70066":C.border+"66"),
                borderRadius:10,color:showSolicitarAnticipo?"#FFD700":C.mutedL,
                cursor:"pointer",fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:700,
              }}>💰 Solicitar anticipo</button>
            )}
          </div>
        )}
      </div>

      {/* Visit form */}
      {showVisitForm&&(
        <div style={{padding:"14px 16px",background:"linear-gradient(135deg,"+C.card+","+C.surface+")",borderBottom:"1px solid "+C.accent+"33",flexShrink:0,animation:"expandDown 0.25s ease"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <p style={{fontSize:13,fontWeight:800,color:C.accent}}>📅 Solicitar visita o cita</p>
            <button onClick={()=>setShowVisitForm(false)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>✕</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <input type="date" value={visitDate} onChange={e=>setVisitDate(e.target.value)} min={new Date().toISOString().split("T")[0]} style={{background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"8px 10px",color:C.text,fontFamily:"inherit",fontSize:13,outline:"none"}} />
            <div style={{display:"flex",gap:5}}>
              {(["mañana","tarde"] as const).map(s=><button key={s} onClick={()=>setVisitSlot(s)} style={{flex:1,padding:"8px 4px",borderRadius:8,border:"1px solid "+(visitSlot===s?C.accent:C.border),background:visitSlot===s?C.accent+"18":"transparent",color:visitSlot===s?C.accent:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:visitSlot===s?700:400}}>{s==="mañana"?"🌅 Mañana":"🌆 Tarde"}</button>)}
            </div>
          </div>
          <textarea value={visitDesc} onChange={e=>setVisitDesc(e.target.value)} placeholder="Describe el trabajo que necesitas..." rows={2} style={{width:"100%",background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"8px 10px",color:C.text,fontFamily:"inherit",fontSize:13,outline:"none",resize:"none",marginBottom:8,boxSizing:"border-box"}} />
          <button disabled={sendingVisit||!visitDate||!visitDesc.trim()} onClick={async()=>{
            setSendingVisit(true);
            const txt="📅 *Solicitud de visita*\nFecha: "+visitDate+" por la "+visitSlot+"\n\n"+visitDesc;
            await db.from("messages").insert({from_id:currentUser.id,to_id:toUser.id,text:txt,read:false});
            await db.from("jobs").insert({worker_id:toUser.id,client_id:currentUser.id,client_name:currentUser.name,title:"Solicitud de visita · "+visitDate,description:visitDesc,status:"pending"});
            setShowVisitForm(false);setVisitDate("");setVisitDesc("");setSendingVisit(false);
          }} style={{width:"100%",padding:"10px",background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",border:"none",borderRadius:8,color:"#000",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:13,cursor:sendingVisit||!visitDate||!visitDesc.trim()?"not-allowed":"pointer",opacity:sendingVisit||!visitDate||!visitDesc.trim()?0.5:1}}>
            {sendingVisit?"Enviando...":"Enviar solicitud →"}
          </button>
        </div>
      )}

      {/* Formulario anticipo cliente */}
{showAnticipoForm&&(
  <div style={{padding:"14px 16px",background:"linear-gradient(135deg,#1a1a0a,#141208)",borderBottom:"1px solid #FFD70033",flexShrink:0}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
      <p style={{fontSize:13,fontWeight:800,color:"#FFD700"}}>💰 Pagar anticipo a {toUser.name}</p>
      <button onClick={()=>setShowAnticipoForm(false)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>✕</button>
    </div>
    <p style={{fontSize:12,color:C.muted,marginBottom:12}}>Elige el importe — pago seguro procesado por Stripe</p>
    <div style={{display:"flex",gap:8}}>
      <button onClick={async()=>{
        try{
          const res=await fetch("https://rjwojxwrsbvwwshwwpvq.supabase.co/functions/v1/super-handler",{
            method:"POST",
            headers:{
              "Content-Type":"application/json",
              "apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNjMxODcsImV4cCI6MjA2MDczOTE4N30.ywFWMDSEQ4W5BNaEGxBMPBqZ4GW-jGkIjHqMbSiXvUo",
              "Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNjMxODcsImV4cCI6MjA2MDczOTE4N30.ywFWMDSEQ4W5BNaEGxBMPBqZ4GW-jGkIjHqMbSiXvUo",
            },
            body:JSON.stringify({client_id:currentUser.id,pro_id:toUser.id,pro_name:toUser.name,client_name:currentUser.name,amount:15}),
          });
          const {url}=await res.json();
          if(url) window.open(url,"_blank");
        }catch{showToast("Error al generar el pago");}
        setShowAnticipoForm(false);
      }} style={{flex:1,padding:"14px",background:"linear-gradient(135deg,#FFD700,#FF8C00)",border:"none",borderRadius:10,color:"#000",fontFamily:"'DM Sans',sans-serif",fontWeight:800,fontSize:15,cursor:"pointer"}}>
        💰 15€
      </button>
      <button onClick={async()=>{
        try{
          const res=await fetch("https://rjwojxwrsbvwwshwwpvq.supabase.co/functions/v1/super-handler",{
            method:"POST",
            headers:{
              "Content-Type":"application/json",
              "apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNjMxODcsImV4cCI6MjA2MDczOTE4N30.ywFWMDSEQ4W5BNaEGxBMPBqZ4GW-jGkIjHqMbSiXvUo",
              "Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNjMxODcsImV4cCI6MjA2MDczOTE4N30.ywFWMDSEQ4W5BNaEGxBMPBqZ4GW-jGkIjHqMbSiXvUo",
            },
            body:JSON.stringify({client_id:currentUser.id,pro_id:toUser.id,pro_name:toUser.name,client_name:currentUser.name,amount:50}),
          });
          const {url}=await res.json();
          if(url) window.open(url,"_blank");
        }catch{showToast("Error al generar el pago");}
        setShowAnticipoForm(false);
      }} style={{flex:1,padding:"14px",background:"linear-gradient(135deg,#FFD700,#FF8C00)",border:"none",borderRadius:10,color:"#000",fontFamily:"'DM Sans',sans-serif",fontWeight:800,fontSize:15,cursor:"pointer"}}>
        💰 50€
      </button>
    </div>
    <p style={{fontSize:10,color:C.muted,textAlign:"center" as const,marginTop:8}}>🔒 Pago seguro con Stripe · El profesional recibirá confirmación automática</p>
  </div>
)}

     {/* Formulario solicitar anticipo profesional */}
      {showSolicitarAnticipo&&(
        <div style={{padding:"14px 16px",background:"linear-gradient(135deg,#1a1a0a,#141208)",borderBottom:"1px solid #FFD70033",flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <p style={{fontSize:13,fontWeight:800,color:"#FFD700"}}>💰 Solicitar anticipo al cliente</p>
            <button onClick={()=>setShowSolicitarAnticipo(false)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>✕</button>
          </div>
          <p style={{fontSize:12,color:C.muted,marginBottom:12}}>El cliente recibirá un mensaje con el botón de pago directo</p>
          <div style={{display:"flex",gap:8}}>
            <button onClick={async()=>{
              await db.from("messages").insert({from_id:currentUser.id,to_id:toUser.id,text:`💰 ANTICIPO_SOLICITADO:15€:anticipo solicitado por el profesional`,read:false});
              setShowSolicitarAnticipo(false);
              showPushNotification("💰 Anticipo solicitado","Has solicitado un anticipo de 15€ a "+toUser.name);
            }} style={{flex:1,padding:"14px",background:"transparent",border:"2px solid #FFD700",borderRadius:10,color:"#FFD700",fontFamily:"'DM Sans',sans-serif",fontWeight:800,fontSize:15,cursor:"pointer"}}>
              💰 15€
            </button>
            <button onClick={async()=>{
              await db.from("messages").insert({from_id:currentUser.id,to_id:toUser.id,text:`💰 ANTICIPO_SOLICITADO:50€:anticipo solicitado por el profesional`,read:false});
              setShowSolicitarAnticipo(false);
              showPushNotification("💰 Anticipo solicitado","Has solicitado un anticipo de 50€ a "+toUser.name);
            }} style={{flex:1,padding:"14px",background:"transparent",border:"2px solid #FFD700",borderRadius:10,color:"#FFD700",fontFamily:"'DM Sans',sans-serif",fontWeight:800,fontSize:15,cursor:"pointer"}}>
              💰 50€
            </button>
          </div>
        </div>
      )}
      {/* ── Messages area ── */}
      <div style={{
        flex:1,overflowY:"auto",padding:"16px 12px",
        display:"flex",flexDirection:"column",gap:2,
        background:"radial-gradient(ellipse at 50% 0%,#0D0D1A,#0A0A0F)",
      }}>
        {groupedMsgs.map((item:any,i)=>{
          if(item.type==="date"){
            return(
              <div key={"date-"+i} style={{display:"flex",alignItems:"center",gap:8,margin:"12px 0 8px"}}>
                <div style={{flex:1,height:1,background:C.border+"66"}} />
                <span style={{fontSize:11,color:C.muted,background:C.surface,padding:"3px 12px",borderRadius:99,border:"1px solid "+C.border+"66",fontWeight:500}}>{item.label}</span>
                <div style={{flex:1,height:1,background:C.border+"66"}} />
              </div>
            );
          }
          const m=item as MessageRow;
          const isMe=m.from_id===currentUser.id;
          const isAdmin=m.from_id==="00000000-0000-0000-0000-000000000002"||m.from_id==="00000000-0000-0000-0000-000000000001";
          const isLead=isLeadAlert(m.text);
// Anticipo special rendering
          if(isAnticipoMsg(m.text)){
            const isPagado=m.text.includes("ANTICIPO_PAGADO:");
            const isSolicitado=m.text.includes("ANTICIPO_SOLICITADO:");
            const parts=m.text.split(":");
            const amount=parts[1]||"";
            const motivo=isPagado?"":parts[2]||"";
            return(
              <div key={m.id} style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start",marginBottom:6}}>
                <div style={{maxWidth:"80%",background:"linear-gradient(135deg,#1a1a0a,#141208)",border:"2px solid #FFD70066",borderRadius:14,padding:"12px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <span style={{fontSize:20}}>💰</span>
                    <div>
                      <p style={{fontWeight:900,color:"#FFD700",fontSize:13,margin:0}}>{isPagado?"Anticipo pagado":"Solicitud de anticipo"}</p>
                      <p style={{fontSize:12,color:"#aaa",margin:0}}>{amount}{motivo?" · "+motivo:""}</p>
                    </div>
                    {isPagado&&<span style={{marginLeft:"auto",fontSize:10,color:"#00D68F",background:"#00D68F22",padding:"2px 8px",borderRadius:4,fontWeight:700}}>✓ PAGADO</span>}
                  </div>
                  {isSolicitado&&!isMe&&currentUser.type==="cliente"&&(
                    <div>
                      <button onClick={async()=>{
                        try{
                          const res=await fetch("https://rjwojxwrsbvwwshwwpvq.supabase.co/functions/v1/super-handler",{
                            method:"POST",
                            headers:{
                              "Content-Type":"application/json",
                              "apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNjMxODcsImV4cCI6MjA2MDczOTE4N30.ywFWMDSEQ4W5BNaEGxBMPBqZ4GW-jGkIjHqMbSiXvUo",
                              "Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNjMxODcsImV4cCI6MjA2MDczOTE4N30.ywFWMDSEQ4W5BNaEGxBMPBqZ4GW-jGkIjHqMbSiXvUo",
                            },
                            body:JSON.stringify({client_id:currentUser.id,pro_id:m.from_id,pro_name:toUser.name,client_name:currentUser.name,amount:parseInt(amount)}),
                          });
                          const {url}=await res.json();
                          if(url) window.open(url,"_blank");
                        }catch{showToast("Error al generar el pago");}
                      }} disabled={procesandoAnticipo} style={{width:"100%",padding:"8px",background:"linear-gradient(135deg,#FFD700,#FF8C00)",border:"none",borderRadius:8,color:"#000",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:12,cursor:"pointer",marginTop:4}}>
                        💳 Pagar ahora →
                      </button>
                      <div style={{marginTop:8,padding:"8px 10px",background:"rgba(0,214,143,0.08)",border:"1px solid rgba(0,214,143,0.2)",borderRadius:8,display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:14}}>🔒</span>
                        <p style={{fontSize:10,color:"#00D68F",margin:0,lineHeight:1.4}}>Pago 100% seguro · OfficioYa garantiza el servicio</p>
                      </div>
                    </div>
                  )}
                  <p style={{fontSize:9,color:C.muted,marginTop:6,textAlign:isMe?"right":"left" as any}}>{formatTime(m.created_at)}</p>
                </div>
              </div>
            );
          }

          // Lead alert special rendering
          if(isLead&&!isMe){
            return(
              <div key={m.id} style={{margin:"8px 0",animation:"popIn 0.3s ease"}}>
                <div style={{background:"linear-gradient(135deg,#FF1A1A22,#FF443322)",border:"2px solid #FF4455AA",borderRadius:14,padding:"12px 14px",position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",top:-10,right:-10,width:50,height:50,borderRadius:"50%",background:"#FF445522",pointerEvents:"none"}} />
                  <p style={{fontWeight:900,color:C.red,fontSize:13,marginBottom:4}}>🔴 CLIENTE INTERESADO</p>
                  <p style={{fontSize:12,color:C.text,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{m.text.replace("🔴 *NUEVO CLIENTE INTERESADO*\n\n","")}</p>
                  <p style={{fontSize:10,color:C.muted,marginTop:6}}>{formatTime(m.created_at)}</p>
                </div>
              </div>
            );
          }

          // Admin message special rendering
          if(isAdmin&&!isMe){
            return(
              <div key={m.id} style={{margin:"4px 0",animation:"popIn 0.3s ease"}}>
                <div style={{background:"linear-gradient(135deg,"+C.orange+"18,"+C.orange+"08)",border:"1px solid "+C.orange+"44",borderRadius:14,padding:"10px 14px",maxWidth:"85%"}}>
                  <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
                    <span style={{fontSize:12}}>👑</span>
                    <p style={{fontSize:10,fontWeight:800,color:C.orange}}>OfficioYa Soporte</p>
                  </div>
                  <p style={{fontSize:13,color:C.text,lineHeight:1.6}}>{m.text.replace("[Soporte OfficioYa] ","")}</p>
                  <p style={{fontSize:9,color:C.muted,marginTop:4,textAlign:"right"}}>{formatTime(m.created_at)}</p>
                </div>
              </div>
            );
          }

          const prevMsg=i>0?groupedMsgs[i-1]:null;
          const nextMsg=i<groupedMsgs.length-1?groupedMsgs[i+1]:null;
          const prevIsDate=(prevMsg as any)?.type==="date";
          const prevSameSender=!prevIsDate&&prevMsg&&(prevMsg as MessageRow).from_id===m.from_id;
          const nextSameSender=nextMsg&&(nextMsg as any).type!=="date"&&(nextMsg as MessageRow).from_id===m.from_id;

          const bubbleBR={
            topLeft: isMe?14:(prevSameSender?4:14),
            topRight: isMe?(prevSameSender?4:14):14,
            bottomLeft: isMe?14:(nextSameSender?4:14),
            bottomRight: isMe?(nextSameSender?4:14):14,
          };

          return(
            <div key={m.id} style={{
              display:"flex",
              justifyContent:isMe?"flex-end":"flex-start",
              marginBottom:nextSameSender?1:6,
              animation:"popIn 0.25s ease",
            }}>
              {/* Avatar for received messages (only on last in group) */}
              {!isMe&&(
                <div style={{width:28,alignSelf:"flex-end",marginRight:6,flexShrink:0}}>
                  {!nextSameSender&&(
                    <div style={{width:28,height:28,borderRadius:"50%",background:displayColor+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:displayColor}}>
                      {toUser.name[0]}
                    </div>
                  )}
                </div>
              )}

              <div style={{maxWidth:"72%"}}>
                {/* Visit request special bubble */}
                {m.text.includes("*Solicitud de visita*")?(
                  <div style={{
                    background:"linear-gradient(135deg,"+C.accent+"22,"+C.orange+"15)",
                    border:"1px solid "+C.accent+"44",
                    borderRadius:14,padding:"10px 14px",
                  }}>
                    <p style={{fontSize:10,color:C.accent,fontWeight:800,marginBottom:4}}>📅 Solicitud de visita</p>
                    <p style={{fontSize:12,color:C.text,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{m.text.replace("📅 *Solicitud de visita*\n","")}</p>
                    <p style={{fontSize:9,color:C.muted,marginTop:4,textAlign:isMe?"right":"left"}}>{formatTime(m.created_at)}{isMe&&" ✓✓"}</p>
                  </div>
                ):(
                  <div style={{
                    background:isMe
                      ?"linear-gradient(135deg,"+displayColor+"EE,"+displayColor+"CC)"
                      :C.card,
                    border:isMe?"none":"1px solid "+C.border+"88",
                    borderRadius:`${bubbleBR.topLeft}px ${bubbleBR.topRight}px ${bubbleBR.bottomRight}px ${bubbleBR.bottomLeft}px`,
                    padding:"9px 12px",
                    boxShadow:isMe?"0 2px 8px "+displayColor+"33":"0 1px 4px rgba(0,0,0,0.3)",
                    transition:"all 0.15s",
                  }}>
                    <p style={{fontSize:14,color:isMe?"#000":"#E8E8F0",lineHeight:1.55,wordBreak:"break-word"}}>{m.text}</p>
                  </div>
                )}
                {/* Timestamp — only for last in group */}
                {!nextSameSender&&(
                  <p style={{fontSize:10,color:C.muted,marginTop:3,textAlign:isMe?"right":"left",paddingRight:isMe?2:0,paddingLeft:isMe?0:36}}>
                    {formatTime(m.created_at)}
                    {isMe&&<span style={{marginLeft:4,color:m.read?C.blue:C.muted}}>
                      {m.id.startsWith("tmp-")?"·":"✓✓"}
                    </span>}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {isTyping&&(
          <div style={{display:"flex",alignItems:"flex-end",gap:6}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:displayColor+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:displayColor,flexShrink:0}}>{toUser.name[0]}</div>
            <TypingIndicator />
          </div>
        )}

        <div ref={bottomRef} style={{height:8}} />
      </div>

      {/* ── iPhone-style input bar ── */}
      <div style={{
        padding:"8px 12px",
        paddingBottom:"max(12px, env(safe-area-inset-bottom))",
        borderTop:"1px solid "+C.border+"44",
        background:"rgba(10,10,15,0.92)",
        backdropFilter:"blur(24px) saturate(180%)",
        display:"flex",gap:8,alignItems:"flex-end",flexShrink:0,
        transition:"padding 0.2s",
      }}>
        <div style={{
          flex:1,display:"flex",alignItems:"center",
          background:inputFocused?C.card+"EE":C.surface,
          border:"1.5px solid "+(inputFocused?displayColor+"66":C.border+"88"),
          borderRadius:22,padding:"0 14px",
          transition:"all 0.2s",
          boxShadow:inputFocused?"0 0 0 3px "+displayColor+"18":"none",
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e=>handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={()=>setInputFocused(true)}
            onBlur={()=>setInputFocused(false)}
            placeholder="Mensaje..."
            style={{flex:1,padding:"11px 0",background:"transparent",border:"none",color:C.text,fontFamily:"inherit",fontSize:15,outline:"none"}}
            autoComplete="off"
          />
          {input&&(
            <button onClick={()=>setInput("")} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:14,padding:"0 0 0 6px",flexShrink:0}}>✕</button>
          )}
        </div>
        <button
          onClick={send}
          disabled={!input.trim()||sending}
          style={{
            width:44,height:44,flexShrink:0,
            background:input.trim()?"linear-gradient(135deg,"+displayColor+","+displayColor+"BB)":C.surface,
            border:input.trim()?"none":"1px solid "+C.border,
            borderRadius:"50%",
            color:input.trim()?"#000":C.muted,
            cursor:input.trim()?"pointer":"default",
            display:"flex",alignItems:"center",justifyContent:"center",
            transition:"all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
            transform:input.trim()?"scale(1)":"scale(0.9)",
            boxShadow:input.trim()?"0 4px 14px "+displayColor+"44":"none",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── BUSCADOR EXPRESS MODAL ───
// ════════════════════════════════════════════════════════════════
// REEMPLAZA el BuscadorExpressModal completo en tu App.tsx
// Busca: "(" y reemplaza todo el bloque
// ════════════════════════════════════════════════════════════════
function BuscadorExpressModal({workers,onResult,onWorkerSelect,onClose}:{workers:UserRow[];onResult:(oficio:string,zona:string,urgency:string)=>void;onWorkerSelect:(w:UserRow)=>void;onClose:()=>void}){
  const [step,setStep]=useState(1);
  const [selOficio,setSelOficio]=useState("");
  const [selUbicacion,setSelUbicacion]=useState<"sevilla"|"pueblos"|"">("");
  const [selZonas,setSelZonas]=useState<string[]>([]);
  const [textSearch,setTextSearch]=useState("");
  const searchInputRef=useRef<HTMLInputElement>(null);


  useEffect(()=>{
  const opcionTodosLocal=selUbicacion==="sevilla"?"Todo Sevilla":"Todos los pueblos";
    const handleKey=(e:KeyboardEvent)=>{
      if(e.key!=="Enter")return;
      if(step===1&&selOficio)setStep(2);
      if(step===2&&selUbicacion)setStep(3);
      if(step===3){if(selZonas.length===0)toggleZona(opcionTodosLocal);setStep(4);}
    };
    window.addEventListener("keydown",handleKey);
    return()=>window.removeEventListener("keydown",handleKey);
  },[step,selOficio,selUbicacion,selZonas]);

  useEffect(()=>{setTimeout(()=>searchInputRef.current?.focus(),120);},[]);

  const BARRIOS_SEVILLA=[
    "Todo Sevilla",
    "Centro / Casco Antiguo","Triana","Los Remedios","Nervión","La Macarena",
    "San Pablo / Santa Justa","Bellavista / La Palmera","Cerro-Amate","Sur",
    "Este / Alcosa / Torreblanca","Norte",
  ];

  const PUEBLOS=[
    "Todos los pueblos",
    "Camas","Dos Hermanas","Alcalá de Guadaíra","Mairena del Aljarafe",
    "San Juan de Aznalfarache","Bormujos","Tomares","Gelves","La Rinconada",
    "Alcalá del Río","Brenes","Carmona","Écija","Utrera","Morón de la Frontera",
    "Lebrija","Las Cabezas de San Juan","Marchena","Osuna","Estepa",
  ];

  const URGENCY_OPTS=[
    {id:"urgente",icon:"🔴",title:"¡Urgencia ahora!",sub:"Avería crítica · Lo necesito hoy",border:C.red,bg:C.red+"15"},
    {id:"semana",icon:"🟡",title:"Esta semana",sub:"Tengo unos días de margen",border:C.orange,bg:C.orange+"12"},
    {id:"presupuesto",icon:"🟢",title:"Solo presupuesto",sub:"Proyecto o consulta sin prisa",border:C.green,bg:C.green+"10"},
  ];

  const listaZonas = selUbicacion==="sevilla" ? BARRIOS_SEVILLA : PUEBLOS;
  const opcionTodos = selUbicacion==="sevilla" ? "Todo Sevilla" : "Todos los pueblos";
  const zonasReales = listaZonas.filter(z=>z!==opcionTodos);

  const toggleZona=(z:string)=>{
    if(z===opcionTodos){
      if(selZonas.length===zonasReales.length) setSelZonas([]);
      else setSelZonas(zonasReales);
      return;
    }
    setSelZonas(prev=>prev.includes(z)?prev.filter(x=>x!==z):[...prev,z]);
  };

  const todosSeleccionados = selZonas.length===zonasReales.length;

  const filteredBySearch=OFICIOS.filter(o=>!textSearch||o.toLowerCase().includes(textSearch.toLowerCase()));
  const handleSelectOficio=(o:string)=>{setSelOficio(o);setStep(2);};
  const handleSelectUrgency=async(id:string)=>{
    const zonaFinal = selZonas.length===0||todosSeleccionados
      ? (selUbicacion==="sevilla"?"Sevilla (toda)":"Área metropolitana (toda)")
      : selZonas.join(", ");
    onResult(selOficio,zonaFinal,id);
    onClose();
  };

  const grouped=OFICIOS.reduce((acc:Record<string,string[]>,o)=>{
    const cat=(OFICIO_CATEGORIES[o]||"🛠️ Servicios").split(" ").slice(1).join(" ")||"Otros";
    if(!acc[cat])acc[cat]=[];
    acc[cat].push(o);
    return acc;
  },{});

  const stepTitles={
    1:"¿Qué profesional necesitas?",
    2:"¿Dónde lo necesitas?",
    3:selUbicacion==="sevilla"?"¿En qué barrio?":"¿En qué pueblo?",
    4:"¿Con qué urgencia?",
  };

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(4,4,12,0.85)",backdropFilter:"blur(16px)",zIndex:800,display:"flex",alignItems:"flex-start",justifyContent:"center"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(170deg,#14141F,#0A0A14)",width:"100%",maxWidth:520,height:"100dvh",borderRight:"1px solid "+C.accent+"22",boxShadow:"8px 0 40px rgba(0,0,0,0.8)",display:"flex",flexDirection:"column",overflowY:"hidden"}}>

        {/* Header */}
        <div style={{padding:"14px 18px",borderBottom:"1px solid "+C.border+"44",display:"flex",alignItems:"center",gap:10,flexShrink:0,background:"rgba(10,10,15,0.95)",backdropFilter:"blur(20px)"}}>
          <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>⚡</div>
          <div style={{flex:1}}>
            <p style={{fontWeight:900,color:C.text,fontSize:15,lineHeight:1}}>{stepTitles[step as keyof typeof stepTitles]}</p>
            <p style={{fontSize:10,color:C.muted,marginTop:2}}>Paso {step} de 4{selOficio?" · "+selOficio:""}</p>
          </div>
          {/* Stepper dots */}
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            {[1,2,3,4].map(s=><div key={s} style={{width:s===step?18:6,height:5,borderRadius:99,background:s<=step?C.accent:C.border,transition:"all 0.3s"}} />)}
          </div>
          <button onClick={onClose} style={{background:"none",border:"1px solid "+C.border+"66",borderRadius:8,color:C.muted,cursor:"pointer",padding:"5px 10px",fontSize:13,flexShrink:0}}>✕</button>
        </div>

        {/* Contenido */}
        <div style={{flex:1,overflowY:"auto",padding:"18px"}}>

          {/* ── PASO 1: OFICIO ── */}
          {step===1&&(<>
            <div style={{display:"flex",background:C.bg,borderRadius:12,border:"1px solid "+C.accent+"33",overflow:"hidden",marginBottom:18,boxShadow:"0 4px 16px rgba(0,0,0,0.3)"}}>
              <span style={{padding:"0 14px",display:"flex",alignItems:"center",color:C.accent,fontSize:16}}>🔍</span>
              <input ref={searchInputRef} autoFocus value={textSearch} onChange={e=>setTextSearch(e.target.value)}
                placeholder="Electricista, fontanero, pintor..."
                style={{flex:1,padding:"13px 0",background:"transparent",border:"none",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none"}}
              />
              {textSearch&&<button onClick={()=>setTextSearch("")} style={{padding:"0 14px",background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:14}}>✕</button>}
            </div>

            {!textSearch&&(<>
              <p style={{fontSize:10,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.1em",fontWeight:800,marginBottom:10}}>🔥 Los más solicitados</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:22}}>
                {OFICIOS_TOP.map(o=>(
                  <button key={o} onClick={()=>handleSelectOficio(o)} style={{padding:"12px 4px",borderRadius:14,border:"1px solid "+C.border+"88",background:"linear-gradient(135deg,"+C.card+","+C.surface+")",color:C.text,cursor:"pointer",fontFamily:"inherit",textAlign:"center" as const,transition:"all 0.18s",display:"flex",flexDirection:"column" as const,alignItems:"center",gap:5}}>
                    <div style={{fontSize:22}}>{OFICIO_ICONS[o]||"🔧"}</div>
                    <p style={{fontSize:9,fontWeight:700,lineHeight:1.3,color:C.text}}>{o}</p>
                  </button>
                ))}
              </div>
              <p style={{fontSize:10,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.1em",fontWeight:800,marginBottom:12}}>Todos los servicios · {OFICIOS.length}</p>
              {Object.entries(grouped).map(([catName,oficios])=>{
                const catIcon=Object.entries(OFICIO_CATEGORIES).find(([,v])=>v.split(" ").slice(1).join(" ")===catName)?.[1]?.split(" ")[0]||"🔧";
                return(
                  <div key={catName} style={{marginBottom:18}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,paddingLeft:2}}>
                      <span style={{fontSize:13}}>{catIcon}</span>
                      <p style={{fontSize:10,color:C.mutedL,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase" as const}}>{catName}</p>
                    </div>
                    <div style={{display:"flex",flexDirection:"column" as const,gap:3}}>
                      {oficios.map(o=>(
                        <button key={o} onClick={()=>handleSelectOficio(o)} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderRadius:10,border:"1px solid "+C.border+"44",background:C.bg,color:C.text,cursor:"pointer",fontFamily:"inherit",textAlign:"left" as const,transition:"all 0.15s"}}>
                          <span style={{fontSize:18,flexShrink:0,width:26,textAlign:"center" as const}}>{OFICIO_ICONS[o]||"🔧"}</span>
                          <span style={{fontSize:13,fontWeight:600,flex:1}}>{o}</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>)}

            {textSearch&&(<>
              <p style={{fontSize:10,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.1em",fontWeight:800,marginBottom:10}}>Resultados · {filteredBySearch.length}</p>
              <div style={{display:"flex",flexDirection:"column" as const,gap:4}}>
                {filteredBySearch.map(o=>(
                  <button key={o} onClick={()=>handleSelectOficio(o)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,border:"1px solid "+C.border+"66",background:C.bg,color:C.text,cursor:"pointer",fontFamily:"inherit",textAlign:"left" as const,transition:"all 0.15s"}}>
                    <span style={{fontSize:20,flexShrink:0}}>{OFICIO_ICONS[o]||"🔧"}</span>
                    <div style={{flex:1}}>
                      <span style={{fontSize:13,fontWeight:600}}>{o}</span>
                      <p style={{fontSize:10,color:C.muted,marginTop:1}}>{OFICIO_CATEGORIES[o]||""}</p>
                    </div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                ))}
                {filteredBySearch.length===0&&(
                  <div style={{textAlign:"center" as const,padding:"32px 20px",color:C.muted}}>
                    <p style={{fontSize:32,marginBottom:8}}>🔍</p>
                    <p style={{fontSize:13,marginBottom:12}}>Sin resultados para "{textSearch}"</p>
                    <button onClick={()=>handleSelectOficio("Otros servicios")} style={{background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",border:"none",borderRadius:10,color:"#000",padding:"10px 20px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:13}}>
                      Continuar con "Otros servicios" →
                    </button>
                  </div>
                )}
              </div>
            </>)}
          </>)}

          {/* ── PASO 2: UBICACIÓN ── */}
          {step===2&&(<>
            <button onClick={()=>setStep(1)} style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"1px solid "+C.border,borderRadius:10,color:C.mutedL,cursor:"pointer",padding:"8px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:13,marginBottom:24}}>
              ← Cambiar servicio
            </button>
            <div style={{padding:"14px",background:C.accent+"12",borderRadius:12,border:"1px solid "+C.accent+"33",marginBottom:28}}>
              <p style={{fontSize:10,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.06em",marginBottom:3}}>Servicio</p>
              <p style={{fontWeight:800,color:C.accent,fontSize:16}}>{OFICIO_ICONS[selOficio]||"🔧"} {selOficio}</p>
            </div>
            <p style={{fontWeight:900,fontSize:20,color:C.text,marginBottom:4}}>¿Dónde lo necesitas?</p>
            <p style={{fontSize:13,color:C.muted,marginBottom:20}}>Selecciona la zona para encontrar profesionales cercanos</p>
            <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
              {[
                {id:"sevilla",icon:"🏛️",title:"Sevilla ciudad",sub:"Barrios y distritos de Sevilla capital",color:C.accent},
                {id:"pueblos",icon:"🌳",title:"Pueblos del área metropolitana",sub:"Dos Hermanas, Mairena, Alcalá y más",color:C.green},
              ].map(opt=>(
                <button key={opt.id} onClick={()=>{setSelUbicacion(opt.id as any);setSelZonas([]);setStep(3);}}
                  style={{display:"flex",gap:16,alignItems:"center",padding:"20px",borderRadius:16,border:"2px solid "+opt.color+"44",background:opt.color+"10",cursor:"pointer",fontFamily:"inherit",textAlign:"left" as const,transition:"all 0.18s"}}>
                  <span style={{fontSize:36,flexShrink:0}}>{opt.icon}</span>
                  <div>
                    <p style={{fontWeight:800,fontSize:16,color:C.text,marginBottom:3}}>{opt.title}</p>
                    <p style={{fontSize:12,color:C.mutedL}}>{opt.sub}</p>
                  </div>
                  <span style={{marginLeft:"auto",fontSize:18,color:opt.color,flexShrink:0}}>→</span>
                </button>
              ))}
            </div>
          </>)}

          {/* ── PASO 3: BARRIOS O PUEBLOS ── */}
          {step===3&&(<>
            <button onClick={()=>setStep(2)} style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"1px solid "+C.border,borderRadius:10,color:C.mutedL,cursor:"pointer",padding:"8px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:13,marginBottom:20}}>
              ← Cambiar ubicación
            </button>
            <p style={{fontWeight:900,fontSize:18,color:C.text,marginBottom:4}}>
              {selUbicacion==="sevilla"?"¿En qué barrio o barrios?":"¿En qué pueblo o pueblos?"}
            </p>
            <p style={{fontSize:13,color:C.muted,marginBottom:16}}>Puedes seleccionar varios o todos a la vez</p>

            {/* Botón seleccionar todos */}
            <button onClick={()=>toggleZona(opcionTodos)}
              style={{
                width:"100%",padding:"12px 16px",borderRadius:12,marginBottom:12,
                border:"2px solid "+(todosSeleccionados?C.accent:C.border),
                background:todosSeleccionados?"linear-gradient(135deg,"+C.accent+"22,"+C.orange+"11)":"transparent",
                color:todosSeleccionados?C.accent:C.mutedL,
                cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:800,fontSize:14,
                display:"flex",alignItems:"center",justifyContent:"space-between",
                transition:"all 0.15s",
              }}>
              <span>{selUbicacion==="sevilla"?"🗺️ Todo Sevilla":"🌍 Todos los pueblos"}</span>
              <span style={{fontSize:12,color:todosSeleccionados?C.accent:C.muted}}>
                {todosSeleccionados?`✓ ${zonasReales.length} seleccionados`:"Seleccionar todos"}
              </span>
            </button>

            {/* Lista de zonas */}
            <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
              {zonasReales.map(z=>{
                const sel=selZonas.includes(z);
                return(
                  <button key={z} onClick={()=>toggleZona(z)}
                    style={{
                      display:"flex",alignItems:"center",gap:12,padding:"12px 14px",
                      borderRadius:10,border:"1px solid "+(sel?C.accent:C.border+"66"),
                      background:sel?"linear-gradient(135deg,"+C.accent+"18,"+C.orange+"0A)":"transparent",
                      color:sel?C.accent:C.text,cursor:"pointer",fontFamily:"inherit",
                      textAlign:"left" as const,transition:"all 0.15s",fontWeight:sel?700:400,
                    }}>
                    <div style={{
                      width:20,height:20,borderRadius:6,border:"1.5px solid "+(sel?C.accent:C.border),
                      background:sel?C.accent:"transparent",display:"flex",alignItems:"center",
                      justifyContent:"center",flexShrink:0,transition:"all 0.15s",
                    }}>
                      {sel&&<span style={{color:"#000",fontSize:12,fontWeight:900}}>✓</span>}
                    </div>
                    <span style={{fontSize:13,flex:1}}>{z}</span>
                  </button>
                );
              })}
            </div>

            {/* Contador y botón listo */}
            <div style={{position:"sticky",bottom:0,paddingTop:16,paddingBottom:8,background:"linear-gradient(to top,#0A0A14 80%,transparent)"}}>
              {selZonas.length>0&&(
                <p style={{fontSize:12,color:C.muted,textAlign:"center" as const,marginBottom:8}}>
                  {todosSeleccionados?`Toda la zona seleccionada`:`${selZonas.length} ${selZonas.length===1?"zona seleccionada":"zonas seleccionadas"}`}
                </p>
              )}
              <button
                onClick={()=>{if(selZonas.length===0&&!todosSeleccionados){toggleZona(opcionTodos);}setStep(4);}}
                style={{
                  width:"100%",padding:"14px",borderRadius:12,
                  background:selZonas.length>0||todosSeleccionados?"linear-gradient(135deg,"+C.accent+","+C.orange+")":"linear-gradient(135deg,"+C.accent+"88,"+C.orange+"88)",
                  border:"none",color:"#000",fontFamily:"'DM Sans',sans-serif",
                  fontWeight:800,fontSize:14,cursor:"pointer",
                }}>
                {selZonas.length===0?"Seleccionar toda la zona y continuar →":"Listo · Continuar →"}
              </button>
            </div>
          </>)}

          {/* ── PASO 4: URGENCIA ── */}
          {step===4&&(<>
            <button onClick={()=>setStep(3)} style={{display:"flex",alignItems:"center",gap:8,background:"none",border:"1px solid "+C.border,borderRadius:10,color:C.mutedL,cursor:"pointer",padding:"8px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:13,marginBottom:20}}>
              ← Cambiar zona
            </button>
            <div style={{padding:"12px 14px",background:C.accent+"12",borderRadius:12,border:"1px solid "+C.accent+"33",marginBottom:24,display:"flex",gap:10,flexWrap:"wrap" as const}}>
              <span style={{fontSize:12,color:C.muted}}>📍</span>
              <span style={{fontSize:12,color:C.accent,fontWeight:600}}>
                {todosSeleccionados
                  ?(selUbicacion==="sevilla"?"Todo Sevilla":"Todos los pueblos")
                  :selZonas.join(" · ")}
              </span>
            </div>
            <p style={{fontWeight:900,fontSize:22,color:C.text,marginBottom:4}}>¿Con qué urgencia lo necesitas?</p>
            <p style={{fontSize:13,color:C.muted,marginBottom:20}}>Esto nos ayuda a conectarte con el profesional adecuado</p>
            <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
              {URGENCY_OPTS.map(opt=>(
                <button key={opt.id} onClick={()=>handleSelectUrgency(opt.id)}
                  style={{display:"flex",gap:16,alignItems:"center",padding:"18px 20px",borderRadius:16,border:"2px solid "+opt.border+"55",background:opt.bg,cursor:"pointer",fontFamily:"inherit",textAlign:"left" as const,transition:"all 0.18s",position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",top:-20,right:-20,width:70,height:70,borderRadius:"50%",background:opt.border+"15",pointerEvents:"none"}} />
                  <span style={{fontSize:30,flexShrink:0}}>{opt.icon}</span>
                  <div>
                    <p style={{fontWeight:800,fontSize:16,color:C.text,marginBottom:3}}>{opt.title}</p>
                    <p style={{fontSize:12,color:C.mutedL}}>{opt.sub}</p>
                  </div>
                  <span style={{marginLeft:"auto",fontSize:18,color:opt.border,flexShrink:0}}>→</span>
                </button>
              ))}
            </div>
          </>)}

        </div>
      </div>
    </div>
  );
}


// ─── WORKER CARD ───
function WorkerCardIdealista({w,onSelect,onChat}:{w:UserRow;onSelect:()=>void;onChat:()=>void}){
  const col=wColor(w.id);
  return(
    <div style={{background:C.card,borderRadius:16,border:"1px solid "+C.border,overflow:"hidden",transition:"all 0.2s",boxShadow:"0 2px 12px rgba(0,0,0,0.2)"}}>
      <div style={{display:"flex"}}>
        <div style={{width:4,background:"linear-gradient(180deg,"+col+","+col+"44)",flexShrink:0}} />
        <div style={{flex:1,padding:"14px 14px 12px"}}>
          <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}>
            <div onClick={onSelect} style={{cursor:"pointer",flexShrink:0}}><Ava s={w.name.substring(0,2).toUpperCase()} size={52} color={col} online={w.available} /></div>
            <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={onSelect}>
              <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:2,flexWrap:"wrap"}}>
                <p style={{fontWeight:800,fontSize:16,color:C.text,lineHeight:1.2}}>{w.name}</p>
                {w.verified&&<span style={{fontSize:10,color:C.green,fontWeight:700}}>✓</span>}
                {(w.plan==="elite"||w.plan==="pro")&&<Badge plan={w.plan} />}
              </div>
              <p style={{fontSize:12,color:col,fontWeight:600,marginBottom:3}}>{OFICIO_ICONS[w.trade||""]||"🔧"} {w.trade}</p>
              <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                <Stars n={w.rating} size={11} />
                <span style={{fontSize:11,color:C.text,fontWeight:700}}>{w.rating>0?w.rating.toFixed(1):"Nuevo"}</span>
                {w.reviews>0&&<span style={{fontSize:10,color:C.muted}}>({w.reviews} reseñas)</span>}
                {w.jobs>0&&<span style={{fontSize:10,color:C.muted}}>· {w.jobs} trabajos</span>}
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0,cursor:"pointer"}} onClick={onSelect}>
              <p style={{fontWeight:900,fontSize:20,color:C.accent,lineHeight:1}}>{w.price}€</p>
              <p style={{fontSize:10,color:C.muted}}>/hora</p>
              {w.free_quote&&<p style={{fontSize:9,color:C.green,fontWeight:600,marginTop:2}}>Ppto. gratis</p>}
            </div>
          </div>
          {w.bio&&<p style={{fontSize:12,color:C.mutedL,lineHeight:1.55,marginBottom:10,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{w.bio}</p>}
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
            <span style={{fontSize:10,color:C.muted,background:C.surface,padding:"3px 8px",borderRadius:99,border:"1px solid "+C.border}}>📍 {w.zone}</span>
            {w.schedule&&w.schedule.includes("24h")&&<span style={{fontSize:10,color:C.red,background:C.red+"15",padding:"3px 8px",borderRadius:99,border:"1px solid "+C.red+"33",fontWeight:600}}>🔴 24h</span>}
            {w.schedule&&w.schedule.includes("Lunes")&&w.schedule.includes("24h")&&<span style={{fontSize:10,color:C.orange,background:C.orange+"15",padding:"3px 8px",borderRadius:99,border:"1px solid "+C.orange+"33",fontWeight:600}}>L-V + 24h</span>}
            {w.response_time&&<span style={{fontSize:10,color:C.cyan,background:C.cyan+"12",padding:"3px 8px",borderRadius:99,border:"1px solid "+C.cyan+"33"}}>⚡ {w.response_time}</span>}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onChat} style={{flex:1,padding:"11px",background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",border:"none",borderRadius:10,color:"#000",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,boxShadow:"0 4px 14px "+C.accent+"33"}}>
              💬 Escribir mensaje
            </button>
            <button onClick={onSelect} style={{padding:"11px 14px",background:"transparent",border:"1px solid "+C.border,borderRadius:10,color:C.mutedL,fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:12,cursor:"pointer"}}>
              Ver perfil
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── WORKER DETAIL SHEET ───
function WorkerSheet({worker,onClose,onChat,currentUser}:{worker:UserRow;onClose:()=>void;onChat:(w:UserRow)=>void;currentUser:UserRow|null}){
  const [tab,setTab]=useState<"info"|"fotos"|"reviews"|"certs">("info");
  const [reviews,setReviews]=useState<any[]>([]);
  const [leads,setLeads]=useState<any[]>([]);
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

  useEffect(()=>{
    const ch=db.channel("reviews-"+worker.id)
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"reviews",filter:"worker_id=eq."+worker.id},(p:any)=>{
        const r=p.new;
        if(r.approved===false||r.approved===null){
          setReviews(prev=>prev.filter((x:any)=>x.id!==r.id));
        }
      })
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"reviews",filter:"worker_id=eq."+worker.id},(p:any)=>{
        setReviews(prev=>prev.filter((x:any)=>x.id!==p.old.id));
      })
      .subscribe();
    return()=>{db.removeChannel(ch);};
  },[worker.id]);
  const submitReview=async()=>{
    if(!newRev.trim())return;
    setSaving(true);
    const {data}=await db.from("reviews").insert({worker_id:worker.id,client_name:currentUser?.name||"Anónimo",client_id:currentUser?.id||null,stars:selStars,text:newRev,photo:"",photo_url:"",approved:true}).select().single();
    if(data)setReviews(p=>[data,...p]);
    setNewRev(""); setSaving(false);
  };

  const avgRating=reviews.length>0?reviews.reduce((s:number,r:any)=>s+r.stars,0)/reviews.length:worker.rating;

  return(
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

      {currentUser&&currentUser.type==="cliente"&&(
        <div style={{marginBottom:14}}>
          <button onClick={()=>onChat(worker)} style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",border:"none",borderRadius:12,color:"#000",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 4px 18px "+C.accent+"44"}}>
            💬 Escribir mensaje
          </button>
          <p style={{fontSize:11,color:C.muted,textAlign:"center",marginTop:6}}>🔒 Todo el contacto se gestiona dentro de la app</p>
        </div>
      )}
      {!currentUser&&<div style={{padding:"12px",background:C.surface,borderRadius:10,border:"1px solid "+C.border,textAlign:"center",marginBottom:14}}><p style={{fontSize:13,color:C.muted}}>Regístrate gratis para contactar con este profesional</p></div>}
      {currentUser&&(
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          <button onClick={async()=>{
            const msg=prompt("¿Qué quieres sugerir sobre este profesional?");
            if(!msg)return;
            await db.from("reports").insert({type:"sugerencia",worker_id:worker.id,worker_name:worker.name,from_id:currentUser.id,from_name:currentUser.name,message:msg,status:"pending"});
            alert("✅ Sugerencia enviada. Gracias.");
          }} style={{flex:1,padding:"8px",background:C.surface,border:"1px solid "+C.border,borderRadius:8,color:C.mutedL,fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:600,cursor:"pointer"}}>
            💡 Sugerir mejora
          </button>
          <button onClick={async()=>{
            const msg=prompt("¿Por qué quieres denunciar a este profesional?");
            if(!msg)return;
            await db.from("reports").insert({type:"denuncia",worker_id:worker.id,worker_name:worker.name,from_id:currentUser.id,from_name:currentUser.name,message:msg,status:"pending"});
            alert("🚩 Denuncia enviada. La revisaremos en breve.");
          }} style={{flex:1,padding:"8px",background:C.red+"12",border:"1px solid "+C.red+"33",borderRadius:8,color:C.red,fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:600,cursor:"pointer"}}>
            🚩 Denunciar
          </button>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
        {[{l:"Trabajos",v:String(worker.jobs)},{l:"Precio/h",v:(worker.price||30)+"€"},{l:"Valoración",v:avgRating>0?avgRating.toFixed(1)+"★":"Nuevo"}].map(s=>(
          <div key={s.l} style={{background:"linear-gradient(135deg,"+col+"15,transparent)",borderRadius:10,padding:"10px 6px",textAlign:"center",border:"1px solid "+col+"25"}}>
            <p style={{fontWeight:800,fontSize:18,color:col}}>{s.v}</p>
            <p style={{fontSize:10,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.06em"}}>{s.l}</p>
          </div>
        ))}
      </div>

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
          <div><p style={{fontSize:11,color:C.muted,marginBottom:6,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.06em"}}>Especialidades</p>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{worker.specialties.map(s=><span key={s} style={{fontSize:11,color:col,background:col+"15",padding:"3px 9px",borderRadius:99,border:"1px solid "+col+"33"}}>{s}</span>)}</div></div>
        )}
      </>)}

      {tab==="fotos"&&(photos.length===0?<div style={{textAlign:"center",padding:"32px 0",color:C.muted}}><p style={{fontSize:32,marginBottom:8}}>📸</p><p style={{fontSize:13}}>Sin fotos aún</p></div>:
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
          {photos.map(p=><div key={p.id} style={{borderRadius:10,overflow:"hidden",border:"1px solid "+C.border,background:C.surface,aspectRatio:"4/3",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:C.muted,padding:8}}>
            {p.url?<img src={p.url} alt={p.caption} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={(e:any)=>{e.target.style.display="none";}} />:<span style={{textAlign:"center"}}>{p.caption||"Foto de trabajo"}</span>}
          </div>)}
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

      {tab==="certs"&&(certs.length===0?<p style={{textAlign:"center",color:C.muted,fontSize:13,padding:16}}>No ha subido títulos todavía</p>:
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

// ─── RANKING ───
function RankingSection({workers,onSelect}:{workers:UserRow[];onSelect:(w:UserRow)=>void}){
  const top=workers.filter(w=>w.plan==="pro"||w.plan==="elite").sort((a,b)=>b.rating-a.rating||b.reviews-a.reviews).slice(0,20);
  return(
    <div style={{padding:"22px 0 16px"}}>
      <h2 style={{fontWeight:800,fontSize:22,color:C.text,marginBottom:4}}>🏆 Ranking Profesionales</h2>
      <p style={{fontSize:12,color:C.muted,marginBottom:16}}>Los mejor valorados este mes</p>
      {top.map((w,i)=>{
        const col=wColor(w.id);
        const medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":"";
        return(
          <GCard key={w.id} onClick={()=>onSelect(w)} glow={col} style={{marginBottom:8,padding:"12px 14px"}}>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <div style={{width:28,textAlign:"center",fontWeight:900,color:i<3?C.accent:C.muted,fontSize:i<3?18:13,flexShrink:0}}>{medal||"#"+(i+1)}</div>
              <Ava s={w.name.substring(0,2).toUpperCase()} size={40} color={col} online={w.available} />
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontWeight:700,color:C.text,fontSize:14}}>{w.name}</p>
                <p style={{fontSize:11,color:col}}>{OFICIO_ICONS[w.trade||""]||"🔧"} {w.trade}</p>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{display:"flex",gap:4,alignItems:"center",justifyContent:"flex-end",marginBottom:2}}>
                  <Stars n={w.rating} size={10} />
                  <span style={{fontSize:12,fontWeight:700,color:C.text}}>{w.rating>0?w.rating.toFixed(1):"—"}</span>
                </div>
                <p style={{fontSize:10,color:C.muted}}>{w.reviews} reseñas</p>
              </div>
            </div>
          </GCard>
        );
      })}
      {top.length===0&&<p style={{textAlign:"center",color:C.muted,fontSize:13,padding:32}}>Sin datos de ranking aún</p>}
    </div>
  );
}
// ─── SOLICITUDES TAB ───
function SolicitudesTab({user,workers,onWorkerSelect,onChat}:{user:UserRow;workers:UserRow[];onWorkerSelect:(w:UserRow)=>void;onChat:(w:UserRow)=>void}){
  const [solicitudes,setSolicitudes]=useState<any[]>([]);
  const [ofertas,setOfertas]=useState<Record<string,any[]>>({});
  const [showForm,setShowForm]=useState(false);
  const [oficio,setOficio]=useState(OFICIOS[0]);
  const [zona,setZona]=useState("Sevilla");
  const [desc,setDesc]=useState("");
  const [maxBudget,setMaxBudget]=useState("");
  const [sending,setSending]=useState(false);
  const [selectedSol,setSelectedSol]=useState<any|null>(null);

  const loadSolicitudes=useCallback(async()=>{
    const {data}=await db.from("budget_requests").select("*").eq("client_id",user.id).order("created_at",{ascending:false});
    setSolicitudes(data||[]);
    if(data&&data.length>0){
      const ids=data.map((s:any)=>s.id);
      const {data:of}=await db.from("budget_offers").select("*").in("request_id",ids).order("created_at",{ascending:true});
      const grouped:Record<string,any[]>={};
      (of||[]).forEach((o:any)=>{
        if(!grouped[o.request_id])grouped[o.request_id]=[];
        grouped[o.request_id].push(o);
      });
      setOfertas(grouped);
    }
  },[user.id]);

  useEffect(()=>{loadSolicitudes();},[loadSolicitudes]);

  const enviarSolicitud=async()=>{
  if(!desc.trim())return;
  setSending(true);
  const {data:req}=await db.from("budget_requests").insert({
    client_id:user.id,client_name:user.name,
    oficio,zona,description:desc,
    max_budget:maxBudget?parseInt(maxBudget):null,
    status:"open",
    notified_pros:[],
  }).select().single();

  if(req){
    // Solo elite y pro, filtrados por oficio y zona
    const {data:allPros}=await db.from("users").select("*").eq("type","profesional").eq("available",true).in("plan",["elite","pro"]).eq("trade",oficio);
const eligibles=(allPros||[]) as UserRow[];
    // Separar y barajar aleatoriamente
    const shuffle=(arr:UserRow[])=>[...arr].sort(()=>Math.random()-0.5);
    const elites=shuffle(eligibles.filter(w=>w.plan==="elite"));
    const pros=shuffle(eligibles.filter(w=>w.plan==="pro"));
    // 2 elite + 1 pro
    const toNotify=[...elites.slice(0,2),...pros.slice(0,1)];

    const notifiedIds:string[]=[];
    for(const pro of toNotify){
      await db.from("messages").insert({
        from_id:"00000000-0000-0000-0000-000000000001",
        to_id:pro.id,
        text:`🔴 *NUEVO LEAD*|REQUEST_ID:${req.id}|${user.name} necesita ${oficio} en ${zona}.\n📝 ${desc}${maxBudget?"\n💰 Máx: "+maxBudget+"€":""}`,
        read:false,
        is_lead_alert:true,
      });
      notifiedIds.push(pro.id);
    }
    // Guardar quién fue notificado para la rotación
    await db.from("budget_requests").update({
      notified_pros:notifiedIds,
      last_notified_at:new Date().toISOString(),
    }).eq("id",req.id);

    // Si nadie acepta en 2h → notificar a admin y rotar
    setTimeout(async()=>{
      const {data:check}=await db.from("budget_requests")
        .select("status").eq("id",req.id).single();
      if(check?.status==="open"){
        // Notificar admin
        await db.from("messages").insert({
          from_id:"00000000-0000-0000-0000-000000000001",to_id:"00000000-0000-0000-0000-000000000002",
          text:`⚠️ Solicitud sin aceptar tras 2h: ${oficio} en ${zona} de ${user.name}. Request ID: ${req.id}`,
          read:false,is_lead_alert:false,
        });
        // Rotar a otros 2 elite + 1 pro distintos
        const nextElites=shuffle(elites.filter(w=>!notifiedIds.includes(w.id))).slice(0,2);
        const nextPros=shuffle(pros.filter(w=>!notifiedIds.includes(w.id))).slice(0,1);
        const nextBatch=[...nextElites,...nextPros];
        for(const pro of nextBatch){
          await db.from("messages").insert({
            from_id:"00000000-0000-0000-0000-000000000001",
            to_id:pro.id,
            text:`🔴 *NUEVO LEAD*|REQUEST_ID:${req.id}|${user.name} necesita ${oficio} en ${zona}.\n📝 ${desc}${maxBudget?"\n💰 Máx: "+maxBudget+"€":""}`,
            read:false,is_lead_alert:true,
          });
        }
      }
    },7200000); // 2 horas
  }
  setDesc("");setMaxBudget("");setShowForm(false);
  loadSolicitudes();
  setSending(false);
};

  return(
    <div style={{padding:"16px 0"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h2 style={{fontWeight:800,fontSize:22,color:C.text}}>Mis solicitudes</h2>
        <button onClick={()=>setShowForm(!showForm)} style={{padding:"8px 16px",background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",border:"none",borderRadius:10,color:"#000",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer"}}>
          + Nueva solicitud
        </button>
      </div>

      {showForm&&(
        <GCard style={{marginBottom:16,border:"1px solid "+C.accent+"33"}}>
          <p style={{fontWeight:800,fontSize:15,color:C.text,marginBottom:14}}>📋 Nueva solicitud de presupuesto</p>
          <div style={{marginBottom:12}}>
            <p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:6,fontWeight:700}}>Servicio que necesitas</p>
            <select value={oficio} onChange={e=>setOficio(e.target.value)} style={{width:"100%",background:C.surface,border:"1px solid "+C.border,borderRadius:8,padding:"10px 12px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"}}>
              {OFICIOS.map(o=><option key={o} style={{background:C.card}}>{o}</option>)}
            </select>
          </div>
          <div style={{marginBottom:12}}>
            <p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:6,fontWeight:700}}>Zona</p>
            <select value={zona} onChange={e=>setZona(e.target.value)} style={{width:"100%",background:C.surface,border:"1px solid "+C.border,borderRadius:8,padding:"10px 12px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none"}}>
              {[...ZONAS,...SEVILLA_ZONAS].map(z=><option key={z} style={{background:C.card}}>{z}</option>)}
            </select>
          </div>
          <Inp label="Describe el trabajo *" value={desc} onChange={setDesc} placeholder="Ej: Pintar salón de 40m², paredes blancas, incluir material..." multiline />
          <Inp label="Presupuesto máximo (opcional)" value={maxBudget} onChange={setMaxBudget} type="number" placeholder="Ej: 500" />
          <div style={{display:"flex",gap:8}}>
            <Btn full disabled={sending||!desc.trim()} onClick={enviarSolicitud}>{sending?"Enviando...":"Solicitar presupuestos →"}</Btn>
            <button onClick={()=>setShowForm(false)} style={{padding:"12px 16px",background:"transparent",border:"1px solid "+C.border,borderRadius:10,color:C.muted,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13}}>Cancelar</button>
          </div>
        </GCard>
      )}

      {solicitudes.length===0&&!showForm&&(
        <div style={{textAlign:"center" as const,padding:"40px 20px",color:C.muted}}>
          <p style={{fontSize:36,marginBottom:8}}>📋</p>
          <p style={{fontWeight:700,color:C.text,fontSize:16,marginBottom:6}}>Sin solicitudes aún</p>
          <p style={{fontSize:13,marginBottom:16}}>Solicita presupuestos y recibe ofertas de hasta 3 profesionales</p>
          <Btn onClick={()=>setShowForm(true)}>+ Crear primera solicitud</Btn>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
  {solicitudes.map((sol:any)=>{
    const ofs=ofertas[sol.id]||[];
    const acceptedCount=(sol.accepted_pros||[]).length;
    const statusColor=sol.status==="closed"?C.green:acceptedCount>0?C.orange:C.muted;
    const statusLabel=sol.status==="closed"?"✅ Cerrada":acceptedCount>0?`${acceptedCount} profesional${acceptedCount>1?"es":""} interesado${acceptedCount>1?"s":""}`:"⏳ Esperando...";
    return(
      <GCard key={sol.id} style={{background:"#1e2035",border:"1px solid "+(acceptedCount>0?statusColor+"44":C.border)}}>
        {/* Cabecera */}
        <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:12}}>
          <div style={{width:42,height:42,borderRadius:12,background:C.accent+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
            {OFICIO_ICONS[sol.oficio]||"🔧"}
          </div>
          <div style={{flex:1}}>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" as const,marginBottom:2}}>
              <p style={{fontWeight:800,color:C.text,fontSize:15}}>{sol.oficio}</p>
              <span style={{fontSize:10,color:C.muted}}>· {sol.zona}</span>
            </div>
            <p style={{fontSize:12,color:C.mutedL,marginBottom:4,lineHeight:1.4}}>{sol.description}</p>
            {sol.max_budget&&<p style={{fontSize:11,color:C.accent,fontWeight:700}}>💰 Máximo: {sol.max_budget}€</p>}
          </div>
        </div>
        {/* Estado */}
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:statusColor+"15",borderRadius:8,marginBottom:12}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:statusColor,flexShrink:0}}/>
          <p style={{fontSize:12,color:statusColor,fontWeight:700,flex:1}}>{statusLabel}</p>
          <p style={{fontSize:10,color:C.muted}}>{new Date(sol.created_at).toLocaleDateString("es-ES")}</p>
        </div>
        {/* Sin ofertas */}
        {ofs.length===0&&acceptedCount===0&&(
          <p style={{fontSize:12,color:C.muted,textAlign:"center" as const,padding:"8px 0"}}>
            Los profesionales recibirán tu solicitud en breve
          </p>
        )}
        {/* Profesionales aceptaron pero sin oferta formal aún */}
        {ofs.length===0&&acceptedCount>0&&(
          <p style={{fontSize:12,color:C.orange,textAlign:"center" as const,padding:"8px 0",fontWeight:600}}>
            🔔 {acceptedCount} profesional{acceptedCount>1?"es están":"está"} preparando su oferta...
          </p>
        )}
        {/* Ofertas recibidas */}
        {ofs.length>0&&(
          <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
            <p style={{fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:4}}>Ofertas recibidas</p>
            {ofs.map((o:any)=>{
              const pro=workers.find(w=>w.id===o.pro_id);
              const col=PLAN_COLORS[o.pro_plan as Plan]||C.muted;
              const isChosen=o.status==="chosen";
              return(
                <div key={o.id} style={{background:isChosen?"#1a2e1a":C.surface,borderRadius:10,padding:"12px",border:"1px solid "+(isChosen?C.green+"66":C.border)}}>
                  <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:8}}>
                    <div style={{width:36,height:36,borderRadius:"50%",background:col+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:col,flexShrink:0}}>
                      {o.pro_name?.[0]||"P"}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap" as const}}>
                        <p style={{fontWeight:700,fontSize:13,color:C.text}}>{o.pro_name}</p>
                        <span style={{fontSize:9,color:col,background:col+"22",padding:"1px 5px",borderRadius:3,fontWeight:700}}>{(o.pro_plan||"").toUpperCase()}</span>
                        {o.pro_rating>0&&<span style={{fontSize:10,color:C.accent}}>⭐{o.pro_rating.toFixed(1)}</span>}
                        {isChosen&&<span style={{fontSize:9,color:C.green,background:C.green+"22",padding:"1px 6px",borderRadius:3,fontWeight:700}}>✓ ELEGIDO</span>}
                      </div>
                    </div>
                    <div style={{textAlign:"right" as const}}>
                      <p style={{fontWeight:900,fontSize:20,color:C.accent}}>{o.price}€</p>
                      {o.time_estimate&&<p style={{fontSize:10,color:C.muted}}>⏱ {o.time_estimate}</p>}
                    </div>
                  </div>
                  <p style={{fontSize:12,color:C.mutedL,marginBottom:10,lineHeight:1.5}}>{o.description}</p>
                  {!isChosen&&sol.status!=="closed"&&(
                    <div style={{display:"flex",gap:8}}>
                      {pro&&<button onClick={()=>onWorkerSelect(pro)} style={{flex:1,padding:"9px",background:"transparent",border:"1px solid "+C.border,borderRadius:8,color:C.mutedL,fontFamily:"'DM Sans',sans-serif",fontSize:12,cursor:"pointer",fontWeight:600}}>Ver perfil</button>}
                      <button onClick={async()=>{
                        await db.from("budget_offers").update({status:"chosen"}).eq("id",o.id);
                        await db.from("budget_requests").update({status:"closed"}).eq("id",sol.id);
                        ofs.filter((x:any)=>x.id!==o.id).forEach(async(x:any)=>{
                          await db.from("messages").insert({from_id:"00000000-0000-0000-0000-000000000001",to_id:x.pro_id,text:"Lo sentimos, el cliente eligió otro profesional para este trabajo. ¡Sigue respondiendo rápido!",read:false});
                        });
                        if(pro)onChat(pro);
                        loadSolicitudes();
                      }} style={{flex:2,padding:"9px",background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",border:"none",borderRadius:8,color:"#000",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:800,cursor:"pointer"}}>
                        ✓ Elegir y chatear →
                      </button>
                    </div>
                  )}
                  {isChosen&&(
                    <button onClick={()=>{if(pro)onChat(pro);}} style={{width:"100%",padding:"9px",background:C.green+"22",border:"1px solid "+C.green+"44",borderRadius:8,color:C.green,fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                      💬 Abrir chat →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </GCard>
    );
  })}
</div>
      </div>
  );
}
// ─── CLIENT HOME ───
// ════════════════════════════════════════════════════════════════
// REEMPLAZA el ClientHome completo en tu App.tsx
// Busca: "function ClientHome({user,onLogout}:" y reemplaza todo
// ════════════════════════════════════════════════════════════════

function ClientHome({user,onLogout}:{user:UserRow;onLogout:()=>void}){
  const [tab,setTab]=useState<"buscar"|"ranking"|"chats"|"solicitudes"|"perfil">("buscar");
  const [zona,setZona]=useState("Todas");
  const [oficio,setOficio]=useState("Todos");
  const [search,setSearch]=useState("");
  const [soloDisp,setSoloDisp]=useState(false);
  const [showWizard,setShowWizard]=useState(false);
  const [workers,setWorkers]=useState<UserRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [selectedWorker,setSelectedWorker]=useState<UserRow|null>(null);
  const [chatWorker,setChatWorker]=useState<UserRow|null>(null);
  const [chatPartners,setChatPartners]=useState<UserRow[]>([]);
  const [toast,setToast]=useState<string|null>(null);
  const [inAppNotif,setInAppNotif]=useState<{msg:string;from:string;fromId:string;isAdmin:boolean}|null>(null);
  const [unreadChats,setUnreadChats]=useState(0);
  const [unreadByWorker,setUnreadByWorker]=useState<Record<string,number>>({});
  const [lastReadTime,setLastReadTime]=useState<Record<string,string>>(()=>{
  try{const s=localStorage.getItem("oy_last_read_"+user.id);return s?JSON.parse(s):{};}
  catch{return {};}
});
  const [lastMsgByWorker,setLastMsgByWorker]=useState<Record<string,any>>({});
  const [showMapa,setShowMapa]=useState(false);
  const [mapaZones,setMapaZones]=useState<string[]>([]);
  const prosByZone=useCallback((zone:string)=>{
    return workers.filter(w=>w.zone===zone||(w.service_zones||[]).includes(zone)).length;
  },[workers]);
  const showToast=(m:string)=>{setToast(m);setTimeout(()=>setToast(null),3000);};

  const filteredWorkers=workers.filter(w=>{
    if(soloDisp&&!w.available)return false;
    if(mapaZones.length>0){
      const wz=[w.zone,...(w.service_zones||[])].filter(Boolean);
      if(!mapaZones.some(z=>wz.includes(z)))return false;
    } else if(zona!=="Todas"){
      if(w.zone!==zona&&!(w.service_zones||[]).includes(zona))return false;
    }
    if(oficio!=="Todos"&&w.trade!==oficio)return false;
    if(search){const s=search.toLowerCase();if(!w.name.toLowerCase().includes(s)&&!(w.trade||"").toLowerCase().includes(s)&&!(w.bio||"").toLowerCase().includes(s))return false;}
    return true;
  });

  const loadWorkers=useCallback(async()=>{
    setLoading(true);
    const {data}=await db.from("users").select("*").eq("type","profesional");
    const sorted=(data||[]).sort((a:UserRow,b:UserRow)=>{
      const order:Record<Plan,number>={elite:3,pro:2,basico:1,gratis:0};
      return order[b.plan as Plan]-order[a.plan as Plan]||b.rating-a.rating;
    });
    setWorkers(sorted);setLoading(false);
  },[]);

  useEffect(()=>{loadWorkers();},[loadWorkers]);

  useEffect(()=>{
    if("Notification" in window && Notification.permission==="default"){
      setTimeout(()=>{Notification.requestPermission();},3000);
    }
  },[]);

  const countUnread=useCallback(async()=>{
    const {count}=await db.from("messages").select("id",{count:"exact"} as any).eq("to_id",user.id).eq("read",false);
    setUnreadChats(count||0);
  },[user.id]);

  useEffect(()=>{countUnread();},[countUnread]);

  useEffect(()=>{
    const ch=db.channel("client-notif-"+user.id)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"to_id=eq."+user.id},(p:any)=>{
        const m=p.new;
        const isAdmin=m.from_id==="00000000-0000-0000-0000-000000000002"||m.from_id==="00000000-0000-0000-0000-000000000001";
        db.from("users").select("name").eq("id",m.from_id).single().then(({data}:any)=>{
          const senderName=isAdmin?"👑 OfficioYa Soporte":(data?.name||"Profesional");
          setInAppNotif({msg:m.text.substring(0,60)+(m.text.length>60?"...":""),from:senderName,fromId:m.from_id,isAdmin});
          setUnreadByWorker(p=>({...p,[m.from_id]:(p[m.from_id]||0)+1}));
          showPushNotification("💬 "+senderName, m.text.substring(0,80));
          loadChats();
          setUnreadChats(c=>c+1);
        });
      }).subscribe();
    return ()=>{db.removeChannel(ch);};
  },[user.id]);

  const loadChats=useCallback(async()=>{
  const {data:received}=await db.from("messages").select("from_id,to_id,text,read,created_at").eq("to_id",user.id);
  const {data:sent}=await db.from("messages").select("from_id,to_id,text,read,created_at").eq("from_id",user.id);
  const allMsgs=[...(received||[]),...(sent||[])];
  if(!allMsgs.length){setChatPartners([]);setUnreadByWorker({});return;}
  const ids=[...new Set(allMsgs.map((m:any)=>m.from_id===user.id?m.to_id:m.from_id))]
    .filter((id:string)=>id!=="00000000-0000-0000-0000-000000000001"&&id!=="00000000-0000-0000-0000-000000000002");
  if(!ids.length){setChatPartners([]);return;}
  const {data:ws}=await db.from("users").select("*").in("id",ids);
  if(!ws)return;
  const lastMsg:Record<string,any>={};
  allMsgs.forEach((m:any)=>{
    const partnerId=m.from_id===user.id?m.to_id:m.from_id;
    if(!lastMsg[partnerId]||new Date(m.created_at)>new Date(lastMsg[partnerId].created_at)){
      lastMsg[partnerId]=m;
    }
  });
  const sorted=[...ws].sort((a:any,b:any)=>{
    const ta=lastMsg[a.id]?.created_at||"";
    const tb=lastMsg[b.id]?.created_at||"";
    return new Date(tb).getTime()-new Date(ta).getTime();
  });
  setChatPartners(sorted);
  setLastMsgByWorker(lastMsg);
const counts:Record<string,number>={};
(received||[]).forEach((m:any)=>{
  if(!m.read&&m.from_id!=="00000000-0000-0000-0000-000000000001"&&m.from_id!=="00000000-0000-0000-0000-000000000002"){
    counts[m.from_id]=(counts[m.from_id]||0)+1;
  }
});
setUnreadByWorker(counts);
setUnreadChats(Object.values(counts).reduce((a:number,b:number)=>a+b,0));
  },[user.id]);

  useEffect(()=>{
    if(tab==="chats"){
      loadChats();
      const poll=setInterval(()=>loadChats(),2000);
      return ()=>clearInterval(poll);
    }
  },[tab,loadChats]);

  const handleChat=async(w:UserRow)=>{
    const ok=await logLead(w.id,user.id,"message");
    if(!ok){showToast("⛔ Este profesional ha alcanzado su límite de contactos este mes");return;}
    await notifyProOfNewLead(w.id,user.name,w.trade||"servicios");
    setSelectedWorker(null);setChatWorker(w);
  };

  const handleWizardResult=async(oficio:string,zonaResult:string,urgency:string)=>{
    if(oficio)setOficio(oficio);
    setShowWizard(false);

    // Insertar solicitud en tabla requests
    await db.from("requests").insert({
      client_id:user.id,
      client_name:user.name,
      oficio,
      zona:zonaResult||zona,
      urgency,
      status:"open",
    }).catch(()=>{});

    if(urgency==="urgente"&&oficio){
      // Insertar en jobs (sistema legacy)
      const {data:newJob}=await db.from("jobs").insert({
        worker_id:null,
        client_id:user.id,
        client_name:user.name,
        title:"Busca "+oficio+" — urgente",
        description:"Cliente busca "+oficio+" con urgencia en "+(zonaResult||zona),
        status:"pending",
        es_urgente:true,
        profesionales_aceptados:[],
      }).select().single().catch(()=>({data:null}));

      // Notificar via mensaje a todos los pros del oficio disponibles
      const {data:pros}=await db.from("users")
        .select("id")
        .eq("type","profesional")
        .eq("trade",oficio)
        .eq("available",true)
        .catch(()=>({data:[]}));

      if(pros&&pros.length>0){
        const alertTxt="🔴 *NUEVO CLIENTE INTERESADO*\n\n👤 "+user.name+" busca un "+oficio+" con urgencia en "+(zonaResult||zona)+".\n\n⚡ Responde cuanto antes para no perder este lead.";
        const inserts=(pros as {id:string}[]).map((p:{id:string})=>({
          from_id:"00000000-0000-0000-0000-000000000001",
          to_id:p.id,
          text:alertTxt,
          read:false,
          is_lead_alert:true,
        }));
        await db.from("messages").insert(inserts).catch(()=>{});
      }
    }
  };

  return(
    <div style={{minHeight:"100dvh",background:C.bg,backgroundImage:"radial-gradient(ellipse at 15% 0%,#1a0a3a22,transparent 50%),radial-gradient(ellipse at 85% 100%,#0a1a3a22,transparent 50%)",paddingBottom:72}}>

      {inAppNotif&&<InAppNotification
        msg={inAppNotif.msg} from={inAppNotif.from}
        isAdmin={inAppNotif.isAdmin}
        onClose={()=>setInAppNotif(null)}
        onClick={()=>{
          setInAppNotif(null);
          const worker=workers.find(w=>w.id===inAppNotif.fromId)||chatPartners.find(w=>w.id===inAppNotif.fromId);
          if(worker)setChatWorker(worker);
          else{setTab("chats");loadChats();}
        }}
      />}

      {/* ── HEADER ── */}
      <header style={{
        background:"rgba(10,10,15,0.96)",
        backdropFilter:"blur(20px)",
        borderBottom:"1px solid "+C.border,
        position:"sticky",
        top:0,
        zIndex:100,
        boxShadow:"0 2px 20px rgba(0,0,0,0.4)",
        // Esto empuja el contenido debajo de la Isla Dinámica/Notch
        paddingTop: "env(safe-area-inset-top)"
      }}>
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
          <div style={{padding:"14px 0 0"}}>

            {/* ════════════════════════════
                HERO CTA — rectángulo grande
                ════════════════════════════ */}
            <div
              onClick={()=>setShowWizard(true)}
              style={{
                background:"linear-gradient(135deg,#0d0d1a,#131320)",
                borderRadius:20,
                border:"1.5px solid "+C.accent+"55",
                padding:"24px 22px",
                cursor:"pointer",
                boxShadow:"0 8px 40px rgba(255,215,0,0.12),0 0 0 1px "+C.accent+"0A",
                transition:"all 0.2s",
                marginBottom:16,
                position:"relative",
                overflow:"hidden",
              }}
            >
              {/* Orbs decorativos */}
              <div style={{position:"absolute",top:-50,right:-50,width:180,height:180,borderRadius:"50%",background:"radial-gradient(circle,"+C.accent+"14 0%,transparent 70%)",pointerEvents:"none"}} />
              <div style={{position:"absolute",bottom:-40,left:-20,width:120,height:120,borderRadius:"50%",background:"radial-gradient(circle,"+C.orange+"10 0%,transparent 70%)",pointerEvents:"none"}} />

              {/* Badge disponibles */}
              <div style={{display:"inline-flex",alignItems:"center",gap:5,background:C.green+"1A",border:"1px solid "+C.green+"33",borderRadius:99,padding:"4px 10px",marginBottom:12}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:C.green,display:"inline-block",boxShadow:"0 0 6px "+C.green}} />
                <span style={{fontSize:9,color:C.green,fontWeight:800,letterSpacing:"0.07em"}}>{workers.filter(w=>w.available).length} DISPONIBLES AHORA</span>
              </div>

              {/* Titular */}
              <h1 style={{fontWeight:900,fontSize:26,color:C.text,lineHeight:1.1,marginBottom:4,letterSpacing:"-0.03em"}}>
                El profesional que necesitas,
              </h1>
              <h1 style={{fontWeight:900,fontSize:26,lineHeight:1.1,marginBottom:8,letterSpacing:"-0.03em",color:C.accent}}>
                en tu ciudad.
              </h1>
              <p style={{fontSize:12,color:C.mutedL,marginBottom:22}}>Presupuesto gratis · Sin compromiso · Pago directo al profesional</p>

              {/* Botón CTA interno */}
              <div style={{
                background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",
                borderRadius:14,
                padding:"15px 20px",
                display:"flex",
                alignItems:"center",
                gap:12,
                boxShadow:"0 6px 22px "+C.accent+"44",
              }}>
                <div style={{width:34,height:34,borderRadius:10,background:"rgba(0,0,0,0.18)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>⚡</div>
                <div style={{flex:1}}>
                  <p style={{fontWeight:900,color:"#000",fontSize:14,lineHeight:1}}>¿Necesitas un profesional ahora?</p>
                  <p style={{fontSize:11,color:"rgba(0,0,0,0.55)",marginTop:2}}>Te conectamos con el más adecuado en segundos</p>
                </div>
                <div style={{background:"rgba(0,0,0,0.15)",borderRadius:10,padding:"8px 14px",color:"#000",fontWeight:900,fontSize:14,flexShrink:0,whiteSpace:"nowrap" as const}}>Buscar →</div>
              </div>
            </div>

            {/* ════════════════════════════════════════════
                BUSCADOR con scroll de TODAS las profesiones
                ════════════════════════════════════════════ */}
            <div style={{background:C.card,borderRadius:16,border:"1px solid "+C.border,padding:"14px",marginBottom:14}}>

              {/* Input texto */}
              <div style={{display:"flex",background:C.bg,borderRadius:11,border:"1px solid "+C.border,overflow:"hidden",marginBottom:11}}>
                <span style={{padding:"0 13px",display:"flex",alignItems:"center",color:C.muted,fontSize:15}}>🔍</span>
                <input
                  value={search}
                  onChange={e=>{setSearch(e.target.value);if(e.target.value)setOficio("Todos");}}
                  placeholder="Electricista, fontanero, pintor..."
                  style={{flex:1,padding:"12px 0",background:"transparent",border:"none",color:C.text,fontFamily:"inherit",fontSize:14,outline:"none"}}
                />
                {search&&<button onClick={()=>setSearch("")} style={{padding:"0 13px",background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:14}}>✕</button>}
              </div>

              {/* Zona + botón mapa */}
              <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,marginBottom:11}}>
                <select value={zona} onChange={e=>setZona(e.target.value)} style={{padding:"10px 13px",background:C.surface,border:"1px solid "+C.border,borderRadius:10,color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:13,cursor:"pointer",outline:"none"}}>
                  <option style={{background:C.surface}}>Todas</option>
                  {ZONAS.map(z=><option key={z} style={{background:C.surface}}>{z}</option>)}
                  <option disabled style={{background:C.surface}}>── Barrios Sevilla ──</option>
                  {SEVILLA_ZONAS.map(z=><option key={z} style={{background:C.surface}}>{z}</option>)}
                </select>

                {/* Botón mapa — dorado pulsante */}
                <button
                  onClick={()=>setShowMapa(true)}
                  style={{
                    padding:"10px 14px",
                    background:"linear-gradient(135deg,#1C1A0A,#141208)",
                    border:"1.5px solid "+C.accent+"55",
                    borderRadius:10,
                    color:C.accent,
                    cursor:"pointer",
                    display:"flex",
                    alignItems:"center",
                    gap:6,
                    fontFamily:"'DM Sans',sans-serif",
                    fontWeight:700,
                    fontSize:12,
                    flexShrink:0,
                    boxShadow:"0 0 14px "+C.accent+"22",
                    animation:"mapPulse 2.5s ease-in-out infinite",
                  }}
                >
                  <span style={{fontSize:16}}>🗺️</span>
                  <span style={{whiteSpace:"nowrap" as const}}>Ver en mapa</span>
                </button>
              </div>

              {/* ── Pills scroll TODAS las profesiones ── */}
              <div style={{marginBottom:10}}>
                <p style={{fontSize:10,color:C.muted,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase" as const,marginBottom:7}}>Profesión</p>
                <div style={{position:"relative"}}>
                  <div style={{
                    display:"flex",
                    gap:6,
                    overflowX:"auto",
                    paddingBottom:6,
                    paddingTop:2,
                    scrollbarWidth:"none",
                  } as any}>
                    {/* Todos */}
                    <button
                      onClick={()=>setOficio("Todos")}
                      style={{
                        flexShrink:0,
                        padding:"7px 14px",
                        borderRadius:99,
                        border:"1.5px solid "+(oficio==="Todos"?C.accent:C.border+"88"),
                        background:oficio==="Todos"?"linear-gradient(135deg,"+C.accent+"22,"+C.orange+"11)":"rgba(255,255,255,0.02)",
                        color:oficio==="Todos"?C.accent:C.mutedL,
                        cursor:"pointer",
                        fontSize:12,
                        fontFamily:"'DM Sans',sans-serif",
                        fontWeight:oficio==="Todos"?800:500,
                        whiteSpace:"nowrap" as const,
                        transition:"all 0.15s",
                        boxShadow:oficio==="Todos"?"0 2px 8px "+C.accent+"22":"none",
                      }}
                    >
                      Todos
                    </button>

                    {/* Todas las profesiones */}
                    {OFICIOS.map(o=>(
                      <button
                        key={o}
                        onClick={()=>setOficio(oficio===o?"Todos":o)}
                        style={{
                          flexShrink:0,
                          display:"flex",
                          alignItems:"center",
                          gap:5,
                          padding:"7px 12px",
                          borderRadius:99,
                          border:"1.5px solid "+(oficio===o?C.accent:C.border+"66"),
                          background:oficio===o
                            ?"linear-gradient(135deg,"+C.accent+"22,"+C.orange+"11)"
                            :"rgba(255,255,255,0.025)",
                          color:oficio===o?C.accent:C.mutedL,
                          cursor:"pointer",
                          fontSize:11,
                          fontFamily:"'DM Sans',sans-serif",
                          fontWeight:oficio===o?700:400,
                          whiteSpace:"nowrap" as const,
                          transition:"all 0.15s",
                          boxShadow:oficio===o?"0 2px 8px "+C.accent+"22":"none",
                        }}
                      >
                        <span style={{fontSize:12}}>{OFICIO_ICONS[o]||"🔧"}</span>
                        <span>{o}</span>
                      </button>
                    ))}
                  </div>
                  {/* Fade derecha */}
                  <div style={{position:"absolute",top:0,right:0,bottom:6,width:36,background:"linear-gradient(to right,transparent,"+C.card+")",pointerEvents:"none"}} />
                </div>
              </div>

              {/* Solo disponibles + count */}
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button onClick={()=>setSoloDisp(!soloDisp)} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:99,border:"1px solid "+(soloDisp?C.green:C.border),background:soloDisp?C.green+"15":"transparent",color:soloDisp?C.green:C.muted,cursor:"pointer",fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:soloDisp?700:400,transition:"all 0.15s"}}>
                  <span style={{width:6,height:6,borderRadius:"50%",background:soloDisp?C.green:C.muted,display:"inline-block"}} />
                  Solo disponibles
                </button>
                <span style={{fontSize:12,color:C.muted,marginLeft:"auto"}}>{filteredWorkers.length} profesionales</span>
              </div>
            </div>

            {/* Stats */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16}}>
              {[{l:"Profesionales",v:workers.length+"+"},{l:"Trabajos",v:"1.8K"},{l:"Ciudades",v:"15"},{l:"Valoración",v:"4.8★"}].map(s=>(
                <div key={s.l} style={{background:C.surface,borderRadius:10,padding:"10px 8px",textAlign:"center" as const,border:"1px solid "+C.border}}>
                  <p style={{fontWeight:800,fontSize:16,color:C.accent}}>{s.v}</p>
                  <p style={{fontSize:9,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.05em"}}>{s.l}</p>
                </div>
              ))}
            </div>
          </div>

          {loading?<Spin/>:(
            <>
              {filteredWorkers.length===0&&<div style={{textAlign:"center" as const,padding:"32px 20px",color:C.muted}}><p style={{fontSize:32,marginBottom:8}}>🔍</p><p style={{fontWeight:700,color:C.text,fontSize:16,marginBottom:6}}>Sin resultados</p><p style={{fontSize:13}}>Prueba con otra búsqueda o zona</p></div>}
              <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                {filteredWorkers.map(w=><WorkerCardIdealista key={w.id} w={w} onChat={()=>handleChat(w)} onSelect={()=>setSelectedWorker(w)} />)}
              </div>
            </>
          )}
        </>)}

        {tab==="ranking"&&<RankingSection workers={workers} onSelect={setSelectedWorker} />}
        {tab==="solicitudes"&&<SolicitudesTab user={user} workers={workers} onWorkerSelect={setSelectedWorker} onChat={handleChat} />}

        {tab==="chats"&&(<>
          <div style={{padding:"22px 0 16px"}}><h2 style={{fontWeight:800,fontSize:22,color:C.text}}>Mis conversaciones</h2></div>
          {chatPartners.length===0?<div style={{textAlign:"center" as const,padding:48,color:C.muted}}>
            <p style={{fontSize:36,marginBottom:8}}>💬</p>
            <p style={{fontWeight:700,fontSize:16,marginBottom:6}}>Sin conversaciones</p>
            <Btn onClick={()=>setTab("buscar")} small>Buscar profesionales →</Btn>
          </div>:
          <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
            {chatPartners.map(w=>{
              const col=wColor(w.id);
              const unread=unreadByWorker[w.id]||0;
return <GCard key={w.id} onClick={async()=>{
  await db.from("messages").update({read:true}).eq("to_id",user.id).eq("from_id",w.id).eq("read",false);
  setUnreadByWorker(p=>({...p,[w.id]:0}));
  setUnreadChats(prev=>Math.max(0,prev-unread));
  setLastReadTime(p=>{const n={...p,[w.id]:new Date().toISOString()};localStorage.setItem("oy_last_read_"+user.id,JSON.stringify(n));return n;});
  setChatWorker(w);
}} glow={col}>
  <div style={{display:"flex",gap:12,alignItems:"center"}}>
    <Ava s={w.name.substring(0,2).toUpperCase()} size={46} color={col} online={w.available} />
    <div style={{flex:1,minWidth:0}}>
      <p style={{fontWeight:700,color:C.text,fontSize:14}}>{w.name}</p>
      <p style={{fontSize:12,color:unread>0?C.text:col,fontWeight:unread>0?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>
        {lastMsgByWorker[w.id]?.text
          ?(lastMsgByWorker[w.id].from_id===user.id?"Tú: ":"")+lastMsgByWorker[w.id].text.substring(0,40)+(lastMsgByWorker[w.id].text.length>40?"...":"")
          :OFICIO_ICONS[w.trade||""]||"🔧"+" "+w.trade+" · "+w.zone}
      </p>
    </div>
    {lastMsgByWorker[w.id]?.created_at&&(
      <span style={{fontSize:10,color:C.muted,flexShrink:0,marginRight:4}}>{timeAgo(lastMsgByWorker[w.id].created_at)}</span>
    )}
   {unreadByWorker[w.id]>0?(
  <span style={{
    minWidth:20,height:20,borderRadius:99,
    background:"linear-gradient(135deg,"+C.green+",#00A870)",
    color:"#000",display:"flex",alignItems:"center",justifyContent:"center",
    fontSize:10,fontWeight:900,flexShrink:0,padding:"0 5px",
    boxShadow:"0 2px 8px "+C.green+"55",
  }}>{unreadByWorker[w.id]>9?"9+":unreadByWorker[w.id]}</span>
):(
  <span style={{fontSize:12,color:col}}>→</span>
)}
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
                {user.phone&&<p style={{fontSize:12,color:C.muted}}>{user.phone}</p>}
                <div style={{marginTop:5}}><Badge plan={user.plan} /></div>
              </div>
            </div>
          </GCard>
          {(user.plan!=="gratis")&&(
            <GCard style={{marginBottom:14,border:"1px solid "+C.red+"33"}}>
              <p style={{fontWeight:700,color:C.text,fontSize:13,marginBottom:6}}>⚠️ Cancelar suscripción</p>
              <p style={{fontSize:12,color:C.muted,marginBottom:10}}>Si quieres darte de baja escríbenos directamente. Gestionaremos tu baja en menos de 24h.</p>
              <button onClick={async()=>{
                const adminUser={id:"00000000-0000-0000-0000-000000000002",name:"OfficioYa Soporte",email:"admin@oficioya.com",password:"",phone:"",type:"admin",plan:"elite",bio:"",price:0,trade:"",zone:"",rating:0,reviews:0,jobs:0,verified:true,available:true,whatsapp:"",service_zones:[],schedule:"",response_time:"",free_quote:false,experience_years:0,specialties:[],trial_end:"",joined_at:""};
                await db.from("messages").insert({from_id:user.id,to_id:"00000000-0000-0000-0000-000000000002",text:"Hola, quiero darme de baja de mi suscripción "+user.plan.toUpperCase()+". Por favor, gestiona mi cancelación. Gracias.",read:false});
                setTab("chats");
              }} style={{width:"100%",padding:"10px",background:C.red+"18",border:"1px solid "+C.red+"44",borderRadius:8,color:C.red,fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                Solicitar baja de suscripción →
              </button>
            </GCard>
          )}
          <Btn full outline danger onClick={onLogout} color={C.red}>Cerrar sesión</Btn>
        </>)}
      </div>

      {/* ══════════════════════════════════════════════
          NAV BAR MODERNA
          ══════════════════════════════════════════════ */}
     <nav style={{
        position:"fixed",
        bottom:0,
        left:0,
        right:0,
        background:"rgba(8,8,14,0.98)",
        backdropFilter:"blur(25px) saturate(200%)",
        borderTop:"1px solid "+C.border+"66",
        display:"flex",
        zIndex:200,
        boxShadow:"0 -4px 30px rgba(0,0,0,0.8)",
        // Ajuste extra de espacio para la barra de gestos de iPhone
        paddingBottom: "calc(10px + env(safe-area-inset-bottom))",
        paddingTop: "10px"
      }}>
        {[
          {id:"buscar" as const,label:"Buscar",active:(id:string)=>id==="buscar",icon:(active:boolean)=>(
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active?2.5:1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          )},
          {id:"ranking" as const,label:"Ranking",active:(id:string)=>id==="ranking",icon:(active:boolean)=>(
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active?2.5:1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
            </svg>
          )},
      {id:"solicitudes" as const,label:"Solicitudes",active:(id:string)=>id==="solicitudes",icon:(active:boolean)=>(
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active?2.5:1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
          )},
          {id:"chats" as const,label:"Mensajes",active:(id:string)=>id==="chats",icon:(active:boolean)=>(
            <svg width="21" height="21" viewBox="0 0 24 24" fill={active?"currentColor":"none"} stroke={active?"none":"currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          )},
          {id:"perfil" as const,label:"Perfil",active:(id:string)=>id==="perfil",icon:(active:boolean)=>(
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active?2.5:1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          )},
        ].map(({id,label,icon})=>{
          const isActive=tab===id;
          return(
            <button
              key={id}
              onClick={()=>setTab(id)}
              style={{
                flex:1,
                padding:"10px 4px 12px",
                background:"none",
                border:"none",
                color:isActive?C.accent:C.muted+"55",
                cursor:"pointer",
                display:"flex",
                flexDirection:"column" as const,
                alignItems:"center",
                gap:4,
                transition:"all 0.2s",
                position:"relative",
              }}
            >
              {/* Línea activa arriba */}
              {isActive&&(
                <div style={{
                  position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",
                  width:30,height:3,
                  background:"linear-gradient(90deg,"+C.accent+","+C.orange+")",
                  borderRadius:"0 0 4px 4px",
                  boxShadow:"0 0 10px "+C.accent+"88",
                }} />
              )}

              {/* Icono */}
              <div style={{
                color:isActive?C.accent:C.muted+"66",
                position:"relative",
                transform:isActive?"scale(1.1)":"scale(1)",
                transition:"transform 0.2s",
              }}>
                {icon(isActive)}
                {id==="chats"&&unreadChats>0&&!isActive&&(
                  <span style={{
                    position:"absolute",top:-5,right:-5,
                    background:"linear-gradient(135deg,#FF4455,#FF6677)",
                    color:"#fff",borderRadius:99,
                    minWidth:17,height:17,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:9,fontWeight:900,
                    border:"1.5px solid "+C.bg,
                    padding:"0 3px",
                    boxShadow:"0 2px 8px rgba(255,68,85,0.5)",
                  }}>
                    {unreadChats>9?"9+":unreadChats}
                  </span>
                )}
              </div>

              <span style={{
                fontSize:9,
                fontWeight:isActive?800:400,
                letterSpacing:"0.05em",
                textTransform:"uppercase" as const,
                color:isActive?C.accent:C.muted+"55",
                transition:"all 0.2s",
              }}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>

{showMapa&&(
        <MapaZonas
          selectedZones={mapaZones}
          onZonesChange={setMapaZones}
          prosByZone={prosByZone}
          onClose={()=>setShowMapa(false)}
          onSearch={(zones)=>{
            setMapaZones(zones);
            setZona("Todas");
            setShowMapa(false);
          }}
        />
      )}
      
      {showWizard&&<BuscadorExpressModal workers={workers} onResult={handleWizardResult} onWorkerSelect={w=>{setShowWizard(false);setSelectedWorker(w);}} onClose={()=>setShowWizard(false)} />}
      {selectedWorker&&<WorkerSheet worker={selectedWorker} onClose={()=>setSelectedWorker(null)} onChat={w=>{setSelectedWorker(null);handleChat(w);}} currentUser={user} />}
      {chatWorker&&<ChatPanel toUser={chatWorker} currentUser={user} onClose={()=>setChatWorker(null)} />}
      <InstallBanner/>
<Ping msg={toast} />
    </div>
  );
  }
// ─── AUTH ───
function Auth({onLogin}:{onLogin:(u:UserRow)=>void}){
  const [mode,setMode]=useState<"login"|"pick"|"register_cliente"|"register_pro">("login");
  const [proStep,setProStep]=useState(1);
  const [loading,setLoading]=useState(false);
  const [showForgot,setShowForgot]=useState(false);
const [forgotEmail,setForgotEmail]=useState("");
const [forgotPhone,setForgotPhone]=useState("");
const [forgotMsg,setForgotMsg]=useState("");
const [forgotLoading,setForgotLoading]=useState(false);

const handleForgot=async()=>{
  if(!forgotEmail||!forgotPhone){setForgotMsg("Introduce email y teléfono.");return;}
  setForgotLoading(true);setForgotMsg("");
  const{data:usr}=await db.from("users").select("id,name,email,phone")
    .eq("email",forgotEmail.toLowerCase().trim())
    .eq("phone",forgotPhone.trim())
    .maybeSingle();
  if(!usr){setForgotMsg("No encontramos una cuenta con ese email y teléfono.");setForgotLoading(false);return;}
  const nueva_pass=Math.random().toString(36).slice(-8)+Math.floor(Math.random()*100);
  await db.from("users").update({password:nueva_pass}).eq("id",usr.id);
  await fetch("https://rjwojxwrsbvwwshwwpvq.supabase.co/functions/v1/clever-api",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNjMxODcsImV4cCI6MjA2MDczOTE4N30.ywFWMDSEQ4W5BNaEGxBMPBqZ4GW-jGkIjHqMbSiXvUo",
      "Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNjMxODcsImV4cCI6MjA2MDczOTE4N30.ywFWMDSEQ4W5BNaEGxBMPBqZ4GW-jGkIjHqMbSiXvUo",
    },
    body:JSON.stringify({type:"recuperar_password",to:usr.email,name:usr.name,extra:{nueva_pass}}),
  });
  setForgotMsg("✅ ¡Enviado! Revisa tu correo con la nueva contraseña.");
  setForgotLoading(false);
};
  const [err,setErr]=useState("");
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [phone,setPhone]=useState("");
  const [pass,setPass]=useState("");
  const [trade,setTrade]=useState(OFICIOS[0]);
  const [zone,setZone]=useState(ZONAS[0]);
  const [plan,setPlan]=useState<Plan>("gratis");
  const [showPlanDetail,setShowPlanDetail]=useState<Plan|null>(null);
  const [pendingUser,setPendingUser]=useState<UserRow|null>(null);
  const [pendingPriceId,setPendingPriceId]=useState<string>("");
  const [showRegisterStripe,setShowRegisterStripe]=useState(false);

  const resetForm=()=>{setName("");setEmail("");setPhone("");setPass("");setTrade(OFICIOS[0]);setZone(ZONAS[0]);setPlan("gratis");setErr("");setProStep(1);};

  const login=async()=>{
    if(!email||!pass){setErr("Introduce email y contraseña.");return;}
    setLoading(true);setErr("");
    const ADMIN_ACCOUNTS=[
  {email:"andresalgora9@gmail.com",pass:"Oficiooficio9",name:"Andrés Admin"},
  {email:"admin@oficioya.com",pass:"¡Admin2026!",name:"Admin OfficioYa"},
];
const hardAdmin=ADMIN_ACCOUNTS.find(a=>a.email===email.toLowerCase()&&a.pass===pass);
if(hardAdmin){
  const adminUser:UserRow={id:"00000000-0000-0000-0000-000000000002",name:hardAdmin.name,email:hardAdmin.email,password:"",phone:"",type:"admin",plan:"elite",bio:"",price:0,trade:"",zone:"Sevilla",rating:0,reviews:0,jobs:0,verified:true,available:true,whatsapp:"",service_zones:[],schedule:"",response_time:"",free_quote:false,experience_years:0,specialties:[],trial_end:"2099-12-31",joined_at:new Date().toISOString()};
  setLoading(false);localStorage.setItem("oy_user",JSON.stringify(adminUser));onLogin(adminUser);return;
}
    const {data,error}=await db.from("users").select("*").eq("email",email.toLowerCase()).eq("password",pass).single();
    setLoading(false);
    if(error||!data){setErr("Email o contraseña incorrectos.");return;}
    localStorage.setItem("oy_user",JSON.stringify(data));onLogin(data as UserRow);
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
      const insertData:any={name:name.trim(),email:email.toLowerCase().trim(),password:pass,type:"cliente",plan:"gratis",bio:"",price:0,available:true,verified:false,jobs:0,rating:0,reviews:0,trial_end};
      if(phone){insertData.phone=phone.trim();insertData.whatsapp=phone.trim();}
      const {data,error}=await db.from("users").insert(insertData).select().single();
      setLoading(false);
      if(error){setErr("Error: "+error.message);return;}
      if(!data){setErr("Error creando cuenta.");return;}
      localStorage.setItem("oy_user",JSON.stringify(data));onLogin(data as UserRow);
fetch("https://rjwojxwrsbvwwshwwpvq.supabase.co/functions/v1/clever-api",{method:"POST",headers:{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNjMxODcsImV4cCI6MjA2MDczOTE4N30.ywFWMDSEQ4W5BNaEGxBMPBqZ4GW-jGkIjHqMbSiXvUo","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNjMxODcsImV4cCI6MjA2MDczOTE4N30.ywFWMDSEQ4W5BNaEGxBMPBqZ4GW-jGkIjHqMbSiXvUo"},body:JSON.stringify({type:"bienvenida_cliente",to:email.toLowerCase(),name:name.trim()})});
      // Ofrecer guardar con biometría
    if(window.PublicKeyCredential&&localStorage.getItem("oy_biometric")!=="declined"){
      setTimeout(()=>{
        const ok=confirm("¿Quieres entrar con huella o Face ID la próxima vez?");
        if(ok){
          localStorage.setItem("oy_biometric_email",email.toLowerCase());
          localStorage.setItem("oy_biometric_pass",pass);
          localStorage.setItem("oy_biometric","enabled");
        } else {
          localStorage.setItem("oy_biometric","declined");
        }
      },500);
    }
    }catch{setLoading(false);setErr("Error de conexión.");}
  };

  const registerPro=async()=>{
    if(!name||!email||!phone||!pass){setErr("Rellena todos los campos obligatorios.");return;}
    if(pass.length<6){setErr("Mínimo 6 caracteres.");return;}
    if(!/\S+@\S+\.\S+/.test(email)){setErr("Introduce un email válido.");return;}
    setLoading(true);setErr("");
    try{
      const {data:ex}=await db.from("users").select("id").eq("email",email.toLowerCase()).maybeSingle();
      if(ex){setLoading(false);setErr("Ya existe una cuenta con ese email.");return;}
      const trial_end=new Date(Date.now()+30*86400000).toISOString().split("T")[0];
      const insertData:any={name:name.trim(),email:email.toLowerCase().trim(),password:pass,phone:phone.trim(),type:"profesional",plan:"gratis",trade,zone,bio:"",price:30,available:true,verified:false,jobs:0,rating:0,reviews:0,trial_end,whatsapp:phone.trim(),free_quote:true,service_zones:[zone],schedule:"Lunes a Viernes",response_time:"24h",experience_years:0,specialties:[]};
      const {data,error}=await db.from("users").insert(insertData).select().single();
      setLoading(false);
      if(error){setErr("Error: "+error.message);return;}
      if(!data){setErr("Error creando cuenta.");return;}
      localStorage.setItem("oy_user",JSON.stringify(data));fetch("https://rjwojxwrsbvwwshwwpvq.supabase.co/functions/v1/clever-api",{method:"POST",headers:{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNjMxODcsImV4cCI6MjA2MDczOTE4N30.ywFWMDSEQ4W5BNaEGxBMPBqZ4GW-jGkIjHqMbSiXvUo","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNjMxODcsImV4cCI6MjA2MDczOTE4N30.ywFWMDSEQ4W5BNaEGxBMPBqZ4GW-jGkIjHqMbSiXvUo"},body:JSON.stringify({type:"bienvenida_pro",to:email.toLowerCase(),name:name.trim()})});
      // Si eligió plan de pago → mostrar Stripe antes de entrar
      if(plan!=="gratis"){
        const priceMap:Record<string,string>={
          basico:"price_1TYugfCZe2kZYfZChXHjTrsg",
          pro:"price_1TYuioCZe2kZYfZChYFbWcrt",
          elite:"price_1TYuneCZe2kZYfZCxD24mHGx",
        };
        setPendingUser(data as UserRow);
        setPendingPriceId(priceMap[plan]);
        setShowRegisterStripe(true);
      } else {
        onLogin(data as UserRow);
      }
    }catch{setLoading(false);setErr("Error de conexión.");}
  };

  const PlanDetailModal=({pl,onClose}:{pl:Plan;onClose:()=>void})=>{
    const col=PLAN_COLORS[pl];
    return <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(4,4,12,0.9)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(170deg,#14141F,#0A0A14)",borderRadius:16,width:"100%",maxWidth:360,border:"2px solid "+col+"44",padding:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div><p style={{fontWeight:900,fontSize:22,color:col}}>{pl.toUpperCase()}</p><p style={{fontSize:18,fontWeight:800,color:C.text}}>{PLAN_PRICES[pl]===0?"GRATIS":PLAN_PRICES[pl]+"€/mes"}</p></div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:20}}>✕</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
          {PLAN_FEATURES[pl].map(f=><div key={f} style={{display:"flex",gap:8,alignItems:"center"}}><span style={{color:col,fontSize:13}}>✓</span><span style={{fontSize:13,color:C.text}}>{f}</span></div>)}
        </div>
        <Btn full onClick={()=>{setPlan(pl);onClose();}} color={col}>Elegir {pl.toUpperCase()} →</Btn>
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

  return(
    <div style={{minHeight:"100dvh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px",backgroundImage:"radial-gradient(ellipse at 20% 0%,#2a0a5a22,transparent 55%),radial-gradient(ellipse at 80% 100%,#0a2a4a22,transparent 55%)",overflowY:"auto"}}>
      {showPlanDetail&&<PlanDetailModal pl={showPlanDetail} onClose={()=>setShowPlanDetail(null)} />}
      {showRegisterStripe&&pendingUser&&(
        <StripePayModal
          user={pendingUser}
          priceId={pendingPriceId}
          plan={plan}
          onClose={()=>{setShowRegisterStripe(false);onLogin(pendingUser);}}
          onSuccess={(pl)=>{onLogin({...pendingUser,plan:pl});}}
        />
      )}
      <div style={{width:"100%",maxWidth:420}}>
        <Logo />
        {mode==="login"&&(
          <GCard>
            <p style={{fontWeight:800,fontSize:17,color:C.text,marginBottom:16,textAlign:"center"}}>Bienvenido de nuevo</p>
            {err&&<div style={{color:C.red,fontSize:13,marginBottom:12,padding:"10px 12px",background:C.red+"15",borderRadius:8,border:"1px solid "+C.red+"33"}}>{err}</div>}
            <Inp label="Email" value={email} onChange={setEmail} type="email" placeholder="tu@email.com" />
            <Inp label="Contraseña" value={pass} onChange={setPass} type="password" placeholder="••••••••" />
            <Btn full disabled={loading} onClick={login}>{loading?"Entrando...":"Entrar →"}</Btn>
            {!showForgot?(
  <button onClick={()=>setShowForgot(true)} style={{background:"none",border:"none",color:"#7B5EA7",cursor:"pointer",fontSize:12,marginTop:4,textDecoration:"underline",fontFamily:"'DM Sans',sans-serif"}}>
    ¿Olvidaste tu contraseña?
  </button>
):(
  <div style={{background:"#1a1a2e",borderRadius:10,padding:16,marginTop:8,border:"1px solid #7B5EA733"}}>
    <p style={{fontSize:13,fontWeight:700,color:"#f0f0fa",marginBottom:10}}>🔑 Recuperar contraseña</p>
    <input value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)} placeholder="Tu email" type="email"
      style={{width:"100%",padding:"10px 12px",background:"#0a0a14",border:"1px solid #7B5EA766",borderRadius:8,color:"#f0f0fa",fontSize:13,fontFamily:"'DM Sans',sans-serif",marginBottom:8,boxSizing:"border-box" as const}}/>
    <input value={forgotPhone} onChange={e=>setForgotPhone(e.target.value)} placeholder="Tu teléfono" type="tel"
      style={{width:"100%",padding:"10px 12px",background:"#0a0a14",border:"1px solid #7B5EA766",borderRadius:8,color:"#f0f0fa",fontSize:13,fontFamily:"'DM Sans',sans-serif",marginBottom:10,boxSizing:"border-box" as const}}/>
    {forgotMsg&&<p style={{fontSize:12,color:forgotMsg.includes("✅")?"#00D68F":"#FF4444",marginBottom:8}}>{forgotMsg}</p>}
    <div style={{display:"flex",gap:8}}>
      <button onClick={handleForgot} disabled={forgotLoading}
        style={{flex:1,padding:"10px",background:"linear-gradient(135deg,#7B5EA7,#FF6B35)",border:"none",borderRadius:8,color:"#fff",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer"}}>
        {forgotLoading?"Enviando...":"Enviar nueva contraseña"}
      </button>
      <button onClick={()=>{setShowForgot(false);setForgotMsg("");}}
        style={{padding:"10px 14px",background:"transparent",border:"1px solid #333",borderRadius:8,color:"#aaa",cursor:"pointer",fontSize:12}}>
        Cancelar
      </button>
    </div>
  </div>
)}
            {localStorage.getItem("oy_biometric")==="enabled"&&(
              <button onClick={async()=>{
                try{
                  const savedEmail=localStorage.getItem("oy_biometric_email")||"";
                  const savedPass=localStorage.getItem("oy_biometric_pass")||"";
                  if(!savedEmail||!savedPass){localStorage.removeItem("oy_biometric");return;}
                  // Verificar biometría con WebAuthn
                  const cred=await navigator.credentials.get({
                    publicKey:{
                      challenge:new Uint8Array(32),
                      userVerification:"required",
                      timeout:60000,
                    }
                  } as any);
                  if(cred){
                    setEmail(savedEmail);
                    setPass(savedPass);
                    setLoading(true);
                    const {data,error}=await db.from("users").select("*").eq("email",savedEmail).eq("password",savedPass).single();
                    setLoading(false);
                    if(error||!data){setErr("Error de autenticación.");return;}
                    localStorage.setItem("oy_user",JSON.stringify(data));
                    onLogin(data as UserRow);
                  }
                }catch(e){
                  setErr("Biometría cancelada o no disponible.");
                }
              }} style={{width:"100%",padding:"12px",background:"linear-gradient(135deg,#1a1a2e,#0d0d1a)",border:"1px solid "+C.accent+"44",borderRadius:10,color:C.accent,fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginTop:8}}>
                <span style={{fontSize:20}}>🔐</span> Entrar con huella / Face ID
              </button>
            )}
            <div style={{textAlign:"center",marginTop:16}}>
              <p style={{fontSize:13,color:C.muted}}>¿No tienes cuenta? <button onClick={()=>{setMode("pick");resetForm();}} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:13,fontWeight:700}}>Regístrate gratis</button></p>
            </div>
          </GCard>
        )}
        {mode==="pick"&&(
          <div>
            <p style={{fontWeight:800,fontSize:18,color:C.text,marginBottom:6,textAlign:"center"}}>¿Cómo quieres usar OfficioYa?</p>
            <p style={{fontSize:13,color:C.muted,marginBottom:20,textAlign:"center"}}>Es gratis registrarse.</p>
            <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
              <div onClick={()=>setMode("register_cliente")} style={{padding:"20px 18px",borderRadius:14,border:"2px solid "+C.blue+"44",background:"linear-gradient(135deg,"+C.blue+"12,"+C.surface+")",cursor:"pointer"}}>
                <div style={{display:"flex",gap:14,alignItems:"center"}}>
                  <div style={{width:48,height:48,borderRadius:12,background:C.blue+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>🏠</div>
                  <div><p style={{fontWeight:800,fontSize:15,color:C.text,marginBottom:3}}>Soy cliente</p><p style={{fontSize:12,color:C.muted}}>Busco profesionales para mis trabajos</p></div>
                  <span style={{marginLeft:"auto",fontSize:18,color:C.blue,flexShrink:0}}>→</span>
                </div>
              </div>
              <div onClick={()=>setMode("register_pro")} style={{padding:"20px 18px",borderRadius:14,border:"2px solid "+C.accent+"44",background:"linear-gradient(135deg,"+C.accent+"12,"+C.surface+")",cursor:"pointer"}}>
                <div style={{display:"flex",gap:14,alignItems:"center"}}>
                  <div style={{width:48,height:48,borderRadius:12,background:C.accent+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>🔨</div>
                  <div><p style={{fontWeight:800,fontSize:15,color:C.text,marginBottom:3}}>Soy profesional</p><p style={{fontSize:12,color:C.muted}}>Ofrezco mis servicios y capto clientes</p></div>
                  <span style={{marginLeft:"auto",fontSize:18,color:C.accent,flexShrink:0}}>→</span>
                </div>
              </div>
            </div>
            <p style={{textAlign:"center",fontSize:13,color:C.muted}}>¿Ya tienes cuenta? <button onClick={()=>setMode("login")} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:13,fontWeight:700}}>Inicia sesión</button></p>
          </div>
        )}
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
            <Btn full disabled={loading} onClick={registerCliente}>{loading?"Creando tu cuenta...":"Crear cuenta gratis →"}</Btn>
          </GCard>
        )}
        {mode==="register_pro"&&(
          <GCard style={{padding:20}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:20}}>
              <button onClick={()=>{if(proStep===1)setMode("pick");else setProStep(p=>p-1);}} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18,padding:0,flexShrink:0}}>←</button>
              <div style={{flex:1,display:"flex",gap:4}}>
                {[1,2,3].map(s=><div key={s} style={{flex:1,height:4,borderRadius:99,background:s<=proStep?"linear-gradient(90deg,"+C.accent+","+C.orange+")":C.border,transition:"background 0.3s"}} />)}
              </div>
              <span style={{fontSize:10,color:C.muted,flexShrink:0,fontWeight:600}}>Paso {proStep}/3</span>
            </div>
            {err&&<div style={{color:C.red,fontSize:13,marginBottom:12,padding:"10px 12px",background:C.red+"15",borderRadius:8,border:"1px solid "+C.red+"33"}}>{err}</div>}
            {proStep===1&&(<>
              <p style={{fontWeight:800,fontSize:16,color:C.text,marginBottom:4}}>Tus datos</p>
              <p style={{fontSize:12,color:C.muted,marginBottom:16}}>Solo te llevará 1 minuto</p>
              <Inp label="Nombre completo *" value={name} onChange={setName} placeholder="Ej: Juan García" required />
              <Inp label="Email *" value={email} onChange={setEmail} type="email" placeholder="tu@email.com" required />
              <Inp label="Teléfono / WhatsApp *" value={phone} onChange={setPhone} placeholder="+34 600 000 000" required />
              <Inp label="Contraseña *" value={pass} onChange={setPass} type="password" placeholder="Mínimo 6 caracteres" required />
              <Btn full onClick={()=>{if(!name||!email||!phone||!pass){setErr("Rellena todos los campos.");return;}if(pass.length<6){setErr("Mínimo 6 caracteres.");return;}setErr("");setProStep(2);}}>Continuar →</Btn>
            </>)}
            {proStep===2&&(<>
              <p style={{fontWeight:800,fontSize:16,color:C.text,marginBottom:4}}>Tu oficio y zona</p>
              <p style={{fontSize:12,color:C.muted,marginBottom:16}}>Así te encontrarán tus clientes</p>
              <div style={{marginBottom:14}}>
                <p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Tu oficio *</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,maxHeight:180,overflowY:"auto",paddingRight:4}}>
                  {OFICIOS.map(o=><button key={o} onClick={()=>setTrade(o)} style={{padding:"6px 12px",borderRadius:99,border:"1px solid "+(trade===o?C.accent:C.border),background:trade===o?C.accent+"22":"transparent",color:trade===o?C.accent:C.muted,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:trade===o?700:400,transition:"all 0.15s"}}>{OFICIO_ICONS[o]} {o}</button>)}
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
            {proStep===3&&(<>
              <p style={{fontWeight:800,fontSize:16,color:C.text,marginBottom:2}}>Elige tu plan</p>
              <p style={{fontSize:12,color:C.muted,marginBottom:16}}>Empieza gratis · Sin tarjeta</p>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                {(["gratis","basico","pro","elite"] as Plan[]).map(pl=>{
                  const col=PLAN_COLORS[pl]; const isSelected=plan===pl;
                  return(
                    <div key={pl} onClick={()=>setPlan(pl)} style={{padding:"12px 14px",borderRadius:12,border:"2px solid "+(isSelected?col:C.border),background:isSelected?col+"15":C.surface,cursor:"pointer",transition:"all 0.15s",position:"relative"}}>
                      {pl==="elite"&&<span style={{position:"absolute",top:-9,left:12,background:"linear-gradient(135deg,"+C.orange+","+C.red+")",color:"#fff",borderRadius:99,padding:"1px 9px",fontSize:8,fontWeight:900}}>1 MES GRATIS</span>}
                      {pl==="pro"&&<span style={{position:"absolute",top:-9,right:12,background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",color:"#000",borderRadius:99,padding:"1px 9px",fontSize:8,fontWeight:900}}>MÁS POPULAR</span>}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                        <span style={{fontWeight:800,fontSize:14,color:col}}>{pl.toUpperCase()}</span>
                        <span style={{fontWeight:800,fontSize:15,color:C.text}}>{PLAN_PRICES[pl]===0?"GRATIS":PLAN_PRICES[pl]+"€/mes"}</span>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                        {PLAN_FEATURES[pl].slice(0,3).map(f=><span key={f} style={{fontSize:10,color:isSelected?col:C.mutedL}}>✓ {f}</span>)}
                      </div>
                    </div>
                  );
                })}
              </div>
              {plan==="elite"&&(
  <div style={{padding:"10px 12px",marginBottom:12,background:"rgba(255,68,85,0.08)",border:"1px solid rgba(255,68,85,0.2)",borderRadius:8}}>
    <p style={{fontSize:11,color:"#ff8888",lineHeight:1.7,margin:0}}>
      ⚠ Tienes <strong style={{color:"#ffaaaa"}}>15 días</strong> para cancelar sin coste.
      A partir del día 16 se cobrará <strong style={{color:"#ffaaaa"}}>49,99€</strong> al vencimiento del trial.
      Cancelación con <strong style={{color:"#ffaaaa"}}>15 días de antelación</strong> al siguiente cobro.{" "}
      <a href="/cancelacion" target="_blank" style={{color:"#FFD700"}}>Ver política completa</a>
    </p>
  </div>
)}
              <div style={{padding:"12px 14px",marginBottom:16,backgroundColor:"#16161F",border:"1px solid #1E1E30",borderRadius:8,textAlign:"left" as const}}>
  <p style={{fontSize:11,color:"#7777AA",lineHeight:1.6,margin:0}}>
    Información de suscripción: El período de prueba cuenta con 30 días de acceso gratuito. Las solicitudes de cancelación deben procesarse con un mínimo de <strong style={{color:"#F0F0FA"}}>15 días de antelación</strong> respecto a la fecha de renovación para evitar el cargo automático del ciclo posterior ({plan==="elite"?"49,99€":plan==="pro"?"24,99€":"9,99€"}/mes). Al continuar, confirmas la aceptación de nuestros <a href="/terminos" target="_blank" style={{color:"#FFD700",textDecoration:"underline"}}>Términos de Servicio</a> y <a href="/cancelacion" target="_blank" style={{color:"#FFD700",textDecoration:"underline"}}>Política de Cancelación</a>.
  </p>
</div>
<Btn full disabled={loading} onClick={registerPro}>{loading?"Creando tu perfil...":"Crear perfil profesional →"}</Btn>
</>)}
          </GCard>
        )}
        <p style={{textAlign:"center",fontSize:11,color:C.muted,marginTop:14}}>
  Al continuar aceptas los{" "}
  <a href="/terminos" style={{color:C.accent,textDecoration:"none"}}>Términos de Uso</a>
  {" "}y la{" "}
  <a href="/privacidad" style={{color:C.accent,textDecoration:"none"}}>Política de Privacidad</a>
</p>
<LegalFooter/>
      </div>
    </div>
  );
}
// SATRIPE // 
function StripePayModal({user,priceId,plan,onClose,onSuccess}:{user:UserRow;priceId:string;plan:Plan;onClose:()=>void;onSuccess:(pl:Plan)=>void}){
  const cardRef=useRef<HTMLDivElement>(null);
  const stripeRef=useRef<any>(null);
  const cardEl=useRef<any>(null);
  const [ready,setReady]=useState(false);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState<string|null>(null);
  const [mounted,setMounted]=useState(false);
  const STRIPE_PUBLIC_KEY="pk_live_51TBJWACZe2kZYfZCHz1oLjVx17xGuoJzAHZpiOjXjsdfCDoWMyQMJ27BPJCizC5ncJPhefHaxNNpf6n4PTyGHB4100zzShI0xN";
  const col=PLAN_COLORS[plan];
  const nuncaTuvoElite=!((user as any).stripe_customer_id);

  useEffect(()=>{
    setMounted(false);
    setReady(false);
    setErr(null);
    setLoading(false);
    if(cardEl.current){try{cardEl.current.destroy();}catch(e){}cardEl.current=null;}
    const timer=setTimeout(()=>setMounted(true),50);
    return()=>{
      clearTimeout(timer);
      if(cardEl.current){try{cardEl.current.destroy();}catch(e){}cardEl.current=null;}
    };
  },[priceId]);

  useEffect(()=>{
    if(!mounted||!cardRef.current)return;
    const init=()=>{
      if(!cardRef.current)return;
      try{
        stripeRef.current=(window as any).Stripe(STRIPE_PUBLIC_KEY);
        const elements=stripeRef.current.elements();
        cardEl.current=elements.create("card",{
          style:{
            base:{color:"#F0F0FA",fontFamily:"'DM Sans',sans-serif",fontSize:"16px","::placeholder":{color:"#44445A"},iconColor:col},
            invalid:{color:"#FF4455"},
          },
          hidePostalCode:true,
        });
        cardEl.current.mount(cardRef.current);
        cardEl.current.on("ready",()=>setReady(true));
        cardEl.current.on("change",(e:any)=>setErr(e.error?.message||null));
      }catch(e){console.error(e);}
    };
    if((window as any).Stripe){init();return;}
    const s=document.createElement("script");
    s.src="https://js.stripe.com/v3/";
    s.onload=init;
    document.head.appendChild(s);
    return()=>{
      if(cardEl.current){try{cardEl.current.destroy();}catch(e){}cardEl.current=null;}
    };
  },[mounted]);

  const pay=async()=>{
    if(!ready||loading)return;
    setLoading(true);setErr(null);
    const {paymentMethod,error}=await stripeRef.current.createPaymentMethod({
      type:"card",card:cardEl.current,
      billing_details:{name:user.name,email:user.email,phone:user.phone||""},
    });
    if(error){setErr(error.message);setLoading(false);return;}
    try{
      const res=await fetch("https://rjwojxwrsbvwwshwwpvq.supabase.co/functions/v1/dynamic-handler",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNjMxODcsImV4cCI6MjA2MDczOTE4N30.ywFWMDSEQ4W5BNaEGxBMPBqZ4GW-jGkIjHqMbSiXvUo",
          "Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUxNjMxODcsImV4cCI6MjA2MDczOTE4N30.ywFWMDSEQ4W5BNaEGxBMPBqZ4GW-jGkIjHqMbSiXvUo",
        },
        body:JSON.stringify({paymentMethodId:paymentMethod.id,email:user.email,nombre:user.name,telefono:user.phone||"",priceId,userId:user.id}),
      });
      const result=await res.json();
      if(result.ok){onSuccess(plan);}
      else{setErr(result.error||"Error al procesar");setLoading(false);}
    }catch{setErr("Error de conexión");setLoading(false);}
  };

  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(4,4,12,0.92)",backdropFilter:"blur(20px)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:20,overflowY:"auto"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(170deg,#14141F,#0A0A14)",borderRadius:20,width:"100%",maxWidth:440,border:"1px solid "+col+"33",boxShadow:"0 0 60px "+col+"18",overflow:"hidden"}}>

        {/* ── BANNER ELITE GRATIS ── */}
        {plan==="elite"&&nuncaTuvoElite&&(
          <div style={{background:"linear-gradient(135deg,"+col+",#FF8C00)",padding:"14px 20px",display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:28}}>🎁</span>
            <div>
              <p style={{fontWeight:900,color:"#000",fontSize:15,margin:0}}>¡1 mes ÉLITE completamente gratis!</p>
              <p style={{fontSize:12,color:"rgba(0,0,0,0.65)",margin:0}}>No se realiza ningún cargo hoy · Cancela antes del día 30</p>
            </div>
          </div>
        )}

        <div style={{padding:24}}>
          {/* ── HEADER ── */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <span style={{padding:"3px 10px",borderRadius:4,fontSize:11,fontWeight:900,color:col,background:col+"22",border:"1px solid "+col+"44"}}>{plan.toUpperCase()}</span>
                {plan==="elite"&&nuncaTuvoElite&&<span style={{padding:"3px 10px",borderRadius:4,fontSize:11,fontWeight:900,color:"#000",background:"linear-gradient(135deg,"+col+",#FF8C00)"}}>30 DÍAS GRATIS</span>}
              </div>
              <p style={{fontWeight:900,fontSize:22,color:"#F0F0FA",margin:0}}>
                {plan==="elite"&&nuncaTuvoElite ? "0,00€" : PLAN_PRICES[plan]+"€"}
                <span style={{fontSize:13,color:"#44445A",fontWeight:400}}>{plan==="elite"&&nuncaTuvoElite?" hoy":"/mes"}</span>
              </p>
              {plan==="elite"&&nuncaTuvoElite&&<p style={{fontSize:11,color:"#44445A",margin:"2px 0 0"}}>Luego 49,99€/mes · Cancela cuando quieras</p>}
            </div>
            <button onClick={onClose} style={{background:"none",border:"1px solid #1E1E30",borderRadius:8,color:"#44445A",cursor:"pointer",padding:"6px 12px",fontSize:14}}>✕</button>
          </div>

          {/* ── BENEFICIOS ── */}
          <div style={{background:col+"0A",border:"1px solid "+col+"22",borderRadius:12,padding:"14px",marginBottom:20}}>
            <p style={{fontSize:10,color:col,fontWeight:800,letterSpacing:2,textTransform:"uppercase" as const,marginBottom:10}}>Incluye en el plan {plan.toUpperCase()}</p>
            <div style={{display:"flex",flexDirection:"column" as const,gap:6}}>
              {PLAN_FEATURES[plan].map(f=>(
                <div key={f} style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{color:col,fontSize:13,flexShrink:0}}>✓</span>
                  <span style={{fontSize:13,color:"#aaa"}}>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── STRIPE CARD ── */}
          <div style={{background:"#111118",border:"1px solid #1E1E30",borderRadius:12,padding:"16px",marginBottom:16}}>
            <p style={{fontSize:11,color:"#44445A",textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:12,fontWeight:700}}>Datos de tarjeta</p>
            {mounted ? (
              <div ref={cardRef} style={{minHeight:28}}/>
            ) : (
              <div style={{minHeight:28,display:"flex",alignItems:"center"}}>
                <p style={{color:"#44445A",fontSize:11}}>Cargando formulario seguro…</p>
              </div>
            )}
            {!ready&&mounted&&<p style={{color:"#44445A",fontSize:11,marginTop:8}}>Cargando formulario seguro…</p>}
            {err&&<p style={{color:"#FF4455",fontSize:12,marginTop:8}}>⚠ {err}</p>}
            <div style={{display:"flex",alignItems:"center",gap:6,marginTop:12,paddingTop:12,borderTop:"1px solid #1E1E30"}}>
              <span style={{fontSize:14}}>🔒</span>
              <span style={{color:"#44445A",fontSize:11}}>Pago cifrado con Stripe · Datos seguros</span>
            </div>
          </div>

          {/* ── LOGOS TARJETAS ── */}
          <div style={{display:"flex",gap:6,marginBottom:16}}>
            {["VISA","Mastercard","AMEX"].map(c=>(
              <span key={c} style={{border:"1px solid #1E1E30",borderRadius:4,padding:"2px 8px",color:"#44445A",fontSize:10,letterSpacing:1}}>{c}</span>
            ))}
          </div>

          {/* ── BOTÓN ── */}
          <button
            onClick={pay}
            disabled={!ready||loading}
            style={{
              width:"100%",padding:"15px",
              background:!ready||loading?"#222":"linear-gradient(135deg,"+col+","+(plan==="elite"?"#FF8C00":col)+"BB)",
              border:"none",borderRadius:12,
              color:!ready||loading?"#555":"#000",
              fontFamily:"'DM Sans',sans-serif",fontWeight:900,fontSize:15,
              cursor:!ready||loading?"not-allowed":"pointer",
              boxShadow:!ready||loading?"none":"0 4px 20px "+col+"44",
              transition:"all 0.2s",
            }}
          >
            {loading?"⟳ Procesando...":
             plan==="elite"&&nuncaTuvoElite?"Activar 30 días gratis →":
             "Activar "+plan.toUpperCase()+" por "+PLAN_PRICES[plan]+"€/mes →"}
          </button>

          <p style={{color:"#333",fontSize:10,textAlign:"center" as const,marginTop:10,lineHeight:1.6}}>
            {plan==="elite"?"Sin cargo hoy · Se cobra 49,99€ al día 30 · ":""}
            Cancela cuando quieras desde tu perfil
          </p>
        </div>
      </div>
    </div>
  );
}
function PresupuestoForm({msg,proId,proName,proPlan,proRating,onClose,onSent}:{msg:string;proId:string;proName:string;proPlan:string;proRating:number;onClose:()=>void;onSent:()=>void}){
  const [price,setPrice]=useState("");
  const [desc,setDesc]=useState("");
  const [time,setTime]=useState("1-2 días");
  const [sending,setSending]=useState(false);

  // Extraer request_id del mensaje
  const send=async()=>{
    if(!price||!desc)return;
    setSending(true);
    // Buscar la solicitud más reciente abierta que coincida
    const {data:requests}=await db.from("budget_requests")
      .select("*").eq("status","open")
      .order("created_at",{ascending:false}).limit(10);
    if(requests&&requests.length>0){
      // Buscar la que coincida con el oficio del pro
      const req=requests[0];
      // Verificar que no haya más de 3 ofertas
      const {count}=await db.from("budget_offers").select("id",{count:"exact"} as any).eq("request_id",req.id);
      if((count||0)>=3){setSending(false);onClose();return;}
      await db.from("budget_offers").insert({
        request_id:req.id,
        pro_id:proId,pro_name:proName,
        pro_plan:proPlan,pro_rating:proRating,
        price:parseInt(price),
        description:desc,
        time_estimate:time,
        status:"pending",
      });
    }
    setSending(false);
    onSent();
  };

  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:8}}>
        <input value={price} onChange={e=>setPrice(e.target.value)} placeholder="Tu precio (€)" type="number" style={{flex:1,background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"9px 10px",color:C.text,fontFamily:"inherit",fontSize:13,outline:"none"}} />
        <select value={time} onChange={e=>setTime(e.target.value)} style={{flex:1,background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"9px 10px",color:C.text,fontFamily:"inherit",fontSize:12,outline:"none"}}>
          {["Mismo día","1-2 días","3-5 días","1 semana","Más de 1 semana"].map(t=><option key={t}>{t}</option>)}
        </select>
      </div>
      <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Describe tu propuesta..." rows={2} style={{width:"100%",background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"8px 10px",color:C.text,fontFamily:"inherit",fontSize:12,outline:"none",resize:"none",marginBottom:8,boxSizing:"border-box" as any}} />
      <div style={{display:"flex",gap:8}}>
        <button onClick={send} disabled={sending||!price||!desc} style={{flex:2,padding:"9px",background:sending||!price||!desc?"#222":"linear-gradient(135deg,"+C.accent+","+C.orange+")",border:"none",borderRadius:8,color:sending||!price||!desc?"#555":"#000",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:13,cursor:sending||!price||!desc?"not-allowed":"pointer"}}>
          {sending?"Enviando...":"Enviar presupuesto →"}
        </button>
        <button onClick={onClose} style={{flex:1,padding:"9px",background:"transparent",border:"1px solid "+C.border,borderRadius:8,color:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:12}}>Cancelar</button>
      </div>
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
  const [schedules,setSchedules]=useState<string[]>(user.schedule?user.schedule.split("|"):["Lunes a Viernes"]);
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
const [lastMsgByUser,setLastMsgByUser]=useState<Record<string,any>>({});
const [chatUser,setChatUser]=useState<UserRow|null>(null);
  const [stats,setStats]=useState({visits:0,contacts:0,reviews:0});
 const [urgentLead,setUrgentLead]=useState<{msg:string;fromId:string;isNuevoLead?:boolean;requestId?:string|null}|null>(null);
  const [showPresupuestoForm,setShowPresupuestoForm]=useState<{requestId:string;clientName:string;oficio:string;desc:string}|null>(null);
  const [inAppNotif,setInAppNotif]=useState<{msg:string;from:string;fromId:string;isAdmin:boolean}|null>(null);
  const [unreadMsgs,setUnreadMsgs]=useState(0);
  const [unreadByUser,setUnreadByUser]=useState<Record<string,number>>({});
  const daysLeft=trialDaysLeft(user.trial_end);
  const showToast=(m:string)=>{setToast(m);setTimeout(()=>setToast(null),3000);};
  const photoInputRef=useRef<HTMLInputElement>(null);
  const [photoFile,setPhotoFile]=useState<File|null>(null);
  const [photoPreview,setPhotoPreview]=useState<string>("");
  const [uploadingPhoto,setUploadingPhoto]=useState(false);
  const [showMapaPro,setShowMapaPro]=useState(false);
  const [showPosMap,setShowPosMap]=useState(false);
  const [showStripeModal,setShowStripeModal]=useState<{priceId:string;plan:Plan}|null>(null);
  const photoLimit=PLAN_GATES.photos[user.plan as Plan] as number;
  const canAddPhoto=photoLimit===999||photos.length<photoLimit;

  // Pedir permiso de notificaciones push
  useEffect(()=>{
    if("Notification" in window && Notification.permission==="default"){
      setTimeout(()=>{
        Notification.requestPermission().then(perm=>{
          if(perm==="granted"){
            new Notification("🔔 OfficioYa activado",{
              body:"Recibirás alertas de nuevos clientes aunque el móvil esté bloqueado",
              icon:"/icon-192.png",
            });
          }
        });
      },3000);
    }
  },[]);

  useEffect(()=>{
    db.from("certificates").select("*").eq("worker_id",user.id).then(({data}:any)=>setCerts(data||[]));
    db.from("photos").select("*").eq("worker_id",user.id).order("created_at",{ascending:false}).then(({data}:any)=>setPhotos(data||[]));
    db.from("jobs").select("*").eq("worker_id",user.id).order("created_at",{ascending:false}).then(({data}:any)=>setJobs(data||[]));
    db.from("visits").select("id",{count:"exact"} as any).eq("user_id",user.id).then(({count}:any)=>setStats(s=>({...s,visits:count||0})));
    db.from("messages").select("id",{count:"exact"} as any).eq("to_id",user.id).then(({count}:any)=>setStats(s=>({...s,contacts:count||0})));
    db.from("reviews").select("id",{count:"exact"} as any).eq("worker_id",user.id).then(({count}:any)=>setStats(s=>({...s,reviews:count||0})));
    // Count unread
    db.from("messages").select("id",{count:"exact"} as any).eq("to_id",user.id).eq("read",false).then(({count}:any)=>setUnreadMsgs(count||0));
  },[user.id]);

  
const loadChats=useCallback(async()=>{
    // Traer todos los mensajes donde el pro es destinatario O remitente
    const {data:received}=await db.from("messages").select("from_id,to_id,text,read,created_at").eq("to_id",user.id);
    const {data:sent}=await db.from("messages").select("from_id,to_id,text,read,created_at").eq("from_id",user.id);
    const allMsgs=[...(received||[]),...(sent||[])];
    if(!allMsgs.length){setChatPartners([]);setUnreadByUser({});return;}

    // Sacar IDs únicos del otro lado de la conversación
    const ids=[...new Set(allMsgs.map((m:any)=>m.from_id===user.id?m.to_id:m.from_id))]
      .filter((id:string)=>id!=="00000000-0000-0000-0000-000000000001"&&id!=="00000000-0000-0000-0000-000000000002");
    if(!ids.length){setChatPartners([]);return;}

    const {data:ws}=await db.from("users").select("*").in("id",ids);
    if(!ws)return;

    // Último mensaje y timestamp por usuario
    const lastMsg:Record<string,any>={};
    allMsgs.forEach((m:any)=>{
      const partnerId=m.from_id===user.id?m.to_id:m.from_id;
      if(!lastMsg[partnerId]||new Date(m.created_at)>new Date(lastMsg[partnerId].created_at)){
        lastMsg[partnerId]=m;
      }
    });

    // Ordenar por último mensaje más reciente
    const sorted=[...ws].sort((a:any,b:any)=>{
      const ta=lastMsg[a.id]?.created_at||"";
      const tb=lastMsg[b.id]?.created_at||"";
      return new Date(tb).getTime()-new Date(ta).getTime();
    });

    setChatPartners(sorted);
    setLastMsgByUser(lastMsg);

    // Contar no leídos
   const counts:Record<string,number>={};
(received||[]).forEach((m:any)=>{
  if(!m.read&&m.from_id!=="00000000-0000-0000-0000-000000000001"&&m.from_id!=="00000000-0000-0000-0000-000000000002"){
    counts[m.from_id]=(counts[m.from_id]||0)+1;
  }
});
setUnreadByUser(counts);
setUnreadMsgs(Object.values(counts).reduce((a:number,b:number)=>a+b,0));
  },[user.id]);
// ── REALTIME: listen for new messages + lead alerts ── 
useEffect(()=>{ 
  const ch=db.channel("pro-realtime-"+user.id) 
  .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},(p:any)=>{
    console.log("MENSAJE RECIBIDO REALTIME:", p.new);
    const m=p.new;
    const isLeadAlert=m.from_id==="00000000-0000-0000-0000-000000000001"||m.text?.includes("NUEVO CLIENTE INTERESADO"); 
    const isAdmin=m.from_id==="00000000-0000-0000-0000-000000000002"; 
    if(isLeadAlert){
  const isNuevoLead=m.text.includes("NUEVO LEAD|REQUEST_ID:");
  // Extraer request_id del texto
  const reqMatch=m.text.match(/REQUEST_ID:([a-f0-9-]+)/);
  const requestId=reqMatch?reqMatch[1]:null;
  // Extraer nombre del cliente y detalles
  const clientInfo=m.text.replace(/.*REQUEST_ID:[a-f0-9-]+\|/,"");
const clientName=clientInfo.split(" necesita ")[0];
const oficio=clientInfo.split(" necesita ")[1]?.split(" en ")[0]||"";
const budget=m.text.match(/Máx: (\d+)€/)?.[1];
const msgClean=`👤 ${clientName}${budget?" · 💰 Máx "+budget+"€":""}`;
  setUrgentLead({msg:msgClean,fromId:m.from_id,isNuevoLead,requestId});
  setUnreadMsgs(c=>c+1);
  showPushNotification(
    "🔴 Nuevo trabajo — OfficioYa",
    "Un cliente necesita tus servicios ahora. Toca para aceptar."
  );
}
    else if(isAdmin){ 
      // ── Admin notification ── 
      setInAppNotif({msg:m.text.replace("[Soporte OfficioYa] ",""),from:"👑 OfficioYa Soporte",fromId:m.from_id,isAdmin:true}); 
      setUnreadMsgs(c=>c+1); 
      showPushNotification("👑 OfficioYa Soporte",m.text.replace("[Soporte OfficioYa] ","").substring(0,80)); 
    } 
    else { 
      // Normal message 
      db.from("users").select("name").eq("id",m.from_id).single().then(({data}:any)=>{ 
        const senderName=data?.name||"Cliente"; 
        setInAppNotif({msg:m.text.substring(0,60)+(m.text.length>60?"...":""),from:senderName,fromId:m.from_id,isAdmin:false}); 
        setUnreadMsgs(c=>c+1); 
        showPushNotification("💬 "+senderName,m.text.substring(0,80)); 
        loadChats();
      });
    }
  })
  .on("postgres_changes",{event:"INSERT",schema:"public",table:"jobs"},(p:any)=>{
    const job=p.new;
    // Si es urgente y es del oficio del profesional → mostrar alerta
    if(job.es_urgente&&job.worker_id===null){
      const lista=job.profesionales_aceptados||[];
      if(lista.length<4&&!lista.includes(user.id)){
      setUrgentLead({msg:"⚡ "+job.client_name+" necesita un "+job.title.replace("Busca ","").replace(" — urgente","")+" ahora · "+job.description,fromId:job.id});  
      }
    }
    // Si es un trabajo asignado directamente a este pro
   if(job.worker_id===user.id){
      setJobs(prev=>[job,...prev]);
      showToast("🔔 Nueva solicitud de trabajo de "+job.client_name);
    }
  })
  // Escuchar también inserciones en requests para alerta directa
  .on("postgres_changes",{event:"INSERT",schema:"public",table:"requests"},(p:any)=>{
    const req=p.new;
    if(req.oficio===user.trade&&req.urgency==="urgente"){
      setUrgentLead({msg:"🔴 "+req.client_name+" busca un "+req.oficio+" urgente en "+req.zona,fromId:req.id});
        showPushNotification("🔴 Cliente urgente — OfficioYa","Un cliente necesita tus servicios ahora. Toca para responder.");
    }
  })
  .subscribe((status:any)=>{console.log("PRO REALTIME STATUS:", status);});
    return ()=>{db.removeChannel(ch);};
},[user.id,loadChats]);
  // ── POLLING fallback para leads ──
useEffect(()=>{
  const poll=setInterval(async()=>{
    const {data}=await db.from("messages")
      .select("*")
      .eq("to_id",user.id)
      .eq("is_lead_alert",true)
      .eq("read",false)
      .order("created_at",{ascending:false})
      .limit(5);
    if(data&&data.length>0){
      const m=data[0];
      const isNuevoLead=m.text.includes("NUEVO LEAD|REQUEST_ID:");
      const reqMatch=m.text.match(/REQUEST_ID:([a-f0-9-]+)/);
      const requestId=reqMatch?reqMatch[1]:null;
      const clientInfo=m.text.replace(/.*REQUEST_ID:[a-f0-9-]+\|/,"");
const clientName=clientInfo.split(" necesita ")[0];
const oficio=clientInfo.split(" necesita ")[1]?.split(" en ")[0]||"";
const budget=m.text.match(/Máx: (\d+)€/)?.[1];
const msgClean=`👤 ${clientName}${budget?" · 💰 Máx "+budget+"€":""}`;
      setUrgentLead(prev=>{
        if(prev?.requestId===requestId)return prev;
        return {msg:msgClean,fromId:m.from_id,isNuevoLead,requestId};
      });
    }
  },3000);
  return ()=>clearInterval(poll);
},[user.id]);
  useEffect(()=>{
    if(tab==="chats"){
      loadChats();
      const poll=setInterval(()=>loadChats(),2000);
      return ()=>clearInterval(poll);
    }
  },[tab,loadChats]);

  const saveProfile=async()=>{
    setSaving(true);
    const upd={bio,price:parseInt(price)||30,available,schedule:schedules.join("|"),response_time:responseTime,free_quote:freeQuote,experience_years:parseInt(expYears)||0,specialties,service_zones:serviceZones,whatsapp};
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

  const addPhoto=async()=>{
    if(!canAddPhoto){showToast("⛔ Límite de fotos alcanzado. Mejora a Pro.");return;}
    if(!photoCaption.trim()&&!photoFile)return;
    setUploadingPhoto(true);
    let url="";
    if(photoFile){
      if(photoFile.size>5*1024*1024){showToast("⛔ Imagen demasiado grande (máx. 5MB)");setUploadingPhoto(false);return;}
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
    "Electricista":["Domótica","Fotovoltaica","Cuadros eléctricos","Instalación industrial","LED y iluminación","Cargadores VE","Mantenimiento","Averías urgentes"],
    "Fontanero":["Calderas","Calefacción","Suelo radiante","Piscinas","Urgencias","Gas","Tuberías","Grifería"],
    "Cerrajero":["Apertura 24h","Cajas fuertes","Bombines","Puertas acorazadas","Control de acceso","Rejas","Persianas","Urgencias"],
    "Desatascos y Camión Cuba":["Desatascos urgentes","Camión cuba","Limpieza tuberías","Cámaras inspección","Pozos sépticos","Alcantarillado"],
    "Técnico de Gas":["Instalación gas natural","Butano y propano","Calderas de gas","Fugas de gas","Certificados gas","Mantenimiento"],
    "Climatización":["Aire acondicionado","Bomba de calor","Ventilación","Mantenimiento","Instalación","Reparación","Frío industrial"],
    "Albañil":["Reformas integrales","Tabiques","Azulejos","Fachadas","Pladur","Terrazas","Solados","Enfoscados"],
    "Pintor":["Microcemento","Stucco veneciano","Pintura exterior","Decoración","Gotelé","Barnizado","Pintura industrial","Impermeabilización"],
    "Carpintero":["Muebles a medida","Tarimas","Puertas","Cocinas","Armarios","Madera maciza","Restauración","Pergolas"],
    "Reformas Integrales":["Cocinas","Baños","Locales comerciales","Viviendas completas","Oficinas","Presupuesto gratuito"],
    "Soldador":["Soldadura MIG","Soldadura TIG","Estructuras metálicas","Rejas y puertas","Acero inoxidable","Aluminio"],
    "Instalador Solar":["Placas solares","Autoconsumo","Baterías","Mantenimiento","Subvenciones","Monitorización"],
    "Yesero":["Techos de escayola","Molduras","Pladur","Tabiques","Reparaciones","Decoración"],
    "Techador":["Impermeabilización","Tejas","Pizarra","Chapa metálica","Reparaciones","Canalones"],
    "Montador de Pladur":["Tabiques","Techos","Trasdosados","Aislamiento","Reformas","Instalaciones"],
    "Parquetista / Pulidor de Suelos":["Parquet","Tarima flotante","Pulido","Barnizado","Laminado","Microcemento"],
    "Cristalero":["Ventanas","Mamparas","Espejos","Vidrios especiales","Doble acristalamiento","Reparaciones"],
    "Manitas a Domicilio":["Montaje muebles","Pequeñas reparaciones","Instalaciones","Pintura","Fontanería básica","Electricidad básica"],
    "Jardinero":["Diseño jardines","Riego automático","Poda","Comunidades","Céspedes","Árboles","Jardines verticales","Piscinas"],
    "Fumigador":["Cucarachas","Ratas y ratones","Mosquitos","Avispas","Termitas","Desinfección","Empresas y comunidades"],
    "Tapicero":["Sofás","Sillas","Cabeceros","Cortinas","Toldos","Restauración","Náutica"],
    "Mecánico":["Coches","Motos","Revisiones","Frenos","Cambio aceite","Averías","ITV","Electricidad del vehículo"],
    "Mudanzas y Portes":["Mudanzas locales","Mudanzas nacionales","Portes","Montaje muebles","Guardamuebles","Embalaje"],
    "Servicio Doméstico / Limpieza":["Limpieza hogar","Limpieza de oficinas","Limpieza fin de obra","Planchado","Cuidado del hogar","Por horas"],
    "Limpieza de Cristales y Fachadas":["Cristales en altura","Fachadas","Comunidades","Empresas","Andamios","Góndola"],
    "Informático / Reparación de PC":["Reparación ordenadores","Virus y malware","Redes WiFi","Recuperación datos","Portátiles","Impresoras"],
    "Configuración de Domótica y WiFi":["Smart home","Alexa y Google Home","WiFi mesh","Cámaras IP","Automatización","Programación"],
    "Instalador de Antenas y Satélite":["Antenas TDT","Satélite","Amplificadores","Comunidades","Fibra óptica","CCTV"],
    "Cuidado de Mayores y Dependientes":["Acompañamiento","Higiene personal","Medicación","Alzheimer","Movilidad reducida","Noches"],
    "Niñera / Babysitter":["Bebés","Niños pequeños","Después del colegio","Fines de semana","Verano","Idiomas"],
    "Fisioterapeuta a Domicilio":["Rehabilitación","Masajes","Lesiones deportivas","Mayores","Postoperatorio","Pilates"],
    "Peluquería y Estética a Domicilio":["Corte y color","Mechas","Manicura","Pedicura","Depilación","Maquillaje","Novias"],
    "Peluquería Canina a Domicilio":["Baño y corte","Razas pequeñas","Razas grandes","Deslanado","Uñas","Orejas"],
    "Cuidador / Paseador de Perros":["Paseos diarios","Guardería","Hotel canino","Cachorros","Razas grandes","Varios perros"],
    "Adiestrador Canino":["Cachorros","Obediencia básica","Agresividad","Ansiedad separación","Razas peligrosas","Clicker"],
    "Veterinario a Domicilio":["Vacunas","Desparasitación","Revisiones","Urgencias","Analíticas","Microchip"],
    "Cocinero":["Eventos privados","Menú diario","Cocina mediterránea","Cocina internacional","Dietas especiales","Catering"],
    "Zapatero":["Reparación calzado","Tacones","Suelas","Bolsos","Cinturones","Restauración cuero"],
    "Montador de Estructuras":["Carpas","Escenarios","Andamios","Exposiciones","Ferias","Eventos"],
    "Ceramista / Alfarero":["Piezas únicas","Encargos","Talleres","Restauración","Azulejos artesanales","Decoración"],
    "Bordador de Oro y Seda":["Mantos","Pasos de Semana Santa","Trajes de flamenca","Restauración","Encargos","Insignias"],
    "Orfebre":["Joyería artesanal","Restauración","Platería","Encargos","Semana Santa","Reparaciones"],
    "Guarnicionero":["Sillas de montar","Arreos","Restauración","Cuero artesanal","Encargos a medida"],
    "Costurero/a Flamenca":["Trajes de flamenca","Arreglos","Complementos","Encargos","Niños","Hombre"],
    "Lutier":["Guitarras","Violines","Reparación","Restauración","Encargos","Ajuste y afinación"],
    "Imaginero / Escultor":["Imágenes religiosas","Restauración","Encargos","Madera policromada","Semana Santa"],
    "Abaniquero":["Abanicos artesanales","Restauración","Encargos","Varillaje","Telas especiales"],
    "Encuadernador Artesanal":["Libros artesanales","Restauración","Álbumes","Cuadernos","Encargos"],
    "Tallista de Castañuelas":["Castañuelas profesionales","Encargos","Restauración","Madera seleccionada"],
    "Otros servicios":["Consultar disponibilidad","Presupuesto sin compromiso","Servicio personalizado"],
  };
  
  const availableSpecialties=SPECIALTIES_BY_TRADE[user.trade||""]||["Especialidad 1","Especialidad 2","Especialidad 3"];

  // Build a fake "system" user object for lead alert chats
  const systemUser:UserRow={id:"00000000-0000-0000-0000-000000000001",name:"Clientes OfficioYa",email:"",password:"",phone:"",type:"cliente",plan:"gratis",bio:"",price:0,trade:"",zone:"",rating:0,reviews:0,jobs:0,verified:true,available:true,whatsapp:"",service_zones:[],schedule:"",response_time:"",free_quote:false,experience_years:0,specialties:[],trial_end:"",joined_at:""};

  return(
    <div style={{minHeight:"100dvh",background:C.bg,backgroundImage:"radial-gradient(ellipse at 70% 0%,#2a0a3a18,transparent 50%)",paddingBottom:72}}>

      {/* ── URGENT LEAD BANNER ── */}
{urgentLead&&(
  <UrgentLeadBanner
    msg={urgentLead.msg}
    jobId={urgentLead.fromId}
    proId={user.id}
    requestId={urgentLead.requestId||null}
    onClose={()=>setUrgentLead(null)}
    onClick={async()=>{await db.from("messages").update({read:true}).eq("to_id",user.id).eq("is_lead_alert",true).eq("read",false);
      if(urgentLead.isNuevoLead&&urgentLead.requestId){
        // Marcar como aceptado en budget_requests
        const {data:req}=await db.from("budget_requests")
          .select("*").eq("id",urgentLead.requestId).single();
        if(req){
          // Añadir pro a la lista de aceptados
          const accepted=[...(req.accepted_pros||[]),user.id];
          await db.from("budget_requests").update({
            accepted_pros:accepted,
            status:accepted.length>=3?"closed":"open",
          }).eq("id",urgentLead.requestId);
          // Abrir chat con el cliente automáticamente
          const {data:cliente}=await db.from("users").select("*").eq("id",req.client_id).single();
          if(cliente){
            // Enviar mensaje inicial al cliente
            await db.from("messages").insert({
              from_id:user.id,
              to_id:req.client_id,
              text:`¡Hola ${req.client_name}! He visto tu solicitud de ${req.oficio} en ${req.zona}. Estoy disponible para ayudarte. ¿Cuándo te viene bien?`,
              read:false,
            });
            await db.from("jobs").insert({
  worker_id:user.id,
  client_id:req.client_id,
  client_name:req.client_name,
  title:req.oficio,
  description:req.description,
  status:"in_progress",
});
setUrgentLead(null);
loadChats();
setTab("chats");
setChatUser(cliente as UserRow);
          }
        }
      } else {
        setUrgentLead(null);
        setTab("chats");
        loadChats();
      }
    }}
  />
)}
      {urgentLead&&urgentLead.isPresupuesto&&(
  <div style={{position:"fixed",bottom:88,right:16,zIndex:20000,background:"#111118",border:"2px solid "+C.accent,borderRadius:16,padding:"16px",maxWidth:320,boxShadow:"0 10px 30px "+C.accent+"44"}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
      <span style={{fontSize:24}}>📋</span>
      <div style={{flex:1}}>
        <p style={{fontWeight:900,color:C.accent,fontSize:13,margin:0}}>SOLICITUD DE PRESUPUESTO</p>
        <p style={{fontSize:10,color:C.muted,margin:0}}>Sé de los 3 primeros en responder</p>
      </div>
      <button onClick={()=>setUrgentLead(null)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>✕</button>
    </div>
    <p style={{fontSize:12,color:C.text,lineHeight:1.6,marginBottom:14}}>{urgentLead.msg.replace("🔴 *NUEVO PRESUPUESTO SOLICITADO*\n\n","")}</p>
    <PresupuestoForm
      msg={urgentLead.msg}
      proId={user.id}
      proName={user.name}
      proPlan={user.plan}
      proRating={user.rating}
      onClose={()=>setUrgentLead(null)}
      onSent={()=>{setUrgentLead(null);showToast("✅ Presupuesto enviado");}}
    />
  </div>
)}
      {/* ── Admin / normal notification ── */}
      {inAppNotif&&(
        <InAppNotification
          msg={inAppNotif.msg} from={inAppNotif.from}
          isAdmin={inAppNotif.isAdmin}
          onClose={()=>setInAppNotif(null)}
          onClick={()=>{
            setInAppNotif(null);
            const c=chatPartners.find(x=>x.id===inAppNotif.fromId);
            if(inAppNotif.isAdmin){setTab("chats");loadChats();}
            else if(c)setChatUser(c);
            else{setTab("chats");loadChats();}
          }}
        />
      )}

     <header style={{
        background:"rgba(10,10,15,0.96)",
        backdropFilter:"blur(20px)",
        borderBottom:"1px solid "+C.border,
        position:"sticky",
        top:0,
        zIndex:100,
        paddingTop: "env(safe-area-inset-top)" // Fix para iPhone
      }}>
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
              const unread=unreadByUser[c.id]||0;
              return <GCard key={c.id} onClick={async()=>{
  await db.from("messages").update({read:true}).eq("to_id",user.id).eq("from_id",c.id).eq("read",false);
  setUnreadByUser(p=>({...p,[c.id]:0}));
  setUnreadMsgs(prev=>Math.max(0,prev-(unreadByUser[c.id]||0)));
  setChatUser(c);
  db.from("messages").update({read:true}).eq("to_id",user.id).eq("from_id",c.id).eq("read",false);
}} glow={col}>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  <Ava s={c.name.substring(0,2).toUpperCase()} size={44} color={col} />
                  <div style={{flex:1,minWidth:0}}>
  <p style={{fontWeight:700,color:C.text,fontSize:14}}>{c.name}</p>
  <p style={{fontSize:12,color:unread>0?C.text:C.muted,fontWeight:unread>0?600:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>
    {lastMsgByUser[c.id]?.text
      ? (lastMsgByUser[c.id].from_id===user.id?"Tú: ":"")+lastMsgByUser[c.id].text.substring(0,40)+(lastMsgByUser[c.id].text.length>40?"...":"")
      : "Toca para responder"}
  </p>
</div>
{lastMsgByUser[c.id]?.created_at&&(
  <span style={{fontSize:10,color:C.muted,flexShrink:0,marginRight:4}}>{timeAgo(lastMsgByUser[c.id].created_at)}</span>
)}
                  {unreadByUser[c.id]>0?(
  <span style={{
    minWidth:20,height:20,borderRadius:99,
    background:"linear-gradient(135deg,"+C.green+",#00A870)",
    color:"#000",display:"flex",alignItems:"center",justifyContent:"center",
    fontSize:10,fontWeight:900,flexShrink:0,padding:"0 5px",
    boxShadow:"0 2px 8px "+C.green+"55",
  }}>{unreadByUser[c.id]>9?"9+":unreadByUser[c.id]}</span>
):(
  <span style={{fontSize:12,color:col}}>→</span>
)}
                </div>
              </GCard>;
            })}
          </div>}
        </>)}

        {tab==="trabajos"&&(<>
          <div style={{padding:"22px 0 16px"}}><h2 style={{fontWeight:800,fontSize:22,color:C.text}}>Mis trabajos</h2></div>
          {/* ── LEADS PENDIENTES ── */}
          {jobs.filter((j:any)=>j.status==="lead").length>0&&(
            <div style={{marginBottom:16}}>
              <p style={{fontSize:11,color:C.orange,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:8}}>🔴 Solicitudes nuevas</p>
              {jobs.filter((j:any)=>j.status==="lead").map((j:any)=>(
                <GCard key={j.id} style={{marginBottom:8,border:"1px solid "+C.orange+"44",background:"#1a1500"}}>
                  <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}>
                    <div style={{flex:1}}>
                      <p style={{fontWeight:700,color:C.text,fontSize:14,marginBottom:3}}>{j.title}</p>
                      <p style={{fontSize:12,color:C.muted}}>👤 {j.client_name} · {timeAgo(j.created_at)}</p>
                      {j.description&&<p style={{fontSize:12,color:C.mutedL,marginTop:4,lineHeight:1.4}}>{j.description}</p>}
                    </div>
                    <span style={{fontSize:9,color:C.orange,background:C.orange+"22",padding:"2px 7px",borderRadius:3,fontWeight:700,flexShrink:0}}>NUEVO</span>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={async()=>{
                      await updateJobStatus(j.id,"in_progress");
                      // Abrir chat con cliente
                      const {data:cliente}=await db.from("users").select("*").eq("id",j.client_id).single();
                      if(cliente){
                        await db.from("messages").insert({
                          from_id:user.id,to_id:j.client_id,
                          text:`¡Hola ${j.client_name}! He visto tu solicitud de ${j.title}. Estoy disponible para ayudarte. ¿Cuándo te viene bien?`,
                          read:false,
                        });
                        setChatUser(cliente as UserRow);
                      }
                    }} style={{flex:2,padding:"9px",background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",border:"none",borderRadius:8,color:"#000",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:800,cursor:"pointer"}}>
                      ✓ Aceptar y chatear →
                    </button>
                    <button onClick={()=>updateJobStatus(j.id,"cancelled")} style={{padding:"9px 12px",background:C.red+"15",border:"1px solid "+C.red+"33",borderRadius:8,color:C.red,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>
                      Rechazar
                    </button>
                  </div>
                </GCard>
              ))}
            </div>
          )}
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
              <GCard key={j.id} style={{padding:0,overflow:"hidden"}}>
                {/* Barra lateral de color según estado */}
                <div style={{display:"flex"}}>
                  <div style={{width:4,flexShrink:0,background:
                    j.status==="pending"?C.orange:
                    j.status==="in_progress"?C.blue:
                    j.status==="done"?C.green:C.muted,
                    borderRadius:"4px 0 0 4px",
                  }} />
                  <div style={{flex:1,padding:14}}>
                    <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}>
                      <div style={{flex:1}}>
                        <p style={{fontWeight:700,color:C.text,fontSize:14,marginBottom:3}}>{j.title}</p>
                        <p style={{fontSize:12,color:C.muted}}>👤 {j.client_name} · {timeAgo(j.created_at)}</p>
                        {j.description&&<p style={{fontSize:12,color:C.mutedL,marginTop:4,lineHeight:1.4}}>{j.description}</p>}
                      </div>
                      <StatusDot status={j.status} />
                    </div>

                    {/* ── ACCIONES SEGÚN ESTADO ── */}
                    {j.status==="pending"&&(
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        <button onClick={()=>updateJobStatus(j.id,"in_progress")} style={{
                          flex:1,padding:"9px 12px",
                          background:"linear-gradient(135deg,"+C.blue+","+C.blue+"BB)",
                          border:"none",borderRadius:8,color:"#fff",
                          cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:700,
                          boxShadow:"0 4px 12px "+C.blue+"33",
                        }}>✓ Aceptar y añadir a agenda</button>
                        <button onClick={()=>updateJobStatus(j.id,"cancelled")} style={{
                          padding:"9px 12px",background:C.red+"15",
                          border:"1px solid "+C.red+"33",borderRadius:8,color:C.red,
                          cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:600,
                        }}>Rechazar</button>
                      </div>
                    )}

                    {j.status==="in_progress"&&(
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        <button onClick={()=>updateJobStatus(j.id,"done")} style={{
                          flex:1,padding:"9px 12px",
                          background:"linear-gradient(135deg,"+C.green+","+C.green+"BB)",
                          border:"none",borderRadius:8,color:"#000",
                          cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:800,
                          boxShadow:"0 4px 12px "+C.green+"33",
                        }}>🏁 Marcar finalizado · Cobrar</button>
                        <button onClick={()=>updateJobStatus(j.id,"cancelled")} style={{
                          padding:"9px 12px",background:C.red+"15",
                          border:"1px solid "+C.red+"33",borderRadius:8,color:C.red,
                          cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:600,
                        }}>Cancelar</button>
                      </div>
                    )}

                    {j.status==="done"&&(
                      <div style={{
                        padding:"8px 12px",background:C.green+"12",
                        border:"1px solid "+C.green+"33",borderRadius:8,
                        display:"flex",alignItems:"center",gap:8,
                      }}>
                        <span style={{fontSize:14}}>✅</span>
                        <span style={{fontSize:12,color:C.green,fontWeight:700}}>Trabajo completado · Pendiente de cobro / archivado</span>
                      </div>
                    )}

                    {j.status==="cancelled"&&(
                      <div style={{
                        padding:"8px 12px",background:C.red+"10",
                        border:"1px solid "+C.red+"22",borderRadius:8,
                      }}>
                        <span style={{fontSize:12,color:C.muted}}>Trabajo cancelado</span>
                      </div>
                    )}
                  </div>
                </div>
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
            <Toggle value={(user as any).show_on_map||false} onChange={async v=>{await db.from("users").update({show_on_map:v}).eq("id",user.id);onUpdate({...user,show_on_map:v} as any);showToast(v?"📍 Apareces en el mapa":"Ya no apareces en el mapa");}} label="📍 Aparecer en el mapa para clientes" />
            {(user as any).show_on_map&&(
              <div style={{padding:"10px 12px",background:"#FFD70012",border:"1px solid #FFD70033",borderRadius:8,marginTop:4}}>
                <p style={{fontSize:12,color:"#FFD700",marginBottom:8}}>📍 Tu posición en el mapa</p>
                <button onClick={()=>{
                  if(navigator.geolocation){
                    navigator.geolocation.getCurrentPosition(async pos=>{
                      const lat=pos.coords.latitude;
                      const lng=pos.coords.longitude;
                      await db.from("users").update({map_lat:lat,map_lng:lng}).eq("id",user.id);
                      onUpdate({...user,map_lat:lat,map_lng:lng} as any);
                      showToast("✓ Posición actualizada en el mapa");
                    },()=>showToast("⛔ No pudimos obtener tu ubicación"));
                  }
                }} style={{width:"100%",padding:"9px",background:"linear-gradient(135deg,#FFD700,#FF8C00)",border:"none",borderRadius:8,color:"#000",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                  📍 Usar mi ubicación actual
                </button>
                {(user as any).map_lat&&<p style={{fontSize:11,color:"#00D68F",marginTop:6,textAlign:"center" as const}}>✓ Posición guardada</p>}
              </div>
            )}
          </GCard>
          <GCard style={{marginBottom:14}}>
            <p style={{fontWeight:700,color:C.text,fontSize:13,marginBottom:12}}>Disponibilidad y respuesta</p>
            <div style={{marginBottom:14}}>
              <p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Horario de trabajo</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {SCHEDULES.map(s=>{
                  const sel=schedules.includes(s);
                  return <button key={s} onClick={()=>setSchedules(prev=>sel?prev.filter(x=>x!==s):[...prev,s])} style={{padding:"6px 12px",borderRadius:99,border:"1px solid "+(sel?C.accent:C.border),background:sel?C.accent+"18":"transparent",color:sel?C.accent:C.muted,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:sel?700:400,transition:"all 0.15s"}}>{s}</button>;
                })}
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
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
    <p style={{fontWeight:700,color:C.text,fontSize:13}}>📍 Zonas de servicio</p>
    <button onClick={()=>setShowMapaPro(true)} style={{padding:"6px 12px",background:"linear-gradient(135deg,#1C1A0A,#141208)",border:"1.5px solid "+C.accent+"44",borderRadius:8,color:C.accent,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:11,display:"flex",alignItems:"center",gap:5}}>
      <span>🗺️</span> Editar en mapa
    </button>
  </div>
  {serviceZones.length===0
    ?<p style={{fontSize:12,color:C.muted}}>Sin zonas · Pulsa "Editar en mapa"</p>
    :<div style={{display:"flex",flexWrap:"wrap",gap:5}}>
      {serviceZones.map(z=><span key={z} style={{fontSize:11,padding:"3px 9px",borderRadius:99,background:C.accent+"15",color:C.accent,border:"1px solid "+C.accent+"33"}}>{z}</span>)}
    </div>
  }
</GCard>
          <GCard style={{marginBottom:14}}><MultiSelect label="Tus especialidades" options={availableSpecialties} selected={specialties} onChange={setSpecialties} /></GCard>
          <GCard style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <p style={{fontWeight:700,color:C.text,fontSize:13}}>📸 Fotos de trabajos realizados</p>
              <span style={{fontSize:10,color:photoLimit<999?C.muted:C.green,background:C.surface,padding:"2px 7px",borderRadius:4,border:"1px solid "+C.border}}>
                {photoLimit<999?photos.length+"/"+photoLimit+" fotos":"Sin límite"}
              </span>
            </div>
            {!canAddPhoto&&<div style={{padding:"10px 12px",background:C.orange+"12",borderRadius:8,border:"1px solid "+C.orange+"22",marginBottom:10}}>
              <p style={{fontSize:12,color:C.orange}}>⚠️ Límite alcanzado. <button onClick={()=>setTab("planes")} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:12,fontWeight:700,padding:0}}>Mejora tu plan →</button></p>
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
              {!isCurrent&&<button onClick={async()=>{
  if(pl==="gratis"){
    await db.from("users").update({plan:"gratis",stripe_subscription_id:null}).eq("id",user.id);
    onUpdate({...user,plan:"gratis"});
    showToast("✓ Vuelto a plan gratuito");
    return;
  }
  const priceMap:Record<string,string>={
    basico:"price_1TYugfCZe2kZYfZChXHjTrsg",
    pro:"price_1TYuioCZe2kZYfZChYFbWcrt",
    elite:(user as any).stripe_customer_id?"price_1TYxjFCZe2kZYfZCNN2TBfzs":"price_1TYuneCZe2kZYfZCxD24mHGx",
  };
  setShowStripeModal({priceId:priceMap[pl],plan:pl});
}} style={{marginTop:14,width:"100%",padding:"11px",background:pl==="pro"?"linear-gradient(135deg,"+col+","+C.orange+")":"transparent",border:"1px solid "+col+"66",borderRadius:8,color:pl==="pro"?"#000":col,fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer"}}>
  {pl==="gratis"?"Volver a gratuito →":"Activar "+pl.toUpperCase()+" por "+PLAN_PRICES[pl]+"€/mes →"}
</button>}
              </div>;
            })}
         </div>
          <div style={{height:40}} />
        </>)}
      </div>
    <nav style={{
        position:"fixed",
        bottom:0,
        left:0,
        right:0,
        background:"rgba(10,10,15,0.98)",
        backdropFilter:"blur(25px) saturate(200%)",
        borderTop:"1px solid "+C.border,
        display:"flex",
        zIndex:200,
        paddingBottom: "calc(10px + env(safe-area-inset-bottom))", // Fix para iPhone
        paddingTop: "10px"
      }}>
        {([["inicio","🏠","Inicio"],["chats","💬","Mensajes"],["trabajos","🔨","Trabajos"],["perfil","👤","Perfil"],["planes","💎","Planes"]] as const).map(([id,icon,label])=>(
          <button key={id} onClick={()=>setTab(id as any)} style={{flex:1,padding:"8px 2px 10px",background:"none",border:"none",color:tab===id?C.accent:C.muted,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,transition:"color 0.15s",position:"relative"}}>
            <span style={{fontSize:18,position:"relative"}}>
              {icon}
              {id==="chats"&&unreadMsgs>0&&tab!=="chats"&&(
                <span style={{position:"absolute",top:-4,right:-4,background:C.red,color:"#fff",borderRadius:99,minWidth:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,border:"1.5px solid "+C.bg,padding:"0 3px"}}>
                  {unreadMsgs>9?"9+":unreadMsgs}
                </span>
              )}
              {id==="trabajos"&&jobs.filter(j=>j.status==="pending").length>0&&tab!=="trabajos"&&(
                <span style={{position:"absolute",top:-4,right:-4,background:C.orange,color:"#000",borderRadius:99,minWidth:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,border:"1.5px solid "+C.bg,padding:"0 3px"}}>
                  {jobs.filter(j=>j.status==="pending").length}
                </span>
              )}
            </span>
            <span style={{fontSize:9,fontWeight:600,letterSpacing:"0.02em"}}>{label}</span>
            {tab===id&&<div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:24,height:2,background:"linear-gradient(90deg,"+C.accent+","+C.orange+")",borderRadius:"0 0 2px 2px"}} />}
          </button>
        ))}
      </nav>

{showMapaPro&&(
        <MapaProModal
          currentZones={serviceZones}
          onClose={()=>setShowMapaPro(false)}
          onSave={async(zones)=>{
            setServiceZones(zones);
            await db.from("users").update({service_zones:zones}).eq("id",user.id);
            onUpdate({...user,service_zones:zones});
            setShowMapaPro(false);
            showToast("✓ Zonas actualizadas");
          }}
        />
      )}
      
      {chatUser&&<ChatPanel toUser={chatUser} currentUser={user} onClose={()=>{setChatUser(null);setUnreadMsgs(0);}} />}
      {showStripeModal&&(
  <StripePayModal
    user={user}
    priceId={showStripeModal.priceId}
    plan={showStripeModal.plan}
    onClose={()=>setShowStripeModal(null)}
    onSuccess={(pl)=>{
      onUpdate({...user,plan:pl});
      showToast("✅ Plan "+pl.toUpperCase()+" activado");
      setShowStripeModal(null);
    }}
  />
)}
     <InstallBanner/>
<Ping msg={toast} />
    </div>
  );
}

// ─── ADMIN ───
function Admin({onLogout}:{onLogout:()=>void}){
  type AdminTab="overview"|"usuarios"|"registros"|"trabajos"|"mensajes"|"reseñas"|"leads"|"certs"|"reports";
  const [tab,setTab]=useState<AdminTab>("overview");
  const [users,setUsers]=useState<UserRow[]>([]);
  const [jobs,setJobs]=useState<JobRow[]>([]);
  const [msgs,setMsgs]=useState<MessageRow[]>([]);
  const [reviews,setReviews]=useState<any[]>([]);
  const [leads,setLeads]=useState<any[]>([]);
  const [certs,setCerts]=useState<any[]>([]);
  const [reports,setReports]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [period,setPeriod]=useState<"7d"|"30d"|"90d"|"all">("30d");
  const [filterType,setFilterType]=useState<"all"|"cliente"|"profesional">("all");
  const [filterStatus,setFilterStatus]=useState<"all"|"paying"|"trial"|"expired">("all");
  const [filterSearch,setFilterSearch]=useState("");
  const [selectedUser,setSelectedUser]=useState<UserRow|null>(null);
  const [supportMsg,setSupportMsg]=useState("");
  const [sendingMsg,setSendingMsg]=useState(false);
  const [toastMsg,setToastMsg]=useState<string|null>(null);
  const [unreadAdminMsgs,setUnreadAdminMsgs]=useState(0); // NEW: badge for admin
  const [refreshKey,setRefreshKey]=useState(0);
  const reload=()=>{setLoading(true);setRefreshKey(k=>k+1);};

  useEffect(()=>{
    const load=async()=>{
      const [u,j,m,r,ld,ct,rp]=await Promise.all([
        db.from("users").select("*").order("joined_at",{ascending:false}),
        db.from("jobs").select("*").order("created_at",{ascending:false}),
        db.from("messages").select("*").order("created_at",{ascending:false}),
        db.from("reviews").select("*").order("created_at",{ascending:false}),
        db.from("leads_landing").select("*").order("created_at",{ascending:false}),
        db.from("certifications").select("*").order("created_at",{ascending:false}),
        db.from("reports").select("*").order("created_at",{ascending:false}),
      ]);
      const allUsers=(u.data||[]).filter((x:any)=>x.type!=="admin"&&x.id!=="00000000-0000-0000-0000-000000000002");
      setUsers(allUsers as UserRow[]);
      setJobs((j.data||[]) as JobRow[]);
      const allMsgs=(m.data||[]) as MessageRow[];
      setMsgs(allMsgs);
      setReviews((r.data||[]) as any[]);
    setLeads((ld.data||[]) as any[]);
      setReports((rp.data||[]) as any[]);
setCerts((ct.data||[]) as any[]);
      // Count unread for admin (messages sent TO any user, admin can see all)
      const unread=allMsgs.filter((msg:any)=>!msg.read&&msg.from_id!=="00000000-0000-0000-0000-000000000002").length;
      setUnreadAdminMsgs(unread);
      setLoading(false);
    };
    load();
  },[refreshKey]);

  // Realtime: notify admin of new messages
  useEffect(()=>{
    const ch=db.channel("admin-realtime")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},(p:any)=>{
        const m=p.new as MessageRow;
        if(m.from_id!=="00000000-0000-0000-0000-000000000002"&&m.from_id!=="00000000-0000-0000-0000-000000000001"){
          setMsgs(prev=>[m,...prev]);
          setUnreadAdminMsgs(c=>c+1);
          setToastMsg("💬 Nuevo mensaje en la plataforma");
          setTimeout(()=>setToastMsg(null),4000);
        }
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"users"},(p:any)=>{
        const u=p.new as UserRow;
        if(u.type!=="admin"){
          setUsers(prev=>[u,...prev]);
          setToastMsg("🆕 Nuevo registro: "+u.name+" ("+u.type+")");
          setTimeout(()=>setToastMsg(null),5000);
        }
      })
      .subscribe();
    return ()=>{db.removeChannel(ch);};
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
    await db.from("messages").insert({from_id:"00000000-0000-0000-0000-000000000002",to_id:selectedUser.id,text:"[Soporte OfficioYa] "+supportMsg,read:false});
    setSupportMsg(""); setSendingMsg(false);
    setToastMsg("✓ Mensaje enviado a "+selectedUser.name);
    setTimeout(()=>setToastMsg(null),3000);
  };

  const approveReview=async(id:string)=>{await db.from("reviews").update({approved:true}).eq("id",id);setReviews(p=>p.map(r=>r.id===id?{...r,approved:true}:r));setToastMsg("✓ Reseña aprobada");setTimeout(()=>setToastMsg(null),3000);};
  const rejectReview=async(id:string)=>{await db.from("reviews").update({approved:false}).eq("id",id);setReviews(p=>p.map(r=>r.id===id?{...r,approved:false}:r));setToastMsg("Reseña rechazada");setTimeout(()=>setToastMsg(null),3000);};
  const deleteReview=async(id:string)=>{await db.from("reviews").delete().eq("id",id);setReviews(p=>p.filter(r=>r.id!==id));setToastMsg("Reseña eliminada");setTimeout(()=>setToastMsg(null),3000);};

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

  const UserRowItem=({u}:{u:UserRow})=>{
    const registeredAt=u.joined_at?new Date(u.joined_at):null;
    const isNew=registeredAt&&(Date.now()-registeredAt.getTime())<86400000*2;
    return(
      <GCard onClick={()=>setSelectedUser(u)} glow={selectedUser?.id===u.id?C.accent:isNew?C.green:""} style={{padding:"11px 14px",border:selectedUser?.id===u.id?"1px solid "+C.accent+"66":isNew?"1px solid "+C.green+"33":undefined}}>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <Ava s={u.name.substring(0,2).toUpperCase()} size={36} color={u.type==="profesional"?C.accent:C.blue} />
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
              <p style={{fontWeight:700,color:C.text,fontSize:13}}>{u.name}</p>
              {isNew&&<span style={{fontSize:8,color:C.green,background:C.green+"18",padding:"1px 6px",borderRadius:3,fontWeight:700}}>NUEVO</span>}
            </div>
            <p style={{fontSize:10,color:C.muted,marginTop:1}}>{u.email}</p>
            {u.phone&&<p style={{fontSize:10,color:C.mutedL}}>{u.phone}</p>}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:3,alignItems:"flex-end",flexShrink:0}}>
            <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>
              <span style={{fontSize:9,color:u.type==="profesional"?C.accent:C.blue,background:(u.type==="profesional"?C.accent:C.blue)+"22",padding:"1px 6px",borderRadius:3,fontWeight:700}}>{u.type==="profesional"?"🔨 PRO":"👤 CLI"}</span>
              {isPaying(u)&&<span style={{fontSize:9,color:C.green,background:C.green+"18",padding:"1px 6px",borderRadius:3,fontWeight:700}}>✅ {PLAN_PRICES[u.plan as Plan]}€/m</span>}
              {isTrial(u)&&<span style={{fontSize:9,color:C.cyan,background:C.cyan+"18",padding:"1px 6px",borderRadius:3,fontWeight:700}}>⏱{trialDaysU(u)}d</span>}
              {isExpired(u)&&<span style={{fontSize:9,color:C.red,background:C.red+"18",padding:"1px 6px",borderRadius:3,fontWeight:700}}>⛔ exp.</span>}
            </div>
            {registeredAt&&<span style={{fontSize:9,color:isNew?C.green:C.muted}}>{registeredAt.toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit",year:"2-digit"})}</span>}
            {u.phone&&<a href={"tel:"+u.phone} onClick={e=>e.stopPropagation()} style={{fontSize:9,color:C.green,textDecoration:"none",fontWeight:700}}>📞 llamar</a>}
          </div>
        </div>
      </GCard>
    );
  };

  return(
    <div style={{minHeight:"100dvh",background:C.bg,paddingBottom:72}}>
      <header style={{background:"rgba(10,10,15,0.95)",backdropFilter:"blur(20px)",borderBottom:"1px solid "+C.accent+"22",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1100,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
          <span style={{fontWeight:800,fontSize:16}}><span style={{color:C.accent}}>⚙ Admin CRM</span><span style={{color:C.muted}}> · OfficioYa</span></span>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <span style={{fontSize:11,color:C.green,background:C.green+"15",padding:"3px 8px",borderRadius:4,fontWeight:700}}>MRR: {mrr.toFixed(0)}€</span>
            <button onClick={reload} style={{background:"none",border:"1px solid "+C.accent+"44",borderRadius:6,color:C.accent,cursor:"pointer",padding:"4px 10px",fontSize:11,fontWeight:700}}>↻ Actualizar</button>
            <button onClick={onLogout} style={{background:"none",border:"1px solid "+C.border,borderRadius:6,color:C.muted,cursor:"pointer",padding:"4px 10px",fontSize:11}}>Salir</button>
          </div>
        </div>
      </header>

      {toastMsg&&<div style={{position:"fixed",bottom:88,left:"50%",transform:"translateX(-50%)",background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",color:"#000",borderRadius:10,padding:"10px 20px",fontWeight:700,fontSize:13,zIndex:9999,whiteSpace:"nowrap"}}>{toastMsg}</div>}

      {/* Detail panel */}
      {selectedUser&&(
        <div style={{position:"fixed",top:52,right:0,width:280,bottom:72,background:"linear-gradient(170deg,#12121E,#0A0A14)",borderLeft:"1px solid "+C.accent+"33",zIndex:90,overflowY:"auto",padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <p style={{fontWeight:800,color:C.text,fontSize:14}}>Detalle usuario</p>
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
            <p style={{fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase" as const,letterSpacing:"0.06em",marginBottom:6}}>💬 Enviar mensaje de soporte</p>
            <p style={{fontSize:10,color:C.mutedL,marginBottom:8}}>Le llegará como notificación urgente inmediata</p>
            <textarea value={supportMsg} onChange={e=>setSupportMsg(e.target.value)} placeholder="Mensaje al usuario..." style={{width:"100%",background:C.card,border:"1px solid "+C.border,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:12,padding:"8px 10px",resize:"vertical",minHeight:60,outline:"none",marginBottom:8}} />
            <Btn full small disabled={sendingMsg||!supportMsg.trim()} onClick={sendSupport} color={C.accent}>{sendingMsg?"Enviando...":"Enviar ahora →"}</Btn>
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
                <input value={filterSearch} onChange={e=>setFilterSearch(e.target.value)} placeholder="🔍 Buscar nombre o email..." style={{flex:2,minWidth:150,background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"8px 12px",color:C.text,fontFamily:"inherit",fontSize:12,outline:"none"}} />
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
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
              <h2 style={{fontWeight:800,fontSize:20,color:C.text}}>Mensajes · {msgs.length}</h2>
              <span style={{fontSize:11,color:C.red,background:C.red+"18",padding:"4px 10px",borderRadius:99,fontWeight:700}}>{unreadAdminMsgs} no leídos</span>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {msgs.filter(m=>m.from_id!=="00000000-0000-0000-0000-000000000001").slice(0,50).map(m=>{
                const fromUser=users.find(u=>u.id===m.from_id);
                const toUser=users.find(u=>u.id===m.to_id);
                const isAdminMsg=m.from_id==="00000000-0000-0000-0000-000000000002";
                return <GCard key={m.id} style={{padding:"10px 12px",border:!m.read&&!isAdminMsg?"1px solid "+C.orange+"44":undefined}}>
                  <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:3,flexWrap:"wrap"}}>
                        <span style={{fontSize:11,color:isAdminMsg?C.orange:C.accent,fontWeight:700}}>{isAdminMsg?"👑 Soporte":(fromUser?.name||"Sistema")}</span>
                        <span style={{fontSize:10,color:C.muted}}>→</span>
                        <span style={{fontSize:11,color:C.blue,fontWeight:700}}>{toUser?.name||"Usuario"}</span>
                        {!m.read&&!isAdminMsg&&<span style={{fontSize:8,color:C.orange,background:C.orange+"22",padding:"1px 5px",borderRadius:3,fontWeight:700}}>NO LEÍDO</span>}
                      </div>
                      <p style={{fontSize:12,color:C.mutedL,lineHeight:1.5}}>{m.text}</p>
                    </div>
                    <div style={{flexShrink:0,textAlign:"right"}}>
                      <span style={{fontSize:9,color:C.muted}}>{timeAgo(m.created_at)}</span>
                      {!isAdminMsg&&<button onClick={()=>setSelectedUser(toUser||fromUser||null)} style={{display:"block",marginTop:4,fontSize:9,color:C.accent,background:"none",border:"none",cursor:"pointer",fontWeight:700,padding:0}}>Responder →</button>}
                    </div>
                  </div>
                </GCard>;
              })}
            </div>
          </>)}

          {tab==="reseñas"&&(<>
            <h2 style={{fontWeight:800,fontSize:20,color:C.text,marginBottom:14}}>Moderación de reseñas · {reviews.length}</h2>
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

          {tab==="leads"&&(<>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
    <h2 style={{fontWeight:800,fontSize:20,color:C.text}}>Leads Landing · {leads.length}</h2>
    <div style={{display:"flex",gap:10}}>
      <span style={{fontSize:12,color:C.green,background:C.green+"15",padding:"4px 10px",borderRadius:6,fontWeight:700}}>✓ {leads.filter((l:any)=>l.convirtio).length} convirtieron</span>
      <span style={{fontSize:12,color:C.orange,background:C.orange+"15",padding:"4px 10px",borderRadius:6,fontWeight:700}}>⚡ {leads.filter((l:any)=>!l.convirtio).length} abandonaron</span>
    </div>
  </div>
  <GCard style={{marginBottom:14}}>
    <p style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:12}}>📈 Embudo de conversión</p>
    {[
      {label:"Rellenaron formulario (paso 1)",val:leads.length,color:C.orange},
      {label:"Pusieron tarjeta (convirtieron)",val:leads.filter((l:any)=>l.convirtio).length,color:C.green},
    ].map(row=>{
      const pct=leads.length>0?Math.round((row.val/leads.length)*100):0;
      return(
        <div key={row.label} style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:12,color:C.muted}}>{row.label}</span>
            <span style={{fontSize:12,fontWeight:700,color:row.color}}>{row.val} ({pct}%)</span>
          </div>
          <div style={{background:C.border,borderRadius:99,height:6}}>
            <div style={{background:row.color,height:6,borderRadius:99,width:pct+"%",transition:"width 0.5s"}}/>
          </div>
        </div>
      );
    })}
  </GCard>
  <div style={{display:"flex",flexDirection:"column",gap:7}}>
    {leads.length===0&&<p style={{textAlign:"center",color:C.muted,fontSize:13,padding:32}}>No hay leads todavía. Se generan cuando alguien rellena el paso 1 de la landing /elite-gratis.</p>}
    {leads.map((l:any)=>(
      <GCard key={l.id} style={{padding:"11px 14px",border:"1px solid "+(l.convirtio?C.green+"33":C.orange+"22")}}>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:l.convirtio?C.green:C.orange,flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontWeight:700,fontSize:13,margin:0}}>{l.nombre} · <span style={{color:C.accent}}>{l.oficio}</span></p>
            <p style={{fontSize:11,color:C.muted,margin:0}}>{l.email}</p>
            {l.telefono&&<a href={"tel:"+l.telefono} style={{fontSize:11,color:C.green,textDecoration:"none",fontWeight:700}}>📞 {l.telefono}</a>}
          </div>
          <div style={{textAlign:"right" as const,flexShrink:0}}>
            <span style={{fontSize:10,color:l.convirtio?C.green:C.orange,fontWeight:700,display:"block"}}>{l.convirtio?"✓ CONVIRTIÓ":"⚡ ABANDONÓ"}</span>
            <span style={{fontSize:9,color:C.muted}}>{new Date(l.created_at).toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit",year:"2-digit"})}</span>
          </div>
        </div>
     </GCard>
    ))}
  </div>
</>)}

          {tab==="certs"&&(<>
  <h2 style={{fontWeight:800,fontSize:20,color:C.text,marginBottom:14}}>Certificados · {certs.length}</h2>
  <div style={{display:"flex",flexDirection:"column",gap:10}}>
    {certs.length===0&&<p style={{textAlign:"center",color:C.muted,fontSize:13,padding:32}}>No hay certificados subidos todavía.</p>}
    {certs.map((c:any)=>(
      <GCard key={c.id} style={{padding:14,border:"1px solid "+(c.status==="approved"?C.green+"33":c.status==="rejected"?C.red+"33":C.orange+"33")}}>
        <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10}}>
          <div style={{flex:1}}>
            <p style={{fontWeight:700,fontSize:13,margin:0}}>{c.title||c.type||"Certificado"}</p>
            <p style={{fontSize:11,color:C.muted,margin:0}}>Pro ID: {c.user_id}</p>
            <p style={{fontSize:9,color:C.muted}}>{new Date(c.created_at).toLocaleDateString("es-ES")}</p>
          </div>
          <span style={{padding:"3px 8px",borderRadius:4,fontSize:10,fontWeight:800,
            background:c.status==="approved"?C.green+"22":c.status==="rejected"?C.red+"22":C.orange+"22",
            color:c.status==="approved"?C.green:c.status==="rejected"?C.red:C.orange,
          }}>{c.status==="pending"||!c.status?"PENDIENTE":c.status==="approved"?"✓ APROBADO":"✗ RECHAZADO"}</span>
        </div>
        {(c.status==="pending"||!c.status)&&(
          <div style={{display:"flex",gap:8}}>
            <button onClick={async()=>{await db.from("certifications").update({status:"approved"}).eq("id",c.id);setCerts(p=>p.map((x:any)=>x.id===c.id?{...x,status:"approved"}:x));setToastMsg("✅ Certificado aprobado");setTimeout(()=>setToastMsg(null),3000);}}
              style={{padding:"7px 14px",background:C.green+"22",border:"1px solid "+C.green+"44",borderRadius:8,color:C.green,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:700}}>✓ Aprobar</button>
            <button onClick={async()=>{await db.from("certifications").update({status:"rejected"}).eq("id",c.id);setCerts(p=>p.map((x:any)=>x.id===c.id?{...x,status:"rejected"}:x));setToastMsg("❌ Rechazado");setTimeout(()=>setToastMsg(null),3000);}}
              style={{padding:"7px 14px",background:C.red+"18",border:"1px solid "+C.red+"33",borderRadius:8,color:C.red,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:700}}>✗ Rechazar</button>
          </div>
        )}
      </GCard>
    ))}
  </div>
</>)}

          {tab==="reports"&&(<>
            <h2 style={{fontWeight:800,fontSize:20,color:C.text,marginBottom:14}}>Reports</h2>
            <p style={{color:C.muted,fontSize:13}}>Sin reportes todavía.</p>
          </>)}

        </>)}
      </div>

      <nav style={{
        position:"fixed",
        bottom:0,
        left:0,
        right:0,
        background:"rgba(10,10,15,0.98)",
        backdropFilter:"blur(20px)",
        borderTop:"1px solid "+C.accent+"22",
        display:"flex",
        zIndex:200,
        overflowX:"auto",
        paddingBottom: "calc(10px + env(safe-area-inset-bottom))", // Fix para iPhone
        paddingTop: "10px"
      }}>
        {([["overview","📊","Overview"],["usuarios","👥","Usuarios"],["registros","📅","Registros"],["trabajos","🔨","Trabajos"],["mensajes","💬","Mensajes"],["reseñas","⭐","Reseñas"],["leads","📋","Leads"],["certs","🏅","Certs"],["reports","🚩","Reports"]] as const).map(([id,icon,label])=>(
          <button key={id} onClick={()=>{setTab(id as AdminTab);if(id==="mensajes")setUnreadAdminMsgs(0);}} style={{flex:"0 0 auto",minWidth:60,padding:"8px 4px 10px",background:"none",border:"none",color:tab===id?C.accent:C.muted,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,borderBottom:tab===id?"2px solid "+C.accent:"2px solid transparent",position:"relative"}}>
            <span style={{fontSize:16,position:"relative"}}>
              {icon}
              {id==="mensajes"&&unreadAdminMsgs>0&&tab!=="mensajes"&&(
                <span style={{position:"absolute",top:-4,right:-4,background:C.red,color:"#fff",borderRadius:99,minWidth:14,height:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900,border:"1px solid "+C.bg,padding:"0 2px"}}>
                  {unreadAdminMsgs>9?"9+":unreadAdminMsgs}
                </span>
              )}
            </span>
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
    // Fix para iPhone: Forzar el viewport para que respete safe-areas
    const meta = document.createElement('meta');
    meta.name = "viewport";
    meta.content = "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no";
    document.getElementsByTagName('head')[0].appendChild(meta);
// Registrar Service Worker para push notifications
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('/sw.js').catch(()=>{});
    }
    const s=localStorage.getItem("oy_user");
    if(s){try{setUser(JSON.parse(s));}catch{localStorage.removeItem("oy_user");}}
    setReady(true);
    db.from("visits").insert({page:"home",user_id:null}).then(()=>{});
  },[]);
  const login=(u:UserRow)=>{setUser(u);localStorage.setItem("oy_user",JSON.stringify(u));};
  const logout=()=>{setUser(null);localStorage.removeItem("oy_user");};
  const update=(u:UserRow)=>{setUser(u);localStorage.setItem("oy_user",JSON.stringify(u));};
  if(!ready)return <div style={{minHeight:"100dvh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><Spin /></div>;
  if(window.location.pathname==="/elite-gratis")return <EliteLanding />;
  if(window.location.pathname==="/terminos")return <Terminos />;
if(window.location.pathname==="/privacidad")return <Privacidad />;
if(window.location.pathname==="/cancelacion")return <Cancelacion />;
  return (<>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
      *{box-sizing:border-box;margin:0;padding:0;}
      html, body {
        overflow-x: hidden;
        background: #0F1117;
        height: 100%;
        /* Evita rebotes raros en iPhone */
        position: fixed; 
        width: 100%;
      }
      body {
        color: #E8EDF5;
        font-family: 'DM Sans', sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      #root {
        height: 100%;
        background: #0F1117;
        overflow-y: auto;
        /* Habilita scroll suave en iOS */
        -webkit-overflow-scrolling: touch; 
      }
      input,textarea,select{box-sizing:border-box;}
      input::placeholder,textarea::placeholder{color:#44445A;}
      select option{background:#16161F;color:#F0F0FA;}
      ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#1E1E30;border-radius:99px;}
      @keyframes spin{to{transform:rotate(360deg);}}@keyframes mapPulse{0%,100%{box-shadow:0 0 14px rgba(255,215,0,0.15);}50%{box-shadow:0 0 24px rgba(255,215,0,0.4);}}
      .leaflet-tooltip{background:transparent!important;border:none!important;box-shadow:none!important;padding:0!important;}
      @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}
      @keyframes slideDownNotif{from{transform:translateX(-50%) translateY(-110%);opacity:0;}to{transform:translateX(-50%) translateY(0);opacity:1;}}
      @keyframes slideInFromRight{from{transform:translateX(100%);opacity:0;}to{transform:translateX(0);opacity:1;}}
      @keyframes urgentPulse{0%,100%{box-shadow:0 4px 30px rgba(255,68,85,0.5);}50%{box-shadow:0 4px 50px rgba(255,68,85,0.9);}}
      @keyframes urgentBell{0%,100%{transform:rotate(0deg);}25%{transform:rotate(-15deg);}75%{transform:rotate(15deg);}}
      @keyframes popIn{from{transform:scale(0.85);opacity:0;}to{transform:scale(1);opacity:1;}}
      @keyframes expandDown{from{max-height:0;opacity:0;}to{max-height:300px;opacity:1;}}
      @keyframes typingDot{0%,80%,100%{transform:translateY(0);opacity:0.3;}40%{transform:translateY(-6px);opacity:1;}}
    `}</style>
    {!user&&<Auth onLogin={login} />}
    {user&&user.type==="admin"&&<Admin onLogout={logout} />}
    {user&&user.type==="profesional"&&<ProDashboard user={user} onLogout={logout} onUpdate={update} />}
    {user&&user.type==="cliente"&&<ClientHome user={user} onLogout={logout} />}
  </>);
}
