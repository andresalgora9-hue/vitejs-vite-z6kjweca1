import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "./supabase";
import type { UserRow, ReviewRow, MessageRow, CertRow } from "./supabase";

// ─── CONSTANTS ───
const ZONAS = ["Sevilla","Madrid","Barcelona","Valencia","Málaga","Bilbao","Zaragoza","Alicante","Granada","Cádiz","Córdoba","Huelva"];
const OFICIOS = ["Electricista","Fontanero","Pintor","Albañil","Carpintero","Cerrajero","Jardinero","Soldador","Climatización","Reformas Integrales","Instalador Solar","Yesero"];
const OFICIO_ICONS:Record<string,string> = {"Electricista":"⚡","Fontanero":"🔧","Pintor":"🖌️","Albañil":"🧱","Carpintero":"🪵","Cerrajero":"🔑","Jardinero":"🌿","Soldador":"🔥","Climatización":"❄️","Reformas Integrales":"🏗️","Instalador Solar":"☀️","Yesero":"🏛️"};
type Plan = "gratis"|"basico"|"pro"|"elite";
const PLAN_COLORS:Record<Plan,string> = {gratis:"#7777AA",basico:"#4B9EFF",pro:"#FFD700",elite:"#FF9640"};
const PLAN_PRICES:Record<Plan,number> = {gratis:0,basico:9.99,pro:24.99,elite:49.99};
const PLAN_FEATURES:Record<Plan,string[]> = {
  gratis:["Perfil básico visible","5 contactos/mes","Aparece en búsquedas"],
  basico:["Perfil completo","20 contactos/mes","Badge verificado ✓","Estadísticas básicas","Chat directo","Galería 5 fotos"],
  pro:["Perfil destacado","Contactos ilimitados","Badge PRO","Estadísticas completas","Chat + llamada","Galería ilimitada","Primero en búsquedas","Panel de reseñas","Ranking público"],
  elite:["Todo lo de Pro","Badge ÉLITE ⭐","Anuncios en portada","Top garantizado","Gestor reseñas avanzado","Facturación integrada","Soporte 24h","Estadísticas avanzadas"],
};

// ─── COLORS ───
const C = {
  bg:"#0A0A0F", surface:"#111118", card:"#16161F", cardHover:"#1C1C28",
  border:"#1E1E2E", accent:"#FFD700", accentOrange:"#FFA500",
  red:"#FF4455", green:"#00D68F", blue:"#4B9EFF", purple:"#8B5CF6",
  text:"#F0F0F8", muted:"#44445A", mutedLight:"#6666AA",
};

const wColor = (id:string) => [C.purple,C.blue,"#EC4899","#10B981","#F97316","#06B6D4"][id.charCodeAt(id.length-1)%6];

function trialDaysLeft(trial_end:string){
  const diff = Math.ceil((new Date(trial_end).getTime()-Date.now())/(86400000));
  return Math.max(0,diff);
}

// ─── UI ATOMS ───
function Stars({n,size=13}:{n:number;size?:number}){
  return <span style={{fontSize:size,color:C.accent,letterSpacing:1}}>{"★".repeat(Math.round(n))}{"☆".repeat(5-Math.round(n))}</span>;
}
function Ava({s,size=44,color=C.purple}:{s:string;size?:number;color?:string}){
  return <div style={{width:size,height:size,borderRadius:"50%",background:"linear-gradient(135deg,"+color+"55,"+color+"22)",display:"flex",alignItems:"center",justifyContent:"center",color:C.accent,fontWeight:900,fontSize:Math.round(size*0.35),fontFamily:"'DM Sans',sans-serif",border:"2px solid "+color+"55",boxShadow:"0 0 12px "+color+"33",flexShrink:0}}>{s}</div>;
}
function PlanBadge({plan}:{plan:Plan}){
  const col=PLAN_COLORS[plan];
  return <span style={{padding:"2px 7px",borderRadius:4,fontSize:9,fontWeight:900,letterSpacing:"0.08em",color:col,background:col+"22",border:"1px solid "+col+"44"}}>{plan.toUpperCase()}</span>;
}
function Spinner(){
  return <div style={{display:"flex",justifyContent:"center",padding:40}}><div style={{width:32,height:32,border:"3px solid "+C.border,borderTop:"3px solid "+C.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite"}} /></div>;
}
function Toast({msg}:{msg:string|null}){
  if(!msg) return null;
  return <div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",background:"linear-gradient(135deg,"+C.accent+","+C.accentOrange+")",color:"#000",borderRadius:10,padding:"10px 20px",fontWeight:700,fontSize:13,zIndex:9999,whiteSpace:"nowrap",boxShadow:"0 4px 20px "+C.accent+"66",pointerEvents:"none"}}>{msg}</div>;
}
function Modal({children,onClose}:{children:React.ReactNode;onClose:()=>void}){
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(4,4,12,0.9)",backdropFilter:"blur(16px)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px 16px",overflowY:"auto"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(160deg,#0F0F20,#080812)",borderRadius:20,maxWidth:520,width:"100%",maxHeight:"88vh",overflowY:"auto",border:"1px solid "+C.accent+"33",boxShadow:"0 0 60px "+C.accent+"15,0 40px 80px rgba(0,0,0,0.6)"}}>
        {children}
      </div>
    </div>
  );
}

function Btn({children,onClick,color=C.accent,outline=false,full=false,small=false,disabled=false,type="button"}:any){
  return <button type={type} onClick={onClick} disabled={disabled} style={{width:full?"100%":"auto",padding:small?"8px 16px":"12px 24px",background:outline?"transparent":"linear-gradient(135deg,"+color+","+color+"BB)",border:"1px solid "+color+(outline?"66":"33"),borderRadius:10,color:outline?color:"#000",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:small?13:15,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,transition:"all 0.15s",boxShadow:outline?"none":"0 4px 14px "+color+"33"}}>{children}</button>;
}
function Inp({label,value,onChange,type="text",placeholder="",required=false}:any){
  return (
    <div style={{marginBottom:14}}>
      {label&&<p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:5,fontWeight:700}}>{label}{required&&<span style={{color:C.red}}> *</span>}</p>}
      <input type={type} value={value} onChange={(e:any)=>onChange(e.target.value)} placeholder={placeholder}
        style={{width:"100%",background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"11px 14px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none"}} />
    </div>
  );
}
function Sel({label,value,onChange,options}:{label:string;value:string;onChange:(v:string)=>void;options:string[]}){
  return (
    <div style={{marginBottom:14}}>
      <p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:5,fontWeight:700}}>{label}</p>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"11px 14px",color:C.text,fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none",cursor:"pointer"}}>
        {options.map(o=><option key={o} style={{background:C.card}}>{o}</option>)}
      </select>
    </div>
  );
}
function GCard({children,style={},onClick,glow=""}:any){
  const [hov,setHov]=useState(false);
  return <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={onClick} style={{background:hov&&onClick?C.cardHover:C.card,borderRadius:14,border:"1px solid "+(hov&&glow?glow+"55":C.border),padding:20,transition:"all 0.2s",cursor:onClick?"pointer":"default",boxShadow:hov&&glow?"0 8px 28px "+glow+"18,inset 0 1px 0 "+glow+"11":"0 2px 12px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.02)",...style}}>{children}</div>;
}

