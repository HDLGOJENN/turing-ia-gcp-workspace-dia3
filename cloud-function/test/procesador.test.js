
const test = require('node:test');
const assert = require('node:assert/strict');
const { procesarMetadatos } = require('../procesador');

function eventoValido() {
  return {
    id: 'evento-001',
    type: 'google.cloud.storage.object.v1.finalized',
    data: {
      name: 'evidencia.pdf',
      bucket: 'turing-ia-gcp-dia1-archivos',
      size: '2048',
      contentType: 'application/pdf'
    }
  };
}

test('Procesa correctamente un archivo válido', () => {
  const resultado = procesarMetadatos(eventoValido());

  assert.equal(resultado.nombre, 'evidencia.pdf');
  assert.equal(resultado.tamano, 2048);
  assert.equal(resultado.tipo, 'application/pdf');
});

test('Rechaza archivos con tamaño negativo', () => {
  const evento = eventoValido();
  evento.data.size = '-500';

  assert.throws(
    () => procesarMetadatos(evento),
    /Tamaño de archivo inválido/
  );
});

test('Rechaza metadatos incompletos', () => {
  const evento = eventoValido();
  delete evento.data.name;

  assert.throws(
    () => procesarMetadatos(evento),
    /Faltan metadatos obligatorios/
  );
});

test('Rechaza eventos no permitidos', () => {
  const evento = eventoValido();
  evento.type = 'evento.desconocido';

  assert.throws(
    () => procesarMetadatos(evento),
    /Tipo de evento no permitido/
  );
});

test('Rechaza archivos sin tamaño definido', () => {
  const evento = eventoValido();
  delete evento.data.size;

  assert.throws(
    () => procesarMetadatos(evento),
    /Tamaño de archivo inválido/
  );
});
