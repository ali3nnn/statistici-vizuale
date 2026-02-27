const sql = require('./db');

function extractIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.socket?.remoteAddress ?? null;
}

function extractLocation(req) {
    const city    = req.headers['x-vercel-ip-city']           ?? null;
    const country = req.headers['x-vercel-ip-country']        ?? null;
    const region  = req.headers['x-vercel-ip-country-region'] ?? null;
    const lat     = req.headers['x-vercel-ip-latitude']       ?? null;
    const lon     = req.headers['x-vercel-ip-longitude']      ?? null;
    if (!city && !country) return null;
    return { city, country, region, latitude: lat, longitude: lon };
}

module.exports = async function handler(req, res) {
    if (req.method === 'POST') {
        const { user_id, transcript } = req.body;
        if (!transcript) return res.status(400).json({ error: 'transcript required' });

        const ip       = extractIp(req);
        const location = extractLocation(req);

        const [row] = await sql`
            INSERT INTO queries (user_id, transcript, ip, location)
            VALUES (
                ${user_id || null}::uuid,
                ${JSON.stringify(transcript)}::jsonb,
                ${ip},
                ${location ? JSON.stringify(location) : null}::jsonb
            )
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
