
const test = require('node:test');
const assert = require('node:assert/strict');

const { adaptarParaWorkspace } = require('../adaptador');

test('Adapta metadatos al formato de Workspace', () => {

  const metadatos = {
    evento: 'EVT-009',
    nombre: 'archivo.pdf',
    bucket: 'bucket-pruebas',
    tamano: 2048,
    tipo: 'application/pdf'
  };

  const cloudEvent = {
    id: 'EVT-009',
    time: '2026-10-26T17:00:00Z'
  };

  const resultado = adaptarParaWorkspace(
    metadatos,
    cloudEvent
  );

  assert.deepEqual(resultado, {
    idEvento: 'EVT-009',
    nombre: 'archivo.pdf',
    bucket: 'bucket-pruebas',
    tamano: 2048,
    tipo: 'application/pdf',
    fechaEvento: '2026-10-26T17:00:00Z'
  });
});

test('Rechaza metadatos sin identificador', () => {

  assert.throws(
    () => adaptarParaWorkspace(
      { evento: '' },
      { id: '' }
    ),
    /Identificador de evento inválido/
  );
});
