# Prueba de integración con múltiples archivos.
# Los eventos se envían a la Cloud Function local.

$archivos = @(
    @{
        id = "EVT-017"
        nombre = "reporte_ventas.pdf"
        tamano = "204800"
        tipo = "application/pdf"
    },
    @{
        id = "EVT-018"
        nombre = "imagen_producto.jpg"
        tamano = "153600"
        tipo = "image/jpeg"
    },
    @{
        id = "EVT-019"
        nombre = "datos_inventario.csv"
        tamano = "51200"
        tipo = "text/csv"
    }
)

foreach ($archivo in $archivos) {

    $headers = @{
        "ce-id" = $archivo.id
        "ce-source" = "//storage.googleapis.com/projects/_/buckets/bucket-pruebas"
        "ce-specversion" = "1.0"
        "ce-type" = "google.cloud.storage.object.v1.finalized"
        "ce-time" = "2026-10-26T18:00:00Z"
    }

    $body = @{
        name = $archivo.nombre
        bucket = "bucket-pruebas"
        size = $archivo.tamano
        contentType = $archivo.tipo
    } | ConvertTo-Json

    try {
        Invoke-RestMethod `
            -Uri "http://127.0.0.1:8080/" `
            -Method Post `
            -Headers $headers `
            -ContentType "application/json" `
            -Body $body `
            -ErrorAction Stop

        Write-Host "Solicitud completada: $($archivo.id) - $($archivo.nombre)"

    } catch {
        Write-Host "Error en $($archivo.id): $($_.Exception.Message)"
    }
}
