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

const ZONAS = ["Sevilla","Madrid","Barcelona","Valencia","Málaga","Bilbao"];
const SEVILLA_ZONAS = ["Centro","Triana","Los Remedios","Nervión","La Macarena"];
const OFICIOS = ["Electricista","Fontanero","Pintor","Albañil","Carpintero"];

const PLAN_COLORS: Record<Plan,string> = {gratis:"#7777AA",basico:"#3B82F6",pro:"#FFD700",elite:"#FF8C00"};
const PLAN_PRICES: Record<Plan,number> = {gratis:0,basico:9.99,pro:24.99,elite:49.99};

// Helper functions
const wColor = (id:string) => [C.purple,C.blue,C.pink,"#10B981",C.orange,C.cyan][id.charCodeAt(id.length-1)%6];
function trialDaysLeft(t:string){ return Math.max(0,Math.ceil((new Date(t).getTime()-Date.now())/86400000)); }
function timeAgo(iso:string){ 
  const d=(Date.now()-new Date(iso).getTime())/1000;
  if(d<60) return "ahora"; 
  if(d<3600) return Math.floor(d/60)+"m";
  if(d<86400) return Math.floor(d/3600)+"h"; 
  return Math.floor(d/86400)+"d";
}

// UI Components
function Stars({n,size=13}:{n:number;size?:number}){
  return <span style={{fontSize:size,letterSpacing:1}}>
    {[1,2,3,4,5].map(i=><span key={i} style={{color:i<=Math.round(n)?C.accent:C.border}}>{i<=Math.round(n)?"★":"☆"}</span>)}
  </span>;
}

function Ava({s,size=44,color=C.purple,online=false}:{s:string;size?:number;color?:string;online?:boolean}){
  return <div style={{position:"relative",flexShrink:0}}>
    <div style={{width:size,height:size,borderRadius:"50%",background:"linear-gradient(135deg,"+color+"55,"+color+"22)",display:"flex",alignItems:"center",justifyContent:"center",color:C.accent,fontSize:size*0.4,fontWeight:900}}>{s}</div>
    {online&&<div style={{position:"absolute",bottom:0,right:0,width:10,height:10,borderRadius:"50%",background:C.green,border:"2px solid "+C.bg}} />}
  </div>;
}

function Badge({plan}:{plan:Plan}){
  const col=PLAN_COLORS[plan];
  return <span style={{padding:"2px 7px",borderRadius:4,fontSize:9,fontWeight:900,color:col,background:col+"22",border:"1px solid "+col+"44"}}>{plan.toUpperCase()}</span>;
}

