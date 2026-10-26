//Recibe solicitudes HTTP POST desde el sistema de integración.

function doPost(e) {
  try {
    // Verificar que la solicitud tenga contenido.
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("La solicitud no contiene datos");
    }

    // Convertir el contenido JSON en un objeto JavaScript.
    const datos = JSON.parse(e.postData.contents);

    // Comprobar la autorización antes de procesar los datos.
    const autorizacion = validarAutorizacionSolicitud(datos);

    if (!autorizacion.autorizado) {
      console.log("Solicitud rechazada por autorización");

      return ContentService
        .createTextOutput(JSON.stringify({
          procesado: false,
          mensaje: "Solicitud no autorizada"
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Validar los metadatos antes de procesarlos.
    const validacion = validarMetadatos(datos);

    if (!validacion.valido) {
      console.log("Metadatos rechazados:", validacion.mensaje);

      return ContentService
        .createTextOutput(JSON.stringify({
          recibido: false,
          mensaje: validacion.mensaje
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Registrar únicamente información básica para diagnóstico.
    console.log("Solicitud recibida para procesamiento");

    // Guardar los metadatos validados en Google Sheets y enviar notificacion
    const resultado = procesarArchivoIntegrado(datos);

    // Devolver el resultado del procesamiento.
    return ContentService
      .createTextOutput(JSON.stringify(resultado))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error("Error al procesar solicitud:", error.message);

    return ContentService
      .createTextOutput(JSON.stringify({
        recibido: false,
        mensaje: "Solicitud inválida"
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

//Simula una solicitud POST sin desplegar la aplicación web.
function probarDoPost() {
  const eventoSimulado = {
    postData: {
      contents: JSON.stringify({
        idEvento: "EVT-001",
        nombre: "reporte.pdf",
        bucket: "bucket-pruebas",
        tamano: 245760,
        tipo: "application/pdf"
      })
    }
  };

  const resultado = doPost(eventoSimulado);

  console.log(resultado.getContent());
}

/**
 Valida los metadatos recibidos de un archivo.
 @param {Object} datos Información del archivo.
 @returns {Object} Resultado de la validación.
 */
function validarMetadatos(datos) {
  // Comprobar que recibimos un objeto válido.
  if (!datos || typeof datos !== "object" ||
    Array.isArray(datos)) {
    return {
      valido: false,
      mensaje: "Los metadatos deben ser un objeto"
    };
  }

  // Verificar los campos de texto obligatorios.
  const campos = ["idEvento", "nombre", "bucket", "tipo"];

  for (const campo of campos) {
    if (typeof datos[campo] !== "string" ||
      datos[campo].trim() === "") {
      return {
        valido: false,
        mensaje: "Campo inválido: " + campo
      };
    }
  }

  // Verificar que el tamaño sea un número válido.
  if (typeof datos.tamano !== "number" ||
    !Number.isFinite(datos.tamano) ||
    !Number.isSafeInteger(datos.tamano) ||
    datos.tamano < 0) {
    return {
      valido: false,
      mensaje: "El tamaño del archivo es inválido"
    };
  }

  return {
    valido: true,
    mensaje: "Metadatos válidos"
  };
}

//Prueba la validación con datos correctos e incorrectos.
function probarValidacionMetadatos() {
  const archivoValido = {
    idEvento: "EVT-001",
    nombre: "reporte.pdf",
    bucket: "bucket-pruebas",
    tamano: 245760,
    tipo: "application/pdf"
  };

  const archivoInvalido = {
    idEvento: "EVT-002",
    nombre: "",
    bucket: "bucket-pruebas",
    tamano: -100,
    tipo: "application/pdf"
  };

  console.log(
    "Archivo válido:",
    JSON.stringify(validarMetadatos(archivoValido))
  );

  console.log(
    "Archivo inválido:",
    JSON.stringify(validarMetadatos(archivoInvalido))
  );
}


//Prueba que doPost rechace metadatos inválidos.
function probarDoPostInvalido() {
  const eventoSimulado = {
    postData: {
      contents: JSON.stringify({
        idEvento: "EVT-002",
        nombre: "",
        bucket: "bucket-pruebas",
        tamano: -100,
        tipo: "application/pdf"
      })
    }
  };

  const resultado = doPost(eventoSimulado);

  console.log(resultado.getContent());
}

/**
 Busca si un evento ya se encuentra registrado en Sheets.
 @param {GoogleAppsScript.Spreadsheet.Sheet} hoja
 @param {string} idEvento
 @returns {boolean}
 */
function existeEvento(hoja, idEvento) {
  const ultimaFila = hoja.getLastRow();

  // Si únicamente existe el encabezado, no hay eventos.
  if (ultimaFila < 2) {
    return false;
  }

  // Leer los IDs registrados en la columna A.
  const ids = hoja.getRange(2, 1, ultimaFila - 1, 1).getValues();

  // Buscar una coincidencia exacta.
  return ids.some(fila => String(fila[0]) === idEvento);
}
/**
 * Comprueba la búsqueda de eventos duplicados.
 */
function probarBusquedaDuplicados() {
  const hoja = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Archivos");

  if (!hoja) {
    throw new Error("No se encontró la hoja Archivos");
  }

  const resultado = existeEvento(hoja, "EVT-001");

  console.log("¿Existe EVT-001?:", resultado);
}


/**
 Guarda los metadatos de un archivo en Google Sheets.
 Antes de insertar:
 1. Valida los datos.
 2. Obtiene un bloqueo.
 3. Comprueba que el evento no exista.
 4. Registra los metadatos.
 @param {Object} datos Metadatos del archivo.
 @returns {Object} Resultado del registro.
 */
function guardarMetadatos(datos) {

  // Validar antes de acceder a la hoja.
  const validacion = validarMetadatos(datos);

  if (!validacion.valido) {
    return {
      guardado: false,
      mensaje: validacion.mensaje
    };
  }

  // Obtener la hoja vinculada al proyecto.
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = libro.getSheetByName("Archivos");

  if (!hoja) {
    throw new Error("No se encontró la hoja Archivos");
  }

  // Evitar dos escrituras simultáneas del mismo evento.
  const bloqueo = LockService.getDocumentLock();

  if (!bloqueo) {
    throw new Error("No se pudo obtener el bloqueo del documento");
  }

  // Esperar hasta 10 segundos para obtener el bloqueo.
  bloqueo.waitLock(10000);

  try {

    // Buscar el evento dentro del bloqueo.
    if (existeEvento(hoja, datos.idEvento)) {
      console.log("Evento duplicado:", datos.idEvento);

      return {
        guardado: false,
        duplicado: true,
        mensaje: "El evento ya está registrado"
      };
    }

    // Evitar que los valores de texto se interpreten
    // como fórmulas de Google Sheets.
    function textoSeguro(valor) {
      const texto = String(valor);

      if (/^[\s]*[=+\-@]/.test(texto)) {
        return "'" + texto;
      }

      return texto;
    }

    // Preparar los valores según las columnas A-I.
    const nuevaFila = [
      textoSeguro(datos.idEvento),
      textoSeguro(datos.nombre),
      textoSeguro(datos.bucket),
      datos.tamano,
      textoSeguro(datos.tipo),
      datos.fechaEvento ? textoSeguro(datos.fechaEvento) : "",
      new Date(),
      "Procesado",
      "Pendiente"
    ];

    // Insertar el registro.
    hoja.appendRow(nuevaFila);

    // Aplicar los cambios antes de liberar el bloqueo.
    SpreadsheetApp.flush();

    console.log("Evento registrado:", datos.idEvento);

    return {
      guardado: true,
      duplicado: false,
      mensaje: "Metadatos registrados correctamente"
    };

  } catch (error) {
    console.error("Error al guardar:", error.message);
    throw error;

  } finally {
    // Liberar el bloqueo después de procesar.
    bloqueo.releaseLock();
  }
}


/**
 Prueba el registro de metadatos en Google Sheets.
 Al ejecutar nuevamente con el mismo ID,
 el sistema debe detectar el duplicado.
 */
function probarGuardadoMetadatos() {

  const archivoPrueba = {
    idEvento: "EVT-001",
    nombre: "reporte.pdf",
    bucket: "bucket-pruebas",
    tamano: 245760,
    tipo: "application/pdf",
    fechaEvento: "2026-10-26T15:00:00Z"
  };

  const resultado = guardarMetadatos(archivoPrueba);

  console.log(JSON.stringify(resultado));
}

/**
 Simula la recepción de un nuevo archivo mediante doPost.
 */
function probarDoPostConGuardado() {

  const eventoSimulado = {
    postData: {
      contents: JSON.stringify({
        idEvento: "EVT-003",
        nombre: "documento_integracion.pdf",
        bucket: "bucket-pruebas",
        tamano: 102400,
        tipo: "application/pdf",
        fechaEvento: "2026-10-26T16:00:00Z"
      })
    }
  };

  const resultado = doPost(eventoSimulado);

  console.log(resultado.getContent());
}

/**
 Envía una notificación para un evento registrado.
  Verifica que:
  1. El evento exista.
  2. No tenga una notificación enviada.
  3. Exista un destinatario configurado.
 
 @param {string} idEvento
 @returns {Object}
 */
function notificarArchivo(idEvento) {

  const correo = PropertiesService
    .getScriptProperties()
    .getProperty("CORREO_NOTIFICACION");

  if (!correo ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    throw new Error("Destinatario de prueba no configurado");
  }

  const hoja = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Archivos");

  if (!hoja) {
    throw new Error("No se encontró la hoja Archivos");
  }

  const bloqueo = LockService.getDocumentLock();

  if (!bloqueo) {
    throw new Error("No se pudo obtener el bloqueo");
  }

  bloqueo.waitLock(10000);

  try {
    const ultimaFila = hoja.getLastRow();

    if (ultimaFila < 2) {
      throw new Error("No hay archivos registrados");
    }

    const registros = hoja
      .getRange(2, 1, ultimaFila - 1, 9)
      .getValues();

    const indice = registros.findIndex(
      fila => String(fila[0]) === idEvento
    );

    if (indice === -1) {
      throw new Error("Evento no encontrado: " + idEvento);
    }

    const fila = indice + 2;
    const datos = registros[indice];

    // Columna I: estado de notificación.
    if (datos[8] === "Enviado") {
      console.log("Notificación ya registrada:", idEvento);

      return {
        enviado: false,
        duplicado: true,
        mensaje: "La notificación ya fue enviada"
      };
    }

    const asunto = "Turing-IA | Archivo procesado";

    const mensaje =
      "Se procesó un archivo de prueba.\n\n" +
      "Evento: " + datos[0] + "\n" +
      "Archivo: " + datos[1] + "\n" +
      "Bucket: " + datos[2] + "\n" +
      "Tamaño: " + datos[3] + " bytes\n" +
      "Tipo MIME: " + datos[4] + "\n\n" +
      "Notificación automática de Turing-IA Día 3.";

    // Enviar la notificación.
    MailApp.sendEmail(correo, asunto, mensaje);

    // Registrar el envío en la columna I.
    hoja.getRange(fila, 9).setValue("Enviado");

    SpreadsheetApp.flush();

    console.log("Notificación enviada:", idEvento);

    return {
      enviado: true,
      duplicado: false,
      mensaje: "Correo enviado y registrado"
    };

  } catch (error) {
    console.error(
      "Error en la notificación:",
      error.message
    );
    throw error;

  } finally {
    bloqueo.releaseLock();
  }
}

// Prueba el envío de Gmail para EVT-001.

function probarNotificacionArchivo() {

  const resultado = notificarArchivo("EVT-001");

  console.log(JSON.stringify(resultado));
}


/**
 Coordina el registro de un archivo y su notificación.
 Reutiliza las funciones ya desarrolladas:
 guardarMetadatos()
 notificarArchivo()
 @param {Object} datos Metadatos recibidos.
 @returns {Object} Resultado del procesamiento.
 */
function procesarArchivoIntegrado(datos) {

  // Primero guardar el archivo.
  const registro = guardarMetadatos(datos);

  // Si los datos son inválidos o el evento ya existe,
  // no iniciar una nueva notificación.
  if (!registro.guardado) {
    console.log("Registro omitido:", registro.mensaje);

    return {
      procesado: false,
      registro: registro,
      notificacion: null
    };
  }

  // El registro ya existe en Sheets.
  // Intentar enviar el correo correspondiente.
  try {
    const notificacion = notificarArchivo(datos.idEvento);

    console.log("Procesamiento integrado finalizado");

    return {
      procesado: true,
      registro: registro,
      notificacion: notificacion
    };

  } catch (error) {
    // El archivo permanece registrado en Sheets,
    // pero la notificación necesita revisión.
    console.error(
      "Archivo registrado, pero falló la notificación:",
      error.message
    );

    return {
      procesado: false,
      registro: registro,
      notificacion: {
        enviado: false,
        mensaje: "Error al enviar la notificación"
      }
    };
  }
}

/**
 Prueba completa:
 registrar un archivo y enviar su notificación.
 */
function probarIntegracionSheetsGmail() {

  const archivoPrueba = {
    idEvento: "EVT-004",
    nombre: "integracion_completa.pdf",
    bucket: "bucket-pruebas",
    tamano: 307200,
    tipo: "application/pdf",
    fechaEvento: "2026-10-26T16:30:00Z"
  };

  const resultado = procesarArchivoIntegrado(archivoPrueba);

  console.log(JSON.stringify(resultado));
}

/**
 Simula un archivo recibido por doPost.
 Comprueba el recorrido completo:
 recepción, validación, Sheets y Gmail.
 */
function probarDoPostIntegracionCompleta() {

  const eventoSimulado = {
    postData: {
      contents: JSON.stringify({
        idEvento: "EVT-005",
        nombre: "prueba_dopost_completa.pdf",
        bucket: "bucket-pruebas",
        tamano: 409600,
        tipo: "application/pdf",
        fechaEvento: "2026-10-26T17:00:00Z"
      })
    }
  };

  const resultado = doPost(eventoSimulado);

  console.log(resultado.getContent());
}

/**
 Comprueba un secreto recibido contra el configurado.
 Esta función se utilizará en pruebas internas.
 @param {string} secretoRecibido
 @returns {boolean}
 */
function verificarSecreto(secretoRecibido) {
  const secretoConfigurado = PropertiesService
    .getScriptProperties()
    .getProperty("WEBHOOK_SECRET");

  if (!secretoConfigurado || secretoConfigurado.length < 32) {
    throw new Error("WEBHOOK_SECRET no está configurado correctamente");
  }

  if (typeof secretoRecibido !== "string") {
    return false;
  }

  return secretoRecibido === secretoConfigurado;
}

/**
 Prueba un secreto correcto y otro incorrecto.
 No imprime el valor del secreto.
 */
function probarVerificacionSecreto() {
  const secretoConfigurado = PropertiesService
    .getScriptProperties()
    .getProperty("WEBHOOK_SECRET");

  const autorizado = verificarSecreto(secretoConfigurado);
  const rechazado = verificarSecreto("secreto-incorrecto");

  console.log("Secreto correcto:", autorizado);
  console.log("Secreto incorrecto:", rechazado);
}

/**
 * Valida la autorización de una solicitud simulada.
 *
 * No modifica Sheets ni envía correos.
 */
function validarAutorizacionSolicitud(datos) {
  if (!datos || typeof datos !== "object") {
    return {
      autorizado: false,
      mensaje: "Solicitud no autorizada"
    };
  }

  const autorizado = verificarSecreto(datos.secreto);

  return {
    autorizado: autorizado,
    mensaje: autorizado
      ? "Solicitud autorizada"
      : "Solicitud no autorizada"
  };
}

/**
 * Prueba que una solicitud sin secreto sea rechazada.
 */
function probarSolicitudSinAutorizacion() {

  const datosPrueba = {
    idEvento: "EVT-006",
    nombre: "archivo_no_autorizado.pdf",
    bucket: "bucket-pruebas",
    tamano: 1024,
    tipo: "application/pdf"
  };

  const resultado = validarAutorizacionSolicitud(datosPrueba);

  console.log(JSON.stringify(resultado));
}

/**
 Comprueba que doPost rechace una solicitud
 sin autenticación antes de modificar Sheets.
 */
function probarDoPostSinAutorizacion() {
  const eventoSimulado = {
    postData: {
      contents: JSON.stringify({
        idEvento: "EVT-007",
        nombre: "archivo_sin_autorizacion.pdf",
        bucket: "bucket-pruebas",
        tamano: 2048,
        tipo: "application/pdf"
      })
    }
  };

  const resultado = doPost(eventoSimulado);

  console.log(resultado.getContent());
}

/**
 Simula una solicitud autorizada.
 Verifica recepción, autenticación, Sheets y Gmail.
 */
function probarDoPostAutorizado() {

  // Leer el secreto sin mostrarlo en los registros.
  const secreto = PropertiesService
    .getScriptProperties()
    .getProperty("WEBHOOK_SECRET");

  const eventoSimulado = {
    postData: {
      contents: JSON.stringify({
        idEvento: "EVT-008",
        nombre: "archivo_autorizado.pdf",
        bucket: "bucket-pruebas",
        tamano: 512000,
        tipo: "application/pdf",
        fechaEvento: "2026-10-26T17:30:00Z",
        secreto: secreto
      })
    }
  };

  const resultado = doPost(eventoSimulado);

  console.log(resultado.getContent());
}
/**
 Comprueba que la aplicación web está disponible.
 No modifica Sheets ni envía correos.
 No muestra credenciales.
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      disponible: true,
      servicio: "Turing-IA Dia 3",
      mensaje: "Aplicacion web disponible"
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Verifica la comunicación mediante Apps Script API.
 * No modifica Sheets ni envía correos.
 */
function comprobarConexionAPI() {
  return {
    conectado: true,
    servicio: "Turing-IA Dia 3",
    mensaje: "Conexion OAuth con Apps Script exitosa"
  };
}


/**
 * Punto de entrada para Apps Script API.
 * Recibe metadatos desde Node.js mediante OAuth.
 *
 * Reutiliza las validaciones y el procesamiento
 * que ya desarrollamos.
 */
function procesarArchivoDesdeAPI(datos) {

  // Validar que la solicitud contenga información.
  if (!datos || typeof datos !== 'object') {
    return {
      procesado: false,
      mensaje: 'Datos no recibidos'
    };
  }

  // Comprobar los metadatos antes de procesarlos.
  const validacion = validarMetadatos(datos);

  if (!validacion.valido) {
    return {
      procesado: false,
      mensaje: validacion.mensaje
    };
  }

  // Reutilizar el registro en Sheets y la notificación Gmail.
  return procesarArchivoIntegrado(datos);
}
