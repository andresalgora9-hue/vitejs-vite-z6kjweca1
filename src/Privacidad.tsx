import React from "react";
const C = { bg:"#0A0A0F", text:"#F0F0FA", muted:"#7777AA", border:"#1E1E30", accent:"#FFD700" };

export const PRIVACIDAD_VERSION = "v2.0";
export const PRIVACIDAD_FECHA = "4 de septiembre de 2026";

export default function Privacidad() {
  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Sans',sans-serif", padding:"40px 24px", maxWidth:760, margin:"0 auto" }}>
      <a href="/" style={{ color:C.accent, fontSize:13, textDecoration:"none", display:"block", marginBottom:32 }}>← Volver a OficioYa</a>
      <h1 style={{ fontSize:28, fontWeight:900, marginBottom:8 }}>Política de Privacidad</h1>
      <p style={{ color:C.muted, fontSize:13, marginBottom:40 }}>Versión {PRIVACIDAD_VERSION} · {PRIVACIDAD_FECHA}</p>

      <Section title="1. Responsable del Tratamiento">
        <P>• Titular: Andrés Algora Fernández, empresario individual (nombre comercial OficioYa).</P>
        <P>• NIF: 77860535S.</P>
        <P>• Domicilio: C/ Condes de Bustillo 5, Bajo D, 41010 Sevilla, España.</P>
        <P>• Contacto en materia de protección de datos: admin@algoracompound.com</P>
        <P>• Sitio web: www.aficioya.com</P>
      </Section>

      <Section title="2. Datos que Tratamos">
        <Sub>2.1 Datos que nos facilitas directamente</Sub>
        <P>Nombre y apellidos, teléfono, correo electrónico, localidad y, en su caso, dirección del inmueble donde se prestará el servicio, descripción del trabajo solicitado, fotografías que adjuntes, mensajes intercambiados a través de la plataforma, reseñas y valoraciones.</P>
        <Sub>2.2 Datos de los Profesionales</Sub>
        <P>Además de los anteriores: NIF o CIF, denominación fiscal, domicilio de actividad, oficios y zonas de trabajo, documentación acreditativa de su actividad, datos bancarios para la liquidación de comisiones y fotografías de trabajos realizados.</P>
        <Sub>2.3 Datos facilitados por un tercero</Sub>
        <Alert>Cuando un Profesional cumplimenta un Acuerdo de Trabajo, introduce en la plataforma datos identificativos y de contacto del Cliente, así como la dirección del inmueble. El Profesional actúa en este supuesto por cuenta de OficioYa y se ha obligado contractualmente a recabar dichos datos con conocimiento del Cliente. El Cliente recibe copia íntegra del documento de forma inmediata a su firma.</Alert>
        <Sub>2.4 Firma manuscrita</Sub>
        <P>Al firmar un Acuerdo de Trabajo se captura el trazo de tu firma en formato de imagen, junto con la fecha y hora, la dirección IP, el identificador del dispositivo y una huella criptográfica del documento. Estos datos se tratan exclusivamente con finalidad probatoria y no se someten a análisis biométrico ni a ningún tratamiento destinado a tu identificación única, por lo que no constituyen datos de categoría especial.</P>
        <Sub>2.5 Datos de pago</Sub>
        <P>Los pagos se gestionan íntegramente por Stripe. OficioYa no almacena ni tiene acceso a números completos de tarjeta.</P>
        <Sub>2.6 Datos recogidos automáticamente</Sub>
        <P>Dirección IP, tipo de dispositivo y navegador, sistema operativo, páginas visitadas, origen de la visita (campaña, medio, término de búsqueda e identificadores publicitarios), identificadores de cookies y datos de sesión. Si activas las notificaciones, el identificador técnico de tu suscripción push.</P>
      </Section>

      <Section title="3. Finalidades y Bases Jurídicas">
        <P>• <B>Ejecución del contrato o medidas precontractuales (art. 6.1.b RGPD):</B> gestión de tu solicitud de presupuesto, puesta en contacto con Profesionales, mensajería, gestión de la cuenta, generación y entrega de Acuerdos de Trabajo, facturación de comisiones a Profesionales.</P>
        <P>• <B>Interés legítimo (art. 6.1.f RGPD):</B> seguridad de la plataforma, prevención del fraude, conservación de evidencias de firma y aceptación con finalidad probatoria, análisis estadístico agregado, defensa frente a reclamaciones y mejora del servicio.</P>
        <P>• <B>Consentimiento (art. 6.1.a RGPD):</B> cookies y tecnologías similares no necesarias, comunicaciones comerciales, notificaciones push y cualquier tratamiento para el que se te solicite de forma expresa y separada. Puedes retirarlo en cualquier momento sin que ello afecte a la licitud del tratamiento previo.</P>
        <P>• <B>Cumplimiento de obligaciones legales (art. 6.1.c RGPD):</B> obligaciones fiscales, contables y de conservación de facturación.</P>
        <P>No se adoptan decisiones automatizadas con efectos jurídicos ni se elabora perfilado que produzca efectos significativos sobre los usuarios. La asignación de solicitudes a Profesionales se realiza mediante intervención humana.</P>
      </Section>

      <Section title="4. Plazos de Conservación">
        <P>• Solicitudes de presupuesto no convertidas: 2 años.</P>
        <P>• Datos de cuenta: 5 años desde la cancelación.</P>
        <P>• Acuerdos de Trabajo, firmas y evidencias asociadas: 5 años desde la firma (plazo general de prescripción de acciones personales, art. 1964 del Código Civil).</P>
        <P>• Registros de aceptación de documentos legales: 5 años.</P>
        <P>• Datos de facturación y contabilidad: 6 años (Código de Comercio) y hasta 4 años a efectos fiscales desde el fin del plazo de declaración, aplicándose el mayor.</P>
        <P>• Mensajería: 2 años desde la última actividad.</P>
        <P>• Cookies y tecnologías similares: máximo 24 meses, según se detalla en la Política de Cookies.</P>
        <P>Transcurridos dichos plazos, los datos se suprimen o anonimizan, salvo bloqueo legal para la atención de responsabilidades.</P>
      </Section>

      <Section title="5. Destinatarios y Encargados del Tratamiento">
        <P>OficioYa no vende datos personales. Se comunican datos a los siguientes prestadores, todos ellos vinculados por contrato de encargo del tratamiento conforme al art. 28 RGPD:</P>
        <P>• <B>Supabase</B> — base de datos y almacenamiento (infraestructura en la Unión Europea).</P>
        <P>• <B>Vercel</B> — alojamiento y distribución de la aplicación web.</P>
        <P>• <B>Stripe</B> — procesamiento de pagos.</P>
        <P>• <B>Resend</B> — envío de correo transaccional.</P>
        <P>• <B>Proveedor de mensajería SMS</B> — envío de códigos de verificación y copias de Acuerdos de Trabajo.</P>
        <P>• <B>Google (Google Analytics 4 y Google Ads)</B> — medición y publicidad, previo consentimiento.</P>
        <P>• <B>Meta Platforms</B> — medición y publicidad, previo consentimiento.</P>
        <P>Adicionalmente, los datos estrictamente necesarios para la prestación del servicio (nombre, teléfono, dirección y descripción del trabajo) se comunican al Profesional asignado, que actúa como responsable independiente respecto del contrato de ejecución que celebre contigo.</P>
        <P>También podrán comunicarse datos a administraciones públicas, juzgados y fuerzas y cuerpos de seguridad cuando exista obligación legal, y a asesores legales o fiscales en el marco de la defensa de derechos.</P>
      </Section>

      <Section title="6. Transferencias Internacionales">
        <P>Algunos de los prestadores indicados están establecidos fuera del Espacio Económico Europeo o pueden acceder a datos desde terceros países, en particular Estados Unidos. Dichas transferencias se amparan en las Cláusulas Contractuales Tipo aprobadas por la Comisión Europea, en el Marco de Privacidad de Datos UE-EE.UU. cuando el prestador esté adherido, o en las garantías adicionales que en cada caso resulten aplicables. Puedes solicitar información sobre las garantías aplicadas escribiendo a admin@algoracompound.com.</P>
      </Section>

      <Section title="7. Tus Derechos">
        <P>Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento, portabilidad y a no ser objeto de decisiones automatizadas, así como retirar el consentimiento prestado.</P>
        <P>Para ello, escribe a admin@algoracompound.com indicando el derecho que deseas ejercer. Podremos solicitarte documentación que acredite tu identidad únicamente cuando existan dudas razonables sobre la misma. Responderemos en el plazo máximo de un mes, ampliable a dos meses en casos de especial complejidad.</P>
        <P>Si consideras que el tratamiento no se ajusta a la normativa, puedes presentar una reclamación ante la Agencia Española de Protección de Datos (www.aepd.es, C/ Jorge Juan 6, 28001 Madrid).</P>
      </Section>

      <Section title="8. Seguridad">
        <P>Aplicamos medidas técnicas y organizativas apropiadas al riesgo: cifrado en tránsito mediante HTTPS/TLS, control de acceso por roles, políticas de seguridad a nivel de fila en la base de datos, almacenamiento de firmas y documentos en repositorios privados con acceso mediante enlaces temporales, y registro de auditoría de las operaciones relevantes. En caso de violación de seguridad que suponga un riesgo alto para tus derechos, te informaremos sin dilación indebida.</P>
      </Section>

      <Section title="9. Menores de Edad">
        <P>OficioYa no está dirigida a menores de 18 años y no recaba conscientemente sus datos. Si detectamos que se han facilitado datos de un menor, procederemos a su supresión.</P>
      </Section>

      <Section title="10. Cookies">
        <P>OficioYa utiliza cookies y tecnologías similares. Las cookies técnicas necesarias para el funcionamiento del servicio se instalan sin necesidad de consentimiento. Las cookies analíticas y publicitarias requieren tu consentimiento previo, que puedes otorgar, denegar o modificar en cualquier momento desde el panel de configuración de cookies. El detalle de las cookies utilizadas, su finalidad y su duración figura en la Política de Cookies.</P>
      </Section>

      <Section title="11. Cambios en esta Política">
        <P>Esta Política puede actualizarse por motivos legales, técnicos u operativos. Cada versión se identifica mediante número de versión y fecha. Los cambios sustanciales se comunicarán a través de la plataforma o por correo electrónico.</P>
      </Section>

      <LegalFooter/>
    </div>
  );
}

