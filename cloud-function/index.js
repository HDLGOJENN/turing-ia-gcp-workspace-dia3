
const functions = require('@google-cloud/functions-framework');
const { procesarMetadatos } = require('./procesador');
const { adaptarParaWorkspace } = require('./adaptador');
const { enviarAWebApp } = require('./cliente-webapp');

/**
 * TURING-IA - DÍA 3
 *
 * Simula la activación de una Cloud Function cuando
 * se carga un archivo a Google Cloud Storage.
 *
 * Flujo:
 * CloudEvent -> Validación -> Adaptación ->
 * Apps Script Web App -> Google Sheets y Gmail.
 */
functions.cloudEvent('procesarArchivo', async (cloudEvent) => {
  try {
    console.log('Iniciando procesamiento de archivo...');

    // 1. Validar los metadatos recibidos de Cloud Storage.
    const metadatos = procesarMetadatos(cloudEvent);

    // 2. Convertir los datos al formato esperado por Apps Script.
    const datosWorkspace = adaptarParaWorkspace(
      metadatos,
      cloudEvent
    );

    console.log(JSON.stringify({
      severity: 'INFO',
      mensaje: 'Metadatos preparados para Workspace',
      evento: datosWorkspace.idEvento,
      nombre: datosWorkspace.nombre
    }));

    // 3. Enviar los metadatos mediante POST a la Web App.
    const resultado = await enviarAWebApp(datosWorkspace);

    // 4. Registrar el resultado sin mostrar credenciales.
    console.log(JSON.stringify({
      severity: 'INFO',
      mensaje: 'Integración con Apps Script Web App completada',
      evento: resultado.evento,
      procesado: resultado.procesado,
      duplicado: resultado.duplicado
    }));

  } catch (error) {
    // Registrar el error y conservarlo para el diagnóstico.
    console.error(JSON.stringify({
      severity: 'ERROR',
      mensaje: 'Error al procesar archivo',
      error: error.message,
      evento: cloudEvent?.id || 'desconocido'
    }));

    throw error;
  }
});
