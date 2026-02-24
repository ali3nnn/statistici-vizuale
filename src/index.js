console.log("index.js")

import html2canvas from 'html2canvas';

import {
    getCountyAbbreviation
} from './utils/countyNameShortener.js'

import { preloadedDatasets } from './preloadedDatasets/index.js'

// const abv = getCountyAbbreviation("Cluj")
// console.log(abv)

import {
    countiesGeoData
} from './maps/judete.romania.js'

// import { GEO_DATA_UAT } from './maps/uat.romania'

// ============= User Identity =============

function getUserId() {
    let id = localStorage.getItem('map-user-id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('map-user-id', id);
    }
    return id;
}

const USER_ID = getUserId();

// Assigning data
const romaniaGeoJSON = countiesGeoData;
// const romaniaGeoJSON = GEO_DATA_UAT;

// All 42 Romanian counties
const COUNTY_NAMES = [
    "Alba", "Arad", "Arges", "Bacau", "Bihor", "Bistrita-Nasaud",
    "Botosani", "Braila", "Brasov", "Bucuresti", "Buzau", "Calarasi",
    "Caras-Severin", "Cluj", "Constanta", "Covasna", "Dambovita", "Dolj",
    "Galati", "Giurgiu", "Gorj", "Harghita", "Hunedoara", "Ialomita",
    "Iasi", "Ilfov", "Maramures", "Mehedinti", "Mures", "Neamt", "Olt",
    "Prahova", "Salaj", "Satu Mare", "Sibiu", "Suceava", "Teleorman",
    "Timis", "Tulcea", "Valcea", "Vaslui", "Vrancea"
];

// Initialize with all counties as null (no data)
let _maxValue = 0;
let _minValue = 0;
let _data = Object.fromEntries(COUNTY_NAMES.map(name => [name, null]));
let _highIsBad = false;

// Compute actual min/max from the data
let dataValues = Object.values(_data).filter(v => typeof v === 'number');
let actualMin = Math.min(...dataValues);
let actualMax = Math.max(...dataValues);

// ============= Color Palette System =============

const palettes = [
    { name: 'Red',    hue: 0,   id: 'red' },
    { name: 'Blue',   hue: 220, id: 'blue' },
    { name: 'Green',  hue: 130, id: 'green' },
    { name: 'Orange', hue: 30,  id: 'orange' },
    { name: 'Purple', hue: 280, id: 'purple' },
];

let activePalette = palettes[0];
let paletteReversed = false;
let normalizationMode = 'none'; // 'none' | 'logarithmic' | 'exponential'

// ============= Color Functions =============

function getColor(minVal, maxVal, currentNumber, isReversed, countryName) {
    const minHue = 120;
    const maxHue = 0;

    let hue;
    if (isReversed) {
        hue = 120 - 120 * (currentNumber - minVal) / (maxVal - minVal);
    } else {
        hue = 120 * (currentNumber - minVal) / (maxVal - minVal);
    }

    let lightness = 50;
    if (currentNumber > maxVal) {
        lightness = 50 * (1 - (currentNumber - maxVal) / currentNumber);
    }

    return `hsl(${hue}, 100%, ${lightness}%)`;
}

function getColorSequential(minVal, maxVal, currentNumber, isReversed, countryName) {
    const hue = 220;
    const minLightness = 90;
    const maxLightness = 30;

    let normalized = (currentNumber - minVal) / (maxVal - minVal);
    normalized = Math.max(0, Math.min(1, normalized));

    if (isReversed) {
        normalized = 1 - normalized;
    }

    const lightness = minLightness + (maxLightness - minLightness) * normalized;

    return `hsl(${hue}, 70%, ${lightness}%)`;
}

function getColorDiverging(minVal, maxVal, currentNumber, highIsBad, countryName) {
    const minHue = activePalette.lowHue;
    const maxHue = activePalette.highHue;

    let normalized = (currentNumber - minVal) / (maxVal - minVal);
    normalized = Math.max(0, Math.min(1, normalized));

    if (highIsBad) {
        normalized = 1 - normalized;
    }

    let hue, saturation, lightness;

    if (normalized < 0.5) {
        const t = normalized / 0.5;
        hue = minHue;
        saturation = 100 * (1 - t);
        lightness = 50 + (50 * t);
    } else {
        const t = (normalized - 0.5) / 0.5;
        hue = maxHue;
        saturation = 100 * t;
        lightness = 100 - (50 * t);
    }

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function formatValue(v) {
    if (v === null || v === undefined) return '';
    const abs = Math.abs(v);
    if (abs >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, '') + 'm';
    if (abs >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(v);
}

function getColorDivergingExp(minVal, maxVal, currentNumber, highIsBad, countryName) {
    // No data — show neutral gray
    if (currentNumber === null || currentNumber === undefined) return '#e0e0e0';
    if (minVal === maxVal) return '#e0e0e0';

    // Monochromatic mode: single hue, vary saturation and lightness
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

    // Light (95% lightness, 30% saturation) → Dark (30% lightness, 100% saturation)
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

// Parse any CSS color (hsl, rgb, hex) into {r, g, b}
function parseColor(str) {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = str;
    const hex = ctx.fillStyle; // browser normalises to #rrggbb
    return hexToRgb(hex);
}

// Relative luminance (WCAG formula)
function relativeLuminance({r, g, b}) {
    const [rs, gs, bs] = [r, g, b].map(c => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Returns 'white' or 'black' for best contrast against bgColor
function contrastTextColor(bgColorStr) {
    const rgb = parseColor(bgColorStr);
    return relativeLuminance(rgb) < 0.4 ? 'white' : 'black';
}

// ============= Polygon Centroid =============

function polygonCentroid(coords) {
    // coords is an array of [lng, lat] pairs (outer ring of the polygon)
    const ring = coords[0]; // outer ring
    let area = 0;
    let cx = 0;
    let cy = 0;
    const n = ring.length;

    for (let i = 0; i < n - 1; i++) {
        const x0 = ring[i][0],   y0 = ring[i][1];
        const x1 = ring[i+1][0], y1 = ring[i+1][1];
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

// ============= Map Factory =============

const FORMAT_REGISTRY = {
    '4x5':  { label: '4:5 Post',        ratio: 'ratio-4x5',  displayW: 480, displayH: 600, exportW: 1080, exportH: 1350, defaultLabelSize: 13 },
    '9x16': { label: '9:16 Story',       ratio: 'ratio-9x16', displayW: 360, displayH: 640, exportW: 1080, exportH: 1920, defaultLabelSize: 8 },
    '1x1':  { label: '1:1 Square',       ratio: 'ratio-1x1',  displayW: 480, displayH: 480, exportW: 1080, exportH: 1080, defaultLabelSize: 13 },
    '16x9': { label: '16:9 Landscape',   ratio: 'ratio-16x9', displayW: 640, displayH: 360, exportW: 1920, exportH: 1080, defaultLabelSize: 11 },
};

const activeFormats = [];  // ['4x5', '9x16', ...]
const formatMaps = {};     // { '4x5': mapInstance, ... }
const formatGeoLayers = {}; // { '4x5': geoLayer, ... }

const maps = [];
const geoJSONLayers = [];

function createMap(containerId) {
    var mapInstance = L.map(containerId, {
        zoomControl: false,
        preferCanvas: true,
        attributionControl: false,
        zoomSnap: 0,
        zoomDelta: 0.5,
    }).setView([45.9432, 24.9668], 6);

    // Add a tile layer (OpenStreetMap) - hidden by default
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    }).addTo(mapInstance);

    // Add GeoJSON layer
    var geoLayer = L.geoJSON(romaniaGeoJSON, {
        style: function (feature) {
            // var color = getColor(0, _maxValue, _data[feature.properties.name], _highIsBad, feature.properties.name);
            // var color = getColorSequential(0, _maxValue, _data[feature.properties.name], _highIsBad, feature.properties.name);
            // var color = getColorDiverging(_minValue, _maxValue, _data[feature.properties.name], _highIsBad, feature.properties.name);
            var color = getColorDivergingExp(_minValue, _maxValue, _data[feature.properties.name], _highIsBad, feature.properties.name);

            return {
                fillColor: color,
                weight: 1,
                opacity: 1,
                color: 'white',
                // dashArray: '3',
                fillOpacity: 1
            };
        },
        onEachFeature: function (feature, layer) {
            var bgColor = getColorDivergingExp(_minValue, _maxValue, _data[feature.properties.name], _highIsBad, feature.properties.name);
            var textColor = feature.properties.name === 'Bucuresti' ? 'black' : contrastTextColor(bgColor);
            var icon = L.divIcon({
                className: 'county-label',
                iconSize: [0, 0],
                iconAnchor: [0, 0],
                html: `<div class="label-inner" data-county="${feature.properties.name}" style="color:${textColor}"><span class="label-code">${getCountyAbbreviation(feature.properties.name)}</span><span class="label-value">${formatValue(_data[feature.properties.name])}</span></div>`
            });

            let coordinates = polygonCentroid(feature.geometry.coordinates);

            // Bucuresti is too small — shift label to the right
            if (feature.properties.name === 'Bucuresti') {
                coordinates = [coordinates[0], coordinates[1] + 0.4];
            }

            if (feature.properties.name === 'Tulcea') {
                coordinates = [coordinates[0], coordinates[1] - 0.4];
            }

            var marker = L.marker(coordinates, {
                icon: icon
            });

            marker.addTo(mapInstance);
        }
    }).addTo(mapInstance);

    // Toggle off OSM tiles
    mapInstance.eachLayer(function (layer) {
        if (layer._url) {
            layer._container.style.display = (layer._container.style.display === 'none') ? '' : 'none';
        }
    });

    // Fit to GeoJSON bounds so the entire map is visible
    mapInstance.fitBounds(geoLayer.getBounds(), { padding: [10, 10] });

    maps.push(mapInstance);
    geoJSONLayers.push(geoLayer);

    return { mapInstance, geoLayer };
}

// Create both initial maps
var { mapInstance: map4x5, geoLayer: geoLayer4x5 } = createMap('map-4x5');
var { mapInstance: map9x16, geoLayer: geoLayer9x16 } = createMap('map-9x16');

formatMaps['4x5'] = map4x5;
formatMaps['9x16'] = map9x16;
formatGeoLayers['4x5'] = geoLayer4x5;
formatGeoLayers['9x16'] = geoLayer9x16;
activeFormats.push('4x5', '9x16');

// Re-fit bounds after containers are laid out
setTimeout(() => {
    for (const fid of activeFormats) {
        const m = formatMaps[fid];
        const gl = formatGeoLayers[fid];
        m.invalidateSize();
        m.fitBounds(gl.getBounds(), { padding: [10, 10] });
        document.getElementById(`zoom-slider-${fid}`).value = m.getZoom();
        document.getElementById(`zoom-value-${fid}`).textContent = m.getZoom().toFixed(1);
    }
}, 200);

// ============= Center Snap (sticky lock during drag) =============

function setupCenterSnap(mapInstance, geoLayer) {
    const geoCenter = geoLayer.getBounds().getCenter();
    const snapPx = 5;
    const breakoutPx = 7;
    let lockedLat = false, lockedLng = false;
    let lockMouseX = 0, lockMouseY = 0;
    let mouseX = 0, mouseY = 0;
    let isDragging = false;
    let correcting = false;

    const container = mapInstance.getContainer();

    container.addEventListener('mousedown', () => { isDragging = true; });

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        if (!isDragging) return;
        if (lockedLat && Math.abs(mouseY - lockMouseY) > breakoutPx) lockedLat = false;
        if (lockedLng && Math.abs(mouseX - lockMouseX) > breakoutPx) lockedLng = false;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        lockedLat = false;
        lockedLng = false;
    });

    mapInstance.on('move', () => {
        if (!isDragging || correcting) return;

        const size = mapInstance.getSize();
        const viewCenter = size.divideBy(2);
        const geoPx = mapInstance.latLngToContainerPoint(geoCenter);

        const dx = geoPx.x - viewCenter.x;
        const dy = geoPx.y - viewCenter.y;

        if (!lockedLat && Math.abs(dy) < snapPx) {
            lockedLat = true;
            lockMouseY = mouseY;
        }
        if (!lockedLng && Math.abs(dx) < snapPx) {
            lockedLng = true;
            lockMouseX = mouseX;
        }

        if (lockedLat || lockedLng) {
            correcting = true;
            const cur = mapInstance.getCenter();
            const newLat = lockedLat ? geoCenter.lat : cur.lat;
            const newLng = lockedLng ? geoCenter.lng : cur.lng;
            mapInstance.setView([newLat, newLng], mapInstance.getZoom(), { animate: false });
            correcting = false;
        }
    });
}

setupCenterSnap(formatMaps['4x5'], formatGeoLayers['4x5']);
setupCenterSnap(formatMaps['9x16'], formatGeoLayers['9x16']);

// ============= Legend =============

function generateLegend(legendId) {
    const legendEl = document.getElementById(legendId);
    if (!legendEl) return;

    const isHorizontal = legendEl.classList.contains('horizontal');
    const steps = 20;
    let gradientStops = [];

    // Generate gradient from max to min
    for (let i = 0; i <= steps; i++) {
        const value = _maxValue - (_maxValue - _minValue) * (i / steps);
        const color = getColorDivergingExp(_minValue, _maxValue, value, _highIsBad);
        const percent = (i / steps) * 100;
        gradientStops.push(`${color} ${percent}%`);
    }

    const gradientDir = isHorizontal ? 'to right' : 'to bottom';
    const maxLabel = isHorizontal ? actualMin : actualMax;
    const minLabel = isHorizontal ? actualMax : actualMin;

    legendEl.innerHTML = `
        <div class="legend-body">
            <div class="legend-gradient" style="background: linear-gradient(${gradientDir}, ${gradientStops.join(', ')})"></div>
            <div class="legend-labels">
                <span>${formatValue(maxLabel)}</span>
                <span>${formatValue(minLabel)}</span>
            </div>
        </div>
    `;
}

function refreshLegends() {
    for (const fid of activeFormats) {
        generateLegend(`legend-${fid}`);
    }
}

refreshLegends();

// ============= Draggable Legends =============

function makeDraggable(el) {
    let offsetX, offsetY, dragging = false;

    el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        dragging = true;
        el.classList.add('dragging');

        const rect = el.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
    });

    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const parent = el.parentElement;
        const parentRect = parent.getBoundingClientRect();

        let x = e.clientX - parentRect.left - offsetX;
        let y = e.clientY - parentRect.top - offsetY;

        // Clamp within parent
        x = Math.max(0, Math.min(x, parentRect.width - el.offsetWidth));
        y = Math.max(0, Math.min(y, parentRect.height - el.offsetHeight));

        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.right = 'auto';
        el.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if (dragging) {
            dragging = false;
            el.classList.remove('dragging');
        }
    });
}

