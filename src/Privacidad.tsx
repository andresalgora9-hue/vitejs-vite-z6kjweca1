import React from "react";
export default function Privacidad() {
  return (
    <div style={{ minHeight:"100vh", background:"#0A0A0F", color:"#F0F0FA", fontFamily:"'DM Sans',sans-serif", padding:"40px 24px", maxWidth:760, margin:"0 auto" }}>
      <a href="/" style={{ color:"#FFD700", fontSize:13, textDecoration:"none", display:"block", marginBottom:32 }}>← Volver a OfficioYa</a>
      <h1 style={{ fontSize:28, fontWeight:900, marginBottom:8 }}>Política de Privacidad</h1>
      <p style={{ color:"#7777AA", fontSize:13, marginBottom:40 }}>Última actualización: {new Date().toLocaleDateString("es-ES",{day:"numeric",month:"long",year:"numeric"})}</p>
      {[
        ["1. Responsable del Tratamiento","OfficioYa, con domicilio en Sevilla, España. Contacto: admin@algoracompound.com · www.aficioya.com"],
        ["2. Datos que Recogemos","Nombre completo, email, teléfono, datos profesionales, fotografías de trabajos, datos de pago (gestionados íntegramente por Stripe; OfficioYa no almacena datos de tarjeta), mensajes del chat, reseñas y valoraciones. También datos automáticos: IP, dispositivo, navegación y sesión."],
        ["3. Finalidad y Base Jurídica","Ejecución del contrato (art. 6.1.b RGPD): gestión de cuenta, pagos y suscripciones. Interés legítimo (art. 6.1.f RGPD): seguridad y prevención de fraudes. Consentimiento (art. 6.1.a RGPD): comunicaciones comerciales. Cumplimiento legal (art. 6.1.c RGPD): obligaciones fiscales."],
        ["4. Conservación de los Datos","Datos de cuenta: 5 años tras cancelación. Datos de facturación: 10 años. Chat: 2 años desde última actividad. Cookies: máximo 13 meses."],
        ["5. Cesión a Terceros","OfficioYa no vende datos. Puede compartirlos con: Stripe (pagos), Supabase (base de datos en la UE), Vercel (alojamiento) y autoridades públicas cuando la ley lo exija. Todos con contrato de encargado del tratamiento."],
        ["6. Tus Derechos","Acceso, rectificación, supresión, oposición, limitación, portabilidad y retirada del consentimiento. Escribe a admin@algoracompound.com adjuntando copia de tu documento de identidad. Puedes reclamar ante la AEPD (www.aepd.es)."],
        ["7. Seguridad","Aplicamos cifrado HTTPS/TLS, control de acceso por roles y auditorías periódicas de seguridad."],
        ["8. Menores","OfficioYa no está dirigida a menores de 18 años."],
        ["9. Cookies","Usamos cookies técnicas necesarias para el funcionamiento de la app y cookies de análisis (Pixel de Facebook) para medir el rendimiento de nuestras campañas. Puedes gestionar tus preferencias desde la configuración de tu navegador."],
      ].map(([t,c])=>(
        <div key={t} style={{marginBottom:28}}>
          <h2 style={{fontSize:16,fontWeight:800,color:"#FFD700",marginBottom:10,paddingBottom:6,borderBottom:"1px solid #1E1E30"}}>{t}</h2>
          <p style={{fontSize:14,color:"#7777AA",lineHeight:1.75}}>{c}</p>
        </div>
      ))}
      <div style={{marginTop:60,paddingTop:24,borderTop:"1px solid #1E1E30",display:"flex",gap:20,flexWrap:"wrap" as const,justifyContent:"center"}}>
        {[["Términos y Condiciones","/terminos"],["Política de Cancelación","/cancelacion"],["Inicio","/"]].map(([l,h])=>(
          <a key={l} href={h} style={{color:"#7777AA",fontSize:12,textDecoration:"none"}}>{l}</a>
        ))}
      </div>
    </div>
  );
}
