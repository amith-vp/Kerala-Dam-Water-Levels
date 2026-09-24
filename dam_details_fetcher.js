const axios = require('axios');
const cheerio = require('cheerio');
const { PDFParse } = require('pdf-parse');
const fs = require('fs').promises;

const ksebBaseUrl = 'https://dams.kseb.in/?page_id=45';
const sdmaDamLevelUrl = 'https://sdma.kerala.gov.in/dam-water-level/';
const ksebFolderName = 'historic_data';
const irrigationFolderName = 'irrigation_historic_data';
const ksebLookbackPosts = 10;
const ksebMissingDatesPerRun = 5;
const ksebEnrichmentFields = [
  'inflow',
  'powerHouseDischarge',
  'totalOutflow',
  'rainfall'
];

// Fetch recent dated updates so delayed KSEB uploads can fill history gaps.
const fetchRecentUpdates = async (limit = ksebLookbackPosts) => {
try {
  const response = await axios.get(ksebBaseUrl, { timeout: 10000, maxContentLength: 5 * 1024 * 1024, maxBodyLength: 5 * 1024 * 1024 });
  const html = response.data;
  const $ = cheerio.load(html);
  const pages = [];
  const seenLinks = new Set();

  $('.elementor-post').each((index, element) => {
    if (pages.length >= limit) return false;

    const pageLink = $(element).find('.elementor-post__title a').first();
    const link = pageLink.attr('href');
    const rawDate = pageLink.text().trim();
    const date = normaliseDate(rawDate);

    if (!link || !date || seenLinks.has(link)) return;

    seenLinks.add(link);
    pages.push({ date, link });
    return undefined;
  });

  console.log('Fetched KSEB updates:', pages.map(page => `${page.date} (${page.link})`).join(', '));
  return pages;
} catch (error) {
  console.error('Error fetching recent KSEB pages:', error);
  return [];
}
};

