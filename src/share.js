import html2canvas from 'html2canvas';
import { getCountyAbbreviation } from './utils/countyNameShortener.js';
import { countiesGeoData } from './maps/judete.romania.js';

// ============= State (set from snapshot) =============

let _data = {};
let _minValue = 0;
let _maxValue = 0;
let _highIsBad = false;
let activePalette = { hue: 0, id: 'red', name: 'Red' };
let paletteReversed = false;
let normalizationMode = 'none';
let actualMin = 0;
let actualMax = 0;

// ============= Color Functions =============

function getColorDivergingExp(minVal, maxVal, currentNumber, highIsBad) {
    if (minVal === maxVal) return '#e0e0e0';

    const hue = activePalette.hue;

    let normalized;
    if (normalizationMode === 'logarithmic') {
        const logMin = Math.log(1 + minVal);
        const logMax = Math.log(1 + maxVal);
        const logVal = Math.log(1 + currentNumber);
        normalized = (logVal - logMin) / (logMax - logMin);
    } else if (normalizationMode === 'exponential') {
        normalized = (currentNumber - minVal) / (maxVal - minVal);
        normalized = Math.max(0, Math.min(1, normalized));
        normalized = Math.pow(normalized, 2);
    } else {
        normalized = (currentNumber - minVal) / (maxVal - minVal);
    }
    normalized = Math.max(0, Math.min(1, normalized));

    if (highIsBad) normalized = 1 - normalized;
    if (paletteReversed) normalized = 1 - normalized;

    const lightness = 95 - 65 * normalized;
    const saturation = 30 + 70 * normalized;

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
    };
}

function parseColor(str) {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = str;
    const hex = ctx.fillStyle;
    return hexToRgb(hex);
}

function relativeLuminance({ r, g, b }) {
    const [rs, gs, bs] = [r, g, b].map(c => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastTextColor(bgColorStr) {
    const rgb = parseColor(bgColorStr);
    return relativeLuminance(rgb) < 0.4 ? 'white' : 'black';
}

// ============= Polygon Centroid =============

function polygonCentroid(coords) {
    const ring = coords[0];
    let area = 0;
    let cx = 0;
    let cy = 0;
    const n = ring.length;

    for (let i = 0; i < n - 1; i++) {
        const x0 = ring[i][0], y0 = ring[i][1];
        const x1 = ring[i + 1][0], y1 = ring[i + 1][1];
        const cross = x0 * y1 - x1 * y0;
        area += cross;
        cx += (x0 + x1) * cross;
        cy += (y0 + y1) * cross;
    }

    area *= 0.5;
    cx /= (6 * area);
    cy /= (6 * area);

    return [cy, cx]; // [lat, lng] for Leaflet
}

// ============= Legend =============

function generateLegend() {
    const legendEl = document.getElementById('legend');
    if (!legendEl) return;

    const steps = 20;
    let gradientStops = [];

    for (let i = 0; i <= steps; i++) {
        const value = _maxValue - (_maxValue - _minValue) * (i / steps);
        const color = getColorDivergingExp(_minValue, _maxValue, value, _highIsBad);
        const percent = (i / steps) * 100;
        gradientStops.push(`${color} ${percent}%`);
    }

    legendEl.innerHTML = `
        <div class="legend-body">
            <div class="legend-gradient" style="background: linear-gradient(to bottom, ${gradientStops.join(', ')})"></div>
            <div class="legend-labels">
                <span>${actualMax}</span>
                <span>${actualMin}</span>
            </div>
        </div>
    `;
}

// ============= Download / Copy =============

async function downloadCapture() {
    const captureArea = document.getElementById('capture');
    const format = new URLSearchParams(window.location.search).get('format') || '4x5';
    const width = format === '9x16' ? 1080 : 1080;
    const height = format === '9x16' ? 1920 : 1350;

    try {
        const sourceCanvas = await html2canvas(captureArea, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            onclone: (clonedDoc) => {
                clonedDoc.body.classList.add('capturing');
            },
        });

        const targetCanvas = document.createElement('canvas');
        targetCanvas.width = width;
        targetCanvas.height = height;
        const ctx = targetCanvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        const scaleX = width / sourceCanvas.width;
        const scaleY = height / sourceCanvas.height;
        const scale = Math.min(scaleX, scaleY);

        const drawWidth = sourceCanvas.width * scale;
        const drawHeight = sourceCanvas.height * scale;
        const offsetX = (width - drawWidth) / 2;
        const offsetY = (height - drawHeight) / 2;

        ctx.drawImage(sourceCanvas, offsetX, offsetY, drawWidth, drawHeight);

        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const stamp = `${dd}${mm}${yyyy}_${hh}${min}`;

        const link = document.createElement('a');
        link.download = `statistici-${format}_${stamp}.png`;
        link.href = targetCanvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        console.error('Download failed:', err);
    }
}

async function copyCapture() {
    const btn = document.getElementById('btn-copy');
    const captureArea = document.getElementById('capture');

    try {
        const sourceCanvas = await html2canvas(captureArea, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            onclone: (clonedDoc) => {
                clonedDoc.body.classList.add('capturing');
            },
        });

        const blob = await new Promise(resolve => sourceCanvas.toBlob(resolve, 'image/png'));
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]);

        btn.classList.add('copied');
        setTimeout(() => btn.classList.remove('copied'), 1500);
    } catch (err) {
        console.error('Copy failed:', err);
    }
}

