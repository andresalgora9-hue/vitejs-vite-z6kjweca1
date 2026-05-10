import { useState } from "react";

const C = {
  bg: "#080810",
  surface: "#0F0F1A",
  card: "#13131F",
  cardHover: "#18182A",
  border: "#1E1E35",
  borderHover: "#FFD700",
  accent: "#FFD700",
  accentDim: "#1A1400",
  accentGlow: "#FFD70020",
  red: "#FF3B3B",
  green: "#00E87A",
  blue: "#4B9EFF",
  purple: "#9B5FFF",
  text: "#EEEEFF",
  muted: "#44445A",
  mutedLight: "#7777AA",
  gold: "#FFD700",
};

const ZONAS = ["Toda España","Madrid","Barcelona","Valencia","Sevilla","Málaga","Bilbao","Zaragoza","Alicante","Granada"];
const OFICIOS = ["Todos","Electricista","Fontanero","Pintor","Albañil","Carpintero","Cerrajero","Jardinero"];

type Review = { user: string; stars: number; text: string; date: string; photo: string };
type Worker = {
  id: number; name: string; trade: string; zone: string; rating: number; reviews: number;
  available: boolean; verified: boolean; elite: boolean; price: number; bio: string;
  img: string; cat: string; jobs: number; badge: string; reviewList: Review[];
};

const WORKERS: Worker[] = [
  { id:1, name:"Marcos Herrera", trade:"Electricista", zone:"Madrid", rating:4.9, reviews:127, available:true, verified:true, elite:true, price:35, bio:"12 años instalando el futuro. Domótica, fotovoltaica y cuadros eléctricos.", img:"MH", cat:"Electricista", jobs:312, badge:"Top Madrid", reviewList:[{user:"Carmen R.",stars:5,text:"Llegó en 20 min, solucionó todo. 10/10",date:"hace 2 días",photo:""},{user:"Alberto M.",stars:5,text:"Profesional total. Precio justo.",date:"hace 1 semana",photo:""}] },
  { id:2, name:"Lucía Fernández", trade:"Fontanera", zone:"Barcelona", rating:4.8, reviews:89, available:true, verified:true, elite:true, price:30, bio:"Tuberías, calderas y calefacción. Urgencias 24h.", img:"LF", cat:"Fontanero", jobs:201, badge:"Top Barcelona", reviewList:[{user:"Jordi S.",stars:5,text:"Vino un domingo a las 10pm. Increíble.",date:"hace 3 días",photo:""},{user:"Maria T.",stars:5,text:"La mejor fontanera. Ya la tengo guardada.",date:"hace 5 días",photo:""}] },
  { id:3, name:"Roberto Sanz", trade:"Pintor", zone:"Valencia", rating:4.7, reviews:63, available:false, verified:true, elite:false, price:22, bio:"Pintura interior y exterior. Microcemento y acabados decorativos.", img:"RS", cat:"Pintor", jobs:145, badge:"", reviewList:[{user:"Ana V.",stars:5,text:"El piso quedó como nuevo.",date:"hace 1 semana",photo:""}] },
  { id:4, name:"Ana García", trade:"Albañila", zone:"Sevilla", rating:5.0, reviews:41, available:true, verified:true, elite:true, price:28, bio:"Reformas integrales y revestimientos cerámicos. 15 años en obra.", img:"AG", cat:"Albañil", jobs:98, badge:"Puntuación perfecta", reviewList:[{user:"Miguel F.",stars:5,text:"5 estrellas se quedan cortas.",date:"hace 4 días",photo:""}] },
  { id:5, name:"Javier Moreno", trade:"Carpintero", zone:"Málaga", rating:4.6, reviews:55, available:true, verified:false, elite:false, price:32, bio:"Muebles a medida, puertas y tarimas. Madera maciza y sostenible.", img:"JM", cat:"Carpintero", jobs:134, badge:"", reviewList:[{user:"Laura C.",stars:5,text:"Me hizo una cocina que es una obra de arte.",date:"hace 3 días",photo:""}] },
  { id:6, name:"Elena Ruiz", trade:"Cerrajera", zone:"Zaragoza", rating:4.9, reviews:78, available:true, verified:true, elite:false, price:40, bio:"Apertura de emergencia 24h. Cajas fuertes y cerraduras de seguridad.", img:"ER", cat:"Cerrajero", jobs:267, badge:"24h Urgencias", reviewList:[{user:"Tomás A.",stars:5,text:"Me abrió la puerta a las 3am. Un ángel.",date:"hace 1 semana",photo:""}] },
  { id:7, name:"Carlos Díaz", trade:"Jardinero", zone:"Bilbao", rating:4.5, reviews:32, available:false, verified:true, elite:false, price:18, bio:"Diseño y mantenimiento de jardines. Riego automático.", img:"CD", cat:"Jardinero", jobs:87, badge:"", reviewList:[{user:"Amaia Z.",stars:5,text:"Transformó mi jardín en un paraíso.",date:"hace 3 semanas",photo:""}] },
  { id:8, name:"Isabel López", trade:"Electricista", zone:"Alicante", rating:4.8, reviews:94, available:true, verified:true, elite:false, price:33, bio:"Certificada en baja tensión. Placas solares y aerotermia.", img:"IL", cat:"Electricista", jobs:220, badge:"Experta Solar", reviewList:[{user:"Paco M.",stars:5,text:"Instaló 10 placas solares en un día.",date:"hace 5 días",photo:""}] },
];

