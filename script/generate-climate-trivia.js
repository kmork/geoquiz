/**
 * One-time script to:
 * 1. Add "climate" field to all 194 UN countries in data/countries.json
 * 2. Add one geographical trivia fact to each country in data/country-facts.json
 *
 * Usage: node script/generate-climate-trivia.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const DATA = {
  "Afghanistan": {
    climate: "Arid continental",
    trivia: "Afghanistan's Wakhan Corridor is a narrow strip of land only 13 km wide at its narrowest, created as a buffer zone between the British and Russian empires in the 19th century."
  },
  "Albania": {
    climate: "Mediterranean",
    trivia: "Albania has over 3,000 canyons, making it one of Europe's most canyon-rich countries — the Osum Canyon is sometimes called the 'Grand Canyon of Albania.'"
  },
  "Algeria": {
    climate: "Arid desert",
    trivia: "Algeria is the largest country in Africa by area, and over 80% of its land is covered by the Sahara Desert."
  },
  "Andorra": {
    climate: "Alpine",
    trivia: "Andorra has no airport, railway, or motorway — it is one of the few countries accessible only by road."
  },
  "Angola": {
    climate: "Tropical",
    trivia: "The Kalandula Falls are nearly twice the width of Niagara Falls, yet remain relatively unknown to the outside world."
  },
  "Antigua and Barbuda": {
    climate: "Tropical maritime",
    trivia: "Antigua has exactly 365 beaches — one for every day of the year — though most of them are made of coral sand rather than volcanic rock."
  },
  "Argentina": {
    climate: "Varied (subtropical to subpolar)",
    trivia: "Argentina contains the lowest point in the Western Hemisphere: Laguna del Carbón at 105 meters below sea level, in a salt flat in Patagonia."
  },
  "Armenia": {
    climate: "Continental highland",
    trivia: "Lake Sevan, at 1,900 meters above sea level, is one of the largest high-altitude freshwater lakes in the world."
  },
  "Australia": {
    climate: "Varied (tropical to arid)",
    trivia: "Australia's Great Barrier Reef is the largest living structure on Earth, visible from space and stretching over 2,300 km along the Queensland coast."
  },
  "Austria": {
    climate: "Alpine continental",
    trivia: "The Eisriesenwelt in Salzburg is the world's largest ice cave system, extending over 42 km into the Tennengebirge mountains."
  },
  "Azerbaijan": {
    climate: "Semi-arid to subtropical",
    trivia: "Azerbaijan has more mud volcanoes than any other country — about 350 of the world's estimated 700 are found here."
  },
  "Bahamas": {
    climate: "Tropical maritime",
    trivia: "Dean's Blue Hole on Long Island, at 202 meters deep, is the second-deepest known underwater sinkhole in the world."
  },
  "Bahrain": {
    climate: "Arid desert",
    trivia: "Bahrain is an archipelago of 33 islands, yet the entire country is smaller than the city of Houston, Texas."
  },
  "Bangladesh": {
    climate: "Tropical monsoon",
    trivia: "The Sundarbans, shared with India, is the largest mangrove forest in the world and home to the Bengal tiger."
  },
  "Barbados": {
    climate: "Tropical maritime",
    trivia: "Barbados is the most easterly Caribbean island and is actually situated in the Atlantic Ocean, not the Caribbean Sea."
  },
  "Belarus": {
    climate: "Continental",
    trivia: "Belarus has over 11,000 lakes and 20,000 rivers — the Pripyat Marshes form Europe's largest wetland, sometimes called 'the Lungs of Europe.'"
  },
  "Belgium": {
    climate: "Temperate maritime",
    trivia: "Belgium's coastline is only 67 km long — one of the shortest in the world — yet it has an unbroken tram line running its entire length."
  },
  "Belize": {
    climate: "Tropical",
    trivia: "The Great Blue Hole off Belize's coast is a giant marine sinkhole over 300 meters across and 125 meters deep, visible from space."
  },
  "Benin": {
    climate: "Tropical",
    trivia: "Ganvié, a village built entirely on stilts in Lake Nokoué, is often called 'the Venice of Africa' and has been inhabited for over 400 years."
  },
  "Bhutan": {
    climate: "Varies by altitude (tropical to alpine)",
    trivia: "Bhutan's elevation ranges from just 97 meters in the south to 7,570 meters at Gangkhar Puensum — the highest unclimbed mountain in the world, as climbing it is banned."
  },
  "Bolivia": {
    climate: "Varies by altitude (tropical to cold highland)",
    trivia: "Bolivia's Salar de Uyuni is the world's largest salt flat at over 10,000 square km — so flat that it's used to calibrate satellite altimeters."
  },
  "Bosnia and Herzegovina": {
    climate: "Continental to Mediterranean",
    trivia: "The Neretva River near Mostar is one of the cleanest rivers in Europe, with water so clear you can see the riverbed at depths of several meters."
  },
  "Botswana": {
    climate: "Semi-arid",
    trivia: "The Okavango Delta is the world's largest inland delta — its waters never reach the sea, instead evaporating in the Kalahari Desert."
  },
  "Brazil": {
    climate: "Tropical",
    trivia: "The Amazon River discharges more water into the ocean than the next seven largest rivers combined — about 20% of all fresh water entering the world's oceans."
  },
  "Brunei": {
    climate: "Tropical equatorial",
    trivia: "Brunei is split into two separate pieces of land by a wedge of Malaysian territory — the Limbang district divides the country in half."
  },
  "Bulgaria": {
    climate: "Continental to Mediterranean",
    trivia: "Bulgaria's Belogradchik Rocks are a group of bizarrely shaped sandstone and limestone formations up to 200 meters tall, sculpted by 200 million years of erosion."
  },
  "Burkina Faso": {
    climate: "Tropical savanna",
    trivia: "Burkina Faso has one of the highest rates of deforestation in West Africa, yet the Mare aux Hippopotames ('Hippo Pool') is a rare oasis where hippos coexist with local fishermen."
  },
  "Burundi": {
    climate: "Tropical highland",
    trivia: "A spring near the town of Rutovu is one of the southernmost sources of the Nile River, making Burundi a contender for the Nile's ultimate origin."
  },
  "Cabo Verde": {
    climate: "Arid tropical",
    trivia: "Pico do Fogo, an active volcano on Fogo Island, rises to 2,829 meters and last erupted in 2014, destroying an entire village inside its caldera."
  },
  "Cambodia": {
    climate: "Tropical monsoon",
    trivia: "Tonlé Sap Lake doubles in size during the monsoon season, expanding from about 2,500 sq km to over 12,000 sq km — the flow of its river actually reverses direction."
  },
  "Cameroon": {
    climate: "Varies (tropical to semi-arid)",
    trivia: "Lake Nyos, a crater lake in Cameroon, released a deadly cloud of CO₂ in 1986 that suffocated over 1,700 people and 3,500 livestock in nearby villages."
  },
  "Canada": {
    climate: "Varies (arctic to temperate)",
    trivia: "Canada has the longest coastline of any country in the world at over 202,000 km — more than the next three countries combined."
  },
  "Central African Republic": {
    climate: "Tropical",
    trivia: "The Dzanga-Sangha forest clearing attracts over 100 forest elephants at a time to its mineral-rich muddy pools — one of the highest elephant concentrations in Central Africa."
  },
  "Chad": {
    climate: "Varies (desert to tropical)",
    trivia: "Lake Chad has shrunk by approximately 90% since the 1960s — from 25,000 sq km to around 1,500 sq km — one of the most dramatic environmental changes on Earth."
  },
  "Chile": {
    climate: "Varies (desert to subpolar)",
    trivia: "Chile is the longest north-to-south country in the world, stretching 4,300 km, but averages only 177 km wide — narrower than Florida at some points."
  },
  "China": {
    climate: "Varies (tropical to subarctic)",
    trivia: "China spans five time zones geographically but officially uses only one — Beijing Time — meaning the sun can rise as late as 10 AM in the far west."
  },
  "Colombia": {
    climate: "Tropical",
    trivia: "Caño Cristales, known as 'the River of Five Colors,' turns bright red, yellow, green, blue, and black each year due to aquatic plants on its riverbed."
  },
  "Comoros": {
    climate: "Tropical maritime",
    trivia: "Mount Karthala on Grande Comore is one of the world's most active volcanoes and its crater — 3 km wide — is one of the largest active calderas on Earth."
  },
  "Congo": {
    climate: "Tropical equatorial",
    trivia: "The Congo River is the deepest river in the world, reaching depths of over 220 meters — deep enough to submerge a 70-story building."
  },
  "Costa Rica": {
    climate: "Tropical",
    trivia: "Costa Rica contains nearly 6% of the world's biodiversity despite covering only 0.03% of the planet's surface area."
  },
  "Côte d'Ivoire": {
    climate: "Tropical",
    trivia: "The Basilica of Our Lady of Peace in Yamoussoukro is the largest church in the world by area, modeled after St. Peter's Basilica in Rome but even taller."
  },
  "Croatia": {
    climate: "Mediterranean to continental",
    trivia: "Croatia has over 1,200 islands along its Adriatic coast, but only about 50 are permanently inhabited."
  },
  "Cuba": {
    climate: "Tropical",
    trivia: "Cuba is the largest island in the Caribbean and is actually longer than the distance from London to Paris — stretching 1,250 km from end to end."
  },
  "Cyprus": {
    climate: "Mediterranean",
    trivia: "Cyprus's Troodos Mountains contain one of the most complete ophiolite complexes in the world — ancient ocean floor pushed above sea level by tectonic forces."
  },
  "Czechia": {
    climate: "Temperate continental",
    trivia: "Czechia is one of only a few landlocked countries with a navy — its 'fleet' operates on rivers and reservoirs for training and ceremonial purposes."
  },
  "Democratic Republic of the Congo": {
    climate: "Tropical equatorial",
    trivia: "The Congo Basin rainforest is the second-largest tropical rainforest in the world after the Amazon, and it absorbs more CO₂ than the Amazon emits."
  },
  "Denmark": {
    climate: "Temperate maritime",
    trivia: "Denmark's highest natural point, Møllehøj, is only 170.86 meters above sea level — making it one of the flattest countries in the world."
  },
  "Djibouti": {
    climate: "Arid desert",
    trivia: "Lake Assal in Djibouti, at 155 meters below sea level, is the lowest point in Africa and one of the saltiest bodies of water on Earth — ten times saltier than the ocean."
  },
  "Dominica": {
    climate: "Tropical",
    trivia: "Dominica's Boiling Lake is the second-largest thermally active lake in the world — its water temperature reaches 82–92°C at the edges."
  },
  "Dominican Republic": {
    climate: "Tropical",
    trivia: "Pico Duarte at 3,098 meters is the highest peak in the entire Caribbean, while the nearby Lake Enriquillo at 46 meters below sea level is the lowest point."
  },
  "Ecuador": {
    climate: "Varies (tropical to alpine)",
    trivia: "Due to the equatorial bulge, the summit of Mount Chimborazo (6,263 m) is the farthest point from the Earth's center — farther than the top of Everest."
  },
  "Egypt": {
    climate: "Arid desert",
    trivia: "Only about 5% of Egypt's land is inhabited — nearly the entire population lives along the narrow Nile Valley and Delta."
  },
  "El Salvador": {
    climate: "Tropical",
    trivia: "El Salvador is the smallest and most densely populated country in Central America, yet it has over 20 volcanoes within its borders."
  },
  "Equatorial Guinea": {
    climate: "Tropical",
    trivia: "Equatorial Guinea's capital, Malabo, is located on Bioko Island rather than the mainland — one of only a few countries with an island capital separated from its mainland territory."
  },
  "Eritrea": {
    climate: "Arid to semi-arid",
    trivia: "The Danakil Depression in Eritrea's border region is one of the hottest places on Earth, with average temperatures exceeding 34°C and volcanic activity creating neon-colored sulfur springs."
  },
  "Estonia": {
    climate: "Temperate maritime",
    trivia: "Estonia has over 1,500 islands and more than 1,400 lakes — despite being one of Europe's smallest countries by population."
  },
  "Eswatini": {
    climate: "Varies (tropical to temperate)",
    trivia: "Eswatini's Ngwenya Mine is one of the oldest known mines in the world, with evidence of iron ore extraction dating back 43,000 years."
  },
  "Ethiopia": {
    climate: "Tropical highland",
    trivia: "Ethiopia's Danakil Depression contains the Dallol hydrothermal field — the lowest land volcano on Earth at 48 meters below sea level, with surreal neon-colored mineral formations."
  },
  "Fiji": {
    climate: "Tropical maritime",
    trivia: "Fiji comprises over 330 islands, but only about 110 are permanently inhabited — the rest range from tiny sand cays to volcanic islets."
  },
  "Finland": {
    climate: "Subarctic to temperate",
    trivia: "Finland has approximately 188,000 lakes — earning it the nickname 'Land of a Thousand Lakes,' though the real number is nearly 200 times that."
  },
  "France": {
    climate: "Temperate oceanic to Mediterranean",
    trivia: "France spans more time zones than any other country — 12 in total — thanks to its overseas territories scattered across the Atlantic, Pacific, Indian Ocean, and Antarctica."
  },
  "Gabon": {
    climate: "Tropical equatorial",
    trivia: "About 88% of Gabon is covered by rainforest, giving it one of the highest forest-cover percentages of any country in the world."
  },
  "Gambia": {
    climate: "Tropical savanna",
    trivia: "The Gambia is the smallest country on mainland Africa and is shaped like a long finger — just 50 km wide at its broadest point, stretching 450 km along the Gambia River."
  },
  "Georgia": {
    climate: "Subtropical to alpine",
    trivia: "Veryovkina Cave in Georgia's Arabika Massif is the deepest known cave on Earth, descending 2,212 meters below the surface."
  },
  "Germany": {
    climate: "Temperate oceanic to continental",
    trivia: "Germany's Black Forest region contains over 23,000 km of marked hiking trails and is the source of the Danube, one of Europe's longest rivers."
  },
  "Ghana": {
    climate: "Tropical",
    trivia: "Lake Volta, created by the Akosombo Dam, is the world's largest artificial lake by surface area, covering 8,502 square km."
  },
  "Greece": {
    climate: "Mediterranean",
    trivia: "Greece has more coastline than any other Mediterranean country — over 13,600 km — due to its 6,000+ islands and deeply indented mainland."
  },
  "Grenada": {
    climate: "Tropical maritime",
    trivia: "Grenada's underwater sculpture park in Molinière Bay was the world's first, with over 65 sculptures that have become artificial coral reefs."
  },
  "Guatemala": {
    climate: "Tropical to temperate highland",
    trivia: "Guatemala's Lake Atitlán, surrounded by three volcanoes, was described by Aldous Huxley as 'the most beautiful lake in the world' — it fills an enormous volcanic caldera."
  },
  "Guinea": {
    climate: "Tropical",
    trivia: "The Fouta Djallon highlands are the source of several major West African rivers including the Niger, Senegal, and Gambia — earning the region the nickname 'Water Tower of West Africa.'"
  },
  "Guinea-Bissau": {
    climate: "Tropical",
    trivia: "The Bijagós Archipelago, with over 80 islands, is one of the largest virtually untouched island groups in the world and a UNESCO Biosphere Reserve."
  },
  "Guyana": {
    climate: "Tropical",
    trivia: "Kaieteur Falls drops 226 meters in a single plunge — making it roughly five times the height of Niagara Falls and one of the most powerful waterfalls on Earth."
  },
  "Haiti": {
    climate: "Tropical",
    trivia: "Haiti and the Dominican Republic share the island of Hispaniola, and the border between them is visible from space — Haiti's deforested side contrasts sharply with the Dominican Republic's green forests."
  },
  "Honduras": {
    climate: "Tropical",
    trivia: "The Bay Islands of Honduras sit on the Mesoamerican Barrier Reef, the second-longest barrier reef in the world after Australia's Great Barrier Reef."
  },
  "Hungary": {
    climate: "Continental",
    trivia: "Hungary has the largest thermal water cave system in the world — Budapest alone sits above 120 natural hot springs."
  },
  "Iceland": {
    climate: "Subarctic oceanic",
    trivia: "Iceland sits on the Mid-Atlantic Ridge where the North American and Eurasian tectonic plates are pulling apart — the rift is visible at Þingvellir and widens about 2.5 cm per year."
  },
  "India": {
    climate: "Varies (tropical to alpine)",
    trivia: "Cherrapunji in northeastern India holds the record for the most rainfall in a single year — 26,471 mm (over 26 meters) — yet it also suffers water shortages in the dry season."
  },
  "Indonesia": {
    climate: "Tropical equatorial",
    trivia: "Indonesia has more active volcanoes than any other country — around 130 — and sits on the Pacific Ring of Fire, making it one of the most tectonically active places on Earth."
  },
  "Iran": {
    climate: "Arid to semi-arid",
    trivia: "The Dasht-e Lut desert in Iran recorded the highest ground surface temperature ever measured by satellite: 70.7°C in 2005."
  },
  "Iraq": {
    climate: "Arid desert",
    trivia: "The Mesopotamian Marshes in southern Iraq, once nearly drained by Saddam Hussein, have been partially restored and are home to the Ma'dan ('Marsh Arabs') who have lived on floating reed islands for 5,000 years."
  },
  "Ireland": {
    climate: "Temperate oceanic",
    trivia: "The Cliffs of Moher rise 214 meters above the Atlantic and on a clear day you can see the Aran Islands, Galway Bay, and the peaks of the Twelve Bens mountain range."
  },
  "Israel": {
    climate: "Mediterranean to arid",
    trivia: "The Dead Sea, on Israel's border with Jordan, is the lowest point on Earth's land surface at 430 meters below sea level and is so salty that swimmers float effortlessly."
  },
  "Italy": {
    climate: "Mediterranean",
    trivia: "Italy has more volcanoes than any other European country — including Etna, Stromboli, and Vesuvius — and Stromboli has been erupting almost continuously for over 2,000 years."
  },
  "Jamaica": {
    climate: "Tropical maritime",
    trivia: "Jamaica's Blue Mountains reach 2,256 meters and are home to a cloud forest that produces some of the world's most expensive coffee, grown in volcanic soil."
  },
  "Japan": {
    climate: "Varies (subtropical to subarctic)",
    trivia: "Japan is made up of 6,852 islands and has more earthquakes than almost any other country — roughly 1,500 per year, though most are too small to feel."
  },
  "Jordan": {
    climate: "Arid to semi-arid",
    trivia: "Wadi Rum's sandstone landscape was sculpted over millions of years into towering rock bridges and canyons — it was used as the filming location for Mars in several Hollywood movies."
  },
  "Kazakhstan": {
    climate: "Continental arid",
    trivia: "Kazakhstan is the world's largest landlocked country, covering 2.7 million sq km — larger than all of Western Europe combined."
  },
  "Kenya": {
    climate: "Varies (tropical to arid)",
    trivia: "Kenya's Great Rift Valley runs 6,000 km from Lebanon to Mozambique, and in Kenya it contains lakes that host millions of flamingos — Lake Nakuru can turn pink from their sheer numbers."
  },
  "Kiribati": {
    climate: "Tropical maritime",
    trivia: "Kiribati is the only country in the world situated in all four hemispheres — north, south, east, and west — as its islands straddle both the equator and the International Date Line."
  },
  "Kuwait": {
    climate: "Arid desert",
    trivia: "Kuwait's summer temperatures routinely exceed 50°C, making it one of the hottest countries on Earth — Mitribah recorded 53.9°C in 2016."
  },
  "Kyrgyzstan": {
    climate: "Continental",
    trivia: "Issyk-Kul is the world's second-largest alpine lake (after Titicaca by surface area at altitude) — it never freezes despite being surrounded by snow-capped mountains, due to slight salinity and thermal activity."
  },
  "Laos": {
    climate: "Tropical monsoon",
    trivia: "The Plain of Jars contains thousands of massive stone jars up to 3 meters tall scattered across the Xieng Khouang plateau — their purpose remains a mystery."
  },
  "Latvia": {
    climate: "Temperate maritime",
    trivia: "Latvia is one of the greenest countries in Europe — forests cover over 54% of its territory, and the country gains new forest area each year."
  },
  "Lebanon": {
    climate: "Mediterranean",
    trivia: "Lebanon's Jeita Grotto contains a 9 km underground river and a spectacular upper cavern — the grotto was a finalist for the New 7 Wonders of Nature."
  },
  "Lesotho": {
    climate: "Temperate highland",
    trivia: "Lesotho is the only country in the world that lies entirely above 1,000 meters elevation — its lowest point (1,400 m) is the highest low point of any country."
  },
  "Liberia": {
    climate: "Tropical",
    trivia: "Sapo National Park is the second-largest area of primary tropical rainforest in West Africa and home to pygmy hippos found almost nowhere else."
  },
  "Libya": {
    climate: "Arid desert",
    trivia: "Libya's Saharan region contains the Ubari Sand Sea, where ancient lakes are hidden between massive dunes — some are salty remnants of a much wetter Sahara thousands of years ago."
  },
  "Liechtenstein": {
    climate: "Alpine continental",
    trivia: "Liechtenstein is one of only two doubly landlocked countries in the world (surrounded only by other landlocked countries) — the other is Uzbekistan."
  },
  "Lithuania": {
    climate: "Temperate continental",
    trivia: "The geographical center of Europe, calculated by the French National Geographic Institute, is located just north of Vilnius, Lithuania."
  },
  "Luxembourg": {
    climate: "Temperate oceanic",
    trivia: "Luxembourg's Mullerthal region is called 'Little Switzerland' due to its dramatic sandstone rock formations and forested gorges — unusual for such a flat surrounding area."
  },
  "Madagascar": {
    climate: "Tropical",
    trivia: "Madagascar split from India around 88 million years ago — as a result, about 90% of its plant and animal species are found nowhere else on Earth."
  },
  "Malawi": {
    climate: "Tropical",
    trivia: "Lake Malawi contains more species of fish than any other lake on Earth — over 1,000 species of cichlid alone, most of which are endemic."
  },
  "Malaysia": {
    climate: "Tropical equatorial",
    trivia: "Sarawak Chamber in Gunung Mulu National Park is the world's largest known cave chamber by area — large enough to park 40 Boeing 747s inside."
  },
  "Maldives": {
    climate: "Tropical maritime",
    trivia: "The Maldives is the world's flattest country, with an average ground level of just 1.5 meters above sea level — no point in the entire nation exceeds 2.4 meters."
  },
  "Mali": {
    climate: "Arid to tropical savanna",
    trivia: "The Inner Niger Delta is one of the world's largest inland wetlands, flooding an area the size of Belgium each rainy season before shrinking back in the dry months."
  },
  "Malta": {
    climate: "Mediterranean",
    trivia: "Malta's megalithic temples date to around 3600 BC — roughly 1,000 years older than the Egyptian pyramids and among the oldest freestanding structures on Earth."
  },
  "Marshall Islands": {
    climate: "Tropical maritime",
    trivia: "Bikini Atoll's nuclear test crater is still visible from the air — the 1954 Castle Bravo hydrogen bomb test created a crater 2 km wide and 76 meters deep in the reef."
  },
  "Mauritania": {
    climate: "Arid desert",
    trivia: "The Richat Structure (Eye of the Sahara) is a 50 km-wide circular geological formation visible from space — once thought to be a meteorite crater, it is actually an eroded geological dome."
  },
  "Mauritius": {
    climate: "Tropical maritime",
    trivia: "The 'Underwater Waterfall' illusion off Mauritius's Le Morne peninsula is caused by sand and silt being swept off the coastal shelf — from the air it looks like a waterfall plunging into the abyss."
  },
  "Mexico": {
    climate: "Varies (arid to tropical)",
    trivia: "Mexico's Yucatán Peninsula contains the world's longest known underwater cave system, Sac Actun, stretching over 376 km through limestone passages."
  },
  "Micronesia": {
    climate: "Tropical maritime",
    trivia: "The ancient city of Nan Madol, built on 92 artificial islets in a lagoon, is sometimes called 'the Venice of the Pacific' — its basalt construction remains an engineering mystery."
  },
  "Moldova": {
    climate: "Temperate continental",
    trivia: "Mileștii Mici wine cellar holds the Guinness World Record for the largest wine collection — over 2 million bottles stored in 200 km of underground tunnels carved from limestone."
  },
  "Monaco": {
    climate: "Mediterranean",
    trivia: "Monaco is the world's most densely populated sovereign state, packing about 19,000 people per square km — and has expanded its land area by 20% through land reclamation from the sea."
  },
  "Mongolia": {
    climate: "Continental arid",
    trivia: "Mongolia is the most sparsely populated sovereign country in the world, with just 2 people per square km — and its eastern steppe is one of the last intact grassland ecosystems on Earth."
  },
  "Montenegro": {
    climate: "Mediterranean to continental",
    trivia: "The Tara River Canyon is the deepest canyon in Europe at 1,300 meters — and the second deepest in the world after the Grand Canyon."
  },
  "Morocco": {
    climate: "Mediterranean to arid",
    trivia: "The Erg Chebbi dunes near Merzouga reach heights of 150 meters and are constantly reshaped by wind — yet they sit just hours from snow-capped Atlas Mountain peaks."
  },
  "Mozambique": {
    climate: "Tropical",
    trivia: "The Bazaruto Archipelago off Mozambique's coast protects one of the last viable populations of dugongs in the Indian Ocean."
  },
  "Myanmar": {
    climate: "Tropical monsoon",
    trivia: "Myanmar's Hkakabo Razi at 5,881 meters is likely the highest peak in Southeast Asia, though its exact height is still debated and the summit was only first reached in 1996."
  },
  "Namibia": {
    climate: "Arid desert",
    trivia: "The Namib Desert is considered the world's oldest desert, having existed in arid conditions for at least 55 million years — its Deadvlei clay pan contains 900-year-old dead trees that still stand."
  },
  "Nauru": {
    climate: "Tropical maritime",
    trivia: "Nauru is the world's smallest republic by area (21 sq km) and the only country with no official capital city."
  },
  "Nepal": {
    climate: "Varies (tropical to alpine)",
    trivia: "Nepal contains eight of the world's fourteen peaks above 8,000 meters, including Mount Everest at 8,849 meters — the highest point on Earth."
  },
  "Netherlands": {
    climate: "Temperate maritime",
    trivia: "About one-third of the Netherlands lies below sea level — the lowest point, Zuidplaspolder, sits 7 meters below sea level, protected by an elaborate system of dikes and pumps."
  },
  "New Zealand": {
    climate: "Temperate oceanic",
    trivia: "New Zealand's Southern Alps on the South Island receive so much rain on their western side that the Milford Sound area gets over 6,800 mm annually — among the wettest inhabited places on Earth."
  },
  "Nicaragua": {
    climate: "Tropical",
    trivia: "Lake Nicaragua is one of the few freshwater lakes in the world with oceanic animals — bull sharks and sawfish have been found living in it, having traveled up the San Juan River."
  },
  "Niger": {
    climate: "Arid desert to semi-arid",
    trivia: "The Ténéré region of Niger is one of the most desolate parts of the Sahara — the famous 'Tree of Ténéré' was once considered the most isolated tree on Earth before being knocked down by a truck in 1973."
  },
  "Nigeria": {
    climate: "Varies (tropical to semi-arid)",
    trivia: "The Niger Delta is one of the world's largest river deltas and Africa's largest mangrove swamp, spanning over 70,000 sq km across nine Nigerian states."
  },
  "North Korea": {
    climate: "Continental",
    trivia: "Mount Paektu on the China-North Korea border contains Heaven Lake, one of the highest crater lakes in the world at 2,190 meters, formed by a massive eruption in 946 AD."
  },
  "North Macedonia": {
    climate: "Continental to Mediterranean",
    trivia: "Lake Ohrid is one of Europe's oldest and deepest lakes — over 3 million years old and 288 meters deep — harboring unique species found nowhere else."
  },
  "Norway": {
    climate: "Temperate to arctic",
    trivia: "Norway's coastline, with all its fjords and islands included, stretches over 100,000 km — enough to circle the Earth 2.5 times."
  },
  "Oman": {
    climate: "Arid desert",
    trivia: "Oman's Al Hoota Cave contains a 4 km underground lake and is home to a blind fish species found nowhere else on Earth."
  },
  "Pakistan": {
    climate: "Varies (arid to alpine)",
    trivia: "The Karakoram Highway connecting Pakistan to China crosses the Khunjerab Pass at 4,693 meters — the highest paved international border crossing in the world."
  },
  "Palau": {
    climate: "Tropical maritime",
    trivia: "Palau's Jellyfish Lake contains millions of golden jellyfish that have lost their sting over thousands of years of isolation — swimmers can float among them harmlessly."
  },
  "Panama": {
    climate: "Tropical",
    trivia: "Panama is the only place in the world where you can watch the sun rise over the Pacific Ocean and set over the Atlantic — due to its S-shaped isthmus."
  },
  "Papua New Guinea": {
    climate: "Tropical",
    trivia: "Papua New Guinea is the most linguistically diverse country on Earth, with over 840 living languages — about 12% of all languages spoken in the world."
  },
  "Paraguay": {
    climate: "Subtropical",
    trivia: "The Itaipu Dam on the Brazil-Paraguay border produces more electricity than any other hydroelectric dam in terms of annual energy output — over 100 TWh in peak years."
  },
  "Peru": {
    climate: "Varies (tropical to alpine)",
    trivia: "Peru's Cotahuasi Canyon is over 3,500 meters deep — roughly twice as deep as the Grand Canyon and one of the deepest canyons in the world."
  },
  "Philippines": {
    climate: "Tropical maritime",
    trivia: "The Philippines' Puerto Princesa Underground River is 8.2 km long, making it one of the world's longest navigable underground rivers — and it flows directly into the sea."
  },
  "Poland": {
    climate: "Temperate continental",
    trivia: "The Wieliczka Salt Mine near Kraków has been operating continuously since the 13th century and contains an entire underground cathedral carved from salt, with chandeliers made of salt crystals."
  },
  "Portugal": {
    climate: "Mediterranean",
    trivia: "Portugal's Azores sit on the junction of three tectonic plates in the mid-Atlantic — the islands are home to the deepest hydrothermal vents in the Atlantic Ocean."
  },
  "Qatar": {
    climate: "Arid desert",
    trivia: "Qatar is a peninsula jutting into the Persian Gulf, so flat that its highest natural point is only 103 meters above sea level."
  },
  "Romania": {
    climate: "Temperate continental",
    trivia: "Romania's Carpathian Mountains contain Europe's largest remaining area of virgin forest and are home to the continent's largest population of brown bears — around 6,000."
  },
  "Russia": {
    climate: "Varies (arctic to subtropical)",
    trivia: "Russia's Lake Baikal is the world's oldest (25 million years) and deepest (1,642 meters) freshwater lake, containing about 20% of the world's unfrozen fresh surface water."
  },
  "Rwanda": {
    climate: "Tropical highland",
    trivia: "Rwanda's Nyungwe Forest contains one of Africa's oldest montane rainforests — dating back to the last Ice Age — and is home to 13 primate species including chimpanzees."
  },
  "Saint Kitts and Nevis": {
    climate: "Tropical maritime",
    trivia: "Saint Kitts and Nevis is the smallest sovereign state in the Americas by both area and population, with a total land area of just 261 sq km."
  },
  "Saint Lucia": {
    climate: "Tropical maritime",
    trivia: "The Pitons — two volcanic plugs rising over 700 meters straight from the Caribbean Sea — were formed by volcanic activity and are a UNESCO World Heritage Site."
  },
  "Saint Vincent and the Grenadines": {
    climate: "Tropical maritime",
    trivia: "The Tobago Cays, a group of five uninhabited islands surrounded by coral reef, have such clear water that the seabed is visible at 25 meters depth."
  },
  "Samoa": {
    climate: "Tropical",
    trivia: "The To Sua Ocean Trench is a 30-meter-deep natural swimming hole surrounded by lush gardens — actually a collapsed lava tube connected to the ocean by an underground cave."
  },
  "San Marino": {
    climate: "Mediterranean",
    trivia: "San Marino's Mount Titano, at just 739 meters, is crowned by three medieval towers visible for miles across the Emilia-Romagna plain — the country is entirely landlocked within Italy."
  },
  "Sao Tome and Principe": {
    climate: "Tropical equatorial",
    trivia: "Pico Cão Grande is a dramatic volcanic needle that rises 370 meters straight up from the surrounding jungle — one of the most striking geological formations in Africa."
  },
  "Saudi Arabia": {
    climate: "Arid desert",
    trivia: "The Rub' al Khali (Empty Quarter) is the world's largest contiguous sand desert, covering 650,000 sq km — larger than France and with dunes reaching 250 meters high."
  },
  "Senegal": {
    climate: "Tropical savanna",
    trivia: "Lake Retba (Lac Rose) near Dakar is naturally pink due to Dunaliella salga algae — its salt content rivals the Dead Sea, and workers harvest salt from its bed."
  },
  "Serbia": {
    climate: "Continental",
    trivia: "The Đavolja Varoš ('Devil's Town') in southern Serbia contains 202 peculiar stone towers up to 15 meters tall, topped with stone caps, formed by millions of years of erosion."
  },
  "Seychelles": {
    climate: "Tropical maritime",
    trivia: "The Seychelles' Vallée de Mai on Praslin Island is home to the coco de mer palm, which produces the world's largest seed — weighing up to 25 kg."
  },
  "Sierra Leone": {
    climate: "Tropical",
    trivia: "The Outamba-Kilimi National Park is one of the last places in West Africa where hippos, chimpanzees, and elephants coexist in the same habitat."
  },
  "Singapore": {
    climate: "Tropical equatorial",
    trivia: "Singapore is one of only three surviving city-states in the world (along with Monaco and Vatican City), and its land area has grown by about 25% since independence through land reclamation."
  },
  "Slovakia": {
    climate: "Temperate continental",
    trivia: "Slovakia has more castles and chateaux per capita than any other country in the world — over 180 castles and 425 mansions in a country of 5.4 million people."
  },
  "Slovenia": {
    climate: "Alpine to Mediterranean",
    trivia: "The Škocjan Caves contain one of the world's largest underground chambers and a subterranean canyon 150 meters deep — the underground Reka River disappears into the cave system."
  },
  "Solomon Islands": {
    climate: "Tropical maritime",
    trivia: "Kavachi, an undersea volcano near the Solomon Islands, is one of the most active submarine volcanoes in the Pacific — sharks have been filmed living in its crater."
  },
  "Somalia": {
    climate: "Arid to semi-arid",
    trivia: "Somalia has the longest coastline of any mainland African country — 3,025 km along the Indian Ocean and Gulf of Aden."
  },
  "South Africa": {
    climate: "Varies (Mediterranean to subtropical)",
    trivia: "South Africa's Table Mountain is one of the oldest mountains in the world — about 600 million years old — and hosts over 1,470 plant species, more than the entire United Kingdom."
  },
  "South Korea": {
    climate: "Continental with monsoon",
    trivia: "Jeju Island's Manjanggul lava tube is one of the longest lava tunnels in the world at over 13 km, containing rare lava stalactites and a 7.6-meter lava column."
  },
  "South Sudan": {
    climate: "Tropical",
    trivia: "The Sudd in South Sudan is one of the world's largest tropical wetlands — it can swell to 130,000 sq km during floods, absorbing so much Nile water that it significantly reduces flow downstream."
  },
  "Spain": {
    climate: "Mediterranean to semi-arid",
    trivia: "Spain's Canary Island of El Hierro was considered the western edge of the known world in antiquity — the Prime Meridian originally passed through it before being moved to Greenwich."
  },
  "Sri Lanka": {
    climate: "Tropical",
    trivia: "Sri Lanka's Adam's Peak (Sri Pada) has a natural rock formation at its summit that resembles a giant footprint — revered by Buddhists, Hindus, Muslims, and Christians as a sacred site."
  },
  "Sudan": {
    climate: "Arid desert to tropical",
    trivia: "Sudan has more ancient pyramids than Egypt — over 200 Nubian pyramids at sites like Meroë, built by the Kingdom of Kush between 700 BC and 300 AD."
  },
  "Suriname": {
    climate: "Tropical equatorial",
    trivia: "Over 93% of Suriname is covered by tropical rainforest — the highest percentage of any country in the world — and much of the interior is virtually inaccessible by road."
  },
  "Sweden": {
    climate: "Temperate to subarctic",
    trivia: "Sweden's Kiruna, the world's largest underground iron ore mine, has caused the entire town above it to be relocated — buildings are being moved 3 km to avoid subsidence."
  },
  "Switzerland": {
    climate: "Alpine to temperate",
    trivia: "The Aletsch Glacier is the largest glacier in the Alps, stretching 23 km — but it has retreated over 3 km since 1880 due to climate change."
  },
  "Syria": {
    climate: "Mediterranean to arid",
    trivia: "Syria's Euphrates River is part of the Fertile Crescent, where agriculture was first invented about 12,000 years ago — making the region the birthplace of farming civilization."
  },
  "Tajikistan": {
    climate: "Continental to alpine",
    trivia: "Over 93% of Tajikistan is mountainous, and its Fedchenko Glacier is the longest glacier outside the polar regions at 77 km."
  },
  "Tanzania": {
    climate: "Tropical",
    trivia: "Mount Kilimanjaro is the world's tallest freestanding mountain — rising 5,895 meters from the surrounding plains, it contains five distinct climate zones from tropical to arctic."
  },
  "Thailand": {
    climate: "Tropical",
    trivia: "Thailand's Tham Luang cave system gained worldwide attention in 2018 — at over 10 km long, the rescue of 12 boys and their coach became one of the most-watched rescue operations in history."
  },
  "Timor-Leste": {
    climate: "Tropical",
    trivia: "The Coral Triangle region off Timor-Leste's coast contains the highest marine biodiversity on Earth — more coral reef fish species per area than anywhere else."
  },
  "Togo": {
    climate: "Tropical",
    trivia: "Togo is one of the narrowest countries in Africa — only 115 km wide at its broadest — yet stretches 579 km from the Gulf of Guinea coast to its northern border."
  },
  "Tonga": {
    climate: "Tropical maritime",
    trivia: "The Hunga Tonga-Hunga Ha'apai underwater volcanic eruption in 2022 was the most powerful explosion recorded by modern instruments — its shockwave circled the globe multiple times."
  },
  "Trinidad and Tobago": {
    climate: "Tropical",
    trivia: "Trinidad's Pitch Lake is the largest natural deposit of asphalt in the world — 40 hectares of bubbling liquid bitumen up to 75 meters deep."
  },
  "Tunisia": {
    climate: "Mediterranean to arid",
    trivia: "Chott el Jerid is a massive salt lake in southern Tunisia that can appear as a shimmering mirage in summer heat — at 5,000 sq km it is the largest salt pan in the Sahara."
  },
  "Turkey": {
    climate: "Temperate to continental",
    trivia: "Cappadocia's fairy chimneys are volcanic rock formations sculpted over millions of years — ancient inhabitants carved entire underground cities into the soft tuff, some reaching 8 stories deep."
  },
  "Turkmenistan": {
    climate: "Arid desert",
    trivia: "The Darvaza Gas Crater, or 'Door to Hell,' has been burning continuously since 1971 when Soviet geologists set it alight — the 70-meter-wide pit of fire in the Karakum Desert was never supposed to last."
  },
  "Tuvalu": {
    climate: "Tropical maritime",
    trivia: "Tuvalu's total land area is just 26 sq km — making it the fourth-smallest country — and no point is more than 4.6 meters above sea level."
  },
  "Uganda": {
    climate: "Tropical",
    trivia: "The Rwenzori Mountains, known as the 'Mountains of the Moon,' are among the few places in Africa with permanent glaciers — though they are rapidly shrinking."
  },
  "Ukraine": {
    climate: "Temperate continental",
    trivia: "Ukraine's steppe region contains some of the most fertile soil on Earth — its black chernozem soil is so rich that Nazi Germany shipped entire trainloads of it back during WWII."
  },
  "United Arab Emirates": {
    climate: "Arid desert",
    trivia: "The UAE's Liwa Oasis sits on the edge of the Rub' al Khali desert and contains the Moreeb Dune, one of the tallest sand dunes in the world at around 300 meters."
  },
  "United Kingdom": {
    climate: "Temperate oceanic",
    trivia: "The Giant's Causeway in Northern Ireland consists of about 40,000 interlocking basalt columns formed by an ancient volcanic eruption — most are perfectly hexagonal."
  },
  "United States": {
    climate: "Varies (tropical to arctic)",
    trivia: "The Grand Canyon is up to 1,800 meters deep and exposes nearly 2 billion years of Earth's geological history in its rock layers — one of the most complete geological records on the planet."
  },
  "Uruguay": {
    climate: "Temperate subtropical",
    trivia: "Uruguay has no mountains — its highest point, Cerro Catedral, is only 514 meters — making it one of the flattest countries in South America."
  },
  "Uzbekistan": {
    climate: "Continental arid",
    trivia: "The Aral Sea, once the world's fourth-largest lake, has shrunk to less than 10% of its original size due to Soviet-era irrigation projects — one of the planet's worst environmental disasters."
  },
  "Vanuatu": {
    climate: "Tropical",
    trivia: "Mount Yasur on Tanna Island has been erupting continuously for over 800 years — it is one of the world's most accessible active volcanoes, with visitors walking to the crater rim."
  },
  "Vatican City": {
    climate: "Mediterranean",
    trivia: "Vatican City is the smallest independent state in the world at just 0.44 sq km — the entire country would fit inside many city parks."
  },
  "Venezuela": {
    climate: "Tropical",
    trivia: "Angel Falls drops 979 meters from the top of Auyán-tepui — the water falls so far that much of it turns to mist before reaching the ground."
  },
  "Vietnam": {
    climate: "Tropical to subtropical",
    trivia: "Sơn Đoòng Cave in Vietnam is the world's largest known cave passage by volume — over 5 km long, 200 meters high, and containing its own jungle, river, and weather system."
  },
  "Yemen": {
    climate: "Arid desert to tropical",
    trivia: "Socotra Island has been isolated for so long that a third of its plant species are found nowhere else on Earth — its dragon blood trees look like alien umbrellas."
  },
  "Zambia": {
    climate: "Tropical",
    trivia: "Victoria Falls, known locally as Mosi-oa-Tunya ('The Smoke That Thunders'), creates a spray visible from 50 km away and is the world's largest sheet of falling water."
  },
  "Zimbabwe": {
    climate: "Tropical to subtropical",
    trivia: "The Great Zimbabwe ruins, built between the 11th and 15th centuries without mortar, contained walls up to 11 meters high and a circumference of 250 meters — the largest ancient structure in sub-Saharan Africa."
  }
};

// --- Update countries.json with climate ---
const countriesPath = path.join(ROOT, 'data', 'countries.json');
const countries = JSON.parse(fs.readFileSync(countriesPath, 'utf-8'));

let climateCount = 0;
for (const entry of countries) {
  if (!entry.un) continue;
  const d = DATA[entry.country];
  if (d) {
    entry.climate = d.climate;
    climateCount++;
  } else {
    console.warn(`⚠ No climate for: ${entry.country}`);
  }
}
fs.writeFileSync(countriesPath, JSON.stringify(countries, null, 2) + '\n', 'utf-8');
console.log(`✅ Added climate to ${climateCount}/194 countries in countries.json`);

// --- Update country-facts.json with geo trivia ---
const factsPath = path.join(ROOT, 'data', 'country-facts.json');
const facts = JSON.parse(fs.readFileSync(factsPath, 'utf-8'));

let triviaCount = 0;
for (const [name, d] of Object.entries(DATA)) {
  if (!facts[name]) {
    facts[name] = [];
  }
  // Check if a geo trivia already exists with this exact text
  const exists = facts[name].some(f => f.fact === d.trivia);
  if (!exists) {
    facts[name].push({ fact: d.trivia, category: "geography" });
    triviaCount++;
  }
}
fs.writeFileSync(factsPath, JSON.stringify(facts, null, 2) + '\n', 'utf-8');
console.log(`✅ Added ${triviaCount} geo trivia entries to country-facts.json`);
