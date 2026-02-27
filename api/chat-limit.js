const sql = require('./db');

const MAX_TURNS_PER_DAY = parseInt(process.env.AI_MAX_TURNS_PER_DAY, 10) || 2;

function extractIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.socket?.remoteAddress ?? 'unknown';
}

module.exports = async function handler(req, res) {
    if (req.method === 'GET') {
        const ip    = extractIp(req);
        const today = new Date().toISOString().slice(0, 10);

        const [row] = await sql`
            SELECT turn_count FROM ai_turns
            WHERE ip = ${ip} AND turn_date = ${today}
        `;

        const used = row ? row.turn_count : 0;
        return res.status(200).json({
            used,
            limit: MAX_TURNS_PER_DAY,
            remaining: Math.max(0, MAX_TURNS_PER_DAY - used)
        });
    }

    if (req.method === 'POST') {
        const ip    = extractIp(req);
        const today = new Date().toISOString().slice(0, 10);

        const [row] = await sql`
            INSERT INTO ai_turns (ip, turn_date, turn_count)
            VALUES (${ip}, ${today}, 1)
            ON CONFLICT (ip, turn_date)
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
