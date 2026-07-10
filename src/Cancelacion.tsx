import React from "react";
export default function Cancelacion() {
  return (
    <div style={{ minHeight:"100vh", background:"#0A0A0F", color:"#F0F0FA", fontFamily:"'DM Sans',sans-serif", padding:"40px 24px", maxWidth:760, margin:"0 auto" }}>
      <a href="/" style={{ color:"#FFD700", fontSize:13, textDecoration:"none", display:"block", marginBottom:32 }}>← Volver a OficioYa</a>
      <h1 style={{ fontSize:28, fontWeight:900, marginBottom:8 }}>Política de Cancelación y Reembolsos</h1>
      <p style={{ color:"#7777AA", fontSize:13, marginBottom:40 }}>Última actualización: 10 de julio de 2026</p>

      <div style={{background:"rgba(255,68,85,0.08)",border:"1px solid rgba(255,68,85,0.3)",borderLeft:"3px solid #FF4455",borderRadius:8,padding:"16px 20px",marginBottom:36}}>
        <p style={{fontSize:13,fontWeight:800,color:"#FF8888",marginBottom:6}}>⚠ CONDICIONES CLAVE DEL PERÍODO DE PRUEBA</p>
        <p style={{fontSize:13,color:"#F0F0FA",lineHeight:1.75,margin:0}}>
          Dispones de los primeros <strong>15 días naturales</strong> desde la activación para cancelar sin coste alguno.<br/>
          A partir del <strong>día 16</strong>, aunque canceles, se realizará el cargo de <strong>49,99€</strong> al vencimiento del periodo de prueba (día 30).<br/>
          Para evitar el cobro del siguiente mes, la cancelación debe solicitarse con al menos <strong>15 días de antelación</strong> a la fecha de renovación.<br/>
          Estas condiciones se muestran de forma destacada antes de facilitar los datos de pago y su aceptación expresa es requisito para activar el período de prueba.
        </p>
      </div>

      {[
        {t:"0. Ámbito de Aplicación", c:"Esta política se aplica a las suscripciones de Profesionales, que contratan en el marco de su actividad empresarial o profesional y, por tanto, no tienen la condición de consumidores conforme al TRLGDCU. Los derechos recogidos en esta política son concedidos voluntariamente por OficioYa. Los usuarios que en su caso tengan la condición legal de consumidores conservan íntegros sus derechos irrenunciables."},
        {t:"1. Cómo Cancelar", c:"Desde tu cuenta: Mi perfil → Planes → Cancelar suscripción. O por email a admin@algoracompound.com indicando nombre, email de la cuenta y solicitud de cancelación. La fecha de la solicitud será la de recepción de la misma."},
        {t:"2. Efecto de la Cancelación", c:"La cancelación debe solicitarse con al menos 15 días naturales de antelación a la fecha de renovación. Las cancelaciones presentadas dentro de los 15 días anteriores a la renovación se aplicarán al período siguiente, generándose el cobro correspondiente. El acceso a todas las funcionalidades del plan se mantiene en todo caso hasta el final del último período facturado. No se realizan reembolsos prorrateados por la parte no consumida del período en curso."},
        {t:"3. Período de Prueba (30 días)", c:"Durante los primeros 15 días naturales del período de prueba puedes cancelar sin coste alguno. A partir del día 16, la cancelación no impedirá el cobro del primer mes (49,99€) al vencimiento del trial. OficioYa informa de esta condición de forma clara, destacada y previa a la introducción de los datos de pago, y su aceptación expresa constituye requisito para la activación del período de prueba."},
        {t:"4. Desistimiento", c:"Al tratarse de una contratación entre empresarios/profesionales, no resulta de aplicación el derecho de desistimiento del TRLGDCU previsto para consumidores. No obstante, OficioYa concede voluntariamente la ventana de cancelación sin coste de los primeros 15 días del período de prueba descrita en el apartado 3, en condiciones más amplias que el desistimiento legal de 14 días."},
        {t:"5. Cuándo SÍ procede reembolso", c:"Error de facturación acreditado (cobro duplicado o incorrecto). Interrupción total del servicio por causas imputables a OficioYa durante más de 72 horas consecutivas, con reembolso proporcional al tiempo de indisponibilidad. Cancelación del servicio por decisión unilateral de OficioYa sin causa imputable al usuario, con reembolso proporcional a la parte no disfrutada."},
        {t:"6. Cuándo NO procede reembolso", c:"Cancelación fuera de la ventana sin coste del trial (día 16 en adelante) o del plazo de preaviso de renovación. Falta de uso o uso insuficiente de la plataforma. Insatisfacción con el número de contactos, clientes o trabajos obtenidos (OficioYa ofrece visibilidad y herramientas de contacto; no garantiza resultados, tal y como se recoge en los Términos y Condiciones). Solicitudes presentadas más de 30 días después del cargo. Suspensión o cancelación de cuenta por incumplimiento de los Términos y Condiciones."},
        {t:"7. Cómo solicitar un reembolso", c:"Envía un email a admin@algoracompound.com con asunto 'Solicitud de reembolso', indicando: nombre, email de la cuenta, fecha del cargo y motivo. Responderemos en 2 días hábiles y resolveremos en un máximo de 14 días naturales. Si procede, el reembolso se realiza al método de pago original en 5-10 días hábiles."},
        {t:"8. Impago", c:"Si un cargo de renovación resulta fallido, OficioYa podrá reintentar el cobro y, en su caso, limitar o suspender el acceso al plan hasta la regularización, manteniéndose exigible el importe del período ya iniciado."},
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
