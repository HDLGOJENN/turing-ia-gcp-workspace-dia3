
const { comprobarAccesoWebApp } = require('./cliente-webapp');

async function iniciarPrueba() {
  const resultado = await comprobarAccesoWebApp();

  if (resultado.disponible === true) {
    console.log('Web app disponible desde Node.js');
  } else {
    console.log('Acceso web pendiente de configuración');
  }
}

iniciarPrueba().catch(error => {
  console.error('Error:', error.message);
  process.exitCode = 1;
});