function setupLegend(formatId) {
    const el = document.getElementById(`legend-${formatId}`);
    if (!el) return;
    makeDraggable(el);
    let downX, downY;
    el.addEventListener('mousedown', (e) => { downX = e.clientX; downY = e.clientY; });
    el.addEventListener('mouseup', (e) => {
        if (Math.abs(e.clientX - downX) < 4 && Math.abs(e.clientY - downY) < 4) {
            pushUndo();
            el.classList.toggle('horizontal');
            generateLegend(`legend-${formatId}`);
            markDirty();
        }
    });
}

setupLegend('4x5');
setupLegend('9x16');

// ============= Restyle Maps =============

function restyleMaps() {
    geoJSONLayers.forEach(layer => {
        layer.setStyle(function (feature) {
            var color = getColorDivergingExp(_minValue, _maxValue, _data[feature.properties.name], _highIsBad, feature.properties.name);
            return {
                fillColor: color,
                weight: 1,
                opacity: 1,
                color: 'white',
                fillOpacity: 1
            };
        });
    });
    // Update label text colors for contrast
    document.querySelectorAll('.county-label .label-inner').forEach(labelEl => {
        const code = labelEl.querySelector('.label-code');
        if (!code) return;
        // Find the county name from the abbreviation by matching data
        const abbr = code.textContent;
        const countyName = Object.keys(_data).find(name => getCountyAbbreviation(name) === abbr);
        if (!countyName) return;
        if (countyName === 'Bucuresti') { labelEl.style.color = 'black'; return; }
        const bgColor = getColorDivergingExp(_minValue, _maxValue, _data[countyName], _highIsBad, countyName);
        labelEl.style.color = contrastTextColor(bgColor);
    });
    refreshLegends();
    if (window._refreshDataTable) window._refreshDataTable();
}

// ============= Update Labels (values + contrast) =============

function updateLabels() {
    document.querySelectorAll('.county-label .label-inner').forEach(labelEl => {
        const codeEl = labelEl.querySelector('.label-code');
        const valueEl = labelEl.querySelector('.label-value');
        if (!codeEl || !valueEl) return;

        const abbr = codeEl.textContent;
        const countyName = Object.keys(_data).find(name => getCountyAbbreviation(name) === abbr);
        if (!countyName) return;

        const val = _data[countyName];
        valueEl.textContent = formatValue(val);

        const bgColor = getColorDivergingExp(_minValue, _maxValue, _data[countyName], _highIsBad, countyName);
        labelEl.style.color = contrastTextColor(bgColor);
    });
}

// ============= Apply Config (from AI — handles data, palette, normalization, text, etc.) =============

function applyConfig(parsed) {
    pushUndo();

    // Data updates
    if (parsed.data) {
        if (parsed.replaceAllData) {
            _data = parsed.data;
        } else {
            // Merge: only update specified counties
            Object.assign(_data, parsed.data);
        }
    }
    if (parsed.minValue !== undefined) _minValue = parsed.minValue;
    if (parsed.maxValue !== undefined) _maxValue = parsed.maxValue;
    if (parsed.highIsBad !== undefined) _highIsBad = parsed.highIsBad;

    // Palette updates
    if (parsed.palette !== undefined) {
        const paletteMap = { red: 0, blue: 1, green: 2, orange: 3, purple: 4 };
        const idx = paletteMap[parsed.palette];
        if (idx !== undefined) {
            activePalette = palettes[idx];
            document.querySelectorAll('.palette-option').forEach(o => {
                o.classList.toggle('active', parseInt(o.dataset.paletteIdx) === idx);
            });
        } else {
            // Custom hue (number)
            const hue = parseInt(parsed.palette);
            if (!isNaN(hue)) {
                activePalette = { hue, id: 'custom', name: 'Custom' };
                document.querySelectorAll('.palette-option').forEach(o => o.classList.remove('active'));
                document.getElementById('custom-hue').value = hue;
                updateHuePreview(hue);
            }
        }
    }

    if (parsed.paletteReversed !== undefined) {
        paletteReversed = parsed.paletteReversed;
        document.getElementById('btn-reverse-palette').classList.toggle('active', paletteReversed);
    }

    // Normalization
    if (parsed.normalization) {
        normalizationMode = parsed.normalization;
        document.querySelectorAll('#norm-btn-group .norm-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.norm === normalizationMode);
        });
        updateNormHint();
    }

    // Recompute actual min/max and auto-set scale when AI didn't specify
    const vals = Object.values(_data).filter(v => typeof v === 'number');
    if (vals.length > 0) {
        actualMin = Math.min(...vals);
        actualMax = Math.max(...vals);
        if (parsed.minValue === undefined) _minValue = actualMin;
        if (parsed.maxValue === undefined) _maxValue = actualMax;
    }

    updateLabels();
    restyleMaps();

    // Text updates
    if (parsed.title) {
        document.querySelectorAll('[data-sync="title"]').forEach(el => {
            el.textContent = parsed.title;
        });
    }
    if (parsed.subtitle) {
        document.querySelectorAll('[data-sync="subtitle"]').forEach(el => {
            el.textContent = parsed.subtitle;
        });
    }
    if (parsed.source) {
        document.querySelectorAll('[data-sync="footer"]').forEach(el => {
            el.textContent = 'Sursa: ' + parsed.source;
        });
    }
    markDirty();
}

