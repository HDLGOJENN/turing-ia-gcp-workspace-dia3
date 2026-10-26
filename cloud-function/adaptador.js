
/**
 Adapta los metadatos de Cloud Storage
 al formato utilizado por Google Apps Script.
 No realiza solicitudes HTTP.
 No incluye secretos de autenticación.
 */
function adaptarParaWorkspace(metadatos, cloudEvent) {

  if (!metadatos || !cloudEvent) {
    throw new Error('Faltan datos para la integración');
  }

  if (typeof metadatos.evento !== 'string' ||
      metadatos.evento.trim() === '') {
    throw new Error('Identificador de evento inválido');
  }

  // Usar la fecha del evento si está disponible.
  const fechaEvento = cloudEvent.time || '';

  return {
    idEvento: metadatos.evento,
    nombre: metadatos.nombre,
    bucket: metadatos.bucket,
    tamano: metadatos.tamano,
    tipo: metadatos.tipo,
    fechaEvento
  };
}

module.exports = { adaptarParaWorkspace };
