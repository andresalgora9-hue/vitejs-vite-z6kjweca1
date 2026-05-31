import React, { useState, useEffect, useCallback, useRef } from "react";
import { db } from "./supabase";
import type { UserRow, MessageRow, JobRow, Plan } from "./supabase";

// ── Paleta CEO Dark ──
const C = {
  bg:"#080810", surface:"#0d0d1a", card:"#111120",
  border:"#1a1a2e", borderBright:"#2a2a45",
  accent:"#FFB800", accentDim:"#FFB80022",
  gold:"#FFD700", orange:"#FF8C00",
  red:"#FF3355", redDim:"#FF335518",
  green:"#00E676", greenDim:"#00E67618",
  blue:"#4488FF", blueDim:"#4488FF18",
  yellow:"#FFB800", yellowDim:"#FFB80018",
  text:"#F0EDE8", muted:"#4a4a6a", mutedL:"#6a6a8a",
  cyan:"#00D4FF",
};

const PLAN_PRICES:Record<Plan,number> = {gratis:0,basico:9.99,pro:24.99,elite:49.99};
const PLAN_COLORS:Record<Plan,string> = {gratis:C.muted,basico:C.blue,pro:C.gold,elite:C.orange};

function timeAgo(iso:string){
  const d=(Date.now()-new Date(iso).getTime())/1000;
  if(d<60)return"ahora";if(d<3600)return Math.floor(d/60)+"m";
  if(d<86400)return Math.floor(d/3600)+"h";return Math.floor(d/86400)+"d";
}
function formatTime(iso:string){
  return new Date(iso).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
}
function fmt(n:number){return n.toLocaleString("es-ES");}

// ── ATOMS ──
function Spin({size=20,color=C.accent}:{size?:number;color?:string}){
  return <div style={{width:size,height:size,border:`2px solid ${C.border}`,borderTop:`2px solid ${color}`,borderRadius:"50%",animation:"spin 0.8s linear infinite",flexShrink:0}} />;
}
function Badge({plan}:{plan:Plan}){
  const col=PLAN_COLORS[plan];
  return <span style={{padding:"2px 8px",borderRadius:4,fontSize:9,fontWeight:800,letterSpacing:"0.08em",color:col,background:col+"22",border:`1px solid ${col}44`}}>{plan.toUpperCase()}</span>;
}
function StatusPill({label,color}:{label:string;color:string}){
  return <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 9px",borderRadius:99,fontSize:10,fontWeight:700,color,background:color+"18",border:`1px solid ${color}33`}}>
    <span style={{width:5,height:5,borderRadius:"50%",background:color,display:"inline-block"}} />{label}
  </span>;
}
function Ava({s,size=36,color=C.accent,imgUrl=""}:{s:string;size?:number;color?:string;imgUrl?:string}){
  return imgUrl
    ?<img src={imgUrl} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",border:`1px solid ${color}44`,flexShrink:0}} onError={(e:any)=>{e.target.style.display="none";}} />
    :<div style={{width:size,height:size,borderRadius:"50%",background:`linear-gradient(135deg,${color}44,${color}11)`,display:"flex",alignItems:"center",justifyContent:"center",color,fontWeight:900,fontSize:Math.round(size*0.35),border:`1px solid ${color}33`,flexShrink:0}}>{s}</div>;
}

// ── MINI SPARKLINE ──
function Sparkline({data,color=C.accent,height=40}:{data:number[];color?:string;height?:number}){
  const max=Math.max(...data,1);
  const pts=data.map((v,i)=>{
    const x=(i/(data.length-1))*100;
    const y=height-((v/max)*(height-4))-2;
    return `${x},${y}`;
  }).join(" ");
  return(
    <svg viewBox={`0 0 100 ${height}`} width="100%" height={height} style={{overflow:"visible"}}>
      <defs>
        <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts} 100,${height}`} fill={`url(#sg-${color.replace("#","")})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      {data.length>0&&<circle cx={(data.length-1)/(data.length-1)*100} cy={height-((data[data.length-1]/max)*(height-4))-2} r="2.5" fill={color}/>}
    </svg>
  );
}

