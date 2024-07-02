const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;

const baseUrl = 'https://dams.kseb.in/?page_id=45';

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

const convertFeetToMeters = (value) => {
  if (typeof value === 'string' && value.trim().endsWith('ft')) {
    const feet = parseFloat(value.trim().replace('ft', ''));
    return `${(feet * 0.3048).toFixed(2)}`;
  }
  return `${(value * 0.3048).toFixed(2)}`;
};

async function extractDamDetails(url) {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const dams = [];

    $('table tr').slice(2, 20).each((index, row) => {
      const columns = $(row).find('td');
      if (columns.length > 21) {
        const dam = {
          id: $(columns[0]).text().trim(),
          name: $(columns[1]).text().trim(),
          MWL: $(columns[3]).text().trim(),
          FRL: $(columns[4]).text().trim(),
          liveStorageAtFRL: $(columns[6]).text().trim(),
          ruleLevel: $(columns[7]).text().trim(),
          blueLevel: $(columns[8]).text().trim(),
          orangeLevel: $(columns[9]).text().trim(),
          redLevel: $(columns[10]).text().trim(),
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

        //Entharo entho.... for some reason kseb wont convert the data for idukki and sholayar from ft to meters.
        if (dam.name.toLowerCase() === 'idukki'||dam.name.toLowerCase() === 'sholayar') {
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
      if (existingData[newDam.name]) {
        const dateExists = existingData[newDam.name].data.some(d => d.date === newDam.data[0].date);
        if (!dateExists) {
          existingData[newDam.name].data.unshift(newDam.data[0]);
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
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

fetchDamDetails();