const fetchMostRecentUpdate = async () => {
  const pages = await fetchRecentUpdates(1);
  return pages[0] || null;
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

// Keep the existing public IDs/names while reading SDMA's different row order.
const sdmaKsebDamDefinitions = [
  { pdfName: 'Kakki (Anathode)', id: '3', name: 'Anathode', officialName: 'KAKKI – ANATHODE', district: 'Pathanamthitta', coordinateKey: 'kakki – anathode' },
  { pdfName: 'Pamba', id: '10', name: 'Pamba', officialName: 'PAMBA', district: 'Pathanamthitta', coordinateKey: 'pamba' },
  { pdfName: 'Moozhiyar', id: '16', name: 'Moozhiyar', officialName: 'MOOZHIYAR', district: 'Pathanamthitta', coordinateKey: 'moozhiyar' },
  { pdfName: 'Idukki', id: '1', name: 'Idukki', officialName: 'IDUKKI', district: 'Idukki', coordinateKey: 'idukki', levelsInFeet: true },
  { pdfName: 'Madupetty', id: '6', name: 'Mattupetty', officialName: 'MADUPETTY', district: 'Idukki', coordinateKey: 'madupetty' },
  { pdfName: 'Anayirankal', id: '7', name: 'Anayirankal', officialName: 'ANAYIRANKAL', district: 'Idukki', coordinateKey: 'anayirankal' },
  { pdfName: 'Ponmudi', id: '8', name: 'Ponmudi', officialName: 'PONMUDI', district: 'Idukki', coordinateKey: 'ponmudi' },
  { pdfName: 'Kundala', id: '12', name: 'Kundala', officialName: 'KUNDALA', district: 'Idukki', coordinateKey: 'kundala' },
  { pdfName: 'Kallarkutty', id: '13', name: 'Kallarkutty', officialName: 'KALLARKUTTY', district: 'Idukki', coordinateKey: 'kallarkutty' },
  { pdfName: 'Erattayar', id: '14', name: 'Erattayar', officialName: 'ERATTAYAR', district: 'Idukki', coordinateKey: 'erattayar' },
  { pdfName: 'Lower Periyar', id: '15', name: 'Pambla', officialName: 'LOWER PERIYAR', district: 'Idukki', coordinateKey: 'lower periyar' },
  { pdfName: 'Kallar', id: '17', name: 'Kallar', officialName: 'KALLAR', district: 'Idukki', coordinateKey: 'kallar' },
  { pdfName: 'Idamalayar', id: '2', name: 'Idamalayar', officialName: 'IDAMALAYAR', district: 'Ernakulam', coordinateKey: 'idamalayar' },
  { pdfName: 'Sholayar', id: '5', name: 'Sholayar', officialName: 'SHOLAYAR', district: 'Thrissur', coordinateKey: 'sholayar', levelsInFeet: true },
  { pdfName: 'Poringalkuthu', id: '11', name: 'Poringalkuthu', officialName: 'PORINGALKUTHU', district: 'Thrissur', coordinateKey: 'poringalkuthu' },
  { pdfName: 'Kuttiyadi', id: '9', name: 'Kakkayam', officialName: 'KUTTIYADI (KAKKAYAM)', district: 'Kozhikode', coordinateKey: 'kuttiyadi (kakkayam)' },
  { pdfName: 'Banasurasagar', id: '4', name: 'Banasura Sagar', officialName: 'BANASURASAGAR (K A S)', district: 'Wayanad', coordinateKey: 'banasurasagar (k a s)' }
];

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
  'Chulliyar': { latitude: 10.59329, longitude: 76.76764 },
  'Kallada': { latitude: 8.9500, longitude: 77.0722 },
  'Kanjirappuzha': { latitude: 10.9667, longitude: 76.5333 },
  'Karapuzha': { latitude: 11.6167, longitude: 76.1750 },
  'Kuttiyadi': { latitude: 11.6125, longitude: 75.8242 },
  'Malampuzha': { latitude: 10.83057, longitude: 76.68381 },
  'Malankara': { latitude: 9.8417, longitude: 76.6250 },
  'Mangalam': { latitude: 10.5167, longitude: 76.5333 },
  'Maniyar (Barrage)': { latitude: 9.3333, longitude: 76.8833 },
  'Meenkara': { latitude: 10.6333, longitude: 76.8000 },
  'Moolathara (Regulator)': { latitude: 10.6750, longitude: 76.7667 },
  'Neyyar': { latitude: 8.5333, longitude: 77.1500 },
  'Pazhassi (Barrage)': { latitude: 11.9942, longitude: 75.6275 },
  'Peechi': { latitude: 10.53002, longitude: 76.36998 },
  'Pothundy': { latitude: 10.54490, longitude: 76.62535 },
  'Siruvani (Inter state waters)': { latitude: 10.9767, longitude: 76.6422 },
  'Vazhani': { latitude: 10.63614, longitude: 76.30715 },
  'Walayar': { latitude: 10.83823, longitude: 76.85325 },
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

const parseDamDate = (value) => {
  const text = String(value || '').trim();
  const dayFirstMatch = text.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/);
  if (dayFirstMatch) {
    return Date.UTC(
      Number(dayFirstMatch[3]),
      Number(dayFirstMatch[2]) - 1,
      Number(dayFirstMatch[1])
    );
  }

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return Date.UTC(
      Number(isoMatch[1]),
      Number(isoMatch[2]) - 1,
      Number(isoMatch[3])
    );
  }

  return null;
};

