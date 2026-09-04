import React from "react";
const C = { bg:"#0A0A0F", text:"#F0F0FA", muted:"#7777AA", border:"#1E1E30", accent:"#FFD700" };

export const CANCELACION_VERSION = "v2.0";
export const CANCELACION_FECHA = "4 de septiembre de 2026";

export default function Cancelacion() {
  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Sans',sans-serif", padding:"40px 24px", maxWidth:760, margin:"0 auto" }}>
      <a href="/" style={{ color:C.accent, fontSize:13, textDecoration:"none", display:"block", marginBottom:32 }}>← Volver a OficioYa</a>
      <h1 style={{ fontSize:28, fontWeight:900, marginBottom:8 }}>Política de Cancelación y Baja</h1>
      <p style={{ color:C.muted, fontSize:13, marginBottom:32 }}>Versión {CANCELACION_VERSION} · {CANCELACION_FECHA}</p>

      <Alert>OficioYa ya no comercializa planes de suscripción. Los planes Gratuito, Básico, Pro y Elite fueron retirados y no se encuentran disponibles para su contratación. No existen cuotas periódicas, cargos recurrentes ni períodos de permanencia de ningún tipo.</Alert>

      <Section title="1. Uso Gratuito para el Cliente">
        <P>El uso de OficioYa es totalmente gratuito para el Cliente. No existe suscripción que cancelar ni importe alguno que reembolsar. El Cliente puede dejar de utilizar el servicio en cualquier momento sin necesidad de comunicación previa ni coste asociado.</P>
      </Section>

      <Section title="2. Colaboración con Profesionales">
        <P>La relación entre OficioYa y los Profesionales se rige por el contrato de colaboración suscrito individualmente con cada uno de ellos. Dicho contrato regula la comisión aplicable, su devengo, la facturación, la liquidación y las condiciones de terminación de la colaboración.</P>
        <P>El Profesional que desee finalizar su colaboración debe comunicarlo conforme a lo previsto en su contrato, escribiendo a admin@algoracompound.com. La baja no exime del pago de las comisiones ya devengadas por trabajos cerrados con anterioridad a la misma.</P>
      </Section>

      <Section title="3. Baja de la Cuenta">
        <P>Cualquier usuario, Cliente o Profesional, puede solicitar la baja de su cuenta escribiendo a <B>admin@algoracompound.com</B> desde la dirección de correo asociada a la cuenta o indicando el teléfono con el que se registró.</P>
        <P>Atenderemos la solicitud en el plazo máximo de 30 días naturales. La baja implica la desactivación del perfil y el cese de las comunicaciones de servicio. Determinados datos se conservan bloqueados durante los plazos legales indicados en la <A href="/privacidad">Política de Privacidad</A>, en particular los relativos a facturación y a Acuerdos de Trabajo firmados, a efectos fiscales y probatorios.</P>
        <P>La baja de la cuenta no equivale al ejercicio del derecho de supresión. Si además deseas ejercer tus derechos en materia de protección de datos, indícalo expresamente en tu solicitud.</P>
      </Section>

      <Section title="4. Cancelación de un Trabajo Acordado">
        <P>La cancelación de un trabajo ya contratado corresponde exclusivamente al Cliente y al Profesional, que son las partes del contrato de ejecución. OficioYa no es parte del mismo y no interviene en su resolución.</P>
        <P>Si el trabajo aún no ha comenzado, recomendamos comunicarlo al Profesional cuanto antes. Si ya se han realizado desplazamientos, adquirido materiales o ejecutado parte de los trabajos, el Profesional podrá reclamar la parte proporcional conforme a lo pactado en el Acuerdo de Trabajo y a la legislación aplicable.</P>
        <P>Los Clientes que actúen como consumidores conservan íntegros los derechos que les reconoce la normativa de consumo frente al Profesional, incluido, cuando resulte aplicable, el derecho de desistimiento en contratos celebrados fuera del establecimiento mercantil.</P>
      </Section>

      <Section title="5. Incidencias y Reclamaciones">
        <P>Si tienes una incidencia con un trabajo o con un Profesional, escríbenos a <B>admin@algoracompound.com</B>. Acusaremos recibo y podremos, de forma voluntaria, facilitar la comunicación entre las partes, aportar la documentación que obre en nuestro poder o adoptar medidas sobre la cuenta del Profesional. Esta intervención no convierte a OficioYa en parte, árbitro ni garante de la controversia, conforme a lo previsto en las <A href="/terminos">Condiciones de Uso</A>.</P>
      </Section>

      <Section title="6. Suscripciones Anteriores">
        <P>Los planes de suscripción dejaron de comercializarse y todas las suscripciones activas fueron canceladas sin coste para los Profesionales, que no han vuelto a recibir cargo alguno desde entonces.</P>
        <P>Si detectas un cargo posterior a la retirada de los planes o consideras que se te facturó indebidamente, escribe a admin@algoracompound.com indicando nombre, correo de la cuenta y fecha del cargo. Responderemos en 2 días hábiles y, si procede, el reembolso se realizará al método de pago original en 5 a 10 días hábiles.</P>
      </Section>

      <Section title="7. Cancelación por Parte de OficioYa">
        <P>OficioYa podrá suspender o cancelar cuentas, con carácter temporal o definitivo, en los supuestos previstos en las Condiciones de Uso, en particular por uso fraudulento, datos falsos, impago de comisiones devengadas, reclamaciones reiteradas o conductas que puedan dañar a otros usuarios o a la plataforma. Salvo en supuestos de gravedad o de obligación legal, comunicaremos la decisión y su motivo por correo electrónico.</P>
      </Section>

      <Section title="8. Contacto">
        <P>Andrés Algora Fernández (nombre comercial OficioYa), NIF 77860535S, C/ Condes de Bustillo 5, Bajo D, 41010 Sevilla, España. Correo: admin@algoracompound.com</P>
      </Section>

      <LegalFooter/>
    </div>
  );
}

