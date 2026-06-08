import React, { useState, useEffect, useCallback, useRef } from "react";
import { db } from "./supabase";
import type { UserRow, MessageRow, JobRow, Plan } from "./supabase";

const C = {
  bg:"#07070f", surface:"#0c0c18", card:"#10101f", cardHover:"#141428",
  border:"#1c1c32", borderBright:"#2a2a48",
  accent:"#FFB800", accentDim:"#FFB80015", gold:"#FFD700", orange:"#FF8C00",
  red:"#FF3355", redDim:"#FF335512", green:"#00E676", greenDim:"#00E67612",
  blue:"#4488FF", blueDim:"#4488FF12", purple:"#AA66FF", purpleDim:"#AA66FF12",
  yellow:"#FFB800", yellowDim:"#FFB80012",
  text:"#EEEAF2", muted:"#44445a", mutedL:"#66667a", cyan:"#00D4FF",
};
const PLAN_PRICES:Record<Plan,number>={gratis:0,basico:9.99,pro:24.99,elite:49.99};
const PLAN_COLORS:Record<Plan,string>={gratis:C.muted,basico:C.blue,pro:C.gold,elite:C.orange};
const ADMIN_ID="00000000-0000-0000-0000-000000000002";
const BOT_ID="00000000-0000-0000-0000-000000000001";
const TRADES=["Fontanero","Electricista","Pintor","Cerrajero","Albañil","Carpintero","Reformas","Limpieza","Jardinero","Mudanzas","Técnico","Otro"];
const SUPABASE_URL="https://rjwojxwrsbvwwshwwpvq.supabase.co";
const SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MTcxMzgsImV4cCI6MjA5Mzk5MzEzOH0.tO2eE-d7diaqV5nS0NUIAJnyn69xnpHYSJZa4DGQWfE";
const SB_HEADERS={"Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":`Bearer ${SUPABASE_KEY}`};

async function sendPush(userId:string,title:string,body:string,url="/"){
  try{await fetch(`${SUPABASE_URL}/functions/v1/send-push`,{method:"POST",headers:SB_HEADERS,body:JSON.stringify({user_id:userId,title,body,url})});}catch(_){}
}
async function sendAdminMsg(toId:string,text:string){
  await db.from("messages").insert({from_id:ADMIN_ID,to_id:toId,text,read:false});
}

