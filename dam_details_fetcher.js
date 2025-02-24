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
  'KAKKI (ANATHODE )': 'Anathode',
  'BANASURASAGAR(K A SCHEME)': 'Banasura Sagar',
  'SHOLAYAR': 'Sholayar',
  'MADUPETTY': 'Mattupetty',
  'ANAYIRANKAL': 'Anayirankal',
  'PONMUDI': 'Ponmudi',
  'KUTTIYADI(KAKKAYAM)': 'Kakkayam',
  'PAMBA': 'Pamba',
  'PORINGALKUTHU': 'Poringalkuthu',
  'KUNDALA': 'Kundala',
  'KALLARKUTTY': 'Kallarkutty',
  'ERATTAYAR': 'Erattayar',
  'LOWER PERIYAR': 'Pambla',
  'MOOZHIYAR': 'Moozhiyar',
  'KALLAR': 'Kallar',
  'SENGULAM (PUMPING STORAGE DAM)': 'Chenkulam',
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

    $('table tr').slice(2, 20).each((index, row) => {
      const columns = $(row).find('td');
      if (columns.length > 21) {
        const damName = $(columns[1]).text().trim();
        const damKey = damName.toLowerCase();
        const dam = {
          id: $(columns[0]).text().trim(),
          name: Names[damName],
          officialName: damName,
          MWL: $(columns[3]).text().trim(),
          FRL: $(columns[4]).text().trim(),
          liveStorageAtFRL: $(columns[6]).text().trim(),
          ruleLevel: $(columns[7]).text().trim(),
          blueLevel: $(columns[8]).text().trim(),
          orangeLevel: $(columns[9]).text().trim(),
          redLevel: $(columns[10]).text().trim(),
          latitude: damCoordinates[damKey] ? damCoordinates[damKey].latitude : null,
          longitude: damCoordinates[damKey] ? damCoordinates[damKey].longitude : null,
          data: [{
            date: $('h1.entry-title').text().trim(),
            waterLevel: $(columns[11]).text().trim(),
            liveStorage: $(columns[12]).text().trim(),
            storagePercentage: $(columns[13]).text().trim(),
            inflow: $(columns[16]).text().trim(),
            powerHouseDischarge: $(columns[17]).text().trim(),
            spillwayRelease: $(columns[18]).text().trim(),
            totalOutflow: $(columns[19]).text().trim(),
            rainfall: $(columns[20]).text().trim(),
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

        dams.push(dam);
      }
    });

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
    }

    const page = await fetchMostRecentUpdate();
    if (!page) {
      console.log('No recent page found.');
      return;
    }

    console.log(`Processing page: ${page.date}`);
    const { dams } = await extractDamDetails(page.link);

    const existingData = {};
    const files = await fs.readdir(folderName);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const damName = file.replace('historic_data_', '').replace('.json', '').replace(/_/g, ' ');
        const data = JSON.parse(await fs.readFile(`${folderName}/${file}`, 'utf8'));
        existingData[damName] = data;
      }
    }

    let dataChanged = false;

    for (const newDam of dams) {
        const formattedDamName = newDam.name.replace(/\s+/g, '_');
        const existingDam = existingData[newDam.name];
  
        if (existingDam) {
          const dateExists = existingDam.data.some(d => d.date === newDam.data[0].date);
  
          if (!dateExists) {
            existingDam.data.unshift(newDam.data[0]);
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
          }
        } else {
          existingData[newDam.name] = newDam;
          dataChanged = true;
        }
      }
  
      if (dataChanged) {
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
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }
  
  fetchDamDetails();
  