// ── SEMÁFORO KPI ──
function TrafficLight({value,target,label,format="number"}:{value:number;target:number;label:string;format?:"number"|"percent"|"euro"}){
  const ratio=value/target;
  const color=ratio>=0.9?C.green:ratio>=0.7?C.yellow:C.red;
  const status=ratio>=0.9?"✓ Objetivo":ratio>=0.7?"⚠ Alerta":"✗ Crítico";
  const display=format==="euro"?value.toFixed(0)+"€":format==="percent"?value.toFixed(1)+"%":fmt(Math.round(value));
  return(
    <div style={{background:C.card,border:`1px solid ${color}33`,borderRadius:12,padding:"16px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${color},${color}88)`}} />
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <span style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",fontFamily:"monospace"}}>{label}</span>
        <span style={{fontSize:9,color,fontWeight:700,background:color+"18",padding:"2px 7px",borderRadius:99}}>{status}</span>
      </div>
      <p style={{fontWeight:900,fontSize:28,color,letterSpacing:"-1px",lineHeight:1,marginBottom:4}}>{display}</p>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <div style={{flex:1,height:4,background:C.border,borderRadius:99,overflow:"hidden"}}>
          <div style={{height:"100%",width:Math.min(100,ratio*100)+"%",background:color,borderRadius:99,transition:"width 1s ease"}} />
        </div>
        <span style={{fontSize:9,color:C.muted,fontFamily:"monospace"}}>/{format==="euro"?target+"€":format==="percent"?target+"%":fmt(target)}</span>
      </div>
    </div>
  );
}

// ── FUNNEL BAR ──
function FunnelBar({label,value,total,color}:{label:string;value:number;total:number;color:string}){
  const pct=total>0?Math.round((value/total)*100):0;
  return(
    <div style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
        <span style={{fontSize:12,color:C.mutedL}}>{label}</span>
        <span style={{fontSize:12,fontWeight:700,color,fontFamily:"monospace"}}>{fmt(value)} <span style={{color:C.muted,fontWeight:400}}>({pct}%)</span></span>
      </div>
      <div style={{height:6,background:C.border,borderRadius:99,overflow:"hidden"}}>
        <div style={{height:"100%",width:pct+"%",background:`linear-gradient(90deg,${color},${color}88)`,borderRadius:99,transition:"width 1s ease"}} />
      </div>
    </div>
  );
}

export default function Admin({onLogout}:{onLogout:()=>void}){
  type Window="ops"|"marketing"|"strategy"|"finance"|"mensajes";
  const [win,setWin]=useState<Window>("strategy");
  const [users,setUsers]=useState<UserRow[]>([]);
  const [msgs,setMsgs]=useState<MessageRow[]>([]);
  const [jobs,setJobs]=useState<JobRow[]>([]);
  const [reviews,setReviews]=useState<any[]>([]);
  const [leads,setLeads]=useState<any[]>([]);
  const [reports,setReports]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [toast,setToast]=useState<{msg:string;type:"ok"|"err"}|null>(null);
  const [selectedUser,setSelectedUser]=useState<UserRow|null>(null);
  const [supportMsg,setSupportMsg]=useState("");
  const [sendingMsg,setSendingMsg]=useState(false);
  const [filterOps,setFilterOps]=useState<"all"|"pro"|"cliente">("pro");
  const [filterPlan,setFilterPlan]=useState<"all"|Plan>("all");
  const [searchOps,setSearchOps]=useState("");
  const [unread,setUnread]=useState(0);
  const [refreshKey,setRefreshKey]=useState(0);
  const [period,setPeriod]=useState<7|14|30>(7);

  const showToast=(msg:string,type:"ok"|"err"="ok")=>{
    setToast({msg,type});
    setTimeout(()=>setToast(null),3000);
  };

  const load=useCallback(async()=>{
    setLoading(true);
    const [u,m,j,r,ld,rp]=await Promise.all([
      db.from("users").select("*").order("joined_at",{ascending:false}),
      db.from("messages").select("*").order("created_at",{ascending:false}).limit(200),
      db.from("jobs").select("*").order("created_at",{ascending:false}),
      db.from("reviews").select("*").order("created_at",{ascending:false}),
      db.from("leads_landing").select("*").order("created_at",{ascending:false}),
      db.from("reports").select("*").order("created_at",{ascending:false}),
    ]);
    const allUsers=(u.data||[]).filter((x:any)=>x.type!=="admin"&&x.id!=="00000000-0000-0000-0000-000000000002");
    setUsers(allUsers as UserRow[]);
    setMsgs((m.data||[]) as MessageRow[]);
    setJobs((j.data||[]) as JobRow[]);
    setReviews((r.data||[]) as any[]);
    setLeads((ld.data||[]) as any[]);
    setReports((rp.data||[]) as any[]);
    const u2=(m.data||[]).filter((x:any)=>!x.read&&x.from_id!=="00000000-0000-0000-0000-000000000002").length;
    setUnread(u2);
    setLoading(false);
  },[]);

  useEffect(()=>{load();},[load,refreshKey]);

  useEffect(()=>{
    const ch=db.channel("admin-rt")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},(p:any)=>{
        const m=p.new as MessageRow;
        if(m.from_id!=="00000000-0000-0000-0000-000000000002"){
          setMsgs(prev=>{if(prev.find((x:any)=>x.id===m.id))return prev;return [m,...prev];});
          setUnread(c=>c+1);
        }
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages"},(p:any)=>{
        const m=p.new as MessageRow;
        setMsgs(prev=>prev.map(x=>x.id===m.id?{...x,...m}:x));
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"users"},(p:any)=>{
        const u=p.new as UserRow;
        if(u.type!=="admin") setUsers(prev=>[u,...prev]);
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"reviews"},(p:any)=>{
        const r=p.new;
        setReviews(prev=>{if(prev.find((x:any)=>x.id===r.id))return prev;return [r,...prev];});
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"reviews"},(p:any)=>{
        const r=p.new;
        if(r.approved===false){
          setReviews(prev=>prev.filter((x:any)=>x.id!==r.id));
        } else {
          setReviews(prev=>prev.map((x:any)=>x.id===r.id?{...x,...r}:x));
        }
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"reports"},(p:any)=>{
        const r=p.new;
        setReports(prev=>{if(prev.find((x:any)=>x.id===r.id))return prev;return [r,...prev];});
      })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"reports"},(p:any)=>{
        const r=p.new;
        setReports(prev=>prev.map((x:any)=>x.id===r.id?{...x,...r}:x));
      })
      .subscribe();
    return()=>{db.removeChannel(ch);};
  },[]);

  // ── DERIVED DATA ──
  const pros=users.filter(u=>u.type==="profesional");
  const clients=users.filter(u=>u.type==="cliente");
  const paying=pros.filter(u=>u.plan!=="gratis");
  const mrr=paying.reduce((s,u)=>s+PLAN_PRICES[u.plan as Plan],0);
  const mrrTarget=5000;
  const now=new Date();

  // Registros por día (últimos N días)
  const dailyRegs=(days:number)=>{
    const result:Record<string,number>={};
    for(let i=days-1;i>=0;i--){
      const d=new Date(Date.now()-i*86400000);
      result[d.toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit"})]=0;
    }
    users.forEach(u=>{
      const k=new Date(u.joined_at).toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit"});
      if(k in result) result[k]++;
    });
    return Object.values(result);
  };

  const weekData=dailyRegs(period);
  const totalNewPeriod=weekData.reduce((a,b)=>a+b,0);

  // Conversion funnel
  const visits=users.length*8; // proxy
  const leadsCount=leads.length;
  const converted=leads.filter((l:any)=>l.convirtio).length;
  const convRate=leadsCount>0?((converted/leadsCount)*100):0;

  // Churn / trial expiring
  const expiring=pros.filter(u=>u.trial_end&&(new Date(u.trial_end).getTime()-now.getTime())/(86400000)<=7&&(new Date(u.trial_end).getTime()-now.getTime())/(86400000)>0);
  const expired=pros.filter(u=>u.plan==="gratis"&&u.trial_end&&new Date(u.trial_end)<now);
  const sinFoto=pros.filter(u=>u.plan!=="gratis"&&!u.avatar_url);
  const sinCobro=pros.filter(u=>u.plan==="gratis"&&!(u as any).stripe_customer_id);

  // Filtered ops table
  const opsUsers=users.filter(u=>{
    if(filterOps!=="all"&&u.type!==filterOps)return false;
    if(filterPlan!=="all"&&u.plan!==filterPlan)return false;
    if(searchOps){const s=searchOps.toLowerCase();return u.name.toLowerCase().includes(s)||u.email.toLowerCase().includes(s)||(u.trade||"").toLowerCase().includes(s);}
    return true;
  });

  const sendSupport=async()=>{
    if(!selectedUser||!supportMsg.trim())return;
    setSendingMsg(true);
    await db.from("messages").insert({from_id:"00000000-0000-0000-0000-000000000002",to_id:selectedUser.id,text:"[Soporte OfficioYa] "+supportMsg,read:false});
    await fetch("https://rjwojxwrsbvwwshwwpvq.supabase.co/functions/v1/send-push",{
      method:"POST",
      headers:{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MTcxMzgsImV4cCI6MjA5Mzk5MzEzOH0.tO2eE-d7diaqV5nS0NUIAJnyn69xnpHYSJZa4DGQWfE","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqd29qeHdyc2J2d3dzaHd3cHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MTcxMzgsImV4cCI6MjA5Mzk5MzEzOH0.tO2eE-d7diaqV5nS0NUIAJnyn69xnpHYSJZa4DGQWfE"},
      body:JSON.stringify({user_id:selectedUser.id,title:"👑 OfficioYa Soporte",body:supportMsg.substring(0,80),url:"/"}),
    }).catch(()=>{});
    setSupportMsg("");setSendingMsg(false);
    showToast("✓ Mensaje enviado a "+selectedUser.name);
  };

  const verifyUser=async(id:string)=>{
    await db.from("users").update({verified:true}).eq("id",id);
    setUsers(prev=>prev.map(u=>u.id===id?{...u,verified:true}:u));
    showToast("✓ Profesional verificado");
  };

  const blockUser=async(id:string)=>{
    await db.from("users").update({available:false}).eq("id",id);
    setUsers(prev=>prev.map(u=>u.id===id?{...u,available:false}:u));
    showToast("Usuario bloqueado","err");
  };

  const approveReview=async(id:string)=>{
    await db.from("reviews").update({approved:true}).eq("id",id);
    setReviews(p=>p.map((r:any)=>r.id===id?{...r,approved:true}:r));
    showToast("✓ Reseña aprobada — visible en la app");
  };
  const rejectReview=async(id:string)=>{
    // Rechazar = approved:false — desaparece del perfil del pro
    await db.from("reviews").update({approved:false}).eq("id",id);
    setReviews(p=>p.filter((r:any)=>r.id!==id));
    showToast("Reseña rechazada — eliminada de la app","err");
  };
  const deleteReview=async(id:string)=>{
    await db.from("reviews").delete().eq("id",id);
    setReviews(p=>p.filter((r:any)=>r.id!==id));
    showToast("Reseña eliminada permanentemente","err");
  };
  const updateReportStatus=async(id:string,status:"pending"|"investigating"|"approved")=>{
    await db.from("reports").update({status}).eq("id",id);
    setReports(p=>p.map((r:any)=>r.id===id?{...r,status}:r));
    if(status==="approved"){
      // Buscar el pro afectado y bloquearlo
      const rep=reports.find((r:any)=>r.id===id);
      if(rep?.worker_id){
        await db.from("users").update({available:false}).eq("id",rep.worker_id);
        setUsers(prev=>prev.map(u=>u.id===rep.worker_id?{...u,available:false}:u));
        showToast("🚫 Reporte aprobado — profesional bloqueado","err");
      } else {
        showToast("✓ Reporte aprobado");
      }
    } else if(status==="investigating"){
      showToast("🔍 Marcado como en investigación");
    }
  };

  // ────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────
  return(
    <div style={{minHeight:"100dvh",background:C.bg,color:C.text,fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
        .win-content{animation:fadeIn 0.2s ease;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:${C.border};border-radius:99px;}
      `}</style>

      {/* ── TOPBAR ── */}
      <header style={{background:C.surface,borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:200,flexShrink:0}}>
        <div style={{maxWidth:1400,margin:"0 auto",padding:"0 20px",height:52,display:"flex",alignItems:"center",gap:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginRight:"auto"}}>
            <div style={{width:30,height:30,borderRadius:8,background:`linear-gradient(135deg,${C.accent},${C.orange})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>⚙</div>
            <div>
              <span style={{fontWeight:900,fontSize:14,letterSpacing:"-0.5px"}}><span style={{color:C.text}}>Oficio</span><span style={{color:C.accent}}>Ya</span></span>
              <span style={{fontSize:9,color:C.muted,marginLeft:6,fontFamily:"monospace",letterSpacing:"0.1em"}}>CEO PANEL</span>
            </div>
          </div>

          {/* Nav windows */}
          {([
            ["strategy","🎯","Estrategia"],
            ["ops","⚙","Operaciones"],
            ["marketing","📈","Marketing"],
            ["finance","💰","Finanzas"],
            ["mensajes","💬","Mensajes"],
          ] as const).map(([id,icon,label])=>(
            <button key={id} onClick={()=>setWin(id)} style={{
              display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:8,
              background:win===id?C.accent+"18":"transparent",
              border:`1px solid ${win===id?C.accent+"44":C.border}`,
              color:win===id?C.accent:C.muted,
              cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:win===id?700:400,
              position:"relative",transition:"all 0.15s",
            }}>
              <span style={{fontSize:13}}>{icon}</span>
              <span style={{display:"none" as any}}>{label}</span>
              {id==="mensajes"&&unread>0&&win!=="mensajes"&&(
                <span style={{position:"absolute",top:-4,right:-4,background:C.red,color:"#fff",borderRadius:99,minWidth:14,height:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900,border:`1px solid ${C.bg}`}}>
                  {unread>9?"9+":unread}
                </span>
              )}
            </button>
          ))}

          <div style={{display:"flex",gap:8,alignItems:"center",marginLeft:"auto"}}>
            <div style={{fontFamily:"monospace",fontSize:11,color:C.green,background:C.greenDim,padding:"3px 10px",borderRadius:4,border:`1px solid ${C.green}33`}}>
              MRR {mrr.toFixed(0)}€
            </div>
            <button onClick={()=>setRefreshKey(k=>k+1)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,cursor:"pointer",padding:"5px 10px",fontSize:11,fontFamily:"monospace"}}>↻</button>
            <button onClick={onLogout} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,cursor:"pointer",padding:"5px 10px",fontSize:11}}>Salir</button>
          </div>
        </div>

        {/* Window labels below nav */}
        <div style={{maxWidth:1400,margin:"0 auto",padding:"0 20px",paddingBottom:8}}>
          {([
            ["strategy","🎯 Semáforos de Salud · Análisis Causa-Efecto · KPIs Clave"],
            ["ops","⚙ Gestión de Profesionales · Leads · Alertas de Calidad"],
            ["marketing","📈 Funnel Completo · Conversión · Registros · Tendencias"],
            ["finance","💰 MRR · Suscripciones · Stripe · Proyección"],
            ["mensajes","💬 Conversaciones · Soporte · Mensajes No Leídos"],
          ] as const).find(([id])=>id===win)?.[1] &&
            <span style={{fontSize:10,color:C.muted,fontFamily:"monospace"}}>
              {([
                ["strategy","🎯 Semáforos de Salud · Análisis Causa-Efecto · KPIs Clave"],
                ["ops","⚙ Gestión de Profesionales · Leads · Alertas de Calidad"],
                ["marketing","📈 Funnel Completo · Conversión · Registros · Tendencias"],
                ["finance","💰 MRR · Suscripciones · Stripe · Proyección"],
                ["mensajes","💬 Conversaciones · Soporte · Mensajes No Leídos"],
              ] as const).find(([id])=>id===win)?.[1]}
            </span>
          }
        </div>
      </header>

      {/* ── TOAST ── */}
      {toast&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:toast.type==="ok"?`linear-gradient(135deg,${C.green}22,${C.green}11)`:`linear-gradient(135deg,${C.red}22,${C.red}11)`,border:`1px solid ${toast.type==="ok"?C.green:C.red}44`,borderRadius:10,padding:"10px 20px",color:toast.type==="ok"?C.green:C.red,fontWeight:700,fontSize:13,zIndex:9999,whiteSpace:"nowrap",boxShadow:`0 4px 20px ${toast.type==="ok"?C.green:C.red}22`}}>
          {toast.msg}
        </div>
      )}

      {/* ── SIDE PANEL ── */}
      {selectedUser&&(
        <div style={{position:"fixed",top:0,right:0,width:300,height:"100dvh",background:C.surface,borderLeft:`1px solid ${C.border}`,zIndex:300,overflowY:"auto",padding:20,boxShadow:"-10px 0 40px rgba(0,0,0,0.5)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <span style={{fontWeight:800,fontSize:14,color:C.accent}}>USUARIO</span>
            <button onClick={()=>setSelectedUser(null)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18}}>✕</button>
          </div>
          <div style={{textAlign:"center",marginBottom:16}}>
            <Ava s={selectedUser.name.substring(0,2).toUpperCase()} size={52} color={selectedUser.type==="profesional"?C.accent:C.blue} imgUrl={selectedUser.avatar_url||""} />
            <p style={{fontWeight:800,color:C.text,fontSize:16,marginTop:10}}>{selectedUser.name}</p>
            <p style={{fontSize:11,color:C.muted}}>{selectedUser.email}</p>
            {selectedUser.phone&&<a href={"tel:"+selectedUser.phone} style={{fontSize:12,color:C.green,textDecoration:"none",display:"block",marginTop:4}}>📞 {selectedUser.phone}</a>}
            {selectedUser.whatsapp&&<a href={"https://wa.me/"+selectedUser.whatsapp.replace(/\D/g,"")} target="_blank" rel="noreferrer" style={{fontSize:12,color:"#25D366",textDecoration:"none",display:"block",marginTop:2}}>💬 WhatsApp</a>}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:16,background:C.card,borderRadius:10,padding:12}}>
            {[
              {l:"Tipo",v:selectedUser.type.toUpperCase()},
              {l:"Plan",v:<Badge plan={selectedUser.plan as Plan}/>},
              {l:"Oficio",v:selectedUser.trade||"—"},
              {l:"Zona",v:selectedUser.zone||"—"},
              {l:"Rating",v:selectedUser.rating>0?selectedUser.rating.toFixed(1)+"★":"—"},
              {l:"Trabajos",v:String(selectedUser.jobs||0)},
              {l:"Registro",v:new Date(selectedUser.joined_at).toLocaleDateString("es-ES",{day:"2-digit",month:"short",year:"2-digit"})},
            ].map(r=>(
              <div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:11,color:C.muted}}>{r.l}</span>
                <span style={{fontSize:11,color:C.text,fontWeight:600}}>{r.v as any}</span>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            <button onClick={()=>verifyUser(selectedUser.id)} style={{flex:1,padding:"9px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:8,color:C.green,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:700,cursor:"pointer"}}>✓ Verificar</button>
            <button onClick={()=>blockUser(selectedUser.id)} style={{flex:1,padding:"9px",background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:8,color:C.red,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:700,cursor:"pointer"}}>✗ Bloquear</button>
          </div>
          <div>
            <p style={{fontSize:10,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em",marginBottom:6}}>ENVIAR MENSAJE</p>
            <textarea value={supportMsg} onChange={e=>setSupportMsg(e.target.value)} placeholder="Mensaje de soporte..." rows={3} style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:12,padding:"8px 10px",resize:"none",outline:"none",marginBottom:8,boxSizing:"border-box"}} />
            <button disabled={sendingMsg||!supportMsg.trim()} onClick={sendSupport} style={{width:"100%",padding:"9px",background:sendingMsg||!supportMsg.trim()?"transparent":`linear-gradient(135deg,${C.accent},${C.orange})`,border:`1px solid ${C.accent}44`,borderRadius:8,color:sendingMsg||!supportMsg.trim()?C.muted:"#000",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:12,cursor:sendingMsg||!supportMsg.trim()?"not-allowed":"pointer"}}>
              {sendingMsg?"Enviando...":"Enviar →"}
            </button>
            <div style={{marginTop:14,maxHeight:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
              {msgs.filter(m=>(m.from_id===selectedUser.id&&m.to_id==="00000000-0000-0000-0000-000000000002")||(m.from_id==="00000000-0000-0000-0000-000000000002"&&m.to_id===selectedUser.id))
                .sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime())
                .map(m=>{
                  const isAdmin=m.from_id==="00000000-0000-0000-0000-000000000002";
                  return(
                    <div key={m.id} style={{display:"flex",justifyContent:isAdmin?"flex-end":"flex-start"}}>
                      <div style={{maxWidth:"85%",padding:"7px 10px",borderRadius:isAdmin?"10px 10px 2px 10px":"10px 10px 10px 2px",background:isAdmin?`linear-gradient(135deg,${C.accent},${C.orange})`:`${C.card}`,border:isAdmin?"none":`1px solid ${C.border}`,color:isAdmin?"#000":C.text}}>
                        <p style={{fontSize:11,margin:0,lineHeight:1.4}}>{m.text.replace("[Soporte OfficioYa] ","")}</p>
                        <p style={{fontSize:8,margin:"3px 0 0",opacity:0.5,textAlign:"right"}}>{formatTime(m.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main style={{flex:1,maxWidth:selectedUser?1100:1400,margin:"0 auto",width:"100%",padding:"20px",overflowX:"hidden"}}>
        {loading&&<div style={{display:"flex",justifyContent:"center",padding:60}}><Spin size={32}/></div>}
        {!loading&&(
          <div className="win-content">

            {/* ══════════════════════════════════
                VENTANA 1: ESTRATEGIA CEO
                ══════════════════════════════════ */}
            {win==="strategy"&&(<>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
                <TrafficLight value={mrr} target={mrrTarget} label="MRR Mensual" format="euro"/>
                <TrafficLight value={convRate} target={25} label="Conversión Landing" format="percent"/>
                <TrafficLight value={paying.length} target={50} label="Pros Pagando" />
                <TrafficLight value={clients.length} target={200} label="Clientes Activos" />
              </div>

              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:14,marginBottom:20}}>
                {/* Tendencia */}
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                    <div>
                      <p style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:2}}>Tendencia de Registros</p>
                      <p style={{fontSize:11,color:C.muted,fontFamily:"monospace"}}>{totalNewPeriod} nuevos en {period} días</p>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      {([7,14,30] as const).map(d=>(
                        <button key={d} onClick={()=>setPeriod(d)} style={{padding:"3px 8px",borderRadius:4,border:`1px solid ${period===d?C.accent:C.border}`,background:period===d?C.accent+"18":"transparent",color:period===d?C.accent:C.muted,cursor:"pointer",fontSize:10,fontFamily:"monospace"}}>{d}d</button>
                      ))}
                    </div>
                  </div>
                  <Sparkline data={weekData} color={C.accent} height={60}/>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                    <span style={{fontSize:9,color:C.muted,fontFamily:"monospace"}}>hace {period} días</span>
                    <span style={{fontSize:9,color:C.muted,fontFamily:"monospace"}}>hoy</span>
                  </div>
                </div>

                {/* Causa-Efecto */}
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
                  <p style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:14}}>🔬 Análisis Causa-Efecto</p>
                  {[
                    {label:"Problema de demanda",desc:"Pocos leads de clientes",value:clients.length<50,color:clients.length<50?C.red:C.green},
                    {label:"Problema de oferta",desc:"Pocos pros disponibles",value:pros.filter(u=>u.available).length<20,color:pros.filter(u=>u.available).length<20?C.red:C.green},
                    {label:"Riesgo de churn",desc:expiring.length+" pros con trial expirando",value:expiring.length>0,color:expiring.length>3?C.red:expiring.length>0?C.yellow:C.green},
                    {label:"Perfiles incompletos",desc:sinFoto.length+" sin foto",value:sinFoto.length>0,color:sinFoto.length>5?C.yellow:C.green},
                  ].map(item=>(
                    <div key={item.label} style={{display:"flex",gap:8,alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:item.color,flexShrink:0}} />
                      <div style={{flex:1}}>
                        <p style={{fontSize:12,color:item.value?item.color:C.mutedL,fontWeight:item.value?700:400}}>{item.label}</p>
                        <p style={{fontSize:10,color:C.muted}}>{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alertas críticas */}
              {(sinCobro.length>0||expiring.length>0||sinFoto.length>0)&&(
                <div style={{background:`linear-gradient(135deg,${C.redDim},${C.yellowDim})`,border:`1px solid ${C.red}33`,borderRadius:12,padding:16,marginBottom:20}}>
                  <p style={{fontWeight:800,fontSize:12,color:C.red,marginBottom:10,fontFamily:"monospace",letterSpacing:"0.08em"}}>🚨 ACCIONES INMEDIATAS</p>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                    {sinCobro.length>0&&(
                      <div style={{background:C.card,borderRadius:8,padding:12,border:`1px solid ${C.red}44`}}>
                        <p style={{fontSize:22,fontWeight:900,color:C.red}}>{sinCobro.length}</p>
                        <p style={{fontSize:11,color:C.mutedL}}>pros sin tarjeta</p>
                        <button onClick={()=>{setWin("ops");setFilterOps("pro");}} style={{marginTop:8,fontSize:10,color:C.red,background:"none",border:`1px solid ${C.red}33`,borderRadius:4,padding:"3px 8px",cursor:"pointer",fontFamily:"monospace"}}>Llamar hoy →</button>
                      </div>
                    )}
                    {expiring.length>0&&(
                      <div style={{background:C.card,borderRadius:8,padding:12,border:`1px solid ${C.yellow}44`}}>
                        <p style={{fontSize:22,fontWeight:900,color:C.yellow}}>{expiring.length}</p>
                        <p style={{fontSize:11,color:C.mutedL}}>trial expira en 7d</p>
                        <button onClick={()=>setWin("ops")} style={{marginTop:8,fontSize:10,color:C.yellow,background:"none",border:`1px solid ${C.yellow}33`,borderRadius:4,padding:"3px 8px",cursor:"pointer",fontFamily:"monospace"}}>Retener →</button>
                      </div>
                    )}
                    {sinFoto.length>0&&(
                      <div style={{background:C.card,borderRadius:8,padding:12,border:`1px solid ${C.orange}44`}}>
                        <p style={{fontSize:22,fontWeight:900,color:C.orange}}>{sinFoto.length}</p>
                        <p style={{fontSize:11,color:C.mutedL}}>sin foto ni bio</p>
                        <button onClick={()=>setWin("ops")} style={{marginTop:8,fontSize:10,color:C.orange,background:"none",border:`1px solid ${C.orange}33`,borderRadius:4,padding:"3px 8px",cursor:"pointer",fontFamily:"monospace"}}>Ayudar →</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* KPI grid */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
                {[
                  {l:"Total usuarios",v:fmt(users.length),c:C.blue},
                  {l:"Profesionales",v:fmt(pros.length),c:C.accent},
                  {l:"Clientes",v:fmt(clients.length),c:C.green},
                  {l:"Disponibles",v:fmt(pros.filter(u=>u.available).length),c:C.cyan},
                  {l:"Verificados",v:fmt(pros.filter(u=>u.verified).length),c:C.gold},
                  {l:"Expirados",v:fmt(expired.length),c:C.red},
                  {l:"Trabajos",v:fmt(jobs.length),c:C.orange},
                  {l:"Reseñas",v:fmt(reviews.length),c:C.blue},
                ].map(s=>(
                  <div key={s.l} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 14px"}}>
                    <p style={{fontWeight:900,fontSize:22,color:s.c,letterSpacing:"-1px"}}>{s.v}</p>
                    <p style={{fontSize:10,color:C.muted,fontFamily:"monospace"}}>{s.l}</p>
                  </div>
                ))}
              </div>
            </>)}

            {/* ══════════════════════════════════
                VENTANA 2: OPERACIONES
                ══════════════════════════════════ */}
            {win==="ops"&&(<>
              {/* Filtros */}
              <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
                <input value={searchOps} onChange={e=>setSearchOps(e.target.value)} placeholder="🔍 Buscar nombre, email, oficio..." style={{flex:1,minWidth:200,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",color:C.text,fontFamily:"inherit",fontSize:12,outline:"none"}} />
                <div style={{display:"flex",gap:6}}>
                  {([["all","Todos"],["pro","Profesionales"],["cliente","Clientes"]] as const).map(([v,l])=>(
                    <button key={v} onClick={()=>setFilterOps(v)} style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${filterOps===v?C.accent:C.border}`,background:filterOps===v?C.accent+"18":"transparent",color:filterOps===v?C.accent:C.muted,cursor:"pointer",fontSize:11,fontFamily:"monospace"}}>{l}</button>
                  ))}
                </div>
                <div style={{display:"flex",gap:6}}>
                  {(["all","gratis","basico","pro","elite"] as const).map(v=>(
                    <button key={v} onClick={()=>setFilterPlan(v)} style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${filterPlan===v?C.gold:C.border}`,background:filterPlan===v?C.gold+"18":"transparent",color:filterPlan===v?C.gold:C.muted,cursor:"pointer",fontSize:10,fontFamily:"monospace"}}>{v==="all"?"ALL":v.toUpperCase()}</button>
                  ))}
                </div>
                <span style={{fontSize:11,color:C.muted,fontFamily:"monospace"}}>{opsUsers.length} resultados</span>
              </div>

              {/* Tabla */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",marginBottom:20}}>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{borderBottom:`1px solid ${C.border}`}}>
                        {["Usuario","Tipo","Plan","Oficio/Zona","Estado","Trial","Acciones"].map(h=>(
                          <th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:9,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:600,whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {opsUsers.slice(0,50).map(u=>{
                        const daysLeft=u.trial_end?Math.max(0,Math.ceil((new Date(u.trial_end).getTime()-now.getTime())/86400000)):null;
                        const isExpiring=daysLeft!==null&&daysLeft<=7&&daysLeft>0;
                        const isExpired=daysLeft!==null&&daysLeft<=0&&u.plan==="gratis";
                        return(
                          <tr key={u.id} style={{borderBottom:`1px solid ${C.border}`,transition:"background 0.1s"}} onMouseEnter={e=>(e.currentTarget.style.background=C.surface)} onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                            <td style={{padding:"10px 14px"}}>
                              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                                <Ava s={u.name.substring(0,2).toUpperCase()} size={28} color={u.type==="profesional"?C.accent:C.blue} imgUrl={u.avatar_url||""} />
                                <div>
                                  <p style={{fontSize:12,fontWeight:700,color:C.text,whiteSpace:"nowrap"}}>{u.name}</p>
                                  <p style={{fontSize:10,color:C.muted}}>{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td style={{padding:"10px 14px"}}>
                              <span style={{fontSize:9,fontFamily:"monospace",color:u.type==="profesional"?C.accent:C.blue,background:(u.type==="profesional"?C.accent:C.blue)+"18",padding:"2px 7px",borderRadius:3,fontWeight:700}}>{u.type==="profesional"?"PRO":"CLI"}</span>
                            </td>
                            <td style={{padding:"10px 14px"}}><Badge plan={u.plan as Plan}/></td>
                            <td style={{padding:"10px 14px"}}>
                              <p style={{fontSize:11,color:C.accent}}>{u.trade||"—"}</p>
                              <p style={{fontSize:10,color:C.muted}}>{u.zone||"—"}</p>
                            </td>
                            <td style={{padding:"10px 14px"}}>
                              {u.verified?<StatusPill label="Verificado" color={C.green}/>:u.available?<StatusPill label="Activo" color={C.blue}/>:<StatusPill label="Inactivo" color={C.muted}/>}
                            </td>
                            <td style={{padding:"10px 14px"}}>
                              {daysLeft!==null?(
                                <span style={{fontSize:10,fontFamily:"monospace",color:isExpired?C.red:isExpiring?C.yellow:C.muted}}>
                                  {isExpired?"⛔ Expirado":isExpiring?`⚠ ${daysLeft}d`:`${daysLeft}d`}
                                </span>
                              ):<span style={{color:C.muted,fontSize:10}}>—</span>}
                            </td>
                            <td style={{padding:"10px 14px"}}>
                              <div style={{display:"flex",gap:6}}>
                                <button onClick={()=>setSelectedUser(u)} style={{fontSize:10,padding:"4px 8px",background:C.accent+"18",border:`1px solid ${C.accent}44`,borderRadius:4,color:C.accent,cursor:"pointer",fontFamily:"monospace"}}>Ver</button>
                                {!u.verified&&<button onClick={()=>verifyUser(u.id)} style={{fontSize:10,padding:"4px 8px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:4,color:C.green,cursor:"pointer",fontFamily:"monospace"}}>✓</button>}
                                {u.phone&&<a href={"tel:"+u.phone} style={{fontSize:10,padding:"4px 8px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:4,color:C.green,textDecoration:"none",fontFamily:"monospace"}}>📞</a>}
                                {u.whatsapp&&<a href={"https://wa.me/"+u.whatsapp.replace(/\D/g,"")} target="_blank" rel="noreferrer" style={{fontSize:10,padding:"4px 8px",background:"#25D36618",border:"1px solid #25D36644",borderRadius:4,color:"#25D366",textDecoration:"none",fontFamily:"monospace"}}>WA</a>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Alertas de calidad */}
              <div style={{display:"flex",flexDirection:"column",gap:14}}>

                {/* REPORTES Y DENUNCIAS */}
                <div style={{background:C.card,border:`1px solid ${C.red}33`,borderRadius:12,padding:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <p style={{fontWeight:700,fontSize:13,color:C.text}}>🚩 Reportes y Denuncias</p>
                    <div style={{display:"flex",gap:6}}>
                      <StatusPill label={`${reports.filter((r:any)=>r.status==="pending"||!r.status).length} pendientes`} color={C.red}/>
                      <StatusPill label={`${reports.filter((r:any)=>r.status==="investigating").length} investigando`} color={C.yellow}/>
                      <StatusPill label={`${reports.filter((r:any)=>r.status==="approved").length} aprobados`} color={C.green}/>
                    </div>
                  </div>
                  {reports.length===0&&<p style={{fontSize:12,color:C.muted}}>Sin reportes todavía</p>}
                  {reports.map((r:any)=>{
                    const pro=users.find(u=>u.id===r.worker_id);
                    const from=users.find(u=>u.id===r.from_id);
                    const statusColor=r.status==="approved"?C.green:r.status==="investigating"?C.yellow:C.red;
                    return(
                      <div key={r.id} style={{background:C.surface,borderRadius:10,padding:"12px 14px",marginBottom:10,border:`1px solid ${statusColor}33`}}>
                        <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:4}}>
                              <span style={{fontSize:9,fontFamily:"monospace",color:r.type==="denuncia"?C.red:C.orange,background:(r.type==="denuncia"?C.red:C.orange)+"18",padding:"2px 7px",borderRadius:3,fontWeight:700,textTransform:"uppercase"}}>
                                {r.type||"reporte"}
                              </span>
                              <StatusPill label={r.status==="approved"?"✓ Aprobado":r.status==="investigating"?"🔍 Investigando":"⏳ Pendiente"} color={statusColor}/>
                              <span style={{fontSize:9,color:C.muted,fontFamily:"monospace",marginLeft:"auto"}}>{new Date(r.created_at).toLocaleDateString("es-ES")}</span>
                            </div>
                            <p style={{fontSize:12,color:C.mutedL,lineHeight:1.5,marginBottom:6}}>{r.message}</p>
                            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                              {from&&<span style={{fontSize:11,color:C.muted}}>👤 De: <span style={{color:C.text,fontWeight:600}}>{from.name||r.from_name}</span></span>}
                              {pro&&<button onClick={()=>setSelectedUser(pro)} style={{fontSize:11,color:C.accent,background:"none",border:`1px solid ${C.accent}33`,borderRadius:4,padding:"2px 8px",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
                                🔨 {pro.name||r.worker_name} → Ver perfil
                              </button>}
                              {!pro&&r.worker_name&&<span style={{fontSize:11,color:C.muted}}>🔨 Pro: <span style={{color:C.accent}}>{r.worker_name}</span></span>}
                            </div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:8"}}>
                          {(r.status==="pending"||!r.status)&&(
                            <button onClick={()=>updateReportStatus(r.id,"investigating")} style={{fontSize:11,padding:"5px 12px",background:C.yellowDim,border:`1px solid ${C.yellow}44`,borderRadius:6,color:C.yellow,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>
                              🔍 Investigar
                            </button>
                          )}
                          {r.status==="investigating"&&(
                            <button onClick={()=>updateReportStatus(r.id,"approved")} style={{fontSize:11,padding:"5px 12px",background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:6,color:C.red,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:700}}>
                              🚫 Aprobar y bloquear pro
                            </button>
                          )}
                          {r.status==="approved"&&pro&&(
                            <span style={{fontSize:11,color:C.red,fontFamily:"monospace"}}>✓ Pro bloqueado · {pro.name}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  {/* RESEÑAS */}
                  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                      <p style={{fontWeight:700,fontSize:13,color:C.text}}>⭐ Reseñas · Moderación</p>
                      <StatusPill label={`${reviews.filter((r:any)=>r.approved===null||r.approved===undefined).length} pendientes`} color={C.orange}/>
                    </div>
                    {reviews.filter((r:any)=>r.approved===null||r.approved===undefined).slice(0,8).map((r:any)=>{
                      const pro=users.find(u=>u.id===r.worker_id);
                      return(
                        <div key={r.id} style={{background:C.surface,borderRadius:8,padding:"10px 12px",marginBottom:8,border:`1px solid ${C.border}`}}>
                          <div style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:8}}>
                            <div style={{flex:1}}>
                              <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:3,flexWrap:"wrap"}}>
                                <span style={{fontSize:12,fontWeight:700,color:C.text}}>{r.client_name}</span>
                                <span style={{fontSize:10,color:C.muted}}>→</span>
                                {pro&&<button onClick={()=>setSelectedUser(pro)} style={{fontSize:11,color:C.accent,background:"none",border:`1px solid ${C.accent}33`,borderRadius:3,padding:"1px 6px",cursor:"pointer"}}>
                                  {pro.name}
                                </button>}
                                <span style={{fontSize:11,color:C.yellow}}>{"★".repeat(r.stars)}{"☆".repeat(5-r.stars)}</span>
                              </div>
                              <p style={{fontSize:11,color:C.mutedL,lineHeight:1.4}}>{r.text}</p>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:6}}>
                            <button onClick={()=>approveReview(r.id)} style={{flex:1,fontSize:11,padding:"5px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:6,color:C.green,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:700}}>
                              ✓ Aprobar (visible)
                            </button>
                            <button onClick={()=>rejectReview(r.id)} style={{flex:1,fontSize:11,padding:"5px",background:C.yellowDim,border:`1px solid ${C.yellow}44`,borderRadius:6,color:C.yellow,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:700}}>
                              ✗ Rechazar (ocultar)
                            </button>
                            <button onClick={()=>deleteReview(r.id)} style={{fontSize:11,padding:"5px 8px",background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:6,color:C.red,cursor:"pointer"}}>
                              🗑
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {reviews.filter((r:any)=>r.approved===null||r.approved===undefined).length===0&&<p style={{fontSize:12,color:C.muted}}>Sin reseñas pendientes ✓</p>}
                  </div>

                  {/* PROS EN RIESGO */}
                  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
                    <p style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:12}}>🔔 Pros con riesgo de cancelación</p>
                    {expiring.slice(0,5).map(u=>(
                      <div key={u.id} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                        <Ava s={u.name.substring(0,2).toUpperCase()} size={28} color={C.yellow} imgUrl={u.avatar_url||""}/>
                        <div style={{flex:1}}>
                          <p style={{fontSize:12,color:C.text,fontWeight:600}}>{u.name}</p>
                          <p style={{fontSize:10,color:C.yellow}}>Trial expira en {Math.ceil((new Date(u.trial_end).getTime()-now.getTime())/86400000)}d</p>
                        </div>
                        <div style={{display:"flex",gap:5}}>
                          {u.phone&&<a href={"tel:"+u.phone} style={{fontSize:10,padding:"4px 8px",background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:4,color:C.green,textDecoration:"none"}}>📞</a>}
                          <button onClick={()=>setSelectedUser(u)} style={{fontSize:10,padding:"4px 8px",background:C.accentDim,border:`1px solid ${C.accent}44`,borderRadius:4,color:C.accent,cursor:"pointer"}}>Ver</button>
                        </div>
                      </div>
                    ))}
                    {expiring.length===0&&<p style={{fontSize:12,color:C.muted}}>Sin pros en riesgo esta semana ✓</p>}
                  </div>
                </div>
              </div>
            </>)}

            {/* ══════════════════════════════════
                VENTANA 3: MARKETING
                ══════════════════════════════════ */}
            {win==="marketing"&&(<>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
                {/* Funnel */}
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
                  <p style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:16}}>📊 Funnel de Conversión</p>
                  <FunnelBar label="Visitas estimadas" value={visits} total={visits} color={C.blue}/>
                  <FunnelBar label="Registros totales" value={users.length} total={visits} color={C.accent}/>
                  <FunnelBar label="Leads landing" value={leadsCount} total={visits} color={C.orange}/>
                  <FunnelBar label="Convirtieron a pago" value={paying.length} total={users.length} color={C.green}/>
                  <div style={{marginTop:16,padding:"10px 14px",background:C.greenDim,borderRadius:8,border:`1px solid ${C.green}33`}}>
                    <span style={{fontSize:11,color:C.green,fontWeight:700,fontFamily:"monospace"}}>
                      Conversión global: {users.length>0?((paying.length/users.length)*100).toFixed(1):0}%
                    </span>
                  </div>
                </div>

                {/* Tendencia por tipo */}
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
                  <p style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:16}}>📈 Altas vs Bajas</p>
                  <div style={{marginBottom:16}}>
                    <p style={{fontSize:11,color:C.muted,marginBottom:8,fontFamily:"monospace"}}>PROFESIONALES {period}d</p>
                    <Sparkline data={dailyRegs(period).map((_,i)=>pros.filter(u=>Math.floor((now.getTime()-new Date(u.joined_at).getTime())/86400000)===period-1-i).length)} color={C.accent} height={40}/>
                  </div>
                  <div>
                    <p style={{fontSize:11,color:C.muted,marginBottom:8,fontFamily:"monospace"}}>CLIENTES {period}d</p>
                    <Sparkline data={dailyRegs(period).map((_,i)=>clients.filter(u=>Math.floor((now.getTime()-new Date(u.joined_at).getTime())/86400000)===period-1-i).length)} color={C.green} height={40}/>
                  </div>
                  <div style={{display:"flex",gap:12,marginTop:10}}>
                    <span style={{fontSize:10,color:C.accent,fontFamily:"monospace"}}>■ Pros ({pros.length})</span>
                    <span style={{fontSize:10,color:C.green,fontFamily:"monospace"}}>■ Clientes ({clients.length})</span>
                  </div>
                </div>
              </div>

              {/* Leads landing */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20,marginBottom:20}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <p style={{fontWeight:700,fontSize:14,color:C.text}}>🎯 Leads Landing Elite</p>
                  <div style={{display:"flex",gap:10}}>
                    <StatusPill label={`${converted} convirtieron`} color={C.green}/>
                    <StatusPill label={`${leadsCount-converted} abandonaron`} color={C.orange}/>
                  </div>
                </div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{borderBottom:`1px solid ${C.border}`}}>
                        {["Nombre","Oficio","Email","Teléfono","Estado","Fecha"].map(h=>(
                          <th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:9,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {leads.slice(0,20).map((l:any)=>(
                        <tr key={l.id} style={{borderBottom:`1px solid ${C.border}`}}>
                          <td style={{padding:"8px 12px",fontSize:12,color:C.text,fontWeight:600}}>{l.nombre}</td>
                          <td style={{padding:"8px 12px"}}><span style={{fontSize:10,color:C.accent,fontFamily:"monospace"}}>{l.oficio}</span></td>
                          <td style={{padding:"8px 12px",fontSize:11,color:C.muted}}>{l.email}</td>
                          <td style={{padding:"8px 12px"}}>{l.telefono&&<a href={"tel:"+l.telefono} style={{fontSize:11,color:C.green,textDecoration:"none"}}>📞 {l.telefono}</a>}</td>
                          <td style={{padding:"8px 12px"}}><StatusPill label={l.convirtio?"Convirtió":"Abandonó"} color={l.convirtio?C.green:C.orange}/></td>
                          <td style={{padding:"8px 12px",fontSize:10,color:C.muted,fontFamily:"monospace"}}>{new Date(l.created_at).toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit",year:"2-digit"})}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* KPIs ads */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                {[
                  {l:"CPL estimado",v:leadsCount>0?"~"+(300/leadsCount).toFixed(2)+"€":"—",c:C.accent},
                  {l:"CPA (pago)",v:paying.length>0?"~"+(300/paying.length).toFixed(2)+"€":"—",c:C.green},
                  {l:"Leads/día",v:(leadsCount/30).toFixed(1),c:C.blue},
                  {l:"Tasa conversión",v:convRate.toFixed(1)+"%",c:C.orange},
                ].map(s=>(
                  <div key={s.l} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px"}}>
                    <p style={{fontWeight:900,fontSize:20,color:s.c,letterSpacing:"-1px"}}>{s.v}</p>
                    <p style={{fontSize:10,color:C.muted,fontFamily:"monospace"}}>{s.l}</p>
                  </div>
                ))}
              </div>
            </>)}

            {/* ══════════════════════════════════
                VENTANA 4: FINANZAS
                ══════════════════════════════════ */}
            {win==="finance"&&(<>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
                <div style={{background:C.card,border:`1px solid ${C.green}33`,borderRadius:12,padding:20,gridColumn:"span 1"}}>
                  <p style={{fontSize:10,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em",marginBottom:8}}>MRR ACTUAL</p>
                  <p style={{fontWeight:900,fontSize:40,color:C.green,letterSpacing:"-2px",lineHeight:1}}>{mrr.toFixed(0)}€</p>
                  <p style={{fontSize:11,color:C.muted,marginTop:4}}>de {mrrTarget}€ objetivo · {((mrr/mrrTarget)*100).toFixed(0)}%</p>
                  <div style={{height:4,background:C.border,borderRadius:99,overflow:"hidden",marginTop:10}}>
                    <div style={{height:"100%",width:Math.min(100,(mrr/mrrTarget)*100)+"%",background:`linear-gradient(90deg,${C.green},${C.accent})`,borderRadius:99}} />
                  </div>
                </div>
                <div style={{background:C.card,border:`1px solid ${C.accent}33`,borderRadius:12,padding:20}}>
                  <p style={{fontSize:10,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em",marginBottom:8}}>PROYECCIÓN 3M</p>
                  <p style={{fontWeight:900,fontSize:40,color:C.accent,letterSpacing:"-2px",lineHeight:1}}>{(mrr*3).toFixed(0)}€</p>
                  <p style={{fontSize:11,color:C.muted,marginTop:4}}>asumiendo misma base</p>
                </div>
                <div style={{background:C.card,border:`1px solid ${C.blue}33`,borderRadius:12,padding:20}}>
                  <p style={{fontSize:10,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em",marginBottom:8}}>ARPU</p>
                  <p style={{fontWeight:900,fontSize:40,color:C.blue,letterSpacing:"-2px",lineHeight:1}}>{paying.length>0?(mrr/paying.length).toFixed(2):"0"}€</p>
                  <p style={{fontSize:11,color:C.muted,marginTop:4}}>ingreso medio por pro</p>
                </div>
              </div>

              {/* Desglose por plan */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20,marginBottom:20}}>
                <p style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:16}}>💳 Desglose por Plan</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                  {(["gratis","basico","pro","elite"] as Plan[]).map(pl=>{
                    const count=pros.filter(u=>u.plan===pl).length;
                    const revenue=count*PLAN_PRICES[pl];
                    const col=PLAN_COLORS[pl];
                    return(
                      <div key={pl} style={{background:C.surface,border:`1px solid ${col}33`,borderRadius:10,padding:"14px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                          <Badge plan={pl}/>
                          <span style={{fontSize:9,color:C.muted,fontFamily:"monospace"}}>{PLAN_PRICES[pl]}€/m</span>
                        </div>
                        <p style={{fontWeight:900,fontSize:24,color:col,letterSpacing:"-1px"}}>{count}</p>
                        <p style={{fontSize:10,color:C.muted}}>pros · <span style={{color:col,fontWeight:700}}>{revenue.toFixed(0)}€/m</span></p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Estado Stripe */}
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
                <p style={{fontWeight:700,fontSize:14,color:C.text,marginBottom:16}}>🔌 Estado Stripe / Suscripciones</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
                  <div style={{background:C.surface,borderRadius:10,padding:14,border:`1px solid ${C.green}22`}}>
                    <p style={{fontSize:10,color:C.muted,fontFamily:"monospace",marginBottom:4}}>PAGANDO ACTIVO</p>
                    <p style={{fontWeight:900,fontSize:28,color:C.green}}>{paying.length}</p>
                  </div>
                  <div style={{background:C.surface,borderRadius:10,padding:14,border:`1px solid ${C.yellow}22`}}>
                    <p style={{fontSize:10,color:C.muted,fontFamily:"monospace",marginBottom:4}}>EN TRIAL</p>
                    <p style={{fontWeight:900,fontSize:28,color:C.yellow}}>{pros.filter(u=>u.plan==="gratis"&&u.trial_end&&new Date(u.trial_end)>now).length}</p>
                  </div>
                  <div style={{background:C.surface,borderRadius:10,padding:14,border:`1px solid ${C.red}22`}}>
                    <p style={{fontSize:10,color:C.muted,fontFamily:"monospace",marginBottom:4}}>EXPIRADOS</p>
                    <p style={{fontWeight:900,fontSize:28,color:C.red}}>{expired.length}</p>
                  </div>
                </div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{borderBottom:`1px solid ${C.border}`}}>
                        {["Pro","Plan","€/mes","Trial expira","Estado"].map(h=>(
                          <th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:9,color:C.muted,fontFamily:"monospace",letterSpacing:"0.1em"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paying.map(u=>{
                        const daysLeft=u.trial_end?Math.max(0,Math.ceil((new Date(u.trial_end).getTime()-now.getTime())/86400000)):null;
                        return(
                          <tr key={u.id} style={{borderBottom:`1px solid ${C.border}`}}>
                            <td style={{padding:"8px 12px"}}>
                              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                                <Ava s={u.name.substring(0,2).toUpperCase()} size={24} color={PLAN_COLORS[u.plan as Plan]} imgUrl={u.avatar_url||""}/>
                                <span style={{fontSize:12,color:C.text,fontWeight:600}}>{u.name}</span>
                              </div>
                            </td>
                            <td style={{padding:"8px 12px"}}><Badge plan={u.plan as Plan}/></td>
                            <td style={{padding:"8px 12px",fontSize:12,color:C.green,fontFamily:"monospace",fontWeight:700}}>{PLAN_PRICES[u.plan as Plan]}€</td>
                            <td style={{padding:"8px 12px",fontSize:11,color:daysLeft!==null&&daysLeft<=7?C.yellow:C.muted,fontFamily:"monospace"}}>{daysLeft!==null?daysLeft+"d":"—"}</td>
                            <td style={{padding:"8px 12px"}}><StatusPill label="Activo" color={C.green}/></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>)}

            {/* ══════════════════════════════════
                VENTANA 5: MENSAJES
                ══════════════════════════════════ */}
            {win==="mensajes"&&(<>
              <div style={{display:"grid",gridTemplateColumns:selectedUser?"1fr":"2fr 1fr",gap:14}}>
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                  <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <p style={{fontWeight:700,fontSize:14,color:C.text}}>Mensajes · {msgs.length}</p>
                    <span style={{fontSize:10,color:C.red,fontFamily:"monospace"}}>{unread} no leídos</span>
                  </div>
                  <div style={{maxHeight:600,overflowY:"auto"}}>
                    {msgs.filter(m=>m.from_id!=="00000000-0000-0000-0000-000000000001").slice(0,50).map(m=>{
                      const fromUser=users.find(u=>u.id===m.from_id);
                      const toUser=users.find(u=>u.id===m.to_id);
                      const isAdminMsg=m.from_id==="00000000-0000-0000-0000-000000000002";
                      const isUnread=!m.read&&!isAdminMsg;
                      return(
                        <div key={m.id} onClick={()=>setSelectedUser(fromUser||toUser||null)} style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,background:isUnread?C.yellowDim:"transparent",cursor:"pointer",transition:"background 0.1s"}} onMouseEnter={e=>{if(!isUnread)(e.currentTarget as HTMLElement).style.background=C.surface;}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=isUnread?C.yellowDim:"transparent";}}>
                          <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                            <div style={{width:32,height:32,borderRadius:8,background:isAdminMsg?C.accent+"22":C.blue+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{isAdminMsg?"👑":isUnread?"🔴":"💬"}</div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:3}}>
                                <span style={{fontSize:12,color:isUnread?C.accent:C.text,fontWeight:700}}>{isAdminMsg?"Admin":(fromUser?.name||"—")}</span>
                                <span style={{fontSize:10,color:C.muted}}>→ {toUser?.name||"—"}</span>
                                {isUnread&&<span style={{fontSize:8,color:C.accent,background:C.accentDim,padding:"1px 5px",borderRadius:3,fontFamily:"monospace",fontWeight:900}}>NUEVO</span>}
                                <span style={{fontSize:9,color:C.muted,marginLeft:"auto",fontFamily:"monospace"}}>{timeAgo(m.created_at)}</span>
                              </div>
                              <p style={{fontSize:11,color:isUnread?C.mutedL:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.text.substring(0,80)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {!selectedUser&&(
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
                      <p style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:12}}>📊 Estadísticas</p>
                      {[
                        {l:"Total mensajes",v:msgs.length,c:C.blue},
                        {l:"No leídos",v:unread,c:C.red},
                        {l:"De admin",v:msgs.filter(m=>m.from_id==="00000000-0000-0000-0000-000000000002").length,c:C.accent},
                        {l:"Lead alerts",v:msgs.filter(m=>m.from_id==="00000000-0000-0000-0000-000000000001").length,c:C.orange},
                      ].map(s=>(
                        <div key={s.l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>
                          <span style={{fontSize:11,color:C.muted}}>{s.l}</span>
                          <span style={{fontSize:12,color:s.c,fontWeight:700,fontFamily:"monospace"}}>{s.v}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
                      <p style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:8}}>🔍 Selecciona un mensaje</p>
                      <p style={{fontSize:11,color:C.muted}}>Pulsa en cualquier mensaje para ver el detalle y responder al usuario.</p>
                    </div>
                  </div>
                )}
              </div>
            </>)}

          </div>
        )}
      </main>
    </div>
  );
}
