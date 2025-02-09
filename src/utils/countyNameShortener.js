export const countyAbbreviations = {
    "Alba": "AB",
    "Arad": "AR",
    "Arges": "AG",
    "Bacau": "BC",
    "Bihor": "BH",
    "Bistrita-Nasaud": "BN",
    "Botosani": "BT",
    "Braila": "BR",
    "Brasov": "BV",
    "Bucuresti": "B",
    "Buzau": "BZ",
    "Calarasi": "CL",
    "Caras-Severin": "CS",
    "Cluj": "CJ",
    "Constanta": "CT",
    "Covasna": "CV",
    "Dambovita": "DB",
    "Dolj": "DJ",
    "Galati": "GL",
    "Giurgiu": "GR",
    "Gorj": "GJ",
    "Harghita": "HR",
    "Hunedoara": "HD",
    "Ialomita": "IL",
    "Iasi": "IS",
    "Ilfov": "IF",
    "Maramures": "MM",
    "Mehedinti": "MH",
    "Mures": "MS",
    "Neamt": "NT",
    "Olt": "OT",
    "Prahova": "PH",
    "Salaj": "SJ",
    "Satu Mare": "SM",
    "Sibiu": "SB",
    "Suceava": "SV",
    "Teleorman": "TR",
    "Timis": "TM",
    "Tulcea": "TL",
    "Valcea": "VL",
    "Vaslui": "VS",
    "Vrancea": "VN"
};

export function getCountyAbbreviation(countyName) {
    return countyAbbreviations[countyName] || "Unknown county";
}