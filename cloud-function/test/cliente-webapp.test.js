
const test = require('node:test');
const assert = require('node:assert/strict');
const { enviarAWebApp } = require('../cliente-webapp');

const URL_PRUEBA =
  'https://script.google.com/macros/s/PRUEBA/exec';

const datosPrueba = {
  idEvento: 'EVT-TEST',
  nombre: 'archivo_prueba.pdf',
  bucket: 'bucket-pruebas',
  tamano: 1024,
  tipo: 'application/pdf'
};

// Simula la respuesta de Google sin contactar Internet.
async function ejecutarConSimulacion(respuesta, accion) {
  const fetchAnterior = global.fetch;
  const urlAnterior = process.env.WORKSPACE_WEBAPP_URL;
  const secretoAnterior = process.env.WEBHOOK_SECRET;

  try {
    process.env.WORKSPACE_WEBAPP_URL = URL_PRUEBA;
    process.env.WEBHOOK_SECRET = 'secreto-ficticio-para-pruebas-123456789';

    global.fetch = async (url, opciones) => {
      assert.equal(url, URL_PRUEBA);
      assert.equal(opciones.method, 'POST');

      const cuerpo = JSON.parse(opciones.body);
      assert.equal(cuerpo.idEvento, datosPrueba.idEvento);
      assert.equal(cuerpo.secreto, process.env.WEBHOOK_SECRET);

      return {
        ok: respuesta.ok ?? true,
        status: respuesta.status ?? 200,
        text: async () => respuesta.contenido
      };
    };

    await accion();
  } finally {
    global.fetch = fetchAnterior;

    if (urlAnterior === undefined) {
      delete process.env.WORKSPACE_WEBAPP_URL;
    } else {
      process.env.WORKSPACE_WEBAPP_URL = urlAnterior;
    }

    if (secretoAnterior === undefined) {
      delete process.env.WEBHOOK_SECRET;
    } else {
      process.env.WEBHOOK_SECRET = secretoAnterior;
    }
  }
}

test('Envía metadatos correctamente a la web app', async () => {
  await ejecutarConSimulacion({
    contenido: JSON.stringify({
      procesado: true,
      registro: { guardado: true, duplicado: false },
      notificacion: { enviado: true }
    })
  }, async () => {
    const resultado = await enviarAWebApp(datosPrueba);

    assert.equal(resultado.procesado, true);
    assert.equal(resultado.duplicado, false);
    assert.equal(resultado.evento, 'EVT-TEST');
  });
});

test('Detecta eventos duplicados', async () => {
  await ejecutarConSimulacion({
    contenido: JSON.stringify({
      procesado: false,
      registro: { guardado: false, duplicado: true },
      notificacion: null
    })
  }, async () => {
    const resultado = await enviarAWebApp(datosPrueba);

    assert.equal(resultado.procesado, false);
    assert.equal(resultado.duplicado, true);
  });
});

test('Rechaza solicitudes no autorizadas', async () => {
  await ejecutarConSimulacion({
    contenido: JSON.stringify({
      procesado: false,
      mensaje: 'Solicitud no autorizada'
    })
  }, async () => {
    await assert.rejects(
      () => enviarAWebApp(datosPrueba),
      /Solicitud no autorizada/
    );
  });
});

test('Detecta errores HTTP', async () => {
  await ejecutarConSimulacion({
    ok: false,
    status: 500,
    contenido: 'Error del servidor'
  }, async () => {
    await assert.rejects(
      () => enviarAWebApp(datosPrueba),
      /Error HTTP 500/
    );
  });
});

test('Detecta respuestas que no son JSON', async () => {
  await ejecutarConSimulacion({
    contenido: '<html>Error</html>'
  }, async () => {
    await assert.rejects(
      () => enviarAWebApp(datosPrueba),
      /no devolvió JSON/
    );
  });
});
