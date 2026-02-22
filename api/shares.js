const sql = require('./db');

module.exports = async function handler(req, res) {
    if (req.method === 'POST') {
        const { snapshot } = req.body;
        if (!snapshot) return res.status(400).json({ error: 'snapshot required' });

        const [row] = await sql`
            INSERT INTO shares (snapshot)
            VALUES (${JSON.stringify(snapshot)}::jsonb)
            RETURNING id, created_at
        `;
        return res.status(201).json(row);
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
