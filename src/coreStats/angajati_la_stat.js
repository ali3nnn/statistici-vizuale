export let data = {
    "Alba": 16545,
    "Arad": 17808,
    "Arges": 26119,
    "Bacau": 25555,
    "Bihor": 25992,
    "Bistrita-Nasaud": 12933,
    "Botosani": 17044,
    "Braila": 12688,
    "Brasov": 27346,
    "Bucuresti": 179891,
    "Buzau": 17892,
    "Calarasi": 10580,
    "Caras-Severin": 12849,
    "Cluj": 48020,
    "Constanta": 31620,
    "Covasna": 10158,
    "Dambovita": 18438,
    "Dolj": 33872,
    "Galati": 26223,
    "Giurgiu": 9560,
    "Gorj": 15867,
    "Harghita": 15403,
    "Hunedoara": 18622,
    "Ialomita": 10016,
    "Iasi": 49905,
    "Ilfov": 12193,
    "Maramures": 21278,
    "Mehedinti": 11400,
    "Mures": 29731,
    "Neamt": 19266,
    "Olt": 17413,
    "Prahova": 31400,
    "Salaj": 10859,
    "Satu Mare": 15824,
    "Sibiu": 20458,
    "Suceava": 26985,
    "Teleorman": 13612,
    "Timis": 40719,
    "Tulcea": 9760,
    "Valcea": 17747,
    "Vaslui": 18529,
    "Vrancea": 14451
};

for(let county of Object.keys(data)) {
    // Convert to millions of euro
    // data[county] = Math.ceil(data[county] / (1000000*4.97) );
    // data[county] = `${county}\n\n${data[county]}`
}

// export const maxValue = 50000;
export const maxValue = 35000;

console.log(data)