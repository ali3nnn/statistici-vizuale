const sql = require('./db');

const MAX_TURNS_PER_DAY = 2;

module.exports = async function handler(req, res) {
    if (req.method === 'GET') {
        const userId = req.query.user_id;
        if (!userId) return res.status(400).json({ error: 'user_id required' });

        const today = new Date().toISOString().slice(0, 10);

        const [row] = await sql`
            SELECT turn_count FROM ai_turns
            WHERE user_id = ${userId} AND turn_date = ${today}
        `;

        const used = row ? row.turn_count : 0;
        return res.status(200).json({
            used,
            limit: MAX_TURNS_PER_DAY,
            remaining: Math.max(0, MAX_TURNS_PER_DAY - used)
        });
    }

    if (req.method === 'POST') {
        const { user_id } = req.body;
        if (!user_id) return res.status(400).json({ error: 'user_id required' });

        const today = new Date().toISOString().slice(0, 10);

        // Upsert: increment or insert
        const [row] = await sql`
            INSERT INTO ai_turns (user_id, turn_date, turn_count)
            VALUES (${user_id}, ${today}, 1)
            ON CONFLICT (user_id, turn_date)
            DO UPDATE SET turn_count = ai_turns.turn_count + 1
            RETURNING turn_count
        `;

        const turnCount = row.turn_count;

        if (turnCount > MAX_TURNS_PER_DAY) {
            return res.status(429).json({
                error: 'Daily AI limit reached',
                used: turnCount,
                limit: MAX_TURNS_PER_DAY
            });
        }

        return res.status(200).json({
            used: turnCount,
            limit: MAX_TURNS_PER_DAY,
            remaining: MAX_TURNS_PER_DAY - turnCount
        });
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
