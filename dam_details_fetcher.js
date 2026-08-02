const axios = require('axios');
const cheerio = require('cheerio');
const { PDFParse } = require('pdf-parse');
const fs = require('fs').promises;
const fsSync = require('fs');

const ksebBaseUrl = 'https://dams.kseb.in/?page_id=45';
const sdmaDamLevelUrl = 'https://sdma.kerala.gov.in/dam-water-level/';
const ksebFolderName = 'historic_data';
const irrigationFolderName = 'irrigation_historic_data';
const ksebLookbackPosts = 10;
const ksebMissingDatesPerRun = 5;

let damConstants = null;
try {
  damConstants = JSON.parse(fsSync.readFileSync('dam_constants.json', 'utf-8'));
  console.log('Loaded dam constants from dam_constants.json');
} catch {
  console.log('dam_constants.json not found, static dam fields will be taken from live sources.');
}

const applyDamConstants = (dams) => {
  if (!damConstants) return;
  for (const dam of dams) {
    const c = damConstants[dam.name];
    if (!c) continue;
    dam.MWL = c.MWL;
    dam.FRL = c.FRL;
    dam.liveStorageAtFRL = c.liveStorageAtFRL;
    dam.ruleLevel = c.ruleLevel;
    dam.blueLevel = c.blueLevel;
    dam.orangeLevel = c.orangeLevel;
    dam.redLevel = c.redLevel;
    if (c.grossStorage) dam.grossStorage = c.grossStorage;
    if (c.latitude != null) dam.latitude = c.latitude;
    if (c.longitude != null) dam.longitude = c.longitude;
  }
};

// Fetch recent dated updates so delayed KSEB uploads can fill history gaps.
const fetchRecentUpdates = async (limit = ksebLookbackPosts) => {
try {
  const response = await axios.get(ksebBaseUrl);
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
        });

        if (newDam.latitude != null) existingDam.latitude = newDam.latitude;
        if (newDam.longitude != null) existingDam.longitude = newDam.longitude;
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
      sortDamDataNewestFirst(damData.data);
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
  const pages = await fetchRecentUpdates();
  if (pages.length === 0) {
    console.log('No recent KSEB pages found.');
    return;
  }

  await ensureFolder(ksebFolderName);
  const existingData = await loadExistingDamData(ksebFolderName);
  const existingDates = new Set(
    Object.values(existingData).flatMap(dam => dam.data.map(entry => entry.date))
  );
  const pagesToProcess = pages
    .filter(page => !existingDates.has(page.date))
    .slice(0, ksebMissingDatesPerRun)
    .reverse();

  console.log('Missing KSEB dates selected:', pagesToProcess.map(page => page.date).join(', ') || 'none');

  for (const page of pagesToProcess) {
    console.log(`Processing KSEB page: ${page.date}`);
    const { dams } = await extractDamDetails(page.link);

    if (dams.length === 0) {
      console.log(`No KSEB dam data extracted for ${page.date}.`);
      continue;
    }

    applyDamConstants(dams);
    await updateDamData(ksebFolderName, 'live.json', page, dams);
    existingDates.add(page.date);
  }

  // A later backfill batch must not replace live.json with an older page.
  const latestPage = pages[0];
  if (!pagesToProcess.some(page => page.date === latestPage.date)) {
    console.log(`Refreshing live KSEB data from latest page: ${latestPage.date}`);
    const { dams } = await extractDamDetails(latestPage.link);
    if (dams.length > 0) {
      applyDamConstants(dams);
      await updateDamData(ksebFolderName, 'live.json', latestPage, dams, { alwaysWriteLive: true });
    }
  }
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

  applyDamConstants(dams);
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
  fetchRecentUpdates,
  fetchMostRecentUpdate,
  fetchSdmaPdfLink
};
