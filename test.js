const { extractDamDetails } = require('./dam_details_fetcher');
const fs = require('fs').promises;

const urls = [
  { date: '03.06.2025', url: 'https://dams.kseb.in/?p=5354' },
  { date: '04.06.2025', url: 'https://dams.kseb.in/?p=5356' },
  { date: '05.06.2025', url: 'https://dams.kseb.in/?p=5359' },
  { date: '06.06.2025', url: 'https://dams.kseb.in/?p=5361' },
  { date: '07.06.2025', url: 'https://dams.kseb.in/?p=5363' },
  { date: '08.06.2025', url: 'https://dams.kseb.in/?p=5365' },
  { date: '09.06.2025', url: 'https://dams.kseb.in/?p=5367' },
  { date: '10.06.2025', url: 'https://dams.kseb.in/?p=5374' },
  { date: '11.06.2025', url: 'https://dams.kseb.in/?p=5376' },
  { date: '12.06.2025', url: 'https://dams.kseb.in/?p=5378' },
  { date: '13.06.2025', url: 'https://dams.kseb.in/?p=5381' },
  { date: '14.06.2025', url: 'https://dams.kseb.in/?p=5383' },
  { date: '15.06.2025', url: 'https://dams.kseb.in/?p=5385' },
  { date: '16.06.2025', url: 'https://dams.kseb.in/?p=5387' },
  { date: '17.06.2025', url: 'https://dams.kseb.in/?p=5392' },
  { date: '18.06.2025', url: 'https://dams.kseb.in/?p=5399' },
  { date: '19.06.2025', url: 'https://dams.kseb.in/?p=5401' },
  { date: '20.06.2025', url: 'https://dams.kseb.in/?p=5403' },
  { date: '21.06.2025', url: 'https://dams.kseb.in/?p=5405' },
  { date: '22.06.2025', url: 'https://dams.kseb.in/?p=5407' },
  { date: '23.06.2025', url: 'https://dams.kseb.in/?p=5409' },
  { date: '24.06.2025', url: 'https://dams.kseb.in/?p=5411' },
  { date: '25.06.2025', url: 'https://dams.kseb.in/?p=5413' },
  { date: '26.06.2025', url: 'https://dams.kseb.in/?p=5415' },
  { date: '27.06.2025', url: 'https://dams.kseb.in/?p=5426' },
  { date: '28.06.2025', url: 'https://dams.kseb.in/?p=5428' },
  { date: '29.06.2025', url: 'https://dams.kseb.in/?p=5438' },
  { date: '30.06.2025', url: 'https://dams.kseb.in/?p=5440' },
  { date: '01.07.2025', url: 'https://dams.kseb.in/?p=5443' },
  { date: '02.07.2025', url: 'https://dams.kseb.in/?p=5445' },
  { date: '03.07.2025', url: 'https://dams.kseb.in/?p=5447' },
  { date: '04.07.2025', url: 'https://dams.kseb.in/?p=5449' },
  { date: '05.07.2025', url: 'https://dams.kseb.in/?p=5452' },
  { date: '06.07.2025', url: 'https://dams.kseb.in/?p=5454' },
  { date: '07.07.2025', url: 'https://dams.kseb.in/?p=5456' },
  { date: '08.07.2025', url: 'https://dams.kseb.in/?p=5458' },
  { date: '09.07.2025', url: 'https://dams.kseb.in/?p=5462' },
  { date: '10.07.2025', url: 'https://dams.kseb.in/?p=5464' },
  { date: '11.07.2025', url: 'https://dams.kseb.in/?p=5466' },
  { date: '12.07.2025', url: 'https://dams.kseb.in/?p=5468' },
  { date: '13.07.2025', url: 'https://dams.kseb.in/?p=5470' },
  { date: '14.07.2025', url: 'https://dams.kseb.in/?p=5472' },
  { date: '15.07.2025', url: 'https://dams.kseb.in/?p=5474' },
  { date: '16.07.2025', url: 'https://dams.kseb.in/?p=5476' }
];

const folderName = 'historic_data';

async function processUrls() {
  try {
      try {
          await fs.access(folderName);
      } catch (error) {
          await fs.mkdir(folderName);
          console.log('Created historic_data folder');
      }

      const existingData = {};
      const files = await fs.readdir(folderName);
      for (const file of files) {
          if (file.endsWith('.json')) {
              const damName = file.replace('.json', '').replace(/_/g, ' ');
              try {
                  const data = JSON.parse(await fs.readFile(`${folderName}/${file}`, 'utf8'));
                  existingData[damName] = data;
              } catch (error) {
                  console.error(`Error reading ${file}:`, error);
              }
          }
      }

      for (const entry of urls) {
          console.log(`Processing: ${entry.date} ${entry.url}`);
          const { dams } = await extractDamDetails(entry.url);
          if (!dams || dams.length === 0) {
              console.log(`No dam data extracted for ${entry.date}.`);
              continue;
          }
          for (const newDam of dams) {
              const existingDam = existingData[newDam.name];
              if (existingDam) {
                  const newDate = newDam.data[0].date;
                  const dateExists = existingDam.data.some(d => d.date === newDate);
                  if (!dateExists) {
                      existingDam.data.unshift(newDam.data[0]);
                      // Update dam properties
                      existingDam.id = newDam.id;
                      existingDam.officialName = newDam.officialName;
                      existingDam.MWL = newDam.MWL;
                      existingDam.FRL = newDam.FRL;
                      existingDam.liveStorageAtFRL = newDam.liveStorageAtFRL;
                      existingDam.ruleLevel = newDam.ruleLevel;
                      existingDam.blueLevel = newDam.blueLevel;
                      existingDam.orangeLevel = newDam.orangeLevel;
                      existingDam.redLevel = newDam.redLevel;
                      // Do NOT overwrite latitude and longitude
                  }
              } else {
                  existingData[newDam.name] = newDam;
              }
          }
      }

      for (const [damName, damData] of Object.entries(existingData)) {
          const filename = `${folderName}/${damName.replace(/\s+/g, '_')}.json`;
          await fs.writeFile(filename, JSON.stringify(damData, null, 4));
          console.log(`Details for dam ${damName} saved successfully in ${filename}.`);
      }
      console.log('All URLs processed and files updated.');
  } catch (error) {
      console.error('Error:', error);
  }
}

processUrls();



