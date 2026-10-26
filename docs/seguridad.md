

# Seguridad de la integración — Turing-IA Día 3



## 1. Objetivo



Documentar los mecanismos de seguridad implementados en la integración entre una Cloud Function desarrollada en Node.js y una aplicación web de Google Apps Script.



La solución procesa eventos simulados de Cloud Storage, valida los metadatos recibidos, transmite la información mediante HTTPS y utiliza Google Sheets y Gmail para registrar y notificar archivos.



El proyecto se desarrolló como un prototipo de evaluación técnica, diferenciando las medidas implementadas de las recomendaciones para producción.



## 2. Arquitectura de seguridad



El flujo principal es:



1. La Cloud Function recibe un CloudEvent simulado.

2. Node.js valida el tipo de evento y sus metadatos.

3. Los datos se adaptan al formato esperado por Apps Script.

4. El cliente HTTP envía una solicitud HTTPS POST.

5. Apps Script verifica un secreto compartido.

6. Apps Script valida nuevamente los metadatos.

7. Se comprueba que el evento no esté registrado.

8. Se guarda la información en Google Sheets.

9. Se envía una notificación mediante Gmail.

10. Se registra el resultado del procesamiento.



La verificación del secreto se realiza antes de modificar Google Sheets o enviar notificaciones.



## 3. Autenticación del webhook



### 3.1 Secreto compartido



Se implementó una validación mediante la propiedad `WEBHOOK_SECRET`.



En Node.js, el secreto se obtiene desde una variable de entorno:



`process.env.WEBHOOK_SECRET`



En Apps Script, se obtiene mediante:



`PropertiesService.getScriptProperties()`



En `doPost(e)`, la función `validarAutorizacionSolicitud(datos)` verifica que el secreto recibido coincida con el almacenado en las propiedades del script. La función `verificarSecreto()` comprueba la configuración del secreto.



Si no coincide, `doPost(e)` rechaza el procesamiento y devuelve un resultado indicando que la solicitud no está autorizada.



### 3.2 Justificación



El secreto compartido permite demostrar un mecanismo básico de autorización para las solicitudes de integración.



Sin embargo, no constituye una firma digital ni proporciona las mismas garantías que una autenticación de servicio a servicio basada en identidades verificadas.


Para mejorar la seguridad en un entorno de producción, utilizaría un sistema de autenticación con tokens OAuth 2.0. Esto permitiría controlar qué aplicaciones pueden acceder al servicio, en lugar de depender únicamente de un secreto compartido.



### 3.3 Control de acceso



Se utilizó una implementación temporal de la aplicación web que permitía recibir solicitudes HTTP externas durante las pruebas.



Esta configuración permitió comprobar la integración solicitada, pero no debe mantenerse como configuración definitiva de producción.



La aplicación se ejecuta con los permisos de la cuenta propietaria, por lo que es importante restringir o retirar el acceso público una vez concluidas las pruebas.



### 3.4 Pruebas de autorización del webhook

Se verificó la autorización con solicitudes HTTP reales a la web app de Apps Script:

| Evento | Escenario | Resultado observado |
|---|---|---|
| `EVT-024` | POST sin autorización válida (`probar-webapp-sin-autorizacion.js`) | `procesado: false` y mensaje `Solicitud no autorizada`. No se autoriza el registro ni la notificación. |
| `EVT-025` | POST con secreto correcto (`probar-webapp-autorizado.js`) | `procesado: true`, registro en Sheets y notificación de Gmail confirmados por la respuesta. |
| `EVT-025` repetido | Segundo envío con el mismo identificador | Duplicado detectado, sin nuevo procesamiento. |
| `EVT-026` | CloudEvent simulado → Cloud Function local → web app | `procesado: true`; comprobación visual del registro en Sheets y del mensaje en Gmail. |
| `EVT-026` repetido | Reenvío del evento desde la Cloud Function local | `procesado: false` y `duplicado: true`. |