// ============= Tab Switching =============

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// ============= Per-format controls =============

function setupFormatControls(suffix, mapContainer, mapInstance) {
    // Toggle county code
    document.getElementById(`toggle-code-${suffix}`).addEventListener('change', (e) => {
        pushUndo();
        mapContainer.querySelectorAll('.label-code').forEach(el => {
            el.style.display = e.target.checked ? '' : 'none';
        });
        markDirty();
    });

    // Toggle value
    document.getElementById(`toggle-value-${suffix}`).addEventListener('change', (e) => {
        pushUndo();
        mapContainer.querySelectorAll('.label-value').forEach(el => {
            el.style.display = e.target.checked ? '' : 'none';
        });
        markDirty();
    });

    // Zoom slider
    const zoomSlider = document.getElementById(`zoom-slider-${suffix}`);
    const zoomValueEl = document.getElementById(`zoom-value-${suffix}`);

    zoomSlider.addEventListener('input', (e) => {
        const zoom = parseFloat(e.target.value);
        zoomValueEl.textContent = zoom.toFixed(1);
        mapInstance.setZoom(zoom);
    });

    mapInstance.on('zoomend', () => {
        const z = mapInstance.getZoom();
        zoomSlider.value = z;
        zoomValueEl.textContent = z.toFixed(1);
    });

    // Label size slider
    const sizeSlider = document.getElementById(`label-size-${suffix}`);
    const sizeValueEl = document.getElementById(`label-size-value-${suffix}`);

    sizeSlider.addEventListener('mousedown', () => { pushUndo(); });
    sizeSlider.addEventListener('input', (e) => {
        const size = parseInt(e.target.value);
        sizeValueEl.textContent = size + 'px';
        mapContainer.querySelectorAll('.label-inner').forEach(label => {
            label.style.fontSize = size + 'px';
        });
        markDirty();
    });

}

setupFormatControls('4x5', document.getElementById('capture-4x5'), formatMaps['4x5']);
setupFormatControls('9x16', document.getElementById('capture-9x16'), formatMaps['9x16']);

// Apply default 8px label size for 9:16
document.getElementById('capture-9x16').querySelectorAll('.label-inner').forEach(label => {
    label.style.fontSize = '8px';
});

// ============= Auto Align Buttons =============

function autoAlign(mapInstance, geoLayer, suffix) {
    mapInstance.invalidateSize();
    const bounds = geoLayer.getBounds();
    const center = bounds.getCenter();
    mapInstance.fitBounds(bounds, { padding: [10, 10] });
    // Re-center precisely after fitBounds determines the zoom
    mapInstance.setView(center, mapInstance.getZoom());
    const z = mapInstance.getZoom();
    document.getElementById(`zoom-slider-${suffix}`).value = z;
    document.getElementById(`zoom-value-${suffix}`).textContent = z.toFixed(1);
}

function setupAutoAlign(formatId) {
    const btn = document.getElementById(`auto-align-${formatId}`);
    if (btn) btn.addEventListener('click', () => {
        autoAlign(formatMaps[formatId], formatGeoLayers[formatId], formatId);
    });
}

setupAutoAlign('4x5');
setupAutoAlign('9x16');

// ============= Palette Picker =============

function buildPaletteUI() {
    const grid = document.getElementById('palette-grid');
    grid.innerHTML = '';

    palettes.forEach((p, idx) => {
        const el = document.createElement('div');
        el.className = 'palette-option' + (idx === 0 ? ' active' : '');
        el.dataset.paletteIdx = idx;

        // Monochromatic swatch: light → dark of a single hue
        const lightColor = `hsl(${p.hue}, 30%, 95%)`;
        const midColor = `hsl(${p.hue}, 65%, 60%)`;
        const darkColor = `hsl(${p.hue}, 100%, 30%)`;

        el.innerHTML = `
            <div class="palette-swatch" style="background: linear-gradient(to right, ${lightColor}, ${midColor}, ${darkColor})"></div>
            <span class="palette-name">${p.name}</span>
        `;

        el.addEventListener('click', () => {
            pushUndo();
            activePalette = palettes[idx];
            grid.querySelectorAll('.palette-option').forEach(o => o.classList.remove('active'));
            el.classList.add('active');
            restyleMaps();
            markDirty();
        });

        grid.appendChild(el);
    });
}

buildPaletteUI();

// ============= Reverse Palette Button =============

document.getElementById('btn-reverse-palette').addEventListener('click', () => {
    pushUndo();
    paletteReversed = !paletteReversed;
    document.getElementById('btn-reverse-palette').classList.toggle('active', paletteReversed);
    restyleMaps();
    markDirty();
});

// ============= Custom Hue Slider =============

const hueSlider = document.getElementById('custom-hue');
const huePreview = document.getElementById('hue-preview');

function updateHuePreview(hue) {
    const light = `hsl(${hue}, 30%, 95%)`;
    const mid = `hsl(${hue}, 65%, 60%)`;
    const dark = `hsl(${hue}, 100%, 30%)`;
    huePreview.style.background = `linear-gradient(to right, ${light}, ${mid}, ${dark})`;
}

updateHuePreview(0);

hueSlider.addEventListener('input', (e) => {
    const hue = parseInt(e.target.value);
    updateHuePreview(hue);
    activePalette = { hue, id: 'custom', name: 'Custom' };
    document.querySelectorAll('.palette-option').forEach(o => o.classList.remove('active'));
    restyleMaps();
    markDirty();
});

// Push undo on hue slider commit (not every input tick)
hueSlider.addEventListener('mousedown', () => { pushUndo(); });

// ============= Normalization Buttons =============

const NORM_HINTS = {
    none: 'Linear scale \u2014 values mapped as-is',
    logarithmic: 'Compresses large values \u2014 highlights smaller differences',
    exponential: 'Amplifies large values \u2014 highlights bigger differences'
};

function updateNormHint() {
    document.getElementById('norm-hint').textContent = NORM_HINTS[normalizationMode] || '';
}

document.querySelectorAll('#norm-btn-group .norm-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        pushUndo();
        normalizationMode = btn.dataset.norm;
        document.querySelectorAll('#norm-btn-group .norm-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateNormHint();
        restyleMaps();
        markDirty();
    });
});

// ============= Watermark / Branding =============

let watermarkDataUrl = null;
let watermarkOpacity = 1;

function placeWatermarks() {
    // Remove existing watermarks
    document.querySelectorAll('.watermark-wrap').forEach(el => el.remove());
    if (!watermarkDataUrl) return;

    document.querySelectorAll('.map-wrapper').forEach(wrapper => {
        const wrap = document.createElement('div');
        wrap.className = 'watermark-wrap';

        const img = document.createElement('img');
        img.className = 'watermark-img';
        img.src = watermarkDataUrl;
        img.style.opacity = watermarkOpacity;
        img.draggable = false;

        const handle = document.createElement('div');
        handle.className = 'watermark-resize';

        wrap.appendChild(img);
        wrap.appendChild(handle);
        wrapper.appendChild(wrap);
        makeDraggable(wrap);
        makeWatermarkResizable(handle, img);
    });
}

function makeWatermarkResizable(handle, img) {
    let startX, startWidth, undoPushed;

    handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!undoPushed) { pushUndo(); undoPushed = true; }
        startX = e.clientX;
        startWidth = img.offsetWidth;
        handle.classList.add('resizing');

        const onMove = (ev) => {
            const newWidth = Math.max(24, startWidth + ev.clientX - startX);
            img.style.width = newWidth + 'px';
        };

        const onUp = () => {
            handle.classList.remove('resizing');
            undoPushed = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            markDirty();
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
}

function getWatermarkPositions() {
    const positions = [];
    document.querySelectorAll('.watermark-wrap').forEach(wrap => {
        const img = wrap.querySelector('.watermark-img');
        positions.push({
            left: wrap.style.left || '',
            top: wrap.style.top || '',
            width: img ? img.style.width || '' : ''
        });
    });
    return positions;
}

function restoreWatermark(watermarkData) {
    if (!watermarkData || !watermarkData.dataUrl) {
        clearWatermark();
        return;
    }
    watermarkDataUrl = watermarkData.dataUrl;
    watermarkOpacity = watermarkData.opacity !== undefined ? watermarkData.opacity : 1;
    placeWatermarks();

    // Restore positions and sizes
    if (watermarkData.positions) {
        const wraps = document.querySelectorAll('.watermark-wrap');
        watermarkData.positions.forEach((pos, i) => {
            if (wraps[i]) {
                if (pos.left) { wraps[i].style.left = pos.left; }
                if (pos.top) { wraps[i].style.top = pos.top; }
                wraps[i].style.right = 'auto';
                const img = wraps[i].querySelector('.watermark-img');
                if (img && pos.width) { img.style.width = pos.width; }
            }
        });
    }

    // Update UI
    document.getElementById('watermark-opacity').value = Math.round(watermarkOpacity * 100);
    document.getElementById('watermark-opacity-value').textContent = Math.round(watermarkOpacity * 100) + '%';
    document.getElementById('btn-upload-watermark').style.display = 'none';
    document.getElementById('btn-remove-watermark').style.display = '';
    document.getElementById('watermark-opacity-group').style.display = '';
    document.getElementById('watermark-opacity-group').classList.add('watermark-opacity-group');
}

