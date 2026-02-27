const fs   = require('fs');
const path = require('path');

const DATASETS_DIR = path.join(__dirname, '../src/preloadedDatasets');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).end();

    const files = fs.readdirSync(DATASETS_DIR)
        .filter(f => f.endsWith('.json'))
        .sort();

    const list = files.map(file => {
        const content = JSON.parse(fs.readFileSync(path.join(DATASETS_DIR, file), 'utf8'));
        return { slug: file.replace('.json', ''), name: content.name, disabled: content.disabled === true };
    });

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.json(list);
};