function Spin(){
  return <div style={{display:"flex",justifyContent:"center",padding:40}}>
    <div style={{width:28,height:28,border:"3px solid "+C.border,borderTop:"3px solid "+C.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite"}} />
  </div>;
}

function Btn({children,onClick,color=C.accent,disabled=false}:any){
  return <button onClick={onClick} disabled={disabled} style={{padding:"12px 22px",background:"linear-gradient(135deg,"+color+","+color+"BB)",border:"1px solid "+color+"22",borderRadius:8,color:"#000",fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,transition:"all 0.15s"}}>{children}</button>;
}

function Inp({label,value,onChange,type="text",placeholder=""}:any){
  const s:any={width:"100%",background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"11px 14px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none"};
  return <div style={{marginBottom:14}}>
    {label&&<p style={{fontSize:11,color:C.muted,textTransform:"uppercase",marginBottom:5,fontWeight:700}}>{label}</p>}
    <input type={type} value={value} onChange={(e:any)=>onChange(e.target.value)} placeholder={placeholder} style={s} />
  </div>;
}

function GCard({children,onClick,style={}}:any){
  const [hov,setHov]=useState(false);
  return <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={onClick}
    style={{background:hov&&onClick?C.cardHover:C.card,borderRadius:14,border:"1px solid "+C.border,padding:18,transition:"all 0.2s",cursor:onClick?"pointer":"default",...style}}>
    {children}
  </div>;
}

// AUTH Component
function Auth({onLogin}:{onLogin:(u:UserRow)=>void}){
  const [mode,setMode]=useState<"login"|"register">("login");
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");

  const login=async()=>{
    if(!email||!pass){setErr("Complete todos los campos");return;}
    setLoading(true);
    try {
      const {data,error}=await db.from("users").select("*").eq("email",email).eq("password",pass).single();
      if(error||!data){setErr("Email o contraseña incorrectos");return;}
      localStorage.setItem("oy_user",JSON.stringify(data));
      onLogin(data as UserRow);
    } catch(e) {
      setErr("Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{minHeight:"100dvh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <h1 style={{fontWeight:900,fontSize:28,marginBottom:4}}><span style={{color:C.text}}>Oficio</span><span style={{color:C.accent}}>Ya</span></h1>
          <p style={{fontSize:13,color:C.muted}}>Plataforma de profesionales</p>
        </div>
        <GCard>
          {err&&<div style={{color:C.red,fontSize:13,marginBottom:12,padding:"10px 12px",background:C.red+"15",borderRadius:8}}>{err}</div>}
          <Inp label="Email" value={email} onChange={setEmail} type="email" placeholder="tu@email.com" />
          <Inp label="Contraseña" value={pass} onChange={setPass} type="password" placeholder="••••••••" />
          <Btn onClick={login} disabled={loading}>{loading?"Cargando...":"Entrar"}</Btn>
        </GCard>
      </div>
    </div>
  );
}

// PLACEHOLDER DASHBOARDS
function ClientHome({user,onLogout}:{user:UserRow;onLogout:()=>void}){
  return <div style={{minHeight:"100dvh",background:C.bg,padding:20}}>
    <h1 style={{color:C.text}}>Bienvenido {user.name}</h1>
    <button onClick={onLogout} style={{padding:"10px 20px",background:C.red,color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}}>Salir</button>
  </div>;
}

function ProDashboard({user,onLogout}:{user:UserRow;onLogout:()=>void}){
  return <div style={{minHeight:"100dvh",background:C.bg,padding:20}}>
    <h1 style={{color:C.text}}>Panel Profesional - {user.name}</h1>
    <button onClick={onLogout} style={{padding:"10px 20px",background:C.red,color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}}>Salir</button>
  </div>;
}

function Admin({onLogout}:{onLogout:()=>void}){
  return <div style={{minHeight:"100dvh",background:C.bg,padding:20}}>
    <h1 style={{color:C.text}}>Panel Admin</h1>
    <button onClick={onLogout} style={{padding:"10px 20px",background:C.red,color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}}>Salir</button>
  </div>;
}

// MAIN APP
export default function App(){
  const [user,setUser]=useState<UserRow|null>(null);
  const [ready,setReady]=useState(false);

  useEffect(()=>{
    const s=localStorage.getItem("oy_user");
    if(s){
      try{setUser(JSON.parse(s));}
      catch{localStorage.removeItem("oy_user");}
    }
    setReady(true);
  },[]);

  const login=(u:UserRow)=>{
    setUser(u);
    localStorage.setItem("oy_user",JSON.stringify(u));
  };

  const logout=()=>{
    setUser(null);
    localStorage.removeItem("oy_user");
  };

  if(!ready) return <div style={{minHeight:"100dvh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><Spin /></div>;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html{overflow-x:hidden;background:#0A0A0F;}
        body{background:#0A0A0F;color:#F0F0FA;font-family:'DM Sans',sans-serif;overflow-x:hidden;}
        #root{min-height:100dvh;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:#1E1E30;}
        @keyframes spin{to{transform:rotate(360deg);}}
      `}</style>
      {!user&&<Auth onLogin={login} />}
      {user&&user.type==="admin"&&<Admin onLogout={logout} />}
      {user&&user.type==="profesional"&&<ProDashboard user={user} onLogout={logout} />}
      {user&&user.type==="cliente"&&<ClientHome user={user} onLogout={logout} />}
    </>
  );
}