function clearWatermark() {
    watermarkDataUrl = null;
    watermarkOpacity = 1;
    document.querySelectorAll('.watermark-wrap').forEach(el => el.remove());
    document.getElementById('watermark-opacity').value = 100;
    document.getElementById('watermark-opacity-value').textContent = '100%';
    document.getElementById('btn-upload-watermark').style.display = '';
    document.getElementById('btn-remove-watermark').style.display = 'none';
    document.getElementById('watermark-opacity-group').style.display = 'none';
}

// Upload button triggers file input
document.getElementById('btn-upload-watermark').addEventListener('click', () => {
    document.getElementById('watermark-file-input').click();
});

// File input handler
document.getElementById('watermark-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    pushUndo();
    const reader = new FileReader();
    reader.onload = (ev) => {
        watermarkDataUrl = ev.target.result;
        placeWatermarks();
        document.getElementById('btn-upload-watermark').style.display = 'none';
        document.getElementById('btn-remove-watermark').style.display = '';
        document.getElementById('watermark-opacity-group').style.display = '';
        document.getElementById('watermark-opacity-group').classList.add('watermark-opacity-group');
        markDirty();
    };
    reader.readAsDataURL(file);
    // Reset so re-uploading the same file triggers change
    e.target.value = '';
});

// Opacity slider
document.getElementById('watermark-opacity').addEventListener('input', (e) => {
    watermarkOpacity = parseInt(e.target.value) / 100;
    document.getElementById('watermark-opacity-value').textContent = e.target.value + '%';
    document.querySelectorAll('.watermark-img').forEach(img => {
        img.style.opacity = watermarkOpacity;
    });
});

document.getElementById('watermark-opacity').addEventListener('mousedown', () => { pushUndo(); });

document.getElementById('watermark-opacity').addEventListener('change', () => { markDirty(); });

// Remove button
document.getElementById('btn-remove-watermark').addEventListener('click', () => {
    pushUndo();
    clearWatermark();
    markDirty();
});

// ============= Dirty State Tracking =============

function markDirty() {
    document.getElementById('btn-save-config').classList.add('dirty');
}

function clearDirty() {
    document.getElementById('btn-save-config').classList.remove('dirty');
}

// ============= Undo / Redo System =============

let undoStack = [];
let redoStack = [];
const MAX_UNDO = 50;

function captureSnapshot() {
    const titleEl = document.querySelector('[data-sync="title"]');
    const subtitleEl = document.querySelector('[data-sync="subtitle"]');
    const footerEl = document.querySelector('[data-sync="footer"]');

    const mapState = {};
    const display = {};
    const legendOrient = {};
    for (const fid of activeFormats) {
        const m = formatMaps[fid];
        mapState[fid] = { center: { lat: m.getCenter().lat, lng: m.getCenter().lng }, zoom: m.getZoom() };
        display[fid] = {
            showCode: document.getElementById(`toggle-code-${fid}`).checked,
            showValue: document.getElementById(`toggle-value-${fid}`).checked,
            labelSize: document.getElementById(`label-size-${fid}`).value,
        };
        legendOrient[fid] = document.getElementById(`legend-${fid}`).classList.contains('horizontal') ? 'horizontal' : 'vertical';
    }

    return {
        data: { ..._data },
        minValue: _minValue,
        maxValue: _maxValue,
        highIsBad: _highIsBad,
        activePalette: { ...activePalette },
        paletteReversed,
        normalizationMode,
        activeFormats: [...activeFormats],
        text: {
            title: { innerHTML: titleEl.innerHTML, textAlign: titleEl.style.textAlign || '', top: titleEl.style.top || '' },
            subtitle: { innerHTML: subtitleEl.innerHTML, textAlign: subtitleEl.style.textAlign || '', top: subtitleEl.style.top || '' },
            footer: { innerHTML: footerEl.innerHTML, textAlign: footerEl.style.textAlign || '', top: footerEl.style.top || '' },
        },
        mapState,
        display,
        watermark: {
            dataUrl: watermarkDataUrl,
            opacity: watermarkOpacity,
            positions: getWatermarkPositions()
        },
        legendOrientation: legendOrient
    };
}

function restoreSnapshot(snap) {
    _data = { ...snap.data };
    _minValue = snap.minValue;
    _maxValue = snap.maxValue;
    _highIsBad = snap.highIsBad;

    const vals = Object.values(_data).filter(v => typeof v === 'number');
    actualMin = Math.min(...vals);
    actualMax = Math.max(...vals);

    activePalette = { ...snap.activePalette };
    paletteReversed = snap.paletteReversed;
    normalizationMode = snap.normalizationMode;

    // Update palette UI
    document.querySelectorAll('.palette-option').forEach(o => {
        o.classList.toggle('active', palettes[o.dataset.paletteIdx]?.id === activePalette.id);
    });
    if (activePalette.id === 'custom') {
        document.getElementById('custom-hue').value = activePalette.hue;
        updateHuePreview(activePalette.hue);
    }
    document.getElementById('btn-reverse-palette').classList.toggle('active', paletteReversed);
    document.querySelectorAll('#norm-btn-group .norm-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.norm === normalizationMode);
    });
    updateNormHint();

    // Restore text
    ['title', 'subtitle', 'footer'].forEach(key => {
        const saved = snap.text[key];
        if (!saved) return;
        document.querySelectorAll(`[data-sync="${key}"]`).forEach(el => {
            el.innerHTML = saved.innerHTML;
            if (saved.textAlign) el.style.textAlign = saved.textAlign;
            el.style.top = saved.top || '';
        });
    });

    // Reconcile active formats
    const targetFormats = snap.activeFormats || ['4x5', '9x16'];
    // Add formats that should be present but aren't (add first to avoid last-format guard)
    targetFormats.forEach(fid => {
        if (!activeFormats.includes(fid)) addFormat(fid);
    });
    // Remove formats that shouldn't be present
    [...activeFormats].forEach(fid => {
        if (!targetFormats.includes(fid)) removeFormat(fid);
    });

    // Restore map state
    if (snap.mapState) {
        _restoringSnapshot = true;
        for (const fid of activeFormats) {
            const s = snap.mapState[fid] || snap.mapState['map' + fid];
            if (!s) continue;
            const m = formatMaps[fid];
            m.setView([s.center.lat, s.center.lng], s.zoom, { animate: false });
            document.getElementById(`zoom-slider-${fid}`).value = s.zoom;
            document.getElementById(`zoom-value-${fid}`).textContent = s.zoom.toFixed(1);
        }
        _restoringSnapshot = false;
    }

    // Restore display settings per format
    if (snap.display) {
        activeFormats.forEach(suffix => {
            const d = snap.display[suffix];
            if (!d) return;
            const container = document.getElementById(`capture-${suffix}`);

            const codeToggle = document.getElementById(`toggle-code-${suffix}`);
            codeToggle.checked = d.showCode;
            container.querySelectorAll('.label-code').forEach(el => {
                el.style.display = d.showCode ? '' : 'none';
            });

            const valueToggle = document.getElementById(`toggle-value-${suffix}`);
            valueToggle.checked = d.showValue;
            container.querySelectorAll('.label-value').forEach(el => {
                el.style.display = d.showValue ? '' : 'none';
            });

            const sizeSlider = document.getElementById(`label-size-${suffix}`);
            sizeSlider.value = d.labelSize;
            document.getElementById(`label-size-value-${suffix}`).textContent = d.labelSize + 'px';
            container.querySelectorAll('.label-inner').forEach(label => {
                label.style.fontSize = d.labelSize + 'px';
            });
        });
    }

    // Restore watermark
    restoreWatermark(snap.watermark);

    // Restore legend orientation
    if (snap.legendOrientation) {
        activeFormats.forEach(suffix => {
            const el = document.getElementById(`legend-${suffix}`);
            if (el) el.classList.toggle('horizontal', snap.legendOrientation[suffix] === 'horizontal');
        });
    }

    updateLabels();
    restyleMaps();
}

function updateUndoRedoButtons() {
    document.getElementById('btn-undo').disabled = undoStack.length === 0;
    document.getElementById('btn-redo').disabled = redoStack.length === 0;
}

function pushUndo() {
    undoStack.push(captureSnapshot());
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
    updateUndoRedoButtons();
}

function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(captureSnapshot());
    restoreSnapshot(undoStack.pop());
    updateUndoRedoButtons();
    markDirty();
}

function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(captureSnapshot());
    restoreSnapshot(redoStack.pop());
    updateUndoRedoButtons();
    markDirty();
}

// Wire undo/redo buttons
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-redo').addEventListener('click', redo);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
    }
});

// ============= Save / Load Configurations =============

let _configsCache = null;

async function fetchConfigs() {
    const res = await fetch(`/api/configs?user_id=${USER_ID}`);
    if (!res.ok) throw new Error('Failed to fetch configs');
    _configsCache = await res.json();
    return _configsCache;
}

function getCachedConfigs() {
    return _configsCache || [];
}

async function createConfig(name, versions) {
    const res = await fetch('/api/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: USER_ID, name, versions })
    });
    if (!res.ok) throw new Error('Failed to create config');
    const created = await res.json();
    _configsCache = [created, ...getCachedConfigs()];
    return created;
}

