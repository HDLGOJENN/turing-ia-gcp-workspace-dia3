
function procesarMetadatos(cloudEvent) {
  if (cloudEvent?.type !==
      'google.cloud.storage.object.v1.finalized') {
    throw new Error('Tipo de evento no permitido');
  }

  const archivo = cloudEvent.data;

  if (!archivo || !archivo.name || !archivo.bucket) {
    throw new Error('Faltan metadatos obligatorios');
  }

  if (archivo.size === undefined ||
      archivo.size === null ||
      archivo.size === '') {
    throw new Error('Tamaño de archivo inválido');
  }

  const tamano = Number(archivo.size);

  if (!Number.isFinite(tamano) ||
      !Number.isSafeInteger(tamano) ||
      tamano < 0) {
    throw new Error('Tamaño de archivo inválido');
  }

  return {
    evento: cloudEvent.id,
    bucket: archivo.bucket,
    nombre: archivo.name,
    tamano,
    tipo: archivo.contentType || 'desconocido'
  };
}

module.exports = { procesarMetadatos };
