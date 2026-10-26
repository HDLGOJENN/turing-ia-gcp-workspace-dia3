
# Pruebas de integración — Turing-IA Día 3

## 1. Objetivo

Comprobar el funcionamiento de la integración entre una Cloud Function
desarrollada en Node.js y Google Workspace mediante una aplicación web
de Google Apps Script.

Las pruebas verifican:

- Validación de metadatos de archivos.
- Comunicación HTTP entre Node.js y Apps Script.
- Autorización mediante un secreto compartido.
- Registro de archivos en Google Sheets.
- Envío de notificaciones por Gmail.
- Detección de eventos duplicados.
- Manejo de errores.

## 2. Entorno de pruebas

| Componente | Configuración utilizada |
|---|---|
| Sistema operativo | Windows |
| Lenguaje | Node.js 24.22.0 |
| Cloud Function | Functions Framework, ejecución local |
| Eventos | CloudEvents simulados con PowerShell |
| Webhook | Google Apps Script Web App |
| Comunicación | HTTPS POST |
| Autorización | WEBHOOK_SECRET |
| Almacenamiento de registros | Google Sheets |
| Notificaciones | Gmail |
| Pruebas automatizadas | node:test |

No se desplegó la Cloud Function en GCP ni se utilizó un bucket real
de Cloud Storage porque el entorno requería habilitar facturación.

Esta limitación se documentó y se sustituyó la activación real
por eventos simulados.

## 3. Pruebas automatizadas de Node.js

Se utilizó el comando:

```powershell
npm test
```

### Resultados finales

| Componente | Pruebas aprobadas |
|---|---:|
| procesador.js | 5 |
| adaptador.js | 2 |
| cliente-webapp.js | 5 |
| **Total** | **12** |

Salida de la terminal:

```text
tests 12
pass 12
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 114.0941
```

### Casos validados

**Procesamiento de metadatos**

- Acepta un archivo válido.
- Rechaza tamaños negativos.
- Rechaza metadatos incompletos.
- Rechaza tipos de evento no permitidos.
- Rechaza archivos sin tamaño definido.

**Adaptación de datos**

- Transforma correctamente los metadatos al formato de Workspace.
- Rechaza datos que no incluyen el identificador del evento.

**Comunicación con la web app**

- Procesa correctamente una respuesta exitosa.
- Reconoce un evento duplicado.
- Detecta una respuesta de solicitud no autorizada.
- Detecta errores HTTP.
- Detecta respuestas que no contienen JSON válido.

Las pruebas de `cliente-webapp.js` utilizan respuestas HTTP
simuladas para evitar modificar Sheets o enviar correos reales
durante cada ejecución de `npm test`.

## 4. Pruebas reales con Google Apps Script

### 4.1 Disponibilidad del endpoint

Se realizó una solicitud GET a la aplicación web.

**Resultado:**
- HTTP 200.
- Aplicación web disponible.
- Respuesta JSON correcta.
- Tiempo registrado: 1919 ms.

### 4.2 Solicitud sin autorización — EVT-024

Se envió una solicitud POST sin una credencial válida.

**Resultado:**

```json
{
  "procesado": false,
  "mensaje": "Solicitud no autorizada"
}
```

- Apps Script rechazó el procesamiento.
- No se autorizó el registro de metadatos.
- Tiempo registrado: 1862 ms.

La respuesta HTTP fue 200 porque Apps Script devolvió
el resultado del rechazo mediante un objeto JSON.
La autorización se rechazó a nivel de aplicación.

### 4.3 Solicitud autorizada — EVT-025

Se envió una solicitud HTTP POST con el secreto compartido correcto.

**Resultado:**
- HTTP 200.
- Autorización aceptada.
- Metadatos registrados en Google Sheets.
- Notificación enviada mediante Gmail.
- Tiempo registrado: 4246 ms.

Respuesta obtenida:

```json
{
  "procesado": true,
  "registro": {
    "guardado": true,
    "duplicado": false,
    "mensaje": "Metadatos registrados correctamente"
  },
  "notificacion": {
    "enviado": true,
    "duplicado": false,
    "mensaje": "Correo enviado y registrado"
  }
}
```

### 4.4 Evento duplicado — EVT-025

Se repitió la solicitud del evento anterior.

**Resultado:**
- Evento identificado como duplicado.
- No se registró nuevamente.
- No se solicitó un nuevo envío de notificación.
- Tiempo registrado: 2422 ms.

## 5. Prueba de integración completa — EVT-026

Se ejecutó el flujo:

