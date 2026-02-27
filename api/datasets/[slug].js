const fs   = require('fs');
const path = require('path');

const DATASETS_DIR = path.join(__dirname, '../../src/preloadedDatasets');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).end();

    const { slug } = req.query;
    if (!slug || !/^[\w-]+$/.test(slug)) {
        return res.status(400).json({ error: 'Invalid slug' });
    }

    const filePath = path.join(DATASETS_DIR, `${slug}.json`);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Not found' });
    }

    const dataset = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (dataset.disabled === true) {
        return res.status(403).json({ error: 'Dataset not yet available' });
    }
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.json(dataset.config);
};
