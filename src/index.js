console.log("index.js")

import {
    customCoordinates,
} from './utils/customCoordinates'

import {
    countyNameShortener,
    getCountyAbbreviation
} from './utils/countyNameShortener'

// const abv = getCountyAbbreviation("Cluj")
// console.log(abv)

import {
    data,
    maxValue
} from './coreStats/angajati_la_stat';

import {
    countiesGeoData
} from './maps/judete.romania'

import { GEO_DATA_UAT } from './maps/uat.romania'

// Assigning data
const romaniaGeoJSON = countiesGeoData;
// const romaniaGeoJSON = GEO_DATA_UAT;

// Handling undefined vars
if (typeof maxValue === "undefined")
    maxValue = 0
if (typeof data === "undefined")
    data = {}

// Create a Leaflet map centered at a specific location
var map = L.map('map', {
    zoomControl: false, // Remove zoom buttons
}).setView([45.9432, 24.9668], 7);

// Add a tile layer (OpenStreetMap)
var osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Add GeoJSON layer to the map with grey background color
var geoJSONLayer = L.geoJSON(romaniaGeoJSON, {
    style: function (feature) {
        var color = getColor(0, maxValue, data[feature.properties.name], true);
        
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
        // Create a custom icon with the county number
        var icon = L.divIcon({
            className: 'county-label',
            // html: customPercentage.toString() + "%",
            // html: customPercentage.toString() + " mil. €",

            html: `${getCountyAbbreviation(feature.properties.name)}\n${data[feature.properties.name]}` // COUNTY + VALUE
            // html: data[feature.properties.name]

            // html: `${getCountyAbbreviation(feature.properties.name)}`
        });

        // console.log(feature.properties.name)

        // Create a marker with the custom icon
        let coordinates;
        coordinates = customCoordinates(feature.properties.name, layer)

        var marker = L.marker(coordinates, {
            icon: icon
        });

        // Add the marker to the map
        marker.addTo(map);
    }
}).addTo(map);

// Function to toggle the visibility of the OpenStreetMap layer
function toggleMapLayer() {
    map.eachLayer(function (layer) {
        if (layer._url) {
            layer._container.style.display = (layer._container.style.display === 'none') ? '' : 'none';
        }
    });
}

toggleMapLayer();

function getColor(minVal, maxVal, currentNumber, isReversed) {
    const minHue = 120; // Green
    const maxHue = 0; // Red
    const minLightness = 50; // Lightness for green
    const maxLightness = 50; // Lightness for red

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