const sortDamDataNewestFirst = (data) => {
  data.sort((left, right) => {
    const leftTime = parseDamDate(left.date);
    const rightTime = parseDamDate(right.date);

    if (leftTime === null && rightTime === null) return 0;
    if (leftTime === null) return 1;
    if (rightTime === null) return -1;

    return rightTime - leftTime;
  });
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

const hasDamValue = (value) => value !== undefined && value !== null && String(value).trim() !== '';

const mergeDailyData = (existingEntry, newEntry, preserveFields = []) => {
  const mergedEntry = { ...existingEntry, ...newEntry };

  for (const field of preserveFields) {
    if (hasDamValue(existingEntry[field]) && !hasDamValue(newEntry[field])) {
      mergedEntry[field] = existingEntry[field];
    }
  }

  return mergedEntry;
};

const damMetadataFields = [
  'id',
  'officialName',
  'source',
  'district',
  'MWL',
  'FRL',
  'grossStorage',
  'liveStorageAtFRL',
  'ruleLevel',
  'blueLevel',
  'orangeLevel',
  'redLevel',
  'latitude',
  'longitude'
];

const updateDamMetadata = (existingDam, newDam) => {
  let changed = false;

  for (const field of damMetadataFields) {
    if (!Object.prototype.hasOwnProperty.call(newDam, field) || newDam[field] === undefined) continue;
    if (existingDam[field] === newDam[field]) continue;

    existingDam[field] = newDam[field];
    changed = true;
  }

  return changed;
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
      const existingEntryIndex = existingDam.data.findIndex(d => d.date === newDate);
      const dateExists = existingEntryIndex >= 0;
      console.log(`Checking if date ${newDate} exists:`, dateExists);

      if (!dateExists) {
        console.log(`Adding new data for ${newDam.name} with date ${newDate}`);
        existingDam.data.unshift(newDam.data[0]);
        updateDamMetadata(existingDam, newDam);
        dataChanged = true;
      } else if (options.updateExistingData) {
        const mergedEntry = mergeDailyData(
          existingDam.data[existingEntryIndex],
          newDam.data[0],
          options.preserveDataFields
        );

        if (JSON.stringify(existingDam.data[existingEntryIndex]) !== JSON.stringify(mergedEntry)) {
          existingDam.data[existingEntryIndex] = mergedEntry;
          dataChanged = true;
        }

        if (options.updateMetadataOnExisting && updateDamMetadata(existingDam, newDam)) {
          dataChanged = true;
        }
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
      sortDamDataNewestFirst(damData.data);
      const filename = `${folderName}/${safeFilename(damName)}.json`;
      await fs.writeFile(filename, JSON.stringify(damData, null, 4));
      console.log(`Details for dam ${damName} saved successfully in ${filename}.`);
    }

    const liveDams = options.liveFromStoredData
      ? dams.map(newDam => {
        const storedDam = existingData[newDam.name];
        const storedEntry = storedDam.data.find(entry => entry.date === page.date);
        return { ...storedDam, data: storedEntry ? [storedEntry] : newDam.data };
      })
      : dams;

    if (options.includeStoredDamsForLive) {
      const liveDamNames = new Set(liveDams.map(dam => dam.name));
      for (const storedDam of Object.values(existingData)) {
        if (liveDamNames.has(storedDam.name)) continue;
        const storedEntry = storedDam.data.find(entry => entry.date === page.date);
        if (storedEntry) liveDams.push({ ...storedDam, data: [storedEntry] });
      }
    }
    const liveData = {
      lastUpdate: page.date,
      dams: liveDams
    };

    if (page.link) {
      liveData.sourceUrl = page.link;
    }

    if (options.preserveLiveFields) {
      try {
        const previousLiveData = JSON.parse(await fs.readFile(liveFileName, 'utf8'));
        if (previousLiveData.lastUpdate === page.date) {
          for (const field of options.preserveLiveFields) {
            if (previousLiveData[field] !== undefined) liveData[field] = previousLiveData[field];
          }
        }
      } catch (error) {
        console.log(`No previous ${liveFileName} metadata to preserve.`);
      }
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
      if (wantedSource === 'KSEB' && !href.toLowerCase().includes('kseb-site')) return;

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

const splitSdmaKsebRows = (text) => {
  const rowStartRegex = /(?:^|\n)(\d{1,2})[ \t]+/g;
  const starts = [];
  let match;

  while ((match = rowStartRegex.exec(text)) !== null) {
    starts.push({
      id: match[1],
      start: match.index + (match[0].startsWith('\n') ? 1 : 0)
    });
  }

  return starts.map((start, index) => {
    const nextStart = starts[index + 1] ? starts[index + 1].start : text.length;
    const rowText = text.slice(start.start, nextStart).trim();
    const repeatedHeader = rowText.search(/\n[^\n]*\(KSEB\)[^\n]*\n\d{1,2}\/\d{1,2}\/\d{4}/i);
    return repeatedHeader >= 0 ? rowText.slice(0, repeatedHeader).trim() : rowText;
  });
};

const findSdmaKsebDamDefinition = (body) => {
  const nameSectionEnd = getFirstNumberIndex(body);
  const nameSection = (nameSectionEnd >= 0 ? body.slice(0, nameSectionEnd) : body).toLowerCase();

  return sdmaKsebDamDefinitions
    .map(definition => ({
      definition,
      index: nameSection.indexOf(definition.pdfName.toLowerCase())
    }))
    .filter(candidate => candidate.index >= 0)
    .sort((left, right) => left.index - right.index)[0]?.definition || null;
};

const normaliseKsebLevel = (value, levelsInFeet) => {
  if (!value) return '';
  return levelsInFeet ? convertFeetToMeters(`${value} ft`) : value;
};

const parseSdmaKsebRow = (rowText, date) => {
  const idMatch = rowText.match(/^\d{1,2}\s+([\s\S]*)$/);
  if (!idMatch) return null;

  const body = cleanPdfTextValue(idMatch[1]);
  const definition = findSdmaKsebDamDefinition(body);
  const numberIndex = getFirstNumberIndex(body);
  if (!definition || numberIndex < 0) return null;

  const numericSegment = body.slice(numberIndex);
  const percentageMatch = numericSegment.match(/(\d+(?:\.\d+)?)%/);
  if (!percentageMatch) {
    console.log(`Skipping SDMA KSEB row for ${definition.name}; storage percentage was not found.`);
    return null;
  }

  const values = Array.from(
    numericSegment.slice(0, percentageMatch.index).matchAll(/\d+(?:\.\d+)?/g),
    value => value[0]
  );
  if (values.length < 4) {
    console.log(`Skipping SDMA KSEB row for ${definition.name}; expected level and storage values.`);
    return null;
  }

  const frl = values[0];
  const waterLevel = values[1];
  const alertValues = values.slice(2, -2);
  const liveStorageAtFRL = values[values.length - 2];
  const liveStorage = values[values.length - 1];
  const levels = alertValues.map(value => normaliseKsebLevel(value, definition.levelsInFeet));
  let ruleLevel = '';
  let blueLevel = '';
  let orangeLevel = '';
  let redLevel = '';

  if (levels.length >= 4) {
    [ruleLevel, blueLevel, orangeLevel, redLevel] = levels.slice(-4);
  } else if (levels.length === 3) {
    [blueLevel, orangeLevel, redLevel] = levels;
  } else if (levels.length === 2) {
    [orangeLevel, redLevel] = levels;
  } else if (levels.length === 1) {
    [redLevel] = levels;
  }

  const afterPercentage = numericSegment
    .slice(percentageMatch.index + percentageMatch[0].length)
    .trim();
  const spillwayMatch = afterPercentage.match(/^(N\/A|[-_–—]|\d+(?:\.\d+)?)/i);
  const rawSpillwayRelease = spillwayMatch ? spillwayMatch[1] : '';
  const spillwayRelease = /^[-_–—]$/.test(rawSpillwayRelease) ? '0' : rawSpillwayRelease;
  const remarks = spillwayMatch
    ? cleanPdfTextValue(afterPercentage.slice(spillwayMatch[0].length))
    : cleanPdfTextValue(afterPercentage);
  const coordinates = damCoordinates[definition.coordinateKey] || {};

  return {
    id: definition.id,
    name: definition.name,
    officialName: definition.officialName,
    source: 'KSEB',
    district: definition.district,
    MWL: normaliseKsebLevel(frl, definition.levelsInFeet),
    FRL: normaliseKsebLevel(frl, definition.levelsInFeet),
    liveStorageAtFRL,
    ruleLevel,
    blueLevel,
    orangeLevel,
    redLevel,
    latitude: coordinates.latitude ?? null,
    longitude: coordinates.longitude ?? null,
    data: [{
      date,
      waterLevel: normaliseKsebLevel(waterLevel, definition.levelsInFeet),
      liveStorage,
      storagePercentage: percentageMatch[1],
      inflow: '',
      powerHouseDischarge: '',
      spillwayRelease,
      totalOutflow: '',
      rainfall: '',
      remarks
    }]
  };
};

const extractSdmaKsebDamDetailsFromText = (text, date) => {
  const rows = splitSdmaKsebRows(text);
  const dams = rows
    .map(rowText => parseSdmaKsebRow(rowText, date))
    .filter(Boolean);

  console.log(`Total SDMA KSEB dams extracted: ${dams.length}`);
  return { dams, rowCount: rows.length };
};

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

async function extractSdmaKsebDamDetails(pdfUrl, date) {
  try {
    console.log('Extracting SDMA KSEB dam details from:', pdfUrl);
    const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
    const parser = new PDFParse({ data: Buffer.from(response.data) });
    const result = await parser.getText();
    await parser.destroy();

    return extractSdmaKsebDamDetailsFromText(result.text, date);
  } catch (error) {
    console.error(`Error fetching SDMA KSEB details from ${pdfUrl}:`, error);
    return { dams: [], rowCount: 0 };
  }
}

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

const mergeKsebEnrichmentFields = (targetEntry, ksebEntry) => {
  let changed = false;

  for (const field of ksebEnrichmentFields) {
    if (!hasDamValue(ksebEntry[field]) || targetEntry[field] === ksebEntry[field]) continue;
    targetEntry[field] = ksebEntry[field];
    changed = true;
  }

  return changed;
};

const ksebDateNeedsEnrichment = (existingData, date) => {
  const entriesForDate = Object.values(existingData)
    .map(dam => dam.data.find(entry => entry.date === date))
    .filter(Boolean);

  if (entriesForDate.length === 0) return false;

  const missingEnrichment = entriesForDate.some(entry => (
    ksebEnrichmentFields.every(field => !hasDamValue(entry[field]))
  ));
  const chenkulamEntry = existingData.Chenkulam?.data.find(entry => entry.date === date);
  return missingEnrichment || !chenkulamEntry;
};

const enrichKsebDamData = async (page, dams) => {
  await ensureFolder(ksebFolderName);
  const existingData = await loadExistingDamData(ksebFolderName);
  const baselineExists = Object.values(existingData).some(dam => (
    dam.data.some(entry => entry.date === page.date)
  ));

  if (!baselineExists) {
    console.log(`Skipping KSEB enrichment for ${page.date}; no SDMA baseline exists.`);
    return false;
  }

  let historyChanged = false;

  for (const ksebDam of dams) {
    const ksebEntry = { ...ksebDam.data[0], date: page.date };
    const existingDam = existingData[ksebDam.name];

    if (!existingDam) {
      existingData[ksebDam.name] = { ...ksebDam, data: [ksebEntry] };
      historyChanged = true;
      continue;
    }

    const existingEntry = existingDam.data.find(entry => entry.date === page.date);
    if (!existingEntry) {
      existingDam.data.unshift(ksebEntry);
      historyChanged = true;
      continue;
    }

    if (mergeKsebEnrichmentFields(existingEntry, ksebEntry)) {
      historyChanged = true;
    }
  }

  if (historyChanged) {
    for (const [damName, damData] of Object.entries(existingData)) {
      sortDamDataNewestFirst(damData.data);
      const filename = `${ksebFolderName}/${safeFilename(damName)}.json`;
      await fs.writeFile(filename, JSON.stringify(damData, null, 4));
    }
  }

  let liveChanged = false;
  let liveData = null;
  try {
    liveData = JSON.parse(await fs.readFile('live.json', 'utf8'));
  } catch (error) {
    console.error('Unable to read live.json for KSEB enrichment:', error);
  }

  if (liveData && liveData.lastUpdate === page.date && Array.isArray(liveData.dams)) {
    for (const ksebDam of dams) {
      const ksebEntry = { ...ksebDam.data[0], date: page.date };
      const liveDam = liveData.dams.find(dam => dam.name === ksebDam.name);

      if (!liveDam) {
        liveData.dams.push({ ...ksebDam, data: [ksebEntry] });
        liveChanged = true;
        continue;
      }

      if (!liveDam.data[0]) liveDam.data[0] = { date: page.date };
      if (mergeKsebEnrichmentFields(liveDam.data[0], ksebEntry)) {
        liveChanged = true;
      }
    }

    if (page.link && liveData.enrichmentSourceUrl !== page.link) {
      liveData.enrichmentSourceUrl = page.link;
      liveChanged = true;
    }

    if (liveChanged) {
      await fs.writeFile('live.json', JSON.stringify(liveData, null, 4));
    }
  }

  return historyChanged || liveChanged;
};

async function fetchSdmaKsebDamDetails() {
try {
  const page = await fetchSdmaPdfLink('KSEB');
  if (!page) {
    console.log('No recent SDMA KSEB PDF found.');
    return;
  }

  console.log(`Processing SDMA KSEB PDF: ${page.date}`);
  const { dams, rowCount } = await extractSdmaKsebDamDetails(page.link, page.date);
  if (rowCount !== sdmaKsebDamDefinitions.length || dams.length !== rowCount) {
    console.log(`Expected ${sdmaKsebDamDefinitions.length} SDMA KSEB rows, found ${rowCount} and parsed ${dams.length}. No files were updated.`);
    return;
  }

  await updateDamData(ksebFolderName, 'live.json', page, dams, {
    alwaysWriteLive: true,
    includeStoredDamsForLive: true,
    liveFromStoredData: true,
    preserveLiveFields: ['enrichmentSourceUrl'],
    preserveDataFields: ksebEnrichmentFields,
    updateExistingData: true,
    updateMetadataOnExisting: true
  });
} catch (error) {
  console.error('SDMA KSEB error:', error);
}
}

// Run from the India VPS after SDMA; only append fields missing from SDMA.
async function fetchKsebDamDetails() {
try {
  const pages = await fetchRecentUpdates();
  if (pages.length === 0) {
    console.log('No recent KSEB pages found.');
    return;
  }

  await ensureFolder(ksebFolderName);
  const existingData = await loadExistingDamData(ksebFolderName);
  let currentLiveData = null;
  try {
    currentLiveData = JSON.parse(await fs.readFile('live.json', 'utf8'));
  } catch (error) {
    console.log('No live.json metadata found while selecting KSEB enrichment dates.');
  }
  const pagesToProcess = pages
    .filter(page => (
      ksebDateNeedsEnrichment(existingData, page.date)
      || (
        currentLiveData?.lastUpdate === page.date
        && !currentLiveData.enrichmentSourceUrl
      )
    ))
    .slice(0, ksebMissingDatesPerRun)
    .reverse();

  console.log('KSEB dates selected for enrichment:', pagesToProcess.map(page => page.date).join(', ') || 'none');

  for (const page of pagesToProcess) {
    console.log(`Enriching from KSEB page: ${page.date}`);
    const { dams } = await extractDamDetails(page.link);

    if (dams.length === 0) {
      console.log(`No KSEB dam data extracted for ${page.date}.`);
      continue;
    }

    await enrichKsebDamData(page, dams);
  }
} catch (error) {
  console.error('KSEB enrichment error:', error);
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

  await updateDamData(irrigationFolderName, 'irrigation_live.json', page, dams, {
    alwaysWriteLive: true,
    liveFromStoredData: true,
    updateExistingData: true,
    updateMetadataOnExisting: true
  });
} catch (error) {
  console.error('Irrigation error:', error);
}
}

async function fetchDamDetails() {
  await fetchSdmaKsebDamDetails();
  await fetchIrrigationDamDetails();
}

if (require.main === module) {
  fetchDamDetails();
}

module.exports = {
  extractDamDetails,
  extractIrrigationDamDetails,
  extractIrrigationDamDetailsFromText,
  extractSdmaKsebDamDetails,
  extractSdmaKsebDamDetailsFromText,
  fetchDamDetails,
  fetchIrrigationDamDetails,
  fetchKsebDamDetails,
  fetchSdmaKsebDamDetails,
  fetchRecentUpdates,
  fetchMostRecentUpdate,
  fetchSdmaPdfLink,
  mergeKsebEnrichmentFields
};