Los scripts `probar-webapp.js`, `probar-webapp-autorizado.js` y `probar-webapp-sin-autorizacion.js` se conservaron para reproducir las comprobaciones de disponibilidad y autorización. Sus datos de configuración deben mantenerse fuera del código y no deben incluir credenciales reales en el repositorio.

La web app puede devolver **HTTP 200 incluso cuando rechaza una solicitud**: la autorización se comprueba leyendo el resultado JSON (`procesado: false`, `Solicitud no autorizada`), no únicamente el código de estado HTTP.

Estas pruebas evidencian una **autorización básica por secreto compartido**. No se implementó OAuth en el webhook principal ni firma digital HMAC.

## 4. Gestión de credenciales



Se aplicaron las siguientes medidas:



- No escribir `WEBHOOK_SECRET` directamente en el código fuente.

- Utilizar variables de entorno durante las pruebas locales.

- Almacenar la copia del secreto en las propiedades de Apps Script.

- Excluir archivos privados del repositorio mediante `.gitignore`.

- Evitar registrar secretos y tokens en los logs.

- No publicar credenciales OAuth ni información privada en GitHub.



Durante el desarrollo se detectó una exposición accidental de un secreto en una captura de terminal. El valor expuesto debe considerarse comprometido.



Como medida correctiva, se indicó rotar el secreto tanto en Apps Script como en el entorno local y retirar las capturas que contuvieran el valor expuesto. Esta acción no se considera completada sin verificación.



La rotación del secreto, la ausencia de credenciales en Git y el cierre del despliegue público temporal son verificaciones pendientes antes de publicar o cerrar la entrega.



## 5. Validaciones en Node.js



La función `procesarMetadatos()` verifica:



- Que el evento corresponda a `google.cloud.storage.object.v1.finalized`.

- Que existan los metadatos obligatorios.

- Que el archivo tenga nombre y bucket.

- Que el tamaño sea numérico, entero seguro y no negativo.

- Que no falte el tamaño del archivo.



Cuando los datos no cumplen estas condiciones, se lanza un error y se interrumpe el procesamiento antes de llamar a Apps Script.



El evento rechazado se registra en los logs para facilitar su diagnóstico.



## 6. Validaciones en Google Apps Script



El receptor `doPost(e)` comprueba:



1. Existencia de contenido en la solicitud.

2. Formato JSON interpretable.

3. Autorización mediante `WEBHOOK_SECRET`.

4. Presencia y formato de campos obligatorios.

5. Validez del tamaño del archivo.



Solamente después de estas comprobaciones se ejecuta `procesarArchivoIntegrado(datos)`.



Esta validación adicional evita depender exclusivamente de las comprobaciones del cliente Node.js.



## 7. Prevención de duplicados



Se utiliza `idEvento` como identificador del archivo procesado.



La función `existeEvento()` consulta los identificadores previamente guardados en Google Sheets.



Antes de insertar una nueva fila, `guardarMetadatos()` utiliza `LockService` y vuelve a comprobar si el evento ya existe.



Si encuentra un identificador repetido:



- No agrega una nueva fila.

- No ejecuta una nueva notificación desde el flujo integrado.

- Devuelve una respuesta indicando que el evento está duplicado.



Se comprobó este comportamiento mediante eventos repetidos durante las pruebas.



El mecanismo reduce duplicados en los escenarios ensayados, pero no garantiza procesamiento exactamente una vez ante fallos parciales.



## 8. Seguridad de Google Sheets y Gmail



### Google Sheets



- Se utiliza una hoja de cálculo restringida.

- Los metadatos se registran en columnas definidas.

- Se utiliza `LockService` para reducir conflictos entre escrituras.

- Se identifican eventos existentes antes de insertar nuevos registros.

- Los valores de texto se preparan para reducir el riesgo de interpretación como fórmulas.



### Gmail



- El destinatario se obtiene desde la propiedad `CORREO_NOTIFICACION`.

- Se valida el formato del correo configurado.

- Se comprueba el estado de notificación antes del envío.

- Después del envío se registra `Enviado` en Google Sheets.



Las pruebas utilizaron información simulada y destinatarios propios.



