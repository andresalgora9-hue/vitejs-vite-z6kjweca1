import React from "react";
const C = { bg:"#0A0A0F", text:"#F0F0FA", muted:"#7777AA", border:"#1E1E30", accent:"#FFD700" };
export default function Terminos() {
  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Sans',sans-serif", padding:"40px 24px", maxWidth:760, margin:"0 auto" }}>
      <a href="/" style={{ color:C.accent, fontSize:13, textDecoration:"none", display:"block", marginBottom:32 }}>← Volver a OficioYa</a>
      <h1 style={{ fontSize:28, fontWeight:900, marginBottom:8 }}>Términos y Condiciones de Uso</h1>
      <p style={{ color:C.muted, fontSize:13, marginBottom:40 }}>Última actualización: 10 de julio de 2026</p>

      <Section title="1. Objeto y Naturaleza del Servicio">
        <P>OficioYa es una plataforma digital de intermediación que conecta a particulares y empresas que necesitan servicios profesionales ("Clientes") con profesionales autónomos o empresas que ofrecen dichos servicios ("Profesionales"). OficioYa actúa exclusivamente como prestador de servicios de la sociedad de la información en el sentido de la Ley 34/2002 (LSSI), limitándose a la puesta en contacto entre las partes.</P>
        <Alert>OficioYa NO es parte de ningún contrato de prestación de servicios entre Cliente y Profesional. OficioYa no ejecuta trabajos, no elabora presupuestos, no supervisa la ejecución de los servicios y no interviene en la relación mercantil entre las partes. La gestión operativa de solicitudes por parte del equipo de OficioYa (por ejemplo, la asignación manual de una solicitud a un Profesional) se realiza igualmente en calidad de mero intermediario y no altera esta naturaleza.</Alert>
      </Section>

      <Section title="2. Condición de los Usuarios">
        <P>Los Profesionales contratan los servicios de OficioYa en el marco de su actividad empresarial o profesional, por lo que no tienen la condición de consumidores ni les resulta de aplicación el Texto Refundido de la Ley General para la Defensa de los Consumidores y Usuarios (TRLGDCU) en su relación con OficioYa, sin perjuicio de los derechos que OficioYa les reconozca voluntariamente en estos Términos y en la Política de Cancelación.</P>
        <P>Los Clientes que actúen como consumidores conservan íntegros los derechos que les reconoce la legislación imperativa aplicable. Nada en estos Términos limita derechos irrenunciables de los consumidores.</P>
      </Section>

      <Section title="3. Registro y Acceso">
        <P>Para utilizar OficioYa es necesario registrarse y crear una cuenta. El usuario garantiza que los datos proporcionados son verídicos, que es mayor de 18 años, que dispone de capacidad legal para aceptar estos Términos y que mantendrá la confidencialidad de sus credenciales de acceso. El usuario es responsable de toda la actividad realizada desde su cuenta.</P>
        <P>OficioYa se reserva el derecho de suspender o cancelar cuentas, con carácter temporal o definitivo, si detecta uso fraudulento, datos falsos, incumplimiento de estos Términos, impago o conductas que puedan dañar a otros usuarios o a la plataforma.</P>
      </Section>

      <Section title="4. Verificación de Profesionales">
        <P>OficioYa puede realizar comprobaciones documentales básicas sobre los Profesionales (identidad, alta de actividad u otra documentación declarada) en el momento del registro o posteriormente. El distintivo "verificado" o similar indica únicamente que dicha comprobación documental se realizó en un momento determinado.</P>
        <Alert>La verificación NO constituye garantía, aval ni recomendación de OficioYa sobre el Profesional, ni asegura la vigencia posterior de licencias, seguros o altas administrativas, ni la calidad, legalidad o resultado de sus trabajos. Corresponde al Cliente realizar las comprobaciones que estime oportunas antes de contratar. OficioYa no asume responsabilidad por la inexactitud sobrevenida de la documentación aportada por los Profesionales.</Alert>
      </Section>

      <Section title="5. Planes de Suscripción y Pagos">
        <Sub>5.1 Planes disponibles</Sub>
        <P>• Plan Gratuito: acceso limitado sin coste.</P>
        <P>• Plan Básico: 9,99 EUR/mes. Perfil completo, chat con clientes, hasta 20 contactos mensuales.</P>
        <P>• Plan Pro: 24,99 EUR/mes. Contactos ilimitados, posicionamiento destacado y estadísticas avanzadas.</P>
        <P>• Plan Elite: 49,99 EUR/mes. Todas las funcionalidades, posicionamiento prioritario, badge Elite y soporte preferente.</P>
        <Sub>5.2 Período de prueba</Sub>
        <Alert>El Plan Elite incluye un período de prueba gratuito de 30 días. Al activarlo, el Profesional debe facilitar un método de pago válido y acepta expresamente las siguientes condiciones, que se le muestran de forma destacada antes de facilitar los datos de pago: (i) dispone de los primeros 15 días naturales para cancelar sin cargo alguno; (ii) las cancelaciones realizadas a partir del día 16 del período de prueba devengarán el cobro del primer mes de suscripción (49,99 EUR) al vencimiento de los 30 días. La continuación del proceso de pago constituye aceptación expresa e informada de esta condición.</Alert>
        <Sub>5.3 Facturación y renovación automática</Sub>
        <P>Las suscripciones se facturan mensualmente de manera anticipada mediante cargo automático al método de pago facilitado, gestionado por Stripe. La renovación es automática por períodos mensuales sucesivos. La cancelación debe solicitarse con al menos 15 días naturales de antelación a la fecha de renovación para evitar el cargo del período siguiente; en caso contrario, surtirá efecto al término del período ya facturado. El acceso se mantiene en todo caso hasta el final del período abonado.</P>
        <Sub>5.4 Ausencia de garantía de resultados</Sub>
        <P>OficioYa proporciona visibilidad y herramientas de contacto. OficioYa no garantiza un número mínimo de contactos, solicitudes, presupuestos ni trabajos, ni ingresos de ningún tipo. La insatisfacción con el volumen de oportunidades obtenidas no constituye incumplimiento de OficioYa.</P>
      </Section>

      <Section title="6. Obligaciones y Responsabilidad de los Profesionales">
        <P>Los Profesionales declaran y garantizan: (i) contar con la titulación, licencias, permisos y seguros exigibles para su actividad; (ii) estar dados de alta en los regímenes fiscales y de Seguridad Social que correspondan; (iii) publicar información veraz y actualizada; (iv) cumplir la normativa aplicable en la ejecución de sus trabajos; y (v) actuar con plena independencia, con sus propios medios, organización y asunción del riesgo empresarial, sin que exista relación laboral, societaria ni de agencia con OficioYa.</P>
        <P>Los Profesionales son los únicos responsables de la ejecución de los trabajos contratados directamente con los Clientes y mantendrán indemne a OficioYa frente a cualquier reclamación, sanción, daño o gasto (incluidos honorarios razonables de defensa jurídica) derivados de sus trabajos, de la inexactitud de sus declaraciones o del incumplimiento de estos Términos.</P>
        <Alert>OficioYa no es empleador de ningún Profesional y no asume responsabilidad alguna derivada de la relación entre el Profesional y el Cliente.</Alert>
      </Section>

      <Section title="7. Contenidos de los Usuarios">
        <P>Los usuarios son los únicos responsables de los contenidos que publiquen (perfiles, fotografías, mensajes, reseñas y valoraciones). Al publicar reseñas, el usuario declara que reflejan una experiencia real y propia. OficioYa, como prestador de servicios de alojamiento de datos conforme al art. 16 LSSI, no tiene obligación general de supervisión de dichos contenidos, sin perjuicio de su derecho a retirar aquellos que sean ilícitos, falsos, ofensivos o contrarios a estos Términos en cuanto tenga conocimiento efectivo de ello.</P>
      </Section>

      <Section title="8. Disputas entre Usuarios">
        <P>Cualquier controversia derivada de la contratación, ejecución o pago de un servicio corresponde exclusivamente al Cliente y al Profesional implicados. OficioYa podrá, a su sola discreción y sin obligación alguna, facilitar la comunicación entre las partes o adoptar medidas sobre las cuentas implicadas. Dicha intervención voluntaria no constituye asunción de responsabilidad ni convierte a OficioYa en parte, árbitro o garante de la controversia.</P>
      </Section>

      <Section title="9. Limitación de Responsabilidad">
        <P>En la máxima medida permitida por la ley, y salvo en los supuestos de dolo o culpa grave imputables a OficioYa, OficioYa no será responsable de: la calidad, legalidad, puntualidad o resultado de los servicios prestados por los Profesionales; los daños derivados de la relación entre usuarios; las conductas fraudulentas de terceros; las interrupciones, errores o indisponibilidades técnicas de la plataforma o de servicios de terceros de los que depende (alojamiento, pagos, notificaciones); la pérdida de datos; ni el lucro cesante o daños indirectos de cualquier naturaleza.</P>
        <P>Sin perjuicio de lo anterior, la responsabilidad total y acumulada de OficioYa frente a un usuario, por cualquier causa, no excederá del importe efectivamente abonado por dicho usuario a OficioYa durante los 3 meses anteriores al evento que dé lugar a la reclamación. Esta limitación no se aplicará en los supuestos en que la ley imperativa lo prohíba.</P>
      </Section>

      <Section title="10. Fuerza Mayor">
        <P>OficioYa no responderá por incumplimientos causados por circunstancias fuera de su control razonable, incluyendo, entre otras, fallos generalizados de red o de proveedores esenciales, ciberataques, catástrofes, decisiones de autoridades o cualquier otro supuesto de fuerza mayor o caso fortuito.</P>
      </Section>

      <Section title="11. Propiedad Intelectual">
        <P>La plataforma, su código, diseño, marca, logotipos y contenidos propios son titularidad de OficioYa o de sus licenciantes. Queda prohibida su reproducción, extracción sistemática de datos (scraping), ingeniería inversa o cualquier uso no autorizado. Los usuarios conservan la titularidad de sus contenidos y conceden a OficioYa una licencia no exclusiva, gratuita y mundial para alojarlos, reproducirlos y mostrarlos en la plataforma y en comunicaciones de la propia plataforma mientras la cuenta permanezca activa.</P>
      </Section>

      <Section title="12. Modificación de los Términos">
        <P>OficioYa podrá modificar estos Términos por razones legales, técnicas u operativas. Las modificaciones sustanciales se comunicarán con antelación razonable a través de la plataforma o por email. El uso continuado del servicio tras la entrada en vigor de las modificaciones constituye aceptación de las mismas. Si el usuario no está conforme, podrá cancelar su cuenta antes de dicha fecha.</P>
      </Section>

      <Section title="13. Nulidad Parcial">
        <P>Si cualquier estipulación de estos Términos fuera declarada nula o inaplicable, total o parcialmente, dicha declaración no afectará a la validez del resto de estipulaciones, que conservarán plena eficacia. La cláusula afectada se sustituirá o interpretará en el sentido válido más próximo a su finalidad económica y jurídica.</P>
      </Section>

      <Section title="14. Legislación Aplicable y Jurisdicción">
        <P>Los presentes Términos se rigen por la legislación española. Para cualquier controversia con Profesionales u otros usuarios que actúen en el marco de su actividad empresarial o profesional, las partes se someten expresamente a los Juzgados y Tribunales de Sevilla, con renuncia a cualquier otro fuero. En las controversias con usuarios que tengan la condición de consumidores será competente el juzgado que determine la legislación imperativa aplicable. Contacto: admin@algoracompound.com</P>
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
