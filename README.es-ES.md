

# Repositorio de Datos de Presas de Kerala

Este repositorio contiene datos en vivo e históricos / API de niveles de agua para las principales presas de Kerala, India. Los datos se actualizan automáticamente todos los días mediante GitHub Actions.

## PANEL EN VIVO - https://dams.keralam.co

## Descripción general

Este proyecto extrae datos de [KSEB Limted Dam Safety Organisation](https://dams.kseb.in/?page_id=45) y de la [página de niveles de agua de presas de Kerala SDMA](https://sdma.kerala.gov.in/dam-water-level/) y los almacena en formato JSON. Proporciona tanto datos en vivo como datos históricos para varias presas de KSEB y del departamento de Irrigación en Kerala.

## Características

- Actualizaciones automáticas diarias usando GitHub Actions
- Datos en vivo disponibles en `live.json`
- Datos en vivo de irrigación disponibles en `irrigation_live.json`
- Datos históricos para cada presa almacenados en archivos JSON separados
- Datos históricos de irrigación almacenados en `irrigation_historic_data`

## Estructura de Datos

### Datos en vivo de KSEB (`live.json`)

El archivo `live.json` contiene los datos más recientes de todas las presas. Su estructura es la siguiente:

```json
{
  "lastUpdate": "DD.MM.YYYY",
  "dams": [
    {
      "id": "string",
      "name": "string",
      "officialName": "string",
      "MWL": "string",
      "FRL": "string",
      "liveStorageAtFRL": "string",
      "ruleLevel": "string",
      "blueLevel": "string",
      "orangeLevel": "string",
      "redLevel": "string",
      "latitude": number,
      "longitude": number,
      "data": [
        {
          "date": "DD.MM.YYYY",
          "waterLevel": "string",
          "liveStorage": "string",
          "storagePercentage": "string",
          "inflow": "string",
          "powerHouseDischarge": "string",
          "spillwayRelease": "string",
          "totalOutflow": "string",
          "rainfall": "string"
        }
      ]
    }
  ]
}
```

### Datos en vivo de Irrigación (`irrigation_live.json`)

El archivo `irrigation_live.json` contiene los datos más recientes de los embalses de irrigación extraídos del enlace PDF diario de SDMA. Sigue la misma estructura general que `live.json`, con algunos campos específicos de irrigación:

```json
{
  "lastUpdate": "DD.MM.YYYY",
  "sourceUrl": "string",
  "dams": [
    {
      "id": "string",
      "name": "string",
      "officialName": "string",
      "source": "Irrigation",
      "district": "string",
      "MWL": "string",
      "FRL": "string",
      "grossStorage": "string",
      "liveStorageAtFRL": "string",
      "ruleLevel": "string",
      "blueLevel": "string",
      "orangeLevel": "string",
      "redLevel": "string",
      "latitude": null,
      "longitude": null,
      "data": [
        {
          "date": "DD.MM.YYYY",
          "waterLevel": "string",
          "liveStorage": "string",
          "storagePercentage": "string",
          "inflow": "string",
          "powerHouseDischarge": "string",
          "spillwayRelease": "string",
          "totalOutflow": "string",
          "outflow": "string",
          "rainfall": "string",
          "remarks": "string"
        }
      ]
    }
  ]
}
```

### Datos Históricos (`historic_data/{dam_name}.json`)

Cada presa tiene su propio archivo JSON en la carpeta `historic_data`, que contiene todos los puntos de datos históricos. La estructura es similar a la de una sola entrada de presa en los datos en vivo, pero con múltiples puntos de datos en la matriz `data`.

### Datos Históricos de Irrigación (`irrigation_historic_data/{dam_name}.json`)

Cada presa o embalse de irrigación tiene su propio archivo JSON en la carpeta `irrigation_historic_data`. La estructura es similar a la de una sola entrada de presa en `irrigation_live.json`, pero con múltiples puntos de datos en la matriz `data`.

### Explicación de Términos y Unidades

- `id`: Identificador único de la presa
- `name`: Nombre común de la presa
- `officialName`: Nombre oficial de la presa según KSEB
- `MWL` (Maximum Water Level): El nivel más alto de agua que la presa puede contener de forma segura (metros)
- `FRL` (Full Reservoir Level): El nivel de agua en el que el embalse se considera lleno (metros)
- `liveStorageAtFRL`: El volumen de agua que se puede almacenar entre el nivel mínimo de vaciado y el FRL (millones de metros cúbicos o MCM)
- `ruleLevel`: El nivel de agua en el que entran en vigor normas operativas específicas (metros)
- `blueLevel`: Nivel de alerta que indica niveles de agua en ascenso (metros)
- `orangeLevel`: Nivel de aviso que indica niveles de agua críticamente altos (metros)
- `redLevel`: Nivel de peligro que indica un posible desbordamiento (metros)
- `latitude`: Coordenada geográfica (grados decimales)
- `longitude`: Coordenada geográfica (grados decimales)
- `date`: Fecha del punto de datos registrado
- `waterLevel`: Nivel actual de agua en el embalse (metros)
- `liveStorage`: Volumen actual de agua almacenada en el embalse (millones de metros cúbicos o MCM)
- `storagePercentage`: Porcentaje de la capacidad del embalse actualmente llena (%)
- `inflow`: Tasa de agua que fluye hacia el embalse (metros cúbicos por segundo o m³/s)
- `powerHouseDischarge`: Tasa de agua liberada a través de las turbinas de generación de energía (metros cúbicos por segundo o m³/s)
- `spillwayRelease`: Tasa de agua liberada a través del vertedero de la presa (metros cúbicos por segundo o m³/s)
- `totalOutflow`: Tasa total de agua liberada de la presa (metros cúbicos por segundo o m³/s)
- `rainfall`: Cantidad de precipitaciones registradas en el sitio de la presa (milímetros o mm)


## API

- **Datos en vivo de KSEB**: Acceda a los datos más recientes de KSEB en `https://github.com/amith-vp/Kerala-Dam-Water-Levels/blob/main/live.json`
- **Datos en vivo de Irrigación**: Acceda a los datos más recientes de irrigación en `https://github.com/amith-vp/Kerala-Dam-Water-Levels/blob/main/irrigation_live.json`
- **Datos históricos de KSEB**: Acceda a los datos históricos de una presa KSEB específica en `/historic_data/{dam_name}.json`
- **Datos históricos de Irrigación**: Acceda a los datos históricos de un embalse de irrigación específico en `/irrigation_historic_data/{dam_name}.json`

## Flujo de Trabajo

1. El script se ejecuta diariamente a través de GitHub Actions.
2. Obtiene la actualización más reciente del sitio web de KSEB.
3. Obtiene el enlace PDF de Irrigación con la fecha más reciente de la página de niveles de agua de presas de SDMA.
4. Los datos HTML de KSEB y los datos PDF de Irrigación se extraen y procesan para cada presa.
5. Los archivos `live.json` e `irrigation_live.json` se actualizan con los datos más recientes.
6. Los archivos de datos históricos se actualizan para cada presa.
7. Los cambios se confirman y se envían al repositorio.

## Contribuciones

Las contribuciones para mejorar la recopilación de datos, el procesamiento o para agregar nuevas características son bienvenidas. Por favor, envíe una solicitud de extracción (pull request) o abra un problema para discutir los cambios propuestos.

## Licencia

[Licencia MIT](LICENSE)

## Descargo de responsabilidad

Estos datos se extraen del sitio web del Kerala State Electricity Board y se proporcionan tal cual, por lo que podrían no ser datos precisos (errores de análisis). Por favor, consulte la fuente original para obtener información oficial.
