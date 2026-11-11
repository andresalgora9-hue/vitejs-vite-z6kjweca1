-- ============================================================
-- OficioYa · Condiciones de la web del profesional · cambios del 11/11/2026 (tarde, Andrés)
-- Aplicado en Supabase con dos migraciones (este archivo se puede volver a lanzar sin cambiar nada):
--   1) condiciones_web_v2_en_su_web_se_cobra_todo: versión 2026-11-11.2 del texto (huella del texto
--      56c716614148bc4354028f5ab37578f44d82c2d48908442d59b5f0fe24b54b8a). La 2026-11-11 queda guardada e
--      inactiva (nadie la aceptó). En su web se cobra todo lo que entre (no se aplican las excepciones de las
--      campañas; mismo teléfono y mismo oficio en 7 días cuenta como uno) y solo se le pasan y cobran los
--      clientes de su web si está recibiendo clientes de OficioYa. Cambian el punto 3 del resumen y las
--      cláusulas 2 y 4.
--   2) condiciones_web_solo_quien_recibe_clientes: la ventana solo sale a quien recibe clientes.
-- ============================================================

-- 1) Versión 2026-11-11.2
update public.pro_condiciones_modelo set vigente = false where tipo = 'web_pro' and vigente and version <> '2026-11-11.2';

insert into public.pro_condiciones_modelo (tipo, version, titulo, resumen, texto, sha256, precio, iva_pct, vigente)
select 'web_pro', '2026-11-11.2', 'Condiciones de tu web', r, t, encode(extensions.digest(t, 'sha256'), 'hex'), 15, 21, true
from (select
$r$[
  "Tu web es gratis: la hacemos y la mantenemos nosotros, y sale en Google.",
  "Solo pagas 15 € + IVA cuando un cliente te pide presupuesto desde tu web. Los de nuestras campañas siguen a tu precio de siempre.",
  "En tu web se paga cada cliente que te pida presupuesto o te contacte, sin las excepciones de las campañas. Si repite en menos de 7 días, cuenta como uno solo.",
  "Van en tus facturas de OficioYa y se pagan igual que siempre."
]$r$::jsonb as r,
$t$CONDICIONES DE LA WEB DEL PROFESIONAL EN OFICIOYA
Versión 2026-11-11.2

Estas condiciones se suman a tu contrato con OficioYa (Andrés Algora Marín, NIF 77860535S, Calle Condes de Bustillo 5, bajo D, 41010 Sevilla). En todo lo que no digan, se aplica tu contrato.

1. Tu web
OficioYa te prepara, aloja y mantiene una página web propia dentro de aficioya.com (aficioya.com/pro/…), con tus datos, tus trabajos, tus fotos y las opiniones de tus clientes. Es pública: la puede ver cualquiera y puede salir en Google y en otros buscadores. Tenerla no te cuesta nada.

2. Precio por cliente
Cada cliente que te llegue a través de tu web cuesta 15,00 € + IVA (18,15 € con el 21 % de IVA). Es cliente de tu web quien deja sus datos en ella para pedirte presupuesto o para contactar contigo, por el formulario o para llamarte o escribirte por WhatsApp desde la web. Si deja sus datos y luego te llama o te escribe, cuenta como uno solo. Solo te pasamos (y te cobramos) los clientes de tu web mientras estés recibiendo clientes de OficioYa; si no los estás recibiendo, los atiende OficioYa y no te cuestan nada.

3. Los clientes de las campañas no cambian
Los clientes que te pasa OficioYa con sus campañas y anuncios siguen con el precio de tu contrato. Los 15,00 € + IVA son solo para los que llegan por tu web.

4. En tu web se pagan todos los clientes
Las excepciones de tu contrato para los clientes de las campañas (no conseguir hablar con él en 24 horas, que esté fuera de tu zona, que no pida un trabajo de tu oficio, etc.) no se aplican a los clientes de tu web: se paga cada cliente que deje sus datos o te contacte desde ella, también si eres tú quien prueba tu web. Si el mismo teléfono vuelve a pedir el mismo oficio en menos de 7 días, cuenta como uno solo.

5. Factura y pago
Estos clientes se suman a tus facturas de OficioYa y se pagan igual que los demás, con la misma forma de pago.

6. Lo que publicas en tu web
Lo que subas para tu web (foto o logo, presentación, fotos de trabajos, títulos…) tiene que ser tuyo o tener permiso para usarlo, y ser cierto. Nos autorizas a publicarlo en tu web y en OficioYa mientras trabajes con nosotros. Podemos quitar lo que no cumpla estas condiciones o la ley.

7. Opiniones
Tus clientes pueden dejar su opinión con tu enlace y sale al momento en tu web. No puedes escribir opiniones tú mismo ni pedírselas a quien no haya sido cliente tuyo. OficioYa puede ocultar las opiniones falsas, ofensivas o que tengan datos personales.

8. Duración
Tu web está activa mientras tengas contrato con OficioYa. Si el contrato termina, la desactivamos.

9. Cambios
Si cambiamos estas condiciones o el precio, te avisaremos en la app y tendrás que aceptarlas otra vez. Hasta entonces se aplican estas.

10. Prueba de tu aceptación
Al aceptar guardamos la fecha y la hora, tu IP, los datos de tu dispositivo y de tu sesión y el texto exacto que aceptas, como prueba de este acuerdo, y te mandamos una copia a tu email. Usamos estos datos solo para eso, según la política de privacidad de OficioYa.$t$::text as t) x
on conflict (tipo, version) do nothing;

