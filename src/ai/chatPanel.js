const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const COUNTY_NAMES = [
    "Alba", "Arad", "Arges", "Bacau", "Bihor", "Bistrita-Nasaud",
    "Botosani", "Braila", "Brasov", "Bucuresti", "Buzau", "Calarasi",
    "Caras-Severin", "Cluj", "Constanta", "Covasna", "Dambovita", "Dolj",
    "Galati", "Giurgiu", "Gorj", "Harghita", "Hunedoara", "Ialomita",
    "Iasi", "Ilfov", "Maramures", "Mehedinti", "Mures", "Neamt", "Olt",
    "Prahova", "Salaj", "Satu Mare", "Sibiu", "Suceava", "Teleorman",
    "Timis", "Tulcea", "Valcea", "Vaslui", "Vrancea"
];

const SYSTEM_PROMPT = `You are a data extraction assistant for a Romanian county-level statistical map.

Your job: parse user-provided data (tables, CSV, text descriptions, statistics) into a structured JSON object for all 42 Romanian counties.

The EXACT county names you must use (no diacritics, exact spelling):
${COUNTY_NAMES.join(", ")}

You must ALWAYS respond with a valid JSON object in this exact format:
{
  "data": { "Alba": <number>, "Arad": <number>, ... },
  "minValue": <number>,
  "maxValue": <number>,
  "highIsBad": <boolean>,
  "title": "<short map title in Romanian>",
  "subtitle": "<one-line description or year/period>",
  "source": "<data source name>"
}

Rules:
1. "data" must have exactly 42 entries, one for each county listed above.
2. All values in "data" must be numbers (int or float). No strings, no null.
3. If the user provides data for only some counties, set missing counties to 0.
4. "minValue" and "maxValue" define the color scale range. Choose values that make the map readable:
   - For diverging data (positive and negative), use symmetric bounds like -X and X.
   - For sequential data (all positive), use 0 and a round number above the max.
5. "highIsBad" should be true when higher values are negative (e.g., unemployment, pollution, crime).
   Set false when higher values are positive (e.g., GDP, salaries, growth).
6. "title" should be a concise Romanian title for the map (2-6 words).
7. "subtitle" should describe the metric, units, or time period.
8. "source" should name the data source if the user mentions it, otherwise use "Date utilizator".
9. Match county names flexibly: "Cluj-Napoca" -> "Cluj", "Bucuresti/Bucharest" -> "Bucuresti",
   "Bistrita" -> "Bistrita-Nasaud", "Satu-Mare" -> "Satu Mare", etc.
10. If the user provides percentage data, keep it as percentages (e.g., 45.2 not 0.452).
11. Round values to at most 1 decimal place for cleanliness.
12. Respond ONLY with the JSON object. No markdown, no explanation, no code fences.`;

let conversationHistory = [];
let onDataParsedCallback = null;

export function initChatPanel({ onDataParsed }) {
    onDataParsedCallback = onDataParsed;
    createChatDOM();
    wireEvents();
}

function createChatDOM() {
    const drawer = document.createElement('div');
    drawer.id = 'ai-chat-drawer';
    drawer.innerHTML = `
        <div class="chat-handle" id="chat-handle">
            <span class="chat-handle-icon">&#9650;</span>
            <span>AI Data Input</span>
        </div>
        <div class="chat-body" id="chat-body">
            <div class="chat-log" id="chat-log">
                <div class="chat-msg system">
                    Paste a table, CSV, or describe county-level statistics.
                    The AI will parse it and apply it to both maps.
                </div>
            </div>
            <div class="chat-input-row">
                <textarea id="chat-input"
                    placeholder="Paste data or describe statistics..."
                    rows="3"></textarea>
                <button id="chat-send" class="chat-send-btn">Send</button>
            </div>
        </div>
    `;
    document.body.appendChild(drawer);
}

function wireEvents() {
    const handle = document.getElementById('chat-handle');
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');

    let isOpen = false;
    handle.addEventListener('click', () => {
        isOpen = !isOpen;
        document.getElementById('ai-chat-drawer').classList.toggle('open', isOpen);
        handle.querySelector('.chat-handle-icon').innerHTML = isOpen ? '&#9660;' : '&#9650;';
        if (isOpen) input.focus();
    });

    sendBtn.addEventListener('click', () => handleSend());

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSend();
        }
    });
}

async function handleSend() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    appendMessage('user', message);

    setLoading(true);
    try {
        const parsed = await sendToOpenAI(message);
        appendMessage('assistant', formatResponse(parsed));
        if (onDataParsedCallback) {
            onDataParsedCallback(parsed);
        }
    } catch (err) {
        appendMessage('error', 'Error: ' + err.message);
    } finally {
        setLoading(false);
    }
}

async function sendToOpenAI(userMessage) {
    conversationHistory.push({ role: 'user', content: userMessage });

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...conversationHistory
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + OPENAI_API_KEY
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
        throw new Error('OpenAI API error ' + response.status + ': ' + errBody);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;

    conversationHistory.push({ role: 'assistant', content: content });

    const parsed = JSON.parse(content);
    validateResponse(parsed);
    return parsed;
}

function validateResponse(parsed) {
    if (!parsed.data || typeof parsed.data !== 'object') {
        throw new Error('Response missing "data" object');
    }
    const keys = Object.keys(parsed.data);
    if (keys.length < 10) {
        throw new Error('Only ' + keys.length + ' counties in response, expected ~42');
    }
    for (const [county, val] of Object.entries(parsed.data)) {
        if (typeof val !== 'number') {
            throw new Error('Non-numeric value for ' + county + ': ' + val);
        }
    }
    if (typeof parsed.minValue !== 'number' || typeof parsed.maxValue !== 'number') {
        throw new Error('Missing or non-numeric minValue/maxValue');
    }
}

function formatResponse(parsed) {
    const counties = Object.keys(parsed.data).length;
    const vals = Object.values(parsed.data);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return 'Applied: ' + counties + ' counties, range [' + min + ', ' + max + '], ' +
           'scale [' + parsed.minValue + ', ' + parsed.maxValue + '], ' +
           'highIsBad=' + parsed.highIsBad +
           (parsed.title ? ', title="' + parsed.title + '"' : '');
}

function appendMessage(role, content) {
    const log = document.getElementById('chat-log');
    const msg = document.createElement('div');
    msg.className = 'chat-msg ' + role;
    msg.textContent = content;
    log.appendChild(msg);
    log.scrollTop = log.scrollHeight;
}

function setLoading(isLoading) {
    const sendBtn = document.getElementById('chat-send');
    const input = document.getElementById('chat-input');
    sendBtn.disabled = isLoading;
    input.disabled = isLoading;
    sendBtn.textContent = isLoading ? '...' : 'Send';

    if (isLoading) {
        const loader = document.createElement('div');
        loader.className = 'chat-msg assistant loading';
        loader.id = 'chat-loading';
        loader.textContent = 'Thinking...';
        document.getElementById('chat-log').appendChild(loader);
        document.getElementById('chat-log').scrollTop = document.getElementById('chat-log').scrollHeight;
    } else {
        const loader = document.getElementById('chat-loading');
        if (loader) loader.remove();
    }
}
