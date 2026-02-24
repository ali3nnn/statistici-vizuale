module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { mode, messages, input } = req.body;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
    }

    try {
        if (mode === 'responses') {
            const response = await fetch('https://api.openai.com/v1/responses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiKey
                },
                body: JSON.stringify({
                    model: 'gpt-5.1-mini',
                    input: input,
                    tools: [{ type: 'web_search_preview' }],
                })
            });

            if (!response.ok) {
                const errBody = await response.text();
                return res.status(response.status).json({ error: errBody });
            }

            const result = await response.json();
            return res.status(200).json(result);
        } else {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiKey
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: messages,
                    temperature: 0.1,
                    max_tokens: 4000,
                    response_format: { type: 'json_object' }
                })
            });

            if (!response.ok) {
                const errBody = await response.text();
                return res.status(response.status).json({ error: errBody });
            }

            const result = await response.json();
            return res.status(200).json(result);
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
