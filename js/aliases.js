/**
 * Country name aliases for easier typing in games
 * Maps common abbreviations, alternate names, and variations to
 * canonical country names used in game data (countries-neighbors.json, data.js).
 *
 * Map renderers match against both GeoJSON ADMIN and NAME fields,
 * so aliases should target the game data name, not the GeoJSON ADMIN name.
 */

export const COUNTRY_ALIASES = {
  // === Abbreviations ===
  "US": "United States",
  "USA": "United States",
  "U.S.": "United States",
  "U.S.A.": "United States",
  "United States of America": "United States",
  "UK": "United Kingdom",
  "U.K.": "United Kingdom",
  "Britain": "United Kingdom",
  "Great Britain": "United Kingdom",
  "UAE": "United Arab Emirates",
  "U.A.E.": "United Arab Emirates",
  "CAR": "Central African Republic",
  "DR Congo": "Democratic Republic of the Congo",
  "DRC": "Democratic Republic of the Congo",
  "D.R. Congo": "Democratic Republic of the Congo",
  "PNG": "Papua New Guinea",
  "NZ": "New Zealand",

  // === The/No The variants ===
  "The Bahamas": "Bahamas",
  "The Gambia": "Gambia",
  "The Netherlands": "Netherlands",
  "The Philippines": "Philippines",

  // === Congo variants ===
  "Congo-Brazzaville": "Congo",
  "Congo Brazzaville": "Congo",
  "Congo Republic": "Congo",
  "Republic of the Congo": "Congo",
  "Democratic Republic of Congo": "Democratic Republic of the Congo",
  "Congo-Kinshasa": "Democratic Republic of the Congo",
  "Congo Kinshasa": "Democratic Republic of the Congo",

  // === Korea variants ===
  "DPRK": "North Korea",
  "ROK": "South Korea",
  "Korea": "South Korea",
  "Republic of Korea": "South Korea",

  // === Historical/Former names ===
  "Burma": "Myanmar",
  "Swaziland": "Eswatini",
  "eSwatini": "Eswatini",
  "Czech Republic": "Czechia",
  "Macedonia": "North Macedonia",
  "FYROM": "North Macedonia",
  "Ivory Coast": "Côte d'Ivoire",
  "Cote d'Ivoire": "Côte d'Ivoire",
  "Cape Verde": "Cabo Verde",

  // === Common variations ===
  "East Timor": "Timor-Leste",
  "Timor Leste": "Timor-Leste",
  "Timor": "Timor-Leste",
  "Vatican": "Vatican City",
  "The Vatican": "Vatican City",
  "Brunei Darussalam": "Brunei",
  "Bosnia": "Bosnia and Herzegovina",
  "Bosnia-Herzegovina": "Bosnia and Herzegovina",
  "Trinidad": "Trinidad and Tobago",
  "St Kitts and Nevis": "Saint Kitts and Nevis",
  "St. Kitts and Nevis": "Saint Kitts and Nevis",
  "St Kitts": "Saint Kitts and Nevis",
  "St Lucia": "Saint Lucia",
  "St. Lucia": "Saint Lucia",
  "St Vincent": "Saint Vincent and the Grenadines",
  "St. Vincent": "Saint Vincent and the Grenadines",
  "St Vincent and the Grenadines": "Saint Vincent and the Grenadines",
  "Sao Tome and Principe": "São Tomé and Príncipe",
  "Sao Tome": "São Tomé and Príncipe",
  "São Tomé": "São Tomé and Príncipe",

  // === Formal names → short forms ===
  "Republic of Serbia": "Serbia",
  "United Republic of Tanzania": "Tanzania",
  "Federated States of Micronesia": "Micronesia",
  "FSM": "Micronesia",

  // === Common misspellings/variations ===
  "Lao": "Laos",
  "Emirates": "United Arab Emirates",
  "Russian Federation": "Russia",
  "Persia": "Iran",
  "Syrian Arab Republic": "Syria",
  "State of Palestine": "Palestine",
  "Lybia": "Libya",
  "Libia": "Libya",
  "Kyrgystan": "Kyrgyzstan",
  "Kyrgyz": "Kyrgyzstan",
  "Turkmenia": "Turkmenistan",

  // === Island nations short forms ===
  "Marshalls": "Marshall Islands",
  "Solomons": "Solomon Islands",

  // === Regional/informal names ===
  "Holland": "Netherlands",
};

export const SHORT_DISPLAY_NAMES = {
  "Democratic Republic of the Congo": "DR Congo",
  "United Republic of Tanzania": "Tanzania",
  "Central African Republic": "C.A.R.",
  "Saint Vincent and the Grenadines": "St. Vincent",
  "Bosnia and Herzegovina": "Bosnia",
  "São Tomé and Príncipe": "São Tomé",
  "Antigua and Barbuda": "Antigua",
  "Trinidad and Tobago": "Trinidad",
  "Saint Kitts and Nevis": "St. Kitts",
  "United Arab Emirates": "UAE",
  "Dominican Republic": "Dom. Rep.",
  "Equatorial Guinea": "Eq. Guinea",
  "Papua New Guinea": "Papua N.G.",
  "North Macedonia": "N. Macedonia",
  "Marshall Islands": "Marshalls",
  "Solomon Islands": "Solomons",
  "Côte d'Ivoire": "Ivory Coast",
};