CloudEvent simulado
→ Cloud Function local
→ Validación de metadatos
→ Adaptación
→ HTTPS POST
→ Apps Script Web App
→ Google Sheets
→ Gmail.

**Archivo de prueba:** `integracion_final_webapp.pdf`

**Identificador:** `EVT-026`

### Resultado de la primera ejecución

- Cloud Function ejecutada correctamente.
- Metadatos preparados.
- Solicitud HTTP procesada por la web app.
- `procesado: true`.
- `duplicado: false`.
- Registro confirmado visualmente en Google Sheets.
- Estado `Procesado`.
- Notificación `Enviado`.
- Correo recibido en Gmail.

### Resultado al repetir EVT-026

Se volvió a enviar el mismo identificador.

Logs observados:

```text
Duplicado controlado: EVT-026
procesado: false
duplicado: true
```

La aplicación identificó el evento previamente registrado
y evitó repetir su procesamiento.

## 6. Pruebas con múltiples archivos

Durante el desarrollo se simularon múltiples eventos
para comprobar el procesamiento de archivos distintos.

Se utilizaron identificadores de prueba como:

- EVT-017
- EVT-018
- EVT-019

Estas ejecuciones se realizaron con una versión anterior
del receptor local de pruebas.

Se conservaron como evidencia de simulación de múltiples
archivos, pero no deben confundirse con la integración
definitiva mediante Apps Script Web App.

La integración real con la web app se comprobó con
EVT-025 y EVT-026.

## 7. Incidencias encontradas

### 7.1 Facturación de Google Cloud

**Problema:** El entorno de GCP requería habilitar facturación
para desplegar los componentes de Cloud Storage y Cloud Functions.

**Solución aplicada:** Utilizar Functions Framework y
eventos CloudEvent simulados para evaluar la lógica localmente.

**Limitación:** No se comprobó la activación automática
desde un bucket real.

### 7.2 Acceso a la aplicación web

**Problema:** La aplicación web configurada con acceso
"Solo yo" no permitía realizar la solicitud HTTP esperada
desde Node.js sin una sesión de Google.

**Solución aplicada:** Utilizar una implementación temporal
accesible mediante HTTPS y agregar una verificación de
WEBHOOK_SECRET antes del procesamiento.

**Limitación:** Se requiere un mecanismo de autenticación
más robusto para producción.

### 7.3 Secreto compartido incorrecto

**Problema:** Una solicitud autorizada fue rechazada
inicialmente porque el secreto configurado en Node.js
no coincidía con el de Apps Script.

**Solución aplicada:** Revisar la configuración de las
variables de entorno y las propiedades del script.

Después de corregir la configuración, EVT-025
se procesó correctamente.


## 8. Tiempos de respuesta observados

| Prueba | Tiempo |
|---|---:|
| GET de disponibilidad de la web app | 1919 ms |
| EVT-024 sin autorización | 1862 ms |
| EVT-025 autorizado | 4246 ms |
| EVT-025 duplicado | 2422 ms |
| Suite de 12 pruebas automatizadas | 114.0941 ms |

Los tiempos corresponden a ejecuciones observadas.
No representan promedios ni garantías de rendimiento.

## 9. Evidencias

Se conservaron capturas de:

- Pruebas automatizadas de Node.js.
- Respuestas de solicitudes autorizadas y rechazadas.
- Ejecución de EVT-026 en la Cloud Function local.
- Registro de EVT-026 en Google Sheets.
- Notificación de EVT-026 recibida en Gmail.
- Identificación de duplicados.

Las capturas con secretos o información privada no deben
incluirse en el repositorio ni en documentos compartidos.

## 10. Lecciones aprendidas

1. Validar datos en el emisor y nuevamente en el receptor.
2. Diferenciar la API ejecutable de Apps Script de una web app.
3. Proteger el webhook antes de permitir operaciones en Sheets.
4. Utilizar identificadores para evitar registros duplicados.
5. Conservar pruebas automatizadas alineadas con el código final.
6. Registrar tiempos, resultados y errores durante el desarrollo.
7. Documentar las limitaciones reales del entorno de pruebas.

## 11. Conclusión

Las pruebas demostraron el funcionamiento local de la
Cloud Function y su comunicación real con Google Apps Script.

Se comprobaron la autorización mediante secreto compartido,
el registro en Google Sheets, el envío de notificaciones Gmail
y la detección de eventos duplicados.

Las 12 pruebas automatizadas terminaron correctamente.

El despliegue automático desde Cloud Storage quedó pendiente
debido a la falta de facturación habilitada.

La integración se considera validada como prototipo local,
pero requiere un despliegue real y medidas adicionales de
seguridad antes de utilizarse en producción.
