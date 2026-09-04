import React from "react";
const C = { bg:"#0A0A0F", text:"#F0F0FA", muted:"#7777AA", border:"#1E1E30", accent:"#FFD700" };

export const COOKIES_VERSION = "v1.0";
export const COOKIES_FECHA = "4 de septiembre de 2026";

export default function Cookies() {
  const abrirPanel = () => {
    // El panel de configuración lo expone el script de consentimiento.
    const w = window as any;
    if (typeof w.OYConsent?.abrir === "function") w.OYConsent.abrir();
    else alert("El panel de configuración de cookies no está disponible en este momento.");
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Sans',sans-serif", padding:"40px 24px", maxWidth:760, margin:"0 auto" }}>
      <a href="/" style={{ color:C.accent, fontSize:13, textDecoration:"none", display:"block", marginBottom:32 }}>← Volver a OficioYa</a>
      <h1 style={{ fontSize:28, fontWeight:900, marginBottom:8 }}>Política de Cookies</h1>
      <p style={{ color:C.muted, fontSize:13, marginBottom:32 }}>Versión {COOKIES_VERSION} · {COOKIES_FECHA}</p>

      <div style={{background:"rgba(255,215,0,0.06)",border:"1px solid rgba(255,215,0,0.2)",borderRadius:10,padding:"18px 20px",marginBottom:40}}>
        <p style={{fontSize:14,color:C.text,lineHeight:1.7,margin:"0 0 14px"}}>Puedes otorgar, denegar o modificar tu consentimiento en cualquier momento, con la misma facilidad con la que lo prestaste.</p>
        <button onClick={abrirPanel} style={{background:C.accent,color:"#0A0A0F",border:"none",borderRadius:8,padding:"11px 20px",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>Configurar cookies</button>
      </div>

      <Section title="1. Responsable">
        <P>Andrés Algora Fernández, empresario individual (nombre comercial OficioYa), NIF 77860535S, con domicilio en C/ Condes de Bustillo 5, Bajo D, 41010 Sevilla, España. Contacto: admin@algoracompound.com</P>
        <P>Esta Política de Cookies se aplica al sitio web www.aficioya.com, a sus páginas de destino y a la aplicación web progresiva (PWA) de OficioYa.</P>
      </Section>

      <Section title="2. Qué son las Cookies">
        <P>Una cookie es un pequeño archivo de datos que se descarga en tu dispositivo al acceder a determinadas páginas web y que permite almacenar y recuperar información sobre tu navegación. Esta Política se refiere igualmente a otras tecnologías de finalidad equivalente, como el almacenamiento local del navegador (localStorage y sessionStorage), los píxeles de seguimiento, las etiquetas y los identificadores de dispositivo, a los que resulta aplicable el artículo 22.2 de la Ley 34/2002 (LSSI-CE).</P>
      </Section>

      <Section title="3. Cookies Propias y de Terceros">
        <P>Las cookies <B>propias</B> son las gestionadas directamente por OficioYa. Las cookies <B>de terceros</B> son las gestionadas por prestadores ajenos (Google y Meta, principalmente) que tratan la información obtenida conforme a sus propias políticas de privacidad, sobre las que OficioYa no tiene control.</P>
      </Section>

      <Section title="4. Cookies Técnicas o Necesarias">
        <P>Son imprescindibles para el funcionamiento del sitio y la prestación de los servicios que solicitas expresamente. Están exentas del deber de obtener consentimiento conforme al artículo 22.2 LSSI. Si las bloqueas, el servicio puede dejar de funcionar correctamente.</P>
        <Tabla filas={[
          ["sb-access-token","Propia (Supabase)","Mantener la sesión iniciada.","1 hora"],
          ["sb-refresh-token","Propia (Supabase)","Renovar la sesión sin volver a introducir credenciales.","Hasta 30 días"],
          ["oy_consent","Propia","Almacenar tus preferencias de consentimiento de cookies.","6 meses"],
          ["oy_lead_ctx","Propia","Conservar la ciudad, la zona y el origen de la solicitud durante el proceso de presupuesto.","Sesión"],
          ["localStorage / sessionStorage","Propia","Estado de la aplicación, borradores de formulario y preferencias de interfaz.","Hasta borrado manual"],
        ]}/>
      </Section>

      <Section title="5. Cookies Analíticas">
        <P>Permiten medir y analizar el uso del sitio para mejorar el servicio. <B>Requieren tu consentimiento previo</B> y no se instalan hasta que lo otorgas.</P>
        <Tabla filas={[
          ["_ga","Google Analytics 4","Distinguir usuarios de forma estadística.","24 meses"],
          ["_ga_S6F18YG34M","Google Analytics 4","Mantener el estado de la sesión de análisis.","24 meses"],
        ]}/>
        <P>Prestador: Google Ireland Limited. Los datos pueden tratarse fuera del Espacio Económico Europeo con las garantías descritas en la cláusula 9.</P>
      </Section>

      <Section title="6. Cookies Publicitarias y de Medición de Campañas">
        <P>Permiten medir la eficacia de nuestras campañas publicitarias y mostrar anuncios relevantes. <B>Requieren tu consentimiento previo</B> y no se instalan hasta que lo otorgas.</P>
        <Tabla filas={[
          ["_gcl_au","Google Ads","Atribuir conversiones procedentes de anuncios.","90 días"],
          ["_gcl_aw","Google Ads","Registrar la llegada desde un anuncio (parámetro gclid).","90 días"],
          ["_fbp","Meta (Píxel 2460836967768276)","Medir y atribuir campañas en Facebook e Instagram.","90 días"],
          ["_fbc","Meta","Registrar la llegada desde un anuncio de Meta.","90 días"],
        ]}/>
        <P>Prestadores: Google Ireland Limited y Meta Platforms Ireland Limited.</P>
      </Section>

      <Section title="7. Notificaciones Push">
        <P>Si aceptas recibir notificaciones, tu navegador genera un identificador técnico de suscripción que almacenamos para poder enviarte avisos sobre tus solicitudes. No es una cookie, pero requiere igualmente tu consentimiento expreso, que otorgas a través del propio navegador. Puedes revocarlo en cualquier momento desde la configuración de permisos del sitio en tu navegador o dispositivo.</P>
      </Section>

      <Section title="8. Cómo Gestionamos tu Consentimiento">
        <P>Al acceder por primera vez se muestra un panel informativo que te permite <B>aceptar todas</B>, <B>rechazar todas</B> o <B>configurar por categorías</B>. Las tres opciones se presentan con el mismo nivel de visibilidad y accesibilidad.</P>
        <Alert>Hasta que no prestas tu consentimiento no se instala ninguna cookie analítica ni publicitaria, ni se ejecutan los correspondientes scripts de terceros. Continuar navegando, desplazarse por la página o cerrar el aviso <B>no</B> se consideran formas válidas de aceptación. Rechazar las cookies no limita el acceso a ninguna funcionalidad del servicio.</Alert>
        <P>Aplicamos el Modo de Consentimiento (Consent Mode) de Google, de forma que las etiquetas de medición ajustan su comportamiento a la decisión que hayas tomado.</P>
        <P>Tu decisión se conserva durante un máximo de 6 meses, transcurridos los cuales volveremos a solicitarla. También volveremos a solicitarla si se incorporan nuevas finalidades o prestadores. Puedes modificarla en cualquier momento mediante el botón situado al inicio de esta página o el enlace permanente del pie del sitio.</P>
      </Section>

      <Section title="9. Transferencias Internacionales">
        <P>Google y Meta pueden tratar datos fuera del Espacio Económico Europeo, en particular en Estados Unidos. Dichas transferencias se amparan en las Cláusulas Contractuales Tipo aprobadas por la Comisión Europea, en el Marco de Privacidad de Datos UE-EE.UU. cuando el prestador esté adherido, y en las medidas complementarias que en cada caso resulten aplicables. Puedes solicitar información adicional en admin@algoracompound.com.</P>
      </Section>

      <Section title="10. Gestión desde el Navegador">
        <P>Con independencia del panel de configuración de OficioYa, puedes eliminar o bloquear cookies desde los ajustes de tu navegador. Ten en cuenta que el bloqueo de las cookies técnicas puede impedir el funcionamiento del servicio.</P>
        <P>• Google Chrome: Configuración → Privacidad y seguridad → Cookies y otros datos de sitios.</P>
        <P>• Mozilla Firefox: Ajustes → Privacidad y seguridad → Cookies y datos del sitio.</P>
        <P>• Safari: Preferencias → Privacidad → Gestionar datos de sitios web.</P>
        <P>• Microsoft Edge: Configuración → Cookies y permisos del sitio.</P>
        <P>• Android e iOS: ajustes de privacidad del navegador o del sistema operativo.</P>
      </Section>

      <Section title="11. Tratamiento de Datos y Derechos">
        <P>La información obtenida mediante cookies se trata conforme a nuestra <A href="/privacidad">Política de Privacidad</A>. La base jurídica del tratamiento derivado de cookies no necesarias es tu consentimiento (art. 6.1.a RGPD), que puedes retirar en cualquier momento sin que ello afecte a la licitud del tratamiento anterior.</P>
        <P>Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a admin@algoracompound.com, y presentar una reclamación ante la Agencia Española de Protección de Datos (www.aepd.es).</P>
      </Section>

      <Section title="12. Actualizaciones">
        <P>Esta Política puede actualizarse cuando se incorporen nuevas cookies, finalidades o prestadores, o por cambios normativos. Cada versión se identifica mediante número de versión y fecha. Te recomendamos revisarla periódicamente.</P>
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
  return <div style={{background:"rgba(255,215,0,0.06)",border:"1px solid rgba(255,215,0,0.2)",borderLeft:"3px solid #FFD700",borderRadius:8,padding:"12px 16px",margin:"12px 0"}}><p style={{fontSize:13,color:"#F0F0FA",lineHeight:1.7,margin:0}}>{children}</p></div>;
}
function Tabla({filas}:{filas:string[][]}){
  return (
    <div style={{overflowX:"auto" as const,margin:"14px 0"}}>
      <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:12.5,minWidth:520}}>
        <thead>
          <tr>
            {["Cookie","Titular","Finalidad","Duración"].map(h=>(
              <th key={h} style={{textAlign:"left" as const,color:"#FFD700",fontWeight:700,padding:"8px 10px",borderBottom:"1px solid #1E1E30",whiteSpace:"nowrap" as const}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f,i)=>(
            <tr key={i}>
              {f.map((c,j)=>(
                <td key={j} style={{color: j===0?"#F0F0FA":"#7777AA",padding:"9px 10px",borderBottom:"1px solid #14141F",lineHeight:1.6,verticalAlign:"top" as const}}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function LegalFooter(){
  return <div style={{marginTop:60,paddingTop:24,borderTop:"1px solid #1E1E30",display:"flex",gap:20,flexWrap:"wrap" as const,justifyContent:"center"}}>
    {[["Condiciones de Uso","/terminos"],["Política de Privacidad","/privacidad"],["Inicio","/"]].map(([l,h])=>(
      <a key={l} href={h} style={{color:"#7777AA",fontSize:12,textDecoration:"none"}}>{l}</a>
    ))}
  </div>;
}
