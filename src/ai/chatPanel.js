import * as XLSX from 'xlsx';

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

let conversationHistory = [];
let conversationDbId = null;
let onConfigUpdateCallback = null;
let getStateCallback = null;
let onLoadingChangeCallback = null;
let webSearchEnabled = false;
let pendingFileContent = null;
let pendingFileName = null;

export function initChatPanel({ onConfigUpdate, getState, onLoadingChange }) {
    onConfigUpdateCallback = onConfigUpdate;
    getStateCallback = getState;
    onLoadingChangeCallback = onLoadingChange;
    createChatDOM();
    wireEvents();
}

function createChatDOM() {
    // AI FAB button — appended to shared .fab-row
    const fab = document.createElement('button');
    fab.id = 'ai-chat-fab';
    fab.className = 'fab-btn';
    fab.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>Add data with AI</span>`;
    let fabRow = document.getElementById('fab-row');
    if (!fabRow) {
        fabRow = document.createElement('div');
        fabRow.id = 'fab-row';
        fabRow.className = 'fab-row';
        document.body.appendChild(fabRow);
    }
    fabRow.appendChild(fab);

    // Chat panel
    const panel = document.createElement('div');
    panel.id = 'ai-chat-panel';
    panel.innerHTML = `
        <div class="ai-chat-header">
            <div class="ai-chat-header-left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span>Add data with AI</span>
            </div>
            <button id="ai-chat-close" class="ai-chat-close">&times;</button>
        </div>
        <div class="ai-chat-log" id="ai-chat-log">
            <div class="chat-msg system">
                Ask me anything! I can load data, change colors, update titles, adjust the scale, or tweak any map setting.
            </div>
        </div>
        <div class="ai-chat-file-preview" id="ai-chat-file-preview">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span id="ai-chat-file-name"></span>
            <button id="ai-chat-file-remove" title="Remove file">&times;</button>
        </div>
        <div class="ai-chat-input-area">
            <input type="file" id="ai-chat-file-input" accept=".csv,.xls,.xlsx,.txt" style="display:none">
            <textarea id="ai-chat-input" placeholder="Add here your data per county" rows="2"></textarea>
            <button id="ai-chat-file-btn" title="Upload file (CSV, XLS, TXT)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <button id="ai-chat-web-toggle" title="Enable web search">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </button>
            <button id="ai-chat-send">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
        </div>
    `;
    document.body.appendChild(panel);

    // Feedback modal
    const feedbackModal = document.createElement('div');
    feedbackModal.id = 'feedback-modal';
    feedbackModal.innerHTML = `
        <div class="feedback-modal-backdrop" id="feedback-backdrop"></div>
        <div class="feedback-modal-card">
            <div class="feedback-modal-header">
                <span>Send Feedback</span>
                <button id="feedback-close" class="ai-chat-close">&times;</button>
            </div>
            <div class="feedback-modal-body">
                <label class="feedback-label">How would you rate your experience?</label>
                <div class="feedback-rating" id="feedback-rating">
                    <button class="feedback-star" data-rating="1">1</button>
                    <button class="feedback-star" data-rating="2">2</button>
                    <button class="feedback-star" data-rating="3">3</button>
                    <button class="feedback-star" data-rating="4">4</button>
                    <button class="feedback-star" data-rating="5">5</button>
                </div>
                <label class="feedback-label">Your feedback</label>
                <textarea id="feedback-message" placeholder="Tell us what you think, report a bug, or suggest a feature..." rows="4"></textarea>
            </div>
            <div class="feedback-modal-footer">
                <button id="feedback-submit" class="feedback-submit-btn">Submit</button>
            </div>
        </div>
    `;
    document.body.appendChild(feedbackModal);
}

function wireEvents() {
    const fab = document.getElementById('ai-chat-fab');
    const panel = document.getElementById('ai-chat-panel');
    const closeBtn = document.getElementById('ai-chat-close');
    const input = document.getElementById('ai-chat-input');
    const sendBtn = document.getElementById('ai-chat-send');

    const fabRow = document.getElementById('fab-row');

    fab.addEventListener('click', () => {
        panel.classList.add('open');
        fabRow.classList.add('hidden');
        input.focus();
    });

    closeBtn.addEventListener('click', () => {
        panel.classList.remove('open');
        fabRow.classList.remove('hidden');
    });

    const webToggle = document.getElementById('ai-chat-web-toggle');
    webToggle.addEventListener('click', () => {
        webSearchEnabled = !webSearchEnabled;
        webToggle.classList.toggle('active', webSearchEnabled);
    });

    sendBtn.addEventListener('click', () => handleSend());

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    // File upload
    const fileBtn = document.getElementById('ai-chat-file-btn');
    const fileInput = document.getElementById('ai-chat-file-input');
    const filePreview = document.getElementById('ai-chat-file-preview');
    const fileNameEl = document.getElementById('ai-chat-file-name');
    const fileRemoveBtn = document.getElementById('ai-chat-file-remove');

    fileBtn.addEventListener('click', () => { fileInput.click(); });

    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;
        if (file.size > 500 * 1024) {
            appendMessage('error', 'File too large (max 500KB)');
            fileInput.value = '';
            return;
        }
        handleFileSelect(file);
    });

    fileRemoveBtn.addEventListener('click', () => {
        pendingFileContent = null;
        pendingFileName = null;
        filePreview.classList.remove('active');
        fileInput.value = '';
    });

    // Feedback modal
    const feedbackFab = document.getElementById('feedback-fab');
    const feedbackModal = document.getElementById('feedback-modal');
    const feedbackClose = document.getElementById('feedback-close');
    const feedbackBackdrop = document.getElementById('feedback-backdrop');
    const feedbackSubmit = document.getElementById('feedback-submit');
    let selectedRating = null;

    feedbackFab.addEventListener('click', () => {
        feedbackModal.classList.add('open');
    });

    const closeFeedback = () => {
        feedbackModal.classList.remove('open');
    };
    feedbackClose.addEventListener('click', closeFeedback);
    feedbackBackdrop.addEventListener('click', closeFeedback);

    document.querySelectorAll('.feedback-star').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedRating = parseInt(btn.dataset.rating);
            document.querySelectorAll('.feedback-star').forEach(b => {
                b.classList.toggle('active', parseInt(b.dataset.rating) <= selectedRating);
            });
        });
    });

    feedbackSubmit.addEventListener('click', async () => {
        const message = document.getElementById('feedback-message').value.trim();
        if (!message) return;

        feedbackSubmit.disabled = true;
        feedbackSubmit.textContent = 'Sending...';

        try {
            const userId = localStorage.getItem('map-user-id');
            await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, message, rating: selectedRating })
            });
            // Reset and close
            document.getElementById('feedback-message').value = '';
            selectedRating = null;
            document.querySelectorAll('.feedback-star').forEach(b => b.classList.remove('active'));
            feedbackSubmit.textContent = 'Sent!';
            setTimeout(() => {
                closeFeedback();
                feedbackSubmit.textContent = 'Submit';
                feedbackSubmit.disabled = false;
            }, 1000);
        } catch (err) {
            feedbackSubmit.textContent = 'Error — retry';
            feedbackSubmit.disabled = false;
        }
    });
}

async function handleSend() {
    const input = document.getElementById('ai-chat-input');
    const message = input.value.trim();
    if (!message && !pendingFileContent) return;

    input.value = '';
    input.style.height = 'auto';

    // Build display message and full message for the AI
    let displayMsg = message || '';
    let fullMessage = message || '';

    if (pendingFileContent) {
        if (displayMsg) displayMsg += `  (+ ${pendingFileName})`;
        else displayMsg = pendingFileName;
        fullMessage = 'Here is the uploaded data:\n\n' + pendingFileContent + (message ? '\n\n' + message : '');
        // Clear file state
        pendingFileContent = null;
        pendingFileName = null;
        document.getElementById('ai-chat-file-preview').classList.remove('active');
        document.getElementById('ai-chat-file-input').value = '';
    }

    appendMessage('user', displayMsg);

    setLoading(true);
    if (onLoadingChangeCallback) onLoadingChangeCallback(true);
    try {
        const parsed = await sendToOpenAI(fullMessage);

        // Check for missing counties when data is provided
        if (parsed.data) {
            const missing = COUNTY_NAMES.filter(name => !(name in parsed.data));
            if (missing.length > 0) {
                missing.forEach(name => { parsed.data[name] = 0; });
                const missingNote = `\n\nMissing counties (set to 0): ${missing.join(', ')}`;
                parsed.message = (parsed.message || '') + missingNote;
            }
        }

        const displayMsg = parsed.message || formatResponse(parsed);
        appendMessage('assistant', displayMsg);
        if (onConfigUpdateCallback) {
            onConfigUpdateCallback(parsed);
        }
    } catch (err) {
        appendMessage('error', err.message);
    } finally {
        setLoading(false);
        if (onLoadingChangeCallback) onLoadingChangeCallback(false);
    }
}

function handleFileSelect(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const preview = document.getElementById('ai-chat-file-preview');
    const nameEl = document.getElementById('ai-chat-file-name');

    if (ext === 'xls' || ext === 'xlsx') {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array' });
                const firstSheet = wb.Sheets[wb.SheetNames[0]];
                pendingFileContent = XLSX.utils.sheet_to_csv(firstSheet);
                pendingFileName = file.name;
                nameEl.textContent = file.name;
                preview.classList.add('active');
            } catch (err) {
                appendMessage('error', 'Failed to parse Excel file');
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        // CSV or TXT — read as plain text
        const reader = new FileReader();
        reader.onload = (e) => {
            pendingFileContent = e.target.result;
            pendingFileName = file.name;
            nameEl.textContent = file.name;
            preview.classList.add('active');
        };
        reader.readAsText(file);
    }
}

async function sendToOpenAI(userMessage) {
    // Build context about current state
    let contextNote = '';
    if (getStateCallback) {
        const state = getStateCallback();
        contextNote = `\n\nCurrent map state for context:
- Title: "${state.title}"
- Subtitle: "${state.subtitle}"
- Source: "${state.source}"
- Palette: ${state.palette} ${state.paletteReversed ? '(reversed)' : ''}
- Normalization: ${state.normalization}
- Scale: [${state.minValue}, ${state.maxValue}], highIsBad=${state.highIsBad}
- Data loaded: ${Object.keys(state.data).length > 0 ? 'Yes (' + Object.keys(state.data).length + ' counties)' : 'No (blank map)'}`;
    }

    conversationHistory.push({ role: 'user', content: userMessage });

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT + contextNote },
        ...conversationHistory
    ];

    let content;

    if (webSearchEnabled) {
        // Responses API uses "developer" role instead of "system"
        const responsesInput = [
            { role: 'developer', content: SYSTEM_PROMPT + contextNote },
            ...conversationHistory
        ];

        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + OPENAI_API_KEY
            },
            body: JSON.stringify({
                model: 'gpt-5.1-mini',
                input: responsesInput,
                tools: [{ type: 'web_search_preview' }],
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error('Responses API error:', errBody);
            throw new Error('API error ' + response.status);
        }

        const result = await response.json();
        const messageOutput = result.output.find(item => item.type === 'message');
        const rawText = messageOutput.content.find(c => c.type === 'output_text').text;

        // Extract JSON from the response (model may wrap it in markdown fences)
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        content = jsonMatch ? jsonMatch[0] : rawText;
    } else {
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
            throw new Error('API error ' + response.status);
        }

        const result = await response.json();
        content = result.choices[0].message.content;
    }

    conversationHistory.push({ role: 'assistant', content: content });

    // Sync full transcript to database (fire-and-forget)
    syncTranscript();

    return JSON.parse(content);
}

function syncTranscript() {
    const userId = localStorage.getItem('map-user-id');
    const transcript = conversationHistory.map(m => ({ role: m.role, content: m.content }));

    if (!conversationDbId) {
        // First exchange — create a new row
        fetch('/api/queries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, transcript })
        })
            .then(r => r.json())
            .then(data => { conversationDbId = data.id; })
            .catch(() => {});
    } else {
        // Subsequent exchanges — update existing row
        fetch('/api/queries', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: conversationDbId, transcript })
        }).catch(() => {});
    }
}

function formatResponse(parsed) {
    const parts = [];
    if (parsed.data) {
        const count = Object.keys(parsed.data).length;
        parts.push('Updated ' + count + ' counties');
    }
    if (parsed.palette) parts.push('palette: ' + parsed.palette);
    if (parsed.normalization) parts.push('normalization: ' + parsed.normalization);
    if (parsed.title) parts.push('title set');
    return parts.length > 0 ? parts.join(', ') : 'Done';
}

function appendMessage(role, content) {
    const log = document.getElementById('ai-chat-log');
    const msg = document.createElement('div');
    msg.className = 'chat-msg ' + role;
    msg.textContent = content;
    log.appendChild(msg);
    log.scrollTop = log.scrollHeight;
}

function setLoading(isLoading) {
    const sendBtn = document.getElementById('ai-chat-send');
    const input = document.getElementById('ai-chat-input');
    const fileBtn = document.getElementById('ai-chat-file-btn');
    sendBtn.disabled = isLoading;
    input.disabled = isLoading;
    fileBtn.disabled = isLoading;

    if (isLoading) {
        const loader = document.createElement('div');
        loader.className = 'chat-msg assistant loading';
        loader.id = 'ai-chat-loading';
        loader.innerHTML = '<span class="dot-pulse"></span>';
        document.getElementById('ai-chat-log').appendChild(loader);
        document.getElementById('ai-chat-log').scrollTop = document.getElementById('ai-chat-log').scrollHeight;
    } else {
        const loader = document.getElementById('ai-chat-loading');
        if (loader) loader.remove();
    }
}