// ─── AUTH SCREENS ───
function AuthScreen({onLogin}:{onLogin:(u:UserRow)=>void}){
  const [mode,setMode]=useState<"login"|"register">("login");
  const [step,setStep]=useState(1);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const [type,setType]=useState<"cliente"|"profesional">("cliente");
  const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [phone,setPhone]=useState("");
  const [pass,setPass]=useState(""); const [trade,setTrade]=useState(OFICIOS[0]); const [zone,setZone]=useState(ZONAS[0]);
  const [plan,setPlan]=useState<Plan>("gratis");

  const login = async() => {
    if(!email||!pass){setErr("Rellena email y contraseña.");return;}
    setLoading(true); setErr("");
    const {data,error} = await db.from("users").select("*").eq("email",email.toLowerCase()).eq("password",pass).single();
    setLoading(false);
    if(error||!data){setErr("Email o contraseña incorrectos.");return;}
    localStorage.setItem("oy_user",JSON.stringify(data));
    onLogin(data as UserRow);
  };

  const demoLogin = async(t:"cliente"|"profesional") => {
    setLoading(true);
    const email = t==="profesional"?"marcos@demo.com":"demo_cliente@demo.com";
    let {data} = await db.from("users").select("*").eq("email",email).single();
    if(!data && t==="cliente"){
      const {data:d2} = await db.from("users").insert({name:"Demo Cliente",email:"demo_cliente@demo.com",phone:"600000000",password:"demo123",type:"cliente",plan:"gratis",trial_end:new Date(Date.now()+30*86400000).toISOString().split("T")[0]}).select().single();
      data=d2;
    }
    setLoading(false);
    if(data){localStorage.setItem("oy_user",JSON.stringify(data));onLogin(data as UserRow);}
  };

  const register = async() => {
    if(!name||!email||!phone||!pass){setErr("Rellena todos los campos.");return;}
    if(pass.length<6){setErr("La contraseña debe tener al menos 6 caracteres.");return;}
    setLoading(true); setErr("");
    const {data:existing} = await db.from("users").select("id").eq("email",email.toLowerCase()).single();
    if(existing){setLoading(false);setErr("Ya existe una cuenta con ese email.");return;}
    const trialEnd = new Date(Date.now()+30*86400000).toISOString().split("T")[0];
    const {data,error} = await db.from("users").insert({
      name,email:email.toLowerCase(),phone,password:pass,type,plan,
      trade:type==="profesional"?trade:null,zone:type==="profesional"?zone:null,
      bio:"",price:30,available:true,verified:false,jobs:0,rating:0,reviews:0,trial_end:trialEnd
    }).select().single();
    setLoading(false);
    if(error||!data){setErr("Error al crear cuenta. Inténtalo de nuevo.");return;}
    localStorage.setItem("oy_user",JSON.stringify(data));
    onLogin(data as UserRow);
  };

  return (
    <div style={{minHeight:"100dvh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px",backgroundImage:"radial-gradient(ellipse at 25% 0%,#2a0a5a33,transparent 55%),radial-gradient(ellipse at 75% 100%,#0a1a4a33,transparent 55%)"}}>
      <div style={{width:"100%",maxWidth:400}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:52,height:52,borderRadius:14,background:"linear-gradient(135deg,"+C.accent+","+C.accentOrange+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 12px",boxShadow:"0 8px 24px "+C.accent+"44"}}>🔨</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontWeight:900,fontSize:30,letterSpacing:"-0.03em"}}>
            <span style={{color:C.text}}>Oficio</span><span style={{color:C.accent}}>Ya</span>
          </div>
          <p style={{fontSize:13,color:C.muted,marginTop:4}}>Profesionales de confianza en tu zona</p>
        </div>

        {/* Tab switch */}
        <div style={{display:"flex",background:C.card,borderRadius:10,padding:4,border:"1px solid "+C.border,marginBottom:20}}>
          {(["login","register"] as const).map(m=>(
            <button key={m} onClick={()=>{setMode(m);setErr("");setStep(1);}} style={{flex:1,padding:"9px",borderRadius:8,border:"none",background:mode===m?"linear-gradient(135deg,"+C.accent+","+C.accentOrange+")":"transparent",color:mode===m?"#000":C.muted,fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",transition:"all 0.2s"}}>
              {m==="login"?"Iniciar sesión":"Crear cuenta"}
            </button>
          ))}
        </div>

        <GCard>
          {err&&<div style={{color:C.red,fontSize:13,marginBottom:14,padding:"10px 12px",background:C.red+"15",borderRadius:8,border:"1px solid "+C.red+"33"}}>{err}</div>}

          {mode==="login"&&(
            <>
              <Inp label="Email" value={email} onChange={setEmail} type="email" placeholder="tu@email.com" />
              <Inp label="Contraseña" value={pass} onChange={setPass} type="password" placeholder="••••••••" />
              <Btn full disabled={loading} onClick={login}>{loading?"Entrando...":"ENTRAR →"}</Btn>
              <div style={{margin:"16px 0",display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,height:1,background:C.border}} />
                <span style={{fontSize:11,color:C.muted}}>ACCESO DEMO</span>
                <div style={{flex:1,height:1,background:C.border}} />
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <Btn outline small onClick={()=>demoLogin("cliente")} color={C.blue} disabled={loading}>👤 Cliente</Btn>
                <Btn outline small onClick={()=>demoLogin("profesional")} color={C.accent} disabled={loading}>🔨 Profesional</Btn>
              </div>
              <p style={{textAlign:"center",fontSize:11,color:C.muted,marginTop:10}}>Admin: admin@oficioya.es / Admin2026!</p>
            </>
          )}

          {mode==="register"&&(
            <>
              {/* Step dots */}
              <div style={{display:"flex",gap:6,marginBottom:18,justifyContent:"center"}}>
                {[1,2,3].map(s=><div key={s} style={{width:s===step?28:7,height:7,borderRadius:99,background:s===step?C.accent:s<step?C.green:C.border,transition:"all 0.3s"}} />)}
              </div>

              {step===1&&(
                <>
                  <p style={{fontWeight:700,color:C.text,marginBottom:14,fontSize:15}}>¿Eres cliente o profesional?</p>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
                    {(["cliente","profesional"] as const).map(t=>(
                      <div key={t} onClick={()=>setType(t)} style={{padding:"18px 10px",borderRadius:12,border:"2px solid "+(type===t?C.accent:C.border),background:type===t?C.accent+"18":C.surface,cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}>
                        <div style={{fontSize:26,marginBottom:6}}>{t==="cliente"?"🏠":"🔨"}</div>
                        <div style={{fontWeight:700,fontSize:14,color:type===t?C.accent:C.text}}>{t==="cliente"?"Cliente":"Profesional"}</div>
                        <div style={{fontSize:11,color:C.muted,marginTop:3}}>{t==="cliente"?"Busco profesionales":"Ofrezco servicios"}</div>
                      </div>
                    ))}
                  </div>
                  <Btn full onClick={()=>setStep(2)}>SIGUIENTE →</Btn>
                </>
              )}

              {step===2&&(
                <>
                  <p style={{fontWeight:700,color:C.text,marginBottom:14,fontSize:15}}>Tus datos</p>
                  <Inp label="Nombre completo" value={name} onChange={setName} placeholder="Tu nombre" required />
                  <Inp label="Email" value={email} onChange={setEmail} type="email" placeholder="tu@email.com" required />
                  <Inp label="Teléfono" value={phone} onChange={setPhone} placeholder="+34 600 000 000" required />
                  <Inp label="Contraseña" value={pass} onChange={setPass} type="password" placeholder="Mínimo 6 caracteres" required />
                  {type==="profesional"&&<><Sel label="Oficio" value={trade} onChange={setTrade} options={OFICIOS} /><Sel label="Ciudad" value={zone} onChange={setZone} options={ZONAS} /></>}
                  <div style={{display:"flex",gap:8}}>
                    <Btn outline small onClick={()=>setStep(1)} color={C.muted}>← Atrás</Btn>
                    <div style={{flex:1}}><Btn full onClick={()=>{if(!name||!email||!phone||!pass){setErr("Rellena todos los campos.");return;}setErr("");setStep(type==="profesional"?3:3);}}>SIGUIENTE →</Btn></div>
                  </div>
                </>
              )}

              {step===3&&(
                <>
                  <p style={{fontWeight:700,color:C.text,marginBottom:4,fontSize:15}}>Elige tu plan</p>
                  <p style={{fontSize:12,color:C.muted,marginBottom:14}}>30 días gratis · Sin tarjeta · Cancela cuando quieras</p>
                  <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                    {(type==="profesional"?["gratis","basico","pro","elite"]:["gratis"] as Plan[]).map(p=>{
                      const pl=p as Plan; const col=PLAN_COLORS[pl];
                      return (
                        <div key={pl} onClick={()=>setPlan(pl)} style={{padding:"12px 14px",borderRadius:10,border:"2px solid "+(plan===pl?col:C.border),background:plan===pl?col+"15":C.surface,cursor:"pointer",transition:"all 0.15s",position:"relative"}}>
                          {pl==="pro"&&<span style={{position:"absolute",top:-9,right:10,background:"linear-gradient(135deg,"+C.accent+","+C.accentOrange+")",color:"#000",borderRadius:99,padding:"1px 9px",fontSize:9,fontWeight:900}}>POPULAR</span>}
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                            <span style={{fontWeight:800,fontSize:14,color:col}}>{pl.toUpperCase()}</span>
                            <span style={{fontWeight:700,fontSize:15,color:C.text}}>{PLAN_PRICES[pl]===0?"GRATIS":PLAN_PRICES[pl]+"€/mes"}</span>
                          </div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                            {PLAN_FEATURES[pl].slice(0,3).map(f=><span key={f} style={{fontSize:10,color:C.mutedLight}}>✓ {f}</span>)}
                            {PLAN_FEATURES[pl].length>3&&<span style={{fontSize:10,color:col}}>+{PLAN_FEATURES[pl].length-3} más</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <Btn outline small onClick={()=>setStep(2)} color={C.muted}>← Atrás</Btn>
                    <div style={{flex:1}}><Btn full disabled={loading} onClick={register}>{loading?"Creando cuenta...":"CREAR CUENTA →"}</Btn></div>
                  </div>
                </>
              )}
            </>
          )}
        </GCard>

        <p style={{textAlign:"center",fontSize:11,color:C.muted,marginTop:16}}>Al registrarte aceptas los Términos de Uso y la Política de Privacidad</p>
      </div>
    </div>
  );
}

// ─── WORKER CARD ───
function WorkerCard({w,onClick}:{w:UserRow;onClick:()=>void}){
  const col=wColor(w.id);
  return (
    <GCard onClick={onClick} glow={col} style={{position:"relative",overflow:"hidden",padding:18}}>
      <div style={{position:"absolute",top:-24,right:-24,width:80,height:80,borderRadius:"50%",background:"radial-gradient(circle,"+col+"18,transparent 70%)",pointerEvents:"none"}} />
      {w.plan==="elite"&&<div style={{marginBottom:8}}><PlanBadge plan="elite" /></div>}
      <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10}}>
        <Ava s={w.name.substring(0,2).toUpperCase()} size={46} color={col} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
            <p style={{fontWeight:700,fontSize:15,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{w.name}</p>
            {w.verified&&<span style={{fontSize:10,color:C.green,flexShrink:0}}>✓</span>}
          </div>
          <p style={{fontSize:12,color:col,fontWeight:600,marginBottom:2}}>{OFICIO_ICONS[w.trade||""]||"🔧"} {w.trade}</p>
          <p style={{fontSize:11,color:C.muted}}>📍 {w.zone}</p>
        </div>
      </div>
      <p style={{fontSize:12,color:C.mutedLight,marginBottom:10,lineHeight:1.55,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{w.bio||"Profesional verificado con experiencia."}</p>
      <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:10,flexWrap:"wrap"}}>
        <Stars n={w.rating} />
        <span style={{fontSize:11,color:C.text,fontWeight:700}}>{w.rating>0?w.rating.toFixed(1):"Nuevo"}</span>
        {w.reviews>0&&<span style={{fontSize:10,color:C.muted}}>({w.reviews}) · {w.jobs} trabajos</span>}
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:10,borderTop:"1px solid "+C.border}}>
        <div><span style={{fontWeight:800,fontSize:20,color:C.accent}}>{w.price}€</span><span style={{fontSize:11,color:C.muted}}>/h</span></div>
        <div style={{display:"flex",gap:5,alignItems:"center"}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:w.available?C.green:C.red,display:"inline-block",boxShadow:w.available?"0 0 6px "+C.green:""}} />
          <span style={{fontSize:11,color:w.available?C.green:C.red,fontWeight:600}}>{w.available?"Disponible":"Ocupado"}</span>
        </div>
      </div>
    </GCard>
  );
}

// ─── WORKER DETAIL MODAL ───
function WorkerModal({worker,onClose,onChat,currentUser}:{worker:UserRow;onClose:()=>void;onChat:(w:UserRow)=>void;currentUser:UserRow|null}){
  const [tab,setTab]=useState<"info"|"reviews"|"fotos"|"certs">("info");
  const [reviews,setReviews]=useState<ReviewRow[]>([]);
  const [certs,setCerts]=useState<CertRow[]>([]);
  const [newRev,setNewRev]=useState(""); const [selStars,setSelStars]=useState(5);
  const [loading,setLoading]=useState(false);
  const col=wColor(worker.id);

  useEffect(()=>{
    db.from("reviews").select("*").eq("worker_id",worker.id).order("created_at",{ascending:false}).then(({data})=>setReviews(data||[]));
    db.from("certificates").select("*").eq("worker_id",worker.id).then(({data})=>setCerts(data||[]));
  },[worker.id]);

  const submitReview=async()=>{
    if(!newRev.trim()) return;
    setLoading(true);
    const {data}=await db.from("reviews").insert({worker_id:worker.id,client_name:currentUser?.name||"Usuario",stars:selStars,text:newRev,photo:""}).select().single();
    if(data) setReviews(p=>[data,...p]);
    setNewRev(""); setLoading(false);
  };

  return (
    <Modal onClose={onClose}>
      <div style={{padding:"20px 20px 0"}}>
        <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:16}}>
          <Ava s={worker.name.substring(0,2).toUpperCase()} size={60} color={col} />
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:3}}>
              <p style={{fontWeight:800,fontSize:20,color:C.text}}>{worker.name}</p>
              {worker.verified&&<span style={{fontSize:11,color:C.green}}>✓ Verificado</span>}
              <PlanBadge plan={worker.plan} />
            </div>
            <p style={{color:col,fontWeight:600,fontSize:13,marginBottom:4}}>{OFICIO_ICONS[worker.trade||""]||"🔧"} {worker.trade} · {worker.zone}</p>
            <div style={{display:"flex",gap:6,alignItems:"center"}}><Stars n={worker.rating} /><span style={{fontSize:12,color:C.text,fontWeight:700}}>{worker.rating>0?worker.rating.toFixed(1):"Nuevo"}</span><span style={{fontSize:11,color:C.muted}}>({worker.reviews})</span></div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"1px solid "+C.border,borderRadius:8,color:C.muted,cursor:"pointer",padding:"6px 10px",fontSize:16,flexShrink:0}}>✕</button>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:20,overflowX:"auto"}}>
          {(["info","reviews","fotos","certs"] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{flexShrink:0,padding:"7px 12px",borderRadius:8,border:"1px solid "+(tab===t?col:C.border),background:tab===t?col+"22":"transparent",color:tab===t?col:C.muted,fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.06em",transition:"all 0.15s"}}>
              {t==="info"?"Info":t==="reviews"?("Reseñas ("+reviews.length+")"):t==="fotos"?"Fotos":"Títulos"}
            </button>
          ))}
        </div>
      </div>
      <div style={{padding:"0 20px 20px"}}>
        {tab==="info"&&(
          <>
            <p style={{fontSize:13,color:C.mutedLight,lineHeight:1.7,marginBottom:16}}>{worker.bio||"Profesional verificado con experiencia contrastada."}</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
              {[{l:"Trabajos",v:String(worker.jobs)},{l:"Precio/h",v:(worker.price||30)+"€"},{l:"Rating",v:worker.rating>0?worker.rating.toFixed(1):"Nuevo"}].map(s=>(
                <div key={s.l} style={{background:"linear-gradient(135deg,"+col+"18,transparent)",borderRadius:10,padding:"12px 8px",textAlign:"center",border:"1px solid "+col+"33"}}>
                  <p style={{fontWeight:800,fontSize:20,color:col,fontFamily:"monospace"}}>{s.v}</p>
                  <p style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.l}</p>
                </div>
              ))}
            </div>
            {currentUser&&currentUser.type==="cliente"&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <Btn full onClick={()=>onChat(worker)} color={C.accent}>💬 Mensaje</Btn>
                <Btn full outline color={C.green}>📞 Teléfono</Btn>
              </div>
            )}
            {!currentUser&&<p style={{textAlign:"center",fontSize:13,color:C.muted,padding:"12px",background:C.surface,borderRadius:8,border:"1px solid "+C.border}}>Regístrate gratis para contactar profesionales</p>}
          </>
        )}
        {tab==="reviews"&&(
          <>
            {currentUser&&(
              <GCard style={{marginBottom:14,padding:14}}>
                <p style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,fontWeight:700}}>Escribe tu reseña</p>
                <div style={{display:"flex",gap:4,marginBottom:10}}>
                  {[1,2,3,4,5].map(s=><button key={s} onClick={()=>setSelStars(s)} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:s<=selStars?C.accent:C.border,transition:"color 0.1s"}}>★</button>)}
                </div>
                <textarea value={newRev} onChange={e=>setNewRev(e.target.value)} placeholder="Cuéntanos tu experiencia..." style={{width:"100%",background:C.card,border:"1px solid "+C.border,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:13,padding:"10px",resize:"vertical",minHeight:68,outline:"none",marginBottom:10}} />
                <Btn full small disabled={loading} onClick={submitReview}>{loading?"Publicando...":"Publicar reseña"}</Btn>
              </GCard>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {reviews.map(r=>(
                <GCard key={r.id} style={{padding:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                    <div style={{width:28,height:28,borderRadius:"50%",background:col+"33",border:"1px solid "+col+"44",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:col}}>{r.client_name[0]}</div>
                    <div style={{flex:1}}><p style={{fontSize:13,fontWeight:700,color:C.text}}>{r.client_name}</p><p style={{fontSize:10,color:C.muted}}>{new Date(r.created_at).toLocaleDateString("es-ES")}</p></div>
                    <Stars n={r.stars} size={11} />
                  </div>
                  <p style={{fontSize:13,color:C.mutedLight,lineHeight:1.6}}>{r.text}</p>
                </GCard>
              ))}
              {reviews.length===0&&<p style={{textAlign:"center",color:C.muted,fontSize:13,padding:20}}>Sé el primero en dejar una reseña</p>}
            </div>
          </>
        )}
        {tab==="fotos"&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {["🔌","⚡","🏠","🔧","💡","🛠️","📐","🪚","🔩"].map((e,i)=>(
              <div key={i} style={{aspectRatio:"1",background:"linear-gradient(135deg,"+col+"18,transparent)",borderRadius:8,border:"1px solid "+col+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,cursor:"pointer"}}>{e}</div>
            ))}
          </div>
        )}
        {tab==="certs"&&(
          <>
            {certs.length===0?<p style={{textAlign:"center",color:C.muted,fontSize:13,padding:20}}>Este profesional no ha subido títulos aún</p>:
            certs.map(c=>(
              <GCard key={c.id} style={{padding:12,marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:24}}>📜</span>
                  <div style={{flex:1}}>
                    <p style={{fontWeight:700,color:C.text,fontSize:13}}>{c.name}</p>
                    <p style={{fontSize:10,color:C.muted}}>{new Date(c.created_at).toLocaleDateString("es-ES")}</p>
                  </div>
                  {c.verified&&<span style={{fontSize:10,color:C.green,border:"1px solid "+C.green+"44",padding:"2px 7px",borderRadius:99}}>✓ Verificado</span>}
                </div>
              </GCard>
            ))}
          </>
        )}
      </div>
    </Modal>
  );
}

