
/**
 * Cliente HTTP para la aplicación web de Apps Script.
 *
 * Permite comprobar la disponibilidad del endpoint
 * antes de enviar metadatos.
 *
 * No modifica Google Sheets ni envía correos.
 */

async function comprobarAccesoWebApp() {
  const url = process.env.WORKSPACE_WEBAPP_URL;

  if (!url) {
    throw new Error('Falta configurar WORKSPACE_WEBAPP_URL');
  }

  if (
    !url.startsWith('https://script.google.com/macros/s/') ||
    !url.endsWith('/exec')
  ) {
    throw new Error('La URL de la web app no es válida');
  }

  console.log('Comprobando acceso a la web app...');

  const inicio = performance.now();

  const respuesta = await fetch(url, {
    method: 'GET',
    signal: AbortSignal.timeout(15000)
  });

  const duracionMs = Math.round(performance.now() - inicio);
  const contenido = await respuesta.text();
  console.log(
  '¿Redirección de Google?:',
  respuesta.redirected ? 'Sí' : 'No'
);

console.log(
  '¿Terminó en una página de acceso?:',
  respuesta.url.includes('accounts.google.com')
    ? 'Sí'
    : 'No'
);

  console.log('Código HTTP:', respuesta.status);
  console.log('Tiempo de respuesta:', duracionMs, 'ms');

  // Una respuesta HTML puede ser una pantalla de acceso de Google.
  const esJson = contenido.trimStart().startsWith('{');

  if (!esJson) {
    console.log(
      'Google no devolvió JSON. Es posible que solicite iniciar sesión.'
    );

    return {
      disponible: false,
      motivo: 'Respuesta no JSON'
    };
  }

  const resultado = JSON.parse(contenido);

  console.log('Respuesta:', JSON.stringify(resultado, null, 2));

  return resultado;
}


/**
 * Envía metadatos a la aplicación web de Apps Script.
 * Usa un secreto de prueba almacenado en el entorno.
 */
async function enviarAWebApp(datos) {
  const url = process.env.WORKSPACE_WEBAPP_URL;
  const secreto = process.env.WEBHOOK_SECRET;

  if (!url ||
      !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)) {
    throw new Error('URL de web app no válida');
  }

  if (!secreto || secreto.length < 32) {
    throw new Error('WEBHOOK_SECRET no configurado');
  }

  if (!datos || !datos.idEvento) {
    throw new Error('Faltan metadatos del evento');
  }

  const inicio = performance.now();

  const respuesta = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      ...datos,
      secreto
    }),
    signal: AbortSignal.timeout(30000)
  });

  const duracionMs = Math.round(performance.now() - inicio);
  const contenido = await respuesta.text();

  if (!respuesta.ok) {
    throw new Error(
      `Error HTTP ${respuesta.status} de la web app`
    );
  }

  let resultado;

  try {
    resultado = JSON.parse(contenido);
  } catch {
    throw new Error('La web app no devolvió JSON');
  }

  if (resultado.registro?.duplicado === true) {
    console.log('Duplicado controlado:', datos.idEvento);

    return {
      evento: datos.idEvento,
      procesado: false,
      duplicado: true,
      duracionMs
    };
  }

  if (
    resultado.procesado !== true ||
    resultado.registro?.guardado !== true ||
    resultado.notificacion?.enviado !== true
  ) {
    throw new Error(
      resultado.mensaje ||
      resultado.notificacion?.mensaje ||
      'No se confirmó el procesamiento'
    );
  }

  console.log('Integración web app confirmada:', datos.idEvento);

  return {
    evento: datos.idEvento,
    procesado: true,
    duplicado: false,
    duracionMs
  };
}


module.exports = { comprobarAccesoWebApp, enviarAWebApp };