function Section({title,children}:{title:string;children:React.ReactNode}){
  return <div style={{marginBottom:36}}><h2 style={{fontSize:18,fontWeight:800,color:"#FFD700",marginBottom:14,paddingBottom:8,borderBottom:"1px solid #1E1E30"}}>{title}</h2>{children}</div>;
}
function P({children}:{children:React.ReactNode}){
  return <p style={{fontSize:14,color:"#7777AA",lineHeight:1.75,marginBottom:10}}>{children}</p>;
}
function B({children}:{children:React.ReactNode}){
  return <strong style={{color:"#F0F0FA",fontWeight:700}}>{children}</strong>;
}
function A({href,children}:{href:string;children:React.ReactNode}){
  return <a href={href} style={{color:"#FFD700",textDecoration:"underline"}}>{children}</a>;
}
function Alert({children}:{children:React.ReactNode}){
  return <div style={{background:"rgba(255,215,0,0.06)",border:"1px solid rgba(255,215,0,0.2)",borderLeft:"3px solid #FFD700",borderRadius:8,padding:"14px 18px",margin:"0 0 36px"}}><p style={{fontSize:13.5,color:"#F0F0FA",lineHeight:1.7,margin:0}}>{children}</p></div>;
}
function LegalFooter(){
  return <div style={{marginTop:60,paddingTop:24,borderTop:"1px solid #1E1E30",display:"flex",gap:20,flexWrap:"wrap" as const,justifyContent:"center"}}>
    {[["Condiciones de Uso","/terminos"],["Política de Privacidad","/privacidad"],["Política de Cookies","/cookies"],["Inicio","/"]].map(([l,h])=>(
      <a key={l} href={h} style={{color:"#7777AA",fontSize:12,textDecoration:"none"}}>{l}</a>
    ))}
  </div>;
}
