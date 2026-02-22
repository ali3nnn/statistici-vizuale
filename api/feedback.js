const sql = require('./db');

module.exports = async function handler(req, res) {
    if (req.method === 'POST') {
        const { user_id, message, rating } = req.body;
        if (!message) return res.status(400).json({ error: 'message required' });

        const [row] = await sql`
            INSERT INTO feedback (user_id, message, rating)
            VALUES (${user_id || null}::uuid, ${message}, ${rating || null})
            RETURNING id, created_at
        `;
        return res.status(201).json(row);
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
