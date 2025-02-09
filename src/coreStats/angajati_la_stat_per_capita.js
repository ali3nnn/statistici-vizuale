let angajatiLaStat = {
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

const populatia = {
    "Alba": 376589,
    "Arad": 471155,
    "Arges": 637881,
    "Bacau": 742053,
    "Bihor": 617118,
    "Bistrita-Nasaud": 328286,
    "Botosani": 452328,
    "Braila": 634236,
    "Brasov": 346773,
    "Bucuresti": 2121794,
    "Buzau": 468111,
    "Calarasi": 320124,
    "Caras-Severin": 311084,
    "Cluj": 730216,
    "Constanta": 766315,
    "Covasna": 226879,
    "Dambovita": 522195,
    "Dolj": 691276,
    "Galati": 626201,
    "Giurgiu": 272768,
    "Gorj": 359883,
    "Harghita": 331809,
    "Hunedoara": 459671,
    "Ialomita": 288379,
    "Iasi": 944074,
    "Ilfov": 429946,
    "Maramures": 522154,
    "Mehedinti": 280888,
    "Mures": 593024,
    "Neamt": 569851,
    "Olt": 438318,
    "Prahova": 795931,
    "Salaj": 387979,
    "Satu Mare": 245088,
    "Sibiu": 466905,
    "Suceava": 757679,
    "Teleorman": 374887,
    "Timis": 752091,
    "Tulcea": 238333,
    "Valcea": 493234,
    "Vaslui": 397878,
    "Vrancea": 386223
};


export let data = {}
for (let county of Object.keys(angajatiLaStat)) {
    // La mia de locuitori
    data[county] = Math.ceil(angajatiLaStat[county] / populatia[county] * 1000)
}

export const maxValue = 75;