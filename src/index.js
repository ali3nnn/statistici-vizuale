console.log("index.js")

import html2canvas from 'html2canvas';

import {
    getCountyAbbreviation
} from './utils/countyNameShortener.js'

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

// Initialize with all counties at 0
let _maxValue = 0;
let _minValue = 0;
let _data = Object.fromEntries(COUNTY_NAMES.map(name => [name, 0]));
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

function getColorDivergingExp(minVal, maxVal, currentNumber, highIsBad, countryName) {
    // No data range — show neutral gray
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
                html: `<div class="label-inner" data-county="${feature.properties.name}" style="color:${textColor}"><span class="label-code">${getCountyAbbreviation(feature.properties.name)}</span><span class="label-value">${_data[feature.properties.name]}</span></div>`
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

    return mapInstance;
}

// Create both maps
var map4x5 = createMap('map-4x5');
var map9x16 = createMap('map-9x16');

// Re-fit bounds after containers are laid out
setTimeout(() => {
    map4x5.invalidateSize();
    map4x5.fitBounds(geoJSONLayers[0].getBounds(), { padding: [10, 10] });
    map9x16.invalidateSize();
    map9x16.fitBounds(geoJSONLayers[1].getBounds(), { padding: [10, 10] });

    // Update zoom sliders to match the fitted zoom
    document.getElementById('zoom-slider-4x5').value = map4x5.getZoom();
    document.getElementById('zoom-value-4x5').textContent = map4x5.getZoom().toFixed(1);
    document.getElementById('zoom-slider-9x16').value = map9x16.getZoom();
    document.getElementById('zoom-value-9x16').textContent = map9x16.getZoom().toFixed(1);
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

setupCenterSnap(map4x5, geoJSONLayers[0]);
setupCenterSnap(map9x16, geoJSONLayers[1]);

// ============= Legend =============

function generateLegend(legendId) {
    const legendEl = document.getElementById(legendId);
    if (!legendEl) return;

    const steps = 20;
    let gradientStops = [];

    // Generate gradient from max (top) to min (bottom)
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

function refreshLegends() {
    generateLegend('legend-4x5');
    generateLegend('legend-9x16');
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
    });

    document.addEventListener('mouseup', () => {
        if (dragging) {
            dragging = false;
            el.classList.remove('dragging');
        }
    });
}

makeDraggable(document.getElementById('legend-4x5'));
makeDraggable(document.getElementById('legend-9x16'));

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
        valueEl.textContent = (val !== undefined && val !== null) ? val : '';

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

    // Recompute actual min/max
    const vals = Object.values(_data).filter(v => typeof v === 'number');
    if (vals.length > 0) {
        actualMin = Math.min(...vals);
        actualMax = Math.max(...vals);
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

setupFormatControls('4x5', document.getElementById('capture-4x5'), map4x5);
setupFormatControls('9x16', document.getElementById('capture-9x16'), map9x16);

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

const autoAlign4x5Btn = document.getElementById('auto-align-4x5');
if (autoAlign4x5Btn) autoAlign4x5Btn.addEventListener('click', () => {
    autoAlign(map4x5, geoJSONLayers[0], '4x5');
});

const autoAlign9x16Btn = document.getElementById('auto-align-9x16');
if (autoAlign9x16Btn) autoAlign9x16Btn.addEventListener('click', () => {
    autoAlign(map9x16, geoJSONLayers[1], '9x16');
});

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
    return {
        data: { ..._data },
        minValue: _minValue,
        maxValue: _maxValue,
        highIsBad: _highIsBad,
        activePalette: { ...activePalette },
        paletteReversed,
        normalizationMode,
        text: {
            title: { innerHTML: titleEl.innerHTML, textAlign: titleEl.style.textAlign || '', top: titleEl.style.top || '' },
            subtitle: { innerHTML: subtitleEl.innerHTML, textAlign: subtitleEl.style.textAlign || '', top: subtitleEl.style.top || '' },
            footer: { innerHTML: footerEl.innerHTML, textAlign: footerEl.style.textAlign || '', top: footerEl.style.top || '' },
        },
        mapState: {
            map4x5: { center: { lat: map4x5.getCenter().lat, lng: map4x5.getCenter().lng }, zoom: map4x5.getZoom() },
            map9x16: { center: { lat: map9x16.getCenter().lat, lng: map9x16.getCenter().lng }, zoom: map9x16.getZoom() }
        },
        display: {
            '4x5': {
                showCode: document.getElementById('toggle-code-4x5').checked,
                showValue: document.getElementById('toggle-value-4x5').checked,
                labelSize: document.getElementById('label-size-4x5').value,
            },
            '9x16': {
                showCode: document.getElementById('toggle-code-9x16').checked,
                showValue: document.getElementById('toggle-value-9x16').checked,
                labelSize: document.getElementById('label-size-9x16').value,
            }
        }
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

    // Restore map state
    if (snap.mapState) {
        _restoringSnapshot = true;
        const s4 = snap.mapState.map4x5;
        map4x5.setView([s4.center.lat, s4.center.lng], s4.zoom, { animate: false });
        document.getElementById('zoom-slider-4x5').value = s4.zoom;
        document.getElementById('zoom-value-4x5').textContent = s4.zoom.toFixed(1);

        const s9 = snap.mapState.map9x16;
        map9x16.setView([s9.center.lat, s9.center.lng], s9.zoom, { animate: false });
        document.getElementById('zoom-slider-9x16').value = s9.zoom;
        document.getElementById('zoom-value-9x16').textContent = s9.zoom.toFixed(1);
        _restoringSnapshot = false;
    }

    // Restore display settings per format
    if (snap.display) {
        ['4x5', '9x16'].forEach(suffix => {
            const d = snap.display[suffix];
            if (!d) return;
            const container = document.getElementById(`capture-${suffix}`);

            // Toggles
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

            // Label size
            const sizeSlider = document.getElementById(`label-size-${suffix}`);
            sizeSlider.value = d.labelSize;
            document.getElementById(`label-size-value-${suffix}`).textContent = d.labelSize + 'px';
            container.querySelectorAll('.label-inner').forEach(label => {
                label.style.fontSize = d.labelSize + 'px';
            });

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
    return {
        savedAt: new Date().toISOString(),
        data: { ..._data },
        minValue: _minValue,
        maxValue: _maxValue,
        highIsBad: _highIsBad,
        activePalette: { ...activePalette },
        paletteReversed,
        normalizationMode,
        text: {
            title: { innerHTML: titleEl.innerHTML, textAlign: titleEl.style.textAlign || '', top: titleEl.style.top || '' },
            subtitle: { innerHTML: subtitleEl.innerHTML, textAlign: subtitleEl.style.textAlign || '', top: subtitleEl.style.top || '' },
            footer: { innerHTML: footerEl.innerHTML, textAlign: footerEl.style.textAlign || '', top: footerEl.style.top || '' },
        },
        mapState: {
            map4x5: { center: map4x5.getCenter(), zoom: map4x5.getZoom() },
            map9x16: { center: map9x16.getCenter(), zoom: map9x16.getZoom() }
        },
        display: {
            '4x5': {
                showCode: document.getElementById('toggle-code-4x5').checked,
                showValue: document.getElementById('toggle-value-4x5').checked,
                labelSize: document.getElementById('label-size-4x5').value,
            },
            '9x16': {
                showCode: document.getElementById('toggle-code-9x16').checked,
                showValue: document.getElementById('toggle-value-9x16').checked,
                labelSize: document.getElementById('label-size-9x16').value,
            }
        }
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

    if (versionData.mapState) {
        _restoringSnapshot = true;
        const s4 = versionData.mapState.map4x5;
        map4x5.setView([s4.center.lat, s4.center.lng], s4.zoom, { animate: false });
        document.getElementById('zoom-slider-4x5').value = s4.zoom;
        document.getElementById('zoom-value-4x5').textContent = s4.zoom.toFixed(1);

        const s9 = versionData.mapState.map9x16;
        map9x16.setView([s9.center.lat, s9.center.lng], s9.zoom, { animate: false });
        document.getElementById('zoom-slider-9x16').value = s9.zoom;
        document.getElementById('zoom-value-9x16').textContent = s9.zoom.toFixed(1);
        _restoringSnapshot = false;
    }

    // Restore display settings
    if (versionData.display) {
        ['4x5', '9x16'].forEach(suffix => {
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
const ICON_HISTORY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
const ICON_CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

function openSavedPanel() {
    document.getElementById('saved-panel').classList.add('open');
    document.getElementById('top-right-actions').classList.add('panel-open');
    document.getElementById('saved-toggle-btn').innerHTML = ICON_CLOSE;
    document.getElementById('saved-toggle-btn').title = 'Close';
}

function closeSavedPanel() {
    document.getElementById('saved-panel').classList.remove('open');
    document.getElementById('top-right-actions').classList.remove('panel-open');
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

document.getElementById('btn-download-4x5').addEventListener('click', () => {
    downloadCapture('capture-4x5', 1080, 1350, `statistici-post-4x5_${getDateStamp()}.png`, 'btn-download-4x5');
});

document.getElementById('btn-download-9x16').addEventListener('click', () => {
    downloadCapture('capture-9x16', 1080, 1920, `statistici-reel-9x16_${getDateStamp()}.png`, 'btn-download-9x16');
});

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

document.getElementById('btn-copy-4x5').addEventListener('click', () => {
    copyCapture('capture-4x5', 'btn-copy-4x5');
});

document.getElementById('btn-copy-9x16').addEventListener('click', () => {
    copyCapture('capture-9x16', 'btn-copy-9x16');
});

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

document.getElementById('btn-share-4x5').addEventListener('click', () => {
    shareLink('btn-share-4x5', '4x5');
});

document.getElementById('btn-share-9x16').addEventListener('click', () => {
    shareLink('btn-share-9x16', '9x16');
});

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

map4x5.on('movestart', onMapMoveStart);
map4x5.on('moveend', onMapMoveEnd);
map9x16.on('movestart', onMapMoveStart);
map9x16.on('moveend', onMapMoveEnd);

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
        document.getElementById('loading-overlay-4x5').classList.toggle('active', isLoading);
        document.getElementById('loading-overlay-9x16').classList.toggle('active', isLoading);
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
            <td><input class="county-input" data-county="${name}" data-idx="${idx}" value="${_data[name] || 0}"></td>
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