async function updateConfig(id, name, versions) {
    const res = await fetch(`/api/configs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: USER_ID, name, versions })
    });
    if (!res.ok) throw new Error('Failed to update config');
    const updated = await res.json();
    _configsCache = getCachedConfigs().map(c => c.id === id ? updated : c);
    return updated;
}

async function deleteConfigFromDb(id) {
    const res = await fetch(`/api/configs/${id}?user_id=${USER_ID}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete config');
    _configsCache = getCachedConfigs().filter(c => c.id !== id);
}

async function migrateLocalStorageIfNeeded() {
    const raw = localStorage.getItem('map-saved-configs');
    if (!raw) return;
    try {
        let configs = JSON.parse(raw);
        if (!Array.isArray(configs) || configs.length === 0) return;
        // Handle old flat format
        if (configs.length > 0 && !configs[0].versions) {
            const grouped = [];
            configs.forEach(c => {
                const existing = grouped.find(g => g.name === c.name);
                const ver = { version: 1, savedAt: c.savedAt, data: c.data, minValue: c.minValue, maxValue: c.maxValue, highIsBad: c.highIsBad, activePalette: c.activePalette, paletteReversed: c.paletteReversed, normalizationMode: c.normalizationMode, text: c.text };
                if (existing) {
                    ver.version = existing.versions.length + 1;
                    existing.versions.push(ver);
                } else {
                    grouped.push({ id: c.id, name: c.name, versions: [ver] });
                }
            });
            configs = grouped;
        }
        for (const config of configs) {
            await createConfig(config.name, config.versions);
        }
        localStorage.removeItem('map-saved-configs');
    } catch (err) {
        console.error('localStorage migration failed:', err);
    }
}

function buildVersionData() {
    const titleEl = document.querySelector('[data-sync="title"]');
    const subtitleEl = document.querySelector('[data-sync="subtitle"]');
    const footerEl = document.querySelector('[data-sync="footer"]');

    const mapState = {};
    const display = {};
    const legendOrient = {};
    for (const fid of activeFormats) {
        const m = formatMaps[fid];
        mapState[fid] = { center: m.getCenter(), zoom: m.getZoom() };
        display[fid] = {
            showCode: document.getElementById(`toggle-code-${fid}`).checked,
            showValue: document.getElementById(`toggle-value-${fid}`).checked,
            labelSize: document.getElementById(`label-size-${fid}`).value,
        };
        legendOrient[fid] = document.getElementById(`legend-${fid}`).classList.contains('horizontal') ? 'horizontal' : 'vertical';
    }

    return {
        savedAt: new Date().toISOString(),
        data: { ..._data },
        minValue: _minValue,
        maxValue: _maxValue,
        highIsBad: _highIsBad,
        activePalette: { ...activePalette },
        paletteReversed,
        normalizationMode,
        activeFormats: [...activeFormats],
        text: {
            title: { innerHTML: titleEl.innerHTML, textAlign: titleEl.style.textAlign || '', top: titleEl.style.top || '' },
            subtitle: { innerHTML: subtitleEl.innerHTML, textAlign: subtitleEl.style.textAlign || '', top: subtitleEl.style.top || '' },
            footer: { innerHTML: footerEl.innerHTML, textAlign: footerEl.style.textAlign || '', top: footerEl.style.top || '' },
        },
        mapState,
        display,
        watermark: {
            dataUrl: watermarkDataUrl,
            opacity: watermarkOpacity,
            positions: getWatermarkPositions()
        },
        legendOrientation: legendOrient
    };
}

async function saveConfig() {
    const titleEl = document.querySelector('[data-sync="title"]');
    const name = (titleEl.textContent || '').trim() || 'Untitled';
    const configs = getCachedConfigs();

    const existing = configs.find(c => c.name === name);
    const versionData = buildVersionData();

    try {
        if (existing) {
            versionData.version = existing.versions.length + 1;
            existing.versions.push(versionData);
            await updateConfig(existing.id, existing.name, existing.versions);
        } else {
            versionData.version = 1;
            await createConfig(name, [versionData]);
        }
        renderSavedList();
        clearDirty();
    } catch (err) {
        console.error('Save failed:', err);
    }
}

function loadVersion(versionData) {
    _data = versionData.data;
    _minValue = versionData.minValue;
    _maxValue = versionData.maxValue;
    _highIsBad = versionData.highIsBad;

    const vals = Object.values(_data).filter(v => typeof v === 'number');
    actualMin = Math.min(...vals);
    actualMax = Math.max(...vals);

    activePalette = versionData.activePalette;
    paletteReversed = versionData.paletteReversed;
    normalizationMode = versionData.normalizationMode || 'none';

    // Update palette UI
    document.querySelectorAll('.palette-option').forEach(o => {
        o.classList.toggle('active', palettes[o.dataset.paletteIdx]?.id === activePalette.id);
    });
    if (activePalette.id === 'custom') {
        document.getElementById('custom-hue').value = activePalette.hue;
        updateHuePreview(activePalette.hue);
    }

    document.getElementById('btn-reverse-palette').classList.toggle('active', paletteReversed);

    document.querySelectorAll('#norm-btn-group .norm-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.norm === normalizationMode);
    });
    updateNormHint();

    if (versionData.text) {
        ['title', 'subtitle', 'footer'].forEach(key => {
            const saved = versionData.text[key];
            if (!saved) return;
            document.querySelectorAll(`[data-sync="${key}"]`).forEach(el => {
                el.innerHTML = saved.innerHTML;
                if (saved.textAlign) el.style.textAlign = saved.textAlign;
                el.style.top = saved.top || '';
            });
        });
    }

    // Reconcile active formats
    const targetFormats = versionData.activeFormats || ['4x5', '9x16'];
    // Add formats that should be present but aren't (add first to avoid last-format guard)
    targetFormats.forEach(fid => {
        if (!activeFormats.includes(fid)) addFormat(fid);
    });
    // Remove formats that shouldn't be present
    [...activeFormats].forEach(fid => {
        if (!targetFormats.includes(fid)) removeFormat(fid);
    });

    if (versionData.mapState) {
        _restoringSnapshot = true;
        for (const fid of activeFormats) {
            const s = versionData.mapState[fid] || versionData.mapState['map' + fid];
            if (!s) continue;
            const m = formatMaps[fid];
            m.setView([s.center.lat, s.center.lng], s.zoom, { animate: false });
            document.getElementById(`zoom-slider-${fid}`).value = s.zoom;
            document.getElementById(`zoom-value-${fid}`).textContent = s.zoom.toFixed(1);
        }
        _restoringSnapshot = false;
    }

    // Restore display settings
    if (versionData.display) {
        activeFormats.forEach(suffix => {
            const d = versionData.display[suffix];
            if (!d) return;
            const container = document.getElementById(`capture-${suffix}`);

            const codeToggle = document.getElementById(`toggle-code-${suffix}`);
            codeToggle.checked = d.showCode;
            container.querySelectorAll('.label-code').forEach(el => {
                el.style.display = d.showCode ? '' : 'none';
            });

            const valueToggle = document.getElementById(`toggle-value-${suffix}`);
            valueToggle.checked = d.showValue;
            container.querySelectorAll('.label-value').forEach(el => {
                el.style.display = d.showValue ? '' : 'none';
            });

            const sizeSlider = document.getElementById(`label-size-${suffix}`);
            sizeSlider.value = d.labelSize;
            document.getElementById(`label-size-value-${suffix}`).textContent = d.labelSize + 'px';
            container.querySelectorAll('.label-inner').forEach(label => {
                label.style.fontSize = d.labelSize + 'px';
            });
        });
    }

    // Restore watermark
    restoreWatermark(versionData.watermark);

    // Restore legend orientation
    if (versionData.legendOrientation) {
        activeFormats.forEach(suffix => {
            const el = document.getElementById(`legend-${suffix}`);
            if (el) el.classList.toggle('horizontal', versionData.legendOrientation[suffix] === 'horizontal');
        });
    }

    updateLabels();
    restyleMaps();
    clearDirty();

    closeSavedPanel();
}

async function deleteConfig(id) {
    try {
        await deleteConfigFromDb(id);
        renderSavedList();
    } catch (err) {
        console.error('Delete failed:', err);
    }
}

async function deleteVersion(configId, version) {
    const configs = getCachedConfigs();
    const group = configs.find(c => c.id === configId);
    if (!group) return;
    group.versions = group.versions.filter(v => v.version !== version);
    try {
        if (group.versions.length === 0) {
            await deleteConfigFromDb(configId);
        } else {
            await updateConfig(configId, group.name, group.versions);
        }
        renderSavedList();
    } catch (err) {
        console.error('Delete version failed:', err);
    }
}

function formatDate(iso) {
    return new Date(iso).toLocaleDateString('ro-RO', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function renderSavedList() {
    const list = document.getElementById('saved-list');
    const configs = getCachedConfigs();

    if (configs.length === 0) {
        list.innerHTML = '<div class="saved-list-empty">No saved statistics yet</div>';
        return;
    }

    list.innerHTML = configs.map(c => {
        const latest = c.versions[c.versions.length - 1];
        const vCount = c.versions.length;
        const versionsHtml = c.versions.slice().reverse().map(v =>
            `<div class="saved-version" data-config-id="${c.id}" data-version="${v.version}">
                <span class="saved-version-label">v${v.version}</span>
                <span class="saved-version-date">${formatDate(v.savedAt)}</span>
                <button class="saved-version-delete" data-config-id="${c.id}" data-version="${v.version}" title="Delete version">&times;</button>
            </div>`
        ).join('');

        return `<div class="saved-group" data-id="${c.id}">
            <div class="saved-item" data-id="${c.id}">
                <div class="saved-item-info">
                    <div class="saved-item-name">${c.name}</div>
                    <div class="saved-item-date">${formatDate(latest.savedAt)}</div>
                </div>
                ${vCount > 1 ? `<span class="saved-item-badge">v${vCount}</span>` : ''}
                <button class="saved-item-delete" data-id="${c.id}" title="Delete all">&times;</button>
            </div>
            ${vCount > 1 ? `<div class="saved-versions" data-id="${c.id}">${versionsHtml}</div>` : ''}
        </div>`;
    }).join('');

    // Wire events
    list.querySelectorAll('.saved-item').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.saved-item-delete')) return;
            const id = parseInt(el.dataset.id);
            const group = configs.find(c => c.id === id);
            if (!group) return;
            // If multiple versions, toggle expand; otherwise load latest
            const versionsEl = list.querySelector(`.saved-versions[data-id="${id}"]`);
            if (versionsEl) {
                versionsEl.classList.toggle('open');
            } else {
                loadVersion(group.versions[group.versions.length - 1]);
            }
        });
    });

    list.querySelectorAll('.saved-item-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteConfig(parseInt(btn.dataset.id));
        });
    });

    list.querySelectorAll('.saved-version').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.saved-version-delete')) return;
            const configId = parseInt(el.dataset.configId);
            const version = parseInt(el.dataset.version);
            const group = configs.find(c => c.id === configId);
            if (!group) return;
            const ver = group.versions.find(v => v.version === version);
            if (ver) loadVersion(ver);
        });
    });

    list.querySelectorAll('.saved-version-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteVersion(parseInt(btn.dataset.configId), parseInt(btn.dataset.version));
        });
    });
}

