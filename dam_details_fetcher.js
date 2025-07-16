const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;

const baseUrl = 'https://dams.kseb.in/?page_id=45';

// Fetch the most recent update from the base URL
const fetchMostRecentUpdate = async () => {
try {
  const response = await axios.get(baseUrl);
  const html = response.data;
  const $ = cheerio.load(html);

  const pageElement = $('.elementor-post').first();
  const date = pageElement.find('.elementor-post__title a').text().trim();
  const link = pageElement.find('.elementor-post__title a').attr('href');

  console.log('Fetched date:', date, 'Link:', link); 
  return { date, link };
} catch (error) {
  console.error('Error fetching the most recent page:', error);
  return null;
}
};

// Dam coordinates for geolocation data
const damCoordinates = {
'idukki': { latitude: 9.8436, longitude: 76.9762 },
'idamalayar': { latitude: 10.221867602366947, longitude: 76.70603684268934 },
'kakki (anathode )': { latitude: 9.341667, longitude: 77.15 },
'banasurasagar(k a scheme)': { latitude: 11.6709, longitude: 75.9504 },
'sholayar': { latitude: 10.3178, longitude: 76.7342 },
'madupetty': { latitude: 10.1063, longitude: 77.1238 },
'anayirankal': { latitude: 10.009515341318457, longitude: 77.20724298186308 },
'ponmudi': { latitude: 9.9604, longitude: 77.0565 },
'kuttiyadi(kakkayam)': { latitude: 11.551, longitude: 75.925 },
'pamba': { latitude: 9.3906, longitude: 77.1598 },
'poringalkuthu': { latitude: 10.3152, longitude: 76.6344 },
'kundala': { latitude: 10.14358754366575, longitude: 77.19868256414041 },
'kallarkutty': { latitude: 9.98, longitude: 77.001389 },
'erattayar': { latitude: 9.8103, longitude: 77.106 },
'lower periyar': { latitude: 9.9620, longitude: 76.9568 },
'moozhiyar': { latitude: 9.308, longitude: 77.0656 },
'kallar': { latitude: 9.8255, longitude: 77.1562 },
'sengulam (pumping storage dam)': { latitude: 10.010833, longitude: 77.0325 },
};

// Map official names to their display names
const Names = {
'IDUKKI': 'Idukki',
'IDAMALAYAR': 'Idamalayar',
'KAKKI – ANATHODE': 'Anathode', // Updated mapping
'BANASURASAGAR (K A S)': 'Banasura Sagar', // Updated mapping
'SHOLAYAR': 'Sholayar',
'MADUPETTY': 'Mattupetty',
'ANAYIRANKAL': 'Anayirankal',
'PONMUDI': 'Ponmudi',
'KUTTIYADI (KAKKAYAM)': 'Kakkayam', // Updated mapping
'PAMBA': 'Pamba',
'PORINGALKUTHU': 'Poringalkuthu',
'KUNDALA': 'Kundala',
'KALLARKUTTY': 'Kallarkutty',
'ERATTAYAR': 'Erattayar',
'LOWER PERIYAR': 'Pambla',
'MOOZHIYAR': 'Moozhiyar',
'KALLAR': 'Kallar',
'SENGULAM': 'Chenkulam', // Updated mapping
};

// Convert feet to meters
const convertFeetToMeters = (value) => {
if (typeof value === 'string' && value.trim().toLowerCase().endsWith('ft')) {
  const feet = parseFloat(value.trim().replace('ft', ''));
  return `${(feet * 0.3048).toFixed(2)}`;
}
return `${(value * 0.3048).toFixed(2)}`;
};

