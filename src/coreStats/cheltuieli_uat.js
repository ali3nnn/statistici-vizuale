let data = {
    "Alba": 1532324654,
    "Arad": 1887856928,
    "Arges": 2304166283,
    "Bacau": 2192962638,
    "Bihor": 2600530227,
    "Bistrita-Nasaud": 1477871432,
    "Botosani": 1630061124,
    "Braila": 1201832988,
    "Brasov": 2348973865,
    "Bucuresti": 12820591264,
    "Buzau": 1554084389,
    "Calarasi": 1068673532,
    "Caras-Severin": 1280241018,
    "Cluj": 3484005287,
    "Constanta": 3291378825,
    "Covasna": 888656181,
    "Dambovita": 1805600134,
    "Dolj": 2293265569,
    "Galati": 1925880987,
    "Giurgiu": 972055398,
    "Gorj": 1287151711,
    "Harghita": 1225315124,
    "Hunedoara": 1685216193,
    "Ialomita": 959518563,
    "Iasi": 3311224888,
    "Ilfov": 2333040228,
    "Maramures": 1887747544,
    "Mehedinti": 1195386375,
    "Mures": 2154441535,
    "Neamt": 1737620801,
    "Olt": 219615596,
    "Prahova": 2774255886,
    "Salaj": 1478338765,
    "Satu Mare": 1103123744,
    "Sibiu": 2076579130,
    "Suceava": 2482351905,
    "Teleorman": 1221445237,
    "Timis": 3351991179,
    "Tulcea": 1317321729,
    "Valcea": 1762124123,
    "Vaslui": 1571061730,
    "Vrancea": 1523011201
};

for(let county of Object.keys(data)) {
    // Convert to millions of euro
    data[county] = Math.ceil(data[county] / (1000000*4.97) );
}

const maxValue = 700;

console.log(data)