// Save button
document.getElementById('btn-save-config').addEventListener('click', saveConfig);

// Panel toggle
const ICON_HISTORY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>';
const ICON_CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

function openSavedPanel() {
    document.getElementById('saved-panel').classList.add('open');
    document.getElementById('saved-toggle-btn').innerHTML = ICON_CLOSE;
    document.getElementById('saved-toggle-btn').title = 'Close';
}

function closeSavedPanel() {
    document.getElementById('saved-panel').classList.remove('open');
    document.getElementById('saved-toggle-btn').innerHTML = ICON_HISTORY;
    document.getElementById('saved-toggle-btn').title = 'History';
}

document.getElementById('saved-toggle-btn').addEventListener('click', () => {
    const isOpen = document.getElementById('saved-panel').classList.contains('open');
    if (isOpen) {
        closeSavedPanel();
    } else {
        openSavedPanel();
    }
});
document.getElementById('saved-panel-close').addEventListener('click', closeSavedPanel);

// Datasets panel toggle
const ICON_DATABASE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/></svg>';

function openDatasetsPanel() {
    document.getElementById('datasets-panel').classList.add('open');
    document.getElementById('datasets-toggle-btn').innerHTML = ICON_CLOSE;
    document.getElementById('datasets-toggle-btn').title = 'Close';
}

function closeDatasetsPanel() {
    document.getElementById('datasets-panel').classList.remove('open');
    document.getElementById('datasets-toggle-btn').innerHTML = ICON_DATABASE;
    document.getElementById('datasets-toggle-btn').title = 'Datasets';
}

document.getElementById('datasets-toggle-btn').addEventListener('click', () => {
    const isOpen = document.getElementById('datasets-panel').classList.contains('open');
    if (isOpen) closeDatasetsPanel(); else openDatasetsPanel();
});
document.getElementById('datasets-panel-close').addEventListener('click', closeDatasetsPanel);

// Populate datasets list
const datasetsList = document.getElementById('datasets-list');
preloadedDatasets.forEach(ds => {
    const item = document.createElement('div');
    item.className = 'datasets-item';
    item.innerHTML = `<div><div class="datasets-item-name">${ds.name}</div><div class="datasets-item-source">${ds.config.source}</div></div>`;
    item.addEventListener('click', () => {
        loadVersion(ds.config);
        closeDatasetsPanel();
    });
    datasetsList.appendChild(item);
});

// Fetch configs from DB and auto-load last saved config (or shared config)
async function loadLastSaved() {
    await migrateLocalStorageIfNeeded();
    const configs = await fetchConfigs();
    renderSavedList();
    if (configs.length === 0) return;
    const latest = configs[0]; // most recent group (ordered by updated_at DESC)
    const latestVersion = latest.versions[latest.versions.length - 1];
    if (latestVersion) {
        setTimeout(() => {
            loadVersion(latestVersion);
            undoStack = [];
            redoStack = [];
            updateUndoRedoButtons();
            clearDirty();
        }, 300);
    }
}

(async function autoLoadLast() {
    try {
        await loadLastSaved();
    } catch (err) {
        console.error('Auto-load failed:', err);
        renderSavedList();
    }
})();

// ============= Sync Editable Text =============

document.querySelectorAll('[data-sync]').forEach(el => {
    // Push undo when user starts editing (on focus)
    el.addEventListener('focus', () => { pushUndo(); }, { once: false });
    let _lastFocusSnapshot = null;
    el.addEventListener('focus', () => { _lastFocusSnapshot = el.innerHTML; });
    // Only push if content actually changed (avoid duplicate snapshots)
    el.addEventListener('focusout', () => {
        if (_lastFocusSnapshot !== null && el.innerHTML === _lastFocusSnapshot) {
            // No real change — pop the undo we pushed on focus
            undoStack.pop();
            updateUndoRedoButtons();
        }
        _lastFocusSnapshot = null;
    });
    el.addEventListener('input', () => {
        const syncKey = el.dataset.sync;
        document.querySelectorAll(`[data-sync="${syncKey}"]`).forEach(other => {
            if (other !== el) {
                other.innerHTML = el.innerHTML;
            }
        });
        markDirty();
    });
});

// ============= No-data guard =============

function hasData() {
    return Object.values(_data).some(v => v !== 0);
}

function showNoDataPopup(anchorBtn) {
    // Remove any existing popup
    const existing = document.getElementById('no-data-popup');
    if (existing) existing.remove();

    const popup = document.createElement('div');
    popup.id = 'no-data-popup';
    popup.innerHTML = `
        <span>No data loaded yet. Use the <strong>AI Assistant</strong> button to add your data.</span>
        <button id="no-data-popup-close">&times;</button>
    `;
    document.body.appendChild(popup);

    // Position above the button
    const rect = anchorBtn.getBoundingClientRect();
    popup.style.left = rect.left + rect.width / 2 + 'px';
    popup.style.top = rect.top - 12 + 'px';

    requestAnimationFrame(() => popup.classList.add('visible'));

    const dismiss = () => { popup.classList.remove('visible'); setTimeout(() => popup.remove(), 200); };
    document.getElementById('no-data-popup-close').addEventListener('click', dismiss);
    setTimeout(dismiss, 4000);
}

// ============= Download Functions =============

async function downloadCapture(captureId, width, height, filename, btnId) {
    const btn = document.getElementById(btnId);
    document.activeElement.blur();

    const captureArea = document.getElementById(captureId);

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

        const link = document.createElement('a');
        link.download = filename;
        link.href = targetCanvas.toDataURL('image/png');
        link.click();

        btn.classList.add('downloaded');
        setTimeout(() => btn.classList.remove('downloaded'), 1500);
    } catch (err) {
        console.error('Download failed:', err);
    }
}

