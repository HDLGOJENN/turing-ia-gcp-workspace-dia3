
/**
 * TURING-IA - DIA 3
 * Prueba HTTP POST autorizada a Apps Script Web App.
 */

async function probarWebAppAutorizada() {
  const url = process.env.WORKSPACE_WEBAPP_URL;
  const secreto = process.env.WEBHOOK_SECRET;

  if (!url || !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)) {
    throw new Error('Falta una URL válida de la web app');
  }

  if (!secreto || secreto.length < 32) {
    throw new Error('WEBHOOK_SECRET no está configurado correctamente');
  }

  const evento = {
    idEvento: 'EVT-025',
    nombre: 'prueba_webapp_autorizada.pdf',
    bucket: 'bucket-pruebas',
    tamano: 819200,
    tipo: 'application/pdf',
    fechaEvento: '2026-10-26T21:00:00Z',
    secreto
  };

  console.log('Enviando POST autorizado:', evento.idEvento);

  const inicio = performance.now();

  const respuesta = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(evento),
    signal: AbortSignal.timeout(30000)
  });

  const duracionMs = Math.round(performance.now() - inicio);
  const contenido = await respuesta.text();

  console.log('HTTP:', respuesta.status);
  console.log('Duración:', duracionMs, 'ms');

  let resultado;
  try {
    resultado = JSON.parse(contenido);
  } catch {
    throw new Error('Respuesta no JSON. Revisar los registros de Apps Script.');
  }

  console.log('Resultado:', JSON.stringify(resultado, null, 2));

  if (resultado.registro?.duplicado === true) {
    console.log('Duplicado controlado:', evento.idEvento);
    return;
  }

  if (
    resultado.procesado !== true ||
    resultado.registro?.guardado !== true ||
    resultado.notificacion?.enviado !== true
  ) {
    throw new Error('No se confirmó el registro y la notificación');
  }

  console.log('WEB APP INTEGRADA CORRECTAMENTE:', evento.idEvento);
}

probarWebAppAutorizada().catch(error => {
  console.error('Error de prueba:', error.message);
  process.exitCode = 1;
});
