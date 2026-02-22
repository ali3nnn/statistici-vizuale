const sql = require('./db');

module.exports = async function handler(req, res) {
    if (req.method === 'POST') {
        const { user_id, transcript } = req.body;
        if (!transcript) return res.status(400).json({ error: 'transcript required' });

        const [row] = await sql`
            INSERT INTO queries (user_id, transcript)
            VALUES (${user_id || null}::uuid, ${JSON.stringify(transcript)}::jsonb)
            RETURNING id, created_at
        `;
        return res.status(201).json(row);
    }

    if (req.method === 'PUT') {
        const { id, transcript } = req.body;
        if (!id || !transcript) return res.status(400).json({ error: 'id and transcript required' });

        await sql`
            UPDATE queries
            SET transcript = ${JSON.stringify(transcript)}::jsonb, updated_at = NOW()
            WHERE id = ${id}
        `;
        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