// Extract dam details from the given URL
async function extractDamDetails(url) {
try {
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const dams = [];

  console.log('Extracting dam details from:', url);
   // Updated logic to handle the new table structure
  $('table tr').slice(1).each((index, row) => {
    const columns = $(row).find('td');
    if (columns.length >= 19) { // Changed from 21 to 19
      console.log(`Processing row ${index + 1} with ${columns.length} columns`);

      const damName = $(columns[1]).text().trim();
      const damKey = damName.toLowerCase();
      console.log('Processing dam:', damKey, '-> Display name:', Names[damName]);
    
      const dam = {
        id: $(columns[0]).text().trim(),
        name: Names[damName],
        officialName: damName,
        MWL: $(columns[3]).text().trim(), // FRL (metre)
        FRL: $(columns[3]).text().trim(), // FRL (metre)
        liveStorageAtFRL: $(columns[9]).text().trim(), // Live Storage(MCM)
        ruleLevel: $(columns[4]).text().trim(), // Rule level(metre)
        blueLevel: $(columns[6]).text().trim(), // Blue Alert level(metre)
        orangeLevel: $(columns[7]).text().trim(), // Orange Alert level(metre)
        redLevel: $(columns[8]).text().trim(), // Red Alert Level(metre)
        latitude: damCoordinates[damKey] ? damCoordinates[damKey].latitude : null,
        longitude: damCoordinates[damKey] ? damCoordinates[damKey].longitude : null,
        data: [{
          date: $('h1.entry-title').text().trim(),
          waterLevel: $(columns[5]).text().trim(), // Water level on date (metre)
          liveStorage: $(columns[9]).text().trim(), // Live Storage(MCM)
          storagePercentage: $(columns[10]).text().trim(), // % Storage
          inflow: $(columns[11]).text().trim(), // Inflow (MCM)
          powerHouseDischarge: $(columns[13]).text().trim(), // Power House Discharge (MCM)
          spillwayRelease: $(columns[14]).text().trim(), // Spill(MCM)
          totalOutflow: $(columns[16]).text().trim(), // Total Outflow (MCM)
          rainfall: $(columns[17]).text().trim(), // Rainfall (mm)
        }]
      };

      // Convert units for Idukki and Sholayar dams
      if (damKey === 'idukki' || damKey === 'sholayar') {
        dam.MWL = convertFeetToMeters(dam.MWL);
        dam.FRL = convertFeetToMeters(dam.FRL);
        dam.ruleLevel = convertFeetToMeters(dam.ruleLevel);
        dam.blueLevel = convertFeetToMeters(dam.blueLevel);
        dam.orangeLevel = convertFeetToMeters(dam.orangeLevel);
        dam.redLevel = convertFeetToMeters(dam.redLevel);

        dam.data = dam.data.map(entry => ({
          ...entry,
          waterLevel: convertFeetToMeters(entry.waterLevel)
        }));
      }

      // Only add dam if it has a valid name mapping
      if (dam.name) {
        dams.push(dam);
        console.log(`Added dam: ${dam.name} with data for ${dam.data[0].date}`);
      } else {
        console.log(`Skipping dam with unmapped name: ${damName}`);
      }
    }
  });

  console.log(`Total dams extracted: ${dams.length}`);
  return { dams };
} catch (error) {
  console.error(`Error fetching details from ${url}:`, error);
  return { dams: [] };
}
}

const folderName = 'historic_data';

// Fetch dam details and update the data files
async function fetchDamDetails() {
try {
  try {
    await fs.access(folderName);
  } catch (error) {
    await fs.mkdir(folderName);
    console.log('Created historic_data folder');
  }

  const page = await fetchMostRecentUpdate();
  if (!page) {
    console.log('No recent page found.');
    return;
  }

  console.log(`Processing page: ${page.date}`);
  const { dams } = await extractDamDetails(page.link);

  if (dams.length === 0) {
    console.log('No dam data extracted. Check if the website structure has changed.');
    return;
  }

  const existingData = {};
  const files = await fs.readdir(folderName);
  console.log('Found existing files:', files);
   for (const file of files) {
    if (file.endsWith('.json')) {
      // Fixed: Remove .json extension and convert underscores to spaces for dam name
      const damName = file.replace('.json', '').replace(/_/g, ' ');
      console.log(`Loading existing data for: ${damName} from ${file}`);
      try {
        const data = JSON.parse(await fs.readFile(`${folderName}/${file}`, 'utf8'));
        existingData[damName] = data;
      } catch (error) {
        console.error(`Error reading ${file}:`, error);
      }
    }
  }

  let dataChanged = false;

  for (const newDam of dams) {
    const existingDam = existingData[newDam.name];
    console.log(`Processing ${newDam.name}:`, existingDam ? 'exists' : 'new dam');

    if (existingDam) {
      const newDate = newDam.data[0].date;
      const dateExists = existingDam.data.some(d => d.date === newDate);
      console.log(`Checking if date ${newDate} exists:`, dateExists);

      if (!dateExists) {
        console.log(`Adding new data for ${newDam.name} with date ${newDate}`);
        existingDam.data.unshift(newDam.data[0]);
        // Update all dam properties with latest values
        existingDam.id = newDam.id;
        existingDam.officialName = newDam.officialName;
        existingDam.MWL = newDam.MWL;
        existingDam.FRL = newDam.FRL;
        existingDam.liveStorageAtFRL = newDam.liveStorageAtFRL;
        existingDam.ruleLevel = newDam.ruleLevel;
        existingDam.blueLevel = newDam.blueLevel;
        existingDam.orangeLevel = newDam.orangeLevel;
        existingDam.redLevel = newDam.redLevel;
        existingDam.latitude = newDam.latitude;
        existingDam.longitude = newDam.longitude;
        dataChanged = true;
      } else {
        console.log(`Data for ${newDam.name} with date ${newDate} already exists. Skipping.`);
      }
    } else {
      console.log(`Creating new dam entry for: ${newDam.name}`);
      existingData[newDam.name] = newDam;
      dataChanged = true;
    }
  }

  if (dataChanged) {
    console.log('Data changed. Updating files...');
    for (const [damName, damData] of Object.entries(existingData)) {
      const filename = `${folderName}/${damName.replace(/\s+/g, '_')}.json`;
      await fs.writeFile(filename, JSON.stringify(damData, null, 4));
      console.log(`Details for dam ${damName} saved successfully in ${filename}.`);
    }

    // Save live JSON file with most recent data
    const liveData = {
      lastUpdate: page.date,
      dams
    };
    await fs.writeFile('live.json', JSON.stringify(liveData, null, 4));
    console.log('Live dam data saved successfully in live.json.');
  } else {
    console.log('No data changes detected. Files not updated.');
  }
} catch (error) {
  console.error('Error:', error);
}
}


fetchDamDetails()

module.exports = { extractDamDetails };