## 9. Cuenta de servicio de Google Cloud



Durante el Día 1 se creó una cuenta de servicio en GCP como parte de la configuración de IAM.



Esta cuenta forma parte de la preparación de la infraestructura, pero no se utilizó para ejecutar la Cloud Function local ni para autenticar el webhook de Apps Script.



El flujo principal del Día 3 utiliza un secreto compartido para autorizar las solicitudes del prototipo.



Para un despliegue real en GCP sería necesario definir los permisos mínimos de la identidad de ejecución y un mecanismo adecuado para administrar las credenciales.



No se debe presentar la cuenta de servicio como una autenticación de extremo a extremo implementada en esta prueba.



## 10. Manejo de errores y registros



La implementación utiliza:



- Bloques `try/catch` para capturar errores.

- Registros estructurados mediante `console.log` y `console.error`.

- Identificadores de eventos para facilitar el seguimiento.

- Comprobación de respuestas HTTP.

- Comprobación de resultados JSON.

- Manejo de errores de validación, comunicación y procesamiento.



Durante las pruebas se verificó que un evento inválido no fuera enviado a Workspace.



También se simuló la caída de un receptor local, comprobando que Node.js detectara la falla.



## 11. Revisión de dependencias



Se ejecutó `npm audit` para identificar vulnerabilidades en las dependencias instaladas.



El análisis reportó cuatro vulnerabilidades de severidad moderada relacionadas con dependencias como `uuid`, `cloudevents`, `gaxios` y Functions Framework.



Se utilizó `npm audit fix --dry-run` para evaluar posibles cambios sin modificar el proyecto.



La herramienta indicó que una corrección automática completa requeriría cambios incompatibles en Functions Framework.



Por esta razón no se ejecutó `npm audit fix --force`.



Las vulnerabilidades quedaron documentadas como pendientes de revisión y actualización.



## 12. Riesgos y limitaciones



\| Riesgo o limitación | Estado o medida |

\|---|---|

\| Endpoint público de pruebas | Restringir o retirar al concluir |

\| Uso de secreto compartido | Adecuado solo como control básico del prototipo |

\| Exposición accidental de credenciales | Rotar secretos y retirar evidencias sensibles |

\| Cloud Function sin desplegar | Ejecutada localmente mediante Functions Framework |

\| Bucket de Cloud Storage no creado | Eventos simulados |

\| Ejecución con permisos del propietario | Requiere controles adicionales en producción |

\| Fallos parciales durante el envío de Gmail | Recuperación automática pendiente |

\| Reintentos automáticos | No implementados |

\| Pruebas de alta concurrencia | No realizadas |

\| Vulnerabilidades moderadas de npm | Pendientes de corrección |



## 13. Mejoras propuestas para producción



1. Implementar autenticación robusta entre servicios.

2. Evitar exponer directamente un endpoint con permisos amplios del propietario.

3. Gestionar secretos mediante un servicio especializado.

4. Aplicar mínimo privilegio a las identidades de GCP.

5. Incorporar una estrategia de reintentos controlados.

6. Implementar recuperación ante fallos parciales de Gmail.

7. Añadir monitoreo, auditoría y alertas.

8. Realizar pruebas de concurrencia y carga.

9. Mantener actualizadas las dependencias.

10. Restringir los accesos una vez concluida la evaluación.



## 14. Conclusión



La integración del Día 3 incorpora validaciones en Node.js y Apps Script, autorización mediante un secreto compartido, prevención de duplicados y registros de errores.



Las pruebas `EVT-024`, `EVT-025` y `EVT-026` demostraron el rechazo de solicitudes sin credenciales válidas, la aceptación de solicitudes autorizadas, la detección de duplicados y la comunicación HTTP real con Google Sheets y Gmail.



El prototipo cumple funcionalmente el flujo de integración solicitado utilizando una Cloud Function local y servicios reales de Workspace.



Para un entorno de producción será necesario reforzar la autenticación, gestionar las credenciales de forma centralizada y desplegar la infraestructura con una identidad de ejecución de privilegios mínimos.