-- 2) Las condiciones de la web solo se piden a quien está recibiendo clientes de OficioYa (ruta activa en
-- lead_routing). A los demás no se les enseña nada (ni ventana ni «Te falta»): los clientes de su web los
-- atiende OficioYa y no les cuestan nada. Si ya las hubiera aceptado, se le siguen enseñando.
create or replace function public.oy_condiciones_web(p_pro uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare m public.pro_condiciones_modelo; a public.pro_condiciones_aceptaciones; ant record; v_recibe boolean;
begin
  if not public.oy_es_yo_o_admin(p_pro) then
    raise exception 'acceso denegado' using errcode = '42501';
  end if;
  select * into m from public.pro_condiciones_modelo where tipo = 'web_pro' and vigente;
  if not found then
    return jsonb_build_object('vigente', null, 'aceptada', null, 'pendiente', false);
  end if;
  select * into a from public.pro_condiciones_aceptaciones where pro_id = p_pro and modelo_id = m.id;
  v_recibe := coalesce(public.oy_pro_recibe_clientes(p_pro), false);
  if a.id is null and not v_recibe then
    return jsonb_build_object('vigente', null, 'aceptada', null, 'pendiente', false, 'recibe_clientes', false);
  end if;
  select x.version, x.aceptado_at into ant
    from public.pro_condiciones_aceptaciones x
   where x.pro_id = p_pro and x.tipo = 'web_pro' and x.modelo_id <> m.id
   order by x.aceptado_at desc limit 1;
  return jsonb_build_object(
    'vigente', jsonb_build_object(
      'version', m.version, 'titulo', m.titulo, 'resumen', m.resumen, 'texto', m.texto, 'sha256', m.sha256,
      'precio', m.precio, 'iva_pct', m.iva_pct, 'precio_iva', round(m.precio * (1 + m.iva_pct / 100), 2)),
    'aceptada', case when a.id is null then null else jsonb_build_object(
      'id', a.id, 'aceptado_at', a.aceptado_at, 'version', a.version, 'origen', a.origen,
      'email', a.email_enviado_at is not null, 'justificante', a.archivo_id is not null) end,
    'anterior', case when ant.version is null then null else jsonb_build_object('version', ant.version, 'aceptado_at', ant.aceptado_at) end,
    'pendiente', a.id is null,
    'recibe_clientes', v_recibe);
end $$;
revoke all on function public.oy_condiciones_web(uuid) from public, anon;
grant execute on function public.oy_condiciones_web(uuid) to authenticated, service_role;
