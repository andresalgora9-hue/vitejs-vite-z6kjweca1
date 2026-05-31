import React, { useState, useEffect, useCallback } from "react";
import { db, ADMIN_USER } from "./supabase";
import type { UserRow, MessageRow, JobRow, Plan } from "./supabase";

// ── Colores (mismos que App.tsx) ──
const C = {
  bg:"#0F1117", surface:"#161B27", card:"#1E2536", cardHover:"#263148",
  border:"#2D3A52", accent:"#FFD700", orange:"#FF8C00",
  red:"#FF4455", green:"#00D68F", blue:"#3B82F6", purple:"#8B5CF6",
  cyan:"#06B6D4", pink:"#EC4899", text:"#E8EDF5", muted:"#5A6A8A", mutedL:"#8899BB",
};

const PLAN_COLORS:Record<Plan,string> = {gratis:"#7777AA",basico:"#3B82F6",pro:"#FFD700",elite:"#FF8C00"};
const PLAN_PRICES:Record<Plan,number> = {gratis:0,basico:9.99,pro:24.99,elite:49.99};

function timeAgo(iso:string){
  const d=(Date.now()-new Date(iso).getTime())/1000;
  if(d<60)return"ahora";if(d<3600)return Math.floor(d/60)+"m";
  if(d<86400)return Math.floor(d/3600)+"h";return Math.floor(d/86400)+"d";
}
function formatTime(iso:string){
  return new Date(iso).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
}
function Spin(){return <div style={{display:"flex",justifyContent:"center",padding:40}}><div style={{width:28,height:28,border:"3px solid "+C.border,borderTop:"3px solid "+C.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite"}} /></div>;}
function Stars({n,size=13}:{n:number;size?:number}){
  return <span style={{fontSize:size,letterSpacing:1}}>
    {[1,2,3,4,5].map(i=><span key={i} style={{color:i<=Math.round(n)?C.accent:C.border}}>{i<=Math.round(n)?"★":"☆"}</span>)}
  </span>;
}
function Ava({s,size=44,color=C.purple,imgUrl=""}:{s:string;size?:number;color?:string;imgUrl?:string}){
  return <div style={{flexShrink:0}}>
    {imgUrl
      ?<img src={imgUrl} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",border:"2px solid "+color+"55",display:"block"}} onError={(e:any)=>{e.target.style.display="none";}} />
      :<div style={{width:size,height:size,borderRadius:"50%",background:"linear-gradient(135deg,"+color+"55,"+color+"22)",display:"flex",alignItems:"center",justifyContent:"center",color:C.accent,fontWeight:900,fontSize:Math.round(size*0.35),border:"2px solid "+color+"55",flexShrink:0}}>{s}</div>
    }
  </div>;
}
function GCard({children,style={},onClick,glow=""}:any){
  const [hov,setHov]=useState(false);
  return <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={onClick}
    style={{background:hov&&onClick?C.cardHover:C.card,borderRadius:14,border:"1px solid "+(hov&&glow?glow+"44":C.border),padding:18,transition:"all 0.2s",cursor:onClick?"pointer":"default",...style}}>{children}</div>;
}
function Badge({plan}:{plan:Plan}){
  const col=PLAN_COLORS[plan];
  return <span style={{padding:"2px 7px",borderRadius:4,fontSize:9,fontWeight:900,color:col,background:col+"22",border:"1px solid "+col+"44"}}>{plan.toUpperCase()}</span>;
}
function StatusDot({status}:{status:string}){
  const cols:Record<string,string>={pending:C.orange,in_progress:C.blue,done:C.green,cancelled:C.red};
  const labels:Record<string,string>={pending:"Pendiente",in_progress:"En progreso",done:"Completado",cancelled:"Cancelado"};
  const col=cols[status]||C.muted;
  return <span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:col,fontWeight:600}}>
    <span style={{width:6,height:6,borderRadius:"50%",background:col,display:"inline-block"}} />{labels[status]||status}
  </span>;
}
function Btn({children,onClick,color=C.accent,outline=false,full=false,small=false,disabled=false}:any){
  return <button onClick={onClick} disabled={disabled} style={{width:full?"100%":"auto",padding:small?"8px 14px":"12px 22px",background:outline?"transparent":"linear-gradient(135deg,"+color+","+color+"BB)",border:"1px solid "+color+(outline?"66":"22"),borderRadius:10,color:outline?color:"#000",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:small?13:14,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1}}>{children}</button>;
}

export default function Admin({onLogout}:{onLogout:()=>void}){
  type AdminTab="overview"|"usuarios"|"registros"|"trabajos"|"mensajes"|"reseñas"|"leads"|"certs"|"reports"|"sincobro"|"cobro15"|"sinleads"|"sinfoto";
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
  const [unreadAdminMsgs,setUnreadAdminMsgs]=useState(0);
  const [filterMsgs,setFilterMsgs]=useState<"all"|"unread">("all");
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
      const unread=allMsgs.filter((msg:any)=>!msg.read&&msg.from_id!=="00000000-0000-0000-0000-000000000002").length;
      setUnreadAdminMsgs(unread);
      setLoading(false);
    };
    load();
  },[refreshKey]);

  useEffect(()=>{
    const ch=db.channel("admin-realtime")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},(p:any)=>{
        const m=p.new as MessageRow;
        if(m.from_id!=="00000000-0000-0000-0000-000000000002"&&m.from_id!=="00000000-0000-0000-0000-000000000001"){
          setMsgs(prev=>{if(prev.find((x:any)=>x.id===m.id))return prev;return [m,...prev];});
          setUnreadAdminMsgs(c=>c+1);
          setToastMsg("💬 Nuevo mensaje");
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
    const poll=setInterval(async()=>{
      const {data}=await db.from("messages").select("*").order("created_at",{ascending:false});
      if(data) setMsgs(data as MessageRow[]);
    },5000);
    return()=>{db.removeChannel(ch);clearInterval(poll);};
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
    await fetch("https://rjwojxwrsbvwwshwwpvq.supabase.co/functions/v1/send-push",{
      method:"POST",
      headers:{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MTcxMzgsImV4cCI6MjA5Mzk5MzEzOH0.tO2eE-d7diaqV5nS0NUIAJnyn69xnpHYSJZa4DGQWfE","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MTcxMzgsImV4cCI6MjA5Mzk5MzEzOH0.tO2eE-d7diaqV5nS0NUIAJnyn69xnpHYSJZa4DGQWfE"},
      body:JSON.stringify({user_id:selectedUser.id,title:"👑 OfficioYa Soporte",body:supportMsg.substring(0,80),url:"/"}),
    }).catch(()=>{});
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
          <Ava s={u.name.substring(0,2).toUpperCase()} size={36} color={u.type==="profesional"?C.accent:C.blue} imgUrl={u.avatar_url||""} />
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
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}@keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.3;}}@keyframes fadeSlideUp{from{transform:translateY(12px);opacity:0;}to{transform:translateY(0);opacity:1;}}`}</style>
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

      {selectedUser&&(
        <div style={{position:"fixed",top:52,right:0,width:280,bottom:72,background:"linear-gradient(170deg,#12121E,#0A0A14)",borderLeft:"1px solid "+C.accent+"33",zIndex:90,overflowY:"auto",padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <p style={{fontWeight:800,color:C.text,fontSize:14}}>Detalle usuario</p>
            <button onClick={()=>setSelectedUser(null)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>✕</button>
          </div>
          <div style={{textAlign:"center",marginBottom:14}}>
            <Ava s={selectedUser.name.substring(0,2).toUpperCase()} size={50} color={selectedUser.type==="profesional"?C.accent:C.blue} imgUrl={selectedUser.avatar_url||""} />
            <p style={{fontWeight:800,color:C.text,fontSize:15,marginTop:8}}>{selectedUser.name}</p>
            <p style={{fontSize:11,color:C.muted}}>{selectedUser.email}</p>
            {selectedUser.phone&&<a href={"tel:"+selectedUser.phone} style={{fontSize:11,color:C.green,textDecoration:"none",display:"block",marginTop:3}}>📞 {selectedUser.phone}</a>}
            {selectedUser.whatsapp&&<a href={"https://wa.me/"+selectedUser.whatsapp.replace(/\D/g,"")} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#25D366",textDecoration:"none",display:"block",marginTop:3}}>💬 WhatsApp</a>}
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
            <p style={{fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6}}>💬 Enviar mensaje de soporte</p>
            <textarea value={supportMsg} onChange={e=>setSupportMsg(e.target.value)} placeholder="Mensaje al usuario..." style={{width:"100%",background:C.card,border:"1px solid "+C.border,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:12,padding:"8px 10px",resize:"vertical",minHeight:60,outline:"none",marginBottom:8}} />
            <Btn full small disabled={sendingMsg||!supportMsg.trim()} onClick={sendSupport} color={C.accent}>{sendingMsg?"Enviando...":"Enviar ahora →"}</Btn>
            <div style={{marginTop:16}}>
              <p style={{fontSize:11,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>💬 Conversación</p>
              <div style={{maxHeight:300,overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
                {msgs.filter(m=>(m.from_id===selectedUser.id&&m.to_id==="00000000-0000-0000-0000-000000000002")||(m.from_id==="00000000-0000-0000-0000-000000000002"&&m.to_id===selectedUser.id)).sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime()).map(m=>{
                  const isAdminMsg=m.from_id==="00000000-0000-0000-0000-000000000002";
                  return(
                    <div key={m.id} style={{display:"flex",justifyContent:isAdminMsg?"flex-end":"flex-start"}}>
                      <div style={{maxWidth:"85%",padding:"8px 12px",borderRadius:isAdminMsg?"12px 12px 2px 12px":"12px 12px 12px 2px",background:isAdminMsg?"linear-gradient(135deg,"+C.accent+","+C.orange+")":"linear-gradient(135deg,"+C.card+","+C.surface+")",border:isAdminMsg?"none":"1px solid "+C.border,color:isAdminMsg?"#000":C.text}}>
                        <p style={{fontSize:12,margin:0,lineHeight:1.4}}>{m.text.replace("[Soporte OfficioYa] ","")}</p>
                        <p style={{fontSize:9,margin:"4px 0 0",opacity:0.6,textAlign:"right"}}>{formatTime(m.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{maxWidth:selectedUser?820:1100,margin:"0 auto",padding:"16px",transition:"max-width 0.2s"}}>
        {loading?<Spin />:(<>
          {tab==="overview"&&(<>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
              <h2 style={{fontWeight:800,fontSize:20,color:C.text}}>Panel de control</h2>
              {PERIOD_BTNS}
            </div>
            {(()=>{
              const hoy=new Date();
              const sinCobro=users.filter(u=>u.type==="profesional"&&u.plan==="gratis"&&!(u as any).stripe_customer_id&&u.email&&!u.email.includes("demo")&&!u.email.includes("prueba"));
              const cobro15=users.filter(u=>u.type==="profesional"&&(u.plan==="elite"||u.plan==="pro"||u.plan==="basico")&&u.trial_end&&(new Date(u.trial_end).getTime()-hoy.getTime())/(86400000)<=15&&(new Date(u.trial_end).getTime()-hoy.getTime())/(86400000)>0);
              const sinLeads=users.filter(u=>u.type==="profesional"&&u.plan!=="gratis"&&(new Date(hoy.getTime()-7*86400000)>new Date(u.joined_at)));
              const sinFoto=users.filter(u=>u.type==="profesional"&&u.plan!=="gratis"&&!u.avatar_url&&!(u as any).photos?.length);
              const totalUrgente=sinCobro.length+cobro15.length;
              return(<>
                {totalUrgente>0&&(
                  <GCard style={{marginBottom:14,border:"1px solid "+C.red+"44",background:C.red+"08"}}>
                    <p style={{fontWeight:900,fontSize:13,color:C.red,marginBottom:10}}>🚨 URGENTE HOY — {totalUrgente} acción{totalUrgente>1?"es":""} pendiente{totalUrgente>1?"s":""}</p>
                    {sinCobro.length>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid "+C.border}}>
                      <div><p style={{fontSize:13,color:C.text,fontWeight:700}}>{sinCobro.length} pro{sinCobro.length>1?"s":""} se cayeron en el pago</p><p style={{fontSize:11,color:C.muted}}>Se registraron pero no pusieron tarjeta</p></div>
                      <button onClick={()=>setTab("sincobro")} style={{padding:"6px 12px",background:C.red,borderRadius:8,color:"#fff",border:"none",fontWeight:700,fontSize:12,cursor:"pointer"}}>Ver lista</button>
                    </div>}
                    {cobro15.length>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0"}}>
                      <div><p style={{fontSize:13,color:C.text,fontWeight:700}}>{cobro15.length} pro{cobro15.length>1?"s":""} con cobro en menos de 15 días</p><p style={{fontSize:11,color:C.muted}}>Avisarles antes de que se cobre</p></div>
                      <button onClick={()=>setTab("cobro15")} style={{padding:"6px 12px",background:C.orange,borderRadius:8,color:"#000",border:"none",fontWeight:700,fontSize:12,cursor:"pointer"}}>Ver lista</button>
                    </div>}
                  </GCard>
                )}
                {(sinLeads.length>0||sinFoto.length>0)&&(
                  <GCard style={{marginBottom:14,border:"1px solid "+C.orange+"44",background:C.orange+"08"}}>
                    <p style={{fontWeight:900,fontSize:13,color:C.orange,marginBottom:10}}>⚠️ ESTA SEMANA — riesgo de cancelación</p>
                    {sinLeads.length>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:sinFoto.length>0?"1px solid "+C.border:"none"}}>
                      <div><p style={{fontSize:13,color:C.text,fontWeight:700}}>{sinLeads.length} pro{sinLeads.length>1?"s":""} sin leads en 7+ días</p><p style={{fontSize:11,color:C.muted}}>Pueden pensar que la app no funciona</p></div>
                      <button onClick={()=>setTab("sinleads")} style={{padding:"6px 12px",background:C.orange,borderRadius:8,color:"#000",border:"none",fontWeight:700,fontSize:12,cursor:"pointer"}}>Ver lista</button>
                    </div>}
                    {sinFoto.length>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0"}}>
                      <div><p style={{fontSize:13,color:C.text,fontWeight:700}}>{sinFoto.length} pro{sinFoto.length>1?"s":""} sin foto ni bio</p><p style={{fontSize:11,color:C.muted}}>No convierten — hay que ayudarles</p></div>
                      <button onClick={()=>setTab("sinfoto")} style={{padding:"6px 12px",background:C.orange,borderRadius:8,color:"#000",border:"none",fontWeight:700,fontSize:12,cursor:"pointer"}}>Ver lista</button>
                    </div>}
                  </GCard>
                )}
              </>);
            })()}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8,marginBottom:16}}>
              {[{l:"Usuarios",v:users.length,c:C.blue,i:"👥"},{l:"Profesionales",v:pros.length,c:C.accent,i:"🔨"},{l:"Clientes",v:clients.length,c:C.green,i:"🏠"},{l:"Pagando",v:payingUsers.length,c:C.green,i:"✅"},{l:"En trial",v:trialUsers.length,c:C.cyan,i:"⏱"},{l:"Expirados",v:expiredUsers.length,c:C.red,i:"⛔"},{l:"MRR",v:mrr.toFixed(0)+"€",c:C.orange,i:"💰"},{l:"Conversión",v:pros.length>0?Math.round(payingUsers.length/pros.length*100)+"%":"0%",c:C.purple,i:"📈"}].map(s=>(
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
            {expiredUsers.length>0&&(<GCard style={{border:"1px solid "+C.red+"33"}}>
              <p style={{fontWeight:700,color:C.red,fontSize:13,marginBottom:10}}>⛔ {expiredUsers.length} leads fríos</p>
              <div style={{display:"flex",flexDirection:"column",gap:7,maxHeight:240,overflowY:"auto"}}>
                {expiredUsers.map(u=><UserRowItem key={u.id} u={u} />)}
              </div>
            </GCard>)}
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
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <button onClick={()=>setFilterMsgs("all")} style={{padding:"4px 10px",borderRadius:99,border:"1px solid "+(filterMsgs==="all"?C.accent:C.border),background:filterMsgs==="all"?C.accent+"18":"transparent",color:filterMsgs==="all"?C.accent:C.muted,cursor:"pointer",fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:700}}>Todos</button>
                <button onClick={()=>setFilterMsgs("unread")} style={{padding:"4px 10px",borderRadius:99,border:"1px solid "+(filterMsgs==="unread"?C.red:C.border),background:filterMsgs==="unread"?C.red+"18":"transparent",color:filterMsgs==="unread"?C.red:C.muted,cursor:"pointer",fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:700,display:"flex",alignItems:"center",gap:5}}>
                  <span style={{width:7,height:7,borderRadius:"50%",background:C.red,display:"inline-block"}} />
                  No leídos {unreadAdminMsgs>0&&`(${unreadAdminMsgs})`}
                </button>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {msgs.filter(m=>m.from_id!=="00000000-0000-0000-0000-000000000001"&&(filterMsgs==="all"||!m.read)).slice(0,50).map(m=>{
                const fromUser=users.find(u=>u.id===m.from_id);
                const toUser=users.find(u=>u.id===m.to_id);
                const isAdminMsg=m.from_id==="00000000-0000-0000-0000-000000000002";
                const isUnread=!m.read&&!isAdminMsg;
                return(
                  <div key={m.id} style={{background:isUnread?"linear-gradient(135deg,#1a1200,#1a0e00)":C.card,borderRadius:14,border:isUnread?"1px solid "+C.orange+"88":"1px solid "+C.border,padding:"14px 16px",position:"relative",overflow:"hidden"}}>
                    {isUnread&&<div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,"+C.orange+","+C.accent+")"}} />}
                    <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                      <div style={{width:38,height:38,borderRadius:10,flexShrink:0,background:isAdminMsg?"linear-gradient(135deg,"+C.orange+"33,"+C.orange+"18)":"linear-gradient(135deg,"+C.accent+"22,"+C.blue+"18)",border:"1px solid "+(isAdminMsg?C.orange+"44":C.accent+"33"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{isAdminMsg?"👑":isUnread?"🔴":"💬"}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                          <span style={{fontSize:12,color:isAdminMsg?C.orange:isUnread?C.accent:C.text,fontWeight:800}}>{isAdminMsg?"👑 OfficioYa Soporte":(fromUser?.name||"Usuario")}</span>
                          <span style={{fontSize:11,color:C.muted}}>→</span>
                          <span style={{fontSize:12,color:C.blue,fontWeight:700}}>{toUser?.name||"Usuario"}</span>
                          {isUnread&&<span style={{fontSize:9,fontWeight:900,color:"#000",background:"linear-gradient(135deg,"+C.orange+","+C.accent+")",padding:"2px 7px",borderRadius:99}}>● NUEVO</span>}
                        </div>
                        <p style={{fontSize:12,color:isUnread?C.text:C.mutedL,lineHeight:1.5}}>{m.text.substring(0,120)}{m.text.length>120?"...":""}</p>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
                          <span style={{fontSize:10,color:C.muted}}>{timeAgo(m.created_at)}</span>
                          {!isAdminMsg&&<button onClick={()=>setSelectedUser(toUser||fromUser||null)} style={{fontSize:10,color:"#000",background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",border:"none",borderRadius:6,cursor:"pointer",fontWeight:800,padding:"4px 10px",fontFamily:"'DM Sans',sans-serif"}}>Responder →</button>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
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
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {leads.length===0&&<p style={{textAlign:"center",color:C.muted,fontSize:13,padding:32}}>No hay leads todavía.</p>}
              {leads.map((l:any)=>(
                <GCard key={l.id} style={{padding:"11px 14px",border:"1px solid "+(l.convirtio?C.green+"33":C.orange+"22")}}>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:l.convirtio?C.green:C.orange,flexShrink:0}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontWeight:700,fontSize:13,margin:0}}>{l.nombre} · <span style={{color:C.accent}}>{l.oficio}</span></p>
                      <p style={{fontSize:11,color:C.muted,margin:0}}>{l.email}</p>
                      {l.telefono&&<a href={"tel:"+l.telefono} style={{fontSize:11,color:C.green,textDecoration:"none",fontWeight:700}}>📞 {l.telefono}</a>}
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
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
              {certs.length===0&&<p style={{textAlign:"center",color:C.muted,fontSize:13,padding:32}}>No hay certificados.</p>}
              {certs.map((c:any)=>(
                <GCard key={c.id} style={{padding:14,border:"1px solid "+(c.status==="approved"?C.green+"33":c.status==="rejected"?C.red+"33":C.orange+"33")}}>
                  <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10}}>
                    <div style={{flex:1}}>
                      <p style={{fontWeight:700,fontSize:13,margin:0}}>{c.title||c.type||"Certificado"}</p>
                      <p style={{fontSize:11,color:C.muted,margin:0}}>Pro ID: {c.user_id}</p>
                    </div>
                    <span style={{padding:"3px 8px",borderRadius:4,fontSize:10,fontWeight:800,background:c.status==="approved"?C.green+"22":c.status==="rejected"?C.red+"22":C.orange+"22",color:c.status==="approved"?C.green:c.status==="rejected"?C.red:C.orange}}>{c.status==="pending"||!c.status?"PENDIENTE":c.status==="approved"?"✓ APROBADO":"✗ RECHAZADO"}</span>
                  </div>
                  {(c.status==="pending"||!c.status)&&(
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={async()=>{await db.from("certifications").update({status:"approved"}).eq("id",c.id);setCerts(p=>p.map((x:any)=>x.id===c.id?{...x,status:"approved"}:x));}} style={{padding:"7px 14px",background:C.green+"22",border:"1px solid "+C.green+"44",borderRadius:8,color:C.green,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:700}}>✓ Aprobar</button>
                      <button onClick={async()=>{await db.from("certifications").update({status:"rejected"}).eq("id",c.id);setCerts(p=>p.map((x:any)=>x.id===c.id?{...x,status:"rejected"}:x));}} style={{padding:"7px 14px",background:C.red+"18",border:"1px solid "+C.red+"33",borderRadius:8,color:C.red,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:700}}>✗ Rechazar</button>
                    </div>
                  )}
                </GCard>
              ))}
            </div>
          </>)}

          {tab==="reports"&&(<><h2 style={{fontWeight:800,fontSize:20,color:C.text,marginBottom:14}}>Reports</h2><p style={{color:C.muted,fontSize:13}}>Sin reportes todavía.</p></>)}

          {tab==="sincobro"&&(<>
            <h2 style={{fontWeight:800,fontSize:20,color:C.text,marginBottom:14}}>Registrados sin tarjeta</h2>
            <p style={{color:C.muted,fontSize:13,marginBottom:16}}>Pros que se registraron pero no completaron el pago. Llámalos hoy.</p>
            {users.filter(u=>u.type==="profesional"&&u.plan==="gratis"&&!(u as any).stripe_customer_id&&u.email&&!u.email.includes("demo")&&!u.email.includes("prueba")).sort((a,b)=>new Date(b.joined_at).getTime()-new Date(a.joined_at).getTime()).map(u=>(
              <GCard key={u.id} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                  <div style={{flex:1}}>
                    <p style={{fontWeight:800,fontSize:15,color:C.text,marginBottom:2}}>{u.name}</p>
                    <p style={{fontSize:12,color:C.muted,marginBottom:4}}>{u.trade} · {u.zone}</p>
                    <p style={{fontSize:12,color:C.mutedL}}>{u.email}</p>
                    {u.phone&&<p style={{fontSize:12,color:C.mutedL}}>{u.phone}</p>}
                    <p style={{fontSize:11,color:C.muted,marginTop:4}}>Registro: {new Date(u.joined_at).toLocaleDateString("es-ES",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</p>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                    {u.phone&&<a href={"tel:"+u.phone} style={{padding:"7px 14px",background:C.green,borderRadius:8,color:"#000",fontWeight:700,fontSize:12,textDecoration:"none"}}>Llamar</a>}
                    {u.whatsapp&&<a href={"https://wa.me/"+u.whatsapp.replace(/\D/g,"")} target="_blank" rel="noreferrer" style={{padding:"7px 14px",background:"#25D366",borderRadius:8,color:"#000",fontWeight:700,fontSize:12,textDecoration:"none"}}>WhatsApp</a>}
                  </div>
                </div>
              </GCard>
            ))}
          </>)}

          {tab==="cobro15"&&(<>
            <h2 style={{fontWeight:800,fontSize:20,color:C.text,marginBottom:6}}>Cobro en menos de 15 días</h2>
            <p style={{color:C.muted,fontSize:13,marginBottom:16}}>Pros con trial acabando pronto.</p>
            {users.filter(u=>u.type==="profesional"&&(u.plan==="elite"||u.plan==="pro"||u.plan==="basico")&&u.trial_end&&(new Date(u.trial_end).getTime()-new Date().getTime())/(86400000)<=15&&(new Date(u.trial_end).getTime()-new Date().getTime())/(86400000)>0).sort((a,b)=>new Date(a.trial_end).getTime()-new Date(b.trial_end).getTime()).map(u=>{
              const dias=Math.ceil((new Date(u.trial_end).getTime()-new Date().getTime())/86400000);
              return(
                <GCard key={u.id} style={{marginBottom:10,border:"1px solid "+C.orange+"44"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}><p style={{fontWeight:800,fontSize:15,color:C.text}}>{u.name}</p><Badge plan={u.plan as Plan} /></div>
                      <p style={{fontSize:12,color:C.muted,marginBottom:4}}>{u.trade} · {u.zone}</p>
                      <p style={{fontSize:12,color:C.mutedL}}>{u.email}</p>
                      <p style={{fontSize:12,color:C.orange,fontWeight:700,marginTop:6}}>⏰ Se cobra en {dias} día{dias>1?"s":""}</p>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                      {u.phone&&<a href={"tel:"+u.phone} style={{padding:"7px 14px",background:C.green,borderRadius:8,color:"#000",fontWeight:700,fontSize:12,textDecoration:"none"}}>Llamar</a>}
                      {u.whatsapp&&<a href={"https://wa.me/"+u.whatsapp.replace(/\D/g,"")} target="_blank" rel="noreferrer" style={{padding:"7px 14px",background:"#25D366",borderRadius:8,color:"#000",fontWeight:700,fontSize:12,textDecoration:"none"}}>WhatsApp</a>}
                    </div>
                  </div>
                </GCard>
              );
            })}
          </>)}

          {tab==="sinleads"&&(<>
            <h2 style={{fontWeight:800,fontSize:20,color:C.text,marginBottom:6}}>Pros sin leads en 7+ días</h2>
            <p style={{color:C.muted,fontSize:13,marginBottom:16}}>Riesgo alto de cancelación.</p>
            {users.filter(u=>u.type==="profesional"&&u.plan!=="gratis"&&!u.email.includes("demo")).map(u=>(
              <GCard key={u.id} style={{marginBottom:10,border:"1px solid "+C.orange+"33"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}><p style={{fontWeight:800,fontSize:15,color:C.text}}>{u.name}</p><Badge plan={u.plan as Plan} /></div>
                    <p style={{fontSize:12,color:C.muted}}>{u.trade} · {u.zone}</p>
                    <p style={{fontSize:12,color:C.mutedL}}>{u.email}</p>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                    {u.phone&&<a href={"tel:"+u.phone} style={{padding:"7px 14px",background:C.green,borderRadius:8,color:"#000",fontWeight:700,fontSize:12,textDecoration:"none"}}>Llamar</a>}
                    {u.whatsapp&&<a href={"https://wa.me/"+u.whatsapp.replace(/\D/g,"")} target="_blank" rel="noreferrer" style={{padding:"7px 14px",background:"#25D366",borderRadius:8,color:"#000",fontWeight:700,fontSize:12,textDecoration:"none"}}>WhatsApp</a>}
                  </div>
                </div>
              </GCard>
            ))}
          </>)}

          {tab==="sinfoto"&&(<>
            <h2 style={{fontWeight:800,fontSize:20,color:C.text,marginBottom:6}}>Pros sin foto ni bio</h2>
            <p style={{color:C.muted,fontSize:13,marginBottom:16}}>Perfil incompleto — no convierten.</p>
            {users.filter(u=>u.type==="profesional"&&u.plan!=="gratis"&&!u.avatar_url&&!u.email.includes("demo")).map(u=>(
              <GCard key={u.id} style={{marginBottom:10,border:"1px solid "+C.orange+"33"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}><p style={{fontWeight:800,fontSize:15,color:C.text}}>{u.name}</p><Badge plan={u.plan as Plan} /></div>
                    <p style={{fontSize:12,color:C.muted}}>{u.trade} · {u.zone}</p>
                    <p style={{fontSize:12,color:C.mutedL}}>{u.email}</p>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                    {u.phone&&<a href={"tel:"+u.phone} style={{padding:"7px 14px",background:C.green,borderRadius:8,color:"#000",fontWeight:700,fontSize:12,textDecoration:"none"}}>Llamar</a>}
                    {u.whatsapp&&<a href={"https://wa.me/"+u.whatsapp.replace(/\D/g,"")} target="_blank" rel="noreferrer" style={{padding:"7px 14px",background:"#25D366",borderRadius:8,color:"#000",fontWeight:700,fontSize:12,textDecoration:"none"}}>WhatsApp</a>}
                  </div>
                </div>
              </GCard>
            ))}
          </>)}
        </>)}
      </div>

      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(10,10,15,0.98)",backdropFilter:"blur(20px)",borderTop:"1px solid "+C.accent+"22",display:"flex",zIndex:200,overflowX:"auto",paddingBottom:"calc(10px + env(safe-area-inset-bottom))",paddingTop:"10px"}}>
        {([["overview","📊","Hoy"],["usuarios","👥","Usuarios"],["registros","📅","Registros"],["trabajos","🔨","Trabajos"],["mensajes","💬","Mensajes"],["reseñas","⭐","Reseñas"],["leads","📋","Leads"],["certs","🏅","Certs"],["reports","🚩","Reports"],["sincobro","💸","Sin cobro"],["cobro15","⏰","Cobro15"],["sinleads","📉","Sin leads"],["sinfoto","🖼️","Sin foto"]] as const).map(([id,icon,label])=>(
          <button key={id} onClick={()=>{setTab(id as AdminTab);if(id==="mensajes")setUnreadAdminMsgs(0);}} style={{flex:"0 0 auto",minWidth:60,padding:"8px 4px 10px",background:"none",border:"none",color:tab===id?C.accent:C.muted,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,borderBottom:tab===id?"2px solid "+C.accent:"2px solid transparent",position:"relative"}}>
            <span style={{fontSize:16,position:"relative"}}>
              {icon}
              {id==="mensajes"&&unreadAdminMsgs>0&&tab!=="mensajes"&&(
                <span style={{position:"absolute",top:-4,right:-4,background:C.red,color:"#fff",borderRadius:99,minWidth:14,height:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900,border:"1px solid "+C.bg,padding:"0 2px"}}>{unreadAdminMsgs>9?"9+":unreadAdminMsgs}</span>
              )}
            </span>
            <span style={{fontSize:8,fontWeight:600,whiteSpace:"nowrap"}}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
