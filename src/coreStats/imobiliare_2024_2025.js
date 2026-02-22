export let data = {
    "Alba": -37.6,
    "Arad": -4.3,
    "Arges": 2.6,
    "Bacau": 8.9,
    "Bihor": -7.4,
    "Bistrita-Nasaud": 11.8,
    "Botosani": 16.2,
    "Braila": 0.4,
    "Brasov": -13.8,
    "Bucuresti": -5.5,
    "Buzau": -3,
    "Calarasi": -6.3,
    "Caras-Severin": 0.3,
    "Cluj": 13.2,
    "Constanta": 39.1,
    "Covasna": -16.1,
    "Dambovita": -7.6,
    "Dolj": -3,
    "Galati": -2.2,
    "Giurgiu": -4.6,
    "Gorj": -12.8,
    "Harghita": -2.3,
    "Hunedoara": 10.1,
    "Ialomita": -52.4,
    "Iasi": -57.9,
    "Ilfov": 2.5,
    "Maramures": -15.6,
    "Mehedinti": -1,
    "Mures": 9.6,
    "Neamt": 24.3,
    "Olt": 24.8,
    "Prahova": 14.7,
    "Salaj": 2.9,
    "Satu Mare": -1.3,
    "Sibiu": -26.2,
    "Suceava": 12.6,
    "Teleorman": -33.3,
    "Timis": -12.1,
    "Tulcea": 20.4,
    "Valcea": 7.6,
    "Vaslui": 3.5,
    "Vrancea": 0
};

for(let county of Object.keys(data)) {
    // Convert to millions of euro
    // data[county] = Math.ceil(data[county] / (1000000*4.97) );
    // data[county] = `${county}\n\n${data[county]}`
}

// export const maxValue = 50000;
export const maxValue = 10;
export const minValue = -10;

export const highIsBad = false;

console.log(data)