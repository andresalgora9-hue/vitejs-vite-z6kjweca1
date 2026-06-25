import React, { useState, useEffect, useCallback, useRef } from "react";
import { db } from "./supabase";
import type { UserRow, MessageRow, JobRow, Plan } from "./supabase";

// ── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  bg:"#07070f", surface:"#0c0c18", card:"#10101f", cardHover:"#141428",
  border:"#1c1c32", borderBright:"#2a2a48",
  accent:"#FFB800", accentDim:"#FFB80015", gold:"#FFD700", orange:"#FF8C00",
  red:"#FF3355", redDim:"#FF335512",
  green:"#00E676", greenDim:"#00E67612",
  blue:"#4488FF", blueDim:"#4488FF12",
  purple:"#AA66FF", purpleDim:"#AA66FF12",
  yellow:"#FFB800", yellowDim:"#FFB80012",
  text:"#EEEAF2", muted:"#44445a", mutedL:"#66667a", cyan:"#00D4FF",
};

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const PLAN_PRICES: Record<Plan,number> = {gratis:0, basico:9.99, pro:24.99, elite:49.99};
const PLAN_COLORS: Record<Plan,string> = {gratis:C.muted, basico:C.blue, pro:C.gold, elite:C.orange};
const ADMIN_ID = "00000000-0000-0000-0000-000000000002";
const BOT_ID   = "00000000-0000-0000-0000-000000000001";
const SUPABASE_URL = "https://rjwojxwrsbvwwshwwpvq.supabase.co";
// ✅ CLAVE CORRECTA (iat:1745420534)
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0MjA1MzQsImV4cCI6MjA2MDk5NjUzNH0.3aMGMIe7Y3pPPBT7yWwLBpAyMJNyBMFJAf3fNtyO2hI";
const SB_HEADERS = {"Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":`Bearer ${SUPABASE_KEY}`};

type Section = "monitor"|"profesionales"|"clientes"|"trabajos"|"mensajes"|"disputas"|"finanzas"|"flujo";
type ProStatus = "pagando"|"trial"|"sin_tarjeta"|"expirado";

// ── HELPERS ───────────────────────────────────────────────────────────────────
function timeAgo(iso:string){
  const d=(Date.now()-new Date(iso).getTime())/1000;
  if(d<60)return"ahora"; if(d<3600)return Math.floor(d/60)+"m";
  if(d<86400)return Math.floor(d/3600)+"h"; return Math.floor(d/86400)+"d";
}
function fmtDate(iso:string){
  if(!iso)return"—";
  return new Date(iso).toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit",year:"2-digit"});
}
function fmt(n:number){return n.toLocaleString("es-ES");}

function getProStatus(u:UserRow, now:Date): ProStatus {
  const trialEnd = u.trial_end ? new Date(u.trial_end) : null;
  if(u.plan !== "gratis") return "pagando";
  if(!(u as any).has_stripe) return "sin_tarjeta";
  if(trialEnd && trialEnd > now) return "trial";
  return "expirado";
}
function proStatusLabel(s:ProStatus):{label:string;color:string}{
  if(s==="pagando")   return {label:"✅ Pagando",    color:C.green};
  if(s==="trial")     return {label:"⏱ Trial",       color:C.yellow};
  if(s==="sin_tarjeta") return {label:"⚠ Sin tarjeta", color:C.orange};
  return {label:"⛔ Expirado", color:C.red};
}

function parseMsg(text:string):{type:"text"|"image"|"video"|"file";url?:string;label:string}{
  if(text.startsWith("📎 IMAGEN:"))  return{type:"image",  url:text.replace("📎 IMAGEN:",""),  label:"Imagen"};
  if(text.startsWith("📎 VIDEO:"))   return{type:"video",  url:text.replace("📎 VIDEO:",""),   label:"Vídeo"};
  if(text.startsWith("📎 ARCHIVO:")){const p=text.replace("📎 ARCHIVO:","").split(":");return{type:"file",url:p[1],label:p[0]||"Archivo"};}
  return{type:"text",label:text};
}

async function sendPush(userId:string,title:string,body:string,url="/"){
  try{await fetch(`${SUPABASE_URL}/functions/v1/send-push`,{method:"POST",headers:SB_HEADERS,body:JSON.stringify({user_id:userId,title,body,url})});}catch(_){}
}

