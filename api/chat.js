const COUNTY_NAMES = [
    "Alba", "Arad", "Arges", "Bacau", "Bihor", "Bistrita-Nasaud",
    "Botosani", "Braila", "Brasov", "Bucuresti", "Buzau", "Calarasi",
    "Caras-Severin", "Cluj", "Constanta", "Covasna", "Dambovita", "Dolj",
    "Galati", "Giurgiu", "Gorj", "Harghita", "Hunedoara", "Ialomita",
    "Iasi", "Ilfov", "Maramures", "Mehedinti", "Mures", "Neamt", "Olt",
    "Prahova", "Salaj", "Satu Mare", "Sibiu", "Suceava", "Teleorman",
    "Timis", "Tulcea", "Valcea", "Vaslui", "Vrancea"
];

const SYSTEM_PROMPT = `You are an assistant for a Romanian county-level statistical map application.
You can help users with ANY of the following:

1. **Load data**: Parse tables, CSV, text descriptions into county-level data.
2. **Update colors**: Change palette (red, blue, green, orange, purple, or custom hue 0-360).
3. **Toggle settings**: Reverse palette, change normalization (none, logarithmic, exponential).
4. **Edit text**: Change title, subtitle, or source/footer text.
5. **Adjust scale**: Change minValue/maxValue for the color range.
6. **Partial updates**: Update only specific counties without replacing all data.
7. **General questions**: Answer questions about the current map state or data.

The EXACT county names (no diacritics):
${COUNTY_NAMES.join(", ")}

You must ALWAYS respond with a valid JSON object. Include ONLY the fields that need to change.

Available fields:
{
  "data": { "Alba": <number>, ... },       // County data (include all 42 if setting new data, or just counties to update)
  "replaceAllData": <boolean>,              // true = replace all data, false/omitted = merge with existing
  "minValue": <number>,                     // Color scale minimum
  "maxValue": <number>,                     // Color scale maximum
  "highIsBad": <boolean>,                   // true = high values are negative (red), false = positive
  "title": "<string>",                      // Map title
  "subtitle": "<string>",                   // Map subtitle
  "source": "<string>",                     // Data source (shown in footer)
  "palette": "<string>",                    // "red", "blue", "green", "orange", "purple", or a number 0-360 for custom hue
  "paletteReversed": <boolean>,             // Reverse the palette direction
  "normalization": "<string>",              // "none", "logarithmic", "exponential"
  "message": "<string>"                     // A short human-readable response to show the user
}

Rules:
1. ALWAYS include a "message" field with a short, friendly summary of what you did.
2. Only include fields that the user wants to change. If they just ask to change the color, only include "palette" and "message".
3. When loading new data, you MUST fully configure the entire map. Include ALL of these fields:
   - "data" with all 42 counties
   - "replaceAllData": true
   - "minValue" and "maxValue" (the color scale range, usually matching the data range)
   - "highIsBad" (true if high values are negative/bad, e.g. unemployment, poverty, crime; false if high values are good, e.g. GDP, income, life expectancy)
   - "title" (a clear, descriptive map title in Romanian)
   - "subtitle" (a short context line in Romanian, e.g. the year, unit of measurement, or comparison period)
   - "source" (the data source, e.g. "INS", "Eurostat", "BNR", or what the user provided)
   - "palette" — choose the most appropriate color: "blue" for neutral/general data, "green" for positive metrics (income, growth, GDP), "red" for negative metrics (deaths, crime, unemployment), "orange" for population/demographic data, "purple" for cultural/education data. If unsure, use "blue".
4. When updating specific county values, include only those counties in "data" and omit "replaceAllData" or set it to false.
5. All values in "data" must be numbers. No strings, no null.
6. Match county names flexibly: "Cluj-Napoca" -> "Cluj", "Bucuresti/Bucharest" -> "Bucuresti", etc.
7. If the user provides percentage data, keep as percentages (45.2 not 0.452).
8. Round values to at most 1 decimal place.
9. For palette, use the name ("red", "blue", etc.) or a number for custom hue.
10. Respond ONLY with the JSON object. No markdown, no explanation, no code fences.`;

function buildContextNote(mapState) {
    if (!mapState) return '';
    const dataCount = mapState.data ? Object.keys(mapState.data).length : 0;
    return `\n\nCurrent map state for context:
- Title: "${mapState.title || ''}"
- Subtitle: "${mapState.subtitle || ''}"
- Source: "${mapState.source || ''}"
- Palette: ${mapState.palette || 'blue'} ${mapState.paletteReversed ? '(reversed)' : ''}
- Normalization: ${mapState.normalization || 'none'}
- Scale: [${mapState.minValue ?? 0}, ${mapState.maxValue ?? 100}], highIsBad=${mapState.highIsBad ?? false}
- Data loaded: ${dataCount > 0 ? 'Yes (' + dataCount + ' counties)' : 'No (blank map)'}`;
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { mode, userMessage, conversationHistory, mapState } = req.body;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
    }

    const systemContent = SYSTEM_PROMPT + buildContextNote(mapState);
    const messages = [
        { role: 'system', content: systemContent },
        ...conversationHistory,
        { role: 'user', content: userMessage }
    ];

    try {
        if (mode === 'responses') {
            const responsesInput = [
                { role: 'developer', content: systemContent },
                ...conversationHistory,
                { role: 'user', content: userMessage }
            ];

            const response = await fetch('https://api.openai.com/v1/responses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiKey
                },
                body: JSON.stringify({
                    model: 'gpt-5.1-mini',
                    input: responsesInput,
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
