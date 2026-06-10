import React from "react";
const C = { bg:"#0A0A0F", text:"#F0F0FA", muted:"#7777AA", border:"#1E1E30", accent:"#FFD700" };
export default function Terminos() {
  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Sans',sans-serif", padding:"40px 24px", maxWidth:760, margin:"0 auto" }}>
      <a href="/" style={{ color:C.accent, fontSize:13, textDecoration:"none", display:"block", marginBottom:32 }}>← Volver a oficioya</a>
      <h1 style={{ fontSize:28, fontWeight:900, marginBottom:8 }}>Términos y Condiciones de Uso</h1>
      <p style={{ color:C.muted, fontSize:13, marginBottom:40 }}>Última actualización: {new Date().toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"})}</p>

      <Section title="1. Objeto y Naturaleza del Servicio">
        <P>oficioya es una plataforma digital de intermediación que conecta a particulares y empresas que necesitan servicios profesionales ("Clientes") con profesionales autónomos o empresas que ofrecen dichos servicios ("Profesionales"). oficioya actúa exclusivamente como plataforma de puesta en contacto entre las partes.</P>
        <Alert>oficioya NO es parte de ningún contrato de prestación de servicios entre Cliente y Profesional. oficioya no ejecuta trabajos, no gestiona presupuestos entre particulares y no interviene en la relación laboral o mercantil entre las partes. oficioya no asume responsabilidad alguna por la calidad, legalidad, puntualidad o resultado de los servicios prestados por los Profesionales.</Alert>
      </Section>

      <Section title="2. Registro y Acceso">
        <P>Para utilizar oficioya es necesario registrarse y crear una cuenta. El usuario garantiza que los datos proporcionados son verídicos, que es mayor de 18 años, que dispone de capacidad legal para aceptar estos Términos y que mantendrá la confidencialidad de sus credenciales de acceso.</P>
        <P>oficioya se reserva el derecho de verificar la identidad y la cualificación profesional declarada por los Profesionales, así como de suspender o cancelar cuentas en cualquier momento si detecta uso fraudulento, datos falsos o incumplimiento de estos Términos.</P>
      </Section>

      <Section title="3. Planes de Suscripción y Pagos">
        <Sub>3.1 Planes disponibles</Sub>
        <P>• Plan Gratuito: acceso limitado sin coste.</P>
        <P>• Plan Básico: 9,99 EUR/mes. Perfil completo, chat con clientes, hasta 20 contactos mensuales.</P>
        <P>• Plan Pro: 24,99 EUR/mes. Contactos ilimitados, posicionamiento destacado y estadísticas avanzadas.</P>
        <P>• Plan Elite: 49,99 EUR/mes. Todas las funcionalidades, posicionamiento prioritario garantizado, badge Elite y soporte preferente.</P>
        <Sub>3.2 Período de prueba</Sub>
        <Alert>El Plan Elite incluye un período de prueba gratuito de 30 días. Al activarlo, el usuario debe facilitar un método de pago válido. El usuario dispone de los primeros 15 días naturales para cancelar sin cargo alguno. Las cancelaciones realizadas a partir del día 16 del período de prueba devengarán el cobro del primer mes de suscripción (49,99€) al vencimiento de los 30 días. oficioya informa expresamente de esta condición en el momento de facilitar los datos de pago.</Alert>
        <Sub>3.3 Facturación y renovación automática</Sub>
        <P>Las suscripciones se facturan mensualmente de manera anticipada mediante cargo automático al método de pago facilitado. La renovación es automática. La cancelación debe solicitarse con al menos 15 días naturales de antelación a la fecha de renovación para evitar el cargo del período siguiente.</P>
      </Section>

      <Section title="4. Responsabilidad de los Profesionales">
        <P>Los Profesionales declaran contar con la titulación, licencias y permisos necesarios, estar dados de alta en la Seguridad Social, publicar información veraz y actuar de forma independiente, sin relación laboral con oficioya. Son los únicos responsables de la ejecución de los trabajos contratados directamente con los Clientes.</P>
        <Alert>oficioya no es empleador de ningún Profesional y no asume responsabilidad alguna derivada de la relación entre el Profesional y el Cliente.</Alert>
      </Section>

      <Section title="5. Limitación de Responsabilidad">
        <P>oficioya no será responsable de la calidad de los servicios prestados por los Profesionales, interrupciones técnicas, conductas fraudulentas de usuarios, pérdida de datos o lucro cesante. La responsabilidad máxima de oficioya no excederá del importe abonado durante los 3 meses anteriores al evento que da lugar a la reclamación.</P>
      </Section>

      <Section title="6. Legislación Aplicable">
        <P>Los presentes Términos se rigen por la legislación española. Para cualquier controversia, las partes se someten a los Juzgados y Tribunales de Sevilla. Contacto: admin@algoracompound.com</P>
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
function Alert({children}:{children:React.ReactNode}){
  return <div style={{background:"rgba(255,215,0,0.06)",border:"1px solid rgba(255,215,0,0.2)",borderLeft:"3px solid #FFD700",borderRadius:8,padding:"12px 16px",margin:"12px 0"}}><p style={{fontSize:13,color:"#F0F0FA",lineHeight:1.7,margin:0}}>{children}</p></div>;
}
function LegalFooter(){
  return <div style={{marginTop:60,paddingTop:24,borderTop:"1px solid #1E1E30",display:"flex",gap:20,flexWrap:"wrap" as const,justifyContent:"center"}}>
    {[["Política de Privacidad","/privacidad"],["Política de Cancelación","/cancelacion"],["Inicio","/"]].map(([l,h])=>(
      <a key={l} href={h} style={{color:"#7777AA",fontSize:12,textDecoration:"none"}}>{l}</a>
    ))}
  </div>;
}