// ── UI ATOMS ──────────────────────────────────────────────────────────────────
function Spin({size=18,color=C.accent}:{size?:number;color?:string}){
  return<div style={{width:size,height:size,border:`2px solid ${C.border}`,borderTop:`2px solid ${color}`,borderRadius:"50%",animation:"spin 0.7s linear infinite",flexShrink:0}}/>;
}
function Badge({plan}:{plan:Plan}){
  const col=PLAN_COLORS[plan];
  return<span style={{padding:"2px 7px",borderRadius:3,fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:col,background:col+"22",border:`1px solid ${col}33`}}>{plan.toUpperCase()}</span>;
}
function StatusBadge({status}:{status:ProStatus}){
  const{label,color}=proStatusLabel(status);
  return<span style={{padding:"2px 8px",borderRadius:3,fontSize:9,fontWeight:800,color,background:color+"22",border:`1px solid ${color}44`,whiteSpace:"nowrap"}}>{label}</span>;
}
function Pill({label,color,dot=true}:{label:string;color:string;dot?:boolean}){
  return<span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:99,fontSize:10,fontWeight:700,color,background:color+"18",border:`1px solid ${color}33`}}>
    {dot&&<span style={{width:5,height:5,borderRadius:"50%",background:color,flexShrink:0}}/>}{label}
  </span>;
}
function Ava({s,size=32,color=C.accent,imgUrl=""}:{s:string;size?:number;color?:string;imgUrl?:string}){
  return imgUrl
    ?<img src={imgUrl} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",border:`1px solid ${color}33`,flexShrink:0}} onError={(e:any)=>{e.target.style.display="none";}}/>
    :<div style={{width:size,height:size,borderRadius:"50%",background:`linear-gradient(135deg,${color}33,${color}11)`,display:"flex",alignItems:"center",justifyContent:"center",color,fontWeight:900,fontSize:Math.round(size*0.36),border:`1px solid ${color}33`,flexShrink:0}}>{s}</div>;
}
function KpiCard({label,value,color,sub,onClick}:{label:string;value:string|number;color:string;sub?:string;onClick?:()=>void}){
  return<div onClick={onClick} style={{background:C.card,border:`1px solid ${color}22`,borderRadius:10,padding:"14px 16px",position:"relative",overflow:"hidden",cursor:onClick?"pointer":"default",transition:"border 0.15s"}}
    onMouseEnter={e=>{if(onClick)(e.currentTarget as HTMLElement).style.border=`1px solid ${color}55`;}}
    onMouseLeave={e=>{if(onClick)(e.currentTarget as HTMLElement).style.border=`1px solid ${color}22`;}}>
    <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:color,opacity:0.6}}/>
    <p style={{fontSize:9,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>{label}</p>
    <p style={{fontWeight:900,fontSize:26,color,letterSpacing:"-1px",lineHeight:1}}>{value}</p>
    {sub&&<p style={{fontSize:10,color:C.muted,marginTop:4}}>{sub}</p>}
  </div>;
}
function SectionTitle({children}:{children:React.ReactNode}){
  return<p style={{fontSize:11,color:C.muted,fontFamily:"monospace",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
    <span style={{display:"inline-block",width:16,height:1,background:C.border}}/>{children}<span style={{flex:1,height:1,background:C.border}}/>
  </p>;
}
function ImageModal({url,onClose}:{url:string;onClose:()=>void}){
  return<div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out"}}>
    <img src={url} style={{maxWidth:"90vw",maxHeight:"90vh",objectFit:"contain",borderRadius:8}} onClick={e=>e.stopPropagation()}/>
    <button onClick={onClose} style={{position:"absolute",top:20,right:20,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,cursor:"pointer",padding:"8px 14px",fontSize:13,fontWeight:700}}>✕ Cerrar</button>
  </div>;
}

// ── NAV ───────────────────────────────────────────────────────────────────────
const NAV:{id:Section;icon:string;label:string;subs:{id:string;label:string}[]}[]=[
  {id:"monitor",      icon:"◉",  label:"Monitor",       subs:[{id:"salud",label:"Salud"},{id:"alertas",label:"Alertas"},{id:"fuga",label:"Bloqueos"}]},
  {id:"profesionales",icon:"🔨", label:"Profesionales", subs:[{id:"todos",label:"Todos"},{id:"trial",label:"En trial"},{id:"sin_tarjeta",label:"Sin tarjeta"},{id:"pagando",label:"Pagando"},{id:"expirado",label:"Expirados"},{id:"sinleads",label:"Sin leads"}]},
  {id:"clientes",     icon:"👤", label:"Clientes",      subs:[{id:"todos",label:"Todos"},{id:"nuevos",label:"Nuevos 7d"}]},
  {id:"trabajos",     icon:"🔧", label:"Trabajos",      subs:[{id:"todos",label:"Todos"},{id:"pendientes",label:"Pendientes"},{id:"activos",label:"En progreso"},{id:"completados",label:"Completados"}]},
  {id:"mensajes",     icon:"◈",  label:"Mensajes",      subs:[{id:"chat",label:"Chat soporte"}]},
  {id:"disputas",     icon:"⚑",  label:"Disputas",      subs:[{id:"denuncias",label:"Denuncias"},{id:"resenas",label:"Reseñas"},{id:"sugerencias",label:"Sugerencias"}]},
  {id:"finanzas",     icon:"◆",  label:"Finanzas",      subs:[{id:"mrr",label:"MRR"},{id:"planes",label:"Por plan"},{id:"ltv",label:"LTV"}]},
  {id:"flujo",        icon:"⟳",  label:"Funnel",        subs:[{id:"funnel",label:"Funnel"},{id:"leads",label:"Leads landing"},{id:"buscar",label:"Buscador"}]},
];

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function Admin({onLogout}:{onLogout:()=>void}){
  const [section, setSection] = useState<Section>("monitor");
  const [sub, setSub]         = useState<string>("salud");
  const [users, setUsers]     = useState<UserRow[]>([]);
  const [msgs,  setMsgs]      = useState<MessageRow[]>([]);
  const [jobs,  setJobs]      = useState<JobRow[]>([]);   const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [leads,   setLeads]   = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState<{msg:string;type:"ok"|"err"|"warn"}|null>(null);
  const [notifs,  setNotifs]  = useState<{id:string;msg:string;time:string;type:"ok"|"err"|"warn";read:boolean}[]>([]);
  const [bellOpen, setBellOpen]     = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow|null>(null);
  const [supportMsg,   setSupportMsg]   = useState("");
  const [sendingMsg,   setSendingMsg]   = useState(false);
  const [refreshKey,   setRefreshKey]   = useState(0);
  const [imageModal,   setImageModal]   = useState<string|null>(null);
  // Filters
  const [filterStatus, setFilterStatus] = useState<"all"|ProStatus>("all");
  const [filterPlan,   setFilterPlan]   = useState<"all"|Plan>("all");
  const [filterTrade,  setFilterTrade]  = useState("all");
  const [filterZone,   setFilterZone]   = useState("");
  const [filterDate,   setFilterDate]   = useState<"all"|"7d"|"30d"|"90d">("all");
  const [searchQ,      setSearchQ]      = useState("");
  // Chat
  const [activeThread, setActiveThread] = useState<string|null>(null);
  const [replyText,    setReplyText]    = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [newMsgTarget, setNewMsgTarget] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const bellRef       = useRef<HTMLDivElement>(null);
  const now = new Date();

  // ── TOAST ──────────────────────────────────────────────────────────────────
  const showToast=(msg:string,type:"ok"|"err"|"warn"="ok")=>{
    setToast({msg,type});
    setNotifs(prev=>[{id:Date.now().toString(),msg,time:new Date().toISOString(),type,read:false},...prev.slice(0,29)]);
    setTimeout(()=>setToast(null),3500);
  };
  const unreadNotifs = notifs.filter(n=>!n.read).length;

  // ── LOAD DATA ──────────────────────────────────────────────────────────────
  const load=useCallback(async()=>{
    setLoading(true);
    const [u,m,j,sq,r,ld,rp]=await Promise.all([
      db.from("users").select("id,name,email,phone,whatsapp,type,plan,trade,zone,rating,reviews,jobs,verified,available,trial_end,joined_at,avatar_url,bio,price,banned,has_stripe").order("joined_at",{ascending:false}),
      db.from("messages").select("id,from_id,to_id,text,read,created_at").order("created_at",{ascending:false}).limit(1000),
      db.from("jobs").select("id,worker_id,client_id,client_name,title,description,status,created_at").order("created_at",{ascending:false}),       db.from("budget_requests").select("id,client_id,client_name,oficio,zona,description,status,created_at,accepted_pros,notified_pros,admin_notified").order("created_at",{ascending:false}),
      db.from("reviews").select("id,worker_id,client_id,client_name,stars,text,approved,created_at").order("created_at",{ascending:false}),
      db.from("leads_landing").select("*").order("created_at",{ascending:false}),
      db.from("reports").select("*").order("created_at",{ascending:false}),
    ]);
    setUsers(((u.data||[]).filter((x:any)=>x.type!=="admin"&&x.id!==ADMIN_ID)) as UserRow[]);
    setMsgs((m.data||[]) as MessageRow[]);
    setJobs((j.data||[]) as JobRow[]);
    setSolicitudes((sq.data||[]) as any[]);
    setReviews((r.data||[]) as any[]);
    setLeads((ld.data||[]) as any[]);
    setReports((rp.data||[]) as any[]);
    setLoading(false);
  },[]);

  useEffect(()=>{load();},[load,refreshKey]);

  // ── REALTIME ───────────────────────────────────────────────────────────────
  useEffect(()=>{
    const ch=db.channel("admin-rt4")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"users"},(p:any)=>{
        const u=p.new as UserRow;
        if(u.type!=="admin"&&u.id!==ADMIN_ID){
          setUsers(prev=>[u,...prev]);
          showToast(`🆕 Nuevo ${u.type}: ${u.name}`,"ok");
          const welcomePro=`¡Hola ${u.name}! 👋 Soy Andrés, fundador de OficioYa. Estoy aquí para ayudarte a sacarle el máximo partido. Cualquier duda sobre leads, perfil o configuración, escríbeme aquí. ¡Mucho éxito! 🚀`;
          const welcomeClient=`¡Hola ${u.name}! 👋 Bienvenido a OficioYa. Si necesitas ayuda para encontrar el profesional adecuado o tienes cualquier pregunta, estoy aquí.`;
          setTimeout(async()=>{
            const{data:nm}=await db.from("messages").insert({from_id:ADMIN_ID,to_id:u.id,text:u.type==="profesional"?welcomePro:welcomeClient,read:false}).select().single();
            if(nm)setMsgs(prev=>[nm as MessageRow,...prev]);
            await sendPush(u.id,"👑 OficioYa",u.type==="profesional"?"Bienvenido a OficioYa 🚀":"Bienvenido a OficioYa 👋","/");
          },3000);
        }
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},(p:any)=>{
        const m=p.new as MessageRow;
        if(m.from_id!==ADMIN_ID)setMsgs(prev=>[m,...prev]);
        if(m.to_id===ADMIN_ID&&m.from_id!==BOT_ID){
          const sender=users.find(u=>u.id===m.from_id);
          showToast(`💬 ${sender?.name||"Usuario"}: ${m.text.substring(0,40)}`,"ok");
        }
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages"},(p:any)=>{
        setMsgs(prev=>prev.map(x=>x.id===p.new.id?{...x,...p.new}:x));
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"reports"},(p:any)=>{
        setReports(prev=>[p.new,...prev]);
        showToast("🚨 Nueva denuncia","err");
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"jobs"},(p:any)=>{
        setJobs(prev=>[p.new,...prev]);
      })
      .subscribe();
    return()=>{db.removeChannel(ch);};
  },[users]);

  useEffect(()=>{
    const handler=(e:MouseEvent)=>{
      if(bellRef.current&&!bellRef.current.contains(e.target as Node))setBellOpen(false);
    };
    document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[]);

  // ── DERIVED ────────────────────────────────────────────────────────────────
  const pros    = users.filter(u=>u.type==="profesional");
  const clients = users.filter(u=>u.type==="cliente");
  const paying  = pros.filter(u=>getProStatus(u,now)==="pagando");
  const inTrial = pros.filter(u=>getProStatus(u,now)==="trial");
  const sinTarjeta = pros.filter(u=>getProStatus(u,now)==="sin_tarjeta");
  const expirados  = pros.filter(u=>getProStatus(u,now)==="expirado");
  const mrr = paying.reduce((s,u)=>s+PLAN_PRICES[u.plan as Plan],0);
  const expiring = inTrial.filter(u=>{
    const d=Math.ceil((new Date(u.trial_end).getTime()-now.getTime())/86400000);
    return d<=7&&d>0;
  });
  const newLast7 = users.filter(u=>(now.getTime()-new Date(u.joined_at).getTime())/86400000<=7);
  const pendingReports = reports.filter((r:any)=>!r.status||r.status==="pending");
  const pendingReviews = reviews.filter((r:any)=>r.approved===null||r.approved===undefined);
  const leadsConverted = leads.filter((l:any)=>l.convirtio).length;
  const unreadMsgs = msgs.filter(m=>!m.read&&m.from_id!==ADMIN_ID&&m.from_id!==BOT_ID&&m.to_id===ADMIN_ID).length;
  const proJobCount = (id:string)=>jobs.filter(j=>j.worker_id===id).length;
  const sinLeads = paying.filter(u=>proJobCount(u.id)===0);
  const allTrades = [...new Set(pros.map(u=>u.trade).filter(Boolean))].sort() as string[];

  // ── FILTERED PROS ──────────────────────────────────────────────────────────
  const filteredPros = pros.filter(u=>{
    const status = getProStatus(u,now);
    if(filterStatus!=="all"&&status!==filterStatus)return false;
    if(filterPlan!=="all"&&u.plan!==filterPlan)return false;
    if(filterTrade!=="all"&&(u.trade||"")!==filterTrade)return false;
    if(filterZone&&!(u.zone||"").toLowerCase().includes(filterZone.toLowerCase()))return false;
    if(filterDate!=="all"){
      const days=filterDate==="7d"?7:filterDate==="30d"?30:90;
      if((now.getTime()-new Date(u.joined_at).getTime())/86400000>days)return false;
    }
    if(searchQ){
      const q=searchQ.toLowerCase();
      return u.name.toLowerCase().includes(q)||u.email.toLowerCase().includes(q)||(u.trade||"").toLowerCase().includes(q)||(u.phone||"").includes(q)||(u.zone||"").toLowerCase().includes(q);
    }
    return true;
  });

  const navTo=(s:Section,sb:string)=>{setSection(s);setSub(sb);setSelectedUser(null);};

  // ── ACTIONS ────────────────────────────────────────────────────────────────
  const verifyUser=async(id:string)=>{
    await db.from("users").update({verified:true}).eq("id",id);
    setUsers(prev=>prev.map(u=>u.id===id?{...u,verified:true}:u));
    showToast("✓ Profesional verificado");
  };
  const blockUser=async(id:string)=>{
    await db.from("users").update({available:false,banned:true}).eq("id",id);
    setUsers(prev=>prev.map(u=>u.id===id?{...u,available:false,banned:true}:u));
    showToast("Usuario bloqueado","err");
  };
  const unblockUser=async(id:string)=>{
    await db.from("users").update({available:true,banned:false}).eq("id",id);
    setUsers(prev=>prev.map(u=>u.id===id?{...u,available:true,banned:false}:u));
    showToast("✓ Usuario desbloqueado");
  };
  const sendSupport=async()=>{
    if(!selectedUser||!supportMsg.trim())return;
    setSendingMsg(true);
    const{data:nm}=await db.from("messages").insert({from_id:ADMIN_ID,to_id:selectedUser.id,text:"[Soporte OficioYa] "+supportMsg,read:false}).select().single();
    if(nm)setMsgs(prev=>[nm as MessageRow,...prev]);
    await sendPush(selectedUser.id,"👑 OficioYa Soporte",supportMsg.substring(0,80),"/");
    setSupportMsg("");setSendingMsg(false);
    showToast("✓ Mensaje enviado a "+selectedUser.name);
  };
  const approveReview=async(id:string)=>{
    await db.from("reviews").update({approved:true}).eq("id",id);
    setReviews(p=>p.map((r:any)=>r.id===id?{...r,approved:true}:r));
    showToast("✓ Reseña aprobada");
  };
  const rejectReview=async(id:string)=>{
    await db.from("reviews").update({approved:false}).eq("id",id);
    setReviews(p=>p.filter((r:any)=>r.id!==id));
    showToast("Reseña rechazada","err");
  };
  const updateReport=async(id:string,status:"pending"|"investigating"|"approved"|"closed")=>{
    const rep=reports.find((r:any)=>r.id===id);
    const proId=rep?.worker_id; const clientId=rep?.from_id;
    await db.from("reports").update({status}).eq("id",id);
    setReports(p=>p.map((r:any)=>r.id===id?{...r,status}:r));
    if(status==="investigating"){
      if(proId){await db.from("messages").insert({from_id:ADMIN_ID,to_id:proId,text:"[OficioYa] Hemos recibido una denuncia relacionada con tu cuenta. Estamos revisando el caso.",read:false});await sendPush(proId,"⚠️ OficioYa","Tu cuenta está siendo revisada.","/");}
      if(clientId&&clientId!==proId){await db.from("messages").insert({from_id:ADMIN_ID,to_id:clientId,text:"[OficioYa] Hemos recibido tu denuncia y estamos investigando el caso.",read:false});await sendPush(clientId,"🔍 OficioYa","Tu denuncia está siendo investigada.","/");}
      showToast("🔍 Investigando","warn");
    }else if(status==="approved"){
      if(proId){await blockUser(proId);await db.from("messages").insert({from_id:ADMIN_ID,to_id:proId,text:"[OficioYa] Tu cuenta ha sido suspendida.",read:false});await sendPush(proId,"🚫 OficioYa","Cuenta suspendida.","/");}
      if(clientId&&clientId!==proId){await db.from("messages").insert({from_id:ADMIN_ID,to_id:clientId,text:"[OficioYa] Denuncia resuelta. El profesional ha sido bloqueado.",read:false});await sendPush(clientId,"✅ OficioYa","Denuncia resuelta.","/");}
      showToast("🚫 Pro bloqueado","err");
    }else if(status==="closed"){
      if(proId){await db.from("messages").insert({from_id:ADMIN_ID,to_id:proId,text:"[OficioYa] La denuncia ha sido revisada y cerrada sin penalización.",read:false});}
      if(clientId&&clientId!==proId){await db.from("messages").insert({from_id:ADMIN_ID,to_id:clientId,text:"[OficioYa] Tu denuncia ha sido cerrada. Gracias.",read:false});}
      showToast("✓ Denuncia cerrada");
    }
  };

  // ── CHAT ───────────────────────────────────────────────────────────────────
  const getConversations=()=>{
    const map=new Map<string,{user:UserRow;lastMsg:MessageRow;unread:number}>();
    msgs.filter(m=>m.from_id!==BOT_ID).forEach(m=>{
      const isFromAdmin=m.from_id===ADMIN_ID;
      const isToAdmin=m.to_id===ADMIN_ID;
      const partnerId=isFromAdmin?m.to_id:isToAdmin?m.from_id:null;
      if(!partnerId)return;
      const partner=users.find(u=>u.id===partnerId);
      if(!partner)return;
      const existing=map.get(partnerId);
      const isUnread=!m.read&&m.from_id!==ADMIN_ID&&m.to_id===ADMIN_ID;
      if(!existing||new Date(m.created_at)>new Date(existing.lastMsg.created_at)){
        map.set(partnerId,{user:partner,lastMsg:m,unread:(existing?.unread||0)+(isUnread?1:0)});
      }else if(isUnread){
        map.set(partnerId,{...existing,unread:existing.unread+1});
      }
    });
    return[...map.values()].sort((a,b)=>new Date(b.lastMsg.created_at).getTime()-new Date(a.lastMsg.created_at).getTime());
  };
  const getThreadMsgs=(partnerId:string)=>
    msgs.filter(m=>(m.from_id===ADMIN_ID&&m.to_id===partnerId)||(m.from_id===partnerId&&m.to_id===ADMIN_ID))
      .sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime());
  const sendReply=async()=>{
    if(!activeThread||!replyText.trim())return;
    setSendingReply(true);
    const{data:nm}=await db.from("messages").insert({from_id:ADMIN_ID,to_id:activeThread,text:replyText,read:false}).select().single();
    if(nm)setMsgs(prev=>[nm as MessageRow,...prev]);
    await sendPush(activeThread,"👑 OficioYa",replyText.substring(0,80),"/");
    setReplyText("");setSendingReply(false);
    setTimeout(()=>chatBottomRef.current?.scrollIntoView({behavior:"smooth"}),80);
  };

  // ── RENDER: SALUD ─────────────────────────────────────────────────────────
  const renderSalud=()=>(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <SectionTitle>KPIs en tiempo real</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        <KpiCard label="MRR actual" value={mrr.toFixed(0)+"€"} color={C.green} sub={`Objetivo 5.000€ · ${((mrr/5000)*100).toFixed(0)}%`}/>
        <KpiCard label="Pagando" value={fmt(paying.length)} color={C.green} sub="plan activo"/>
        <KpiCard label="En trial" value={fmt(inTrial.length)} color={C.yellow} sub="30 días gratis"/>
        <KpiCard label="Sin tarjeta" value={fmt(sinTarjeta.length)} color={C.orange} sub="no completaron" onClick={()=>navTo("profesionales","sin_tarjeta")}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        <KpiCard label="Profesionales" value={fmt(pros.length)} color={C.accent} sub={`${pros.filter(u=>u.available).length} disponibles`}/>
        <KpiCard label="Clientes" value={fmt(clients.length)} color={C.blue} sub={`+${newLast7.filter(u=>u.type==="cliente").length} esta semana`}/>
        <KpiCard label="Expiran 7d" value={fmt(expiring.length)} color={expiring.length>0?C.orange:C.green} sub="riesgo churn" onClick={()=>navTo("profesionales","trial")}/>
        <KpiCard label="Expirados" value={fmt(expirados.length)} color={expirados.length>0?C.red:C.green} sub="sin convertir" onClick={()=>navTo("profesionales","expirado")}/>
      </div>
      <SectionTitle>Puntos críticos</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
        {[
          {label:"Sin tarjeta",count:sinTarjeta.length,color:C.orange,desc:"Se registraron pero no completaron. Llamar hoy.",action:"Llamar",onClick:()=>navTo("profesionales","sin_tarjeta")},
          {label:"Trial expira en 7d",count:expiring.length,color:C.yellow,desc:"Riesgo de churn inmediato. Contactar.",action:"Ver",onClick:()=>navTo("profesionales","trial")},
          {label:"Expirados sin pagar",count:expirados.length,color:C.red,desc:"Usaron el servicio y se fueron.",action:"Ver",onClick:()=>navTo("profesionales","expirado")},
          {label:"Pagando sin leads",count:sinLeads.length,color:C.orange,desc:"Pagan pero sin retorno — riesgo de baja.",action:"Actuar",onClick:()=>navTo("profesionales","sinleads")},
          {label:"Denuncias pendientes",count:pendingReports.length,color:C.red,desc:"Daño activo a la reputación.",action:"Resolver",onClick:()=>navTo("disputas","denuncias")},
          {label:"Reseñas sin moderar",count:pendingReviews.length,color:C.purple,desc:"Pendientes de aprobar o rechazar.",action:"Moderar",onClick:()=>navTo("disputas","resenas")},
        ].map(item=>(
          <div key={item.label} style={{background:C.card,border:`1px solid ${item.count>0?item.color+"33":C.border}`,borderRadius:12,padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <p style={{fontSize:11,color:item.count>0?item.color:C.mutedL,fontWeight:700}}>{item.label}</p>
              <span style={{fontWeight:900,fontSize:22,color:item.count>0?item.color:C.green}}>{item.count>0?item.count:"✓"}</span>
            </div>
            <p style={{fontSize:10,color:C.muted,lineHeight:1.5,marginBottom:12}}>{item.desc}</p>
            {item.count>0&&<button onClick={item.onClick} style={{fontSize:10,color:item.color,background:item.color+"18",border:`1px solid ${item.color}33`,borderRadius:6,padding:"5px 12px",cursor:"pointer",fontFamily:"monospace",fontWeight:700}}>{item.action} →</button>}
          </div>
        ))}
      </div>
    </div>
  );

  // ── RENDER: ALERTAS ───────────────────────────────────────────────────────
  const renderAlertas=()=>{
    const urgent=[
      ...pendingReports.map(r=>({id:"r"+(r as any).id,type:"denuncia",msg:`Denuncia: "${(r as any).message?.slice(0,50)}..."`,color:C.red,action:()=>navTo("disputas","denuncias")})),
      ...expiring.map(u=>({id:"e"+u.id,type:"trial",msg:`${u.name} — trial expira en ${Math.ceil((new Date(u.trial_end).getTime()-now.getTime())/86400000)}d`,color:C.yellow,action:()=>setSelectedUser(u)})),
      ...sinTarjeta.slice(0,5).map(u=>({id:"sc"+u.id,type:"sin tarjeta",msg:`${u.name} (${u.trade||"—"}) — registrado sin tarjeta`,color:C.orange,action:()=>setSelectedUser(u)})),
      ...pendingReviews.slice(0,3).map((r:any)=>({id:"rv"+r.id,type:"reseña",msg:`${r.client_name} — ${r.stars}★ sin moderar`,color:C.purple,action:()=>navTo("disputas","resenas")})),
    ];
    return(
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <SectionTitle>Acciones requeridas ahora · {urgent.length}</SectionTitle>
        {urgent.length===0
          ?<div style={{background:C.card,border:`1px solid ${C.green}22`,borderRadius:12,padding:32,textAlign:"center"}}><p style={{fontSize:24,marginBottom:8}}>✓</p><p style={{color:C.green,fontSize:14,fontWeight:700}}>Sin alertas pendientes</p></div>
          :urgent.map(a=>(
            <div key={a.id} style={{background:C.card,border:`1px solid ${a.color}33`,borderRadius:10,padding:"14px 16px",display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:a.color,flexShrink:0,boxShadow:`0 0 8px ${a.color}88`,animation:"pulse 2s ease infinite"}}/>
              <div style={{flex:1}}>
                <span style={{fontSize:9,color:a.color,fontFamily:"monospace",fontWeight:700,textTransform:"uppercase",marginRight:8}}>{a.type}</span>
                <span style={{fontSize:12,color:C.text}}>{a.msg}</span>
              </div>
              <button onClick={a.action} style={{fontSize:10,color:a.color,background:a.color+"18",border:`1px solid ${a.color}44`,borderRadius:6,padding:"5px 12px",cursor:"pointer",fontFamily:"monospace",fontWeight:700,flexShrink:0}}>Revisar →</button>
            </div>
          ))
        }
      </div>
    );
  };

  // ── RENDER: BLOQUEOS ──────────────────────────────────────────────────────
  const renderFuga=()=>{
    const stuckJobs=jobs.filter(j=>j.status==="pending");
    return(
      <div style={{display:"flex",flexDirection:"column",gap:20}}>
        <SectionTitle>Monitor de bloqueos</SectionTitle>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
          <KpiCard label="Jobs pendientes" value={stuckJobs.length} color={stuckJobs.length>5?C.red:C.yellow} sub="sin resolver"/>
          <KpiCard label="En progreso" value={jobs.filter(j=>j.status==="in_progress").length} color={C.blue} sub="activos"/>
          <KpiCard label="Abandonos landing" value={leads.length-leadsConverted} color={C.orange} sub="sin convertir"/>
          <KpiCard label="Msgs no leídos" value={unreadMsgs} color={unreadMsgs>10?C.red:C.muted} sub="admin sin leer"/>
        </div>
        <SectionTitle>Jobs atascados en pendiente</SectionTitle>
        {stuckJobs.length===0
          ?<div style={{background:C.card,border:`1px solid ${C.green}22`,borderRadius:10,padding:20,textAlign:"center",color:C.green,fontSize:13}}>✓ Sin jobs pendientes</div>
          :<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                {["Trabajo","Descripción","Cliente","Profesional","Hace"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:9,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em"}}>{h}</th>)}
              </tr></thead>
              <tbody>{stuckJobs.slice(0,20).map((j:any)=>{
                const pro=users.find(u=>u.id===j.worker_id);
                const cli=users.find(u=>u.id===j.client_id);
                return<tr key={j.id} style={{borderBottom:`1px solid ${C.border}`}}>
                  <td style={{padding:"10px 14px",fontSize:12,color:C.text,fontWeight:600}}>{j.title}</td>
                  <td style={{padding:"10px 14px",fontSize:11,color:C.muted,maxWidth:160}}><span style={{display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{j.description||"—"}</span></td>
                  <td style={{padding:"10px 14px"}}>
                    {cli
                      ?<button onClick={()=>setSelectedUser(cli)} style={{fontSize:11,color:C.blue,background:"none",border:`1px solid ${C.blue}33`,borderRadius:4,padding:"2px 8px",cursor:"pointer"}}>{cli.name}</button>
                      :<span style={{fontSize:11,color:C.muted}}>{j.client_name||"—"}</span>}
                  </td>
                  <td style={{padding:"10px 14px"}}>
                    {pro
                      ?<button onClick={()=>setSelectedUser(pro)} style={{fontSize:11,color:C.accent,background:"none",border:`1px solid ${C.accent}33`,borderRadius:4,padding:"2px 8px",cursor:"pointer"}}>{pro.name}</button>
                      :<span style={{color:C.muted,fontSize:11}}>—</span>}
                  </td>
                  <td style={{padding:"10px 14px",fontSize:10,color:C.muted,fontFamily:"monospace"}}>{timeAgo(j.created_at)}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        }
      </div>
    );
  };

  // ── RENDER: TABLA PROFESIONALES ────────────────────────────────────────────
  const renderProsTable=(list:UserRow[],title:string,showFilters=false)=>(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {showFilters&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16,display:"flex",flexWrap:"wrap",gap:10,alignItems:"center"}}>
          <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="🔍 Nombre, email, teléfono..." style={{flex:1,minWidth:160,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 12px",color:C.text,fontFamily:"inherit",fontSize:12,outline:"none"}}/>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value as any)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 10px",color:C.text,fontFamily:"monospace",fontSize:11,cursor:"pointer"}}>
            <option value="all">Todos los estados</option>
            <option value="pagando">✅ Pagando</option>
            <option value="trial">⏱ En trial</option>
            <option value="sin_tarjeta">⚠ Sin tarjeta</option>
            <option value="expirado">⛔ Expirado</option>
          </select>
          <select value={filterPlan} onChange={e=>setFilterPlan(e.target.value as any)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 10px",color:C.text,fontFamily:"monospace",fontSize:11,cursor:"pointer"}}>
            <option value="all">Todos los planes</option>
            {(["gratis","basico","pro","elite"] as Plan[]).map(p=><option key={p} value={p}>{p.toUpperCase()}</option>)}
          </select>
          <select value={filterTrade} onChange={e=>setFilterTrade(e.target.value)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 10px",color:C.text,fontFamily:"monospace",fontSize:11,cursor:"pointer"}}>
            <option value="all">Todos los oficios</option>
            {allTrades.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <input value={filterZone} onChange={e=>setFilterZone(e.target.value)} placeholder="Zona..." style={{width:120,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 10px",color:C.text,fontFamily:"inherit",fontSize:12,outline:"none"}}/>
          <select value={filterDate} onChange={e=>setFilterDate(e.target.value as any)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 10px",color:C.text,fontFamily:"monospace",fontSize:11,cursor:"pointer"}}>
            <option value="all">Siempre</option>
            <option value="7d">Últimos 7d</option>
            <option value="30d">Últimos 30d</option>
            <option value="90d">Últimos 90d</option>
          </select>
          <button onClick={()=>{setSearchQ("");setFilterStatus("all");setFilterPlan("all");setFilterTrade("all");setFilterZone("");setFilterDate("all");}} style={{fontSize:10,color:C.muted,background:"none",border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 12px",cursor:"pointer",fontFamily:"monospace"}}>✕ Limpiar</button>
          <span style={{fontSize:11,color:C.muted,fontFamily:"monospace"}}>{list.length} resultados</span>
        </div>
      )}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between"}}>
          <p style={{fontWeight:700,fontSize:13,color:C.text}}>{title}</p>
          <Pill label={`${list.length}`} color={C.accent} dot={false}/>
        </div>
        {list.length===0
          ?<div style={{padding:32,textAlign:"center",color:C.muted,fontSize:12}}>Sin resultados</div>
          :<div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                {["Profesional","Oficio","Zona","Estado","Plan","Jobs","Rating","Alta","Trial ends","Acciones"].map(h=>(
                  <th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:9,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{list.slice(0,100).map(u=>{
                const status=getProStatus(u,now);
                const trialEnd=u.trial_end?new Date(u.trial_end):null;
                const daysLeft=trialEnd?Math.ceil((trialEnd.getTime()-now.getTime())/86400000):null;
                const jc=proJobCount(u.id);
                return<tr key={u.id}
                  style={{borderBottom:`1px solid ${C.border}`,background:(u as any).banned?"#FF335508":"transparent",cursor:"pointer"}}
                  onClick={()=>setSelectedUser(u)}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=(u as any).banned?"#FF335512":C.cardHover;}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=(u as any).banned?"#FF335508":"transparent";}}>
                  <td style={{padding:"10px 14px"}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <Ava s={u.name.substring(0,2).toUpperCase()} size={28} color={PLAN_COLORS[u.plan as Plan]} imgUrl={(u as any).avatar_url||""}/>
                      <div>
                        <p style={{fontSize:12,fontWeight:700,color:C.text,whiteSpace:"nowrap"}}>{u.name}</p>
                        <p style={{fontSize:10,color:C.muted}}>{u.email}</p>
                        {u.phone&&<p style={{fontSize:10,color:C.green}}>{u.phone}</p>}
                      </div>
                    </div>
                  </td>
                  <td style={{padding:"10px 14px",fontSize:11,color:C.accent,whiteSpace:"nowrap"}}>{u.trade||"—"}</td>
                  <td style={{padding:"10px 14px",fontSize:11,color:C.muted,whiteSpace:"nowrap"}}>{u.zone||"—"}</td>
                  <td style={{padding:"10px 14px"}}><StatusBadge status={status}/></td>
                  <td style={{padding:"10px 14px"}}><Badge plan={u.plan as Plan}/></td>
                  <td style={{padding:"10px 14px"}}>
                    <span style={{fontSize:13,fontWeight:700,color:jc===0&&status==="pagando"?C.red:jc>0?C.green:C.muted}}>{jc}</span>
                  </td>
                  <td style={{padding:"10px 14px",fontSize:11,color:C.yellow}}>{u.rating?Number(u.rating).toFixed(1)+"★":"—"}</td>
                  <td style={{padding:"10px 14px",fontSize:10,color:C.muted,fontFamily:"monospace",whiteSpace:"nowrap"}}>{fmtDate(u.joined_at)}</td>
                  <td style={{padding:"10px 14px"}}>
                    {trialEnd
                      ?<span style={{fontSize:10,fontFamily:"monospace",color:daysLeft!==null&&daysLeft<=0?C.red:daysLeft!==null&&daysLeft<=7?C.yellow:C.muted,whiteSpace:"nowrap"}}>
                        {daysLeft!==null&&daysLeft<=0?"⛔ Expirado":daysLeft!==null&&daysLeft<=7?`⚠ ${daysLeft}d`:`${daysLeft}d`}
                      </span>
                      :<span style={{color:C.muted,fontSize:10}}>—</span>}
                  </td>
                  <td style={{padding:"10px 14px"}} onClick={e=>e.stopPropagation()}>
                    <div style={{display:"flex",gap:5,flexWrap:"nowrap"}}>
                      {!u.verified&&<button onClick={()=>verifyUser(u.id)} style={{fontSize:10,padding:"4px 8px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:4,color:C.green,cursor:"pointer"}}>✓ Ver</button>}
                      {u.phone&&<a href={"tel:"+u.phone} onClick={e=>e.stopPropagation()} style={{fontSize:10,padding:"4px 8px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:4,color:C.green,textDecoration:"none"}}>📞</a>}
                      {(u as any).whatsapp&&<a href={"https://wa.me/"+((u as any).whatsapp||"").replace(/\D/g,"")} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{fontSize:10,padding:"4px 8px",background:"#25D36618",border:"1px solid #25D36644",borderRadius:4,color:"#25D366",textDecoration:"none"}}>WA</a>}
                      {(u as any).banned
                        ?<button onClick={()=>unblockUser(u.id)} style={{fontSize:10,padding:"4px 8px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:4,color:C.green,cursor:"pointer"}}>✓ Desbloquear</button>
                        :<button onClick={()=>blockUser(u.id)} style={{fontSize:10,padding:"4px 8px",background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:4,color:C.red,cursor:"pointer"}}>🚫</button>}
                    </div>
                  </td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        }
      </div>
    </div>
  );

  // ── RENDER: TABLA CLIENTES ─────────────────────────────────────────────────
  const renderClientsTable=(list:UserRow[],title:string)=>(
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
      <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between"}}>
        <p style={{fontWeight:700,fontSize:13,color:C.text}}>{title}</p>
        <Pill label={`${list.length}`} color={C.blue} dot={false}/>
      </div>
      {list.length===0
        ?<div style={{padding:32,textAlign:"center",color:C.muted,fontSize:12}}>Sin clientes</div>
        :<div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
              {["Cliente","Email","Teléfono","Zona","Alta","Mensajes","Acciones"].map(h=>(
                <th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:9,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em",whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>{list.slice(0,100).map(u=>{
              const userMsgCount=msgs.filter(m=>m.from_id===u.id||m.to_id===u.id).length;
              return<tr key={u.id}
                style={{borderBottom:`1px solid ${C.border}`,cursor:"pointer"}}
                onClick={()=>setSelectedUser(u)}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.cardHover;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
                <td style={{padding:"10px 14px"}}>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <Ava s={u.name.substring(0,2).toUpperCase()} size={28} color={C.blue} imgUrl={(u as any).avatar_url||""}/>
                    <p style={{fontSize:12,fontWeight:700,color:C.text,whiteSpace:"nowrap"}}>{u.name}</p>
                  </div>
                </td>
                <td style={{padding:"10px 14px",fontSize:11,color:C.muted}}>{u.email}</td>
                <td style={{padding:"10px 14px"}}>
                  {u.phone
                    ?<a href={"tel:"+u.phone} onClick={e=>e.stopPropagation()} style={{fontSize:11,color:C.green,textDecoration:"none",fontWeight:700}}>📞 {u.phone}</a>
                    :<span style={{fontSize:10,color:C.red,fontWeight:700}}>⚠ Sin teléfono</span>}
                </td>
                <td style={{padding:"10px 14px",fontSize:11,color:C.muted}}>{u.zone||"—"}</td>
                <td style={{padding:"10px 14px",fontSize:10,color:C.muted,fontFamily:"monospace"}}>{fmtDate(u.joined_at)}</td>
                <td style={{padding:"10px 14px"}}><span style={{fontSize:13,fontWeight:700,color:userMsgCount>0?C.blue:C.muted}}>{userMsgCount}</span></td>
                <td style={{padding:"10px 14px"}} onClick={e=>e.stopPropagation()}>
                  <div style={{display:"flex",gap:5}}>
                    {u.phone&&<a href={"tel:"+u.phone} style={{fontSize:10,padding:"4px 8px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:4,color:C.green,textDecoration:"none"}}>📞</a>}
                    {(u as any).whatsapp&&<a href={"https://wa.me/"+((u as any).whatsapp||"").replace(/\D/g,"")} target="_blank" rel="noreferrer" style={{fontSize:10,padding:"4px 8px",background:"#25D36618",border:"1px solid #25D36644",borderRadius:4,color:"#25D366",textDecoration:"none"}}>WA</a>}
                    <button onClick={()=>setSelectedUser(u)} style={{fontSize:10,padding:"4px 8px",background:C.blueDim,border:`1px solid ${C.blue}44`,borderRadius:4,color:C.blue,cursor:"pointer"}}>Ver</button>
                  </div>
                </td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      }
    </div>
  );

  // ── RENDER: TRABAJOS ──────────────────────────────────────────────────────
  const renderTrabajos=(filterStatus?:string)=>{
    const allTrabajos=[
      ...jobs.map((j:any)=>({
        id:j.id,
        title:j.title||"Sin título",
        description:j.description||"",
        client_name:j.client_name||"—",
        client_id:j.client_id||null,
        worker_id:j.worker_id||null,
        status:j.status||"pending",
        created_at:j.created_at,
        tipo:"job",
      })),
      ...solicitudes.map((s:any)=>({
        id:s.id,
        title:(s.oficio||"Solicitud")+(s.zona?" · "+s.zona:""),
        description:s.description||"",
        client_name:s.client_name||"—",
        client_id:s.client_id||null,
        worker_id:(s.accepted_pros&&s.accepted_pros.length>0)?s.accepted_pros[0]:null,
        status:(s.accepted_pros&&s.accepted_pros.length>0)?"in_progress":s.status==="closed"?"done":"pending",
        created_at:s.created_at,
        tipo:"solicitud",
        zona:s.zona||"",
        oficio:s.oficio||"",
        accepted_pros:s.accepted_pros||[],
        notified_pros:s.notified_pros||[],
      })),
    ].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
    const filtered=filterStatus?allTrabajos.filter((j:any)=>j.status===filterStatus):allTrabajos;
    const statusColor=(s:string)=>s==="done"?C.green:s==="in_progress"?C.blue:s==="cancelled"?C.red:C.yellow;
    const statusLabel=(s:string)=>s==="done"?"Completado":s==="in_progress"?"En progreso":s==="cancelled"?"Cancelado":"Pendiente";
    return(
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
          <KpiCard label="Total" value={allTrabajos.length} color={C.accent}/>
        <KpiCard label="Pendientes" value={allTrabajos.filter(j=>j.status==="pending").length} color={C.yellow} onClick={()=>navTo("trabajos","pendientes")}/>
        <KpiCard label="En progreso" value={allTrabajos.filter(j=>j.status==="in_progress").length} color={C.blue} onClick={()=>navTo("trabajos","activos")}/>
        <KpiCard label="Completados" value={allTrabajos.filter(j=>j.status==="done").length} color={C.green} onClick={()=>navTo("trabajos","completados")}/>
        </div>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between"}}>
            <p style={{fontWeight:700,fontSize:13,color:C.text}}>Trabajos · {filterStatus?statusLabel(filterStatus):"Todos"}</p>
            <Pill label={`${filtered.length}`} color={C.accent} dot={false}/>
          </div>
          {filtered.length===0
            ?<div style={{padding:32,textAlign:"center",color:C.muted,fontSize:12}}>Sin trabajos</div>
            :<div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                  {["Trabajo","Descripción","Cliente","Profesional","Estado","Fecha"].map(h=>(
                    <th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:9,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{filtered.slice(0,100).map((j:any)=>{
                  const pro=users.find(u=>u.id===j.worker_id);
                  const cli=users.find(u=>u.id===j.client_id);
                  const sc=statusColor(j.status);
                  return<tr key={j.id} style={{borderBottom:`1px solid ${C.border}`}}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.cardHover;}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
                    <td style={{padding:"10px 14px",fontSize:12,color:C.text,fontWeight:600,whiteSpace:"nowrap"}}>{j.title}</td>
                    <td style={{padding:"10px 14px",fontSize:11,color:C.muted,maxWidth:160}}>
                      <span style={{display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{j.description||"—"}</span>
                    </td>
                    <td style={{padding:"10px 14px"}}>
                      {cli
                        ?<button onClick={()=>setSelectedUser(cli)} style={{fontSize:11,color:C.blue,background:"none",border:`1px solid ${C.blue}33`,borderRadius:4,padding:"2px 8px",cursor:"pointer",whiteSpace:"nowrap"}}>👤 {cli.name}</button>
                        :<span style={{fontSize:11,color:C.muted,whiteSpace:"nowrap"}}>{j.client_name||"—"}</span>}
                    </td>
                    <td style={{padding:"10px 14px"}}>
                      {pro
                        ?<button onClick={()=>setSelectedUser(pro)} style={{fontSize:11,color:C.accent,background:"none",border:`1px solid ${C.accent}33`,borderRadius:4,padding:"2px 8px",cursor:"pointer",whiteSpace:"nowrap"}}>🔨 {pro.name}</button>
                        :<span style={{color:C.muted,fontSize:11}}>—</span>}
                    </td>
                    <td style={{padding:"10px 14px"}}><Pill label={statusLabel(j.status)} color={sc}/></td>
                    <td style={{padding:"10px 14px",fontSize:10,color:C.muted,fontFamily:"monospace",whiteSpace:"nowrap"}}>{fmtDate(j.created_at)}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          }
        </div>
      </div>
    );
  };

  // ── RENDER: MENSAJES ──────────────────────────────────────────────────────
  const renderMensajes=()=>{
    const conversations=getConversations();
    const activeUser=activeThread?users.find(u=>u.id===activeThread):null;
    const threadMsgs=activeThread?getThreadMsgs(activeThread):[];
    return(
      <div style={{display:"flex",gap:0,height:"calc(100vh - 140px)",background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
        {/* LEFT: lista conversaciones */}
        <div style={{width:300,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`}}>
            <p style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:10}}>💬 Chats Admin</p>
            <select value={newMsgTarget} onChange={e=>{setNewMsgTarget(e.target.value);if(e.target.value)setActiveThread(e.target.value);}} style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 10px",color:newMsgTarget?C.text:C.muted,fontFamily:"inherit",fontSize:11,cursor:"pointer"}}>
              <option value="">+ Nuevo chat con usuario...</option>
              <optgroup label="PROFESIONALES">{pros.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>
              <optgroup label="CLIENTES">{clients.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>
            </select>
          </div>
          <div style={{flex:1,overflowY:"auto"}}>
            {conversations.length===0&&<p style={{padding:20,color:C.muted,fontSize:12,textAlign:"center"}}>Sin conversaciones todavía</p>}
            {conversations.map(({user,lastMsg,unread})=>{
              const isActive=activeThread===user.id;
              const parsed=parseMsg(lastMsg.text);
              const preview=parsed.type==="image"?"📎 Imagen":parsed.type==="video"?"📎 Vídeo":parsed.type==="file"?"📎 Archivo":lastMsg.text.replace("[Soporte OficioYa] ","").substring(0,45);
              const isFromAdmin=lastMsg.from_id===ADMIN_ID;
              const userStatus=user.type==="profesional"?getProStatus(user,now):null;
              return(
                <div key={user.id} onClick={async()=>{
                  setActiveThread(user.id);
                  await db.from("messages").update({read:true}).eq("from_id",user.id).eq("to_id",ADMIN_ID);
                  setMsgs(prev=>prev.map(m=>m.from_id===user.id&&m.to_id===ADMIN_ID?{...m,read:true}:m));
                  setTimeout(()=>chatBottomRef.current?.scrollIntoView({behavior:"smooth"}),80);
                }} style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,cursor:"pointer",background:isActive?C.accentDim:unread>0?C.accent+"06":"transparent",borderLeft:isActive?`3px solid ${C.accent}`:"3px solid transparent"}}
                  onMouseEnter={e=>{if(!isActive)(e.currentTarget as HTMLElement).style.background=C.cardHover;}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=isActive?C.accentDim:unread>0?C.accent+"06":"transparent";}}>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <div style={{position:"relative"}}>
                      <Ava s={user.name.substring(0,2).toUpperCase()} size={34} color={user.type==="profesional"?PLAN_COLORS[user.plan as Plan]:C.blue} imgUrl={(user as any).avatar_url||""}/>
                      {unread>0&&<span style={{position:"absolute",top:-3,right:-3,background:C.red,color:"#fff",borderRadius:99,minWidth:14,height:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900,border:`1px solid ${C.bg}`}}>{unread>9?"9+":unread}</span>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2}}>
                        <p style={{fontSize:12,fontWeight:700,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</p>
                        <span style={{fontSize:9,color:C.muted,fontFamily:"monospace",flexShrink:0,marginLeft:4}}>{timeAgo(lastMsg.created_at)}</span>
                      </div>
                      <div style={{display:"flex",gap:5,alignItems:"center"}}>
                        {userStatus&&<StatusBadge status={userStatus}/>}
                        <p style={{fontSize:10,color:unread>0?C.text:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:unread>0?600:400}}>
                          {isFromAdmin&&"Tú: "}{preview}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: chat thread */}
        {!activeUser
          ?<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontSize:13}}>Selecciona una conversación</div>
          :<div style={{flex:1,display:"flex",flexDirection:"column"}}>
            <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:12,alignItems:"center",background:C.surface}}>
              <Ava s={activeUser.name.substring(0,2).toUpperCase()} size={36} color={activeUser.type==="profesional"?PLAN_COLORS[activeUser.plan as Plan]:C.blue} imgUrl={(activeUser as any).avatar_url||""}/>
              <div style={{flex:1}}>
                <p style={{fontWeight:700,fontSize:13,color:C.text}}>{activeUser.name}</p>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  {activeUser.type==="profesional"&&<StatusBadge status={getProStatus(activeUser,now)}/>}
                  <Badge plan={activeUser.plan as Plan}/>
                  <span style={{fontSize:10,color:C.muted}}>{activeUser.trade||""}{activeUser.zone?` · ${activeUser.zone}`:""}</span>
                </div>
              </div>
              <div style={{display:"flex",gap:6}}>
                {activeUser.phone&&<a href={"tel:"+activeUser.phone} style={{fontSize:10,padding:"5px 10px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:6,color:C.green,textDecoration:"none"}}>📞 {activeUser.phone}</a>}
                {(activeUser as any).whatsapp&&<a href={"https://wa.me/"+((activeUser as any).whatsapp||"").replace(/\D/g,"")} target="_blank" rel="noreferrer" style={{fontSize:10,padding:"5px 10px",background:"#25D36618",border:"1px solid #25D36644",borderRadius:6,color:"#25D366",textDecoration:"none"}}>WA</a>}
                <button onClick={()=>setSelectedUser(activeUser)} style={{fontSize:10,padding:"5px 10px",background:C.accentDim,border:`1px solid ${C.accent}44`,borderRadius:6,color:C.accent,cursor:"pointer"}}>Ver perfil</button>
              </div>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:8}}>
              {threadMsgs.length===0&&<div style={{textAlign:"center",color:C.muted,fontSize:12,padding:40}}>Sin mensajes — escribe el primero</div>}
              {threadMsgs.map(m=>{
                const isAdmin=m.from_id===ADMIN_ID;
                const parsed=parseMsg(m.text);
                const displayText=m.text.replace("[Soporte OficioYa] ","");
                return(
                  <div key={m.id} style={{display:"flex",flexDirection:"column",alignItems:isAdmin?"flex-end":"flex-start",gap:3}}>
                    <div style={{maxWidth:"70%",background:isAdmin?`linear-gradient(135deg,${C.accent}22,${C.orange}11)`:C.surface,border:`1px solid ${isAdmin?C.accent+"44":C.border}`,borderRadius:isAdmin?"12px 12px 4px 12px":"12px 12px 12px 4px",padding:"10px 14px"}}>
                      {parsed.type==="image"&&parsed.url
                        ?<div><img src={parsed.url} style={{maxWidth:200,maxHeight:180,borderRadius:8,cursor:"zoom-in",display:"block"}} onClick={()=>setImageModal(parsed.url!)} onError={(e:any)=>{e.target.style.display="none";}}/><button onClick={()=>setImageModal(parsed.url!)} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:10,padding:"4px 0"}}>🔍 Ampliar</button></div>
                        :parsed.type==="video"&&parsed.url
                          ?<video src={parsed.url} controls style={{maxWidth:200,borderRadius:8}}/>
                          :parsed.type==="file"&&parsed.url
                            ?<a href={parsed.url} target="_blank" rel="noreferrer" style={{fontSize:12,color:C.accent,textDecoration:"none"}}>📎 {parsed.label}</a>
                            :<p style={{fontSize:12,color:C.text,lineHeight:1.5,margin:0,wordBreak:"break-word"}}>{displayText}</p>
                      }
                    </div>
                    <span style={{fontSize:9,color:C.muted,fontFamily:"monospace"}}>{isAdmin?"Tú":activeUser.name} · {timeAgo(m.created_at)}{isAdmin&&(m.read?<span style={{color:C.blue}}> ✓✓</span>:<span> ✓</span>)}</span>
                  </div>
                );
              })}
              <div ref={chatBottomRef}/>
            </div>
            <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`,background:C.surface}}>
              <div style={{display:"flex",gap:10,alignItems:"flex-end"}}>
                <textarea value={replyText} onChange={e=>setReplyText(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendReply();}}}
                  placeholder={`Mensaje a ${activeUser.name}... (Enter para enviar)`} rows={2}
                  style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 14px",color:C.text,fontFamily:"inherit",fontSize:12,outline:"none",resize:"none"}}/>
                <button onClick={sendReply} disabled={sendingReply||!replyText.trim()} style={{padding:"10px 18px",background:replyText.trim()?C.accentDim:C.card,border:`1px solid ${replyText.trim()?C.accent+"44":C.border}`,borderRadius:10,color:replyText.trim()?C.accent:C.muted,cursor:replyText.trim()?"pointer":"default",fontWeight:700,fontSize:12,fontFamily:"inherit",flexShrink:0,height:52}}>
                  {sendingReply?"...":"Enviar + Push ↑"}
                </button>
              </div>
              <p style={{fontSize:9,color:C.muted,marginTop:6,fontFamily:"monospace"}}>Enter envía · Shift+Enter nueva línea · Push automático al usuario</p>
            </div>
          </div>
        }
      </div>
    );
  };

  // ── RENDER: LEADS ─────────────────────────────────────────────────────────
  const renderLeads=()=>(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle>Leads landing — abandono y conversión</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        <KpiCard label="Total leads" value={leads.length} color={C.blue}/>
        <KpiCard label="Convirtieron" value={leadsConverted} color={C.green}/>
        <KpiCard label="Abandonaron" value={leads.length-leadsConverted} color={C.orange} sub="llamar ahora"/>
        <KpiCard label="Conversión" value={leads.length>0?((leadsConverted/leads.length)*100).toFixed(1)+"%":"—"} color={C.purple}/>
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
            {["Nombre","Oficio","Email","Teléfono","Estado","Fecha","Contactar"].map(h=>(
              <th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:9,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {[...leads].sort((a:any,b:any)=>a.convirtio?1:-1).map((l:any)=>(
              <tr key={l.id} style={{borderBottom:`1px solid ${C.border}`,background:!l.convirtio?C.orange+"06":"transparent"}}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=!l.convirtio?C.orange+"12":C.cardHover;}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=!l.convirtio?C.orange+"06":"transparent";}}>
                <td style={{padding:"10px 14px",fontSize:12,color:C.text,fontWeight:600}}>{l.nombre}</td>
                <td style={{padding:"10px 14px"}}><span style={{fontSize:10,color:C.accent,fontFamily:"monospace"}}>{l.oficio}</span></td>
                <td style={{padding:"10px 14px",fontSize:11,color:C.muted}}>{l.email}</td>
                <td style={{padding:"10px 14px"}}>{l.telefono&&<a href={"tel:"+l.telefono} style={{fontSize:11,color:C.green,textDecoration:"none",fontWeight:700}}>{l.telefono}</a>}</td>
                <td style={{padding:"10px 14px"}}><Pill label={l.convirtio?"Convirtió":"Abandonó"} color={l.convirtio?C.green:C.orange}/></td>
                <td style={{padding:"10px 14px",fontSize:10,color:C.muted,fontFamily:"monospace"}}>{fmtDate(l.created_at)}</td>
                <td style={{padding:"10px 14px"}}>
                  <div style={{display:"flex",gap:5}}>
                    {l.telefono&&<a href={"tel:"+l.telefono} style={{fontSize:10,padding:"4px 8px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:4,color:C.green,textDecoration:"none"}}>📞</a>}
                    {l.telefono&&<a href={"https://wa.me/"+l.telefono.replace(/\D/g,"")} target="_blank" rel="noreferrer" style={{fontSize:10,padding:"4px 8px",background:"#25D36618",border:"1px solid #25D36644",borderRadius:4,color:"#25D366",textDecoration:"none"}}>WA</a>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── RENDER: DISPUTAS ──────────────────────────────────────────────────────
  const renderDenuncias=()=>(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        <KpiCard label="Pendientes" value={pendingReports.length} color={pendingReports.length>0?C.red:C.green}/>
        <KpiCard label="Investigando" value={reports.filter((r:any)=>r.status==="investigating").length} color={C.yellow}/>
        <KpiCard label="Resueltos" value={reports.filter((r:any)=>r.status==="approved"||r.status==="closed").length} color={C.green}/>
        <KpiCard label="Total" value={reports.length} color={C.muted}/>
      </div>
      {reports.length===0
        ?<div style={{background:C.card,border:`1px solid ${C.green}22`,borderRadius:12,padding:24,textAlign:"center",color:C.green,fontSize:13}}>✓ Sin denuncias</div>
        :reports.map((r:any)=>{
          const pro=users.find(u=>u.id===r.worker_id);
          const from=users.find(u=>u.id===r.from_id);
          const sc=r.status==="approved"||r.status==="closed"?C.green:r.status==="investigating"?C.yellow:C.red;
          return(
            <div key={r.id} style={{background:C.card,border:`1px solid ${sc}33`,borderRadius:12,padding:16}}>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:10}}>
                {(!r.status||r.status==="pending")&&<span style={{fontSize:8,background:C.red+"22",color:C.red,border:`1px solid ${C.red}44`,borderRadius:3,padding:"2px 6px",fontFamily:"monospace",fontWeight:900}}>URGENTE</span>}
                <span style={{fontSize:9,fontFamily:"monospace",color:C.orange,background:C.orange+"18",padding:"2px 7px",borderRadius:3,fontWeight:700}}>{r.type||"reporte"}</span>
                <Pill label={r.status==="approved"?"✓ Resuelto":r.status==="closed"?"✓ Cerrado":r.status==="investigating"?"🔍 Investigando":"⏳ Pendiente"} color={sc}/>
                <span style={{fontSize:9,color:C.muted,fontFamily:"monospace",marginLeft:"auto"}}>{fmtDate(r.created_at)}</span>
              </div>
              <p style={{fontSize:12,color:C.text,lineHeight:1.6,marginBottom:10}}>{r.message}</p>
              <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:12}}>
                {from&&<span style={{fontSize:11,color:C.muted}}>👤 De: <button onClick={()=>setSelectedUser(from)} style={{color:C.blue,background:"none",border:"none",cursor:"pointer",fontWeight:600,fontSize:11}}>{from.name||r.from_name}</button></span>}
                {pro&&<button onClick={()=>setSelectedUser(pro)} style={{fontSize:11,color:C.accent,background:"none",border:`1px solid ${C.accent}33`,borderRadius:4,padding:"2px 8px",cursor:"pointer"}}>🔨 {pro.name} → Ver perfil</button>}
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {(!r.status||r.status==="pending")&&<button onClick={()=>updateReport(r.id,"investigating")} style={{fontSize:11,padding:"6px 14px",background:C.yellowDim,border:`1px solid ${C.yellow}44`,borderRadius:6,color:C.yellow,cursor:"pointer",fontWeight:600}}>🔍 Investigar</button>}
                {r.status==="investigating"&&<>
                  <button onClick={()=>updateReport(r.id,"approved")} style={{fontSize:11,padding:"6px 14px",background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:6,color:C.red,cursor:"pointer",fontWeight:700}}>🚫 Bloquear pro</button>
                  <button onClick={()=>updateReport(r.id,"closed")} style={{fontSize:11,padding:"6px 14px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:6,color:C.green,cursor:"pointer",fontWeight:600}}>✓ Cerrar sin penalización</button>
                </>}
              </div>
            </div>
          );
        })
      }
    </div>
  );

  const renderResenas=()=>{
    const pendientes=reviews.filter((r:any)=>r.approved===null||r.approved===undefined);
    return(
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          <KpiCard label="Pendientes" value={pendientes.length} color={pendientes.length>0?C.yellow:C.green}/>
          <KpiCard label="Aprobadas" value={reviews.filter((r:any)=>r.approved===true).length} color={C.green}/>
          <KpiCard label="Media" value={reviews.length>0?(reviews.reduce((s,r:any)=>s+r.stars,0)/reviews.length).toFixed(1)+"★":"—"} color={C.gold}/>
        </div>
        {pendientes.length===0
          ?<div style={{background:C.card,border:`1px solid ${C.green}22`,borderRadius:10,padding:20,textAlign:"center",color:C.green,fontSize:13}}>✓ Sin reseñas pendientes</div>
          :pendientes.map((r:any)=>{
            const pro=users.find(u=>u.id===r.worker_id);
            return(
              <div key={r.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
                <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10}}>
                  <span style={{fontSize:12,fontWeight:700,color:C.text}}>{r.client_name}</span>
                  <span style={{fontSize:10,color:C.muted}}>→</span>
                  {pro&&<button onClick={()=>setSelectedUser(pro)} style={{fontSize:11,color:C.accent,background:"none",border:`1px solid ${C.accent}33`,borderRadius:3,padding:"1px 6px",cursor:"pointer"}}>{pro.name}</button>}
                  <span style={{fontSize:13,color:C.yellow,marginLeft:4}}>{r.stars}★</span>
                  <span style={{fontSize:9,color:C.muted,fontFamily:"monospace",marginLeft:"auto"}}>{fmtDate(r.created_at)}</span>
                </div>
                <p style={{fontSize:12,color:C.mutedL,lineHeight:1.5,marginBottom:12}}>{r.text}</p>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>approveReview(r.id)} style={{flex:1,fontSize:11,padding:"7px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:6,color:C.green,cursor:"pointer",fontWeight:700}}>✓ Aprobar</button>
                  <button onClick={()=>rejectReview(r.id)} style={{flex:1,fontSize:11,padding:"7px",background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:6,color:C.red,cursor:"pointer",fontWeight:700}}>✗ Rechazar</button>
                </div>
              </div>
            );
          })
        }
      </div>
    );
  };

  // ── RENDER: FINANZAS ──────────────────────────────────────────────────────
  const renderMRR=()=>(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <SectionTitle>MRR y proyecciones</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        <KpiCard label="MRR actual" value={mrr.toFixed(0)+"€"} color={C.green} sub="ingresos recurrentes"/>
        <KpiCard label="ARPU" value={paying.length>0?(mrr/paying.length).toFixed(2)+"€":"—"} color={C.blue} sub="por pro pagante"/>
        <KpiCard label="Proyección 6m" value={(mrr*Math.pow(1.15,6)).toFixed(0)+"€"} color={C.purple} sub="+15%/mes estimado"/>
        <KpiCard label="Break-even" value={mrr>=500?"✓":`${((500/Math.max(1,mrr))*100-100).toFixed(0)}% más`} color={mrr>=500?C.green:C.yellow} sub="objetivo 500€/m"/>
      </div>
      <SectionTitle>LTV por profesional</SectionTitle>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
            {["Pro","Plan","€/mes","Jobs","Rating","LTV est.","Riesgo"].map(h=>(
              <th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:9,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{paying.map(u=>{
            const monthly=PLAN_PRICES[u.plan as Plan];
            const jc=proJobCount(u.id);
            const risk=jc===0?"Alto":Number(u.rating)<3?"Medio":"Bajo";
            const riskColor=jc===0?C.red:Number(u.rating)<3?C.yellow:C.green;
            return<tr key={u.id} style={{borderBottom:`1px solid ${C.border}`,cursor:"pointer"}} onClick={()=>setSelectedUser(u)}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.cardHover;}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";}}>
              <td style={{padding:"10px 14px"}}>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <Ava s={u.name.substring(0,2).toUpperCase()} size={26} color={PLAN_COLORS[u.plan as Plan]} imgUrl={(u as any).avatar_url||""}/>
                  <div><p style={{fontSize:12,fontWeight:700,color:C.text}}>{u.name}</p><p style={{fontSize:10,color:C.muted}}>{u.trade||"—"}</p></div>
                </div>
              </td>
              <td style={{padding:"10px 14px"}}><Badge plan={u.plan as Plan}/></td>
              <td style={{padding:"10px 14px",fontSize:12,color:C.green,fontFamily:"monospace",fontWeight:700}}>{monthly}€</td>
              <td style={{padding:"10px 14px"}}><span style={{fontSize:13,fontWeight:700,color:jc===0?C.red:C.green}}>{jc}</span></td>
              <td style={{padding:"10px 14px",fontSize:11,color:C.yellow}}>{u.rating?Number(u.rating).toFixed(1)+"★":"—"}</td>
              <td style={{padding:"10px 14px",fontSize:12,color:C.purple,fontFamily:"monospace",fontWeight:700}}>~{(monthly*12).toFixed(0)}€</td>
              <td style={{padding:"10px 14px"}}><Pill label={risk} color={riskColor}/></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  );

  const renderPlanes=()=>(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle>Distribución por plan</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        {(["gratis","basico","pro","elite"] as Plan[]).map(pl=>{
          const count=pros.filter(u=>u.plan===pl).length;
          const col=PLAN_COLORS[pl];
          return<div key={pl} style={{background:C.card,border:`1px solid ${col}33`,borderRadius:12,padding:20}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}><Badge plan={pl}/><span style={{fontSize:9,color:C.muted,fontFamily:"monospace"}}>{PLAN_PRICES[pl]}€/m</span></div>
            <p style={{fontWeight:900,fontSize:32,color:col,letterSpacing:"-1px"}}>{count}</p>
            <p style={{fontSize:11,color:C.muted,marginTop:4}}>pros · <span style={{color:col,fontWeight:700}}>{(count*PLAN_PRICES[pl]).toFixed(0)}€/m</span></p>
            <div style={{height:3,background:C.border,borderRadius:99,overflow:"hidden",marginTop:12}}>
              <div style={{height:"100%",width:pros.length>0?(count/pros.length*100)+"%":"0%",background:col}}/>
            </div>
          </div>;
        })}
      </div>
    </div>
  );

  // ── RENDER: FUNNEL ────────────────────────────────────────────────────────
  const renderFunnel=()=>{
    const steps=[
      {label:"Visitas estimadas",    value:users.length*12, color:C.blue,   pct:100},
      {label:"Formulario landing",   value:leads.length,    color:C.purple, pct:users.length*12>0?(leads.length/(users.length*12))*100:0},
      {label:"Registros completados",value:users.length,    color:C.accent, pct:users.length*12>0?(users.length/(users.length*12))*100:0},
      {label:"Con tarjeta (trial)",  value:inTrial.length+paying.length, color:C.yellow, pct:pros.length>0?((inTrial.length+paying.length)/pros.length)*100:0},
      {label:"Convirtieron a pago",  value:paying.length,   color:C.green,  pct:users.length>0?(paying.length/users.length)*100:0},
    ];
    return(
      <div style={{display:"flex",flexDirection:"column",gap:20}}>
        <SectionTitle>Funnel completo de conversión</SectionTitle>
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:24}}>
          {steps.map((step,i)=>(
            <div key={step.label} style={{marginBottom:i<steps.length-1?20:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <span style={{fontSize:12,color:C.text,fontWeight:600}}>{step.label}</span>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:11,color:step.color,fontFamily:"monospace",fontWeight:700}}>{step.pct.toFixed(1)}%</span>
                  <span style={{fontSize:16,fontWeight:900,color:step.color}}>{fmt(step.value)}</span>
                </div>
              </div>
              <div style={{height:8,background:C.border,borderRadius:99,overflow:"hidden"}}>
                <div style={{height:"100%",width:step.pct+"%",background:step.color,borderRadius:99,transition:"width 1s ease"}}/>
              </div>
              {i<steps.length-1&&(
                <div style={{textAlign:"right",fontSize:9,color:C.muted,fontFamily:"monospace",marginTop:4}}>
                  ↓ Drop: {steps[i+1]?(100-(steps[i+1].value/Math.max(1,step.value)*100)).toFixed(0):0}% se pierde aquí
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── RENDER: PANEL USUARIO (lateral) ───────────────────────────────────────
  const renderUserPanel=()=>{
    if(!selectedUser)return null;
    const u=selectedUser;
    const isPro=u.type==="profesional";
    const status=isPro?getProStatus(u,now):null;
    const userJobs=jobs.filter(j=>j.worker_id===u.id||j.client_id===u.id);
    const userMsgs=msgs.filter(m=>(m.from_id===u.id||m.to_id===u.id)&&m.from_id!==BOT_ID&&m.to_id!==BOT_ID);
    const trialEnd=u.trial_end?new Date(u.trial_end):null;
    const daysLeft=trialEnd?Math.ceil((trialEnd.getTime()-now.getTime())/86400000):null;
    const planCol=PLAN_COLORS[u.plan as Plan];
    return(
      <div style={{position:"fixed",top:0,right:0,width:360,height:"100dvh",background:C.surface,borderLeft:`1px solid ${C.border}`,zIndex:500,overflowY:"auto",boxShadow:"-20px 0 60px rgba(0,0,0,0.6)"}}>
        <div style={{padding:20}}>
          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <p style={{fontWeight:800,fontSize:13,color:C.text}}>Perfil de usuario</p>
            <button onClick={()=>setSelectedUser(null)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,cursor:"pointer",padding:"4px 10px",fontSize:12}}>✕</button>
          </div>

          {/* Avatar + info básica */}
          <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:16}}>
            <Ava s={u.name.substring(0,2).toUpperCase()} size={52} color={isPro?planCol:C.blue} imgUrl={(u as any).avatar_url||""}/>
            <div style={{flex:1}}>
              <p style={{fontWeight:800,fontSize:16,color:C.text}}>{u.name}</p>
              <p style={{fontSize:11,color:C.muted,marginBottom:4}}>{u.email}</p>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <span style={{fontSize:9,fontFamily:"monospace",color:isPro?C.accent:C.blue,background:(isPro?C.accent:C.blue)+"18",padding:"2px 7px",borderRadius:3,fontWeight:700}}>{isPro?"PRO":"CLIENTE"}</span>
                <Badge plan={u.plan as Plan}/>
                {status&&<StatusBadge status={status}/>}
                {u.verified&&<Pill label="Verificado" color={C.green}/>}
                {(u as any).banned&&<Pill label="Bloqueado" color={C.red}/>}
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
            {[
              {l:"Jobs",v:userJobs.length,c:C.accent},
              {l:"Msgs",v:userMsgs.length,c:C.blue},
              {l:"Reseñas",v:reviews.filter((r:any)=>r.worker_id===u.id).length,c:C.gold},
            ].map(s=><div key={s.l} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",textAlign:"center"}}>
              <p style={{fontWeight:900,fontSize:20,color:s.c}}>{s.v}</p>
              <p style={{fontSize:9,color:C.muted,fontFamily:"monospace"}}>{s.l}</p>
            </div>)}
          </div>

          {/* Detalles */}
          <div style={{marginBottom:16}}>
            {[
              {l:"Teléfono",    v:u.phone,    link:u.phone?"tel:"+u.phone:null,       color:C.green},
              {l:"WhatsApp",   v:(u as any).whatsapp, link:(u as any).whatsapp?"https://wa.me/"+((u as any).whatsapp||"").replace(/\D/g,""):null, color:"#25D366"},
              {l:"Oficio",     v:u.trade,     color:C.accent},
              {l:"Zona",       v:u.zone,      color:C.muted},
              {l:"Alta",       v:fmtDate(u.joined_at), color:C.muted},
              {l:"Plan",       v:u.plan?.toUpperCase(), color:planCol},
              {l:"Trial ends", v:trialEnd?fmtDate(u.trial_end)+(daysLeft!==null?` (${daysLeft>0?daysLeft+"d restantes":"expirado"})`:""): null, color:daysLeft!==null&&daysLeft<=0?C.red:daysLeft!==null&&daysLeft<=7?C.yellow:C.muted},
              {l:"Rating",     v:u.rating?Number(u.rating).toFixed(1)+"★":null, color:C.yellow},
            ].filter(i=>i.v).map(i=><div key={i.l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:11,color:C.muted}}>{i.l}</span>
              {i.link
                ?<a href={i.link} target={i.link.startsWith("http")?"_blank":"_self"} rel="noreferrer" style={{fontSize:11,color:i.color,fontWeight:700,textDecoration:"none"}}>{i.v}</a>
                :<span style={{fontSize:11,color:i.color||C.text,fontWeight:600}}>{i.v}</span>}
            </div>)}
          </div>

          {/* Jobs */}
          {userJobs.length>0&&<>
            <p style={{fontSize:10,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginTop:16,marginBottom:8}}>Historial de trabajos</p>
            {userJobs.slice(0,5).map((j:any)=>{
              const otherUser=j.worker_id===u.id?users.find(ux=>ux.id===j.client_id):users.find(ux=>ux.id===j.worker_id);
              return<div key={j.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",marginBottom:6}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontSize:12,color:C.text,fontWeight:600}}>{j.title}</span>
                  <Pill label={j.status==="done"?"Completado":j.status==="in_progress"?"En progreso":j.status==="cancelled"?"Cancelado":"Pendiente"} color={j.status==="done"?C.green:j.status==="in_progress"?C.blue:j.status==="cancelled"?C.red:C.yellow}/>
                </div>
                {j.description&&<p style={{fontSize:10,color:C.muted,lineHeight:1.4,marginBottom:4}}>{j.description.substring(0,80)}</p>}
                {otherUser&&<button onClick={()=>setSelectedUser(otherUser)} style={{fontSize:10,color:j.worker_id===u.id?C.blue:C.accent,background:"none",border:`1px solid ${j.worker_id===u.id?C.blue:C.accent}33`,borderRadius:4,padding:"2px 8px",cursor:"pointer"}}>
                  {j.worker_id===u.id?"👤 "+otherUser.name:"🔨 "+otherUser.name}
                </button>}
                <p style={{fontSize:9,color:C.muted,fontFamily:"monospace",marginTop:4}}>{fmtDate(j.created_at)}</p>
              </div>;
            })}
          </>}

          {/* Últimos mensajes */}
          {userMsgs.length>0&&<>
            <p style={{fontSize:10,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginTop:16,marginBottom:8}}>Últimos mensajes</p>
            {userMsgs.slice(0,3).map(m=>{
              const parsed=parseMsg(m.text);
              const displayText=m.text.replace("[Soporte OficioYa] ","");
              return<div key={m.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",marginBottom:6}}>
                {parsed.type==="image"&&parsed.url
                  ?<button onClick={()=>setImageModal(parsed.url!)} style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:6}}>
                    <img src={parsed.url} style={{width:40,height:40,borderRadius:4,objectFit:"cover"}} onError={(e:any)=>{e.target.style.display="none";}}/>
                    <span style={{fontSize:11,color:C.accent}}>📎 Ver imagen</span>
                  </button>
                  :<p style={{fontSize:11,color:C.mutedL,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{displayText.substring(0,60)}</p>
                }
                <p style={{fontSize:9,color:C.muted,fontFamily:"monospace",marginTop:2}}>{timeAgo(m.created_at)}</p>
              </div>;
            })}
            <button onClick={()=>{setSelectedUser(null);setSection("mensajes");setSub("chat");setActiveThread(u.id);}} style={{width:"100%",fontSize:11,padding:"8px",background:C.blueDim,border:`1px solid ${C.blue}44`,borderRadius:8,color:C.blue,cursor:"pointer",fontWeight:600,marginTop:4}}>
              💬 Abrir chat completo →
            </button>
          </>}

          {/* Acciones */}
          <p style={{fontSize:10,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginTop:16,marginBottom:8}}>Acciones rápidas</p>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
            {!u.verified&&isPro&&<button onClick={()=>verifyUser(u.id)} style={{fontSize:11,padding:"7px 12px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:6,color:C.green,cursor:"pointer",fontWeight:700}}>✓ Verificar</button>}
            {(u as any).banned
              ?<button onClick={()=>unblockUser(u.id)} style={{fontSize:11,padding:"7px 12px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:6,color:C.green,cursor:"pointer",fontWeight:700}}>✓ Desbloquear</button>
              :<button onClick={()=>blockUser(u.id)} style={{fontSize:11,padding:"7px 12px",background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:6,color:C.red,cursor:"pointer",fontWeight:700}}>🚫 Bloquear</button>}
            {u.phone&&<a href={"tel:"+u.phone} style={{fontSize:11,padding:"7px 12px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:6,color:C.green,textDecoration:"none",fontWeight:700}}>📞 Llamar</a>}
            {(u as any).whatsapp&&<a href={"https://wa.me/"+((u as any).whatsapp||"").replace(/\D/g,"")} target="_blank" rel="noreferrer" style={{fontSize:11,padding:"7px 12px",background:"#25D36618",border:"1px solid #25D36644",borderRadius:6,color:"#25D366",textDecoration:"none",fontWeight:700}}>WA</a>}
          </div>
{/* Cambiar plan manualmente */}
          {u.type==="profesional"&&(
            <div style={{marginBottom:16}}>
              <p style={{fontSize:10,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Cambiar plan manualmente</p>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
                {(["gratis","basico","pro","elite"] as Plan[]).map(pl=>(
                  <button key={pl} onClick={async()=>{
                    const trialEnd=pl!=="gratis"?null:u.trial_end;
                    await db.from("users").update({plan:pl,trial_end:trialEnd}).eq("id",u.id);
                    setUsers(prev=>prev.map(x=>x.id===u.id?{...x,plan:pl}:x));
                    setSelectedUser({...u,plan:pl});
                    showToast(`✓ Plan de ${u.name} cambiado a ${pl.toUpperCase()}`);
                  }} style={{
                    fontSize:10,padding:"5px 10px",
                    background:u.plan===pl?PLAN_COLORS[pl]+"33":"transparent",
                    border:`1px solid ${PLAN_COLORS[pl]}${u.plan===pl?"":"44"}`,
                    borderRadius:6,color:PLAN_COLORS[pl],
                    cursor:"pointer",fontWeight:u.plan===pl?700:400,
                    fontFamily:"monospace",
                  }}>{pl.toUpperCase()}</button>
                ))}
              </div>
              <p style={{fontSize:9,color:C.muted,fontFamily:"monospace"}}>El cambio queda registrado en Supabase inmediatamente</p>
            </div>
          )}
          {/* Mensaje soporte */}
          <p style={{fontSize:10,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>Mensaje de soporte directo</p>
          <textarea value={supportMsg} onChange={e=>setSupportMsg(e.target.value)} placeholder="Escribe un mensaje..." rows={3}
            style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontFamily:"inherit",fontSize:12,outline:"none",resize:"none",boxSizing:"border-box"}}/>
          <button onClick={sendSupport} disabled={sendingMsg||!supportMsg.trim()}
            style={{width:"100%",marginTop:8,padding:"10px",background:supportMsg.trim()?C.accentDim:C.card,border:`1px solid ${supportMsg.trim()?C.accent+"44":C.border}`,borderRadius:8,color:supportMsg.trim()?C.accent:C.muted,cursor:supportMsg.trim()?"pointer":"default",fontWeight:700,fontSize:12,fontFamily:"inherit"}}>
            {sendingMsg?"Enviando...":"Enviar mensaje + Push"}
          </button>
        </div>
      </div>
    );
  };

  // ── ROUTER ────────────────────────────────────────────────────────────────
  const renderContent=()=>{
    if(section==="monitor"){
      if(sub==="salud")  return renderSalud();
      if(sub==="alertas")return renderAlertas();
      if(sub==="fuga")   return renderFuga();
    }
    if(section==="profesionales"){
      if(sub==="todos")       return renderProsTable(filteredPros,"Todos los profesionales",true);
      if(sub==="trial")       return renderProsTable(inTrial,"En trial · "+inTrial.length);
      if(sub==="sin_tarjeta") return renderProsTable(sinTarjeta,"Sin tarjeta · "+sinTarjeta.length+" — llamar hoy");
      if(sub==="pagando")     return renderProsTable(paying,"Pagando · "+paying.length);
      if(sub==="expirado")    return renderProsTable(expirados,"Expirados sin pagar · "+expirados.length);
      if(sub==="sinleads")    return renderProsTable(sinLeads,"Pagando sin leads · "+sinLeads.length);
    }
    if(section==="clientes"){
      if(sub==="todos")  return renderClientsTable(clients,"Todos los clientes");
      if(sub==="nuevos") return renderClientsTable(newLast7.filter(u=>u.type==="cliente"),"Nuevos últimos 7 días");
    }
    if(section==="trabajos"){
      if(sub==="todos")       return renderTrabajos();
      if(sub==="pendientes")  return renderTrabajos("pending");
      if(sub==="activos")     return renderTrabajos("in_progress");
      if(sub==="completados") return renderTrabajos("done");
    }
    if(section==="mensajes"){
      return renderMensajes();
    }
    if(section==="disputas"){
      if(sub==="denuncias")   return renderDenuncias();
      if(sub==="resenas")     return renderResenas();
      if(sub==="sugerencias") return(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <SectionTitle>Sugerencias de usuarios</SectionTitle>
          {reports.filter((r:any)=>r.type==="sugerencia").length===0
            ?<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24,textAlign:"center",color:C.muted,fontSize:13}}>Sin sugerencias todavía</div>
            :reports.filter((r:any)=>r.type==="sugerencia").map((r:any)=>{
              const from=users.find(u=>u.id===r.from_id);
              return<div key={r.id} style={{background:C.card,border:`1px solid ${C.purple}33`,borderRadius:10,padding:"14px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:11,color:C.purple,fontFamily:"monospace",fontWeight:700}}>SUGERENCIA</span>
                    {from&&<button onClick={()=>setSelectedUser(from)} style={{fontSize:10,color:C.blue,background:"none",border:`1px solid ${C.blue}33`,borderRadius:4,padding:"1px 6px",cursor:"pointer"}}>{from.name}</button>}
                  </div>
                  <span style={{fontSize:10,color:C.muted}}>{fmtDate(r.created_at)}</span>
                </div>
                <p style={{fontSize:12,color:C.text,lineHeight:1.6}}>{r.message}</p>
              </div>;
            })
          }
        </div>
      );
    }
    if(section==="finanzas"){
      if(sub==="mrr"||sub==="ltv")return renderMRR();
      if(sub==="planes")return renderPlanes();
    }
    if(section==="flujo"){
      if(sub==="funnel") return renderFunnel();
      if(sub==="leads")  return renderLeads();
      if(sub==="buscar") return(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <SectionTitle>Buscador universal</SectionTitle>
          <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Buscar por nombre, email, teléfono, oficio..." autoFocus
            style={{width:"100%",background:C.card,border:`1px solid ${C.borderBright}`,borderRadius:10,padding:"12px 16px",color:C.text,fontFamily:"inherit",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
          {searchQ.length>2&&(()=>{
            const q=searchQ.toLowerCase();
            const found=users.filter(u=>u.name.toLowerCase().includes(q)||u.email.toLowerCase().includes(q)||(u.trade||"").toLowerCase().includes(q)||(u.phone||"").includes(q));
            const foundPros=found.filter(u=>u.type==="profesional");
            const foundCli=found.filter(u=>u.type==="cliente");
            return<>
              {foundPros.length>0&&renderProsTable(foundPros,`Profesionales (${foundPros.length})`)}
              {foundCli.length>0&&renderClientsTable(foundCli,`Clientes (${foundCli.length})`)}
              {found.length===0&&<p style={{color:C.muted,fontSize:12,textAlign:"center",padding:24}}>Sin resultados para "{searchQ}"</p>}
            </>;
          })()}
          {searchQ.length<=2&&<p style={{color:C.muted,fontSize:12,textAlign:"center",padding:24}}>Escribe al menos 3 caracteres</p>}
        </div>
      );
    }
    return null;
  };

  const toastColor=toast?.type==="ok"?C.green:toast?.type==="warn"?C.yellow:C.red;

  // ── JSX ───────────────────────────────────────────────────────────────────
  return(
    <div style={{minHeight:"100dvh",background:C.bg,color:C.text,fontFamily:"'DM Sans',sans-serif",display:"flex"}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}
        .content-area{animation:fadeIn 0.2s ease;}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:${C.border};border-radius:99px;}
      `}</style>

      {/* ── SIDEBAR ── */}
      <aside style={{width:220,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0,position:"sticky",top:0,height:"100dvh",overflowY:"auto"}}>
        <div style={{padding:"20px 18px 16px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:7,background:`linear-gradient(135deg,${C.accent},${C.orange})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>⚙</div>
            <div>
              <span style={{fontWeight:900,fontSize:14,letterSpacing:"-0.5px"}}><span style={{color:C.text}}>Oficio</span><span style={{color:C.accent}}>Ya</span></span>
              <div style={{fontSize:8,color:C.muted,fontFamily:"monospace",letterSpacing:"0.12em"}}>CEO PANEL</div>
            </div>
          </div>
          <div style={{marginTop:12,padding:"8px 10px",background:C.greenDim,border:`1px solid ${C.green}33`,borderRadius:7}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:10,color:C.muted,fontFamily:"monospace"}}>MRR</span>
              <span style={{fontSize:12,fontWeight:800,color:C.green,fontFamily:"monospace"}}>{mrr.toFixed(0)}€</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:10,color:C.muted,fontFamily:"monospace"}}>Pagando</span>
              <span style={{fontSize:11,fontWeight:700,color:C.accent,fontFamily:"monospace"}}>{paying.length} pros</span>
            </div>
          </div>
        </div>
        <nav style={{flex:1,padding:"12px 10px"}}>
          {NAV.map(nav=>(
            <div key={nav.id} style={{marginBottom:4}}>
              <button onClick={()=>{setSection(nav.id);setSub(nav.subs[0].id);setSelectedUser(null);}} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:8,background:section===nav.id?C.accentDim:"transparent",border:`1px solid ${section===nav.id?C.accent+"44":"transparent"}`,color:section===nav.id?C.accent:C.mutedL,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:section===nav.id?700:400,textAlign:"left",transition:"all 0.12s"}}>
                <span style={{fontSize:12,opacity:0.8}}>{nav.icon}</span>
                <span>{nav.label}</span>
                {nav.id==="disputas"&&pendingReports.length>0&&<span style={{marginLeft:"auto",background:C.red,color:"#fff",borderRadius:99,minWidth:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900}}>{pendingReports.length}</span>}
                {nav.id==="mensajes"&&unreadMsgs>0&&<span style={{marginLeft:"auto",background:C.accent,color:C.bg,borderRadius:99,minWidth:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900}}>{unreadMsgs>9?"9+":unreadMsgs}</span>}
                {nav.id==="profesionales"&&sinTarjeta.length>0&&<span style={{marginLeft:"auto",background:C.orange,color:"#000",borderRadius:99,minWidth:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900}}>{sinTarjeta.length}</span>}
              </button>
              {section===nav.id&&(
                <div style={{marginLeft:10,marginTop:2,borderLeft:`1px solid ${C.border}`,paddingLeft:10}}>
                  {nav.subs.map(s=>(
                    <button key={s.id} onClick={()=>setSub(s.id)} style={{width:"100%",textAlign:"left",padding:"6px 8px",borderRadius:6,background:sub===s.id?C.card:"transparent",border:`1px solid ${sub===s.id?C.border:"transparent"}`,color:sub===s.id?C.text:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:sub===s.id?600:400,marginBottom:1,transition:"all 0.1s"}}>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div style={{padding:"12px 10px",borderTop:`1px solid ${C.border}`}}>
          <button onClick={()=>setRefreshKey(k=>k+1)} style={{width:"100%",padding:"7px",background:"none",border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,cursor:"pointer",fontSize:11,fontFamily:"monospace",marginBottom:6}}>↻ Actualizar datos</button>
          <button onClick={onLogout} style={{width:"100%",padding:"7px",background:"none",border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,cursor:"pointer",fontSize:11}}>Cerrar sesión</button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        <header style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 24px",height:52,display:"flex",alignItems:"center",gap:12,flexShrink:0,position:"sticky",top:0,zIndex:100}}>
          <div style={{flex:1}}>
            <span style={{fontSize:13,fontWeight:700,color:C.text}}>{NAV.find(n=>n.id===section)?.label}</span>
            <span style={{fontSize:12,color:C.muted,marginLeft:8}}>/ {NAV.find(n=>n.id===section)?.subs.find(s=>s.id===sub)?.label}</span>
          </div>
          {/* Stats rápidas */}
          <div style={{display:"flex",gap:16,alignItems:"center"}}>
            <span style={{fontSize:10,color:C.muted,fontFamily:"monospace"}}>{pros.length} pros · {clients.length} clientes</span>
            {sinTarjeta.length>0&&<span style={{fontSize:10,color:C.orange,fontFamily:"monospace",fontWeight:700}}>⚠ {sinTarjeta.length} sin tarjeta</span>}
            {expiring.length>0&&<span style={{fontSize:10,color:C.yellow,fontFamily:"monospace",fontWeight:700}}>⏱ {expiring.length} expiran pronto</span>}
          </div>
          {/* Bell */}
          <div ref={bellRef} style={{position:"relative"}}>
            <button onClick={()=>{setBellOpen(o=>!o);setNotifs(prev=>prev.map(n=>({...n,read:true})));}} style={{background:unreadNotifs>0?C.accent+"18":"none",border:`1px solid ${unreadNotifs>0?C.accent+"44":C.border}`,borderRadius:8,color:unreadNotifs>0?C.accent:C.muted,cursor:"pointer",padding:"6px 10px",fontSize:15,position:"relative"}}>
              🔔
              {unreadNotifs>0&&<span style={{position:"absolute",top:-4,right:-4,background:C.red,color:"#fff",borderRadius:99,minWidth:14,height:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900,border:`2px solid ${C.bg}`}}>{unreadNotifs>9?"9+":unreadNotifs}</span>}
            </button>
            {bellOpen&&(
              <div style={{position:"absolute",top:44,right:0,width:320,background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,zIndex:600,overflow:"hidden",boxShadow:"0 10px 40px rgba(0,0,0,0.5)"}}>
                <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between"}}>
                  <span style={{fontSize:12,fontWeight:700,color:C.text}}>Notificaciones</span>
                  <button onClick={()=>setNotifs([])} style={{fontSize:10,color:C.muted,background:"none",border:"none",cursor:"pointer"}}>Limpiar</button>
                </div>
                <div style={{maxHeight:360,overflowY:"auto"}}>
                  {notifs.length===0
                    ?<p style={{padding:20,textAlign:"center",color:C.muted,fontSize:12}}>Sin notificaciones</p>
                    :notifs.map(n=>(
                      <div key={n.id} style={{padding:"10px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:10,alignItems:"flex-start"}}>
                        <div style={{width:6,height:6,borderRadius:"50%",background:n.type==="ok"?C.green:n.type==="warn"?C.yellow:C.red,flexShrink:0,marginTop:4}}/>
                        <div style={{flex:1}}>
                          <p style={{fontSize:12,color:C.text}}>{n.msg}</p>
                          <p style={{fontSize:9,color:C.muted,fontFamily:"monospace",marginTop:2}}>{timeAgo(n.time)}</p>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        </header>

        <main style={{flex:1,padding:24,overflowY:"auto"}}>
          {loading
            ?<div style={{display:"flex",justifyContent:"center",alignItems:"center",height:200}}><Spin size={28}/></div>
            :<div className="content-area">{renderContent()}</div>
          }
        </main>
      </div>

      {selectedUser&&renderUserPanel()}
      {imageModal&&<ImageModal url={imageModal} onClose={()=>setImageModal(null)}/>}
      {toast&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:C.surface,border:`1px solid ${toastColor}44`,borderRadius:10,padding:"10px 20px",color:toastColor,fontWeight:700,fontSize:13,zIndex:9999,whiteSpace:"nowrap",boxShadow:`0 4px 20px ${toastColor}22`,display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:toastColor}}/>{toast.msg}
        </div>
      )}
    </div>
  );
}
