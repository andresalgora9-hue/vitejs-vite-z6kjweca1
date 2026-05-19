import React from "react";
export default function Cancelacion() {
  return (
    <div style={{ minHeight:"100vh", background:"#0A0A0F", color:"#F0F0FA", fontFamily:"'DM Sans',sans-serif", padding:"40px 24px", maxWidth:760, margin:"0 auto" }}>
      <a href="/" style={{ color:"#FFD700", fontSize:13, textDecoration:"none", display:"block", marginBottom:32 }}>← Volver a OfficioYa</a>
      <h1 style={{ fontSize:28, fontWeight:900, marginBottom:8 }}>Política de Cancelación y Reembolsos</h1>
      <p style={{ color:"#7777AA", fontSize:13, marginBottom:40 }}>Última actualización: {new Date().toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"})}</p>

      <div style={{background:"rgba(255,68,85,0.08)",border:"1px solid rgba(255,68,85,0.3)",borderLeft:"3px solid #FF4455",borderRadius:8,padding:"16px 20px",marginBottom:36}}>
        <p style={{fontSize:13,fontWeight:800,color:"#FF8888",marginBottom:6}}>⚠ CONDICIONES CLAVE DEL PERÍODO DE PRUEBA</p>
        <p style={{fontSize:13,color:"#F0F0FA",lineHeight:1.75,margin:0}}>
          Dispones de los primeros <strong>15 días naturales</strong> desde la activación para cancelar sin coste alguno.<br/>
          A partir del <strong>día 16</strong>, aunque canceles, se realizará el cargo de <strong>49,99€</strong> al vencimiento del periodo de prueba (día 30).<br/>
          Para evitar el cobro del siguiente mes, la cancelación debe solicitarse con al menos <strong>15 días de antelación</strong> a la fecha de renovación.
        </p>
      </div>

      {[
        {t:"1. Cómo Cancelar", c:"Desde tu cuenta: Mi perfil → Planes → Cancelar suscripción. O por email a admin@algoracompound.com indicando nombre, email de la cuenta y solicitud de cancelación."},
        {t:"2. Efecto de la Cancelación", c:"La cancelación debe solicitarse con al menos 15 días naturales de antelación a la fecha de renovación. Las cancelaciones presentadas dentro de los 15 días anteriores a la renovación se aplicarán al período siguiente, generándose el cobro correspondiente. El acceso se mantiene hasta el final del período facturado."},
        {t:"3. Período de Prueba (30 días)", c:"Durante los primeros 15 días del período de prueba puedes cancelar sin coste. A partir del día 16, la cancelación no impedirá el cobro del primer mes (49,99€) al vencimiento del trial. OfficioYa informa expresamente de esta condición al facilitar los datos de pago."},
        {t:"4. Derecho de Desistimiento", c:"Conforme al TRLGDCU, dispones de 14 días naturales desde la contratación para ejercer el derecho de desistimiento. Dado que OfficioYa proporciona acceso inmediato, se deducirá la parte proporcional del servicio disfrutado. Fuera del plazo de 14 días y pasado el día 15 del trial, no procederá reembolso por desistimiento."},
        {t:"5. Cuándo SÍ procede reembolso", c:"Error de facturación acreditado (cobro duplicado o incorrecto). Interrupción total del servicio por causas imputables a OfficioYa durante más de 72 horas consecutivas. Cancelación del servicio por decisión unilateral de OfficioYa sin causa imputable al usuario."},
        {t:"6. Cuándo NO procede reembolso", c:"Cancelación fuera del período de desistimiento de 14 días o pasado el día 15 del trial. Falta de uso o uso insuficiente de la plataforma. Insatisfacción con el número de clientes o trabajos obtenidos (OfficioYa ofrece visibilidad, no garantiza resultados). Cancelaciones presentadas dentro de los 15 días anteriores a la renovación. Solicitudes presentadas más de 30 días después del cargo. Suspensión de cuenta por incumplimiento de Términos."},
        {t:"7. Cómo solicitar un reembolso", c:"Envía un email a admin@algoracompound.com con asunto 'Solicitud de reembolso', indicando: nombre, email de la cuenta, fecha del cargo y motivo. Responderemos en 2 días hábiles y resolveremos en 14 días naturales. Si procede, el reembolso se realiza al método de pago original en 5-10 días hábiles."},
      ].map(({t,c})=>(
        <div key={t} style={{marginBottom:28}}>
          <h2 style={{fontSize:16,fontWeight:800,color:"#FFD700",marginBottom:10,paddingBottom:6,borderBottom:"1px solid #1E1E30"}}>{t}</h2>
          <p style={{fontSize:14,color:"#7777AA",lineHeight:1.75}}>{c}</p>
        </div>
      ))}
      <div style={{marginTop:60,paddingTop:24,borderTop:"1px solid #1E1E30",display:"flex",gap:20,flexWrap:"wrap" as const,justifyContent:"center"}}>
        {[["Términos y Condiciones","/terminos"],["Política de Privacidad","/privacidad"],["Inicio","/"]].map(([l,h])=>(
          <a key={l} href={h} style={{color:"#7777AA",fontSize:12,textDecoration:"none"}}>{l}</a>
        ))}
      </div>
    </div>
  );
}