// ─── CHAT ───
function ChatPanel({toUser,currentUser,onClose}:{toUser:UserRow;currentUser:UserRow;onClose:()=>void}){
  const [msgs,setMsgs]=useState<MessageRow[]>([]);
  const [input,setInput]=useState("");
  const bottomRef=useRef<HTMLDivElement>(null);
  const col=wColor(toUser.id);

  useEffect(()=>{
    const load=async()=>{
      const {data}=await db.from("messages").select("*")
        .or("and(from_id.eq."+currentUser.id+",to_id.eq."+toUser.id+"),and(from_id.eq."+toUser.id+",to_id.eq."+currentUser.id+")")
        .order("created_at",{ascending:true});
      setMsgs(data||[]);
      if(!data?.length){
        const welcome:any={id:"w",from_id:toUser.id,to_id:currentUser.id,text:"¡Hola! Soy "+toUser.name+". ¿En qué puedo ayudarte?",read:true,created_at:new Date().toISOString()};
        setMsgs([welcome]);
      }
    };
    load();
  },[toUser.id,currentUser.id]);

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs.length]);

  const send=async()=>{
    if(!input.trim()) return;
    const txt=input; setInput("");
    const {data}=await db.from("messages").insert({from_id:currentUser.id,to_id:toUser.id,text:txt,read:false}).select().single();
    if(data) setMsgs(p=>[...p,data]);
    setTimeout(async()=>{
      const rs=["Puedo estar disponible esta semana.","¿Me das más detalles?","Son "+toUser.price+"€/h.","Sin problema, tengo disponibilidad."];
      const rep=rs[Math.floor(Math.random()*rs.length)];
      const {data:d2}=await db.from("messages").insert({from_id:toUser.id,to_id:currentUser.id,text:rep,read:false}).select().single();
      if(d2) setMsgs(p=>[...p,d2]);
    },1200);
  };

  return (
    <div style={{position:"fixed",bottom:0,right:0,width:"100%",maxWidth:340,height:400,background:"linear-gradient(160deg,#0F0F20,#080812)",borderRadius:"16px 16px 0 0",border:"1px solid "+col+"55",boxShadow:"0 -4px 30px "+col+"18,0 -10px 40px rgba(0,0,0,0.5)",zIndex:400,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"10px 14px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",gap:10,background:col+"12",borderRadius:"16px 16px 0 0"}}>
        <Ava s={toUser.name.substring(0,2).toUpperCase()} size={32} color={col} />
        <div style={{flex:1}}><p style={{fontWeight:700,fontSize:14,color:C.text}}>{toUser.name}</p><p style={{fontSize:10,color:C.green}}>● En línea</p></div>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18}}>✕</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"10px 12px",display:"flex",flexDirection:"column",gap:7}}>
        {msgs.map((m,i)=>{
          const isMe=m.from_id===currentUser.id;
          return (
            <div key={i} style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start"}}>
              <div style={{maxWidth:"78%",background:isMe?col+"44":C.card,border:"1px solid "+(isMe?col+"55":C.border),borderRadius:isMe?"12px 12px 2px 12px":"12px 12px 12px 2px",padding:"8px 11px"}}>
                <p style={{fontSize:12,color:isMe?C.accent:C.text,lineHeight:1.5}}>{m.text}</p>
                <p style={{fontSize:9,color:C.muted,marginTop:2,textAlign:"right"}}>{new Date(m.created_at).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div style={{padding:"8px 12px",borderTop:"1px solid "+C.border,display:"flex",gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Escribe un mensaje..." style={{flex:1,background:C.card,border:"1px solid "+C.border,borderRadius:8,padding:"8px 12px",color:C.text,fontFamily:"inherit",fontSize:13,outline:"none"}} />
        <button onClick={send} style={{padding:"8px 14px",background:"linear-gradient(135deg,"+C.accent+","+C.accentOrange+")",border:"none",borderRadius:8,color:"#000",fontWeight:900,cursor:"pointer",fontSize:14}}>→</button>
      </div>
    </div>
  );
}

// ─── CLIENT HOME ───
function ClientHome({user,onLogout}:{user:UserRow;onLogout:()=>void}){
  const [tab,setTab]=useState<"buscar"|"mensajes"|"perfil">("buscar");
  const [zona,setZona]=useState("Todas");
  const [oficio,setOficio]=useState("Todos");
  const [search,setSearch]=useState("");
  const [workers,setWorkers]=useState<UserRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [selectedWorker,setSelectedWorker]=useState<UserRow|null>(null);
  const [chatWorker,setChatWorker]=useState<UserRow|null>(null);
  const [conversations,setConversations]=useState<UserRow[]>([]);
  const [toast,setToast]=useState<string|null>(null);

  const showToast=(m:string)=>{setToast(m);setTimeout(()=>setToast(null),3000);};

  const loadWorkers=useCallback(async()=>{
    setLoading(true);
    let q=db.from("users").select("*").eq("type","profesional").order("plan",{ascending:false});
    if(zona!=="Todas") q=q.eq("zone",zona);
    if(oficio!=="Todos") q=q.eq("trade",oficio);
    if(search) q=q.ilike("name","%"+search+"%");
    const {data}=await q;
    setWorkers(data||[]);
    setLoading(false);
  },[zona,oficio,search]);

  useEffect(()=>{loadWorkers();},[loadWorkers]);

  useEffect(()=>{
    db.from("messages").select("from_id").eq("to_id",user.id).then(async({data})=>{
      if(!data?.length) return;
      const ids=[...new Set(data.map(m=>m.from_id))];
      const {data:ws}=await db.from("users").select("*").in("id",ids);
      setConversations(ws||[]);
    });
  },[user.id]);

  return (
    <div style={{minHeight:"100dvh",background:C.bg,backgroundImage:"radial-gradient(ellipse at 20% 0%,#1a0a3a33,transparent 55%),radial-gradient(ellipse at 80% 100%,#0a1a3a33,transparent 55%)",paddingBottom:80}}>
      <header style={{background:"rgba(10,10,15,0.92)",backdropFilter:"blur(20px)",borderBottom:"1px solid "+C.border,position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 20px rgba(0,0,0,0.4)"}}>
        <div style={{maxWidth:900,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,"+C.accent+","+C.accentOrange+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🔨</div>
            <span style={{fontWeight:900,fontSize:20,letterSpacing:"-0.02em"}}><span style={{color:C.text}}>Oficio</span><span style={{color:C.accent}}>Ya</span></span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:12,color:C.muted,display:"none"}}>{user.name.split(" ")[0]}</span>
            <button onClick={onLogout} style={{background:"none",border:"1px solid "+C.border,borderRadius:6,color:C.muted,cursor:"pointer",padding:"4px 10px",fontSize:11}}>Salir</button>
          </div>
        </div>
      </header>

      <div style={{maxWidth:900,margin:"0 auto",padding:"0 16px"}}>
        {tab==="buscar"&&(
          <>
            <div style={{padding:"24px 0 18px"}}>
              <div style={{display:"inline-flex",gap:6,background:C.green+"18",border:"1px solid "+C.green+"33",borderRadius:6,padding:"4px 12px",marginBottom:14}}>
                <span style={{fontSize:8,color:C.green,animation:"pulse 2s infinite"}}>●</span>
                <span style={{fontSize:11,color:C.green,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase"}}>{workers.filter(w=>w.available).length} disponibles ahora</span>
              </div>
              <h1 style={{fontWeight:900,fontSize:"clamp(28px,6vw,52px)",lineHeight:1.05,letterSpacing:"-0.02em",marginBottom:10}}>
                <span style={{color:C.text}}>El profesional que necesitas,</span><br/>
                <span style={{color:C.accent}}>en tu ciudad.</span>
              </h1>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
              <div style={{display:"flex",background:C.card,borderRadius:10,border:"1px solid "+C.border,overflow:"hidden"}}>
                <span style={{padding:"0 12px",display:"flex",alignItems:"center",color:C.muted}}>🔍</span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Electricista, fontanero, pintor..." style={{flex:1,padding:"12px 0",background:"transparent",border:"none",color:C.text,fontFamily:"inherit",fontSize:14,outline:"none"}} />
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
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:C.border,borderRadius:10,overflow:"hidden",marginBottom:20}}>
              {[{v:workers.length+"+",l:"Pros",c:C.purple},{v:"1.8K",l:"Trabajos",c:C.blue},{v:"12",l:"Ciudades",c:C.green},{v:"4.8★",l:"Media",c:C.accent}].map(s=>(
                <div key={s.l} style={{background:"linear-gradient(135deg,"+s.c+"12,"+C.surface+")",padding:"10px 6px",textAlign:"center"}}>
                  <p style={{fontWeight:800,fontSize:17,color:s.c}}>{s.v}</p>
                  <p style={{fontSize:9,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.l}</p>
                </div>
              ))}
            </div>
            {loading?<Spinner />:(
              <>
                <p style={{fontSize:12,color:C.muted,marginBottom:12}}><span style={{color:C.text,fontWeight:700}}>{workers.length}</span> profesionales encontrados</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:12}}>
                  {workers.map(w=><WorkerCard key={w.id} w={w} onClick={()=>setSelectedWorker(w)} />)}
                  {workers.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:48,color:C.muted}}><p style={{fontSize:36,marginBottom:8}}>🔍</p><p style={{fontWeight:700,fontSize:18}}>Sin resultados</p><p style={{fontSize:13,marginTop:6}}>Prueba con otra búsqueda</p></div>}
                </div>
              </>
            )}
          </>
        )}

        {tab==="mensajes"&&(
          <div style={{padding:"24px 0"}}>
            <p style={{fontWeight:800,fontSize:24,color:C.text,marginBottom:18,letterSpacing:"-0.02em"}}>Mis mensajes</p>
            {conversations.length===0&&<div style={{textAlign:"center",padding:48,color:C.muted}}><p style={{fontSize:36,marginBottom:8}}>💬</p><p style={{fontSize:14}}>No tienes conversaciones aún</p></div>}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {conversations.map(w=>{
                const col=wColor(w.id);
                return (
                  <GCard key={w.id} onClick={()=>setChatWorker(w)} glow={col}>
                    <div style={{display:"flex",gap:12,alignItems:"center"}}>
                      <Ava s={w.name.substring(0,2).toUpperCase()} size={44} color={col} />
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontWeight:700,color:C.text}}>{w.name}</p>
                        <p style={{fontSize:12,color:C.muted}}>{w.trade} · {w.zone}</p>
                      </div>
                      <span style={{fontSize:11,color:col}}>→</span>
                    </div>
                  </GCard>
                );
              })}
            </div>
          </div>
        )}

        {tab==="perfil"&&(
          <div style={{padding:"24px 0"}}>
            <p style={{fontWeight:800,fontSize:24,color:C.text,marginBottom:18,letterSpacing:"-0.02em"}}>Mi perfil</p>
            <GCard style={{marginBottom:14}}>
              <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:16}}>
                <Ava s={user.name.substring(0,2).toUpperCase()} size={52} color={C.blue} />
                <div>
                  <p style={{fontWeight:800,fontSize:18,color:C.text}}>{user.name}</p>
                  <p style={{fontSize:13,color:C.muted}}>{user.email}</p>
                  <p style={{fontSize:12,color:C.muted}}>{user.phone}</p>
                </div>
              </div>
              <div style={{padding:"10px 12px",background:C.surface,borderRadius:8,border:"1px solid "+C.border}}>
                <p style={{fontSize:11,color:C.muted,marginBottom:3}}>Plan activo</p>
                <p style={{fontSize:13,color:C.text}}>Plan <span style={{color:PLAN_COLORS[user.plan],fontWeight:700}}>{user.plan.toUpperCase()}</span> · Trial hasta {user.trial_end}</p>
              </div>
            </GCard>
            <Btn full outline onClick={onLogout} color={C.red}>Cerrar sesión</Btn>
          </div>
        )}
      </div>

      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(10,10,15,0.97)",backdropFilter:"blur(20px)",borderTop:"1px solid "+C.border,display:"flex",zIndex:200,boxShadow:"0 -2px 20px rgba(0,0,0,0.5)"}}>
        {([["buscar","🔍","Buscar"],["mensajes","💬","Mensajes"],["perfil","👤","Perfil"]] as const).map(([id,icon,label])=>(
          <button key={id} onClick={()=>setTab(id as any)} style={{flex:1,padding:"10px 4px 12px",background:"none",border:"none",color:tab===id?C.accent:C.muted,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,transition:"color 0.15s"}}>
            <span style={{fontSize:20}}>{icon}</span>
            <span style={{fontSize:10,fontWeight:600}}>{label}</span>
          </button>
        ))}
      </nav>

      {selectedWorker&&<WorkerModal worker={selectedWorker} onClose={()=>setSelectedWorker(null)} onChat={w=>{setSelectedWorker(null);setChatWorker(w);showToast("Chat abierto con "+w.name);}} currentUser={user} />}
      {chatWorker&&<ChatPanel toUser={chatWorker} currentUser={user} onClose={()=>setChatWorker(null)} />}
      <Toast msg={toast} />
    </div>
  );
}

