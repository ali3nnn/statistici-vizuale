const sql = require('../db');

module.exports = async function handler(req, res) {
    const { id } = req.query;

    if (req.method === 'PUT') {
        const { user_id, name, versions } = req.body;
        if (!user_id) return res.status(400).json({ error: 'user_id required' });

        const [row] = await sql`
            UPDATE configs
            SET versions = ${JSON.stringify(versions)}::jsonb,
                name = ${name},
                updated_at = NOW()
            WHERE id = ${id}::int AND user_id = ${user_id}::uuid
            RETURNING id, name, versions, created_at, updated_at
        `;
        if (!row) return res.status(404).json({ error: 'Not found' });
        return res.json(row);
    }

    if (req.method === 'DELETE') {
        const { user_id } = req.query;
        if (!user_id) return res.status(400).json({ error: 'user_id required' });

        await sql`DELETE FROM configs WHERE id = ${id}::int AND user_id = ${user_id}::uuid`;
        return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
