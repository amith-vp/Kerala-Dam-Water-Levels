# Kerala Dam Data Repository

This repository contains live and historical data / API of water levels for major dams in Kerala, India. The data is automatically updated daily using GitHub Actions.

## LIVE DASHBOARD - https://dams.keralam.co

## Overview

This project scrapes data from [KSEB Limted Dam Safety Organisation](https://dams.kseb.in/?page_id=45) website and stores it in JSON format. It provides both live data and historical data for various dams in Kerala.

## Features

- Automatic daily updates using GitHub Actions
- Live data available in `live.json`
- Historical data for each dam stored in separate JSON files

## Data Structure

### Live Data (`live.json`)

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

### Historical Data (`historic_data/{dam_name}.json`)

Each dam has its own JSON file in the `historic_data` folder, containing all historical data points. The structure is similar to a single dam entry in the live data, but with multiple data points in the `data` array.

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

- **Live Data**: Access the most recent data for all dams at `https://github.com/amith-vp/Kerala-Dam-Water-Levels/blob/main/live.json`
- **Historical Data**: Access historical data for a specific dam at `/historic_data/{dam_name}.json`

## Workflow

1. The script runs daily via GitHub Actions.
2. It fetches the most recent update from the KSEB website.
3. Data is extracted and processed for each dam.
4. The `live.json` file is updated with the most recent data.
5. Historical data files are updated for each dam.
6. Changes are committed and pushed to the repository.

## Contributing

Contributions to improve the data collection, processing, or to add new features are welcome. Please submit a pull request or open an issue to discuss proposed changes.

## License

[MIT License](LICENSE)

## Disclaimer

This data is scraped from the Kerala State Electricity Board website and is provided as-is also may not be accurate data(parsing errors). Please refer to the original source for official information.
