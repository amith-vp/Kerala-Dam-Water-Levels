const assert = require('assert');
const {
  extractSdmaKsebDamDetailsFromText,
  mergeKsebEnrichmentFields
} = require('../dam_details_fetcher');

const samplePdfText = `
1 Kakki (Anathode) (Pathanamthitta) 981.46 m 971.21 m 976.20 m 974.20 975.20 975.70 446.51 294.480 65.95% - All gates closed
2 Moozhiyar (Pathanamthitta) 192.63 m 186.45 m 190 1.16 0.410 35.34% - All gates closed
3 Idukki (Idukki) 2403.00 ft 2363.12 ft 2390.09 ft 2382.09 2388.09 2389.09 1459.49 836.460 57.31% -
`;

const { dams, rowCount } = extractSdmaKsebDamDetailsFromText(samplePdfText, '24.08.2026');
assert.strictEqual(rowCount, 3);
assert.strictEqual(dams.length, 3);

const anathode = dams.find(dam => dam.name === 'Anathode');
assert.deepStrictEqual(
  [anathode.ruleLevel, anathode.blueLevel, anathode.orangeLevel, anathode.redLevel],
  ['976.20', '974.20', '975.20', '975.70']
);
assert.strictEqual(anathode.liveStorageAtFRL, '446.51');
assert.strictEqual(anathode.data[0].spillwayRelease, '0');

const moozhiyar = dams.find(dam => dam.name === 'Moozhiyar');
assert.deepStrictEqual(
  [moozhiyar.ruleLevel, moozhiyar.blueLevel, moozhiyar.orangeLevel, moozhiyar.redLevel],
  ['', '', '', '190']
);

const idukki = dams.find(dam => dam.name === 'Idukki');
assert.strictEqual(idukki.FRL, '732.43');
assert.strictEqual(idukki.data[0].waterLevel, '720.28');

const sdmaEntry = {
  date: '24.08.2026',
  waterLevel: '971.21',
  liveStorage: '294.480',
  spillwayRelease: '0',
  inflow: '',
  powerHouseDischarge: '',
  totalOutflow: '',
  rainfall: ''
};
const ksebEntry = {
  date: '24.08.2026',
  waterLevel: '999.99',
  liveStorage: '999.99',
  spillwayRelease: '9',
  inflow: '3.73',
  powerHouseDischarge: '2.61',
  totalOutflow: '2.61',
  rainfall: '6.00'
};

assert.strictEqual(mergeKsebEnrichmentFields(sdmaEntry, ksebEntry), true);
assert.strictEqual(sdmaEntry.waterLevel, '971.21');
assert.strictEqual(sdmaEntry.liveStorage, '294.480');
assert.strictEqual(sdmaEntry.spillwayRelease, '0');
assert.strictEqual(sdmaEntry.powerHouseDischarge, '2.61');
assert.strictEqual(sdmaEntry.rainfall, '6.00');

console.log('SDMA KSEB parser and enrichment tests passed.');
