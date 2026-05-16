const axios = require('axios');
const cheerio = require('cheerio');
const { PDFParse } = require('pdf-parse');
const fs = require('fs').promises;

const ksebBaseUrl = 'https://dams.kseb.in/?page_id=45';
const sdmaDamLevelUrl = 'https://sdma.kerala.gov.in/dam-water-level/';
const ksebFolderName = 'historic_data';
const irrigationFolderName = 'irrigation_historic_data';

// Fetch the most recent update from the KSEB base URL.
const fetchMostRecentUpdate = async () => {
try {
  const response = await axios.get(ksebBaseUrl);
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
'kakki – anathode': { latitude: 9.341667, longitude: 77.15 },
'banasurasagar (k a s)': { latitude: 11.6709, longitude: 75.9504 },
'sholayar': { latitude: 10.3178, longitude: 76.7342 },
'madupetty': { latitude: 10.1063, longitude: 77.1238 },
'anayirankal': { latitude: 10.009515341318457, longitude: 77.20724298186308 },
'ponmudi': { latitude: 9.9604, longitude: 77.0565 },
'kuttiyadi (kakkayam)': { latitude: 11.551, longitude: 75.925 },
'pamba': { latitude: 9.3906, longitude: 77.1598 },
'poringalkuthu': { latitude: 10.3152, longitude: 76.6344 },
'kundala': { latitude: 10.14358754366575, longitude: 77.19868256414041 },
'kallarkutty': { latitude: 9.98, longitude: 77.001389 },
'erattayar': { latitude: 9.8103, longitude: 77.106 },
'lower periyar': { latitude: 9.9620, longitude: 76.9568 },
'moozhiyar': { latitude: 9.308, longitude: 77.0656 },
'kallar': { latitude: 9.8255, longitude: 77.1562 },
'sengulam': { latitude: 10.010833, longitude: 77.0325 },
};

// Map official names to their display names
const Names = {
'IDUKKI': 'Idukki',
'IDAMALAYAR': 'Idamalayar',
'KAKKI – ANATHODE': 'Anathode',
'BANASURASAGAR (K A S)': 'Banasura Sagar',
'SHOLAYAR': 'Sholayar',
'MADUPETTY': 'Mattupetty',
'ANAYIRANKAL': 'Anayirankal',
'PONMUDI': 'Ponmudi',
'KUTTIYADI (KAKKAYAM)': 'Kakkayam',
'PAMBA': 'Pamba',
'PORINGALKUTHU': 'Poringalkuthu',
'KUNDALA': 'Kundala',
'KALLARKUTTY': 'Kallarkutty',
'ERATTAYAR': 'Erattayar',
'LOWER PERIYAR': 'Pambla',
'MOOZHIYAR': 'Moozhiyar',
'KALLAR': 'Kallar',
'SENGULAM': 'Chenkulam',
};

const irrigationDistricts = [
  'Thiruvananthapuram',
  'Kollam',
  'Pathanamthitta',
  'Alappuzha',
  'Kottayam',
  'Idukki',
  'Ernakulam',
  'Thrissur',
  'Palakkad',
  'Malappuram',
  'Kozhikode',
  'Wayanad',
  'Kannur',
  'Kasaragod'
];

const irrigationDamCoordinates = {
  'Bhoothathankettu (Barrage)': { latitude: 10.1330, longitude: 76.6660 },
  'Chimoni': { latitude: 10.4333, longitude: 76.4667 },
  'Chulliyar': { latitude: 10.7917, longitude: 76.7667 },
  'Kallada': { latitude: 8.9500, longitude: 77.0722 },
  'Kanjirappuzha': { latitude: 10.9667, longitude: 76.5333 },
  'Karapuzha': { latitude: 11.6167, longitude: 76.1750 },
  'Kuttiyadi': { latitude: 11.6125, longitude: 75.8242 },
  'Malampuzha': { latitude: 10.8583, longitude: 76.6750 },
  'Malankara': { latitude: 9.8417, longitude: 76.6250 },
  'Mangalam': { latitude: 10.5167, longitude: 76.5333 },
  'Maniyar (Barrage)': { latitude: 9.3333, longitude: 76.8833 },
  'Meenkara': { latitude: 10.6333, longitude: 76.8000 },
  'Moolathara (Regulator)': { latitude: 10.6750, longitude: 76.7667 },
  'Neyyar': { latitude: 8.5333, longitude: 77.1500 },
  'Pazhassi (Barrage)': { latitude: 11.9942, longitude: 75.6275 },
  'Peechi': { latitude: 10.4333, longitude: 76.4000 },
  'Pothundy': { latitude: 10.5417, longitude: 76.6083 },
  'Siruvani (Inter state waters)': { latitude: 10.9767, longitude: 76.6422 },
  'Vazhani': { latitude: 10.6333, longitude: 76.1500 },
  'Walayar': { latitude: 10.7917, longitude: 76.7667 },
};

// Convert feet to meters
const convertFeetToMeters = (value) => {
if (typeof value === 'string' && value.trim().toLowerCase().endsWith('ft')) {
  const feet = parseFloat(value.trim().replace('ft', ''));
  return `${(feet * 0.3048).toFixed(2)}`;
}
return `${(value * 0.3048).toFixed(2)}`;
};

const normaliseDate = (value) => {
  const match = value && value.match(/(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})/);
  if (!match) {
    return value ? value.trim() : '';
  }

  return `${match[1].padStart(2, '0')}.${match[2].padStart(2, '0')}.${match[3]}`;
};

