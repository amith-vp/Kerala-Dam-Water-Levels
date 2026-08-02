const axios = require('axios');
const { PDFParse } = require('pdf-parse');
const fs = require('fs').promises;
const {
  fetchSdmaPdfLink,
  fetchMostRecentUpdate,
  extractDamDetails,
  extractIrrigationDamDetails,
} = require('./dam_details_fetcher');

const ksebPdfNameMap = {
  'Kakki (Anathode)': 'Anathode',
  'Pamba': 'Pamba',
  'Moozhiyar': 'Moozhiyar',
  'Idukki': 'Idukki',
  'Madupetty': 'Mattupetty',
  'Anayirankal': 'Anayirankal',
  'Ponmudi': 'Ponmudi',
  'Kundala': 'Kundala',
  'Kallarkutty': 'Kallarkutty',
  'Erattayar': 'Erattayar',
  'Lower Periyar': 'Pambla',
  'Kallar': 'Kallar',
  'Idamalayar': 'Idamalayar',
  'Sholayar': 'Sholayar',
  'Poringalkuthu': 'Poringalkuthu',
  'Kuttiyadi': 'Kakkayam',
  'Banasurasagar': 'Banasura Sagar',
};

async function parseKsebPdfCapacities(pdfUrl) {
  const response = await axios.get(pdfUrl, { responseType: 'arraybuffer' });
  const parser = new PDFParse({ data: Buffer.from(response.data) });
  const result = await parser.getText();
  await parser.destroy();

  const capacities = {};
  const lines = result.text.split('\n');
  const pdfNames = Object.keys(ksebPdfNameMap);

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim();
    const pdfName = pdfNames.find(name => {
      if (name === 'Kakki (Anathode)') return trimmed === name;
      return trimmed === `(${name})`;
    });
    if (!pdfName) continue;

    const after = lines.slice(i).join(' ');
    const match = after.match(/(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*%)/);
    if (match) {
      capacities[ksebPdfNameMap[pdfName]] = match[1];
    }
  }

  return capacities;
}

async function main() {
  console.log('=== Fetching KSEB dam constants ===\n');

  const ksebPage = await fetchMostRecentUpdate();
  if (!ksebPage) {
    console.error('Could not fetch recent KSEB page.');
    process.exit(1);
  }
  console.log('Latest KSEB page:', ksebPage.date, ksebPage.link);

  const { dams: ksebDams } = await extractDamDetails(ksebPage.link);
  if (ksebDams.length === 0) {
    console.error('No KSEB dams extracted.');
    process.exit(1);
  }

  const ksebPdf = await fetchSdmaPdfLink('KSEB');
  let pdfCapacities = null;
  if (ksebPdf) {
    console.log('KSEB PDF:', ksebPdf.date, ksebPdf.link);
    pdfCapacities = await parseKsebPdfCapacities(ksebPdf.link);
    console.log('PDF capacities parsed:', Object.keys(pdfCapacities || {}).length, 'dams');
  } else {
    console.log('WARNING: No KSEB PDF found, using KSEB website capacities as-is.');
  }

  console.log('\n=== Fetching Irrigation dam constants ===\n');

  const irrPdf = await fetchSdmaPdfLink('IRRIGATION');
  if (!irrPdf) {
    console.error('Could not fetch irrigation PDF.');
    process.exit(1);
  }
  console.log('Irrigation PDF:', irrPdf.date, irrPdf.link);

  const { dams: irrDams } = await extractIrrigationDamDetails(irrPdf.link, irrPdf.date);
  if (irrDams.length === 0) {
    console.error('No irrigation dams extracted.');
    process.exit(1);
  }

  const constants = {};

  for (const dam of ksebDams) {
    constants[dam.name] = {
      source: 'KSEB',
      officialName: dam.officialName,
      MWL: dam.MWL,
      FRL: dam.FRL,
      liveStorageAtFRL: pdfCapacities && pdfCapacities[dam.name]
        ? pdfCapacities[dam.name]
        : dam.liveStorageAtFRL,
      ruleLevel: dam.ruleLevel,
      blueLevel: dam.blueLevel,
      orangeLevel: dam.orangeLevel,
      redLevel: dam.redLevel,
      latitude: dam.latitude,
      longitude: dam.longitude,
    };
    if (pdfCapacities && pdfCapacities[dam.name]) {
      console.log(`  ${dam.name}: liveStorageAtFRL ${dam.liveStorageAtFRL} -> ${pdfCapacities[dam.name]} (from PDF)`);
    }
  }

  for (const dam of irrDams) {
    constants[dam.name] = {
      source: 'Irrigation',
      officialName: dam.officialName || dam.name,
      district: dam.district,
      MWL: dam.MWL,
      FRL: dam.FRL,
      grossStorage: dam.grossStorage,
      liveStorageAtFRL: dam.liveStorageAtFRL,
      ruleLevel: dam.ruleLevel,
      blueLevel: dam.blueLevel,
      orangeLevel: dam.orangeLevel,
      redLevel: dam.redLevel,
      latitude: dam.latitude,
      longitude: dam.longitude,
    };
  }

  const totalDams = Object.keys(constants).length;
  const withPdfOverride = Object.values(constants).filter(d => d.source === 'KSEB').length;

  await fs.writeFile('dam_constants.json', JSON.stringify(constants, null, 2));
  console.log(`\nSaved dam_constants.json with ${totalDams} dams (${withPdfOverride} KSEB, ${totalDams - withPdfOverride} irrigation).`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