const CHAT_INIT: Record<number, {from:string;text:string;time:string}[]> = {
  1:[{from:"pro",text:"¡Hola! ¿En qué puedo ayudarte?",time:"10:00"}],
  2:[{from:"pro",text:"Buenos días, ¿cuándo necesitas el servicio?",time:"09:30"}],
};

function Stars({ n, size=13 }: { n:number; size?:number }) {
  return <span style={{fontSize:size,color:C.accent,letterSpacing:1}}>{"★".repeat(Math.round(n))}{"☆".repeat(5-Math.round(n))}</span>;
}

function Ava({ s, size=44, elite=false, color=C.purple }: { s:string; size?:number; elite?:boolean; color?:string }) {
  return (
    <div style={{position:"relative",flexShrink:0}}>
      <div style={{
        width:size, height:size, borderRadius:"50%",
        background:`linear-gradient(135deg, ${color + '55'}, ${color + '22'})`,
        display:"flex", alignItems:"center", justifyContent:"center",
        color:C.accent, fontWeight:900, fontSize:size*0.36,
        fontFamily:"'Bebas Neue',sans-serif",
        border:`2px solid ${elite ? C.accent : color}55`,
        boxShadow:`0 0 ${elite?20:10}px ${elite?C.accent:color}30`,
      }}>{s}</div>
      {elite && (
        <div style={{position:"absolute",bottom:-2,right:-2,width:16,height:16,borderRadius:"50%",background:C.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#000",boxShadow:`0 0 8px ${C.accent + '80'}`}}>★</div>
      )}
    </div>
  );
}

function Tag({ children, color=C.accent }: { children:React.ReactNode; color?:string }) {
  return (
    <span style={{padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color,background:`${color + '22'}`,border:`1px solid ${color + '44'}`,boxShadow:`0 0 8px ${color + '22'}`}}>
      {children}
    </span>
  );
}

function GlassCard({ children, style={}, onClick, hoverGlow=C.accent }: { children:React.ReactNode; style?:React.CSSProperties; onClick?:()=>void; hoverGlow?:string }) {
  const [hov,setHov] = useState(false);
  return (
    <div
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
      onClick={onClick}
      style={{
        background: hov ? `linear-gradient(135deg, ${C.cardHover}, #12122A)` : `linear-gradient(135deg, ${C.card}, #0E0E1E)`,
        borderRadius:14,
        border:`1px solid ${hov ? hoverGlow+"60" : C.border}`,
        backdropFilter:"blur(20px)",
        boxShadow: hov
          ? `0 8px 32px ${hoverGlow}20, inset 0 1px 0 ${hoverGlow}15`
          : `0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)`,
        transition:"all 0.25s ease",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function WorkerCard({ w, onClick }: { w:Worker; onClick:()=>void }) {
  const colors = [C.purple, C.blue, "#FF6B9D", "#00D4AA", "#FF9640"];
  const color = colors[w.id % colors.length];
  return (
    <GlassCard onClick={onClick} hoverGlow={color} style={{padding:20,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-30,right:-30,width:100,height:100,borderRadius:"50%",background:`radial-gradient(circle, ${color + '22'}, transparent 70%)`,pointerEvents:"none"}} />
      {w.elite && <div style={{marginBottom:10}}><Tag color={C.accent}>⭐ ÉLITE</Tag></div>}
      <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:12}}>
        <Ava s={w.img} size={50} elite={w.elite} color={color} />
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
            <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:17,color:C.text,letterSpacing:"0.04em"}}>{w.name}</p>
            {w.verified && <span style={{fontSize:11,color:C.green,textShadow:`0 0 8px ${C.green + '80'}`}}>✓</span>}
          </div>
          <p style={{fontSize:12,color:color,fontWeight:700,marginBottom:2}}>{w.trade}</p>
          <p style={{fontSize:11,color:C.muted}}>📍 {w.zone}</p>
        </div>
      </div>
      <p style={{fontSize:12,color:C.mutedLight,marginBottom:10,lineHeight:1.6}}>{w.bio}</p>
      {w.badge && <div style={{marginBottom:10}}><Tag color={C.blue}>{w.badge}</Tag></div>}
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        <Stars n={w.rating} />
        <span style={{fontSize:12,color:C.text,fontWeight:700}}>{w.rating}</span>
        <span style={{fontSize:11,color:C.muted}}>({w.reviews}) · {w.jobs} trabajos</span>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:10,borderTop:`1px solid ${C.border}`}}>
        <div>
          <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:C.accent,textShadow:`0 0 20px ${C.accent + '99'}`}}>{w.price}€</span>
          <span style={{fontSize:11,color:C.muted}}>/h</span>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:w.available?C.green:C.red,display:"inline-block",boxShadow:w.available?`0 0 8px ${C.green}`:""}} />
          <span style={{fontSize:11,color:w.available?C.green:C.red,fontWeight:700}}>{w.available?"Disponible":"Ocupado"}</span>
        </div>
      </div>
    </GlassCard>
  );
}

