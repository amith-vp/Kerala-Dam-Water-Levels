const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;

const baseUrl = 'https://dams.kseb.in/?page_id=45';

// Fetch the most recent update from the base URL and previous 5 dates
const fetchMostRecentUpdateWithHistory = async () => {
  try {
    const response = await axios.get(baseUrl);
    const html = response.data;
    const $ = cheerio.load(html);

    const pages = [];
    $('.elementor-post').slice(0, 6).each((index, element) => {
      const date = $(element).find('.elementor-post__title a').text().trim();
      const link = $(element).find('.elementor-post__title a').attr('href');
      pages.push({ date, link });
    });

    return pages.length > 0 ? pages : [{ date:"22.02.2025", link:"https://dams.kseb.in/?p=5127" }];
  } catch (error) {
    console.error('Error fetching the recent pages:', error);
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

// Helper function to parse dates in different formats
const parseDateString = (dateStr) => {
  // Remove any leading/trailing whitespace
  dateStr = dateStr.trim();
  // Replace both . and / with - for consistent format
  const normalized = dateStr.replace(/[./]/g, '-');
  // Split and reverse to get YYYY-MM-DD format for Date constructor
  const parts = normalized.split('-');
  if (parts.length === 3) {
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  }
  return null;
};

// Helper function to standardize date format to DD.MM.YYYY
const standardizeDateFormat = (dateStr) => {
  const date = parseDateString(dateStr);
  if (!date) return dateStr; // Return original if parsing fails
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}.${month}.${year}`;
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
            date: standardizeDateFormat($('h1.entry-title').text().trim()),
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

    const pages = await fetchMostRecentUpdateWithHistory();
    if (!pages || pages.length === 0) {
      console.log('No pages found.');
      return;
    }

    const existingData = {};
    const files = await fs.readdir(folderName);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const damName = file.replace('.json', '');
        const data = JSON.parse(await fs.readFile(`${folderName}/${file}`, 'utf8'));
        existingData[damName] = data;
      }
    }

    let dataChanged = false;

    // Get the most recent data first (before reversing pages)
    const mostRecentPage = pages[0];
    const { dams: mostRecentDams } = await extractDamDetails(mostRecentPage.link);

    // Process pages in chronological order (oldest to newest)
    const sortedPages = pages.reverse();
    for (const page of sortedPages) {
      console.log(`Processing page: ${standardizeDateFormat(page.date)}`);
      const { dams } = await extractDamDetails(page.link);

      for (const newDam of dams) {
        const formattedDamName = newDam.name.replace(/\s+/g, '_');
        const existingDam = existingData[newDam.name];

        if (existingDam) {
          const dateExists = existingDam.data.some(d => d.date === standardizeDateFormat(newDam.data[0].date));

          if (!dateExists) {
            // Find the correct position to insert the new data using the new date parser
            const insertIndex = existingDam.data.findIndex(d => {
              const entryDate = parseDateString(d.date);
              const newDate = parseDateString(newDam.data[0].date);
              return entryDate < newDate;
            });

            if (insertIndex === -1) {
              existingDam.data.push(newDam.data[0]);
            } else {
              existingDam.data.splice(insertIndex, 0, newDam.data[0]);
            }

            // Update dam metadata
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
    }

    if (dataChanged) {
      for (const [damName, damData] of Object.entries(existingData)) {
        // Sort data by date in descending order before saving using the new date parser
        damData.data.sort((a, b) => {
          const dateA = parseDateString(a.date);
          const dateB = parseDateString(b.date);
          return dateB - dateA;
        });

        // Ensure all dates in the data array are in DD.MM.YYYY format
        damData.data = damData.data.map(entry => ({
          ...entry,
          date: standardizeDateFormat(entry.date)
        }));

        const filename = `${folderName}/${damName.replace(/\s+/g, '_')}.json`;
        await fs.writeFile(filename, JSON.stringify(damData, null, 4));
        console.log(`Details for dam ${damName} saved successfully in ${filename}.`);
      }

      // Save live JSON file with the first (most recent) table's data
      const liveData = {
        lastUpdate: standardizeDateFormat(mostRecentPage.date),
        dams: mostRecentDams.map(dam => ({
          ...dam,
          data: dam.data.map(entry => ({
            ...entry,
            date: standardizeDateFormat(entry.date)
          }))
        }))
      };
      await fs.writeFile('live.json', JSON.stringify(liveData, null, 4));
      console.log('Live dam data saved successfully in live.json.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

fetchDamDetails();
