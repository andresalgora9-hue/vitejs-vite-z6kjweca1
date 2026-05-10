import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "./supabase";
import type { UserRow, ReviewRow, MessageRow, JobRow, CertRow, Plan } from "./supabase";

// ─── DESIGN TOKENS ───
const C = {
  bg:"#0A0A0F", surface:"#111118", card:"#16161F", cardHover:"#1C1C2A",
  border:"#1E1E30", accent:"#FFD700", orange:"#FF8C00",
  red:"#FF4455", green:"#00D68F", blue:"#3B82F6", purple:"#8B5CF6",
  cyan:"#06B6D4", pink:"#EC4899",
  text:"#F0F0FA", muted:"#44445A", mutedL:"#7777AA",
};

// ─── CONSTANTS ───
const ZONAS = ["Sevilla","Madrid","Barcelona","Valencia","Málaga","Bilbao","Zaragoza","Alicante","Granada","Cádiz","Córdoba","Huelva","Toledo","Salamanca","Valladolid"];
const OFICIOS = ["Electricista","Fontanero","Pintor","Albañil","Carpintero","Cerrajero","Jardinero","Soldador","Climatización","Reformas Integrales","Instalador Solar","Yesero","Técnico de Gas","Fumigador","Techador"];
const OFICIO_ICONS:Record<string,string> = {"Electricista":"⚡","Fontanero":"🔧","Pintor":"🖌️","Albañil":"🧱","Carpintero":"🪵","Cerrajero":"🔑","Jardinero":"🌿","Soldador":"🔥","Climatización":"❄️","Reformas Integrales":"🏗️","Instalador Solar":"☀️","Yesero":"🏛️","Técnico de Gas":"🔩","Fumigador":"🪲","Techador":"🏠"};
const PLAN_COLORS:Record<Plan,string> = {gratis:"#7777AA",basico:"#3B82F6",pro:"#FFD700",elite:"#FF8C00"};
const PLAN_PRICES:Record<Plan,number> = {gratis:0,basico:9.99,pro:24.99,elite:49.99};
const PLAN_FEATURES:Record<Plan,string[]> = {
  gratis:["Perfil básico","5 contactos/mes","Visible en búsquedas"],
  basico:["Perfil completo","20 contactos/mes","✓ Badge verificado","Estadísticas básicas","Chat con clientes","Galería 5 fotos","Gestión de trabajos"],
  pro:["Perfil destacado","Contactos ilimitados","✓✓ Badge PRO","Estadísticas avanzadas","Chat + llamada directa","Galería ilimitada","Primero en búsquedas","Panel de trabajos completo","Ranking público","Notificaciones push"],
  elite:["Todo lo de Pro","⭐ Badge ÉLITE","Anuncios en portada","Top garantizado #1","Gestor reseñas avanzado","Facturación integrada","Soporte telefónico 24h","API de integración"],
};

const wColor = (id:string) => [C.purple,C.blue,C.pink,"#10B981",C.orange,C.cyan][id.charCodeAt(id.length-1)%6];

function trialDaysLeft(trial_end:string){ return Math.max(0,Math.ceil((new Date(trial_end).getTime()-Date.now())/86400000)); }
function timeAgo(iso:string){
  const diff=(Date.now()-new Date(iso).getTime())/1000;
  if(diff<60) return "ahora";
  if(diff<3600) return Math.floor(diff/60)+"m";
  if(diff<86400) return Math.floor(diff/3600)+"h";
  return Math.floor(diff/86400)+"d";
}