// ============= Main =============

(async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('id');
    const format = urlParams.get('format') || '4x5';

    if (!shareId) {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('error').classList.add('visible');
        return;
    }

    try {
        const res = await fetch(`/api/shares/${shareId}`);
        if (!res.ok) throw new Error('Not found');
        const { snapshot } = await res.json();

        // Set state from snapshot
        _data = snapshot.data || {};
        _minValue = snapshot.minValue || 0;
        _maxValue = snapshot.maxValue || 0;
        _highIsBad = snapshot.highIsBad || false;
        activePalette = snapshot.activePalette || { hue: 0, id: 'red', name: 'Red' };
        paletteReversed = snapshot.paletteReversed || false;
        normalizationMode = snapshot.normalizationMode || 'none';

        const vals = Object.values(_data).filter(v => typeof v === 'number');
        if (vals.length > 0) {
            actualMin = Math.min(...vals);
            actualMax = Math.max(...vals);
        }

        // Set capture area aspect ratio
        const captureArea = document.getElementById('capture');
        captureArea.classList.add(format === '9x16' ? 'ratio-9x16' : 'ratio-4x5');

        // Populate text from snapshot
        if (snapshot.text) {
            const titleEl = document.getElementById('title');
            const subtitleEl = document.getElementById('subtitle');
            const footerEl = document.getElementById('footer');

            if (snapshot.text.title) {
                titleEl.innerHTML = snapshot.text.title.innerHTML || '';
                if (snapshot.text.title.textAlign) titleEl.style.textAlign = snapshot.text.title.textAlign;
                if (snapshot.text.title.top) titleEl.style.top = snapshot.text.title.top;
            }
            if (snapshot.text.subtitle) {
                subtitleEl.innerHTML = snapshot.text.subtitle.innerHTML || '';
                if (snapshot.text.subtitle.textAlign) subtitleEl.style.textAlign = snapshot.text.subtitle.textAlign;
                if (snapshot.text.subtitle.top) subtitleEl.style.top = snapshot.text.subtitle.top;
            }
            if (snapshot.text.footer) {
                footerEl.innerHTML = snapshot.text.footer.innerHTML || '';
                if (snapshot.text.footer.textAlign) footerEl.style.textAlign = snapshot.text.footer.textAlign;
                if (snapshot.text.footer.top) footerEl.style.top = snapshot.text.footer.top;
            }
        }

        // Update page title
        const titleText = document.getElementById('title')?.textContent;
        if (titleText) document.title = titleText + ' — Statistici Vizuale';

        // Determine display settings for this format
        const displaySettings = snapshot.display?.[format.replace('x', 'x')] || {};
        const showCode = displaySettings.showCode !== undefined ? displaySettings.showCode : true;
        const showValue = displaySettings.showValue !== undefined ? displaySettings.showValue : true;
        const labelSize = displaySettings.labelSize || (format === '9x16' ? '8' : '13');

        // Create Leaflet map
        const mapInstance = L.map('map', {
            zoomControl: false,
            preferCanvas: true,
            attributionControl: false,
            zoomSnap: 0,
            zoomDelta: 0.5,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            touchZoom: false,
            keyboard: false,
        }).setView([45.9432, 24.9668], 6);

        // Add tile layer (hidden)
        const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {}).addTo(mapInstance);
        mapInstance.eachLayer(function (layer) {
            if (layer._url) {
                layer._container.style.display = 'none';
            }
        });

        // Add GeoJSON layer
        const geoLayer = L.geoJSON(countiesGeoData, {
            style: function (feature) {
                const color = getColorDivergingExp(_minValue, _maxValue, _data[feature.properties.name], _highIsBad);
                return {
                    fillColor: color,
                    weight: 1,
                    opacity: 1,
                    color: 'white',
                    fillOpacity: 1
                };
            },
            onEachFeature: function (feature, layer) {
                const bgColor = getColorDivergingExp(_minValue, _maxValue, _data[feature.properties.name], _highIsBad);
                const textColor = feature.properties.name === 'Bucuresti' ? 'black' : contrastTextColor(bgColor);

                const codeDisplay = showCode ? '' : 'display:none';
                const valueDisplay = showValue ? '' : 'display:none';

                const icon = L.divIcon({
                    className: 'county-label',
                    iconSize: [0, 0],
                    iconAnchor: [0, 0],
                    html: `<div class="label-inner" style="color:${textColor};font-size:${labelSize}px"><span class="label-code" style="${codeDisplay}">${getCountyAbbreviation(feature.properties.name)}</span><span class="label-value" style="${valueDisplay}">${_data[feature.properties.name]}</span></div>`
                });

                let coordinates = polygonCentroid(feature.geometry.coordinates);

                if (feature.properties.name === 'Bucuresti') {
                    coordinates = [coordinates[0], coordinates[1] + 0.4];
                }
                if (feature.properties.name === 'Tulcea') {
                    coordinates = [coordinates[0], coordinates[1] - 0.4];
                }

                L.marker(coordinates, { icon: icon }).addTo(mapInstance);
            }
        }).addTo(mapInstance);

        // Fit map to bounds — auto-adjusts zoom to screen size
        setTimeout(() => {
            mapInstance.invalidateSize();

            // Use saved map state if available for the selected format
            const mapKey = format === '9x16' ? 'map9x16' : 'map4x5';
            const savedMapState = snapshot.mapState?.[mapKey];

            if (savedMapState) {
                mapInstance.setView(
                    [savedMapState.center.lat, savedMapState.center.lng],
                    savedMapState.zoom,
                    { animate: false }
                );
            } else {
                mapInstance.fitBounds(geoLayer.getBounds(), { padding: [10, 10] });
            }
        }, 100);

        // Generate legend
        generateLegend();

        // Show viewer, hide loading
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('viewer').classList.add('visible');
        document.getElementById('share-actions').style.display = '';

        // Wire download/copy buttons
        document.getElementById('btn-download').addEventListener('click', downloadCapture);
        document.getElementById('btn-copy').addEventListener('click', copyCapture);

    } catch (err) {
        console.error('Failed to load share:', err);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('error').classList.add('visible');
    }
})();