function Section({title,children}:{title:string;children:React.ReactNode}){
  return <div style={{marginBottom:36}}><h2 style={{fontSize:18,fontWeight:800,color:"#FFD700",marginBottom:14,paddingBottom:8,borderBottom:"1px solid #1E1E30"}}>{title}</h2>{children}</div>;
}
function Sub({children}:{children:React.ReactNode}){
  return <h3 style={{fontSize:15,fontWeight:700,color:"#F0F0FA",margin:"16px 0 8px"}}>{children}</h3>;
}
function P({children}:{children:React.ReactNode}){
  return <p style={{fontSize:14,color:"#7777AA",lineHeight:1.75,marginBottom:10}}>{children}</p>;
}
function B({children}:{children:React.ReactNode}){
  return <strong style={{color:"#F0F0FA",fontWeight:700}}>{children}</strong>;
}
function Alert({children}:{children:React.ReactNode}){
  return <div style={{background:"rgba(255,215,0,0.06)",border:"1px solid rgba(255,215,0,0.2)",borderLeft:"3px solid #FFD700",borderRadius:8,padding:"12px 16px",margin:"12px 0"}}><p style={{fontSize:13,color:"#F0F0FA",lineHeight:1.7,margin:0}}>{children}</p></div>;
}
function LegalFooter(){
  return <div style={{marginTop:60,paddingTop:24,borderTop:"1px solid #1E1E30",display:"flex",gap:20,flexWrap:"wrap" as const,justifyContent:"center"}}>
    {[["Condiciones de Uso","/terminos"],["Política de Cookies","/cookies"],["Inicio","/"]].map(([l,h])=>(
      <a key={l} href={h} style={{color:"#7777AA",fontSize:12,textDecoration:"none"}}>{l}</a>
    ))}
  </div>;
}