// ─── PRO DASHBOARD ───
function ProDashboard({user,onLogout,onUpdate}:{user:UserRow;onLogout:()=>void;onUpdate:(u:UserRow)=>void}){
  const [tab,setTab]=useState<"inicio"|"perfil"|"stats"|"planes">("inicio");
  const [toast,setToast]=useState<string|null>(null);
  const [bio,setBio]=useState(user.bio||"");
  const [price,setPrice]=useState(String(user.price||30));
  const [available,setAvailable]=useState(user.available);
  const [saving,setSaving]=useState(false);
  const [certName,setCertName]=useState("");
  const [certs,setCerts]=useState<CertRow[]>([]);
  const [stats,setStats]=useState({visits:0,contacts:0,reviews:0});
  const daysLeft=trialDaysLeft(user.trial_end);
  const showToast=(m:string)=>{setToast(m);setTimeout(()=>setToast(null),3000);};

  useEffect(()=>{
    db.from("certificates").select("*").eq("worker_id",user.id).then(({data})=>setCerts(data||[]));
    db.from("visits").select("id",{count:"exact"}).eq("user_id",user.id).then(({count})=>setStats(s=>({...s,visits:count||0})));
    db.from("messages").select("id",{count:"exact"}).eq("to_id",user.id).then(({count})=>setStats(s=>({...s,contacts:count||0})));
    db.from("reviews").select("id",{count:"exact"}).eq("worker_id",user.id).then(({count})=>setStats(s=>({...s,reviews:count||0})));
  },[user.id]);

  const saveProfile=async()=>{
    setSaving(true);
    const upd={bio,price:parseInt(price)||30,available};
    await db.from("users").update(upd).eq("id",user.id);
    onUpdate({...user,...upd});
    setSaving(false); showToast("✓ Perfil actualizado");
  };

  const toggleAvailable=async()=>{
    const newVal=!available; setAvailable(newVal);
    await db.from("users").update({available:newVal}).eq("id",user.id);
    onUpdate({...user,available:newVal});
  };

  const addCert=async()=>{
    if(!certName.trim()) return;
    const {data}=await db.from("certificates").insert({worker_id:user.id,name:certName,url:"",verified:false}).select().single();
    if(data){setCerts(p=>[...p,data]);setCertName("");showToast("✓ Título añadido");}
  };

  const canAccess=(feat:string)=>PLAN_FEATURES[user.plan].some(f=>f.toLowerCase().includes(feat.toLowerCase()));

  return (
    <div style={{minHeight:"100dvh",background:C.bg,backgroundImage:"radial-gradient(ellipse at 70% 0%,#2a0a3a22,transparent 55%)",paddingBottom:80}}>
      <header style={{background:"rgba(10,10,15,0.92)",backdropFilter:"blur(20px)",borderBottom:"1px solid "+C.border,position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:900,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,"+C.accent+","+C.accentOrange+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🔨</div>
            <span style={{fontWeight:900,fontSize:20,letterSpacing:"-0.02em"}}><span style={{color:C.text}}>Oficio</span><span style={{color:C.accent}}>Ya</span></span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <PlanBadge plan={user.plan} />
            <button onClick={onLogout} style={{background:"none",border:"1px solid "+C.border,borderRadius:6,color:C.muted,cursor:"pointer",padding:"4px 10px",fontSize:11}}>Salir</button>
          </div>
        </div>
      </header>

      {daysLeft<=30&&(
        <div style={{background:"linear-gradient(135deg,"+C.accent+"18,"+C.accentOrange+"11)",borderBottom:"1px solid "+C.accent+"22",padding:"8px 16px",textAlign:"center"}}>
          <p style={{fontSize:12,color:C.accent,fontWeight:700}}>
            {daysLeft>0?"⏱ "+daysLeft+" días de trial restantes · Activa un plan para mantener tu perfil visible":"⚠ Tu trial expiró · Activa un plan para seguir visible"}
          </p>
        </div>
      )}

      <div style={{maxWidth:900,margin:"0 auto",padding:"0 16px"}}>

        {tab==="inicio"&&(
          <div style={{padding:"24px 0"}}>
            <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:22}}>
              <Ava s={user.name.substring(0,2).toUpperCase()} size={54} color={C.accent} />
              <div>
                <p style={{fontWeight:800,fontSize:20,color:C.text,letterSpacing:"-0.02em"}}>{user.name}</p>
                <p style={{fontSize:13,color:C.accent,fontWeight:600}}>{OFICIO_ICONS[user.trade||""]||"🔧"} {user.trade} · {user.zone}</p>
                <div style={{display:"flex",gap:8,alignItems:"center",marginTop:5}}>
                  <span style={{width:6,height:6,borderRadius:"50%",background:available?C.green:C.red,display:"inline-block",boxShadow:available?"0 0 6px "+C.green:""}} />
                  <span style={{fontSize:11,color:available?C.green:C.red,fontWeight:600}}>{available?"Disponible":"No disponible"}</span>
                  <button onClick={toggleAvailable} style={{background:"none",border:"1px solid "+C.border,borderRadius:6,color:C.muted,cursor:"pointer",padding:"2px 8px",fontSize:10}}>Cambiar</button>
                </div>
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:18}}>
              {[{l:"Visitas al perfil",v:String(stats.visits),c:C.blue,i:"👁"},{l:"Contactos recibidos",v:String(stats.contacts),c:C.green,i:"💬"},{l:"Reseñas",v:String(stats.reviews),c:C.accent,i:"⭐"},{l:"Días de trial",v:String(daysLeft),c:daysLeft>7?C.mutedLight:C.red,i:"⏱"}].map(s=>(
                <GCard key={s.l} style={{textAlign:"center",padding:"16px 10px"}}>
                  <div style={{fontSize:20,marginBottom:5}}>{s.i}</div>
                  <p style={{fontWeight:800,fontSize:26,color:s.c}}>{s.v}</p>
                  <p style={{fontSize:11,color:C.muted}}>{s.l}</p>
                </GCard>
              ))}
            </div>

            <GCard style={{marginBottom:14}}>
              <p style={{fontWeight:700,color:C.text,fontSize:14,marginBottom:12}}>Funcionalidades de tu plan</p>
              {[{feat:"Chat directo",icon:"💬",key:"chat"},{feat:"Estadísticas",icon:"📊",key:"estadísticas"},{feat:"Galería de fotos",icon:"📸",key:"galería"},{feat:"Ranking público",icon:"🏆",key:"ranking"},{feat:"Primero en búsquedas",icon:"🔝",key:"primero"}].map(({feat,icon,key})=>{
                const has=canAccess(key);
                return (
                  <div key={feat} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid "+C.border}}>
                    <span style={{fontSize:15}}>{icon}</span>
                    <span style={{flex:1,fontSize:13,color:has?C.text:C.muted}}>{feat}</span>
                    {has?<span style={{color:C.green,fontSize:12,fontWeight:700}}>✓ Activo</span>:<button onClick={()=>setTab("planes")} style={{background:"none",border:"1px solid "+C.accent+"44",borderRadius:6,color:C.accent,cursor:"pointer",padding:"3px 8px",fontSize:10,fontWeight:700}}>Activar →</button>}
                  </div>
                );
              })}
            </GCard>
            <Btn full onClick={()=>setTab("planes")} color={C.accent}>Mejorar mi plan →</Btn>
          </div>
        )}

        {tab==="perfil"&&(
          <div style={{padding:"24px 0"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <p style={{fontWeight:800,fontSize:24,color:C.text,letterSpacing:"-0.02em"}}>Mi perfil</p>
              <Btn small onClick={saveProfile} disabled={saving}>{saving?"Guardando...":"Guardar cambios"}</Btn>
            </div>
            <GCard style={{marginBottom:14}}>
              <p style={{fontWeight:700,color:C.text,fontSize:13,marginBottom:12}}>Información pública</p>
              <div style={{marginBottom:12}}>
                <p style={{fontSize:11,color:C.muted,textTransform:"uppercase" as const,letterSpacing:"0.08em",marginBottom:5,fontWeight:700}}>Descripción profesional</p>
                <textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="Describe tu experiencia, especialidades y servicios..." style={{width:"100%",background:C.surface,border:"1px solid "+C.border,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:13,padding:"10px",resize:"vertical",minHeight:90,outline:"none"}} />
              </div>
              <Inp label="Precio por hora (€)" value={price} onChange={setPrice} type="number" />
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0"}}>
                <span style={{fontSize:13,color:C.text,flex:1}}>Disponibilidad</span>
                <button onClick={()=>setAvailable(!available)} style={{width:44,height:24,borderRadius:99,background:available?C.green:C.border,border:"none",cursor:"pointer",position:"relative",transition:"background 0.2s"}}>
                  <div style={{width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:available?23:3,transition:"left 0.2s"}} />
                </button>
                <span style={{fontSize:12,color:available?C.green:C.muted,fontWeight:600}}>{available?"Disponible":"Ocupado"}</span>
              </div>
            </GCard>

            <GCard>
              <p style={{fontWeight:700,color:C.text,fontSize:13,marginBottom:12}}>Mis títulos y certificados</p>
              <div style={{display:"flex",gap:8,marginBottom:14}}>
                <input value={certName} onChange={e=>setCertName(e.target.value)} placeholder="Nombre del título o certificado..." style={{flex:1,background:C.surface,border:"1px solid "+C.border,borderRadius:8,padding:"9px 12px",color:C.text,fontFamily:"inherit",fontSize:13,outline:"none"}} />
                <Btn small onClick={addCert}>Añadir</Btn>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {certs.map(c=>(
                  <div key={c.id} style={{display:"flex",gap:10,alignItems:"center",padding:"10px 12px",background:C.surface,borderRadius:8,border:"1px solid "+C.border}}>
                    <span style={{fontSize:20}}>📜</span>
                    <span style={{flex:1,fontSize:13,color:C.text}}>{c.name}</span>
                    {c.verified&&<span style={{fontSize:10,color:C.green}}>✓ Verificado</span>}
                  </div>
                ))}
                {certs.length===0&&<p style={{fontSize:12,color:C.muted,textAlign:"center",padding:12}}>Añade tus títulos para generar más confianza</p>}
              </div>
            </GCard>
          </div>
        )}

        {tab==="stats"&&(
          <div style={{padding:"24px 0"}}>
            <p style={{fontWeight:800,fontSize:24,color:C.text,marginBottom:18,letterSpacing:"-0.02em"}}>Estadísticas</p>
            {!canAccess("estadísticas")?(
              <GCard style={{textAlign:"center",padding:"40px 20px"}}>
                <p style={{fontSize:36,marginBottom:10}}>📊</p>
                <p style={{fontWeight:700,color:C.text,fontSize:18,marginBottom:8}}>Disponible en plan Básico+</p>
                <p style={{fontSize:13,color:C.muted,marginBottom:20}}>Accede a estadísticas completas de visitas, contactos y conversiones</p>
                <Btn onClick={()=>setTab("planes")} color={C.accent}>Ver planes →</Btn>
              </GCard>
            ):(
              <>
                <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:18}}>
                  {[{l:"Visitas perfil",v:String(stats.visits),c:C.blue,t:"+12%"},{l:"Contactos",v:String(stats.contacts),c:C.green,t:"+8%"},{l:"Reseñas",v:String(stats.reviews),c:C.accent,t:"+3"},{l:"Ingresos est.",v:(stats.contacts*(user.price||30)*2)+"€",c:C.accentOrange,t:"+15%"}].map(s=>(
                    <GCard key={s.l} style={{textAlign:"center",padding:"16px 10px"}}>
                      <p style={{fontWeight:800,fontSize:24,color:s.c,marginBottom:3}}>{s.v}</p>
                      <p style={{fontSize:10,color:C.muted,marginBottom:6}}>{s.l}</p>
                      <span style={{fontSize:10,color:C.green,background:C.green+"15",padding:"2px 7px",borderRadius:99}}>{s.t}</span>
                    </GCard>
                  ))}
                </div>
                <GCard>
                  <p style={{fontWeight:700,color:C.text,fontSize:14,marginBottom:12}}>Actividad reciente</p>
                  {["Nuevo contacto recibido","Reseña publicada en tu perfil","Tu perfil fue visto 8 veces","Apareces en búsquedas de tu zona"].map((a,i)=>(
                    <div key={i} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:i<3?"1px solid "+C.border:"none",alignItems:"center"}}>
                      <span style={{fontSize:14}}>{"💬⭐👁🔍"[i]}</span>
                      <span style={{fontSize:13,color:C.mutedLight}}>{a}</span>
                    </div>
                  ))}
                </GCard>
              </>
            )}
          </div>
        )}

        {tab==="planes"&&(
          <div style={{padding:"24px 0"}}>
            <div style={{textAlign:"center",marginBottom:22}}>
              <p style={{fontWeight:900,fontSize:32,letterSpacing:"-0.03em",color:C.text,marginBottom:6}}>Elige tu <span style={{color:C.accent}}>plan</span></p>
              <p style={{fontSize:13,color:C.muted}}>30 días gratis · Sin tarjeta · Cancela cuando quieras</p>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {(["gratis","basico","pro","elite"] as Plan[]).map(pl=>{
                const col=PLAN_COLORS[pl]; const isCurrent=user.plan===pl;
                return (
                  <div key={pl} style={{background:pl==="pro"?"linear-gradient(160deg,#1a1a2e,#0d0d1a)":"linear-gradient(160deg,"+C.card+",#080812)",borderRadius:14,border:(isCurrent?"2px":"1px")+" solid "+(isCurrent?col+"AA":pl==="pro"?col+"55":C.border),padding:"18px",position:"relative",boxShadow:pl==="pro"?"0 0 30px "+col+"18":"none"}}>
                    {pl==="pro"&&!isCurrent&&<div style={{position:"absolute",top:-11,right:14,background:"linear-gradient(135deg,"+C.accent+","+C.accentOrange+")",color:"#000",borderRadius:99,padding:"2px 10px",fontSize:9,fontWeight:900}}>MÁS POPULAR</div>}
                    {isCurrent&&<div style={{position:"absolute",top:-11,left:14,background:col,color:"#000",borderRadius:99,padding:"2px 10px",fontSize:9,fontWeight:900}}>✓ PLAN ACTUAL</div>}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <span style={{fontWeight:800,fontSize:18,color:col}}>{pl.toUpperCase()}</span>
                      <span style={{fontWeight:800,fontSize:22,color:C.text}}>{PLAN_PRICES[pl]===0?"GRATIS":PLAN_PRICES[pl]+"€/mes"}</span>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:14}}>
                      {PLAN_FEATURES[pl].map(f=><span key={f} style={{fontSize:11,color:C.mutedLight,background:C.surface,padding:"3px 8px",borderRadius:99,border:"1px solid "+C.border}}>✓ {f}</span>)}
                    </div>
                    {!isCurrent&&<button onClick={()=>showToast("🚀 Redirigiendo a pago... (modo demo)")} style={{width:"100%",padding:"11px",background:pl==="pro"?"linear-gradient(135deg,"+col+","+C.accentOrange+")":"transparent",border:"1px solid "+col+"66",borderRadius:8,color:pl==="pro"?"#000":col,fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer"}}>
                      {pl==="gratis"?"Volver a gratuito":"Activar "+pl.toUpperCase()+" →"}
                    </button>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(10,10,15,0.97)",backdropFilter:"blur(20px)",borderTop:"1px solid "+C.border,display:"flex",zIndex:200}}>
        {([["inicio","🏠","Inicio"],["perfil","👤","Perfil"],["stats","📊","Stats"],["planes","💎","Planes"]] as const).map(([id,icon,label])=>(
          <button key={id} onClick={()=>setTab(id as any)} style={{flex:1,padding:"10px 4px 12px",background:"none",border:"none",color:tab===id?C.accent:C.muted,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,transition:"color 0.15s"}}>
            <span style={{fontSize:20}}>{icon}</span>
            <span style={{fontSize:10,fontWeight:600}}>{label}</span>
          </button>
        ))}
      </nav>
      <Toast msg={toast} />
    </div>
  );
}

// ─── ADMIN DASHBOARD ───
function AdminDashboard({onLogout}:{onLogout:()=>void}){
  const [tab,setTab]=useState<"overview"|"users"|"messages">("overview");
  const [users,setUsers]=useState<UserRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [stats,setStats]=useState({total:0,pros:0,clients:0,reviews:0,messages:0});

  useEffect(()=>{
    const load=async()=>{
      const {data:us}=await db.from("users").select("*").order("joined_at",{ascending:false});
      const {count:rv}=await db.from("reviews").select("id",{count:"exact"});
      const {count:mg}=await db.from("messages").select("id",{count:"exact"});
      const all=us||[];
      setUsers(all);
      setStats({total:all.length,pros:all.filter(u=>u.type==="profesional").length,clients:all.filter(u=>u.type==="cliente").length,reviews:rv||0,messages:mg||0});
      setLoading(false);
    };
    load();
  },[]);

  return (
    <div style={{minHeight:"100dvh",background:C.bg,paddingBottom:80}}>
      <header style={{background:"rgba(10,10,15,0.95)",backdropFilter:"blur(20px)",borderBottom:"1px solid "+C.accent+"33",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1000,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontWeight:900,fontSize:18,color:C.accent}}>⚙ ADMIN</span>
            <span style={{fontWeight:900,fontSize:18,color:C.text}}>OfficioYa</span>
          </div>
          <button onClick={onLogout} style={{background:"none",border:"1px solid "+C.border,borderRadius:6,color:C.muted,cursor:"pointer",padding:"4px 10px",fontSize:11}}>Salir</button>
        </div>
      </header>

      <div style={{maxWidth:1000,margin:"0 auto",padding:"20px 16px"}}>
        {loading?<Spinner />:(
          <>
            {tab==="overview"&&(
              <>
                <p style={{fontWeight:800,fontSize:22,color:C.text,marginBottom:16}}>Panel de control</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10,marginBottom:20}}>
                  {[{l:"Usuarios totales",v:stats.total,c:C.blue,i:"👥"},{l:"Profesionales",v:stats.pros,c:C.accent,i:"🔨"},{l:"Clientes",v:stats.clients,c:C.green,i:"🏠"},{l:"Reseñas",v:stats.reviews,c:C.purple,i:"⭐"},{l:"Mensajes",v:stats.messages,c:C.accentOrange,i:"💬"}].map(s=>(
                    <GCard key={s.l} style={{textAlign:"center",padding:"14px 10px"}}>
                      <div style={{fontSize:22,marginBottom:5}}>{s.i}</div>
                      <p style={{fontWeight:800,fontSize:24,color:s.c}}>{s.v}</p>
                      <p style={{fontSize:10,color:C.muted}}>{s.l}</p>
                    </GCard>
                  ))}
                </div>
                <GCard style={{marginBottom:14}}>
                  <p style={{fontWeight:700,color:C.text,fontSize:14,marginBottom:12}}>MRR estimado</p>
                  {(["gratis","basico","pro","elite"] as Plan[]).map(pl=>{
                    const count=users.filter(u=>u.plan===pl&&u.type==="profesional").length;
                    const mrr=count*PLAN_PRICES[pl];
                    return (
                      <div key={pl} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid "+C.border}}>
                        <PlanBadge plan={pl} />
                        <span style={{flex:1,fontSize:13,color:C.mutedLight}}>{count} profesionales</span>
                        <span style={{fontWeight:700,fontSize:14,color:PLAN_COLORS[pl]}}>{mrr.toFixed(0)}€/mes</span>
                      </div>
                    );
                  })}
                  <div style={{display:"flex",justifyContent:"space-between",paddingTop:10,marginTop:4}}>
                    <span style={{fontWeight:700,color:C.text}}>TOTAL MRR</span>
                    <span style={{fontWeight:800,fontSize:18,color:C.accent}}>{users.filter(u=>u.type==="profesional").reduce((s,u)=>s+PLAN_PRICES[u.plan as Plan],0).toFixed(2)}€/mes</span>
                  </div>
                </GCard>
              </>
            )}

            {tab==="users"&&(
              <>
                <p style={{fontWeight:800,fontSize:22,color:C.text,marginBottom:16}}>Usuarios registrados</p>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {users.filter(u=>u.type!=="admin").map(u=>(
                    <GCard key={u.id} style={{padding:"12px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                        <Ava s={u.name.substring(0,2).toUpperCase()} size={38} color={u.type==="profesional"?C.accent:C.blue} />
                        <div style={{flex:1,minWidth:120}}>
                          <p style={{fontWeight:700,color:C.text,fontSize:13}}>{u.name}</p>
                          <p style={{fontSize:11,color:C.muted}}>{u.email} · {u.phone}</p>
                        </div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          <span style={{fontSize:10,color:u.type==="profesional"?C.accent:C.blue,background:(u.type==="profesional"?C.accent:C.blue)+"22",padding:"2px 7px",borderRadius:4,fontWeight:700}}>{u.type.toUpperCase()}</span>
                          <PlanBadge plan={u.plan as Plan} />
                          {u.trade&&<span style={{fontSize:10,color:C.mutedLight,background:C.surface,padding:"2px 7px",borderRadius:4,border:"1px solid "+C.border}}>{u.trade}</span>}
                        </div>
                        <span style={{fontSize:10,color:C.muted}}>{new Date(u.joined_at).toLocaleDateString("es-ES")}</span>
                      </div>
                    </GCard>
                  ))}
                </div>
              </>
            )}

            {tab==="messages"&&(
              <div>
                <p style={{fontWeight:800,fontSize:22,color:C.text,marginBottom:16}}>Comunicaciones</p>
                <GCard style={{textAlign:"center",padding:"40px 20px"}}>
                  <p style={{fontSize:36,marginBottom:10}}>💬</p>
                  <p style={{fontWeight:700,color:C.text,fontSize:16,marginBottom:6}}>Total mensajes: {stats.messages}</p>
                  <p style={{fontSize:13,color:C.muted}}>El detalle de conversaciones está disponible en la base de datos de Supabase</p>
                </GCard>
              </div>
            )}
          </>
        )}
      </div>

      <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(10,10,15,0.97)",backdropFilter:"blur(20px)",borderTop:"1px solid "+C.accent+"33",display:"flex",zIndex:200}}>
        {([["overview","📊","Overview"],["users","👥","Usuarios"],["messages","💬","Mensajes"]] as const).map(([id,icon,label])=>(
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
    const saved=localStorage.getItem("oy_user");
    if(saved){try{setUser(JSON.parse(saved));}catch{}}
    setReady(true);
    // Track visit
    db.from("visits").insert({page:"home",user_id:null}).then(()=>{});
  },[]);

  const handleLogin=(u:UserRow)=>{setUser(u);localStorage.setItem("oy_user",JSON.stringify(u));};
  const handleLogout=()=>{setUser(null);localStorage.removeItem("oy_user");};
  const handleUpdate=(u:UserRow)=>{setUser(u);localStorage.setItem("oy_user",JSON.stringify(u));};

  if(!ready) return <div style={{minHeight:"100dvh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner /></div>;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html{overflow-x:hidden;background:#0A0A0F;}
        body{background:#0A0A0F;color:#F0F0F8;font-family:'DM Sans',sans-serif;overflow-x:hidden;min-height:100dvh;}
        #root{min-height:100dvh;background:#0A0A0F;}
        input,textarea,select{box-sizing:border-box;}
        input::placeholder,textarea::placeholder{color:#44445A;}
        select option{background:#16161F;color:#F0F0F8;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#1E1E2E;border-radius:99px;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
        @keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-4px);}}
      `}</style>
      {!user && <AuthScreen onLogin={handleLogin} />}
      {user && user.type==="admin" && <AdminDashboard onLogout={handleLogout} />}
      {user && user.type==="profesional" && <ProDashboard user={user} onLogout={handleLogout} onUpdate={handleUpdate} />}
      {user && user.type==="cliente" && <ClientHome user={user} onLogout={handleLogout} />}
    </>
  );
}