const safeFilename = (name) => name.replace(/[\\/]/g, '-').replace(/\s+/g, '_');

const ensureFolder = async (folderName) => {
  try {
    await fs.access(folderName);
  } catch (error) {
    await fs.mkdir(folderName);
    console.log(`Created ${folderName} folder`);
  }
};

const loadExistingDamData = async (folderName) => {
  const existingData = {};
  const files = await fs.readdir(folderName);
  console.log(`Found existing files in ${folderName}:`, files);

  for (const file of files) {
    if (file.endsWith('.json')) {
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

  return existingData;
};

const updateDamData = async (folderName, liveFileName, page, dams, options = {}) => {
  if (dams.length === 0) {
    console.log(`No dam data extracted for ${liveFileName}.`);
    return false;
  }

  await ensureFolder(folderName);
  const existingData = await loadExistingDamData(folderName);
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
        Object.assign(existingDam, {
          id: newDam.id,
          officialName: newDam.officialName,
          MWL: newDam.MWL,
          FRL: newDam.FRL,
          liveStorageAtFRL: newDam.liveStorageAtFRL,
          ruleLevel: newDam.ruleLevel,
          blueLevel: newDam.blueLevel,
          orangeLevel: newDam.orangeLevel,
          redLevel: newDam.redLevel,
          latitude: newDam.latitude,
          longitude: newDam.longitude,
        });

        if (newDam.source) existingDam.source = newDam.source;
        if (newDam.district) existingDam.district = newDam.district;
        if (newDam.grossStorage) existingDam.grossStorage = newDam.grossStorage;

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

  if (dataChanged || options.alwaysWriteLive) {
    console.log(`Updating ${folderName} files...`);
    for (const [damName, damData] of Object.entries(existingData)) {
      const filename = `${folderName}/${safeFilename(damName)}.json`;
      await fs.writeFile(filename, JSON.stringify(damData, null, 4));
      console.log(`Details for dam ${damName} saved successfully in ${filename}.`);
    }

    const liveData = {
      lastUpdate: page.date,
      dams
    };

    if (page.link) {
      liveData.sourceUrl = page.link;
    }

    await fs.writeFile(liveFileName, JSON.stringify(liveData, null, 4));
    console.log(`Live dam data saved successfully in ${liveFileName}.`);
  } else {
    console.log(`No data changes detected. ${liveFileName} not updated.`);
  }

  return dataChanged;
};

// Extract KSEB dam details from the given URL. Kept intentionally close to the old scraper.
async function extractDamDetails(url) {
try {
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const dams = [];

  console.log('Extracting dam details from:', url);
  $('table tr').slice(1).each((index, row) => {
    const columns = $(row).find('td');
    if (columns.length >= 19) {
      console.log(`Processing row ${index + 1} with ${columns.length} columns`);

      const damName = $(columns[1]).text().trim();
      const damKey = damName.toLowerCase();
      console.log('Processing dam:', damKey, '-> Display name:', Names[damName]);

      const dam = {
        id: $(columns[0]).text().trim(),
        name: Names[damName],
        officialName: damName,
        MWL: $(columns[3]).text().trim(),
        FRL: $(columns[3]).text().trim(),
        liveStorageAtFRL: $(columns[9]).text().trim(),
        ruleLevel: $(columns[4]).text().trim(),
        blueLevel: $(columns[6]).text().trim(),
        orangeLevel: $(columns[7]).text().trim(),
        redLevel: $(columns[8]).text().trim(),
        latitude: damCoordinates[damKey] ? damCoordinates[damKey].latitude : null,
        longitude: damCoordinates[damKey] ? damCoordinates[damKey].longitude : null,
        data: [{
          date: $('h1.entry-title').text().trim(),
          waterLevel: $(columns[5]).text().trim(),
          liveStorage: $(columns[9]).text().trim(),
          storagePercentage: $(columns[10]).text().trim(),
          inflow: $(columns[11]).text().trim(),
          powerHouseDischarge: $(columns[13]).text().trim(),
          spillwayRelease: $(columns[14]).text().trim() === '–' ? "0" : $(columns[14]).text().trim(),
          totalOutflow: $(columns[16]).text().trim(),
          rainfall: $(columns[17]).text().trim(),
        }]
      };

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

const fetchSdmaPdfLink = async (sourceName) => {
  try {
    const response = await axios.get(sdmaDamLevelUrl);
    const $ = cheerio.load(response.data);
    const wantedSource = sourceName.toUpperCase();
    let result = null;

    $('a').each((index, element) => {
      if (result) return;

      const text = $(element).text().replace(/\s+/g, ' ').trim();
      if (!text.toUpperCase().includes(wantedSource)) return;

      const href = $(element).attr('href');
      if (!href || !href.toLowerCase().includes('.pdf')) return;

      const parentText = $(element).parent().text().replace(/\s+/g, ' ').trim();
      if (!/\d{1,2}[/. -]\d{1,2}[/. -]\d{4}/.test(parentText)) return;

      result = {
        date: normaliseDate(parentText),
        link: new URL(href, sdmaDamLevelUrl).href
      };
    });

    if (!result) {
      console.log(`No ${sourceName} PDF link found on SDMA dam water level page.`);
    } else {
      console.log(`Fetched ${sourceName} date:`, result.date, 'Link:', result.link);
    }

    return result;
  } catch (error) {
    console.error(`Error fetching ${sourceName} PDF link from SDMA:`, error);
    return null;
  }
};

const getFirstNumberIndex = (value) => {
  const match = value.match(/\b\d+(?:\.\d+)?\b/);
  return match ? match.index : -1;
};

const cleanPdfTextValue = (value) => (
  value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .trim()
);

const consumeTableTokens = (segment) => {
  const pieces = segment.trim().split(/\s+/);
  const values = [];
  let consumed = 0;

  for (const piece of pieces) {
    if (/^(?:N\/A|[-_]|[0-9]+(?:\.[0-9]+)?%?)$/i.test(piece)) {
      values.push(piece);
      consumed += 1;
    } else {
      break;
    }
  }

  return {
    values,
    remarks: cleanPdfTextValue(pieces.slice(consumed).join(' '))
  };
};

const splitIrrigationRows = (text) => {
  const relevantText = text.split('IRRIGATION RESERVOIRS STATISTICS')[0].split('ജലേസചന')[0];
  const rowStartRegex = /(?:^|\n)(\d{1,2})[ \t]+/g;
  const starts = [];
  let match;

  while ((match = rowStartRegex.exec(relevantText)) !== null) {
    starts.push({
      id: match[1],
      start: match.index + (match[0].startsWith('\n') ? 1 : 0)
    });
  }

  return starts.map((start, index) => {
    const nextStart = starts[index + 1] ? starts[index + 1].start : relevantText.length;
    return relevantText.slice(start.start, nextStart).trim();
  });
};

const parseIrrigationRow = (rowText, date) => {
  const idMatch = rowText.match(/^(\d{1,2})\s+([\s\S]*)$/);
  if (!idMatch) return null;

  const id = idMatch[1];
  const body = idMatch[2].trim();
  const lines = body.split('\n').map(line => line.trim()).filter(Boolean);
  const officialName = cleanPdfTextValue(lines[0] || '');
  const district = irrigationDistricts.find(name => body.includes(name)) || '';
  const numberIndex = getFirstNumberIndex(body);

  if (!officialName || numberIndex < 0) {
    console.log(`Skipping irrigation row ${id}; unable to identify name or values.`);
    return null;
  }

  const { values, remarks } = consumeTableTokens(body.slice(numberIndex));
  if (values.length < 2) {
    console.log(`Skipping irrigation row ${id}; expected table values, got:`, values);
    return null;
  }

  const hasAlertLevels = values.length >= 9;
  const frl = values[0] || '';
  const waterLevel = values[1] || '';
  const blueLevel = hasAlertLevels ? values[2] || '' : '';
  const orangeLevel = hasAlertLevels ? values[3] || '' : '';
  const redLevel = hasAlertLevels ? values[4] || '' : '';
  const grossStorage = hasAlertLevels ? values[5] || '' : values[2] || '';
  const liveStorage = hasAlertLevels ? values[6] || '' : values[3] || '';
  const storagePercentage = hasAlertLevels ? values[7] || '' : values[4] || '';
  const outflow = hasAlertLevels ? values[8] || '' : values[5] || '';
  const coordinates = irrigationDamCoordinates[officialName] || {};

  return {
    id,
    name: officialName,
    officialName,
    source: 'Irrigation',
    district,
    MWL: frl,
    FRL: frl,
    grossStorage,
    liveStorageAtFRL: grossStorage,
    ruleLevel: '',
    blueLevel,
    orangeLevel,
    redLevel,
    latitude: coordinates.latitude || null,
    longitude: coordinates.longitude || null,
    data: [{
      date,
      waterLevel,
      liveStorage,
      storagePercentage,
      inflow: '',
      powerHouseDischarge: '',
      spillwayRelease: '',
      totalOutflow: outflow,
      outflow,
      rainfall: '',
      remarks
    }]
  };
};

const extractIrrigationDamDetailsFromText = (text, date) => {
  const dams = splitIrrigationRows(text)
    .map(rowText => parseIrrigationRow(rowText, date))
    .filter(Boolean);

  console.log(`Total irrigation dams extracted: ${dams.length}`);
  return { dams };
};

async function extractIrrigationDamDetails(pdfUrl, date) {
  try {
    console.log('Extracting irrigation dam details from:', pdfUrl);
    const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
    const parser = new PDFParse({ data: Buffer.from(response.data) });
    const result = await parser.getText();
    await parser.destroy();

    return extractIrrigationDamDetailsFromText(result.text, date);
  } catch (error) {
    console.error(`Error fetching irrigation details from ${pdfUrl}:`, error);
    return { dams: [] };
  }
}

// Fetch KSEB dam details and update the data files.
async function fetchKsebDamDetails() {
try {
  const page = await fetchMostRecentUpdate();
  if (!page) {
    console.log('No recent KSEB page found.');
    return;
  }

  console.log(`Processing KSEB page: ${page.date}`);
  const { dams } = await extractDamDetails(page.link);

  if (dams.length === 0) {
    console.log('No KSEB dam data extracted. Check if the website structure has changed.');
    return;
  }

  await updateDamData(ksebFolderName, 'live.json', page, dams);
} catch (error) {
  console.error('Error:', error);
}
}

async function fetchIrrigationDamDetails() {
try {
  const page = await fetchSdmaPdfLink('IRRIGATION');
  if (!page) {
    console.log('No recent irrigation PDF found.');
    return;
  }

  console.log(`Processing irrigation PDF: ${page.date}`);
  const { dams } = await extractIrrigationDamDetails(page.link, page.date);

  if (dams.length === 0) {
    console.log('No irrigation dam data extracted. Check if the PDF structure has changed.');
    return;
  }

  await updateDamData(irrigationFolderName, 'irrigation_live.json', page, dams);
} catch (error) {
  console.error('Irrigation error:', error);
}
}

async function fetchDamDetails() {
  await fetchKsebDamDetails();
  await fetchIrrigationDamDetails();
}

if (require.main === module) {
  fetchDamDetails();
}

module.exports = {
  extractDamDetails,
  extractIrrigationDamDetails,
  extractIrrigationDamDetailsFromText,
  fetchDamDetails,
  fetchIrrigationDamDetails,
  fetchKsebDamDetails,
  fetchMostRecentUpdate,
  fetchSdmaPdfLink
};