function DetailModal({ w, onClose, onChat }: { w:Worker|null; onClose:()=>void; onChat:(w:Worker)=>void }) {
  const [tab,setTab] = useState<"info"|"reviews"|"fotos">("info");
  const [revs,setRevs] = useState<Review[]>([]);
  const [newRev,setNewRev] = useState("");
  const [selStars,setSelStars] = useState(5);
  const [emoji,setEmoji] = useState("");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  if(!w) return null;

  const color = [C.purple,C.blue,"#FF6B9D","#00D4AA","#FF9640"][w.id%5];

  const submitReview = () => {
    if(!newRev.trim()) return;
    setRevs(p=>[{user:"Tú",stars:selStars,text:newRev,date:"ahora mismo",photo:emoji},...p]);
    setNewRev(""); setEmoji("");
  };

  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(4,4,12,0.92)",backdropFilter:"blur(20px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:`linear-gradient(160deg, #0F0F20, #080812)`,
        borderRadius:20, maxWidth:560, width:"100%", maxHeight:"90vh", overflowY:"auto",
        border:`1px solid ${color + '66'}`,
        boxShadow:`0 0 60px ${color + '66'}, 0 40px 80px rgba(0,0,0,0.6), inset 0 1px 0 ${color + '33'}`,
      }}>
        <div style={{padding:"24px 24px 16px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:16}}>
            <Ava s={w.img} size={68} elite={w.elite} color={color} />
            <div style={{flex:1}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:C.text}}>{w.name}</p>
                {w.verified && <Tag color={C.green}>✓ Verificado</Tag>}
                {w.elite && <Tag color={C.accent}>⭐ Élite</Tag>}
              </div>
              <p style={{color,fontWeight:700,marginBottom:4,fontSize:13}}>{w.trade} · {w.zone}</p>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <Stars n={w.rating} /><span style={{fontSize:13,color:C.text,fontWeight:700}}>{w.rating}</span>
                <span style={{fontSize:12,color:C.muted}}>({w.reviews} reseñas)</span>
              </div>
            </div>
            <button onClick={onClose} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,cursor:"pointer",padding:"6px 10px",fontSize:16}}>✕</button>
          </div>
          <div style={{display:"flex",gap:6}}>
            {(["info","reviews","fotos"] as const).map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"8px",borderRadius:8,border:`1px solid ${tab===t?color:C.border}`,background:tab===t?`${color + '33'}`:"transparent",color:tab===t?color:C.muted,fontFamily:"inherit",fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.08em",boxShadow:tab===t?`0 0 12px ${color + '44'}`:"none",transition:"all 0.15s"}}>
                {t==="info"?"ℹ Info":t==="reviews"?("★ Reseñas (" + revs.length + ")") :"📸 Fotos"}
              </button>
            ))}
          </div>
        </div>
        <div style={{padding:24}}>
          {tab==="info" && (
            <>
              <p style={{fontSize:14,color:C.mutedLight,lineHeight:1.7,marginBottom:20}}>{w.bio}</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
                {[{l:"Trabajos",v:String(w.jobs)},{l:"Precio/h",v:w.price+' euros'},{l:"Rating",v:String(w.rating)}].map(s=>(
                  <div key={s.l} style={{background:`linear-gradient(135deg,${color + '22'},transparent)`,borderRadius:10,padding:"14px",textAlign:"center",border:`1px solid ${color + '44'}`,boxShadow:`0 0 20px ${color + '18'}`}}>
                    <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:color,textShadow:`0 0 20px ${color + '90'}`}}>{s.v}</p>
                    <p style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em"}}>{s.l}</p>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>onChat(w)} style={{flex:1,padding:"13px",background:`linear-gradient(135deg,${C.accent},#FFA500)`,border:"none",borderRadius:10,color:"#000",fontFamily:"'Bebas Neue',sans-serif",fontSize:16,cursor:"pointer",letterSpacing:"0.05em",boxShadow:`0 4px 20px ${C.accent + '66'}`}}>💬 MENSAJE</button>
                <button style={{flex:1,padding:"13px",background:`${C.green + '15'}`,border:`1px solid ${C.green + '50'}`,borderRadius:10,color:C.green,fontFamily:"'Bebas Neue',sans-serif",fontSize:16,cursor:"pointer",letterSpacing:"0.05em",boxShadow:`0 4px 20px ${C.green + '33'}`}}>📞 TELÉFONO</button>
              </div>
            </>
          )}
          {tab==="reviews" && (
            <>
              <div style={{background:`linear-gradient(135deg,${C.card},#0A0A18)`,borderRadius:12,padding:16,marginBottom:20,border:`1px solid ${C.border}`}}>
                <p style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10,fontWeight:700}}>Tu reseña</p>
                <div style={{display:"flex",gap:4,marginBottom:12}}>
                  {[1,2,3,4,5].map(s=>(
                    <button key={s} onClick={()=>setSelStars(s)} style={{background:"none",border:"none",cursor:"pointer",fontSize:22,color:s<=selStars?C.accent:C.border,transition:"all 0.1s",textShadow:s<=selStars?`0 0 10px ${C.accent}`:"none"}}>★</button>
                  ))}
                </div>
                <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                  {["📸","🏠","💧","⚡","🔧","🎨","✅"].map(e=>(
                    <button key={e} onClick={()=>setEmoji(emoji===e?"":e)} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${emoji===e?C.accent:C.border}`,background:emoji===e?`${C.accent + '33'}`:"transparent",cursor:"pointer",fontSize:15,transition:"all 0.15s"}}>{e}</button>
                  ))}
                </div>
                <textarea value={newRev} onChange={e=>setNewRev(e.target.value)} placeholder="Cuéntanos tu experiencia..." style={{width:"100%",background:`${C.surface}`,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontFamily:"inherit",fontSize:13,padding:"10px 12px",resize:"vertical",minHeight:72,outline:"none",marginBottom:10}} />
                <button onClick={submitReview} style={{width:"100%",padding:"10px",background:`linear-gradient(135deg,${C.accent},#FFA500)`,border:"none",borderRadius:8,color:"#000",fontFamily:"'Bebas Neue',sans-serif",fontSize:15,cursor:"pointer",letterSpacing:"0.05em",boxShadow:`0 4px 16px ${C.accent + '66'}`}}>PUBLICAR RESEÑA</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {revs.map((r,i)=>(
                  <div key={i} style={{background:`linear-gradient(135deg,${C.card},#0A0A18)`,borderRadius:10,padding:14,border:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                      <div style={{width:30,height:30,borderRadius:"50%",background:`${color + '44'}`,border:`1px solid ${color + '88'}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color}}>{r.user[0]}</div>
                      <div style={{flex:1}}>
                        <p style={{fontSize:13,fontWeight:700,color:C.text}}>{r.user}</p>
                        <p style={{fontSize:10,color:C.muted}}>{r.date}</p>
                      </div>
                      <Stars n={r.stars} size={11} />
                    </div>
                    {r.photo && <div style={{fontSize:28,marginBottom:8,padding:"6px 10px",background:C.surface,borderRadius:6,display:"inline-block"}}>{r.photo}</div>}
                    <p style={{fontSize:13,color:C.mutedLight,lineHeight:1.6}}>{r.text}</p>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab==="fotos" && (
            <div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
                {["🔌","⚡","🏠","🔧","💡","🛠️","📐","🪚","🔩"].map((e,i)=>(
                  <div key={i} style={{aspectRatio:"1" as any,background:`linear-gradient(135deg,${color + '22'},transparent)`,borderRadius:8,border:`1px solid ${color + '44'}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,cursor:"pointer",transition:"all 0.15s"}}
                    onMouseEnter={ev=>{ev.currentTarget.style.borderColor=color;ev.currentTarget.style.boxShadow=`0 0 20px ${color + '44'}`;}}
                    onMouseLeave={ev=>{ev.currentTarget.style.borderColor=`${color + '44'}`;ev.currentTarget.style.boxShadow="none";}}>{e}</div>
                ))}
              </div>
              <p style={{fontSize:11,color:C.muted,textAlign:"center"}}>Las fotos reales se suben desde el perfil del profesional</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatPanel({ w, onClose }: { w:Worker|null; onClose:()=>void }) {
  const [msgs,setMsgs] = useState<{from:string;text:string;time:string}[]>([]);
  const [input,setInput] = useState("");

  if(w && msgs.length===0) {
    setMsgs(CHAT_INIT[w.id]||[{from:"pro",text:`Hola, soy ${w.name}. ¿En qué puedo ayudarte?`,time:"ahora"}]);
  }

  if(!w) return null;
  const color = [C.purple,C.blue,"#FF6B9D","#00D4AA","#FF9640"][w.id%5];

  const send = () => {
    if(!input.trim()) return;
    const t = new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"});
    setMsgs(p=>[...p,{from:"user",text:input,time:t}]);
    setInput("");
    setTimeout(()=>{
      const rs=[`Puedo estar en ${w.zone} esta semana.`,"¿Me das más detalles?",`Son ${w.price}€/h, materiales aparte.`,"Sin problema, tengo disponibilidad."];
      setMsgs(p=>[...p,{from:"pro",text:rs[Math.floor(Math.random()*rs.length)],time:new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}]);
    },1000);
  };

  return (
    <div style={{position:"fixed",bottom:20,right:20,width:310,height:440,background:`linear-gradient(160deg,#0F0F20,#080812)`,borderRadius:16,border:`1px solid ${color + '88'}`,boxShadow:`0 0 40px ${color + '33'},0 20px 60px rgba(0,0,0,0.6)`,zIndex:300,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10,background:`${color + '18'}`,borderRadius:"16px 16px 0 0"}}>
        <Ava s={w.img} size={34} elite={w.elite} color={color} />
        <div style={{flex:1}}>
          <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,color:C.text}}>{w.name}</p>
          <p style={{fontSize:10,color:C.green,textShadow:`0 0 8px ${C.green}`}}>● En línea</p>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:16}}>✕</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"12px",display:"flex",flexDirection:"column",gap:8}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.from==="user"?"flex-end":"flex-start" as any}}>
            <div style={{maxWidth:"78%",background:m.from==="user"?`${color + '66'}`:`${C.card}`,border:`1px solid ${m.from==="user"?color+"50":C.border}`,borderRadius:m.from==="user"?"12px 12px 2px 12px":"12px 12px 12px 2px",padding:"8px 12px",boxShadow:m.from==="user"?`0 2px 12px ${color + '33'}`:"none"}}>
              <p style={{fontSize:12,color:m.from==="user"?color:C.text,lineHeight:1.5}}>{m.text}</p>
              <p style={{fontSize:9,color:C.muted,marginTop:2,textAlign:"right" as const}}>{m.time}</p>
            </div>
          </div>
        ))}
      </div>
      <div style={{padding:"10px 12px",borderTop:`1px solid ${C.border}`,display:"flex",gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Escribe un mensaje..." style={{flex:1,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 12px",color:C.text,fontFamily:"inherit",fontSize:13,outline:"none"}} />
        <button onClick={send} style={{padding:"8px 14px",background:`linear-gradient(135deg,${C.accent},#FFA500)`,border:"none",borderRadius:8,color:"#000",fontWeight:900,cursor:"pointer",fontSize:14,boxShadow:`0 2px 12px ${C.accent + '88'}`}}>→</button>
      </div>
    </div>
  );
}