// ─── UI ATOMS ───
function Stars({n,size=13,interactive=false,onSet}:{n:number;size?:number;interactive?:boolean;onSet?:(n:number)=>void}){
  return <span style={{fontSize:size,color:C.accent,letterSpacing:1,cursor:interactive?"pointer":"default"}}>
    {[1,2,3,4,5].map(i=><span key={i} onClick={()=>interactive&&onSet&&onSet(i)} style={{color:i<=Math.round(n)?C.accent:C.border}}>{i<=Math.round(n)?"★":"☆"}</span>)}
  </span>;
}
function Ava({s,size=44,color=C.purple,online=false}:{s:string;size?:number;color?:string;online?:boolean}){
  return <div style={{position:"relative",flexShrink:0}}>
    <div style={{width:size,height:size,borderRadius:"50%",background:"linear-gradient(135deg,"+color+"55,"+color+"22)",display:"flex",alignItems:"center",justifyContent:"center",color:C.accent,fontWeight:900,fontSize:Math.round(size*0.35),fontFamily:"'DM Sans',sans-serif",border:"2px solid "+color+"55",boxShadow:"0 0 12px "+color+"22",flexShrink:0}}>{s}</div>
    {online&&<div style={{position:"absolute",bottom:0,right:0,width:10,height:10,borderRadius:"50%",background:C.green,border:"2px solid "+C.bg,boxShadow:"0 0 6px "+C.green}} />}
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
    <span style={{width:6,height:6,borderRadius:"50%",background:col,display:"inline-block",boxShadow:"0 0 5px "+col}} />{labels[status]||status}
  </span>;
}
function Spin(){return <div style={{display:"flex",justifyContent:"center",padding:40}}><div style={{width:28,height:28,border:"3px solid "+C.border,borderTop:"3px solid "+C.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite"}} /></div>;}
function Ping({msg}:{msg:string|null}){
  if(!msg) return null;
  return <div style={{position:"fixed",bottom:88,left:"50%",transform:"translateX(-50%)",background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",color:"#000",borderRadius:10,padding:"10px 20px",fontWeight:700,fontSize:13,zIndex:9999,whiteSpace:"nowrap",boxShadow:"0 4px 20px "+C.accent+"55",pointerEvents:"none",animation:"fadeUp 0.3s ease"}}>{msg}</div>;
}
function Sheet({children,onClose,title}:{children:React.ReactNode;onClose:()=>void;title?:string}){
  return <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(4,4,12,0.88)",backdropFilter:"blur(16px)",zIndex:500,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:"0"}}>
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
  const bg = danger ? C.red : color;
  return <button onClick={onClick} disabled={disabled} style={{width:full?"100%":"auto",padding:small?"8px 14px":"12px 22px",background:outline?"transparent":"linear-gradient(135deg,"+bg+","+bg+"BB)",border:"1px solid "+bg+(outline?"66":"22"),borderRadius:10,color:outline?bg:"#000",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:small?13:14,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,transition:"all 0.15s",boxShadow:outline?"none":"0 4px 14px "+bg+"33",whiteSpace:"nowrap"}}>{children}</button>;
}
function Inp({label,value,onChange,type="text",placeholder="",required=false,multiline=false}:any){
  const style:any={width:"100%",background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"11px 14px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none"};
  return <div style={{marginBottom:14}}>
    {label&&<p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:5,fontWeight:700}}>{label}{required&&<span style={{color:C.red}}> *</span>}</p>}
    {multiline?<textarea value={value} onChange={(e:any)=>onChange(e.target.value)} placeholder={placeholder} style={{...style,resize:"vertical",minHeight:80}} />
    :<input type={type} value={value} onChange={(e:any)=>onChange(e.target.value)} placeholder={placeholder} style={style} />}
  </div>;
}
function GCard({children,style={},onClick,glow="",noPad=false}:any){
  const [hov,setHov]=useState(false);
  return <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={onClick}
    style={{background:hov&&onClick?C.cardHover:C.card,borderRadius:14,border:"1px solid "+(hov&&glow?glow+"44":C.border),padding:noPad?0:18,transition:"all 0.2s",cursor:onClick?"pointer":"default",boxShadow:hov&&glow?"0 6px 24px "+glow+"18":"0 2px 12px rgba(0,0,0,0.25),inset 0 1px 0 rgba(255,255,255,0.02)",...style}}>{children}</div>;
}

// ─── AUTH ───
function Auth({onLogin}:{onLogin:(u:UserRow)=>void}){
  const [mode,setMode]=useState<"login"|"register">("login");
  const [step,setStep]=useState(1);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const [userType,setUserType]=useState<"cliente"|"profesional">("cliente");
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
    if(pass.length<6){setErr("La contraseña debe tener mínimo 6 caracteres.");return;}
    setLoading(true);setErr("");
    const {data:ex}=await db.from("users").select("id").eq("email",email.toLowerCase()).maybeSingle();
    if(ex){setLoading(false);setErr("Ya existe una cuenta con ese email.");return;}
    const trial_end=new Date(Date.now()+30*86400000).toISOString().split("T")[0];
    const {data,error}=await db.from("users").insert({name,email:email.toLowerCase(),phone,password:pass,type:userType,plan,trade:userType==="profesional"?trade:null,zone:userType==="profesional"?zone:null,bio:"",price:30,available:true,verified:false,jobs:0,rating:0,reviews:0,trial_end}).select().single();
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
          <p style={{fontSize:13,color:C.muted}}>Profesionales verificados en tu zona</p>
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
              <div style={{flex:1,height:1,background:C.border}} />
              <span style={{fontSize:10,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Demo rápido</span>
              <div style={{flex:1,height:1,background:C.border}} />
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
                  <div key={t} onClick={()=>setUserType(t)} style={{padding:"16px 10px",borderRadius:12,border:"2px solid "+(userType===t?C.accent:C.border),background:userType===t?C.accent+"15":C.surface,cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}>
                    <div style={{fontSize:24,marginBottom:6}}>{t==="cliente"?"🏠":"🔨"}</div>
                    <div style={{fontWeight:700,fontSize:13,color:userType===t?C.accent:C.text}}>{t==="cliente"?"Soy cliente":"Soy profesional"}</div>
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
              <Inp label="Teléfono" value={phone} onChange={setPhone} placeholder="+34 600 000 000" required />
              <Inp label="Contraseña" value={pass} onChange={setPass} type="password" placeholder="Mínimo 6 caracteres" required />
              {userType==="profesional"&&<>
                <div style={{marginBottom:14}}>
                  <p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Oficio</p>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {OFICIOS.map(o=><button key={o} onClick={()=>setTrade(o)} style={{padding:"6px 12px",borderRadius:99,border:"1px solid "+(trade===o?C.accent:C.border),background:trade===o?C.accent+"22":"transparent",color:trade===o?C.accent:C.muted,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:trade===o?700:400,transition:"all 0.15s"}}>{OFICIO_ICONS[o]} {o}</button>)}
                  </div>
                </div>
                <div style={{marginBottom:14}}>
                  <p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Ciudad</p>
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
                {(userType==="profesional"?["gratis","basico","pro","elite"]:["gratis"] as Plan[]).map(p=>{
                  const pl=p as Plan;const col=PLAN_COLORS[pl];
                  return (
                    <div key={pl} onClick={()=>setPlan(pl)} style={{padding:"12px 14px",borderRadius:10,border:"2px solid "+(plan===pl?col:C.border),background:plan===pl?col+"12":C.surface,cursor:"pointer",transition:"all 0.15s",position:"relative"}}>
                      {pl==="pro"&&<span style={{position:"absolute",top:-9,right:10,background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",color:"#000",borderRadius:99,padding:"1px 9px",fontSize:8,fontWeight:900}}>POPULAR</span>}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        <span style={{fontWeight:800,fontSize:14,color:col}}>{pl.toUpperCase()}</span>
                        <span style={{fontWeight:700,fontSize:15,color:C.text}}>{PLAN_PRICES[pl]===0?"GRATIS":PLAN_PRICES[pl]+"€/mes"}</span>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                        {PLAN_FEATURES[pl].slice(0,3).map(f=><span key={f} style={{fontSize:10,color:C.mutedL}}>✓ {f}</span>)}
                        {PLAN_FEATURES[pl].length>3&&<span style={{fontSize:10,color:col}}>+{PLAN_FEATURES[pl].length-3} más</span>}
                      </div>
                    </div>
                  );
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
  return (
    <GCard onClick={onClick} glow={col} style={{position:"relative",overflow:"hidden",padding:16}}>
      <div style={{position:"absolute",top:-20,right:-20,width:70,height:70,borderRadius:"50%",background:"radial-gradient(circle,"+col+"15,transparent 70%)",pointerEvents:"none"}} />
      {w.plan==="elite"&&<div style={{marginBottom:7}}><Badge plan="elite" /></div>}
      {w.plan==="pro"&&<div style={{marginBottom:7}}><Badge plan="pro" /></div>}
      <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10}}>
        <Ava s={w.name.substring(0,2).toUpperCase()} size={46} color={col} online={w.available} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:2}}>
            <p style={{fontWeight:700,fontSize:15,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{w.name}</p>
            {w.verified&&<span style={{fontSize:10,color:C.green,flexShrink:0}}>✓</span>}
          </div>
          <p style={{fontSize:12,color:col,fontWeight:600,marginBottom:2}}>{OFICIO_ICONS[w.trade||""]||"🔧"} {w.trade}</p>
          <p style={{fontSize:11,color:C.muted}}>📍 {w.zone}</p>
        </div>
      </div>
      <p style={{fontSize:12,color:C.mutedL,marginBottom:10,lineHeight:1.55,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{w.bio||"Profesional verificado con experiencia."}</p>
      <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:8}}>
        <Stars n={w.rating} size={11} />
        <span style={{fontSize:11,color:C.text,fontWeight:700}}>{w.rating>0?w.rating.toFixed(1):"Nuevo"}</span>
        {w.reviews>0&&<span style={{fontSize:10,color:C.muted}}>({w.reviews} reseñas)</span>}
        {w.jobs>0&&<span style={{fontSize:10,color:C.muted}}>· {w.jobs} trabajos</span>}
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:8,borderTop:"1px solid "+C.border}}>
        <div><span style={{fontWeight:800,fontSize:20,color:C.accent}}>{w.price}€</span><span style={{fontSize:11,color:C.muted}}>/h</span></div>
        <div style={{display:"flex",gap:5,alignItems:"center"}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:w.available?C.green:C.red,display:"inline-block"}} />
          <span style={{fontSize:11,color:w.available?C.green:C.red,fontWeight:600}}>{w.available?"Disponible ahora":"Ocupado"}</span>
        </div>
      </div>
    </GCard>
  );
}

// ─── WORKER DETAIL SHEET ───
function WorkerSheet({worker,onClose,onChat,currentUser}:{worker:UserRow;onClose:()=>void;onChat:(w:UserRow)=>void;currentUser:UserRow|null}){
  const [tab,setTab]=useState<"info"|"reviews"|"certs">("info");
  const [reviews,setReviews]=useState<ReviewRow[]>([]);
  const [certs,setCerts]=useState<CertRow[]>([]);
  const [newRev,setNewRev]=useState(""); const [selStars,setSelStars]=useState(5); const [saving,setSaving]=useState(false);
  const col=wColor(worker.id);

  useEffect(()=>{
    db.from("reviews").select("*").eq("worker_id",worker.id).order("created_at",{ascending:false}).then(({data}:{data:any})=>setReviews(data||[]));
    db.from("certificates").select("*").eq("worker_id",worker.id).then(({data}:{data:any})=>setCerts(data||[]));
    // Track visit
    db.from("visits").insert({page:"worker_"+worker.id,user_id:currentUser?.id||null}).then(()=>{});
  },[worker.id,currentUser?.id]);

  const submitReview=async()=>{
    if(!newRev.trim()) return;
    setSaving(true);
    const {data}=await db.from("reviews").insert({worker_id:worker.id,client_name:currentUser?.name||"Anónimo",client_id:currentUser?.id||null,stars:selStars,text:newRev,photo:""}).select().single();
    if(data) setReviews(p=>[data,...p]);
    setNewRev(""); setSaving(false);
  };

  return (
    <Sheet onClose={onClose}>
      <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:16}}>
        <Ava s={worker.name.substring(0,2).toUpperCase()} size={58} color={col} online={worker.available} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap",marginBottom:3}}>
            <p style={{fontWeight:800,fontSize:19,color:C.text}}>{worker.name}</p>
            {worker.verified&&<span style={{fontSize:10,color:C.green,border:"1px solid "+C.green+"44",padding:"1px 6px",borderRadius:99}}>✓ Verificado</span>}
            <Badge plan={worker.plan} />
          </div>
          <p style={{color:col,fontWeight:600,fontSize:13,marginBottom:3}}>{OFICIO_ICONS[worker.trade||""]||"🔧"} {worker.trade} · {worker.zone}</p>
          <div style={{display:"flex",gap:5,alignItems:"center"}}>
            <Stars n={worker.rating} size={11} />
            <span style={{fontSize:12,color:C.text,fontWeight:700}}>{worker.rating>0?worker.rating.toFixed(1):"Nuevo"}</span>
            {worker.reviews>0&&<span style={{fontSize:11,color:C.muted}}>({worker.reviews})</span>}
          </div>
        </div>
        <button onClick={onClose} style={{background:"none",border:"1px solid "+C.border,borderRadius:8,color:C.muted,cursor:"pointer",padding:"5px 10px",fontSize:14,flexShrink:0}}>✕</button>
      </div>

      {/* Quick actions */}
      {currentUser&&currentUser.type==="cliente"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          <Btn full onClick={()=>onChat(worker)} color={C.accent}>💬 Enviar mensaje</Btn>
          <button onClick={()=>{}} style={{padding:"12px",background:C.green+"15",border:"1px solid "+C.green+"44",borderRadius:10,color:C.green,fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer"}}>📞 {worker.phone||"Ver teléfono"}</button>
        </div>
      )}
      {!currentUser&&<div style={{padding:"12px",background:C.surface,borderRadius:10,border:"1px solid "+C.border,textAlign:"center",marginBottom:14}}><p style={{fontSize:13,color:C.muted}}>Regístrate gratis para contactar con profesionales</p></div>}

      {/* Stats row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
        {[{l:"Trabajos",v:String(worker.jobs)},{l:"Precio/h",v:(worker.price||30)+"€"},{l:"Valoración",v:worker.rating>0?worker.rating.toFixed(1)+"★":"Nuevo"}].map(s=>(
          <div key={s.l} style={{background:"linear-gradient(135deg,"+col+"15,transparent)",borderRadius:10,padding:"10px 6px",textAlign:"center",border:"1px solid "+col+"25"}}>
            <p style={{fontWeight:800,fontSize:18,color:col}}>{s.v}</p>
            <p style={{fontSize:10,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.06em"}}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {(["info","reviews","certs"] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"7px",borderRadius:8,border:"1px solid "+(tab===t?col:C.border),background:tab===t?col+"20":"transparent",color:tab===t?col:C.muted,fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"uppercase" as const,letterSpacing:"0.06em",transition:"all 0.15s"}}>
            {t==="info"?"Sobre mí":t==="reviews"?("Reseñas ("+reviews.length+")"):"Títulos ("+certs.length+")"}
          </button>
        ))}
      </div>

      {tab==="info"&&<p style={{fontSize:13,color:C.mutedL,lineHeight:1.75}}>{worker.bio||"Profesional con experiencia contrastada. Presupuesto sin compromiso."}</p>}

      {tab==="reviews"&&(<>
        {currentUser&&currentUser.type==="cliente"&&(
          <GCard style={{marginBottom:12,padding:14}}>
            <p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Deja tu reseña</p>
            <Stars n={selStars} size={22} interactive onSet={setSelStars} />
            <Inp label="" value={newRev} onChange={setNewRev} placeholder="Cuéntanos tu experiencia..." multiline />
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
              <p style={{fontSize:13,color:C.mutedL,lineHeight:1.6}}>{r.text}</p>
            </GCard>
          ))}
          {reviews.length===0&&<p style={{textAlign:"center",color:C.muted,fontSize:13,padding:16}}>Sin reseñas aún · Sé el primero</p>}
        </div>
      </>)}

      {tab==="certs"&&(<>
        {certs.length===0?<p style={{textAlign:"center",color:C.muted,fontSize:13,padding:16}}>No ha subido títulos todavía</p>:
        certs.map(c=>(
          <GCard key={c.id} style={{padding:12,marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:22}}>📜</span>
              <div style={{flex:1}}><p style={{fontWeight:700,color:C.text,fontSize:13}}>{c.name}</p><p style={{fontSize:10,color:C.muted}}>{new Date(c.created_at).toLocaleDateString("es-ES")}</p></div>
              {c.verified&&<span style={{fontSize:10,color:C.green,border:"1px solid "+C.green+"44",padding:"2px 7px",borderRadius:99}}>✓ Verificado</span>}
            </div>
          </GCard>
        ))}
      </>)}
    </Sheet>
  );
}

// ─── CHAT ───
function ChatPanel({toUser,currentUser,onClose}:{toUser:UserRow;currentUser:UserRow;onClose:()=>void}){
  const [msgs,setMsgs]=useState<MessageRow[]>([]);
  const [input,setInput]=useState("");
  const [sending,setSending]=useState(false);
  const bottomRef=useRef<HTMLDivElement>(null);
  const col=wColor(toUser.id);
  const isClient=currentUser.type==="cliente";

  const loadMsgs=useCallback(async()=>{
    const {data}=await db.from("messages").select("*")
      .or("and(from_id.eq."+currentUser.id+",to_id.eq."+toUser.id+"),and(from_id.eq."+toUser.id+",to_id.eq."+currentUser.id+")")
      .order("created_at",{ascending:true});
    if(data&&data.length>0){setMsgs(data);}
    else{
      setMsgs([{id:"w0",from_id:isClient?toUser.id:currentUser.id,to_id:isClient?currentUser.id:toUser.id,text:isClient?"¡Hola! Soy "+toUser.name+". ¿En qué puedo ayudarte?":"¡Hola "+toUser.name+"! Me interesa tu servicio.",read:true,created_at:new Date().toISOString()}]);
    }
  },[currentUser.id,toUser.id,isClient,toUser.name]);

  useEffect(()=>{loadMsgs();},[loadMsgs]);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs.length]);

  const send=async()=>{
    if(!input.trim()||sending) return;
    const txt=input; setInput(""); setSending(true);
    const {data}=await db.from("messages").insert({from_id:currentUser.id,to_id:toUser.id,text:txt,read:false}).select().single();
    if(data) setMsgs(p=>[...p,data]);
    setSending(false);
    // Auto-reply if demo
    if(toUser.email.includes("@demo.com")){
      setTimeout(async()=>{
        const rs=["Perfecto, puedo verte esta semana.","¿Me das más detalles del trabajo?","Son "+toUser.price+"€/h. ¿Te parece bien?","Sin problema, tengo disponibilidad.","Te llamo en un momento.","Podría estar mañana por la mañana."];
        const {data:d2}=await db.from("messages").insert({from_id:toUser.id,to_id:currentUser.id,text:rs[Math.floor(Math.random()*rs.length)],read:false}).select().single();
        if(d2) setMsgs(p=>[...p,d2]);
      },1200);
    }
  };

  const theOther=isClient?toUser:toUser;

  return (
    <div style={{position:"fixed",bottom:0,right:0,width:"100%",maxWidth:360,height:420,background:"linear-gradient(170deg,#12121E,#080810)",borderRadius:"18px 18px 0 0",border:"1px solid "+col+"44",borderBottom:"none",boxShadow:"0 -6px 30px "+col+"15,0 -10px 40px rgba(0,0,0,0.5)",zIndex:400,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"10px 14px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:10,background:col+"10",borderRadius:"18px 18px 0 0"}}>
        <Ava s={theOther.name.substring(0,2).toUpperCase()} size={32} color={col} online />
        <div style={{flex:1}}>
          <p style={{fontWeight:700,fontSize:14,color:C.text}}>{theOther.name}</p>
          <p style={{fontSize:10,color:C.green}}>● En línea</p>
        </div>
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
  const [tab,setTab]=useState<"buscar"|"chats"|"perfil">("buscar");
  const [zona,setZona]=useState("Todas");
  const [oficio,setOficio]=useState("Todos");
  const [search,setSearch]=useState("");
  const [workers,setWorkers]=useState<UserRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [selectedWorker,setSelectedWorker]=useState<UserRow|null>(null);
  const [chatWorker,setChatWorker]=useState<UserRow|null>(null);
  const [chatPartners,setChatPartners]=useState<UserRow[]>([]);
  const [toast,setToast]=useState<string|null>(null);
  const [newJobSheet,setNewJobSheet]=useState<UserRow|null>(null);

  const showToast=(m:string)=>{setToast(m);setTimeout(()=>setToast(null),3000);};

  const loadWorkers=useCallback(async()=>{
    setLoading(true);
    let q=db.from("users").select("*").eq("type","profesional").neq("plan","gratis").order("plan",{ascending:false}).order("rating",{ascending:false});
    if(zona!=="Todas") q=q.eq("zone",zona);
    if(oficio!=="Todos") q=q.eq("trade",oficio);
    if(search) q=q.ilike("name","%"+search+"%");
    const {data}=await q;
    // Also include gratis but at the end
    let q2=db.from("users").select("*").eq("type","profesional").eq("plan","gratis");
    if(zona!=="Todas") q2=q2.eq("zone",zona);
    if(oficio!=="Todos") q2=q2.eq("trade",oficio);
    if(search) q2=q2.ilike("name","%"+search+"%");
    const {data:d2}=await q2;
    setWorkers([...(data||[]),...(d2||[])]);
    setLoading(false);
  },[zona,oficio,search]);

  useEffect(()=>{loadWorkers();},[loadWorkers]);

  const loadChats=useCallback(async()=>{
    const {data}=await db.from("messages").select("from_id,to_id").or("from_id.eq."+user.id+",to_id.eq."+user.id);
    if(!data?.length){setChatPartners([]);return;}
    const ids=[...new Set((data as any[]).map((m:any)=>m.from_id===user.id?m.to_id:m.from_id))];
    const {data:ws}=await db.from("users").select("*").in("id",ids);
    setChatPartners(ws||[]);
  },[user.id]);

  useEffect(()=>{if(tab==="chats")loadChats();},[tab,loadChats]);

  return (
    <div style={{minHeight:"100dvh",background:C.bg,backgroundImage:"radial-gradient(ellipse at 15% 0%,#1a0a3a22,transparent 50%),radial-gradient(ellipse at 85% 100%,#0a1a3a22,transparent 50%)",paddingBottom:72}}>
      <header style={{background:"rgba(10,10,15,0.94)",backdropFilter:"blur(20px)",borderBottom:"1px solid "+C.border,position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 20px rgba(0,0,0,0.4)"}}>
        <div style={{maxWidth:900,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,boxShadow:"0 4px 12px "+C.accent+"44"}}>🔨</div>
            <span style={{fontWeight:900,fontSize:19,letterSpacing:"-0.03em"}}><span style={{color:C.text}}>Oficio</span><span style={{color:C.accent}}>Ya</span></span>
          </div>
          <button onClick={onLogout} style={{background:"none",border:"1px solid "+C.border,borderRadius:6,color:C.muted,cursor:"pointer",padding:"4px 10px",fontSize:11}}>Salir</button>
        </div>
      </header>

      <div style={{maxWidth:900,margin:"0 auto",padding:"0 16px"}}>
        {tab==="buscar"&&(<>
          <div style={{padding:"22px 0 16px"}}>
            <div style={{display:"inline-flex",gap:6,background:C.green+"15",border:"1px solid "+C.green+"30",borderRadius:6,padding:"4px 12px",marginBottom:12}}>
              <span style={{fontSize:8,color:C.green,animation:"pulse 2s infinite"}}>●</span>
              <span style={{fontSize:11,color:C.green,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase" as const}}>{workers.filter(w=>w.available).length} disponibles ahora mismo</span>
            </div>
            <h1 style={{fontWeight:900,fontSize:"clamp(26px,5vw,48px)",lineHeight:1.05,letterSpacing:"-0.02em",marginBottom:8}}>
              <span style={{color:C.text}}>El profesional que necesitas,</span><br/>
              <span style={{background:"linear-gradient(135deg,"+C.accent+","+C.orange+")",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>cuando lo necesitas.</span>
            </h1>
            <p style={{fontSize:14,color:C.mutedL,lineHeight:1.6}}>Presupuesto gratuito · Sin compromiso · Pago directo al profesional</p>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
            <div style={{display:"flex",background:C.card,borderRadius:10,border:"1px solid "+C.border,overflow:"hidden"}}>
              <span style={{padding:"0 12px",display:"flex",alignItems:"center",color:C.muted,fontSize:16}}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Busca electricista, pintor, carpintero..." style={{flex:1,padding:"12px 0",background:"transparent",border:"none",color:C.text,fontFamily:"inherit",fontSize:14,outline:"none"}} />
            </div>
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

          {/* Oficio quick filters */}
          <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:4,marginBottom:16}}>
            {["Todos",...OFICIOS.slice(0,8)].map(o=>(
              <button key={o} onClick={()=>setOficio(o)} style={{flexShrink:0,padding:"6px 12px",borderRadius:99,border:"1px solid "+(oficio===o?C.accent:C.border),background:oficio===o?C.accent+"18":"transparent",color:oficio===o?C.accent:C.muted,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:oficio===o?700:400,whiteSpace:"nowrap",transition:"all 0.15s"}}>
                {o!=="Todos"&&OFICIO_ICONS[o]+" "}{o}
              </button>
            ))}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:C.border,borderRadius:10,overflow:"hidden",marginBottom:18}}>
            {[{v:workers.length+"+",l:"Profesionales",c:C.purple},{v:"1.8K",l:"Trabajos",c:C.blue},{v:"15",l:"Ciudades",c:C.green},{v:"4.8★",l:"Valoración",c:C.accent}].map(s=>(
              <div key={s.l} style={{background:"linear-gradient(135deg,"+s.c+"10,"+C.surface+")",padding:"10px 4px",textAlign:"center"}}>
                <p style={{fontWeight:800,fontSize:17,color:s.c}}>{s.v}</p>
                <p style={{fontSize:9,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.06em"}}>{s.l}</p>
              </div>
            ))}
          </div>

          {loading?<Spin />:(<>
            <p style={{fontSize:12,color:C.muted,marginBottom:12}}><span style={{color:C.text,fontWeight:700}}>{workers.length}</span> profesionales encontrados{zona!=="Todas"?" en "+zona:""}</p>
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

        {tab==="chats"&&(<>
          <div style={{padding:"22px 0 16px"}}>
            <h2 style={{fontWeight:800,fontSize:22,color:C.text,letterSpacing:"-0.02em"}}>Mis conversaciones</h2>
            <p style={{fontSize:13,color:C.muted,marginTop:4}}>Habla directamente con los profesionales</p>
          </div>
          {chatPartners.length===0?<div style={{textAlign:"center",padding:48,color:C.muted}}>
            <p style={{fontSize:36,marginBottom:8}}>💬</p>
            <p style={{fontWeight:700,fontSize:16,marginBottom:6}}>Sin conversaciones</p>
            <p style={{fontSize:13,marginBottom:16}}>Contacta con un profesional para empezar</p>
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
                    <p style={{fontSize:11,color:C.muted,marginTop:2}}>{w.available?"Disponible ahora":"Ocupado"}</p>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                    <Btn small onClick={(e:any)=>{e.stopPropagation();setChatWorker(w);}}>Abrir →</Btn>
                  </div>
                </div>
              </GCard>;
            })}
          </div>}
        </>)}

        {tab==="perfil"&&(<>
          <div style={{padding:"22px 0 16px"}}>
            <h2 style={{fontWeight:800,fontSize:22,color:C.text,letterSpacing:"-0.02em"}}>Mi perfil</h2>
          </div>
          <GCard style={{marginBottom:14}}>
            <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:16}}>
              <Ava s={user.name.substring(0,2).toUpperCase()} size={52} color={C.blue} />
              <div>
                <p style={{fontWeight:800,fontSize:18,color:C.text}}>{user.name}</p>
                <p style={{fontSize:13,color:C.muted}}>{user.email}</p>
                <p style={{fontSize:12,color:C.muted}}>{user.phone}</p>
                <div style={{marginTop:5}}><Badge plan={user.plan} /></div>
              </div>
            </div>
            <div style={{padding:"10px 12px",background:C.surface,borderRadius:8,border:"1px solid "+C.border}}>
              <p style={{fontSize:11,color:C.muted,marginBottom:2}}>Estado del plan</p>
              <p style={{fontSize:13,color:C.text}}>Plan <span style={{color:PLAN_COLORS[user.plan],fontWeight:700}}>{user.plan.toUpperCase()}</span> · Trial hasta {user.trial_end}</p>
            </div>
          </GCard>
          <Btn full outline danger onClick={onLogout} color={C.red}>Cerrar sesión</Btn>
        </>)}
      </div>

      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(10,10,15,0.97)",backdropFilter:"blur(20px)",borderTop:"1px solid "+C.border,display:"flex",zIndex:200,boxShadow:"0 -2px 20px rgba(0,0,0,0.5)"}}>
        {([["buscar","🔍","Buscar"],["chats","💬","Chats"],["perfil","👤","Perfil"]] as const).map(([id,icon,label])=>(
          <button key={id} onClick={()=>setTab(id as any)} style={{flex:1,padding:"10px 4px 12px",background:"none",border:"none",color:tab===id?C.accent:C.muted,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,transition:"color 0.15s"}}>
            <span style={{fontSize:20}}>{icon}</span>
            <span style={{fontSize:10,fontWeight:600,letterSpacing:"0.02em"}}>{label}</span>
            {id==="chats"&&chatPartners.length>0&&<span style={{position:"absolute",marginTop:-6,marginLeft:16,width:8,height:8,borderRadius:"50%",background:C.red}} />}
          </button>
        ))}
      </nav>

      {selectedWorker&&<WorkerSheet worker={selectedWorker} onClose={()=>setSelectedWorker(null)} onChat={w=>{setSelectedWorker(null);setChatWorker(w);showToast("Chat abierto con "+w.name);}} currentUser={user} />}
      {chatWorker&&<ChatPanel toUser={chatWorker} currentUser={user} onClose={()=>setChatWorker(null)} />}
      {newJobSheet&&<Sheet title="Solicitar trabajo" onClose={()=>setNewJobSheet(null)}><NewJobForm worker={newJobSheet} currentUser={user} onDone={()=>{setNewJobSheet(null);showToast("✓ Solicitud enviada");}} /></Sheet>}
      <Ping msg={toast} />
    </div>
  );
}

function NewJobForm({worker,currentUser,onDone}:{worker:UserRow;currentUser:UserRow;onDone:()=>void}){
  const [title,setTitle]=useState("");
  const [desc,setDesc]=useState("");
  const [saving,setSaving]=useState(false);
  const submit=async()=>{
    if(!title.trim()) return;
    setSaving(true);
    await db.from("jobs").insert({worker_id:worker.id,client_id:currentUser.id,client_name:currentUser.name,title,description:desc,status:"pending",price:0});
    setSaving(false); onDone();
  };
  return <>
    <Inp label="Tipo de trabajo" value={title} onChange={setTitle} placeholder="Ej: Reparación de avería eléctrica" required />
    <Inp label="Descripción (opcional)" value={desc} onChange={setDesc} placeholder="Cuéntanos más detalles..." multiline />
    <Btn full disabled={saving} onClick={submit}>{saving?"Enviando...":"Enviar solicitud →"}</Btn>
  </>;
}

// ─── PRO DASHBOARD ───
function ProDashboard({user,onLogout,onUpdate}:{user:UserRow;onLogout:()=>void;onUpdate:(u:UserRow)=>void}){
  const [tab,setTab]=useState<"inicio"|"chats"|"trabajos"|"perfil"|"planes">("inicio");
  const [toast,setToast]=useState<string|null>(null);
  const [bio,setBio]=useState(user.bio||"");
  const [price,setPrice]=useState(String(user.price||30));
  const [available,setAvailable]=useState(user.available);
  const [saving,setSaving]=useState(false);
  const [certName,setCertName]=useState("");
  const [certs,setCerts]=useState<CertRow[]>([]);
  const [jobs,setJobs]=useState<JobRow[]>([]);
  const [chatPartners,setChatPartners]=useState<UserRow[]>([]);
  const [chatUser,setChatUser]=useState<UserRow|null>(null);
  const [stats,setStats]=useState({visits:0,contacts:0,reviews:0,earnings:0});
  const daysLeft=trialDaysLeft(user.trial_end);
  const showToast=(m:string)=>{setToast(m);setTimeout(()=>setToast(null),3000);};

  const canAccess=(feat:string)=>PLAN_FEATURES[user.plan].some(f=>f.toLowerCase().includes(feat.toLowerCase()));

  useEffect(()=>{
    db.from("certificates").select("*").eq("worker_id",user.id).then(({data}:{data:any})=>setCerts(data||[]));
    db.from("visits").select("id",{count:"exact"} as any).eq("user_id",user.id).then(({count}:{count:any})=>setStats(s=>({...s,visits:count||0})));
    db.from("messages").select("id",{count:"exact"} as any).eq("to_id",user.id).then(({count}:{count:any})=>setStats(s=>({...s,contacts:count||0})));
    db.from("reviews").select("id",{count:"exact"} as any).eq("worker_id",user.id).then(({count}:{count:any})=>setStats(s=>({...s,reviews:count||0})));
    db.from("jobs").select("*").eq("worker_id",user.id).order("created_at",{ascending:false}).then(({data}:{data:any})=>{
      setJobs(data||[]);
      const earnings=(data||[]).filter((j:JobRow)=>j.status==="done").reduce((s:number,j:JobRow)=>s+j.price,0);
      setStats(s=>({...s,earnings}));
    });
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
    const upd={bio,price:parseInt(price)||30,available};
    await db.from("users").update(upd).eq("id",user.id);
    onUpdate({...user,...upd});
    setSaving(false); showToast("✓ Perfil actualizado");
  };

  const toggleAvailable=async()=>{
    const v=!available; setAvailable(v);
    await db.from("users").update({available:v}).eq("id",user.id);
    onUpdate({...user,available:v});
    showToast(v?"✓ Ahora apareces como disponible":"Ahora apareces como ocupado");
  };

  const addCert=async()=>{
    if(!certName.trim()) return;
    const {data}=await db.from("certificates").insert({worker_id:user.id,name:certName,url:"",verified:false}).select().single();
    if(data){setCerts(p=>[...p,data]);setCertName("");showToast("✓ Título añadido");}
  };

  const updateJobStatus=async(jobId:string,status:string)=>{
    await db.from("jobs").update({status,updated_at:new Date().toISOString()}).eq("id",jobId);
    setJobs(p=>p.map(j=>j.id===jobId?{...j,status:status as any}:j));
    showToast("✓ Estado actualizado");
  };

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
        <p style={{fontSize:12,color:daysLeft>0?C.orange:C.red,fontWeight:700}}>
          {daysLeft>0?"⚠ "+daysLeft+" días de prueba restantes · Activa un plan ahora":"⛔ Tu prueba expiró · Tu perfil no es visible"}
        </p>
      </div>}

      <div style={{maxWidth:900,margin:"0 auto",padding:"0 16px"}}>

        {tab==="inicio"&&(<>
          <div style={{padding:"22px 0 16px"}}>
            <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:18}}>
              <Ava s={user.name.substring(0,2).toUpperCase()} size={50} color={C.accent} online={available} />
              <div style={{flex:1}}>
                <p style={{fontWeight:800,fontSize:18,color:C.text,letterSpacing:"-0.02em"}}>{user.name}</p>
                <p style={{fontSize:13,color:C.accent,fontWeight:600}}>{OFICIO_ICONS[user.trade||""]||"🔧"} {user.trade} · {user.zone}</p>
                <div style={{display:"flex",gap:8,alignItems:"center",marginTop:5}}>
                  <button onClick={toggleAvailable} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"1px solid "+(available?C.green+"44":C.border),borderRadius:99,padding:"4px 10px",cursor:"pointer",color:available?C.green:C.muted,fontSize:11,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>
                    <span style={{width:6,height:6,borderRadius:"50%",background:available?C.green:C.muted,display:"inline-block"}} />
                    {available?"Disponible · Cambiar":"Ocupado · Cambiar"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
            {[{l:"Visitas al perfil",v:stats.visits,c:C.blue,i:"👁",key:"visitas"},{l:"Mensajes recibidos",v:stats.contacts,c:C.green,i:"💬",key:"mensajes"},{l:"Reseñas",v:stats.reviews,c:C.accent,i:"⭐",key:"reseñas"},{l:"Días de trial",v:daysLeft,c:daysLeft>7?C.mutedL:C.red,i:"⏱",key:"trial"}].map(s=>(
              <GCard key={s.key} style={{textAlign:"center",padding:"14px 10px"}}>
                <div style={{fontSize:18,marginBottom:4}}>{s.i}</div>
                <p style={{fontWeight:800,fontSize:24,color:s.c}}>{s.v}</p>
                <p style={{fontSize:11,color:C.muted}}>{s.l}</p>
              </GCard>
            ))}
          </div>

          <GCard style={{marginBottom:14}}>
            <p style={{fontWeight:700,color:C.text,fontSize:13,marginBottom:12,letterSpacing:"-0.01em"}}>Estado de funcionalidades · Plan {user.plan.toUpperCase()}</p>
            {[{feat:"Chat con clientes",icon:"💬",key:"chat"},{feat:"Estadísticas",icon:"📊",key:"estadísticas"},{feat:"Panel de trabajos",icon:"🔨",key:"trabajos"},{feat:"Primero en búsquedas",icon:"🔝",key:"primero"},{feat:"Ranking público",icon:"🏆",key:"ranking"}].map(({feat,icon,key})=>{
              const has=canAccess(key);
              return <div key={feat} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid "+C.border}}>
                <span style={{fontSize:14}}>{icon}</span>
                <span style={{flex:1,fontSize:13,color:has?C.text:C.muted}}>{feat}</span>
                {has?<span style={{color:C.green,fontSize:11,fontWeight:700}}>✓ Activo</span>:<button onClick={()=>setTab("planes")} style={{background:"none",border:"1px solid "+C.accent+"44",borderRadius:6,color:C.accent,cursor:"pointer",padding:"3px 8px",fontSize:10,fontWeight:700}}>Activar →</button>}
              </div>;
            })}
          </GCard>

          {jobs.filter(j=>j.status==="pending").length>0&&(
            <GCard style={{marginBottom:14,border:"1px solid "+C.orange+"44"}}>
              <p style={{fontWeight:700,color:C.orange,fontSize:13,marginBottom:10}}>🔔 {jobs.filter(j=>j.status==="pending").length} solicitudes pendientes</p>
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
          <div style={{padding:"22px 0 16px"}}>
            <h2 style={{fontWeight:800,fontSize:22,color:C.text,letterSpacing:"-0.02em"}}>Mensajes de clientes</h2>
            <p style={{fontSize:13,color:C.muted,marginTop:4}}>Los clientes te contactan aquí</p>
          </div>
          {!canAccess("chat")?<GCard style={{textAlign:"center",padding:"40px 20px"}}>
            <p style={{fontSize:36,marginBottom:10}}>💬</p>
            <p style={{fontWeight:700,color:C.text,fontSize:16,marginBottom:8}}>Chat disponible en plan Básico+</p>
            <p style={{fontSize:13,color:C.muted,marginBottom:18}}>Recibe y responde mensajes de tus clientes</p>
            <Btn onClick={()=>setTab("planes")} color={C.accent}>Ver planes →</Btn>
          </GCard>:
          chatPartners.length===0?<div style={{textAlign:"center",padding:48,color:C.muted}}>
            <p style={{fontSize:36,marginBottom:8}}>💬</p>
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
          <div style={{padding:"22px 0 16px"}}>
            <h2 style={{fontWeight:800,fontSize:22,color:C.text,letterSpacing:"-0.02em"}}>Mis trabajos</h2>
            <p style={{fontSize:13,color:C.muted,marginTop:4}}>Gestiona tus solicitudes y trabajos</p>
          </div>
          {!canAccess("trabajos")?<GCard style={{textAlign:"center",padding:"40px 20px"}}>
            <p style={{fontSize:36,marginBottom:10}}>🔨</p>
            <p style={{fontWeight:700,color:C.text,fontSize:16,marginBottom:8}}>Panel de trabajos en Básico+</p>
            <p style={{fontSize:13,color:C.muted,marginBottom:18}}>Gestiona tus solicitudes, presupuestos y trabajos</p>
            <Btn onClick={()=>setTab("planes")} color={C.accent}>Ver planes →</Btn>
          </GCard>:<>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:16}}>
              {[{l:"Pendientes",v:jobs.filter(j=>j.status==="pending").length,c:C.orange},{l:"En progreso",v:jobs.filter(j=>j.status==="in_progress").length,c:C.blue},{l:"Completados",v:jobs.filter(j=>j.status==="done").length,c:C.green},{l:"Ingresos",v:stats.earnings+"€",c:C.accent}].map(s=>(
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
                      {j.status==="pending"&&<button onClick={()=>updateJobStatus(j.id,"in_progress")} style={{padding:"6px 12px",background:C.blue+"22",border:"1px solid "+C.blue+"44",borderRadius:8,color:C.blue,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Aceptar</button>}
                      {j.status==="in_progress"&&<button onClick={()=>updateJobStatus(j.id,"done")} style={{padding:"6px 12px",background:C.green+"22",border:"1px solid "+C.green+"44",borderRadius:8,color:C.green,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Marcar completado</button>}
                      <button onClick={()=>updateJobStatus(j.id,"cancelled")} style={{padding:"6px 12px",background:C.red+"15",border:"1px solid "+C.red+"33",borderRadius:8,color:C.red,cursor:"pointer",fontSize:12,fontFamily:"'DM Sans',sans-serif",fontWeight:600}}>Cancelar</button>
                    </div>
                  )}
                </GCard>
              ))}
            </div>
          </>}
        </>)}

        {tab==="perfil"&&(<>
          <div style={{padding:"22px 0 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <h2 style={{fontWeight:800,fontSize:22,color:C.text,letterSpacing:"-0.02em"}}>Mi perfil</h2>
            <Btn small onClick={saveProfile} disabled={saving}>{saving?"Guardando...":"Guardar cambios"}</Btn>
          </div>
          <GCard style={{marginBottom:14}}>
            <p style={{fontWeight:700,color:C.text,fontSize:13,marginBottom:12}}>Información pública</p>
            <Inp label="Descripción profesional" value={bio} onChange={setBio} placeholder="Describe tu experiencia, especialidades y servicios..." multiline />
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <Inp label="Precio por hora (€)" value={price} onChange={setPrice} type="number" />
              <div>
                <p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:8,fontWeight:700}}>Disponibilidad</p>
                <button onClick={()=>setAvailable(!available)} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"none",border:"1px solid "+(available?C.green+"44":C.border),borderRadius:8,color:available?C.green:C.muted,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,width:"100%"}}>
                  <div style={{width:36,height:20,borderRadius:99,background:available?C.green:C.border,position:"relative",flexShrink:0,transition:"background 0.2s"}}>
                    <div style={{width:14,height:14,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:available?19:3,transition:"left 0.2s"}} />
                  </div>
                  {available?"Disponible":"Ocupado"}
                </button>
              </div>
            </div>
          </GCard>

          <GCard style={{marginBottom:14}}>
            <p style={{fontWeight:700,color:C.text,fontSize:13,marginBottom:12}}>Títulos y certificados</p>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <input value={certName} onChange={e=>setCertName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCert()} placeholder="Ej: Certificado de instalador eléctrico" style={{flex:1,background:C.surface,border:"1px solid "+C.border,borderRadius:8,padding:"9px 12px",color:C.text,fontFamily:"inherit",fontSize:13,outline:"none"}} />
              <Btn small onClick={addCert}>Añadir</Btn>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {certs.map(c=>(
                <div key={c.id} style={{display:"flex",gap:10,alignItems:"center",padding:"10px 12px",background:C.surface,borderRadius:8,border:"1px solid "+C.border}}>
                  <span style={{fontSize:18}}>📜</span>
                  <span style={{flex:1,fontSize:13,color:C.text}}>{c.name}</span>
                  {c.verified&&<span style={{fontSize:10,color:C.green,fontWeight:700}}>✓ Verificado</span>}
                </div>
              ))}
              {certs.length===0&&<p style={{fontSize:12,color:C.muted,textAlign:"center",padding:12}}>Añade tus títulos y certificaciones para generar más confianza</p>}
            </div>
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
                {!isCurrent&&<button onClick={()=>showToast("🚀 Redirigiendo a Stripe... (modo demo)")} style={{marginTop:14,width:"100%",padding:"11px",background:pl==="pro"?"linear-gradient(135deg,"+col+","+C.orange+")":"transparent",border:"1px solid "+col+"66",borderRadius:8,color:pl==="pro"?"#000":col,fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer"}}>
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
            {id==="chats"&&chatPartners.length>0&&tab!=="chats"&&<span style={{position:"absolute",top:6,right:"calc(50% - 12px)",width:7,height:7,borderRadius:"50%",background:C.red}} />}
            {id==="trabajos"&&jobs.filter(j=>j.status==="pending").length>0&&tab!=="trabajos"&&<span style={{position:"absolute",top:6,right:"calc(50% - 12px)",background:C.orange,color:"#000",borderRadius:99,padding:"0 4px",fontSize:8,fontWeight:900}}>{jobs.filter(j=>j.status==="pending").length}</span>}
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
  const [tab,setTab]=useState<"overview"|"users"|"jobs">("overview");
  const [users,setUsers]=useState<UserRow[]>([]);
  const [jobs,setJobs]=useState<JobRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [stats,setStats]=useState({total:0,pros:0,clients:0,reviews:0,messages:0,mrr:0});

  useEffect(()=>{
    const load=async()=>{
      const {data:us}=await db.from("users").select("*").neq("type","admin").order("joined_at",{ascending:false});
      const {data:js}=await db.from("jobs").select("*").order("created_at",{ascending:false});
      const {count:rv}=await db.from("reviews").select("id",{count:"exact"} as any);
      const {count:mg}=await db.from("messages").select("id",{count:"exact"} as any);
      const all=us||[];
      const mrr=all.filter(u=>u.type==="profesional").reduce((s:number,u:UserRow)=>s+PLAN_PRICES[u.plan as Plan],0);
      setUsers(all);
      setJobs(js||[]);
      setStats({total:all.length,pros:all.filter(u=>u.type==="profesional").length,clients:all.filter(u=>u.type==="cliente").length,reviews:(rv as any)||0,messages:(mg as any)||0,mrr});
      setLoading(false);
    };
    load();
  },[]);

  return (
    <div style={{minHeight:"100dvh",background:C.bg,paddingBottom:72}}>
      <header style={{background:"rgba(10,10,15,0.95)",backdropFilter:"blur(20px)",borderBottom:"1px solid "+C.accent+"22",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1000,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span style={{fontSize:16}}>⚙️</span>
            <span style={{fontWeight:800,fontSize:17}}><span style={{color:C.accent}}>Admin</span><span style={{color:C.muted}}> · OfficioYa</span></span>
          </div>
          <button onClick={onLogout} style={{background:"none",border:"1px solid "+C.border,borderRadius:6,color:C.muted,cursor:"pointer",padding:"4px 10px",fontSize:11}}>Salir</button>
        </div>
      </header>

      <div style={{maxWidth:1000,margin:"0 auto",padding:"20px 16px"}}>
        {loading?<Spin />:(<>
          {tab==="overview"&&(<>
            <h2 style={{fontWeight:800,fontSize:22,color:C.text,marginBottom:16,letterSpacing:"-0.02em"}}>Panel de control</h2>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,marginBottom:20}}>
              {[{l:"Usuarios",v:stats.total,c:C.blue,i:"👥"},{l:"Profesionales",v:stats.pros,c:C.accent,i:"🔨"},{l:"Clientes",v:stats.clients,c:C.green,i:"🏠"},{l:"Reseñas",v:stats.reviews,c:C.purple,i:"⭐"},{l:"Mensajes",v:stats.messages,c:C.cyan,i:"💬"},{l:"MRR",v:stats.mrr.toFixed(0)+"€",c:C.orange,i:"💰"}].map(s=>(
                <GCard key={s.l} style={{textAlign:"center",padding:"14px 8px"}}>
                  <div style={{fontSize:20,marginBottom:4}}>{s.i}</div>
                  <p style={{fontWeight:800,fontSize:22,color:s.c}}>{s.v}</p>
                  <p style={{fontSize:10,color:C.muted}}>{s.l}</p>
                </GCard>
              ))}
            </div>
            <GCard style={{marginBottom:14}}>
              <p style={{fontWeight:700,color:C.text,fontSize:14,marginBottom:12}}>MRR por plan</p>
              {(["gratis","basico","pro","elite"] as Plan[]).map(pl=>{
                const count=users.filter(u=>u.plan===pl&&u.type==="profesional").length;
                const mrr=count*PLAN_PRICES[pl];
                const pct=stats.mrr>0?Math.round(mrr/stats.mrr*100):0;
                return <div key={pl} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}><Badge plan={pl} /><span style={{fontSize:12,color:C.mutedL}}>{count} pros</span></div>
                    <span style={{fontWeight:700,fontSize:13,color:PLAN_COLORS[pl]}}>{mrr.toFixed(0)}€/mes</span>
                  </div>
                  <div style={{height:6,background:C.border,borderRadius:99,overflow:"hidden"}}>
                    <div style={{width:pct+"%",height:"100%",background:"linear-gradient(90deg,"+PLAN_COLORS[pl]+","+PLAN_COLORS[pl]+"88)",borderRadius:99,transition:"width 1s"}} />
                  </div>
                </div>;
              })}
              <div style={{display:"flex",justifyContent:"space-between",paddingTop:10,borderTop:"1px solid "+C.border,marginTop:4}}>
                <span style={{fontWeight:700,color:C.text}}>TOTAL MRR</span>
                <span style={{fontWeight:800,fontSize:18,color:C.accent}}>{stats.mrr.toFixed(2)}€/mes</span>
              </div>
            </GCard>
          </>)}

          {tab==="users"&&(<>
            <h2 style={{fontWeight:800,fontSize:22,color:C.text,marginBottom:16,letterSpacing:"-0.02em"}}>Usuarios · {users.length} registrados</h2>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {users.map(u=>(
                <GCard key={u.id} style={{padding:"12px 14px"}}>
                  <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                    <Ava s={u.name.substring(0,2).toUpperCase()} size={36} color={u.type==="profesional"?C.accent:C.blue} />
                    <div style={{flex:1,minWidth:120}}>
                      <p style={{fontWeight:700,color:C.text,fontSize:13}}>{u.name}</p>
                      <p style={{fontSize:11,color:C.muted}}>{u.email}</p>
                      {u.phone&&<p style={{fontSize:11,color:C.muted}}>{u.phone}</p>}
                    </div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                      <span style={{fontSize:10,color:u.type==="profesional"?C.accent:C.blue,background:(u.type==="profesional"?C.accent:C.blue)+"22",padding:"2px 7px",borderRadius:4,fontWeight:700}}>{u.type.toUpperCase()}</span>
                      <Badge plan={u.plan as Plan} />
                      {u.trade&&<span style={{fontSize:10,color:C.mutedL}}>{u.trade}</span>}
                      {u.zone&&<span style={{fontSize:10,color:C.muted}}>📍{u.zone}</span>}
                    </div>
                    <span style={{fontSize:10,color:C.muted,flexShrink:0}}>{new Date(u.joined_at).toLocaleDateString("es-ES")}</span>
                  </div>
                </GCard>
              ))}
            </div>
          </>)}

          {tab==="jobs"&&(<>
            <h2 style={{fontWeight:800,fontSize:22,color:C.text,marginBottom:16,letterSpacing:"-0.02em"}}>Trabajos · {jobs.length} registrados</h2>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {jobs.length===0&&<p style={{textAlign:"center",color:C.muted,padding:32,fontSize:13}}>No hay trabajos registrados</p>}
              {jobs.map(j=>(
                <GCard key={j.id} style={{padding:"12px 14px"}}>
                  <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:120}}>
                      <p style={{fontWeight:700,color:C.text,fontSize:13}}>{j.title}</p>
                      <p style={{fontSize:11,color:C.muted}}>Cliente: {j.client_name}</p>
                    </div>
                    <StatusDot status={j.status} />
                    <span style={{fontSize:10,color:C.muted}}>{new Date(j.created_at).toLocaleDateString("es-ES")}</span>
                  </div>
                </GCard>
              ))}
            </div>
          </>)}
        </>)}
      </div>

      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(10,10,15,0.97)",backdropFilter:"blur(20px)",borderTop:"1px solid "+C.accent+"22",display:"flex",zIndex:200}}>
        {([["overview","📊","Overview"],["users","👥","Usuarios"],["jobs","🔨","Trabajos"]] as const).map(([id,icon,label])=>(
          <button key={id} onClick={()=>setTab(id as any)} style={{flex:1,padding:"10px 4px 12px",background:"none",border:"none",color:tab===id?C.accent:C.muted,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <span style={{fontSize:20}}>{icon}</span>
            <span style={{fontSize:10,fontWeight:600}}>{label}</span>
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
      @keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}
    `}</style>
    {!user&&<Auth onLogin={login} />}
    {user&&user.type==="admin"&&<Admin onLogout={logout} />}
    {user&&user.type==="profesional"&&<ProDashboard user={user} onLogout={logout} onUpdate={update} />}
    {user&&user.type==="cliente"&&<ClientHome user={user} onLogout={logout} />}
  </>);
}
