/**
 * One-time script to remove duplicate/near-duplicate facts from country-facts.json.
 * For each duplicate pair, keeps the better version or a combined version.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const factsPath = path.join(ROOT, 'data', 'country-facts.json');
const facts = JSON.parse(fs.readFileSync(factsPath, 'utf-8'));

// Map of country → array of fact texts to remove (exact match)
// After removal, the surviving fact is either already good or replaced below.
const REMOVALS = {};
const REPLACEMENTS = {};

function remove(country, substr) {
  if (!REMOVALS[country]) REMOVALS[country] = [];
  REMOVALS[country].push(substr);
}

function replace(country, substr, newFact, category) {
  if (!REPLACEMENTS[country]) REPLACEMENTS[country] = [];
  REPLACEMENTS[country].push({ substr, newFact, category });
}

// --- Algeria: keep the richer original, remove geo dupe ---
remove("Algeria", "Algeria is the largest country in Africa by area, and over 80%");

// --- Argentina: keep the original (has both highest+lowest), remove geo dupe ---
remove("Argentina", "Argentina contains the lowest point in the Western Hemisphere");

// --- Bangladesh: keep the original (more detail about tigers), remove geo dupe ---
remove("Bangladesh", "The Sundarbans, shared with India, is the largest mangrove forest");

// --- Benin: combine into one better version ---
remove("Benin", "The village of Ganvié, built entirely on stilts");
replace("Benin", "Ganvié, a village built entirely on stilts", "Ganvié, a village of 30,000 people built entirely on stilts in Lake Nokoué, has been inhabited for over 400 years and is often called 'the Venice of Africa.'", "geography");

// --- Botswana: keep the original (has 1,200 km detail), remove geo dupe ---
remove("Botswana", "The Okavango Delta is the world's largest inland delta — its waters never reach the sea");

// --- Burundi: keep original (has hill name Kasumo), remove geo dupe ---
remove("Burundi", "A spring near the town of Rutovu");

// --- Cabo Verde: combine ---
remove("Cabo Verde", "Pico do Fogo, an active volcano that last erupted in 2014, rises to 2,829 metres");
replace("Cabo Verde", "Pico do Fogo, an active volcano on Fogo Island", "Pico do Fogo, an active volcano on Fogo Island, rises to 2,829 meters and last erupted in 2014, destroying an entire village inside its caldera — residents returned to rebuild among the lava flows.", "geography");

// --- Cameroon: keep geo dupe (has 'deadly cloud' and numbers), remove original ---
remove("Cameroon", "Lake Nyos, a crater lake, catastrophically released");

// --- Central African Republic: keep original (has Dzanga Bai name), remove geo dupe ---
remove("Central African Republic", "The Dzanga-Sangha forest clearing attracts over 100");

// --- Colombia: keep original (has more color), remove geo dupe ---
remove("Colombia", "Caño Cristales, known as 'the River of Five Colors,'");

// --- Comoros: combine ---
remove("Comoros", "Mount Karthala on Grande Comore is one of the world's most active volcanoes, having erupted");
replace("Comoros", "Mount Karthala on Grande Comore is one of the world's most active volcanoes and its crater", "Mount Karthala on Grande Comore is one of the world's most active volcanoes, having erupted more than 20 times since the 19th century — its crater is 3 km wide, one of the largest active calderas on Earth.", "geography");

// --- Costa Rica: keep original (more concise), remove geo dupe ---
remove("Costa Rica", "Costa Rica contains nearly 6% of the world's biodiversity");

// --- Côte d'Ivoire: keep original (more detail about surpassing), remove geo dupe ---
remove("Côte d'Ivoire", "The Basilica of Our Lady of Peace in Yamoussoukro is the largest church in the world by area, modeled");

// --- Dominica: keep original (has more temp detail), remove geo dupe ---
remove("Dominica", "Dominica's Boiling Lake is the second-largest thermally active lake");

// --- Ecuador: keep original, remove geo dupe (nearly identical) ---
remove("Ecuador", "Due to the equatorial bulge, the summit of Mount Chimborazo");

// --- El Salvador: combine ---
remove("El Salvador", "It is the smallest country in Central America yet the most densely populated");
replace("El Salvador", "El Salvador is the smallest and most densely populated country in Central America", "El Salvador is the smallest and most densely populated country in Central America, with about 300 people per square kilometre, yet it has over 20 volcanoes within its borders.", "geography");

// --- Eswatini: keep geo dupe (has dates), remove original ---
remove("Eswatini", "Ngwenya Mine has evidence of iron ore extraction dating back 43,000 years");

// --- Gabon: keep original (has ratio detail), remove geo dupe ---
remove("Gabon", "About 88% of Gabon is covered by rainforest");

// --- Gambia: keep original (has 48km detail), remove geo dupe ---
remove("Gambia", "The Gambia is the smallest country on mainland Africa and is shaped");

// --- Ghana: keep geo dupe (has sq km), remove original ---
remove("Ghana", "Lake Volta, created by the Akosombo Dam in 1965, is the world's largest artificial lake by surface area at approximately");

// --- Guatemala: keep original (has more detail), remove geo dupe ---
remove("Guatemala", "Guatemala's Lake Atitlán, surrounded by three volcanoes");

// --- Guinea: keep original (has river names first), remove geo dupe ---
remove("Guinea", "The Fouta Djallon highlands are the source of several major");

// --- Guinea-Bissau: combine ---
remove("Guinea-Bissau", "The Bijagós Archipelago is a UNESCO Biosphere Reserve where saltwater hippopotamuses");
replace("Guinea-Bissau", "The Bijagós Archipelago, with over 80 islands", "The Bijagós Archipelago, with over 80 islands, is a UNESCO Biosphere Reserve and one of the largest virtually untouched island groups in the world — saltwater hippopotamuses swim between its islands.", "geography");

// --- Guyana: keep original (has metres, more precise), remove geo dupe ---
remove("Guyana", "Kaieteur Falls drops 226 meters in a single plunge");

// --- Honduras: keep geo dupe (adds Australia comparison), remove original ---
remove("Honduras", "The Bay Islands (Roatán, Utila, Guanaja) sit on the Mesoamerican Barrier Reef");

// --- Hungary: keep geo dupe (has cave system detail), remove original ---
remove("Hungary", "The country has more thermal springs than almost any other");

// --- Iraq: keep geo dupe (has Ma'dan detail), remove original ---
remove("Iraq", "The Marshes of southern Iraq, drained by Saddam Hussein in the 1990s");

// --- Ireland: keep original (has metres), remove geo dupe (nearly identical) ---
remove("Ireland", "The Cliffs of Moher rise 214 meters above the Atlantic");

// --- Kazakhstan: keep geo dupe (has sq km figure), remove original ---
remove("Kazakhstan", "It is the largest landlocked country in the world — its area is larger");

// --- Kyrgyzstan: nearly identical, keep geo dupe (has more detail), remove original ---
remove("Kyrgyzstan", "Issyk-Kul is the second-largest alpine lake in the world after Titicaca and never freezes despite being surrounded by snow");

// --- Liechtenstein: nearly identical, keep original, remove geo dupe ---
remove("Liechtenstein", "Liechtenstein is one of only two doubly landlocked countries");

// --- Malawi: nearly identical, keep original (has 'in the world'), remove geo dupe ---
remove("Malawi", "Lake Malawi contains more species of fish than any other lake on Earth");

// --- Malaysia: keep geo dupe (has 'by area'), remove original ---
remove("Malaysia", "Borneo's Gunung Mulu National Park contains the world's largest cave chamber");

// --- Mauritania: keep geo dupe (has 50km, more info), remove original ---
remove("Mauritania", "The Eye of the Sahara (Richat Structure) is a 40-km-wide");

// --- Micronesia: keep original (has 'ruined city'), remove geo dupe ---
remove("Micronesia", "The ancient city of Nan Madol, built on 92 artificial islets");

// --- Moldova: three versions! keep the geo one (most detail), remove other two ---
remove("Moldova", "The Mileștii Mici wine cellar holds the Guinness World Record");
remove("Moldova", "It is home to the Mileștii Mici winery");

// --- Mongolia: keep original (has 30% stat), remove geo dupe ---
remove("Mongolia", "Mongolia is the most sparsely populated sovereign country");

// --- Montenegro: keep original (has metres), remove geo dupe ---
remove("Montenegro", "The Tara River Canyon is the deepest canyon in Europe at 1,300 meters");

// --- Mozambique: keep original, remove geo dupe ---
remove("Mozambique", "The Bazaruto Archipelago off Mozambique's coast protects");

// --- Namibia: keep geo dupe (has Deadvlei detail), remove original ---
remove("Namibia", "The Namib Desert is considered the oldest desert in the world, having been arid for roughly 55-80 million years.");

// --- Nepal: keep geo dupe (has 'highest point on Earth'), remove original ---
remove("Nepal", "The country contains eight of the world's fourteen peaks over 8,000 metres");

// --- North Macedonia: keep geo dupe (has 288m depth, species), remove original ---
remove("North Macedonia", "Lake Ohrid is one of the oldest and deepest lakes in Europe, dating back 2-3 million years, and contains numerous endemi");

// --- Pakistan: keep geo dupe (has pass name), remove original ---
remove("Pakistan", "The Karakoram Highway, linking the country to China, is the highest paved international road");

// --- Palau: keep original (more poetic), remove geo dupe ---
remove("Palau", "Palau's Jellyfish Lake contains millions of golden jellyfish that have lost");

// --- Panama: keep original, remove geo dupe (nearly identical) ---
remove("Panama", "Panama is the only place in the world where you can watch the sun rise");

// --- Paraguay: keep geo dupe (has TWh figure), remove original ---
remove("Paraguay", "The Itaipu Dam on the Paraguay-Brazil border is one of the most powerful hydroelectric plants");

// --- Peru: keep geo dupe (simpler, has Grand Canyon comparison), remove original ---
remove("Peru", "Cotahuasi Canyon, at over 3,354 metres deep");

// --- Philippines: keep original (has 'flows through cave'), remove geo dupe ---
remove("Philippines", "The Philippines' Puerto Princesa Underground River is 8.2 km long");

// --- Poland: nearly identical, keep geo dupe (has 'continuously'), remove original ---
remove("Poland", "The Wieliczka Salt Mine near Kraków has been operating since the 13th century and contains an entire underground cathedr");

// --- Russia: keep geo dupe (has age + depth), remove original ---
remove("Russia", "Lake Baikal in Siberia is the deepest lake in the world (1,642 m)");

// --- Saint Kitts and Nevis: keep original (has population figure), remove geo dupe ---
remove("Saint Kitts and Nevis", "Saint Kitts and Nevis is the smallest sovereign state in the Americas");

// --- Sao Tome and Principe: keep geo dupe (simpler, vivid), remove original ---
remove("Sao Tome and Principe", "Pico Cão Grande, a 370-metre volcanic plug rising from the jungle floor");

// --- Saudi Arabia: keep geo dupe (has sq km + dune height), remove original ---
remove("Saudi Arabia", "The Empty Quarter (Rub' al Khali) is the largest continuous sand desert");

// --- Seychelles: keep original (has 'plant kingdom'), remove geo dupe ---
remove("Seychelles", "The Seychelles' Vallée de Mai on Praslin Island is home to the coco de mer palm");

// --- Slovakia: nearly identical, keep geo dupe (has 425 mansions), remove original ---
remove("Slovakia", "The country has more castles and chateaux per capita than any other country in the world — over 180 for a population");

// --- Solomon Islands: keep geo dupe (has sharks), remove original ---
remove("Solomon Islands", "Kavachi, an active submarine volcano, is one of the most active in the Pacific and occasionally");

// --- Somalia: keep original, remove geo dupe ---
remove("Somalia", "Somalia has the longest coastline of any mainland African country");

// --- South Africa: keep geo dupe (has 1,470 species), remove original ---
remove("South Africa", "Table Mountain in Cape Town is estimated to be one of the oldest");

// --- Sri Lanka: keep geo dupe (vivid 'giant footprint'), remove original ---
remove("Sri Lanka", "Adam's Peak (Sri Pada) features a boulder at its summit");

// --- Tajikistan: keep geo dupe (has 93% stat + glacier), remove original ---
remove("Tajikistan", "The Fedchenko Glacier is the longest glacier outside the polar regions, stretching 77 km");

// --- Tonga: keep geo dupe (has 'circled globe multiple times'), remove original ---
remove("Tonga", "The Hunga Tonga–Hunga Ha'apai volcanic eruption in January 2022");

// --- Trinidad and Tobago: keep geo dupe (vivid 'bubbling liquid bitumen'), remove original ---
remove("Trinidad and Tobago", "Pitch Lake in southwest Trinidad is the world's largest natural deposit");

// --- Uruguay: keep original (has year + context), remove geo dupe which is less detailed ---
remove("Uruguay", "It was the first country in the world to fully legalize the production");

// --- Vanuatu: nearly identical, keep geo dupe, remove original ---
remove("Vanuatu", "Mount Yasur on Tanna Island has been erupting continuously for over 800 years and is one of the most");

// --- Yemen: Shibam - keep original (has 'as early as' dating), remove geo dupe ---
remove("Yemen", 'The city of Shibam is known as the "Manhattan of the Desert"');
// Socotra - keep geo dupe (has dragon blood trees detail), remove original ---
remove("Yemen", "Socotra Island, 350 km south of the mainland, has such unique flora");

// --- Zimbabwe: hyperinflation - keep original (has 'loaf of bread'), remove dupe ---
remove("Zimbabwe", "At one point during its hyperinflation crisis, the government issued");

// --- Palestine (territory, not in our 194, but clean up anyway) ---
remove("Palestine", "The city of Jericho is believed to be the oldest continuously inhabited city");

// ============================================================
// Apply removals
// ============================================================
let totalRemoved = 0;
for (const [country, substrings] of Object.entries(REMOVALS)) {
  if (!facts[country]) continue;
  const before = facts[country].length;
  facts[country] = facts[country].filter(entry => {
    return !substrings.some(sub => entry.fact.startsWith(sub));
  });
  totalRemoved += before - facts[country].length;
}

// Apply replacements (find fact starting with substr, replace it)
let totalReplaced = 0;
for (const [country, replacements] of Object.entries(REPLACEMENTS)) {
  if (!facts[country]) continue;
  for (const { substr, newFact, category } of replacements) {
    const idx = facts[country].findIndex(e => e.fact.startsWith(substr));
    if (idx !== -1) {
      facts[country][idx] = { fact: newFact, category };
      totalReplaced++;
    }
  }
}

fs.writeFileSync(factsPath, JSON.stringify(facts, null, 2) + '\n', 'utf-8');
console.log(`✅ Removed ${totalRemoved} duplicate facts, replaced/combined ${totalReplaced} facts.`);

// Verify no remaining near-dupes
let remaining = 0;
for (const [country, entries] of Object.entries(facts)) {
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i].fact.toLowerCase();
      const b = entries[j].fact.toLowerCase();
      const wordsA = new Set(a.split(/\W+/).filter(w => w.length > 5));
      const wordsB = new Set(b.split(/\W+/).filter(w => w.length > 5));
      const overlap = [...wordsA].filter(w => wordsB.has(w));
      const ratio = overlap.length / Math.min(wordsA.size, wordsB.size);
      if (ratio > 0.5 && overlap.length >= 4) {
        console.log(`⚠ Possible remaining dupe in ${country}: [${i}] vs [${j}]`);
        console.log(`  ${entries[i].fact.substring(0, 90)}`);
        console.log(`  ${entries[j].fact.substring(0, 90)}`);
        remaining++;
      }
    }
  }
}
if (remaining === 0) console.log('✅ No remaining near-duplicates detected.');