function timeAgo(iso:string){
  const d=(Date.now()-new Date(iso).getTime())/1000;
  if(d<60)return"ahora";if(d<3600)return Math.floor(d/60)+"m";
  if(d<86400)return Math.floor(d/3600)+"h";return Math.floor(d/86400)+"d";
}
function fmt(n:number){return n.toLocaleString("es-ES");}
function fmtDate(iso:string){return new Date(iso).toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit",year:"2-digit"});}

// Parse message text for media
function parseMsg(text:string):{type:"text"|"image"|"video"|"file";url?:string;label:string}{
  if(text.startsWith("📎 IMAGEN:")){const url=text.replace("📎 IMAGEN:","");return{type:"image",url,label:"Imagen"};}
  if(text.startsWith("📎 VIDEO:")){const url=text.replace("📎 VIDEO:","");return{type:"video",url,label:"Vídeo"};}
  if(text.startsWith("📎 ARCHIVO:")){const parts=text.replace("📎 ARCHIVO:","").split(":");return{type:"file",url:parts[1],label:parts[0]||"Archivo"};}
  return{type:"text",label:text};
}

function Spin({size=18,color=C.accent}:{size?:number;color?:string}){
  return<div style={{width:size,height:size,border:`2px solid ${C.border}`,borderTop:`2px solid ${color}`,borderRadius:"50%",animation:"spin 0.7s linear infinite",flexShrink:0}}/>;
}
function Badge({plan}:{plan:Plan}){
  const col=PLAN_COLORS[plan];
  return<span style={{padding:"2px 7px",borderRadius:3,fontSize:9,fontWeight:800,letterSpacing:"0.1em",color:col,background:col+"22",border:`1px solid ${col}33`}}>{plan.toUpperCase()}</span>;
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
function KpiCard({label,value,color,sub}:{label:string;value:string|number;color:string;sub?:string}){
  return<div style={{background:C.card,border:`1px solid ${color}22`,borderRadius:10,padding:"14px 16px",position:"relative",overflow:"hidden"}}>
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

// Image viewer modal
function ImageModal({url,onClose}:{url:string;onClose:()=>void}){
  return<div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out"}}>
    <img src={url} style={{maxWidth:"90vw",maxHeight:"90vh",objectFit:"contain",borderRadius:8}} onClick={e=>e.stopPropagation()}/>
    <button onClick={onClose} style={{position:"absolute",top:20,right:20,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,cursor:"pointer",padding:"8px 14px",fontSize:13,fontWeight:700}}>✕ Cerrar</button>
  </div>;
}

type Section="monitor"|"usuarios"|"profesionales"|"flujo"|"disputas"|"mensajes"|"finanzas";
const NAV:{id:Section;icon:string;label:string;subs:{id:string;label:string}[]}[]=[
  {id:"monitor",icon:"◉",label:"Monitor",subs:[{id:"salud",label:"Salud general"},{id:"fuga",label:"Fuga y bloqueos"},{id:"alertas",label:"Acción requerida"}]},
  {id:"flujo",icon:"⟳",label:"Flujo",subs:[{id:"funnel",label:"Funnel completo"},{id:"trazabilidad",label:"Buscador universal"},{id:"leads",label:"Leads landing"}]},
  {id:"profesionales",icon:"🔨",label:"Profesionales",subs:[{id:"activos",label:"Activos"},{id:"trial",label:"En trial"},{id:"riesgo",label:"Riesgo churn"},{id:"sinleads",label:"Sin leads"}]},
  {id:"usuarios",icon:"👤",label:"Usuarios",subs:[{id:"todos",label:"Todos"},{id:"nuevos",label:"Nuevos 7d"}]},
  {id:"disputas",icon:"⚑",label:"Disputas",subs:[{id:"denuncias",label:"Denuncias"},{id:"resenas",label:"Reseñas"},{id:"sugerencias",label:"Sugerencias"}]},
  {id:"mensajes",icon:"◈",label:"Mensajes",subs:[{id:"chat",label:"Hub de chat"},{id:"soporte",label:"Enviados"}]},
  {id:"finanzas",icon:"◆",label:"Finanzas",subs:[{id:"mrr",label:"MRR"},{id:"planes",label:"Por plan"},{id:"ltv",label:"LTV pros"}]},
];

// Reply box component used inside chat thread
function AdminReplyBox({targetId,targetName,onSent,users}:{targetId:string;targetName:string;onSent:(m:any)=>void;users:any[]}){
  const [text,setText]=React.useState("");
  const [sending,setSending]=React.useState(false);
  const SUPABASE_URL2="https://rjwojxwrsbvwwshwwpvq.supabase.co";
  const SUPABASE_KEY2="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MTcxMzgsImV4cCI6MjA5Mzk5MzEzOH0.tO2eE-d7diaqV5nS0NUIAJnyn69xnpHYSJZa4DGQWfE";
  const SB_H={"Content-Type":"application/json","apikey":SUPABASE_KEY2,"Authorization":`Bearer ${SUPABASE_KEY2}`};
  const send=async()=>{
    if(!text.trim())return;
    setSending(true);
    const{data:nm}=await db.from("messages").insert({from_id:"00000000-0000-0000-0000-000000000002",to_id:targetId,text:"[Soporte OfficioYa] "+text,read:false}).select().single();
    try{await fetch(`${SUPABASE_URL2}/functions/v1/send-push`,{method:"POST",headers:SB_H,body:JSON.stringify({user_id:targetId,title:"👑 OfficioYa Soporte",body:text.substring(0,80),url:"/"})});}catch(_){}
    if(nm)onSent(nm);
    setText("");setSending(false);
  };
  return(
    <div style={{display:"flex",gap:10}}>
      <textarea value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder={`Mensaje a ${targetName}... (Enter para enviar)`} rows={2} style={{flex:1,background:"#07070f",border:"1px solid #1c1c32",borderRadius:8,padding:"8px 12px",color:"#EEEAF2",fontFamily:"inherit",fontSize:12,outline:"none",resize:"none"}}/>
      <button onClick={send} disabled={sending||!text.trim()} style={{padding:"8px 16px",background:text.trim()?"#FFB80015":"#10101f",border:`1px solid ${text.trim()?"#FFB80044":"#1c1c32"}`,borderRadius:8,color:text.trim()?"#FFB800":"#44445a",cursor:text.trim()?"pointer":"default",fontWeight:700,fontSize:12,fontFamily:"inherit",alignSelf:"stretch"}}>
        {sending?"...":"Enviar + Push"}
      </button>
    </div>
  );
}

export default function Admin({onLogout}:{onLogout:()=>void}){
  const [section,setSection]=useState<Section>("monitor");
  const [sub,setSub]=useState<string>("salud");
  const [users,setUsers]=useState<UserRow[]>([]);
  const [msgs,setMsgs]=useState<MessageRow[]>([]);
  const [jobs,setJobs]=useState<JobRow[]>([]);
  const [reviews,setReviews]=useState<any[]>([]);
  const [leads,setLeads]=useState<any[]>([]);
  const [reports,setReports]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [toast,setToast]=useState<{msg:string;type:"ok"|"err"|"warn"}|null>(null);
  const [notifs,setNotifs]=useState<{id:string;msg:string;time:string;type:"ok"|"err"|"warn";read:boolean}[]>([]);
  const [bellOpen,setBellOpen]=useState(false);
  const [selectedUser,setSelectedUser]=useState<UserRow|null>(null);
  const [supportMsg,setSupportMsg]=useState("");
  const [sendingMsg,setSendingMsg]=useState(false);
  const [refreshKey,setRefreshKey]=useState(0);
  const [imageModal,setImageModal]=useState<string|null>(null);
  // Chat thread viewer
  const [chatThread,setChatThread]=useState<{user1:UserRow;user2:UserRow}|null>(null);
  // Filters
  const [filterType,setFilterType]=useState<"all"|"profesional"|"cliente">("all");
  const [filterPlan,setFilterPlan]=useState<"all"|Plan>("all");
  const [filterTrade,setFilterTrade]=useState("all");
  const [filterZone,setFilterZone]=useState("");
  const [filterDate,setFilterDate]=useState<"all"|"7d"|"30d"|"90d">("all");
  const [searchQ,setSearchQ]=useState("");
  const bellRef=useRef<HTMLDivElement>(null);
  const now=new Date();

  const showToast=(msg:string,type:"ok"|"err"|"warn"="ok")=>{
    setToast({msg,type});
    const id=Date.now().toString();
    setNotifs(prev=>[{id,msg,time:new Date().toISOString(),type,read:false},...prev.slice(0,29)]);
    setTimeout(()=>setToast(null),3500);
  };

  const unreadNotifs=notifs.filter(n=>!n.read).length;

  const load=useCallback(async()=>{
    setLoading(true);
    const [u,m,j,r,ld,rp]=await Promise.all([
      db.from("users").select("id,name,email,phone,whatsapp,type,plan,trade,zone,rating,reviews,jobs,verified,available,trial_end,joined_at,avatar_url,bio,price,banned,stripe_customer_id").order("joined_at",{ascending:false}),
      db.from("messages").select("id,from_id,to_id,text,read,created_at").order("created_at",{ascending:false}).limit(400),
      db.from("jobs").select("id,worker_id,client_id,client_name,title,status,created_at").order("created_at",{ascending:false}),
      db.from("reviews").select("id,worker_id,client_id,client_name,stars,text,approved,created_at").order("created_at",{ascending:false}),
      db.from("leads_landing").select("*").order("created_at",{ascending:false}),
      db.from("reports").select("*").order("created_at",{ascending:false}),
    ]);
    setUsers(((u.data||[]).filter((x:any)=>x.type!=="admin"&&x.id!==ADMIN_ID)) as UserRow[]);
    setMsgs((m.data||[]) as MessageRow[]);
    setJobs((j.data||[]) as JobRow[]);
    setReviews((r.data||[]) as any[]);
    setLeads((ld.data||[]) as any[]);
    setReports((rp.data||[]) as any[]);
    setLoading(false);
  },[]);

  useEffect(()=>{load();},[load,refreshKey]);

  useEffect(()=>{
    const ch=db.channel("admin-rt3")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"users"},(p:any)=>{
        const u=p.new as UserRow;
        if(u.type!=="admin"){setUsers(prev=>[u,...prev]);showToast(`🆕 Nuevo ${u.type}: ${u.name}`,"ok");}
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},(p:any)=>{
        const m=p.new as MessageRow;
        if(m.from_id!==ADMIN_ID)setMsgs(prev=>[m,...prev]);
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages"},(p:any)=>{
        setMsgs(prev=>prev.map(x=>x.id===p.new.id?{...x,...p.new}:x));
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"reports"},(p:any)=>{
        setReports(prev=>[p.new,...prev]);
        showToast("🚨 Nueva denuncia recibida","err");
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"reports"},(p:any)=>{
        setReports(prev=>prev.map((x:any)=>x.id===p.new.id?{...x,...p.new}:x));
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"reviews"},(p:any)=>{
        setReviews(prev=>[p.new,...prev]);
        showToast("⭐ Nueva reseña pendiente de moderación","warn");
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"jobs"},(p:any)=>{
        setJobs(prev=>[p.new,...prev]);
      })
      .subscribe();
    return()=>{db.removeChannel(ch);};
  },[]);

  useEffect(()=>{
    const handler=(e:MouseEvent)=>{
      if(bellRef.current&&!bellRef.current.contains(e.target as Node))setBellOpen(false);
    };
    document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[]);

  // ── DERIVED ──────────────────────────────────────────────────────────────
  const pros=users.filter(u=>u.type==="profesional");
  const clients=users.filter(u=>u.type==="cliente");
  const paying=pros.filter(u=>u.plan!=="gratis");
  const mrr=paying.reduce((s,u)=>s+PLAN_PRICES[u.plan as Plan],0);
  const expiring=pros.filter(u=>u.trial_end&&(new Date(u.trial_end).getTime()-now.getTime())/86400000<=7&&(new Date(u.trial_end).getTime()-now.getTime())/86400000>0);
  const expired=pros.filter(u=>u.plan==="gratis"&&u.trial_end&&new Date(u.trial_end)<now);
  const sinFoto=pros.filter(u=>u.plan!=="gratis"&&!(u as any).avatar_url);
  const sinCobro=pros.filter(u=>u.plan==="gratis"&&!(u as any).stripe_customer_id);
  const newLast7=users.filter(u=>(now.getTime()-new Date(u.joined_at).getTime())/86400000<=7);
  const pendingReports=reports.filter((r:any)=>!r.status||r.status==="pending");
  const pendingReviews=reviews.filter((r:any)=>r.approved===null||r.approved===undefined);
  const leadsConverted=leads.filter((l:any)=>l.convirtio).length;
  const unreadMsgs=msgs.filter(m=>!m.read&&m.from_id!==ADMIN_ID&&m.from_id!==BOT_ID).length;
  const proJobCount=(id:string)=>jobs.filter(j=>j.worker_id===id).length;
  const sinLeads=pros.filter(u=>u.plan!=="gratis"&&proJobCount(u.id)===0);

  // Filtered users
  const zones=[...new Set(users.map(u=>u.zone).filter(Boolean))].sort();
  const filteredUsers=users.filter(u=>{
    if(filterType!=="all"&&u.type!==filterType)return false;
    if(filterPlan!=="all"&&u.plan!==filterPlan)return false;
    if(filterTrade!=="all"&&(u.trade||"").toLowerCase()!==filterTrade.toLowerCase())return false;
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

  const navTo=(s:Section,sb:string)=>{setSection(s);setSub(sb);setSelectedUser(null);setChatThread(null);};

  // ── ACTIONS ──────────────────────────────────────────────────────────────
  const verifyUser=async(id:string)=>{
    const{error}=await db.from("users").update({verified:true}).eq("id",id);
    if(error){showToast("Error al verificar","err");return;}
    setUsers(prev=>prev.map(u=>u.id===id?{...u,verified:true}:u));
    showToast("✓ Profesional verificado");
  };
  const blockUser=async(id:string)=>{
    const{error}=await db.from("users").update({available:false,banned:true}).eq("id",id);
    if(error){showToast("Error al bloquear","err");return;}
    setUsers(prev=>prev.map(u=>u.id===id?{...u,available:false,banned:true}:u));
    showToast("Usuario bloqueado","err");
  };
  const unblockUser=async(id:string)=>{
    const{error}=await db.from("users").update({available:true,banned:false}).eq("id",id);
    if(error){showToast("Error","err");return;}
    setUsers(prev=>prev.map(u=>u.id===id?{...u,available:true,banned:false}:u));
    showToast("✓ Usuario desbloqueado");
  };
  const markThreadRead=async(userId:string)=>{
    // Mark all messages in this thread as read
    await db.from("messages").update({read:true}).eq("from_id",userId);
    await db.from("messages").update({read:true}).eq("to_id",userId);
    setMsgs(prev=>prev.map(m=>(m.from_id===userId||m.to_id===userId)?{...m,read:true}:m));
    showToast("✓ Marcado como leído");
  };
  const approveReview=async(id:string)=>{
    const{error}=await db.from("reviews").update({approved:true}).eq("id",id);
    if(error){showToast("Error al aprobar","err");return;}
    setReviews(p=>p.map((r:any)=>r.id===id?{...r,approved:true}:r));
    showToast("✓ Reseña aprobada y publicada");
  };
  const rejectReview=async(id:string)=>{
    const{error}=await db.from("reviews").update({approved:false}).eq("id",id);
    if(error){showToast("Error al rechazar","err");return;}
    setReviews(p=>p.filter((r:any)=>r.id!==id));
    showToast("Reseña rechazada","err");
  };
  const updateReport=async(id:string,status:"pending"|"investigating"|"approved"|"closed")=>{
    const rep=reports.find((r:any)=>r.id===id);
    const proId=rep?.worker_id;
    const clientId=rep?.from_id;
    const{error}=await db.from("reports").update({status}).eq("id",id);
    if(error){showToast("Error al actualizar denuncia","err");return;}
    setReports(p=>p.map((r:any)=>r.id===id?{...r,status}:r));
    if(status==="investigating"){
      if(proId){
        await db.from("messages").insert({from_id:ADMIN_ID,to_id:proId,text:"[OfficioYa] Hemos recibido una denuncia relacionada con tu cuenta. Estamos revisando el caso y nos pondremos en contacto contigo en breve.",read:false});
        await sendPush(proId,"⚠️ OfficioYa","Tu cuenta está siendo revisada por una denuncia.","/");
      }
      if(clientId&&clientId!==proId){
        await db.from("messages").insert({from_id:ADMIN_ID,to_id:clientId,text:"[OfficioYa] Hemos recibido tu denuncia y estamos investigando el caso. Te mantendremos informado.",read:false});
        await sendPush(clientId,"🔍 OfficioYa","Tu denuncia está siendo investigada.","/");
      }
      showToast("🔍 Investigando — ambos notificados","warn");
    }else if(status==="approved"){
      if(proId)await blockUser(proId);
      if(proId){
        await db.from("messages").insert({from_id:ADMIN_ID,to_id:proId,text:"[OfficioYa] Tu cuenta ha sido suspendida tras revisar la denuncia. Si crees que es un error, contáctanos.",read:false});
        await sendPush(proId,"🚫 OfficioYa","Tu cuenta ha sido suspendida.","/");
      }
      if(clientId&&clientId!==proId){
        await db.from("messages").insert({from_id:ADMIN_ID,to_id:clientId,text:"[OfficioYa] Hemos resuelto tu denuncia. El profesional ha sido bloqueado. Gracias por ayudarnos a mantener la calidad.",read:false});
        await sendPush(clientId,"✅ OfficioYa","Tu denuncia ha sido resuelta.","/");
      }
      showToast("🚫 Pro bloqueado — ambos notificados","err");
    }else if(status==="closed"){
      if(proId){
        await db.from("messages").insert({from_id:ADMIN_ID,to_id:proId,text:"[OfficioYa] La denuncia relacionada con tu cuenta ha sido revisada y cerrada sin penalización.",read:false});
        await sendPush(proId,"✅ OfficioYa","Denuncia cerrada sin penalización.","/");
      }
      if(clientId&&clientId!==proId){
        await db.from("messages").insert({from_id:ADMIN_ID,to_id:clientId,text:"[OfficioYa] Tras revisar tu denuncia hemos decidido cerrarla. Gracias por tu reporte.",read:false});
        await sendPush(clientId,"✅ OfficioYa","Denuncia cerrada.","/");
      }
      showToast("✓ Cerrada — ambos notificados");
    }else{
      showToast("Denuncia reabierta","warn");
    }
  };
  const sendSupport=async()=>{
    if(!selectedUser||!supportMsg.trim())return;
    setSendingMsg(true);
    const{data:nm}=await db.from("messages").insert({from_id:ADMIN_ID,to_id:selectedUser.id,text:"[Soporte OfficioYa] "+supportMsg,read:false}).select().single();
    if(nm)setMsgs(prev=>[nm as MessageRow,...prev]);
    await sendPush(selectedUser.id,"👑 OfficioYa Soporte",supportMsg.substring(0,80),"/");
    setSupportMsg("");setSendingMsg(false);
    showToast("✓ Mensaje enviado a "+selectedUser.name);
  };

  // ── CHAT THREAD VIEWER ───────────────────────────────────────────────────
  const getThreadMsgs=(u1id:string,u2id:string)=>
    msgs.filter(m=>(m.from_id===u1id&&m.to_id===u2id)||(m.from_id===u2id&&m.to_id===u1id))
      .sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime());

  // ── USERS TABLE ─────────────────────────────────────────────────────────
  const renderUsersTable=(list:UserRow[],title:string,emptyMsg:string,showFilters=false)=>(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {showFilters&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16,display:"flex",flexWrap:"wrap",gap:10,alignItems:"center"}}>
          <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="🔍 Nombre, email, teléfono..." style={{flex:1,minWidth:160,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 12px",color:C.text,fontFamily:"inherit",fontSize:12,outline:"none"}}/>
          <select value={filterType} onChange={e=>setFilterType(e.target.value as any)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 10px",color:C.text,fontFamily:"monospace",fontSize:11,cursor:"pointer"}}>
            <option value="all">Todos</option><option value="profesional">Profesionales</option><option value="cliente">Clientes</option>
          </select>
          <select value={filterPlan} onChange={e=>setFilterPlan(e.target.value as any)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 10px",color:C.text,fontFamily:"monospace",fontSize:11,cursor:"pointer"}}>
            <option value="all">Todos los planes</option>
            {(["gratis","basico","pro","elite"] as Plan[]).map(p=><option key={p} value={p}>{p.toUpperCase()}</option>)}
          </select>
          <select value={filterTrade} onChange={e=>setFilterTrade(e.target.value)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 10px",color:C.text,fontFamily:"monospace",fontSize:11,cursor:"pointer"}}>
            <option value="all">Todos los oficios</option>
            {TRADES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <input value={filterZone} onChange={e=>setFilterZone(e.target.value)} placeholder="Zona / barrio..." style={{width:130,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 10px",color:C.text,fontFamily:"inherit",fontSize:12,outline:"none"}}/>
          <select value={filterDate} onChange={e=>setFilterDate(e.target.value as any)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 10px",color:C.text,fontFamily:"monospace",fontSize:11,cursor:"pointer"}}>
            <option value="all">Siempre</option><option value="7d">Últimos 7 días</option><option value="30d">Últimos 30 días</option><option value="90d">Últimos 90 días</option>
          </select>
          <button onClick={()=>{setSearchQ("");setFilterType("all");setFilterPlan("all");setFilterTrade("all");setFilterZone("");setFilterDate("all");}} style={{fontSize:10,color:C.muted,background:"none",border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 12px",cursor:"pointer",fontFamily:"monospace"}}>✕ Limpiar</button>
          <span style={{fontSize:11,color:C.muted,fontFamily:"monospace"}}>{filteredUsers.length} resultados</span>
        </div>
      )}
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between"}}>
          <p style={{fontWeight:700,fontSize:13,color:C.text}}>{title}</p>
          <Pill label={`${list.length}`} color={C.accent} dot={false}/>
        </div>
        {list.length===0
          ?<div style={{padding:24,textAlign:"center",color:C.muted,fontSize:12}}>{emptyMsg}</div>
          :<div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                {["Usuario","Tipo","Plan","Oficio","Zona","Jobs","Rating","Alta","Trial","Acciones"].map(h=>(
                  <th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:9,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{list.slice(0,100).map(u=>{
                const daysLeft=u.trial_end?Math.max(0,Math.ceil((new Date(u.trial_end).getTime()-now.getTime())/86400000)):null;
                const isExpiring=daysLeft!==null&&daysLeft<=7&&daysLeft>0;
                const isExpired=daysLeft!==null&&daysLeft<=0&&u.plan==="gratis";
                const jc=proJobCount(u.id);
                return<tr key={u.id} style={{borderBottom:`1px solid ${C.border}`,background:(u as any).banned?"#FF335508":"transparent"}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=(u as any).banned?"#FF335512":C.cardHover;}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=(u as any).banned?"#FF335508":"transparent";}}>
                  <td style={{padding:"10px 14px"}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <Ava s={u.name.substring(0,2).toUpperCase()} size={28} color={PLAN_COLORS[u.plan as Plan]} imgUrl={(u as any).avatar_url||""}/>
                      <div>
                        <p style={{fontSize:12,fontWeight:700,color:C.text,whiteSpace:"nowrap"}}>{u.name}</p>
                        <p style={{fontSize:10,color:C.muted}}>{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{padding:"10px 14px"}}><span style={{fontSize:9,fontFamily:"monospace",color:u.type==="profesional"?C.accent:C.blue,background:(u.type==="profesional"?C.accent:C.blue)+"18",padding:"2px 7px",borderRadius:3,fontWeight:700}}>{u.type==="profesional"?"PRO":"CLI"}</span></td>
                  <td style={{padding:"10px 14px"}}><Badge plan={u.plan as Plan}/></td>
                  <td style={{padding:"10px 14px",fontSize:11,color:C.accent}}>{u.trade||"—"}</td>
                  <td style={{padding:"10px 14px",fontSize:11,color:C.muted}}>{u.zone||"—"}</td>
                  <td style={{padding:"10px 14px"}}><span style={{fontSize:13,fontWeight:700,color:jc===0&&u.type==="profesional"&&u.plan!=="gratis"?C.red:C.green}}>{jc}</span></td>
                  <td style={{padding:"10px 14px",fontSize:11,color:C.yellow}}>{u.rating?Number(u.rating).toFixed(1)+"★":"—"}</td>
                  <td style={{padding:"10px 14px",fontSize:10,color:C.muted,fontFamily:"monospace",whiteSpace:"nowrap"}}>{fmtDate(u.joined_at)}</td>
                  <td style={{padding:"10px 14px"}}>
                    {daysLeft!==null
                      ?<span style={{fontSize:10,fontFamily:"monospace",color:isExpired?C.red:isExpiring?C.yellow:C.muted,whiteSpace:"nowrap"}}>{isExpired?"⛔ Expirado":isExpiring?`⚠ ${daysLeft}d`:`${daysLeft}d`}</span>
                      :<span style={{color:C.muted,fontSize:10}}>—</span>}
                  </td>
                  <td style={{padding:"10px 14px"}}>
                    <div style={{display:"flex",gap:5,flexWrap:"nowrap"}}>
                      <button onClick={()=>setSelectedUser(u)} style={{fontSize:10,padding:"4px 8px",background:C.accentDim,border:`1px solid ${C.accent}44`,borderRadius:4,color:C.accent,cursor:"pointer",whiteSpace:"nowrap"}}>Ver</button>
                      {!u.verified&&u.type==="profesional"&&<button onClick={()=>verifyUser(u.id)} style={{fontSize:10,padding:"4px 8px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:4,color:C.green,cursor:"pointer"}}>✓</button>}
                      {u.phone&&<a href={"tel:"+u.phone} style={{fontSize:10,padding:"4px 8px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:4,color:C.green,textDecoration:"none"}}>📞</a>}
                      {(u as any).whatsapp&&<a href={"https://wa.me/"+((u as any).whatsapp||"").replace(/\D/g,"")} target="_blank" rel="noreferrer" style={{fontSize:10,padding:"4px 8px",background:"#25D36618",border:"1px solid #25D36644",borderRadius:4,color:"#25D366",textDecoration:"none"}}>WA</a>}
                      {(u as any).banned
                        ?<button onClick={()=>unblockUser(u.id)} style={{fontSize:10,padding:"4px 8px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:4,color:C.green,cursor:"pointer"}}>Desbloquear</button>
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

  // ── RENDER SECTIONS ───────────────────────────────────────────────────────

  const renderSalud=()=>(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <SectionTitle>KPIs de salud en tiempo real</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        <KpiCard label="MRR actual" value={mrr.toFixed(0)+"€"} color={C.green} sub={`Objetivo 5.000€ · ${((mrr/5000)*100).toFixed(0)}%`}/>
        <KpiCard label="Profesionales" value={fmt(pros.length)} color={C.accent} sub={`${pros.filter(u=>u.available).length} disponibles`}/>
        <KpiCard label="Clientes" value={fmt(clients.length)} color={C.blue} sub={`+${newLast7.filter(u=>u.type==="cliente").length} esta semana`}/>
        <KpiCard label="Conversión landing" value={leads.length>0?((leadsConverted/leads.length)*100).toFixed(1)+"%":"—"} color={C.purple} sub={`${leadsConverted} de ${leads.length} leads`}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        <KpiCard label="Pagando" value={fmt(paying.length)} color={C.gold} sub="plan activo"/>
        <KpiCard label="En trial" value={fmt(pros.filter(u=>u.plan==="gratis"&&u.trial_end&&new Date(u.trial_end)>now).length)} color={C.yellow} sub="primer mes"/>
        <KpiCard label="Expiran en 7d" value={fmt(expiring.length)} color={expiring.length>0?C.orange:C.green} sub="riesgo de churn"/>
        <KpiCard label="Denuncias" value={fmt(pendingReports.length)} color={pendingReports.length>0?C.red:C.green} sub="sin resolver"/>
      </div>
      <SectionTitle>Dónde se pierde la confianza</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
        {[
          {label:"Pros sin foto",count:sinFoto.length,color:C.orange,desc:"Peor conversión — cliente no confía sin cara",action:"Ver pros",onClick:()=>navTo("profesionales","activos")},
          {label:"Sin tarjeta registrada",count:sinCobro.length,color:C.red,desc:"Entraron pero no completaron el pago",action:"Llamar hoy",onClick:()=>navTo("flujo","leads")},
          {label:"Trial expirado sin pagar",count:expired.length,color:C.red,desc:"Usaron el servicio y se fueron sin convertir",action:"Ver lista",onClick:()=>navTo("profesionales","riesgo")},
          {label:"Reseñas sin moderar",count:pendingReviews.length,color:C.yellow,desc:"Pendientes de aprobar o rechazar",action:"Moderar",onClick:()=>navTo("disputas","resenas")},
          {label:"Pros pagando sin leads",count:sinLeads.length,color:C.orange,desc:"Pagan pero no ven retorno — riesgo de baja",action:"Actuar",onClick:()=>navTo("profesionales","sinleads")},
          {label:"Denuncias sin resolver",count:pendingReports.length,color:C.red,desc:"Daño activo a la reputación",action:"Resolver",onClick:()=>navTo("disputas","denuncias")},
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

  const renderFuga=()=>{
    const stuckJobs=jobs.filter(j=>j.status==="pending");
    return(
      <div style={{display:"flex",flexDirection:"column",gap:20}}>
        <SectionTitle>Monitor de fuga y bloqueos</SectionTitle>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
          <KpiCard label="Jobs pendientes" value={stuckJobs.length} color={stuckJobs.length>5?C.red:C.yellow} sub="sin resolver"/>
          <KpiCard label="En progreso" value={jobs.filter(j=>j.status==="in_progress").length} color={C.blue} sub="activos"/>
          <KpiCard label="Abandonos landing" value={leads.length-leadsConverted} color={C.orange} sub="sin convertir"/>
          <KpiCard label="Msgs no leídos" value={unreadMsgs} color={unreadMsgs>10?C.red:C.muted} sub="del sistema"/>
        </div>
        <SectionTitle>Jobs atascados</SectionTitle>
        {stuckJobs.length===0
          ?<div style={{background:C.card,border:`1px solid ${C.green}22`,borderRadius:10,padding:20,textAlign:"center",color:C.green,fontSize:13}}>✓ Sin jobs pendientes</div>
          :<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                  {["Trabajo","Cliente","Profesional","Hace"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:9,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em"}}>{h}</th>)}
                </tr></thead>
                <tbody>{stuckJobs.slice(0,20).map((j:any)=>{
                  const pro=users.find(u=>u.id===j.worker_id);
                  return<tr key={j.id} style={{borderBottom:`1px solid ${C.border}`}}>
                    <td style={{padding:"10px 14px",fontSize:12,color:C.text,fontWeight:600}}>{j.title}</td>
                    <td style={{padding:"10px 14px",fontSize:11,color:C.muted}}>{j.client_name}</td>
                    <td style={{padding:"10px 14px"}}>{pro?<button onClick={()=>setSelectedUser(pro)} style={{fontSize:11,color:C.accent,background:"none",border:`1px solid ${C.accent}33`,borderRadius:4,padding:"2px 8px",cursor:"pointer"}}>{pro.name}</button>:<span style={{color:C.muted,fontSize:11}}>—</span>}</td>
                    <td style={{padding:"10px 14px",fontSize:10,color:C.muted,fontFamily:"monospace"}}>{timeAgo(j.created_at)}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          </div>
        }
      </div>
    );
  };

  const renderAlertas=()=>{
    const urgent=[
      ...pendingReports.map(r=>({id:"r"+(r as any).id,type:"denuncia",msg:`Denuncia: "${(r as any).message?.slice(0,60)}..."`,color:C.red,action:()=>navTo("disputas","denuncias")})),
      ...expiring.map(u=>({id:"e"+u.id,type:"trial",msg:`${u.name} — trial expira en ${Math.ceil((new Date(u.trial_end).getTime()-now.getTime())/86400000)}d`,color:C.yellow,action:()=>setSelectedUser(u)})),
      ...sinCobro.slice(0,3).map(u=>({id:"sc"+u.id,type:"pago",msg:`${u.name} — registrado sin tarjeta`,color:C.orange,action:()=>setSelectedUser(u)})),
      ...pendingReviews.slice(0,3).map((r:any)=>({id:"rv"+r.id,type:"reseña",msg:`${r.client_name} — ${r.stars}★ sin moderar`,color:C.purple,action:()=>navTo("disputas","resenas")})),
    ];
    return(
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <SectionTitle>Acciones requeridas ahora</SectionTitle>
        {urgent.length===0
          ?<div style={{background:C.card,border:`1px solid ${C.green}22`,borderRadius:12,padding:32,textAlign:"center"}}>
            <p style={{fontSize:24,marginBottom:8}}>✓</p>
            <p style={{color:C.green,fontSize:14,fontWeight:700}}>Sin alertas pendientes</p>
          </div>
          :urgent.map(a=>(
            <div key={a.id} style={{background:C.card,border:`1px solid ${a.color}33`,borderRadius:10,padding:"14px 16px",display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:a.color,flexShrink:0,boxShadow:`0 0 8px ${a.color}88`,animation:"pulse 2s ease infinite"}}/>
              <div style={{flex:1}}>
                <span style={{fontSize:9,color:a.color,fontFamily:"monospace",fontWeight:700,textTransform:"uppercase" as const,marginRight:8}}>{a.type}</span>
                <span style={{fontSize:12,color:C.text}}>{a.msg}</span>
              </div>
              <button onClick={a.action} style={{fontSize:10,color:a.color,background:a.color+"18",border:`1px solid ${a.color}44`,borderRadius:6,padding:"5px 12px",cursor:"pointer",fontFamily:"monospace",fontWeight:700,flexShrink:0}}>Revisar →</button>
            </div>
          ))
        }
      </div>
    );
  };

  const renderFunnel=()=>{
    const steps=[
      {label:"Visitas estimadas",value:users.length*12,color:C.blue,pct:100},
      {label:"Formulario landing",value:leads.length,color:C.purple,pct:users.length*12>0?(leads.length/(users.length*12))*100:0},
      {label:"Registros completados",value:users.length,color:C.accent,pct:users.length*12>0?(users.length/(users.length*12))*100:0},
      {label:"Trial con tarjeta",value:pros.filter(u=>(u as any).stripe_customer_id).length,color:C.yellow,pct:pros.length>0?(pros.filter(u=>(u as any).stripe_customer_id).length/pros.length)*100:0},
      {label:"Convirtieron a pago",value:paying.length,color:C.green,pct:users.length>0?(paying.length/users.length)*100:0},
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
                <div style={{textAlign:"right" as const,fontSize:9,color:C.muted,fontFamily:"monospace",marginTop:4}}>
                  ↓ Drop: {steps[i+1]?(100-(steps[i+1].value/Math.max(1,step.value)*100)).toFixed(0):0}% se pierde aquí
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          {[
            {step:"Visita → Landing",lost:Math.max(0,users.length*12-leads.length),why:"No ven valor suficiente. Hook del anuncio poco claro.",color:C.blue},
            {step:"Landing → Registro",lost:Math.max(0,leads.length-users.length),why:"Rellenaron el form pero no completaron. Fricción en tarjeta.",color:C.purple},
            {step:"Trial → Pago",lost:pros.filter(u=>u.plan==="gratis"&&u.trial_end).length,why:"No percibieron valor. Sin leads = sin razón para pagar.",color:C.red},
          ].map(item=>(
            <div key={item.step} style={{background:C.card,border:`1px solid ${item.color}22`,borderRadius:12,padding:16}}>
              <p style={{fontSize:9,color:item.color,fontFamily:"monospace",textTransform:"uppercase" as const,letterSpacing:"0.1em",marginBottom:8}}>{item.step}</p>
              <p style={{fontWeight:900,fontSize:28,color:item.color,letterSpacing:"-1px",marginBottom:8}}>{item.lost}</p>
              <p style={{fontSize:11,color:C.muted,lineHeight:1.5}}>{item.why}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderLeads=()=>(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle>Leads landing — abandono y conversión</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        <KpiCard label="Total leads" value={leads.length} color={C.blue}/>
        <KpiCard label="Convirtieron" value={leadsConverted} color={C.green}/>
        <KpiCard label="Abandonaron" value={leads.length-leadsConverted} color={C.orange} sub="llamar ahora"/>
        <KpiCard label="Tasa conversión" value={leads.length>0?((leadsConverted/leads.length)*100).toFixed(1)+"%":"—"} color={C.purple}/>
      </div>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
              {["Nombre","Oficio","Email","Teléfono","Estado","Fecha","Contactar"].map(h=>(
                <th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:9,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {[...leads].sort((a:any,b:any)=>a.convirtio?1:-1).map((l:any)=>(
                <tr key={l.id} style={{borderBottom:`1px solid ${C.border}`,background:!l.convirtio?C.orange+"06":"transparent"}}>
                  <td style={{padding:"10px 14px",fontSize:12,color:C.text,fontWeight:600}}>{l.nombre}</td>
                  <td style={{padding:"10px 14px"}}><span style={{fontSize:10,color:C.accent,fontFamily:"monospace"}}>{l.oficio}</span></td>
                  <td style={{padding:"10px 14px",fontSize:11,color:C.muted}}>{l.email}</td>
                  <td style={{padding:"10px 14px"}}>{l.telefono&&<a href={"tel:"+l.telefono} style={{fontSize:11,color:C.green,textDecoration:"none",fontWeight:700}}>📞 {l.telefono}</a>}</td>
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
    </div>
  );

  const renderDenuncias=()=>(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle>Centro de disputas</SectionTitle>
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
          const statusColor=r.status==="approved"||r.status==="closed"?C.green:r.status==="investigating"?C.yellow:C.red;
          return(
            <div key={r.id} style={{background:C.card,border:`1px solid ${statusColor}33`,borderRadius:12,padding:16}}>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" as const,marginBottom:10}}>
                {(!r.status||r.status==="pending")&&<span style={{fontSize:8,background:C.red+"22",color:C.red,border:`1px solid ${C.red}44`,borderRadius:3,padding:"2px 6px",fontFamily:"monospace",fontWeight:900}}>URGENTE</span>}
                <span style={{fontSize:9,fontFamily:"monospace",color:C.orange,background:C.orange+"18",padding:"2px 7px",borderRadius:3,fontWeight:700}}>{r.type||"reporte"}</span>
                <Pill label={r.status==="approved"?"✓ Resuelto":r.status==="closed"?"✓ Cerrado":r.status==="investigating"?"🔍 Investigando":"⏳ Pendiente"} color={statusColor}/>
                <span style={{fontSize:9,color:C.muted,fontFamily:"monospace",marginLeft:"auto"}}>{fmtDate(r.created_at)}</span>
              </div>
              <p style={{fontSize:12,color:C.text,lineHeight:1.6,marginBottom:10}}>{r.message}</p>
              <div style={{display:"flex",gap:12,flexWrap:"wrap" as const,marginBottom:12}}>
                {from&&<span style={{fontSize:11,color:C.muted}}>👤 De: <span style={{color:C.text,fontWeight:600}}>{from.name||r.from_name}</span></span>}
                {pro&&<button onClick={()=>setSelectedUser(pro)} style={{fontSize:11,color:C.accent,background:"none",border:`1px solid ${C.accent}33`,borderRadius:4,padding:"2px 8px",cursor:"pointer"}}>🔨 {pro.name} → Ver perfil</button>}
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap" as const}}>
                {(!r.status||r.status==="pending")&&<button onClick={()=>updateReport(r.id,"investigating")} style={{fontSize:11,padding:"6px 14px",background:C.yellowDim,border:`1px solid ${C.yellow}44`,borderRadius:6,color:C.yellow,cursor:"pointer",fontWeight:600}}>🔍 Investigar</button>}
                {r.status==="investigating"&&<>
                  <button onClick={()=>updateReport(r.id,"approved")} style={{fontSize:11,padding:"6px 14px",background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:6,color:C.red,cursor:"pointer",fontWeight:700}}>🚫 Aprobar y bloquear pro</button>
                  <button onClick={()=>updateReport(r.id,"closed")} style={{fontSize:11,padding:"6px 14px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:6,color:C.green,cursor:"pointer",fontWeight:600}}>✓ Cerrar sin penalización</button>
                  <button onClick={()=>updateReport(r.id,"pending")} style={{fontSize:11,padding:"6px 14px",background:C.card,border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,cursor:"pointer"}}>Reabrir</button>
                </>}
                {(r.status==="approved"||r.status==="closed")&&pro&&<span style={{fontSize:11,color:statusColor,fontFamily:"monospace",display:"flex",alignItems:"center"}}>✓ {r.status==="approved"?"Pro bloqueado":"Cerrado"} · {pro.name}</span>}
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
        <SectionTitle>Moderación de reseñas</SectionTitle>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          <KpiCard label="Pendientes" value={pendientes.length} color={pendientes.length>0?C.yellow:C.green}/>
          <KpiCard label="Aprobadas" value={reviews.filter((r:any)=>r.approved===true).length} color={C.green}/>
          <KpiCard label="Media general" value={reviews.length>0?(reviews.reduce((s,r:any)=>s+r.stars,0)/reviews.length).toFixed(1)+"★":"—"} color={C.gold}/>
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
                  <button onClick={()=>approveReview(r.id)} style={{flex:1,fontSize:11,padding:"7px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:6,color:C.green,cursor:"pointer",fontWeight:700}}>✓ Aprobar — publicar</button>
                  <button onClick={()=>rejectReview(r.id)} style={{flex:1,fontSize:11,padding:"7px",background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:6,color:C.red,cursor:"pointer",fontWeight:700}}>✗ Rechazar — ocultar</button>
                </div>
              </div>
            );
          })
        }
      </div>
    );
  };

  const [newMsgTarget,setNewMsgTarget]=useState<string>("");
  const [newMsgText,setNewMsgText]=useState<string>("");
  const [sendingNew,setSendingNew]=useState(false);

  const sendNewMsg=async()=>{
    if(!newMsgTarget||!newMsgText.trim())return;
    setSendingNew(true);
    const target=users.find(u=>u.id===newMsgTarget);
    await db.from("messages").insert({from_id:ADMIN_ID,to_id:newMsgTarget,text:"[Soporte OfficioYa] "+newMsgText,read:false});
    if(target)await sendPush(newMsgTarget,"👑 OfficioYa Soporte",newMsgText.substring(0,80),"/");
    setNewMsgText("");setSendingNew(false);
    showToast("✓ Mensaje enviado a "+(target?.name||"usuario"));
  };

  const renderMensajes=()=>{
    // Build threads — include messages to/from ADMIN too
    const threadMap=new Map<string,{uid:string;user:UserRow|null;lastMsg:MessageRow;unread:number}>();
    msgs.filter(m=>m.from_id!==BOT_ID).forEach(m=>{
      // For each message, the "other" party (not admin) is the thread key
      const otherId=m.from_id===ADMIN_ID?m.to_id:m.to_id===ADMIN_ID?m.from_id:null;
      // For user-to-user threads, key by sorted pair
      const key=m.from_id===ADMIN_ID||m.to_id===ADMIN_ID
        ?(otherId||"")
        :[m.from_id,m.to_id].sort().join("|");
      if(!key)return;
      const existing=threadMap.get(key);
      const isUnread=!m.read&&m.from_id!==ADMIN_ID;
      const otherUser=users.find(u=>u.id===key)||users.find(u=>u.id===m.from_id)||users.find(u=>u.id===m.to_id)||null;
      if(!existing||new Date(m.created_at)>new Date(existing.lastMsg.created_at)){
        threadMap.set(key,{uid:key,user:otherUser,lastMsg:m,unread:(existing?.unread||0)+(isUnread?1:0)});
      }else if(isUnread){
        threadMap.set(key,{...existing,unread:existing.unread+1});
      }
    });
    const threads=[...threadMap.values()]
      .filter(t=>t.user!==null)
      .sort((a,b)=>new Date(b.lastMsg.created_at).getTime()-new Date(a.lastMsg.created_at).getTime());

    if(chatThread){
      const u1=chatThread.user1;
      const u2=chatThread.user2;
      const threadMsgs=msgs
        .filter(m=>(m.from_id===u1.id&&m.to_id===u2.id)||(m.from_id===u2.id&&m.to_id===u1.id))
        .sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime());
      const [replyText,setReplyText]=[chatThread as any,(v:any)=>setChatThread({...chatThread,...v})];
      return(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap" as const}}>
            <button onClick={()=>setChatThread(null)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,cursor:"pointer",padding:"6px 12px",fontSize:11}}>← Volver</button>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <Ava s={u1.name.substring(0,2).toUpperCase()} size={28} color={PLAN_COLORS[u1.plan as Plan]} imgUrl={(u1 as any).avatar_url||""}/>
              <span style={{fontSize:13,fontWeight:700,color:C.text}}>{u1.name}</span>
              <span style={{fontSize:11,color:C.muted}}>↔</span>
              <Ava s={u2.name.substring(0,2).toUpperCase()} size={28} color={PLAN_COLORS[u2.plan as Plan]} imgUrl={(u2 as any).avatar_url||""}/>
              <span style={{fontSize:13,fontWeight:700,color:C.text}}>{u2.name}</span>
            </div>
            <button onClick={async()=>{
              await db.from("messages").update({read:true}).or(`from_id.eq.${u1.id},from_id.eq.${u2.id}`);
              setMsgs(prev=>prev.map(m=>(m.from_id===u1.id||m.from_id===u2.id)?{...m,read:true}:m));
              showToast("✓ Marcado como leído");
            }} style={{marginLeft:"auto",fontSize:10,color:C.green,background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:6,padding:"5px 12px",cursor:"pointer"}}>✓ Marcar leído</button>
            <button onClick={()=>setSelectedUser(u1)} style={{fontSize:10,color:C.accent,background:C.accentDim,border:`1px solid ${C.accent}44`,borderRadius:6,padding:"5px 10px",cursor:"pointer"}}>Ver {u1.name}</button>
          </div>
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16,maxHeight:460,overflowY:"auto",display:"flex",flexDirection:"column",gap:10}}>
            {threadMsgs.map(m=>{
              const isFromU1=m.from_id===u1.id;
              const isAdmin=m.from_id===ADMIN_ID;
              const senderName=isAdmin?"👑 Admin":isFromU1?u1.name:u2.name;
              const parsed=parseMsg(m.text);
              return(
                <div key={m.id} style={{display:"flex",flexDirection:"column",alignItems:isAdmin?"center":isFromU1?"flex-start":"flex-end",gap:3}}>
                  <span style={{fontSize:9,color:C.muted,fontFamily:"monospace"}}>{senderName} · {timeAgo(m.created_at)}</span>
                  <div style={{maxWidth:"75%",background:isAdmin?C.accentDim:isFromU1?C.surface:C.blueDim,border:`1px solid ${isAdmin?C.accent+"44":isFromU1?C.border:C.blue+"44"}`,borderRadius:10,padding:"10px 14px"}}>
                    {parsed.type==="image"&&parsed.url?(
                      <div>
                        <img src={parsed.url} style={{maxWidth:220,maxHeight:200,borderRadius:8,cursor:"zoom-in",display:"block"}} onClick={()=>setImageModal(parsed.url!)} onError={(e:any)=>{e.target.style.display="none";}}/>
                        <button onClick={()=>setImageModal(parsed.url!)} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:10,padding:"4px 0"}}>🔍 Ampliar</button>
                      </div>
                    ):parsed.type==="video"&&parsed.url?(
                      <div>
                        <video src={parsed.url} controls style={{maxWidth:220,borderRadius:8}}/>
                      </div>
                    ):parsed.type==="file"&&parsed.url?(
                      <a href={parsed.url} target="_blank" rel="noreferrer" style={{fontSize:12,color:C.accent,textDecoration:"none"}}>📎 {parsed.label}</a>
                    ):(
                      <p style={{fontSize:12,color:C.text,lineHeight:1.5,margin:0}}>{m.text}</p>
                    )}
                  </div>
                  {!m.read&&m.from_id!==ADMIN_ID&&<span style={{fontSize:8,color:C.orange,fontFamily:"monospace"}}>no leído</span>}
                </div>
              );
            })}
            {threadMsgs.length===0&&<p style={{color:C.muted,fontSize:12,textAlign:"center"}}>Sin mensajes en este hilo</p>}
          </div>
          {/* Reply box */}
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
            <p style={{fontSize:11,color:C.muted,fontFamily:"monospace",marginBottom:8}}>RESPONDER COMO ADMIN → {u1.id===ADMIN_ID?u2.name:u1.name}</p>
            <AdminReplyBox targetId={u1.id===ADMIN_ID?u2.id:u1.id} targetName={u1.id===ADMIN_ID?u2.name:u1.name} onSent={(m)=>{setMsgs(prev=>[m,...prev]);showToast("✓ Enviado");}} users={users}/>
          </div>
        </div>
      );
    }

    return(
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <SectionTitle>Hub de conversaciones</SectionTitle>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          <KpiCard label="Hilos activos" value={threads.length} color={C.blue}/>
          <KpiCard label="No leídos" value={unreadMsgs} color={unreadMsgs>0?C.red:C.green}/>
          <KpiCard label="Total mensajes" value={msgs.length} color={C.muted}/>
        </div>

        {/* Nuevo mensaje a cualquier usuario */}
        <div style={{background:C.card,border:`1px solid ${C.accent}22`,borderRadius:12,padding:16}}>
          <p style={{fontSize:11,color:C.accent,fontFamily:"monospace",letterSpacing:"0.1em",marginBottom:12}}>✉ NUEVO MENSAJE DE SOPORTE</p>
          <div style={{display:"flex",gap:10,alignItems:"flex-start",flexWrap:"wrap" as const}}>
            <select value={newMsgTarget} onChange={e=>setNewMsgTarget(e.target.value)} style={{flex:1,minWidth:200,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",color:newMsgTarget?C.text:C.muted,fontFamily:"inherit",fontSize:12,cursor:"pointer"}}>
              <option value="">Seleccionar usuario...</option>
              <optgroup label="PROFESIONALES">{pros.map(u=><option key={u.id} value={u.id}>{u.name} ({u.plan})</option>)}</optgroup>
              <optgroup label="CLIENTES">{clients.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>
            </select>
            <textarea value={newMsgText} onChange={e=>setNewMsgText(e.target.value)} placeholder="Escribe el mensaje..." rows={2} style={{flex:2,minWidth:200,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",color:C.text,fontFamily:"inherit",fontSize:12,outline:"none",resize:"none" as const}}/>
            <button onClick={async()=>{
              if(!newMsgTarget||!newMsgText.trim())return;
              setSendingNew(true);
              const target=users.find(u=>u.id===newMsgTarget);
              const{data:nm}=await db.from("messages").insert({from_id:ADMIN_ID,to_id:newMsgTarget,text:"[Soporte OfficioYa] "+newMsgText,read:false}).select().single();
              if(nm)setMsgs(prev=>[nm as MessageRow,...prev]);
              if(target)await sendPush(newMsgTarget,"👑 OfficioYa Soporte",newMsgText.substring(0,80),"/");
              setNewMsgText("");setNewMsgTarget("");setSendingNew(false);
              showToast("✓ Mensaje enviado"+(target?" a "+target.name:""));
            }} disabled={sendingNew||!newMsgTarget||!newMsgText.trim()} style={{padding:"8px 18px",background:newMsgTarget&&newMsgText.trim()?C.accentDim:C.card,border:`1px solid ${newMsgTarget&&newMsgText.trim()?C.accent+"44":C.border}`,borderRadius:8,color:newMsgTarget&&newMsgText.trim()?C.accent:C.muted,cursor:newMsgTarget&&newMsgText.trim()?"pointer":"default",fontWeight:700,fontSize:12,fontFamily:"inherit",flexShrink:0}}>
              {sendingNew?"Enviando...":"Enviar + Push"}
            </button>
          </div>
        </div>

        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
          {threads.length===0
            ?<div style={{padding:24,textAlign:"center",color:C.muted,fontSize:12}}>Sin conversaciones todavía</div>
            :threads.map(({uid,user,lastMsg,unread})=>{
              if(!user)return null;
              const parsed=parseMsg(lastMsg.text);
              const preview=parsed.type==="image"?"📎 Imagen":parsed.type==="video"?"📎 Vídeo":parsed.type==="file"?`📎 ${parsed.label}`:lastMsg.text.substring(0,70);
              const isAdminThread=lastMsg.from_id===ADMIN_ID||lastMsg.to_id===ADMIN_ID;
              return(
                <div key={uid} style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:12,alignItems:"center",cursor:"pointer",background:unread>0?C.accent+"08":"transparent"}}
                  onClick={()=>{
                    const otherUser=lastMsg.from_id===ADMIN_ID?users.find(u=>u.id===lastMsg.to_id):users.find(u=>u.id===lastMsg.from_id);
                    const adminRow={id:ADMIN_ID,name:"Admin OfficioYa",email:"admin@oficioya.com",type:"admin",plan:"elite",verified:true,available:true} as UserRow;
                    if(isAdminThread&&otherUser){setChatThread({user1:adminRow,user2:otherUser});}
                    else{
                      const u1=users.find(u=>u.id===lastMsg.from_id);
                      const u2=users.find(u=>u.id===lastMsg.to_id);
                      if(u1&&u2)setChatThread({user1:u1,user2:u2});
                    }
                  }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=C.cardHover;}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=unread>0?C.accent+"08":"transparent";}}>
                  <Ava s={user.name.substring(0,2).toUpperCase()} size={34} color={PLAN_COLORS[user.plan as Plan]} imgUrl={(user as any).avatar_url||""}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:3}}>
                      <span style={{fontSize:12,fontWeight:700,color:unread>0?C.accent:C.text}}>{user.name}</span>
                      <span style={{fontSize:9,fontFamily:"monospace",color:user.type==="profesional"?C.accent:C.blue,background:(user.type==="profesional"?C.accent:C.blue)+"18",padding:"1px 5px",borderRadius:3}}>{user.type==="profesional"?"PRO":"CLI"}</span>
                      {isAdminThread&&<span style={{fontSize:9,color:C.gold,fontFamily:"monospace"}}>↔ Admin</span>}
                      {unread>0&&<span style={{fontSize:8,color:C.accent,background:C.accentDim,padding:"1px 5px",borderRadius:3,fontFamily:"monospace",fontWeight:900}}>{unread} nuevos</span>}
                      <span style={{fontSize:9,color:C.muted,marginLeft:"auto",fontFamily:"monospace"}}>{timeAgo(lastMsg.created_at)}</span>
                    </div>
                    <p style={{fontSize:11,color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{preview}</p>
                  </div>
                  <span style={{fontSize:10,color:C.accent,flexShrink:0}}>Ver →</span>
                </div>
              );
            })
          }
        </div>
      </div>
    );
  };


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
        <div style={{overflowX:"auto"}}>
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
              return<tr key={u.id} style={{borderBottom:`1px solid ${C.border}`}}>
                <td style={{padding:"10px 14px"}}>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <Ava s={u.name.substring(0,2).toUpperCase()} size={26} color={PLAN_COLORS[u.plan as Plan]} imgUrl={(u as any).avatar_url||""}/>
                    <div>
                      <p style={{fontSize:12,fontWeight:700,color:C.text}}>{u.name}</p>
                      <p style={{fontSize:10,color:C.muted}}>{u.trade||"—"}</p>
                    </div>
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

  // ── PANEL LATERAL USUARIO ─────────────────────────────────────────────────
  const renderUserPanel=()=>{
    if(!selectedUser)return null;
    const u=selectedUser;
    const userJobs=jobs.filter(j=>j.worker_id===u.id||j.client_id===u.id);
    const userMsgs=msgs.filter(m=>m.from_id===u.id||m.to_id===u.id);
    const daysLeft=u.trial_end?Math.max(0,Math.ceil((new Date(u.trial_end).getTime()-now.getTime())/86400000)):null;
    const userThread=userMsgs.length>0?users.find(ux=>ux.id!==(u.id)&&(userMsgs[0].from_id===ux.id||userMsgs[0].to_id===ux.id)):null;
    return(
      <div style={{position:"fixed",top:0,right:0,width:340,height:"100dvh",background:C.surface,borderLeft:`1px solid ${C.border}`,zIndex:500,overflowY:"auto",boxShadow:"-20px 0 60px rgba(0,0,0,0.6)"}}>
        <div style={{padding:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <p style={{fontWeight:800,fontSize:13,color:C.text}}>Perfil de usuario</p>
            <button onClick={()=>setSelectedUser(null)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,cursor:"pointer",padding:"4px 10px",fontSize:12}}>✕</button>
          </div>
          <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:20}}>
            <Ava s={u.name.substring(0,2).toUpperCase()} size={48} color={PLAN_COLORS[u.plan as Plan]} imgUrl={(u as any).avatar_url||""}/>
            <div>
              <p style={{fontWeight:800,fontSize:15,color:C.text}}>{u.name}</p>
              <p style={{fontSize:11,color:C.muted}}>{u.email}</p>
              <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap" as const}}>
                <Badge plan={u.plan as Plan}/>
                {u.verified&&<Pill label="Verificado" color={C.green}/>}
                {(u as any).banned&&<Pill label="Bloqueado" color={C.red}/>}
              </div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
            {[{l:"Jobs",v:proJobCount(u.id),c:C.accent},{l:"Reseñas",v:reviews.filter((r:any)=>r.worker_id===u.id).length,c:C.blue},{l:"Msgs",v:userMsgs.length,c:C.purple}]
              .map(s=><div key={s.l} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",textAlign:"center" as const}}>
                <p style={{fontWeight:900,fontSize:20,color:s.c}}>{s.v}</p>
                <p style={{fontSize:9,color:C.muted,fontFamily:"monospace"}}>{s.l}</p>
              </div>)}
          </div>
          {[{l:"Teléfono",v:u.phone},{l:"Oficio",v:u.trade},{l:"Zona",v:u.zone},{l:"Trial",v:daysLeft!==null?(daysLeft<=0?"⛔ Expirado":`${daysLeft}d restantes`):null},{l:"Alta",v:fmtDate(u.joined_at)}]
            .filter(i=>i.v).map(i=><div key={i.l} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:11,color:C.muted}}>{i.l}</span>
              <span style={{fontSize:11,color:C.text,fontWeight:600}}>{i.v}</span>
            </div>)}

          {userJobs.length>0&&<>
            <p style={{fontSize:10,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase" as const,marginTop:16,marginBottom:8}}>Historial jobs</p>
            {userJobs.slice(0,5).map(j=><div key={j.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontSize:11,color:C.text,fontWeight:600}}>{j.title}</span>
                <Pill label={j.status} color={j.status==="done"?C.green:j.status==="pending"?C.yellow:C.muted}/>
              </div>
              <p style={{fontSize:10,color:C.muted,marginTop:3}}>{fmtDate(j.created_at)}</p>
            </div>)}
          </>}

          {userMsgs.length>0&&<>
            <p style={{fontSize:10,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase" as const,marginTop:16,marginBottom:8}}>Últimos mensajes</p>
            {userMsgs.slice(0,4).map(m=>{
              const parsed=parseMsg(m.text);
              return<div key={m.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 10px",marginBottom:6}}>
                {parsed.type==="image"&&parsed.url
                  ?<button onClick={()=>setImageModal(parsed.url!)} style={{background:"none",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center",gap:6}}>
                    <img src={parsed.url} style={{width:40,height:40,borderRadius:4,objectFit:"cover"}} onError={(e:any)=>{e.target.style.display="none";}}/>
                    <span style={{fontSize:11,color:C.accent}}>📎 Ver imagen</span>
                  </button>
                  :<p style={{fontSize:11,color:C.mutedL,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.text.substring(0,60)}</p>
                }
                <p style={{fontSize:9,color:C.muted,fontFamily:"monospace",marginTop:2}}>{timeAgo(m.created_at)}</p>
              </div>;
            })}
            {userThread&&<button onClick={()=>{setSelectedUser(null);setChatThread({user1:u,user2:userThread});navTo("mensajes","chat");}} style={{width:"100%",fontSize:11,padding:"8px",background:C.blueDim,border:`1px solid ${C.blue}44`,borderRadius:8,color:C.blue,cursor:"pointer",fontWeight:600,marginTop:4}}>Ver conversación completa →</button>}
          </>}

          <p style={{fontSize:10,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase" as const,marginTop:16,marginBottom:8}}>Acciones rápidas</p>
          <div style={{display:"flex",gap:8,flexWrap:"wrap" as const,marginBottom:12}}>
            {!u.verified&&u.type==="profesional"&&<button onClick={()=>verifyUser(u.id)} style={{fontSize:11,padding:"7px 12px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:6,color:C.green,cursor:"pointer",fontWeight:700}}>✓ Verificar</button>}
            {(u as any).banned
              ?<button onClick={()=>unblockUser(u.id)} style={{fontSize:11,padding:"7px 12px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:6,color:C.green,cursor:"pointer",fontWeight:700}}>✓ Desbloquear</button>
              :<button onClick={()=>blockUser(u.id)} style={{fontSize:11,padding:"7px 12px",background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:6,color:C.red,cursor:"pointer",fontWeight:700}}>🚫 Bloquear</button>}
            {u.phone&&<a href={"tel:"+u.phone} style={{fontSize:11,padding:"7px 12px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:6,color:C.green,textDecoration:"none",fontWeight:700}}>📞 Llamar</a>}
            {(u as any).whatsapp&&<a href={"https://wa.me/"+((u as any).whatsapp||"").replace(/\D/g,"")} target="_blank" rel="noreferrer" style={{fontSize:11,padding:"7px 12px",background:"#25D36618",border:"1px solid #25D36644",borderRadius:6,color:"#25D366",textDecoration:"none",fontWeight:700}}>WA</a>}
          </div>
          <p style={{fontSize:10,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase" as const,marginBottom:8}}>Mensaje de soporte</p>
          <textarea value={supportMsg} onChange={e=>setSupportMsg(e.target.value)} placeholder="Escribe un mensaje directo..." rows={3} style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px",color:C.text,fontFamily:"inherit",fontSize:12,outline:"none",resize:"none",boxSizing:"border-box" as const}}/>
          <button onClick={sendSupport} disabled={sendingMsg||!supportMsg.trim()} style={{width:"100%",marginTop:8,padding:"10px",background:supportMsg.trim()?C.accentDim:C.card,border:`1px solid ${supportMsg.trim()?C.accent+"44":C.border}`,borderRadius:8,color:supportMsg.trim()?C.accent:C.muted,cursor:supportMsg.trim()?"pointer":"default",fontWeight:700,fontSize:12,fontFamily:"inherit"}}>
            {sendingMsg?"Enviando...":"Enviar mensaje"}
          </button>
        </div>
      </div>
    );
  };

  // ── SECTION ROUTER ────────────────────────────────────────────────────────
  const renderContent=()=>{
    if(section==="monitor"){
      if(sub==="salud")return renderSalud();
      if(sub==="fuga")return renderFuga();
      if(sub==="alertas")return renderAlertas();
    }
    if(section==="flujo"){
      if(sub==="funnel")return renderFunnel();
      if(sub==="trazabilidad")return(
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <SectionTitle>Buscador universal</SectionTitle>
          <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Buscar por nombre, email, ID, teléfono, oficio..." style={{width:"100%",background:C.card,border:`1px solid ${C.borderBright}`,borderRadius:10,padding:"12px 16px",color:C.text,fontFamily:"inherit",fontSize:13,outline:"none",boxSizing:"border-box" as const}}/>
          {searchQ.length>2&&renderUsersTable(users.filter(u=>{
            const q=searchQ.toLowerCase();
            return u.name.toLowerCase().includes(q)||u.email.toLowerCase().includes(q)||(u.trade||"").toLowerCase().includes(q)||(u.phone||"").includes(q);
          }).slice(0,10),"Resultados","Sin resultados")}
          {searchQ.length<=2&&<p style={{color:C.muted,fontSize:12,textAlign:"center",padding:24}}>Escribe al menos 3 caracteres</p>}
        </div>
      );
      if(sub==="leads")return renderLeads();
    }
    if(section==="profesionales"){
      if(sub==="activos")return renderUsersTable(filteredUsers.filter(u=>u.type==="profesional"&&u.available),"Profesionales activos","Sin profesionales activos",true);
      if(sub==="trial")return renderUsersTable(pros.filter(u=>u.plan==="gratis"&&u.trial_end&&new Date(u.trial_end)>now),"En trial","Sin profesionales en trial");
      if(sub==="riesgo")return renderUsersTable([...expiring,...expired],"Riesgo de churn","Sin pros en riesgo ✓");
      if(sub==="sinleads")return renderUsersTable(sinLeads,"Pros pagando sin leads","Todos los pros tienen leads ✓");
    }
    if(section==="usuarios"){
      if(sub==="todos")return renderUsersTable(filteredUsers,"Todos los usuarios","Sin usuarios",true);
      if(sub==="nuevos")return renderUsersTable(newLast7,"Nuevos últimos 7 días","Sin nuevos registros esta semana");
    }
    if(section==="disputas"){
      if(sub==="denuncias")return renderDenuncias();
      if(sub==="resenas")return renderResenas();
      if(sub==="sugerencias")return(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <SectionTitle>Sugerencias de usuarios</SectionTitle>
          {reports.filter((r:any)=>r.type==="sugerencia").length===0
            ?<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:24,textAlign:"center",color:C.muted,fontSize:13}}>Sin sugerencias todavía</div>
            :reports.filter((r:any)=>r.type==="sugerencia").map((r:any)=>(
              <div key={r.id} style={{background:C.card,border:`1px solid ${C.purple}33`,borderRadius:10,padding:"14px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <span style={{fontSize:11,color:C.purple,fontFamily:"monospace",fontWeight:700}}>SUGERENCIA</span>
                  <span style={{fontSize:10,color:C.muted}}>{fmtDate(r.created_at)}</span>
                </div>
                <p style={{fontSize:12,color:C.text,lineHeight:1.6}}>{r.message}</p>
              </div>
            ))
          }
        </div>
      );
    }
    if(section==="mensajes"){
      if(sub==="chat")return renderMensajes();
      if(sub==="soporte")return(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <SectionTitle>Mensajes de soporte enviados</SectionTitle>
          {msgs.filter(m=>m.from_id===ADMIN_ID).slice(0,30).map(m=>{
            const toUser=users.find(u=>u.id===m.to_id);
            return<div key={m.id} style={{background:C.card,border:`1px solid ${C.accent}22`,borderRadius:10,padding:"12px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:11,color:C.accent,fontWeight:700}}>→ {toUser?.name||m.to_id}</span>
                <span style={{fontSize:10,color:C.muted,fontFamily:"monospace"}}>{timeAgo(m.created_at)}</span>
              </div>
              <p style={{fontSize:12,color:C.mutedL}}>{m.text}</p>
            </div>;
          })}
          {msgs.filter(m=>m.from_id===ADMIN_ID).length===0&&<p style={{color:C.muted,fontSize:12,textAlign:"center",padding:24}}>Sin mensajes enviados todavía</p>}
        </div>
      );
    }
    if(section==="finanzas"){
      if(sub==="mrr"||sub==="ltv")return renderMRR();
      if(sub==="planes")return renderPlanes();
    }
    return null;
  };

  const toastColor=toast?.type==="ok"?C.green:toast?.type==="warn"?C.yellow:C.red;

  return(
    <div style={{minHeight:"100dvh",background:C.bg,color:C.text,fontFamily:"'DM Sans',sans-serif",display:"flex"}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}
        .content-area{animation:fadeIn 0.2s ease;}
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:${C.border};border-radius:99px;}
      `}</style>

      {/* SIDEBAR */}
      <aside style={{width:220,background:C.surface,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0,position:"sticky",top:0,height:"100dvh",overflowY:"auto"}}>
        <div style={{padding:"20px 18px 16px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:7,background:`linear-gradient(135deg,${C.accent},${C.orange})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>⚙</div>
            <div>
              <span style={{fontWeight:900,fontSize:14,letterSpacing:"-0.5px"}}><span style={{color:C.text}}>Oficio</span><span style={{color:C.accent}}>Ya</span></span>
              <div style={{fontSize:8,color:C.muted,fontFamily:"monospace",letterSpacing:"0.12em"}}>CEO PANEL</div>
            </div>
          </div>
          <div style={{marginTop:12,padding:"6px 10px",background:C.greenDim,border:`1px solid ${C.green}33`,borderRadius:7,display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:10,color:C.muted,fontFamily:"monospace"}}>MRR</span>
            <span style={{fontSize:11,fontWeight:800,color:C.green,fontFamily:"monospace"}}>{mrr.toFixed(0)}€</span>
          </div>
        </div>
        <nav style={{flex:1,padding:"12px 10px"}}>
          {NAV.map(nav=>(
            <div key={nav.id} style={{marginBottom:4}}>
              <button onClick={()=>{navTo(nav.id,nav.subs[0].id);}} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:8,background:section===nav.id?C.accentDim:"transparent",border:`1px solid ${section===nav.id?C.accent+"44":"transparent"}`,color:section===nav.id?C.accent:C.mutedL,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:section===nav.id?700:400,textAlign:"left" as const,transition:"all 0.12s"}}>
                <span style={{fontSize:12,opacity:0.8}}>{nav.icon}</span>
                <span>{nav.label}</span>
                {nav.id==="disputas"&&pendingReports.length>0&&<span style={{marginLeft:"auto",background:C.red,color:"#fff",borderRadius:99,minWidth:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900}}>{pendingReports.length}</span>}
                {nav.id==="mensajes"&&unreadMsgs>0&&<span style={{marginLeft:"auto",background:C.accent,color:C.bg,borderRadius:99,minWidth:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900}}>{unreadMsgs>9?"9+":unreadMsgs}</span>}
              </button>
              {section===nav.id&&(
                <div style={{marginLeft:10,marginTop:2,borderLeft:`1px solid ${C.border}`,paddingLeft:10}}>
                  {nav.subs.map(s=>(
                    <button key={s.id} onClick={()=>setSub(s.id)} style={{width:"100%",textAlign:"left" as const,padding:"6px 8px",borderRadius:6,background:sub===s.id?C.card:"transparent",border:`1px solid ${sub===s.id?C.border:"transparent"}`,color:sub===s.id?C.text:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:11,fontWeight:sub===s.id?600:400,marginBottom:1,transition:"all 0.1s"}}>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div style={{padding:"12px 10px",borderTop:`1px solid ${C.border}`}}>
          <button onClick={()=>setRefreshKey(k=>k+1)} style={{width:"100%",padding:"7px",background:"none",border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,cursor:"pointer",fontSize:11,fontFamily:"monospace",marginBottom:6}}>↻ Actualizar</button>
          <button onClick={onLogout} style={{width:"100%",padding:"7px",background:"none",border:`1px solid ${C.border}`,borderRadius:7,color:C.muted,cursor:"pointer",fontSize:11}}>Cerrar sesión</button>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        <header style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"0 24px",height:52,display:"flex",alignItems:"center",gap:12,flexShrink:0,position:"sticky",top:0,zIndex:100}}>
          <div style={{flex:1}}>
            <span style={{fontSize:13,fontWeight:700,color:C.text}}>{NAV.find(n=>n.id===section)?.label}</span>
            <span style={{fontSize:12,color:C.muted,marginLeft:8}}>/ {NAV.find(n=>n.id===section)?.subs.find(s=>s.id===sub)?.label}</span>
          </div>
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
          <div style={{fontSize:10,color:C.muted,fontFamily:"monospace"}}>{pros.length} pros · {clients.length} clientes</div>
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
