/**
 * Country-name redaction — strip a target country's name and demonyms from a clue.
 *
 * Pure utility used by the clue pipeline so the player has to *deduce* the next
 * country instead of reading it. The DEMONYM_MAP is content-shaped but lives here
 * because it's only ever used by these two functions.
 */

const DEMONYM_MAP = {
  'Afghanistan': ['Afghan'],
  'Albania': ['Albanian'],
  'Algeria': ['Algerian'],
  'Argentina': ['Argentine', 'Argentinian'],
  'Armenia': ['Armenian'],
  'Australia': ['Australian'],
  'Austria': ['Austrian'],
  'Azerbaijan': ['Azerbaijani', 'Azeri'],
  'Bangladesh': ['Bangladeshi'],
  'Belarus': ['Belarusian'],
  'Belgium': ['Belgian'],
  'Bolivia': ['Bolivian'],
  'Bosnia and Herzegovina': ['Bosnian', 'Herzegovinian'],
  'Brazil': ['Brazilian'],
  'Bulgaria': ['Bulgarian'],
  'Cambodia': ['Cambodian'],
  'Cameroon': ['Cameroonian'],
  'Canada': ['Canadian'],
  'Chile': ['Chilean'],
  'China': ['Chinese'],
  'Colombia': ['Colombian'],
  'Congo': ['Congolese'],
  'Costa Rica': ['Costa Rican'],
  'Croatia': ['Croatian'],
  'Cuba': ['Cuban'],
  'Cyprus': ['Cypriot'],
  'Czech Republic': ['Czech'],
  'Democratic Republic of the Congo': ['Congolese'],
  'Denmark': ['Danish', 'Dane'],
  'Dominican Republic': ['Dominican'],
  'Ecuador': ['Ecuadorian'],
  'Egypt': ['Egyptian'],
  'El Salvador': ['Salvadoran'],
  'Estonia': ['Estonian'],
  'Ethiopia': ['Ethiopian'],
  'Finland': ['Finnish', 'Finn'],
  'France': ['French'],
  'Georgia': ['Georgian'],
  'Germany': ['German'],
  'Ghana': ['Ghanaian'],
  'Greece': ['Greek'],
  'Guatemala': ['Guatemalan'],
  'Honduras': ['Honduran'],
  'Hungary': ['Hungarian'],
  'Iceland': ['Icelandic'],
  'India': ['Indian'],
  'Indonesia': ['Indonesian'],
  'Iran': ['Iranian', 'Persian'],
  'Iraq': ['Iraqi'],
  'Ireland': ['Irish'],
  'Israel': ['Israeli'],
  'Italy': ['Italian'],
  'Jamaica': ['Jamaican'],
  'Japan': ['Japanese'],
  'Jordan': ['Jordanian'],
  'Kazakhstan': ['Kazakh'],
  'Kenya': ['Kenyan'],
  'Kuwait': ['Kuwaiti'],
  'Kyrgyzstan': ['Kyrgyz'],
  'Laos': ['Laotian', 'Lao'],
  'Latvia': ['Latvian'],
  'Lebanon': ['Lebanese'],
  'Libya': ['Libyan'],
  'Lithuania': ['Lithuanian'],
  'Malaysia': ['Malaysian'],
  'Mexico': ['Mexican'],
  'Moldova': ['Moldovan'],
  'Mongolia': ['Mongolian'],
  'Montenegro': ['Montenegrin'],
  'Morocco': ['Moroccan'],
  'Mozambique': ['Mozambican'],
  'Myanmar': ['Burmese', 'Myanmar'],
  'Nepal': ['Nepali', 'Nepalese'],
  'Netherlands': ['Dutch', 'Netherlander'],
  'New Zealand': ['New Zealand'],
  'Nicaragua': ['Nicaraguan'],
  'Nigeria': ['Nigerian'],
  'North Korea': ['North Korean'],
  'North Macedonia': ['Macedonian'],
  'Norway': ['Norwegian'],
  'Oman': ['Omani'],
  'Pakistan': ['Pakistani'],
  'Panama': ['Panamanian'],
  'Paraguay': ['Paraguayan'],
  'Peru': ['Peruvian'],
  'Philippines': ['Filipino', 'Philippine'],
  'Poland': ['Polish', 'Pole'],
  'Portugal': ['Portuguese'],
  'Qatar': ['Qatari'],
  'Romania': ['Romanian'],
  'Russia': ['Russian'],
  'Saudi Arabia': ['Saudi'],
  'Senegal': ['Senegalese'],
  'Serbia': ['Serbian'],
  'Slovakia': ['Slovak'],
  'Slovenia': ['Slovenian'],
  'Somalia': ['Somali'],
  'South Africa': ['South African'],
  'South Korea': ['South Korean', 'Korean'],
  'Spain': ['Spanish'],
  'Sri Lanka': ['Sri Lankan'],
  'Sudan': ['Sudanese'],
  'Sweden': ['Swedish', 'Swede'],
  'Switzerland': ['Swiss'],
  'Syria': ['Syrian'],
  'Taiwan': ['Taiwanese'],
  'Tajikistan': ['Tajik'],
  'Tanzania': ['Tanzanian'],
  'Thailand': ['Thai'],
  'Tunisia': ['Tunisian'],
  'Turkey': ['Turkish', 'Turk'],
  'Turkmenistan': ['Turkmen'],
  'Uganda': ['Ugandan'],
  'Ukraine': ['Ukrainian'],
  'United Arab Emirates': ['Emirati'],
  'United Kingdom': ['British', 'UK'],
  'United States': ['American', 'US', 'U.S.'],
  'Uruguay': ['Uruguayan'],
  'Uzbekistan': ['Uzbek'],
  'Venezuela': ['Venezuelan'],
  'Vietnam': ['Vietnamese'],
  'Yemen': ['Yemeni'],
  'Zambia': ['Zambian'],
  'Zimbabwe': ['Zimbabwean'],
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Replace the country's name with "this country" and its demonyms with "local". */
export function redactCountryName(text, country) {
  let result = text;
  result = result.replace(new RegExp(`\\b${escapeRegex(country)}\\b`, 'gi'), 'this country');
  const demonyms = DEMONYM_MAP[country] || [];
  for (const dem of demonyms) {
    result = result.replace(new RegExp(`\\b${escapeRegex(dem)}\\b`, 'gi'), 'local');
  }
  return result;
}

/** Safety check — true if the country's name or any of its demonyms still appears in the text. */
export function containsCountryName(text, country) {
  const lower = text.toLowerCase();
  if (lower.includes(country.toLowerCase())) return true;
  const demonyms = DEMONYM_MAP[country] || [];
  for (const dem of demonyms) {
    if (lower.includes(dem.toLowerCase())) return true;
  }
  return false;
}