function RankingTab({ onSelect }: { onSelect:(w:Worker)=>void }) {
  const sorted = [...WORKERS].sort((a,b)=>b.rating*b.reviews-a.rating*a.reviews);
  const podium = [sorted[1],sorted[0],sorted[2]];
  const pPos=[2,1,3], pH=[130,185,115];
  const pCol=["#C0C0C0",C.accent,"#CD7F32"];
  return (
    <div style={{padding:"40px 0"}}>
      <div style={{textAlign:"center",marginBottom:40}}>
        <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:52,background:`linear-gradient(135deg,${C.accent},#FFA500)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1,letterSpacing:"0.05em"}}>🏆 CAMPEONATO</p>
        <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:C.text,letterSpacing:"0.1em",marginBottom:6}}>MEJORES PROFESIONALES DE ESPAÑA</p>
        <p style={{fontSize:12,color:C.muted}}>Ranking en tiempo real · Basado en reseñas verificadas</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,maxWidth:480,margin:"0 auto 28px",alignItems:"flex-end"}}>
        {podium.map((w,i)=>(
          <div key={w.id} style={{textAlign:"center",cursor:"pointer"}} onClick={()=>onSelect(w)}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:6}}><Ava s={w.img} size={pPos[i]===1?64:48} elite={w.elite} color={pCol[i]} /></div>
            <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:pPos[i]===1?15:13,color:C.text}}>{w.name.split(" ")[0]}</p>
            <p style={{fontSize:10,color:C.muted,marginBottom:4}}>{w.zone}</p>
            <Stars n={w.rating} size={pPos[i]===1?13:10} />
            <div style={{height:pH[i],background:`linear-gradient(180deg,${pCol[i]}20,transparent)`,border:`1px solid ${pCol[i]}60`,borderRadius:"8px 8px 0 0",display:"flex",alignItems:"center",justifyContent:"center",marginTop:8,boxShadow:`0 0 20px ${pCol[i]}20`}}>
              <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:42,color:pCol[i],textShadow:`0 0 20px ${pCol[i]}`}}>#{pPos[i]}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {sorted.slice(3).map((w,i)=>{
          const col=[C.purple,C.blue,"#FF6B9D","#00D4AA","#FF9640"][w.id%5];
          return (
            <GlassCard key={w.id} onClick={()=>onSelect(w)} hoverGlow={col} style={{padding:"12px 18px",display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:C.muted,width:32,textAlign:"center"}}>#{i+4}</span>
              <Ava s={w.img} size={38} elite={w.elite} color={col} />
              <div style={{flex:1}}>
                <p style={{fontWeight:700,color:C.text,fontSize:13}}>{w.name}</p>
                <p style={{fontSize:11,color:C.muted}}>{w.trade} · {w.zone}</p>
              </div>
              <Stars n={w.rating} size={11} />
              <span style={{fontSize:13,fontWeight:700,color:C.accent,marginLeft:4}}>{w.rating}</span>
              <span style={{fontSize:11,color:C.muted}}>({w.reviews})</span>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [tab,setTab] = useState<"buscar"|"ranking"|"profesionales"|"planes">("buscar");
  const [zona,setZona] = useState("Toda España");
  const [oficio,setOficio] = useState("Todos");
  const [search,setSearch] = useState("");
  const [soloDisp,setSoloDisp] = useState(false);
  const [selected,setSelected] = useState<Worker|null>(null);
  const [chatW,setChatW] = useState<Worker|null>(null);
  const [toast,setToast] = useState<string|null>(null);

  const filtered = WORKERS.filter(w=>{
    if(zona!=="Toda España"&&w.zone!==zona) return false;
    if(oficio!=="Todos"&&w.cat!==oficio) return false;
    if(soloDisp&&!w.available) return false;
    if(search&&!w.name.toLowerCase().includes(search.toLowerCase())&&!w.trade.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const showToast=(msg:string)=>{setToast(msg);setTimeout(()=>setToast(null),3000);};

  const btnStyle=(id:string)=>({
    padding:"7px 14px",borderRadius:8,
    border:`1px solid ${tab===id?C.accent+"60":"transparent"}`,
    background:tab===id?`${C.accent + '22'}`:"transparent",
    color:tab===id?C.accent:C.muted,
    fontFamily:"inherit",fontSize:12,fontWeight:600,cursor:"pointer",
    transition:"all 0.15s",
    boxShadow:tab===id?`0 0 12px ${C.accent + '33'}`:"none",
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:${C.bg};font-family:'DM Sans',sans-serif;color:${C.text};background-image:radial-gradient(ellipse at 20% 0%, #1a0a3a 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, #0a1a3a 0%, transparent 50%);}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:${C.border};border-radius:99px;}
        input::placeholder,textarea::placeholder{color:${C.muted};}
        select option{background:#0F0F1A;color:#EEEEFF;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:none;}}
        @keyframes toastIn{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:none;}}
        @keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
      `}</style>

      {toast&&<div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:`linear-gradient(135deg,${C.accent},#FFA500)`,color:"#000",borderRadius:10,padding:"10px 20px",fontWeight:700,fontSize:13,zIndex:999,animation:"toastIn 0.3s ease",whiteSpace:"nowrap",boxShadow:`0 4px 20px ${C.accent + '88'}`}}>{toast}</div>}

      <DetailModal w={selected} onClose={()=>setSelected(null)} onChat={w=>{setSelected(null);setChatW(w);}} />
      <ChatPanel w={chatW} onClose={()=>setChatW(null)} />

      <header style={{background:"rgba(8,8,16,0.85)",backdropFilter:"blur(24px)",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:100,boxShadow:"0 4px 24px rgba(0,0,0,0.4)"}}>
        <div style={{maxWidth:1100,margin:"0 auto",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:58}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{background:`linear-gradient(135deg,${C.accent},#FFA500)`,borderRadius:8,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,boxShadow:`0 0 20px ${C.accent + '99'}`,animation:"float 3s ease-in-out infinite"}}>🔨</div>
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,background:`linear-gradient(135deg,${C.text},#AAAACC)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>OFICIO</span>
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,background:`linear-gradient(135deg,${C.accent},#FFA500)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>YA</span>
            <span style={{fontSize:9,background:`${C.accent + '22'}`,color:C.accent,padding:"2px 7px",borderRadius:3,fontWeight:700,letterSpacing:"0.1em",border:`1px solid ${C.accent + '30'}`}}>ESPAÑA</span>
          </div>
          <nav style={{display:"flex",gap:2}}>
            {([["buscar","Buscar"],["ranking","🏆 Ranking"],["profesionales","Soy Pro"],["planes","Planes"]] as const).map(([id,label])=>(
              <button key={id} onClick={()=>setTab(id)} style={btnStyle(id)}>{label}</button>
            ))}
          </nav>
          <button onClick={()=>showToast("💬 2 mensajes sin leer")} style={{position:"relative",background:`${C.purple + '22'}`,border:`1px solid ${C.purple + '40'}`,borderRadius:8,padding:"6px 12px",color:C.text,cursor:"pointer",fontSize:15,boxShadow:`0 0 12px ${C.purple + '33'}`}}>
            💬<span style={{position:"absolute",top:-6,right:-6,background:C.red,color:"#fff",borderRadius:"50%",width:16,height:16,fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 0 8px ${C.red}`}}>2</span>
          </button>
        </div>
      </header>

      <main style={{maxWidth:1100,margin:"0 auto",padding:"0 24px 80px"}}>

        {tab==="buscar" && (
          <>
            <div style={{padding:"48px 0 32px",animation:"fadeUp 0.4s ease"}}>
              <div style={{display:"inline-flex",gap:8,background:`${C.green + '18'}`,border:`1px solid ${C.green + '40'}`,borderRadius:6,padding:"5px 14px",marginBottom:20}}>
                <span style={{fontSize:9,color:C.green,animation:"pulse 2s infinite"}}>●</span>
                <span style={{fontSize:11,color:C.green,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>{WORKERS.filter(w=>w.available).length} profesionales disponibles ahora</span>
              </div>
              <h1 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(36px,5vw,66px)",lineHeight:0.93,letterSpacing:"0.03em",marginBottom:14}}>
                <span style={{background:`linear-gradient(135deg,${C.text},#8888BB)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>EL PROFESIONAL<br/>QUE NECESITAS</span><br/>
                <span style={{background:`linear-gradient(135deg,${C.accent},#FFA500)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>A UN CLIC.</span>
              </h1>
              <p style={{fontSize:15,color:C.mutedLight,maxWidth:460,lineHeight:1.7,marginBottom:28}}>Mano de obra cualificada y verificada. Reseñas reales, precios claros, en tu zona.</p>
              <div style={{display:"flex",gap:8,maxWidth:700,marginBottom:14,flexWrap:"wrap"}}>
                <div style={{flex:2,minWidth:180,display:"flex",background:`linear-gradient(135deg,${C.card},#0A0A18)`,borderRadius:10,border:`1px solid ${C.border}`,overflow:"hidden",boxShadow:"0 4px 16px rgba(0,0,0,0.3)"}}>
                  <span style={{padding:"0 12px",display:"flex",alignItems:"center",color:C.muted}}>🔍</span>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Electricista, fontanero..." style={{flex:1,padding:"11px 0",background:"transparent",border:"none",color:C.text,fontFamily:"inherit",fontSize:14,outline:"none"}} />
                </div>
                <select value={zona} onChange={e=>setZona(e.target.value)} style={{flex:1,minWidth:130,padding:"11px 12px",background:`linear-gradient(135deg,${C.card},#0A0A18)`,border:`1px solid ${C.border}`,borderRadius:10,color:C.text,fontFamily:"inherit",fontSize:13,cursor:"pointer",outline:"none",boxShadow:"0 4px 16px rgba(0,0,0,0.3)"}}>
                  {ZONAS.map(z=><option key={z}>{z}</option>)}
                </select>
                <select value={oficio} onChange={e=>setOficio(e.target.value)} style={{flex:1,minWidth:130,padding:"11px 12px",background:`linear-gradient(135deg,${C.card},#0A0A18)`,border:`1px solid ${C.border}`,borderRadius:10,color:C.text,fontFamily:"inherit",fontSize:13,cursor:"pointer",outline:"none",boxShadow:"0 4px 16px rgba(0,0,0,0.3)"}}>
                  {OFICIOS.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:C.mutedLight}}>
                <input type="checkbox" checked={soloDisp} onChange={e=>setSoloDisp(e.target.checked)} style={{accentColor:C.accent,width:15,height:15}} />
                Solo disponibles ahora
              </label>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:C.border,borderRadius:10,overflow:"hidden",marginBottom:28,boxShadow:"0 4px 24px rgba(0,0,0,0.4)"}}>
              {[{v:WORKERS.length+"+",l:"Profesionales",c:C.purple},{v:"1.847",l:"Trabajos",c:C.blue},{v:"52",l:"Ciudades",c:C.green},{v:"4.8★",l:"Media España",c:C.accent}].map(s=>(
                <div key={s.l} style={{background:`linear-gradient(135deg,${s.c}10,${C.surface})`,padding:"16px",textAlign:"center"}}>
                  <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:s.c,textShadow:`0 0 20px ${s.c}60`}}>{s.v}</p>
                  <p style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:"0.08em"}}>{s.l}</p>
                </div>
              ))}
            </div>

            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <p style={{fontSize:13,color:C.muted}}><span style={{color:C.text,fontWeight:700}}>{filtered.length}</span> profesionales en {zona}</p>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
              {filtered.map((w,i)=>(
                <div key={w.id} style={{animation:`fadeUp 0.4s ease ${i*0.05}s both`}}>
                  <WorkerCard w={w} onClick={()=>setSelected(w)} />
                </div>
              ))}
              {filtered.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:60,color:C.muted}}><p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:36,marginBottom:8}}>SIN RESULTADOS</p><p style={{fontSize:14}}>Prueba con otra zona u oficio</p></div>}
            </div>
          </>
        )}

        {tab==="ranking" && <RankingTab onSelect={setSelected} />}

        {tab==="profesionales" && (
          <div style={{padding:"48px 0",animation:"fadeUp 0.4s ease"}}>
            <div style={{maxWidth:600,margin:"0 auto",textAlign:"center",marginBottom:48}}>
              <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:58,lineHeight:0.9,letterSpacing:"0.03em",marginBottom:16}}>
                <span style={{background:`linear-gradient(135deg,${C.text},#8888BB)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>MÁS CLIENTES.<br/></span>
                <span style={{background:`linear-gradient(135deg,${C.accent},#FFA500)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>MÁS DINERO.</span>
              </p>
              <p style={{fontSize:15,color:C.mutedLight,lineHeight:1.7,marginBottom:28}}>Únete a OfficioYa y aparece ante miles de clientes que buscan exactamente lo que ofreces.</p>
              <button onClick={()=>setTab("planes")} style={{padding:"14px 44px",background:`linear-gradient(135deg,${C.accent},#FFA500)`,border:"none",borderRadius:10,color:"#000",fontFamily:"'Bebas Neue',sans-serif",fontSize:22,cursor:"pointer",letterSpacing:"0.05em",boxShadow:`0 8px 32px ${C.accent + '66'}`,animation:"float 3s ease-in-out infinite"}}>VER PLANES →</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              {[{i:"🏆",t:"Ranking público",d:"Compite por ser el #1 de tu zona.",c:C.accent},{i:"📊",t:"Estadísticas",d:"Visitas, contactos y facturación en tiempo real.",c:C.blue},{i:"⭐",t:"Gestión de reseñas",d:"Responde y destaca las mejores valoraciones.",c:C.purple},{i:"💬",t:"Chat directo",d:"Con tus clientes sin dar tu número.",c:C.green},{i:"📸",t:"Galería de fotos",d:"Sube fotos de tus mejores obras.",c:"#FF6B9D"},{i:"🔔",t:"Alertas de trabajo",d:"Notificaciones cuando busquen tu oficio.",c:"#FF9640"}].map((f,i)=>(
                <GlassCard key={i} hoverGlow={f.c} style={{padding:"20px",animation:`fadeUp 0.4s ease ${i*0.07}s both`}}>
                  <p style={{fontSize:26,marginBottom:10}}>{f.i}</p>
                  <p style={{fontWeight:700,color:C.text,marginBottom:6}}>{f.t}</p>
                  <p style={{fontSize:13,color:C.muted,lineHeight:1.6}}>{f.d}</p>
                </GlassCard>
              ))}
            </div>
          </div>
        )}

        {tab==="planes" && (
          <div style={{padding:"48px 0",animation:"fadeUp 0.4s ease"}}>
            <div style={{textAlign:"center",marginBottom:44}}>
              <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:50,lineHeight:0.9,marginBottom:10}}>
                <span style={{background:`linear-gradient(135deg,${C.text},#8888BB)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>ELIGE TU<br/></span>
                <span style={{background:`linear-gradient(135deg,${C.accent},#FFA500)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>PLAN</span>
              </p>
              <p style={{fontSize:13,color:C.muted}}>Sin permanencia · Cancela cuando quieras · Soporte en español</p>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,maxWidth:880,margin:"0 auto",alignItems:"center"}}>
              {[
                {name:"BÁSICO",price:"9,99",col:C.purple,pop:false,feats:["Perfil visible","5 contactos/mes","Sin badge verificado","Soporte email"]},
                {name:"PRO",price:"24,99",col:C.accent,pop:true,feats:["Perfil destacado","Contactos ilimitados","Badge verificado ✓","Primero en búsquedas","Chat directo","Estadísticas completas","Galería de fotos","Ranking público"]},
                {name:"ÉLITE",price:"49,99",col:"#FFA500",pop:false,feats:["Todo lo de Pro","Badge Élite ★","Anuncios en portada","Top del Ranking","Gestor de reseñas","Facturación integrada","Soporte telefónico"]},
              ].map(plan=>(
                <div key={plan.name} style={{
                  background:plan.pop?`linear-gradient(160deg,#1a1a2e,#0d0d1a)`:`linear-gradient(160deg,${C.card},#080812)`,
                  borderRadius:16, border:`${plan.pop?"2px":"1px"} solid ${plan.pop?plan.col+"80":C.border}`,
                  padding:"28px 22px", position:"relative",
                  transform:plan.pop?"scale(1.05)":"none",
                  boxShadow:plan.pop?`0 0 50px ${plan.col}25,0 20px 60px rgba(0,0,0,0.5),inset 0 1px 0 ${plan.col}20`:`0 4px 20px rgba(0,0,0,0.3)`,
                }}>
                  {plan.pop && <div style={{position:"absolute",top:-14,left:"50%",transform:"translateX(-50%)",background:`linear-gradient(135deg,${C.accent},#FFA500)`,color:"#000",borderRadius:99,padding:"3px 16px",fontSize:10,fontWeight:900,letterSpacing:"0.1em",textTransform:"uppercase",whiteSpace:"nowrap",boxShadow:`0 4px 16px ${C.accent + '88'}`}}>★ MÁS POPULAR</div>}
                  <p style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:plan.col,letterSpacing:"0.1em",marginBottom:6,textShadow:`0 0 20px ${plan.col}50`}}>{plan.name}</p>
                  <div style={{marginBottom:20}}>
                    <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:44,background:`linear-gradient(135deg,${plan.col},${plan.pop?"#FFA500":plan.col}AA)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{plan.price}€</span>
                    <span style={{fontSize:12,color:C.muted}}>/mes</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:22}}>
                    {plan.feats.map(f=>(
                      <div key={f} style={{display:"flex",gap:8}}>
                        <span style={{color:plan.col,fontWeight:700,flexShrink:0,textShadow:`0 0 8px ${plan.col}60`}}>✓</span>
                        <span style={{fontSize:12,color:C.mutedLight,lineHeight:1.4}}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={()=>showToast(`✓ Plan ${plan.name} — integrando Stripe...`)} style={{width:"100%",padding:"12px",background:plan.pop?`linear-gradient(135deg,${C.accent},#FFA500)`:"transparent",border:`1px solid ${plan.pop?"transparent":plan.col+"60"}`,borderRadius:10,color:plan.pop?"#000":plan.col,fontFamily:"'Bebas Neue',sans-serif",fontSize:17,letterSpacing:"0.05em",cursor:"pointer",transition:"all 0.15s",boxShadow:plan.pop?`0 4px 20px ${C.accent + '66'}`:`0 0 12px ${plan.col}15`}}>
                    EMPEZAR →
                  </button>
                </div>
              ))}
            </div>
            <div style={{textAlign:"center",marginTop:28,padding:"14px",background:`${C.green + '08'}`,borderRadius:10,maxWidth:480,margin:"28px auto 0",border:`1px solid ${C.green + '33'}`,boxShadow:`0 0 20px ${C.green + '18'}`}}>
              <p style={{fontSize:13,color:C.green,fontWeight:700}}>✓ Pago 100% seguro · Factura automática · Soporte en español</p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
