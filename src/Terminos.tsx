import React from "react";
const C = { bg:"#0A0A0F", text:"#F0F0FA", muted:"#7777AA", border:"#1E1E30", accent:"#FFD700" };

export const TERMINOS_VERSION = "v2.1";
export const TERMINOS_FECHA = "14 de noviembre de 2026";

export default function Terminos() {
  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Sans',sans-serif", padding:"40px 24px", maxWidth:760, margin:"0 auto" }}>
      <a href="/" style={{ color:C.accent, fontSize:13, textDecoration:"none", display:"block", marginBottom:32 }}>← Volver a OficioYa</a>
      <h1 style={{ fontSize:28, fontWeight:900, marginBottom:8 }}>Condiciones de Uso de la Plataforma</h1>
      <p style={{ color:C.muted, fontSize:13, marginBottom:40 }}>Versión {TERMINOS_VERSION} · {TERMINOS_FECHA}</p>

      <Section title="1. Información Legal del Titular">
        <P>En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de los siguientes datos:</P>
        <P>• Titular: Andrés Algora Marín, empresario individual.</P>
        <P>• NIF: 77860535S.</P>
        <P>• Domicilio: C/ Condes de Bustillo 5, Bajo D, 41010 Sevilla, España.</P>
        <P>• Correo electrónico: admin@algoracompound.com</P>
        <P>• Sitio web: www.aficioya.com</P>
        <P>• Nombre comercial: OficioYa.</P>
      </Section>

      <Section title="2. Objeto y Naturaleza del Servicio">
        <P>OficioYa es una plataforma digital de intermediación que pone en contacto a particulares y empresas que necesitan servicios profesionales ("Clientes") con profesionales autónomos o empresas que ofrecen dichos servicios ("Profesionales"). OficioYa actúa exclusivamente como prestador de servicios de la sociedad de la información en el sentido de la LSSI, limitándose a facilitar dicho contacto y las herramientas de gestión asociadas.</P>
        <Alert>OficioYa NO es parte del contrato de prestación de servicios que se celebra entre Cliente y Profesional. OficioYa no ejecuta trabajos, no elabora presupuestos, no fija precios, no supervisa la ejecución de los servicios y no interviene en la relación mercantil entre las partes. La gestión operativa de solicitudes por parte del equipo de OficioYa, incluida la asignación de una solicitud a un Profesional concreto, se realiza en calidad de mero intermediario y no altera esta naturaleza ni convierte a OficioYa en contratista, subcontratista o garante de la obra.</Alert>
      </Section>

      <Section title="3. Condición de los Usuarios">
        <P>Los Profesionales utilizan OficioYa en el marco de su actividad empresarial o profesional, por lo que no tienen la condición de consumidores en su relación con OficioYa y no les resulta de aplicación el Texto Refundido de la Ley General para la Defensa de los Consumidores y Usuarios (TRLGDCU), sin perjuicio de los derechos que OficioYa les reconozca voluntariamente en estas Condiciones y en el contrato suscrito con cada uno de ellos.</P>
        <P>Los Clientes que actúen como consumidores conservan íntegros los derechos que les reconoce la legislación imperativa aplicable. Nada en estas Condiciones limita, excluye ni menoscaba derechos irrenunciables de los consumidores.</P>
        <P>En caso de contradicción entre estas Condiciones y el contrato suscrito individualmente con un Profesional, prevalecerá lo dispuesto en dicho contrato.</P>
      </Section>

      <Section title="4. Acceso, Registro y Solicitudes">
        <P>El Cliente puede enviar una solicitud a través de los formularios y de los botones de llamada o de WhatsApp de la web y de los anuncios de OficioYa, facilitando los datos mínimos necesarios (nombre, teléfono de contacto, localidad y descripción del trabajo). Al enviarla, OficioYa crea automáticamente un área de cliente asociada a su teléfono, desde la que puede consultar su solicitud y el Profesional asignado. Para conservar el acceso y utilizar las demás funcionalidades (historial, mensajería, gestión de solicitudes) el Cliente puede completar su registro con un correo electrónico y una contraseña.</P>
        <P>Al enviar una solicitud, el Cliente pide ser contactado y acepta que el Profesional asignado y OficioYa le llamen o le escriban, por teléfono, WhatsApp o correo electrónico, en relación con dicha solicitud.</P>
        <P>El usuario garantiza que los datos facilitados son veraces, que es mayor de 18 años, que dispone de capacidad legal para aceptar estas Condiciones y que mantendrá la confidencialidad de sus credenciales. El usuario es responsable de toda la actividad realizada desde su cuenta.</P>
        <P>Cuando el Cliente accede facilitando únicamente su número de teléfono, OficioYa genera una dirección de correo técnica de carácter interno. El Cliente puede sustituirla en cualquier momento por su dirección real desde su perfil.</P>
        <P>OficioYa se reserva el derecho de suspender o cancelar cuentas, con carácter temporal o definitivo, si detecta uso fraudulento, datos falsos, incumplimiento de estas Condiciones, impago o conductas que puedan dañar a otros usuarios o a la plataforma.</P>
      </Section>

      <Section title="5. Selección de Profesionales">
        <P>OficioYa selecciona a los Profesionales que incorpora a la plataforma y suscribe con cada uno de ellos un contrato en el que el Profesional declara y garantiza disponer de la titulación, licencias, permisos, altas administrativas y seguros exigibles para el ejercicio de su actividad.</P>
        <Alert>Dicha declaración es responsabilidad exclusiva del Profesional. OficioYa no certifica, avala ni garantiza la veracidad ni la vigencia de la documentación declarada, ni la solvencia, cualificación técnica, calidad, legalidad o resultado de los trabajos del Profesional. La presencia de un Profesional en la plataforma no constituye recomendación ni garantía de OficioYa. Corresponde al Cliente realizar las comprobaciones que estime oportunas antes de contratar.</Alert>
        <P>Cuando la web se refiere a Profesionales «verificados», «comprobados» o «seleccionados», quiere decir que el Profesional ha firmado dicho contrato con las declaraciones anteriores y que OficioYa puede requerirle en cualquier momento la documentación que las acredite. El seguimiento que el equipo de OficioYa pueda hacer de una solicitud (por ejemplo, contactar con el Cliente o con el Profesional para saber si ha sido atendida, orientar al Cliente sobre precios habituales o recoger su opinión) es un acompañamiento voluntario: no constituye dirección ni supervisión técnica de los trabajos, no fija ni aprueba el precio, que decide el Profesional y acepta el Cliente, y no supone garantía de resultado ni asunción de responsabilidad por la actuación del Profesional.</P>
        <P>OficioYa podrá retirar de la plataforma a cualquier Profesional, sin necesidad de justificación previa, cuando existan indicios de incumplimiento, reclamaciones reiteradas o cualquier circunstancia que a su juicio afecte a la confianza en el servicio.</P>
      </Section>

      <Section title="6. Modelo Económico">
        <Sub>6.1 Gratuidad para el Cliente</Sub>
        <Alert>El uso de OficioYa es totalmente gratuito para el Cliente. El Cliente no abona a OficioYa cantidad alguna, ni en concepto de registro, solicitud, intermediación, comisión ni por ningún otro concepto. El precio que el Cliente paga es exclusivamente el pactado con el Profesional por el trabajo realizado.</Alert>
        <Sub>6.2 Cesión de la solicitud a un Profesional</Sub>
        <P>OficioYa cede las solicitudes de los Clientes, directamente y a cambio de un precio, a Profesionales independientes del oficio y de la zona solicitados. Al enviar su solicitud, el Cliente acepta que sus datos de contacto y la descripción del trabajo se comuniquen al Profesional para que este le contacte y le presupueste. Cada solicitud se entrega a un único Profesional: OficioYa no envía una misma solicitud a varios Profesionales a la vez.</P>
        <P>El Profesional paga a OficioYa el precio pactado en su contrato por cada solicitud que recibe. Con carácter general se trata de un precio fijo por solicitud, que se devenga por la entrega del contacto, con independencia de que el Cliente llegue a contratar y del importe del trabajo, y no de una comisión o porcentaje sobre el trabajo.</P>
        <Sub>6.3 Profesional independiente y responsabilidad</Sub>
        <P>El Profesional es un autónomo o una empresa independiente de OficioYa. En su contrato declara, bajo su exclusiva responsabilidad, que ejerce su actividad de forma legal, que está dado de alta como trabajador autónomo o como sociedad en la actividad correspondiente, que cuenta con la cualificación y los medios necesarios y que mantiene en vigor un seguro de responsabilidad civil. Actúa con total autonomía, con sus propios medios, precios y personal, sin relación laboral, societaria, de agencia ni de representación con OficioYa.</P>
        <Alert>El contrato de obra o servicio se celebra exclusivamente entre el Cliente y el Profesional. El Profesional fija el presupuesto, cobra directamente al Cliente y es el único responsable de la ejecución, la calidad y los plazos del trabajo, de los materiales, de los daños que pueda causar, de la garantía legal y de la atención de las reclamaciones. OficioYa no presta el servicio, no presupuesta, no ejecuta, no supervisa ni garantiza los trabajos, no es parte en ese contrato y no asume responsabilidad alguna derivada de la relación entre el Cliente y el Profesional, en los términos de las cláusulas 8 y 11.</Alert>
        <Sub>6.4 Ausencia de garantía de resultados</Sub>
        <P>OficioYa proporciona visibilidad y herramientas de contacto y gestión. OficioYa no garantiza al Profesional un número mínimo de solicitudes, presupuestos, trabajos ni ingresos de ningún tipo, ni garantiza al Cliente la disponibilidad de un Profesional en un plazo determinado.</P>
      </Section>

      <Section title="7. Presupuesto, Contratación y Pago del Trabajo">
        <Sub>7.1 Precios orientativos</Sub>
        <P>Los precios, rangos y cálculos que muestran la web, la calculadora de presupuesto y las guías de OficioYa son estimaciones orientativas y no vinculantes. No constituyen una oferta ni un presupuesto vinculante de OficioYa ni del Profesional. El precio del trabajo es el que el Profesional presupueste al Cliente tras conocer el trabajo concreto.</P>
        <Sub>7.2 Contratación directa con el Profesional</Sub>
        <Alert>El presupuesto, su aceptación, las condiciones del trabajo, la factura y el pago se acuerdan y se realizan directamente entre el CLIENTE y el PROFESIONAL. OficioYa no es parte de ese contrato, no cobra ni custodia cantidad alguna por cuenta de ninguno de ellos y no interviene en su negociación, celebración, ejecución ni pago.</Alert>
        <Sub>7.3 Documentación que debe entregar el Profesional</Sub>
        <P>El Profesional está obligado frente al Cliente, conforme a la normativa de consumo, a entregarle presupuesto y factura, a informarle de las condiciones y de la garantía del servicio y a disponer de hojas de reclamaciones. Se recomienda al Cliente pedir el presupuesto por escrito antes del inicio de los trabajos y conservar la factura.</P>
        <Sub>7.4 Herramientas de la plataforma</Sub>
        <P>La plataforma puede ofrecer al Cliente y al Profesional herramientas para anotar presupuestos, intercambiar mensajes o registrar el estado de una solicitud. Su uso es voluntario y meramente informativo: no sustituye al presupuesto, al contrato ni a la factura del Profesional, ni convierte a OficioYa en parte de la relación entre ambos.</P>
      </Section>

      <Section title="8. Obligaciones y Responsabilidad de los Profesionales">
        <P>Los Profesionales declaran y garantizan: (i) contar con la titulación, licencias, permisos, altas administrativas y seguros exigibles para su actividad, y mantenerlos vigentes; (ii) estar dados de alta en los regímenes fiscales y de Seguridad Social que correspondan; (iii) entregar al Cliente presupuesto y factura por la totalidad del trabajo realizado, informarle conforme a la normativa de consumo y disponer de hojas de reclamaciones; (iv) publicar información veraz y actualizada; (v) cumplir la normativa aplicable en la ejecución de sus trabajos; (vi) actuar con plena independencia, con sus propios medios, organización y asunción del riesgo empresarial, sin que exista relación laboral, societaria ni de agencia con OficioYa; (vii) utilizar los datos del Cliente únicamente para atender su solicitud, sin cederlos a terceros; y (viii) no presentarse ante el Cliente como empleados, socios o representantes de OficioYa.</P>
        <P>Los Profesionales son los únicos responsables de la ejecución de los trabajos contratados con los Clientes, de sus vicios o defectos y de las garantías legales aplicables, y mantendrán indemne a OficioYa frente a cualquier reclamación, sanción, daño o gasto (incluidos honorarios razonables de defensa jurídica) derivados de sus trabajos, de la inexactitud de sus declaraciones o del incumplimiento de estas Condiciones.</P>
        <Alert>OficioYa no es empleador de ningún Profesional y no asume responsabilidad alguna derivada de la relación entre el Profesional y el Cliente.</Alert>
      </Section>

      <Section title="9. Contenidos de los Usuarios">
        <P>Los usuarios son los únicos responsables de los contenidos que publiquen (perfiles, páginas de Profesional, fotografías, mensajes, reseñas y valoraciones). Al publicar reseñas, el usuario declara que reflejan una experiencia real y propia. OficioYa, como prestador de servicios de alojamiento de datos conforme al artículo 16 LSSI, no tiene obligación general de supervisión de dichos contenidos, sin perjuicio de su derecho a retirar aquellos que sean ilícitos, falsos, ofensivos o contrarios a estas Condiciones en cuanto tenga conocimiento efectivo de ello.</P>
      </Section>

      <Section title="10. Reclamaciones y Disputas entre Usuarios">
        <P>Cualquier controversia derivada de la contratación, ejecución, calidad o pago de un servicio corresponde exclusivamente al Cliente y al Profesional implicados, quienes deberán resolverla directamente entre sí.</P>
        <P>No obstante, el Cliente puede comunicar cualquier incidencia a OficioYa a través de admin@algoracompound.com. OficioYa acusará recibo y la trasladará al Profesional, que es quien debe responder al Cliente, y podrá facilitar al Cliente los datos identificativos del Profesional para que pueda dirigirle su reclamación. OficioYa podrá además, a su sola discreción y sin obligación alguna, facilitar la comunicación entre las partes, aportar la documentación que obre en su poder o adoptar medidas sobre la cuenta del Profesional, incluida su retirada de la plataforma. Dicha intervención no constituye asunción de responsabilidad ni convierte a OficioYa en parte, árbitro o garante de la controversia.</P>
      </Section>

      <Section title="11. Limitación de Responsabilidad">
        <P>En la máxima medida permitida por la ley, y salvo en los supuestos de dolo o culpa grave imputables a OficioYa, OficioYa no será responsable de: la calidad, legalidad, puntualidad, seguridad o resultado de los servicios prestados por los Profesionales; los daños materiales o personales causados durante la ejecución de dichos servicios; los daños derivados de la relación entre usuarios; las conductas fraudulentas de terceros; la veracidad de los datos facilitados por los usuarios, su identidad o su solvencia; las interrupciones, errores o indisponibilidades técnicas de la plataforma o de los servicios de terceros de los que depende (alojamiento, pagos, mensajería, notificaciones); la pérdida de datos; ni el lucro cesante o daños indirectos de cualquier naturaleza.</P>
        <P>Sin perjuicio de lo anterior, y únicamente respecto de los daños directamente imputables a OficioYa, su responsabilidad total y acumulada frente a un usuario, por cualquier causa, no excederá de la mayor de las siguientes cantidades: (i) el importe efectivamente abonado por dicho usuario a OficioYa durante los doce meses anteriores al evento que dé lugar a la reclamación; o (ii) quinientos euros (500 €).</P>
        <Alert>Esta limitación no será de aplicación en los supuestos en que la ley imperativa lo prohíba, ni afectará a los derechos que la legislación de consumo reconoce a los Clientes que actúen como consumidores, ni a la responsabilidad por daños personales causados por dolo o culpa grave de OficioYa.</Alert>
      </Section>

      <Section title="12. Fuerza Mayor">
        <P>OficioYa no responderá por incumplimientos causados por circunstancias fuera de su control razonable, incluyendo, entre otras, fallos generalizados de red o de proveedores esenciales, ciberataques, catástrofes, decisiones de autoridades o cualquier otro supuesto de fuerza mayor o caso fortuito.</P>
      </Section>

      <Section title="13. Protección de Datos">
        <P>El tratamiento de los datos personales de los usuarios se rige por la Política de Privacidad, que forma parte integrante de estas Condiciones y que el usuario declara conocer y aceptar. El uso de cookies y tecnologías similares se rige por la Política de Cookies.</P>
      </Section>

      <Section title="14. Propiedad Intelectual">
        <P>La plataforma, su código, diseño, marca, logotipos y contenidos propios son titularidad de OficioYa o de sus licenciantes. Queda prohibida su reproducción, extracción sistemática de datos (scraping), ingeniería inversa o cualquier uso no autorizado. Los usuarios conservan la titularidad de sus contenidos y conceden a OficioYa una licencia no exclusiva, gratuita y mundial para alojarlos, reproducirlos y mostrarlos en la plataforma y en comunicaciones de la propia plataforma mientras la cuenta permanezca activa.</P>
      </Section>

      <Section title="15. Modificación de las Condiciones">
        <P>OficioYa podrá modificar estas Condiciones por razones legales, técnicas u operativas. Cada versión se identifica mediante número de versión y fecha. Las modificaciones sustanciales se comunicarán con antelación razonable a través de la plataforma o por correo electrónico. El uso continuado del servicio tras la entrada en vigor de las modificaciones constituye aceptación de las mismas. Si el usuario no está conforme, podrá cancelar su cuenta antes de dicha fecha. Las modificaciones no afectarán a los contratos suscritos individualmente con los Profesionales, que se rigen por sus propios términos.</P>
      </Section>

      <Section title="16. Nulidad Parcial">
        <P>Si cualquier estipulación de estas Condiciones fuera declarada nula o inaplicable, total o parcialmente, dicha declaración no afectará a la validez del resto de estipulaciones, que conservarán plena eficacia. La cláusula afectada se sustituirá o interpretará en el sentido válido más próximo a su finalidad económica y jurídica.</P>
      </Section>

      <Section title="17. Legislación Aplicable y Jurisdicción">
        <P>Estas Condiciones se rigen por la legislación española. Para cualquier controversia con Profesionales u otros usuarios que actúen en el marco de su actividad empresarial o profesional, las partes se someten expresamente a los Juzgados y Tribunales de Sevilla, con renuncia a cualquier otro fuero.</P>
        <P>En las controversias con usuarios que tengan la condición de consumidores será competente el juzgado que determine la legislación imperativa aplicable, sin que la sumisión anterior les resulte oponible. Los consumidores pueden asimismo dirigirse a las Juntas Arbitrales de Consumo o a los servicios de consumo de su comunidad autónoma.</P>
        <P>Contacto: admin@algoracompound.com</P>
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
    {[["Política de Privacidad","/privacidad"],["Política de Cookies","/cookies"],["Inicio","/"]].map(([l,h])=>(
      <a key={l} href={h} style={{color:"#7777AA",fontSize:12,textDecoration:"none"}}>{l}</a>
    ))}
  </div>;
}
