
/**
 * TURING-IA - DIA 3
 *
 * Comprueba que la aplicación web rechaza
 * una solicitud HTTP POST sin autorización.
 *
 * No envía secretos ni credenciales.
 */

async function probarWebAppSinAutorizacion() {
  const url = process.env.WORKSPACE_WEBAPP_URL;

  if (!url) {
    throw new Error('Falta WORKSPACE_WEBAPP_URL');
  }

  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)) {
    throw new Error('URL de Apps Script no válida');
  }

  const evento = {
    idEvento: 'EVT-024',
    nombre: 'archivo_sin_autorizacion.pdf',
    bucket: 'bucket-pruebas',
    tamano: 1024,
    tipo: 'application/pdf'
  };

  console.log('Enviando POST sin autorización...');

  const inicio = performance.now();

  const respuesta = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(evento),
    signal: AbortSignal.timeout(20000)
  });

  const duracionMs = Math.round(performance.now() - inicio);
  const contenido = await respuesta.text();

  console.log('Código HTTP:', respuesta.status);
  console.log('Tiempo de respuesta:', duracionMs, 'ms');

  let resultado;

  try {
    resultado = JSON.parse(contenido);
  } catch {
    throw new Error(
      'Google no devolvió JSON. Revisar acceso o redirecciones.'
    );
  }

  console.log('Respuesta:', JSON.stringify(resultado, null, 2));

  if (
    resultado.procesado === false &&
    resultado.mensaje === 'Solicitud no autorizada'
  ) {
    console.log('PRUEBA APROBADA: solicitud rechazada.');
    return;
  }

  throw new Error(
    'No se confirmó el rechazo de la solicitud.'
  );
}

probarWebAppSinAutorizacion().catch(error => {
  console.error('Error de prueba:', error.message);
  process.exitCode = 1;
});
