const sql = require('./db');

module.exports = async function handler(req, res) {
    if (req.method === 'GET') {
        const { user_id } = req.query;
        if (!user_id) return res.status(400).json({ error: 'user_id required' });

        const rows = await sql`
            SELECT id, name, versions, created_at, updated_at
            FROM configs
            WHERE user_id = ${user_id}::uuid
            ORDER BY updated_at DESC
        `;
        return res.json(rows);
    }

    if (req.method === 'POST') {
        const { user_id, name, versions } = req.body;
        if (!user_id || !name) return res.status(400).json({ error: 'user_id and name required' });

        const [row] = await sql`
            INSERT INTO configs (user_id, name, versions)
            VALUES (${user_id}::uuid, ${name}, ${JSON.stringify(versions)}::jsonb)
            RETURNING id, name, versions, created_at, updated_at
        `;
        return res.status(201).json(row);
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
