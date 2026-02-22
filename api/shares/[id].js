const sql = require('../db');

module.exports = async function handler(req, res) {
    const { id } = req.query;

    if (req.method === 'GET') {
        const [row] = await sql`
            SELECT id, snapshot, created_at
            FROM shares
            WHERE id = ${id}::uuid
        `;
        if (!row) return res.status(404).json({ error: 'Share not found' });
        return res.json(row);
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