function getDateStamp() {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${dd}${mm}${yyyy}_${hh}${min}`;
}

function setupExportButtons(formatId) {
    const fmt = FORMAT_REGISTRY[formatId];
    document.getElementById(`btn-download-${formatId}`).addEventListener('click', (e) => {
        if (!hasData()) return showNoDataPopup(e.currentTarget);
        downloadCapture(`capture-${formatId}`, fmt.exportW, fmt.exportH, `statistici-${formatId}_${getDateStamp()}.png`, `btn-download-${formatId}`);
    });

    document.getElementById(`btn-copy-${formatId}`).addEventListener('click', (e) => {
        if (!hasData()) return showNoDataPopup(e.currentTarget);
        copyCapture(`capture-${formatId}`, `btn-copy-${formatId}`);
    });

    document.getElementById(`btn-share-${formatId}`).addEventListener('click', (e) => {
        if (!hasData()) return showNoDataPopup(e.currentTarget);
        shareLink(`btn-share-${formatId}`, formatId);
    });
}

setupExportButtons('4x5');
setupExportButtons('9x16');

// ============= Copy to Clipboard =============

async function copyCapture(captureId, btnId) {
    const btn = document.getElementById(btnId);
    document.activeElement.blur();

    const captureArea = document.getElementById(captureId);

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

        // Show copied animation
        btn.classList.add('copied');
        setTimeout(() => btn.classList.remove('copied'), 1500);
    } catch (err) {
        console.error('Copy failed:', err);
    }
}


// ============= Share Link =============

async function shareLink(btnId, format) {
    const btn = document.getElementById(btnId);

    try {
        const snapshot = buildVersionData();

        const res = await fetch('/api/shares', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ snapshot })
        });

        if (!res.ok) throw new Error('Failed to create share');

        const { id } = await res.json();
        const shareUrl = `${window.location.origin}/share.html?id=${id}&format=${format}`;

        await navigator.clipboard.writeText(shareUrl);

        btn.classList.add('shared');
        setTimeout(() => btn.classList.remove('shared'), 2000);
    } catch (err) {
        console.error('Share failed:', err);
    }
}


// ============= Dynamic Format Add / Remove =============

const SVG_DOWNLOAD = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
const SVG_COPY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const SVG_SHARE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

function addFormat(formatId) {
    if (activeFormats.includes(formatId)) return;
    const fmt = FORMAT_REGISTRY[formatId];
    if (!fmt) return;

    // Get current text from existing previews
    const existingTitle = document.querySelector('[data-sync="title"]')?.innerHTML || 'Map Title';
    const existingSubtitle = document.querySelector('[data-sync="subtitle"]')?.innerHTML || 'Click to edit subtitle';
    const existingFooter = document.querySelector('[data-sync="footer"]')?.innerHTML || 'Source: click to edit';

    // Build preview column HTML
    const col = document.createElement('div');
    col.className = 'preview-column';
    col.id = `preview-col-${formatId}`;
    col.innerHTML = `
        <button class="preview-close-btn" data-format="${formatId}" title="Remove">&times;</button>
        <span class="preview-label">${fmt.label}</span>
        <div id="capture-${formatId}" class="capture-area ${fmt.ratio}">
            <div class="header-bar">
                <div class="title" contenteditable="true" data-sync="title">${existingTitle}</div>
                <div class="subtitle" contenteditable="true" data-sync="subtitle">${existingSubtitle}</div>
            </div>
            <div class="map-wrapper">
                <div id="map-${formatId}" class="map"></div>
                <div class="legend" id="legend-${formatId}"></div>
                <div class="map-loading-overlay" id="loading-overlay-${formatId}">
                    <div class="map-loading-spinner"></div>
                    <div class="map-loading-text">Loading...</div>
                </div>
            </div>
            <div class="footer-bar">
                <div class="footer-note" contenteditable="true" data-sync="footer">${existingFooter}</div>
            </div>
        </div>
        <div class="preview-actions">
            <button class="btn-action" id="btn-download-${formatId}" title="Download">${SVG_DOWNLOAD}<span class="action-toast">Downloaded!</span></button>
            <button class="btn-action" id="btn-copy-${formatId}" title="Copy to clipboard">${SVG_COPY}<span class="action-toast">Copied!</span></button>
            <button class="btn-action" id="btn-share-${formatId}" title="Share link">${SVG_SHARE}<span class="action-toast">Link copied!</span></button>
        </div>
    `;

    // Insert before the add-format column
    const addCol = document.getElementById('add-format-col');
    addCol.parentElement.insertBefore(col, addCol);

    // Create Leaflet map
    const { mapInstance, geoLayer } = createMap(`map-${formatId}`);
    formatMaps[formatId] = mapInstance;
    formatGeoLayers[formatId] = geoLayer;
    activeFormats.push(formatId);

    // Apply default label size
    const captureEl = document.getElementById(`capture-${formatId}`);
    captureEl.querySelectorAll('.label-inner').forEach(label => {
        label.style.fontSize = fmt.defaultLabelSize + 'px';
    });

    // Build control tab
    const tabBar = document.querySelector('.tab-bar');
    const tabBtn = document.createElement('button');
    tabBtn.className = 'tab-btn';
    tabBtn.dataset.tab = `tab-${formatId}`;
    tabBtn.textContent = fmt.label;
    tabBar.appendChild(tabBtn);

    const tabPanel = document.createElement('div');
    tabPanel.className = 'tab-panel';
    tabPanel.id = `tab-${formatId}`;
    tabPanel.innerHTML = `
        <div class="control-section">
            <label>Display</label>
            <div class="toggle-row"><span>County code</span><label class="toggle"><input type="checkbox" id="toggle-code-${formatId}" checked><span class="toggle-slider"></span></label></div>
            <div class="toggle-row"><span>Value</span><label class="toggle"><input type="checkbox" id="toggle-value-${formatId}" checked><span class="toggle-slider"></span></label></div>
        </div>
        <div class="control-section">
            <label>Zoom</label>
            <input type="range" id="zoom-slider-${formatId}" class="zoom-slider" min="5" max="10" step="0.1" value="7">
            <div class="zoom-value" id="zoom-value-${formatId}">7.0</div>
        </div>
        <div class="control-section">
            <label>Label size</label>
            <input type="range" id="label-size-${formatId}" class="zoom-slider" min="8" max="24" step="1" value="${fmt.defaultLabelSize}">
            <div class="zoom-value" id="label-size-value-${formatId}">${fmt.defaultLabelSize}px</div>
        </div>
    `;
    // Insert after last tab-panel in the tab-section
    const tabSection = tabBar.parentElement;
    tabSection.appendChild(tabPanel);

    // Re-bind tab click handlers
    tabBtn.addEventListener('click', () => {
        tabSection.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        tabSection.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        tabBtn.classList.add('active');
        tabPanel.classList.add('active');
    });

    // Setup all per-format wiring
    setTimeout(() => {
        mapInstance.invalidateSize();
        mapInstance.fitBounds(geoLayer.getBounds(), { padding: [10, 10] });
        document.getElementById(`zoom-slider-${formatId}`).value = mapInstance.getZoom();
        document.getElementById(`zoom-value-${formatId}`).textContent = mapInstance.getZoom().toFixed(1);
    }, 100);

    setupFormatControls(formatId, captureEl, mapInstance);
    setupCenterSnap(mapInstance, geoLayer);
    setupLegend(formatId);
    generateLegend(`legend-${formatId}`);
    setupExportButtons(formatId);
    setupAutoAlign(formatId);
    setupMapMoveHandlers(formatId);

    // Wire close button
    col.querySelector('.preview-close-btn').addEventListener('click', () => removeFormat(formatId));

    // Place watermark on new map if one is active
    if (watermarkDataUrl) placeWatermarks();

    updateCloseButtons();
    updateFormatPopover();
    restyleMaps();
}

function removeFormat(formatId) {
    if (!activeFormats.includes(formatId)) return;
    if (activeFormats.length <= 1) return; // must keep at least one

    // Destroy Leaflet map
    const mapInst = formatMaps[formatId];
    const geoLayer = formatGeoLayers[formatId];

    // Remove from global arrays
    const mapIdx = maps.indexOf(mapInst);
    if (mapIdx !== -1) maps.splice(mapIdx, 1);
    const glIdx = geoJSONLayers.indexOf(geoLayer);
    if (glIdx !== -1) geoJSONLayers.splice(glIdx, 1);

    mapInst.remove();
    delete formatMaps[formatId];
    delete formatGeoLayers[formatId];
    activeFormats.splice(activeFormats.indexOf(formatId), 1);

    // Remove DOM
    const col = document.getElementById(`preview-col-${formatId}`);
    if (col) col.remove();

    // Remove control tab
    const tabBtn = document.querySelector(`.tab-btn[data-tab="tab-${formatId}"]`);
    const tabPanel = document.getElementById(`tab-${formatId}`);
    if (tabBtn) tabBtn.remove();
    if (tabPanel) tabPanel.remove();

    // Activate first remaining tab
    const firstTab = document.querySelector('.tab-btn');
    if (firstTab && !document.querySelector('.tab-btn.active')) {
        firstTab.classList.add('active');
        document.getElementById(firstTab.dataset.tab)?.classList.add('active');
    }

    updateCloseButtons();
    updateFormatPopover();
}

function updateCloseButtons() {
    document.querySelectorAll('.preview-close-btn').forEach(btn => {
        btn.disabled = activeFormats.length <= 1;
    });
}

function updateFormatPopover() {
    const popover = document.getElementById('format-popover');
    popover.innerHTML = '';
    for (const [id, fmt] of Object.entries(FORMAT_REGISTRY)) {
        if (activeFormats.includes(id)) continue;
        const btn = document.createElement('button');
        btn.className = 'format-option';
        btn.innerHTML = `<div class="format-option-label">${fmt.label}</div><div class="format-option-desc">${fmt.exportW}×${fmt.exportH}px</div>`;
        btn.addEventListener('click', () => {
            addFormat(id);
            popover.classList.remove('open');
        });
        popover.appendChild(btn);
    }

    // Hide add button if all formats used
    const addCol = document.getElementById('add-format-col');
    addCol.style.display = activeFormats.length >= Object.keys(FORMAT_REGISTRY).length ? 'none' : '';
}

// Wire up existing close buttons
document.querySelectorAll('.preview-close-btn').forEach(btn => {
    btn.addEventListener('click', () => removeFormat(btn.dataset.format));
});

// Wire up add-format button
document.getElementById('btn-add-format').addEventListener('click', () => {
    const popover = document.getElementById('format-popover');
    popover.classList.toggle('open');
});

// Close popover on outside click
document.addEventListener('click', (e) => {
    const popover = document.getElementById('format-popover');
    if (!e.target.closest('#add-format-col')) {
        popover.classList.remove('open');
    }
});

updateCloseButtons();
updateFormatPopover();

// ============= Text Editor Toolbar =============

(function () {
    const toolbar = document.getElementById('text-toolbar');
    if (!toolbar) return;

    let activeEditable = null;

    function isEditable(el) {
        return el && (el.classList.contains('title') || el.classList.contains('subtitle') || el.classList.contains('footer-note'));
    }

    function positionToolbar(el) {
        const rect = el.getBoundingClientRect();
        const tbHeight = toolbar.offsetHeight || 36;
        const tbWidth = toolbar.offsetWidth || 300;

        let top = rect.top - tbHeight - 8;
        let left = rect.left;

        if (top < 4) top = rect.bottom + 8;
        if (left + tbWidth > window.innerWidth - 8) left = window.innerWidth - tbWidth - 8;
        if (left < 4) left = 4;

        toolbar.style.left = left + 'px';
        toolbar.style.top = top + 'px';
    }

    function showToolbar(el) {
        activeEditable = el;
        toolbar.style.display = 'flex';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                positionToolbar(el);
                updateToolbarState();
            });
        });
    }

    function hideToolbar() {
        toolbar.style.display = 'none';
        activeEditable = null;
    }

    function updateToolbarState() {
        if (!activeEditable) return;
        document.getElementById('tb-bold').classList.toggle('active', document.queryCommandState('bold'));
        document.getElementById('tb-italic').classList.toggle('active', document.queryCommandState('italic'));
        document.getElementById('tb-underline').classList.toggle('active', document.queryCommandState('underline'));

        const align = getComputedStyle(activeEditable).textAlign;
        document.getElementById('tb-left').classList.toggle('active', align === 'left' || align === 'start');
        document.getElementById('tb-center').classList.toggle('active', align === 'center');
        document.getElementById('tb-right').classList.toggle('active', align === 'right' || align === 'end');
    }

    // Show toolbar on click; hide when clicking elsewhere
    document.addEventListener('click', (e) => {
        const editable = e.target.closest('[contenteditable="true"]');
        if (editable && isEditable(editable)) {
            showToolbar(editable);
            return;
        }
        if (e.target.closest('#text-toolbar')) return;
        hideToolbar();
    });

    document.addEventListener('selectionchange', () => {
        if (activeEditable) updateToolbarState();
    });

    function execCmd(cmd, value) {
        if (!activeEditable) return;
        activeEditable.focus();
        document.execCommand(cmd, false, value || null);
        updateToolbarState();
        const syncKey = activeEditable.dataset.sync;
        if (syncKey) {
            document.querySelectorAll(`[data-sync="${syncKey}"]`).forEach(other => {
                if (other !== activeEditable) {
                    other.innerHTML = activeEditable.innerHTML;
                    other.style.textAlign = activeEditable.style.textAlign;
                }
            });
        }
    }

    document.getElementById('tb-bold').addEventListener('mousedown', (e) => { e.preventDefault(); execCmd('bold'); });
    document.getElementById('tb-italic').addEventListener('mousedown', (e) => { e.preventDefault(); execCmd('italic'); });
    document.getElementById('tb-underline').addEventListener('mousedown', (e) => { e.preventDefault(); execCmd('underline'); });

    document.getElementById('tb-left').addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (activeEditable) { activeEditable.style.textAlign = 'left'; execCmd('justifyLeft'); }
    });
    document.getElementById('tb-center').addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (activeEditable) { activeEditable.style.textAlign = 'center'; execCmd('justifyCenter'); }
    });
    document.getElementById('tb-right').addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (activeEditable) { activeEditable.style.textAlign = 'right'; execCmd('justifyRight'); }
    });

    document.getElementById('tb-text-color').addEventListener('input', (e) => {
        execCmd('foreColor', e.target.value);
    });

    document.getElementById('tb-bg-color').addEventListener('input', (e) => {
        execCmd('hiliteColor', e.target.value);
    });
})();

// ============= Vertical Drag for Text Elements =============

document.querySelectorAll('.title, .subtitle, .footer-note').forEach(el => {
    let dragging = false;
    let startY, startTop;

    el.addEventListener('mousemove', (e) => {
        if (dragging) return;
        const rect = el.getBoundingClientRect();
        // Show ns-resize cursor on the left 16px zone
        el.style.cursor = (e.clientX - rect.left < 16) ? 'ns-resize' : '';
    });

    el.addEventListener('mousedown', (e) => {
        const rect = el.getBoundingClientRect();
        if (e.clientX - rect.left >= 16) return; // normal click — allow editing

        pushUndo();
        e.preventDefault();
        e.stopPropagation();
        dragging = true;
        startY = e.clientY;
        startTop = parseFloat(el.style.top) || 0;
        el.classList.add('v-dragging');

        const onMove = (ev) => {
            el.style.top = (startTop + ev.clientY - startY) + 'px';
        };

        const onUp = () => {
            dragging = false;
            el.classList.remove('v-dragging');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            markDirty();
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    });
});

// ============= Map Move Undo Tracking =============

let _mapUndoTimer = null;
let _mapUndoPushed = false;
let _restoringSnapshot = false;

function onMapMoveStart() {
    if (_restoringSnapshot) return;
    if (!_mapUndoPushed) {
        pushUndo();
        _mapUndoPushed = true;
    }
}

function onMapMoveEnd() {
    if (_restoringSnapshot) return;
    clearTimeout(_mapUndoTimer);
    _mapUndoTimer = setTimeout(() => {
        _mapUndoPushed = false;
        markDirty();
    }, 500);
}

function setupMapMoveHandlers(formatId) {
    formatMaps[formatId].on('movestart', onMapMoveStart);
    formatMaps[formatId].on('moveend', onMapMoveEnd);
}

setupMapMoveHandlers('4x5');
setupMapMoveHandlers('9x16');

// ============= AI Chat Panel =============

import { initChatPanel } from './ai/chatPanel.js';

initChatPanel({
    onConfigUpdate: applyConfig,
    getState: () => ({
        title: document.querySelector('[data-sync="title"]')?.textContent || '',
        subtitle: document.querySelector('[data-sync="subtitle"]')?.textContent || '',
        source: document.querySelector('[data-sync="footer"]')?.textContent || '',
        palette: activePalette.name || activePalette.id || 'red',
        paletteReversed,
        normalization: normalizationMode,
        minValue: _minValue,
        maxValue: _maxValue,
        highIsBad: _highIsBad,
        data: _data,
    }),
    onLoadingChange: (isLoading) => {
        for (const fid of activeFormats) {
            const el = document.getElementById(`loading-overlay-${fid}`);
            if (el) el.classList.toggle('active', isLoading);
        }
    },
});

// ============= Data Table Panel =============

(function initDataTable() {
    // Create FAB button in shared row
    let fabRow = document.getElementById('fab-row');
    if (!fabRow) {
        fabRow = document.createElement('div');
        fabRow.id = 'fab-row';
        fabRow.className = 'fab-row';
        document.body.appendChild(fabRow);
    }

    const tableFab = document.createElement('button');
    tableFab.id = 'data-table-fab';
    tableFab.className = 'fab-btn';
    tableFab.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg><span>Data table</span>`;
    fabRow.insertBefore(tableFab, fabRow.firstChild);

    // Create panel
    const panel = document.createElement('div');
    panel.id = 'data-table-panel';
    panel.innerHTML = `
        <div class="data-table-header">
            <div class="data-table-header-left">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>
                <span>County Data</span>
            </div>
            <button id="data-table-close" class="data-table-close">&times;</button>
        </div>
        <div class="data-table-body">
            <table>
                <thead><tr><th>County</th><th>Value</th></tr></thead>
                <tbody id="data-table-tbody"></tbody>
            </table>
        </div>
    `;
    document.body.appendChild(panel);

    // Populate table rows
    const tbody = document.getElementById('data-table-tbody');
    const allInputs = [];

    COUNTY_NAMES.forEach((name, idx) => {
        const tr = document.createElement('tr');
        const abbr = getCountyAbbreviation(name);
        tr.innerHTML = `
            <td><span class="county-swatch" data-county="${name}"></span>${abbr} — ${name}</td>
            <td><input class="county-input" data-county="${name}" data-idx="${idx}" value="${_data[name] ?? ''}"></td>
        `;
        tbody.appendChild(tr);
        allInputs.push(tr.querySelector('.county-input'));
    });

    // Apply a single value change and refresh the map
    function applyValue(input) {
        const county = input.dataset.county;
        const raw = input.value.replace(',', '.').trim();
        const val = parseFloat(raw);
        if (isNaN(val)) return;
        _data[county] = val;
    }

    function refreshMap() {
        const vals = Object.values(_data).filter(v => typeof v === 'number');
        if (vals.length > 0) {
            actualMin = Math.min(...vals);
            actualMax = Math.max(...vals);
            _minValue = actualMin;
            _maxValue = actualMax;
        }
        updateLabels();
        restyleMaps();
        updateTableSwatches();
        markDirty();
    }

    // Live editing — update on every keystroke
    tbody.addEventListener('input', (e) => {
        if (!e.target.classList.contains('county-input')) return;
        applyValue(e.target);
        refreshMap();
    });

    // Push undo when user starts editing
    let _undoPushedForFocus = false;
    tbody.addEventListener('focusin', (e) => {
        if (e.target.classList.contains('county-input')) {
            if (!_undoPushedForFocus) {
                pushUndo();
                _undoPushedForFocus = true;
            }
            e.target.select();
        }
    });

    tbody.addEventListener('focusout', () => {
        // Reset undo flag when focus leaves the table entirely
        setTimeout(() => {
            if (!tbody.contains(document.activeElement)) {
                _undoPushedForFocus = false;
            }
        }, 0);
    });

    // Keyboard navigation: Tab/Enter move to next row, Shift+Tab to previous
    tbody.addEventListener('keydown', (e) => {
        if (!e.target.classList.contains('county-input')) return;
        const idx = parseInt(e.target.dataset.idx);

        if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
            e.preventDefault();
            const next = allInputs[idx + 1];
            if (next) { next.focus(); next.select(); }
        } else if (e.key === 'Tab' && e.shiftKey) {
            e.preventDefault();
            const prev = allInputs[idx - 1];
            if (prev) { prev.focus(); prev.select(); }
        }
    });

    // Paste support — paste a column of values from Excel/Sheets
    tbody.addEventListener('paste', (e) => {
        if (!e.target.classList.contains('county-input')) return;
        e.preventDefault();

        const text = (e.clipboardData || window.clipboardData).getData('text');
        // Split by newlines; each line may have tab-separated columns — take the last column (the value)
        const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');

        if (lines.length <= 1) {
            // Single value paste — just set it
            const raw = lines[0]?.replace(',', '.').trim();
            const val = parseFloat(raw);
            if (!isNaN(val)) {
                e.target.value = val;
                applyValue(e.target);
                refreshMap();
            }
            return;
        }

        pushUndo();

        const startIdx = parseInt(e.target.dataset.idx);

        lines.forEach((line, i) => {
            const targetIdx = startIdx + i;
            if (targetIdx >= allInputs.length) return;

            // Take the last column if tab-separated (handles "County\tValue" or just "Value")
            const cols = line.split('\t');
            const rawVal = cols[cols.length - 1].replace(',', '.').trim();
            const val = parseFloat(rawVal);
            if (isNaN(val)) return;

            allInputs[targetIdx].value = val;
            applyValue(allInputs[targetIdx]);
        });

        refreshMap();

        // Focus the last filled input
        const lastIdx = Math.min(startIdx + lines.length - 1, allInputs.length - 1);
        allInputs[lastIdx].focus();
    });

    // Open/close
    tableFab.addEventListener('click', () => {
        refreshTableValues();
        panel.classList.add('open');
        fabRow.classList.add('hidden');
    });

    document.getElementById('data-table-close').addEventListener('click', () => {
        panel.classList.remove('open');
        fabRow.classList.remove('hidden');
    });

    function refreshTableValues() {
        allInputs.forEach(input => {
            input.value = _data[input.dataset.county] || 0;
        });
        updateTableSwatches();
    }

    function updateTableSwatches() {
        tbody.querySelectorAll('.county-swatch').forEach(swatch => {
            const county = swatch.dataset.county;
            swatch.style.background = getColorDivergingExp(_minValue, _maxValue, _data[county], _highIsBad);
        });
    }

    // Expose refresh so other code (applyConfig, loadVersion) can update the table
    window._refreshDataTable = refreshTableValues;
})();
