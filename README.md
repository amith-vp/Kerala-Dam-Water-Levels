# Kerala Dam Data Repository

This repository contains live and historical data / API of water levels for major dams in Kerala, India. The data is automatically updated daily using GitHub Actions.

## LIVE DASHBOARD - https://dams.keralam.co

## Overview

This project scrapes data from [KSEB Limted Dam Safety Organisation](https://dams.kseb.in/?page_id=45) and the [Kerala SDMA dam water level page](https://sdma.kerala.gov.in/dam-water-level/) and stores it in JSON format. It provides both live data and historical data for various KSEB and Irrigation department dams in Kerala.

## Features

- Automatic daily updates using GitHub Actions
- Live data available in `live.json`
- Irrigation live data available in `irrigation_live.json`
- Historical data for each dam stored in separate JSON files
- Irrigation historical data stored in `irrigation_historic_data`

## Data Structure

### KSEB Live Data (`live.json`)

The `live.json` file contains the most recent data for all dams. Its structure is as follows:

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

### Irrigation Live Data (`irrigation_live.json`)

The `irrigation_live.json` file contains the most recent irrigation reservoir data extracted from the daily SDMA PDF link. It follows the same general shape as `live.json`, with a few irrigation-specific fields:

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

### Historical Data (`historic_data/{dam_name}.json`)

Each dam has its own JSON file in the `historic_data` folder, containing all historical data points. The structure is similar to a single dam entry in the live data, but with multiple data points in the `data` array.

### Irrigation Historical Data (`irrigation_historic_data/{dam_name}.json`)

Each irrigation dam or reservoir has its own JSON file in the `irrigation_historic_data` folder. The structure is similar to a single dam entry in `irrigation_live.json`, but with multiple data points in the `data` array.

### Explanation of Terms and Units

- `id`: Unique identifier for the dam
- `name`: Common name of the dam
- `officialName`: Official name of the dam as per KSEB
- `MWL` (Maximum Water Level): The highest level of water that the dam can safely hold (meters)
- `FRL` (Full Reservoir Level): The level of water at which the reservoir is considered full (meters)
- `liveStorageAtFRL`: The volume of water that can be stored between the minimum draw-down level and the FRL (million cubic meters or MCM)
- `ruleLevel`: The water level at which specific operational rules come into effect (meters)
- `blueLevel`: Alert level indicating rising water levels (meters)
- `orangeLevel`: Warning level indicating critically high water levels (meters)
- `redLevel`: Danger level indicating potential overflow (meters)
- `latitude`: Geographic coordinate (decimal degrees)
- `longitude`: Geographic coordinate (decimal degrees)
- `date`: Date of the recorded data point
- `waterLevel`: Current water level in the reservoir (meters)
- `liveStorage`: Current volume of water stored in the reservoir (million cubic meters or MCM)
- `storagePercentage`: Percentage of the reservoir's capacity currently filled (%)
- `inflow`: Rate of water flowing into the reservoir (cubic meters per second or m³/s)
- `powerHouseDischarge`: Rate of water released through the power generation turbines (cubic meters per second or m³/s)
- `spillwayRelease`: Rate of water released through the dam's spillway (cubic meters per second or m³/s)
- `totalOutflow`: Total rate of water released from the dam (cubic meters per second or m³/s)
- `rainfall`: Amount of rainfall recorded at the dam site (millimeters or mm)


## API

- **KSEB Live Data**: Access the most recent KSEB data at `https://github.com/amith-vp/Kerala-Dam-Water-Levels/blob/main/live.json`
- **Irrigation Live Data**: Access the most recent irrigation data at `https://github.com/amith-vp/Kerala-Dam-Water-Levels/blob/main/irrigation_live.json`
- **KSEB Historical Data**: Access historical data for a specific KSEB dam at `/historic_data/{dam_name}.json`
- **Irrigation Historical Data**: Access historical data for a specific irrigation reservoir at `/irrigation_historic_data/{dam_name}.json`

## Workflow

1. The script runs daily via GitHub Actions.
2. It fetches the most recent update from the KSEB website.
3. It fetches the latest dated Irrigation PDF link from the SDMA dam water level page.
4. KSEB HTML data and Irrigation PDF data are extracted and processed for each dam.
5. The `live.json` and `irrigation_live.json` files are updated with the most recent data.
6. Historical data files are updated for each dam.
7. Changes are committed and pushed to the repository.

## Contributing

Contributions to improve the data collection, processing, or to add new features are welcome. Please submit a pull request or open an issue to discuss proposed changes.

## License

[MIT License](LICENSE)

## Disclaimer

This data is scraped from the Kerala State Electricity Board website and is provided as-is also may not be accurate data(parsing errors). Please refer to the original source for official information.
