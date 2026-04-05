/**
 * One-time script to add "summary" field to all 116 heritage sites
 * in data/heritage-sites.json.
 *
 * Usage: node generate-heritage-summaries.js
 */

const fs = require('fs');
const path = require('path');

const SUMMARIES = {
  "Great Wall of China": "Built over many centuries starting from the 7th century BC, the Great Wall stretches over 20,000 km across northern China. It was constructed to protect Chinese states from nomadic invasions and is the largest military structure ever built, representing extraordinary feats of ancient engineering.",

  "Taj Mahal": "Completed in 1653 by Mughal Emperor Shah Jahan as a mausoleum for his beloved wife Mumtaz Mahal, the Taj Mahal is considered the finest example of Mughal architecture. Its perfect symmetry, white marble inlaid with precious stones, and serene reflecting pools make it one of the most admired buildings ever created.",

  "Machu Picchu": "This 15th-century Inca citadel sits at 2,430 meters above sea level in the Andes, above the Urubamba River valley. Abandoned during the Spanish conquest and unknown to the outside world until 1911, it is an extraordinary example of Inca urban planning and engineering, with precisely fitted stone walls and agricultural terraces.",

  "Pyramids of Giza": "Built around 2560 BC, the Great Pyramid of Khufu is the last surviving Wonder of the Ancient World. The three main pyramids were tombs for Egyptian pharaohs, and the complex includes the Great Sphinx. They demonstrate the remarkable architectural and organizational capabilities of ancient Egypt.",

  "Colosseum": "Completed in 80 AD, the Colosseum is the largest amphitheater ever built, with a capacity of 50,000–80,000 spectators. It hosted gladiatorial contests, public spectacles, and dramas. Despite earthquakes and stone-robbers, it remains an iconic symbol of Imperial Rome's engineering prowess.",

  "Petra": "Carved directly into rose-red sandstone cliffs by the Nabataeans around the 4th century BC, Petra was a thriving trading city controlling vital trade routes between Arabia, Egypt, and the Mediterranean. The Treasury (Al-Khazneh) is its most famous monument. It was lost to the Western world until 1812.",

  "Grand Canyon": "Carved by the Colorado River over nearly 2 billion years of geological history, the Grand Canyon is up to 1,800 meters deep and 29 km wide. Its layered rock formations expose one of the most complete geological records on Earth, making it invaluable for understanding the planet's history.",

  "Great Barrier Reef": "The world's largest coral reef system stretches over 2,300 km along Australia's Queensland coast, comprising nearly 3,000 individual reefs and 900 islands. It supports extraordinary marine biodiversity, including 1,500 fish species and 400 coral species, but faces threats from climate change and ocean acidification.",

  "Galápagos Islands": "These volcanic islands 1,000 km off Ecuador's coast harbor unique wildlife that inspired Charles Darwin's theory of evolution by natural selection. Giant tortoises, marine iguanas, blue-footed boobies, and other species evolved in isolation, making the archipelago a living laboratory of evolutionary biology.",

  "Victoria Falls": "Known locally as Mosi-oa-Tunya ('The Smoke That Thunders'), Victoria Falls on the Zambia-Zimbabwe border is the world's largest sheet of falling water — 1,708 meters wide and 108 meters high. The spray rises over 400 meters and is visible from 50 km away, sustaining a unique rainforest ecosystem.",

  "Stonehenge": "This prehistoric monument in Wiltshire, England, was constructed in stages between approximately 3000 and 2000 BC. Its massive sarsen stones, some weighing 25 tonnes, were transported from 25 km away, while the bluestones came from Wales, 250 km distant. Its precise purpose — astronomical observatory, temple, or burial site — remains debated.",

  "Angkor Wat": "Built in the early 12th century by King Suryavarman II, Angkor Wat is the world's largest religious monument. Originally a Hindu temple dedicated to Vishnu, it gradually transformed into a Buddhist site. The sprawling Angkor complex includes over 1,000 temples spread across 400 square km of Cambodian jungle.",

  "Acropolis of Athens": "Perched above Athens, this ancient citadel contains the remains of several buildings of great architectural significance, most notably the Parthenon, built in the 5th century BC. It is the most complete surviving example of Classical Greek architecture and symbolizes the birth of democracy, philosophy, and Western civilization.",

  "Iguazu Falls": "Spanning the border between Argentina and Brazil, the Iguazu Falls system comprises 275 individual waterfalls along 2.7 km of the Iguazu River. The highest drop is 82 meters at the Devil's Throat. The surrounding subtropical rainforest teems with biodiversity, including toucans, jaguars, and giant otters.",

  "Ha Long Bay": "This bay in northeastern Vietnam features nearly 2,000 limestone karst islands and islets rising from emerald waters. Formed over 500 million years, the pillars are topped with dense tropical vegetation and honeycomb with caves. It is one of the finest examples of mature karst landscape in the world.",

  "Yellowstone National Park": "Established in 1872 as the world's first national park, Yellowstone sits atop a volcanic hotspot. It contains over half of the world's active geysers, including Old Faithful, along with hot springs, mud pots, and fumaroles. The park's diverse ecosystems support grizzly bears, wolves, bison, and elk.",

  "Sagrada Família": "Antoni Gaudí's masterpiece in Barcelona has been under construction since 1882 and remains unfinished. Its extraordinary fusion of Gothic and Art Nouveau forms, with nature-inspired columns and facades depicting the life of Christ, represents one of the most creative achievements in architectural history.",

  "Serengeti National Park": "The Serengeti in northern Tanzania is famous for the annual migration of over 1.5 million wildebeest, 200,000 zebras, and 300,000 gazelles — the largest terrestrial mammal migration on Earth. Its vast savanna ecosystem supports one of the highest concentrations of large predators in Africa.",

  "Easter Island": "This remote Polynesian island 3,700 km off Chile's coast is famous for its 887 monumental moai statues carved by the Rapa Nui people between 1250 and 1500 AD. The largest moai weighs 82 tonnes. How the islanders transported these massive figures across the island remains one of archaeology's enduring mysteries.",

  "Venice and its Lagoon": "Founded in the 5th century on 118 small islands connected by over 400 bridges, Venice became a major maritime power and trading hub. Its unique urban fabric, with palaces, churches, and squares built on wooden piles in a lagoon, represents an extraordinary architectural achievement. Rising sea levels now threaten its survival.",

  "Mount Fuji": "Japan's highest peak at 3,776 meters is a symmetrical stratovolcano that has been a sacred site of pilgrimage for centuries and an inspiration to artists worldwide, most famously in Hokusai's woodblock prints. Its cultural significance in Japanese art, literature, and religion is unparalleled.",

  "Versailles Palace": "Built by Louis XIV in the 17th century as a grand display of royal power, Versailles became the political center of France. Its Hall of Mirrors, elaborate gardens designed by André Le Nôtre, and opulent interiors defined European court culture and influenced palace architecture worldwide.",

  "Göreme National Park": "The Cappadocia region of central Turkey features a surreal landscape of fairy chimneys, rock-cut churches, and underground cities carved into soft volcanic tuff. Early Christians created an extensive network of monastic settlements here from the 4th century, decorating cave churches with Byzantine frescoes.",

  "Chichen Itza": "This pre-Columbian Maya city on Mexico's Yucatán Peninsula thrived from 600 to 1200 AD. The stepped pyramid of El Castillo (Temple of Kukulcán) demonstrates the Maya's advanced astronomical knowledge — during equinoxes, shadows create the illusion of a serpent descending the staircase.",

  "Plitvice Lakes": "Croatia's oldest national park features 16 crystalline lakes connected by waterfalls, cascading over travertine barriers formed over thousands of years. The lakes change color from azure to green to grey depending on mineral content and sunlight. The surrounding beech and fir forests shelter bears, wolves, and rare bird species.",

  "Borobudur Temple": "Built in the 9th century on Java, Borobudur is the world's largest Buddhist temple. Its nine stacked platforms, decorated with 2,672 relief panels and 504 Buddha statues, represent the Buddhist cosmological journey from worldly desire to enlightenment. Abandoned for centuries under volcanic ash, it was rediscovered in 1814.",

  "Uluru (Ayers Rock)": "This massive sandstone monolith in central Australia rises 348 meters above the desert plain and is sacred to the Anangu Aboriginal people, who have inhabited the area for over 30,000 years. Its iron-rich composition causes dramatic color changes at sunrise and sunset, shifting from ochre to red to purple.",

  "Forbidden City": "Built between 1406 and 1420, this imperial palace complex in Beijing served as the home of 24 emperors across the Ming and Qing dynasties. With 980 buildings across 72 hectares, it is the world's largest collection of preserved ancient wooden structures and a supreme example of Chinese palatial architecture.",

  "Yosemite National Park": "Located in California's Sierra Nevada mountains, Yosemite is renowned for its granite cliffs, waterfalls, giant sequoia groves, and exceptional biodiversity. El Capitan and Half Dome are among the world's most famous rock formations. The park's glacially carved landscape inspired the American conservation movement.",

  "Alhambra": "This Moorish palace and fortress complex in Granada, Spain, was built primarily in the 13th and 14th centuries during the Nasrid dynasty. Its intricate Islamic geometric patterns, arabesque decorations, and the serene Generalife gardens represent the pinnacle of Andalusian Islamic art and architecture.",

  "Bagan": "The ancient city of Bagan in Myanmar contains over 3,500 Buddhist temples, pagodas, and monasteries built between the 9th and 13th centuries on a 104 sq km plain along the Irrawaddy River. It is one of the densest concentrations of Buddhist art and architecture in the world.",

  "Pantanal": "The world's largest tropical wetland spans 150,000 sq km across Brazil, Bolivia, and Paraguay. During the wet season, up to 80% of the Pantanal floods, creating one of Earth's richest ecosystems. It supports the highest concentration of wildlife in South America, including jaguars, giant anteaters, and hyacinth macaws.",

  "Meteora": "Six Eastern Orthodox monasteries perch atop massive natural sandstone pillars in central Greece, some rising 400 meters above the surrounding plain. Built from the 14th century onward, the monasteries were accessible only by ladders and nets until stairs were cut in the 1920s, preserving their centuries of isolation.",

  "Banff National Park": "Canada's first national park, established in 1885 in the Canadian Rockies, encompasses glaciers, ice fields, dense coniferous forest, and alpine landscapes. Lake Louise and Moraine Lake are famed for their turquoise glacial waters. The park lies within a larger UNESCO site protecting the Rocky Mountain ecosystem.",

  "Dubrovnik Old City": "Known as the 'Pearl of the Adriatic,' Dubrovnik's medieval old town is enclosed by 2 km of massive stone walls up to 25 meters high. The city was an independent republic (Ragusa) for centuries and a rival to Venice. Its Gothic, Renaissance, and Baroque architecture survived an earthquake in 1667 and shelling in the 1990s.",

  "Komodo National Park": "This Indonesian park protects the world's largest living lizards — Komodo dragons, which grow up to 3 meters long and exist nowhere else in the wild. The park encompasses three major islands with volcanic landscapes, savanna, and some of the richest marine environments in the world.",

  "Statue of Liberty": "A gift from France to the United States, unveiled in 1886, the Statue of Liberty has welcomed millions of immigrants arriving by ship to New York Harbor. Designed by Frédéric Auguste Bartholdi with an iron framework by Gustave Eiffel, the 93-meter copper statue is a universal symbol of freedom and democracy.",

  "Jiuzhaigou Valley": "This nature reserve in Sichuan, China, is famous for its colorful lakes, multi-level waterfalls, and snow-capped peaks. The turquoise and emerald lakes get their vivid colors from calcium carbonate deposits and algae. The valley is home to giant pandas and golden snub-nosed monkeys.",

  "Mont-Saint-Michel": "This tidal island off Normandy, France, has been a strategic and religious site since the 8th century. The Gothic abbey perched on its granite peak rises 80 meters above the bay and is surrounded by some of Europe's most extreme tides, with water levels changing up to 15 meters.",

  "Kilimanjaro National Park": "Africa's highest mountain at 5,895 meters is a dormant stratovolcano and the tallest freestanding mountain on Earth. Climbers pass through five distinct climate zones from tropical rainforest to arctic summit. Its iconic glaciers are rapidly retreating and may disappear within decades due to climate change.",

  "Neuschwanstein Castle": "Built in the 1860s–1880s by King Ludwig II of Bavaria as a romanticized medieval retreat, this fairy-tale castle on a rugged hilltop above the village of Hohenschwangau inspired Walt Disney's Sleeping Beauty Castle. Despite never being completed, it receives over 1.4 million visitors annually.",

  "Tikal National Park": "One of the largest archaeological sites of the Maya civilization, Tikal in Guatemala's Petén jungle flourished from 200 to 900 AD. Temple IV rises 65 meters above the forest canopy. At its peak, Tikal was home to over 100,000 people and was one of the most powerful Maya kingdoms.",

  "Cinque Terre": "Five centuries-old fishing villages — Monterosso, Vernazza, Corniglia, Manarola, and Riomaggiore — cling to the rugged Italian Riviera coastline. Connected by hiking trails along steep terraced hillsides planted with vineyards and olive groves, they represent a harmonious interaction between people and nature.",

  "Fiordland National Park": "New Zealand's largest national park features dramatic fiords carved by glaciers over millions of years. Milford Sound and Doubtful Sound showcase sheer rock faces rising over 1,200 meters from dark waters, with waterfalls cascading from hanging valleys. The park harbors unique species like the takahē, once thought extinct.",

  "Palmyra": "This ancient oasis city in the Syrian desert was a vital caravan stop on the Silk Road, blending Greco-Roman and Persian artistic traditions. At its peak in the 3rd century AD under Queen Zenobia, it rivaled Rome. Tragically, ISIS destroyed several major monuments in 2015, though restoration efforts continue.",

  "Los Glaciares National Park": "Located in Argentine Patagonia, this park contains 47 glaciers fed by the Southern Patagonian Ice Field, the world's third largest reserve of fresh water. The Perito Moreno Glacier is one of the few glaciers in the world that is still advancing, regularly calving enormous icebergs into Lake Argentino.",

  "Hadrian's Wall": "Built by the Roman Empire beginning in 122 AD under Emperor Hadrian, this 117 km stone wall crossed northern England from coast to coast. It marked the empire's northern frontier and included forts, milecastles, and turrets. It is the most visible and best-preserved frontier of the Roman Empire.",

  "Sigiriya": "This ancient rock fortress in Sri Lanka rises 200 meters above the surrounding jungle. Built in the 5th century AD by King Kashyapa as a palace on top of a volcanic plug, it features elaborate frescoes, a mirror wall, and the remains of sophisticated water gardens at its base.",

  "Persepolis": "The ceremonial capital of the Achaemenid Empire, founded by Darius I around 518 BC. Its massive stone platform, monumental staircases, and reliefs depicting representatives of 23 nations bearing tribute showcase the grandeur and multiculturalism of the Persian Empire before Alexander the Great burned it in 330 BC.",

  "Himeji Castle": "Japan's largest and best-preserved feudal-era castle, completed in 1609, is nicknamed 'White Heron Castle' for its elegant white exterior. Its complex defensive design includes 83 buildings, winding pathways, and deceptive gates. It survived both World War II bombings and the 1995 Kobe earthquake.",

  "Hallstatt": "This lakeside village in Austria's Salzkammergut region has been inhabited since prehistoric times due to its salt mines — among the oldest in the world, dating back 7,000 years. The village gave its name to the Hallstatt culture, an important Early Iron Age civilization of Central Europe.",

  "Abu Simbel Temples": "These twin rock temples in southern Egypt were carved from a mountainside by Pharaoh Ramesses II around 1265 BC. The four colossal statues at the Great Temple's entrance are 20 meters tall. In the 1960s, the entire complex was relocated 65 meters uphill to save it from flooding by the Aswan High Dam.",

  "Bryggen": "The old wharf of Bergen, Norway, features a row of colorful wooden buildings dating from the Hanseatic period (14th–16th centuries). Bryggen was the center of the Hanseatic League's trading empire in northern Europe, handling stockfish from northern Norway. Despite repeated fires, the medieval layout and building methods survive.",

  "Skellig Michael": "This remote rocky island 12 km off Ireland's southwest coast holds the remarkably well-preserved remains of a 6th-century Christian monastery. Monks lived in beehive-shaped stone huts perched on a narrow ledge 218 meters above the Atlantic, accessible only by 618 stone steps carved into the cliff.",

  "Old Havana": "Founded by the Spanish in 1519, Havana became the main shipbuilding center and gathering point for the Spanish treasure fleets. Its historic center preserves an extraordinary collection of Baroque and Neoclassical architecture, fortifications, and plazas that tell the story of Spain's colonial ambitions in the Americas.",

  "Luang Prabang": "This town at the confluence of the Mekong and Nam Khan rivers was the royal capital of Laos until 1975. Its 34 gilded Buddhist temples and traditional wooden houses blend Lao architectural traditions with French colonial influence. Monks in saffron robes still collect morning alms along its quiet streets.",

  "Walled City of Cartagena": "Founded in 1533, Cartagena was the main port for Spain's South American trade and the gateway for looted gold. Its massive fortifications, the most extensive in the Americas, were built over two centuries to defend against pirate attacks and rival European powers. Its colonial architecture blends Spanish, African, and Caribbean influences.",

  "Great Mosque of Djenné": "The world's largest mud-brick structure, originally built in the 13th century and reconstructed in 1907. Located in Mali, the mosque is re-plastered annually in a community festival. Djenné was a center of Islamic scholarship and trans-Saharan trade, and the mosque exemplifies Sudano-Sahelian architecture.",

  "Rock-Hewn Churches of Lalibela": "Eleven medieval churches carved directly from solid volcanic rock in 12th-century Ethiopia, commissioned by King Lalibela to create a 'New Jerusalem.' The Church of St. George, carved in the shape of a cross from above, is the most famous. They remain active places of Ethiopian Orthodox worship today.",

  "Historic Centre of Prague": "Prague's historic center spans a thousand years of architecture — from the 9th-century Prague Castle (the world's largest ancient castle complex) through Gothic, Renaissance, and Baroque landmarks to Art Nouveau gems. The Charles Bridge, Old Town Square, and astronomical clock draw millions of visitors.",

  "Þingvellir National Park": "This site in Iceland has dual significance: it is where the North American and Eurasian tectonic plates visibly diverge, creating dramatic rifts and fissures, and it is where the Alþingi, one of the world's oldest parliaments, was established in 930 AD. Icelanders gathered here to make laws for over 800 years.",

  "Island of Gorée": "This small island off Dakar, Senegal, served as one of the largest slave-trading centers on the African coast from the 15th to the 19th century. The House of Slaves and its 'Door of No Return' are powerful memorials to the millions of Africans transported across the Atlantic during the slave trade.",

  "Medina of Marrakesh": "Founded in 1070, Marrakesh's medina is a vibrant maze of souks, mosques, palaces, and riads. The Koutoubia Mosque's 77-meter minaret dominates the skyline. Jemaa el-Fna square is a living cultural space with storytellers, musicians, and food vendors — recognized by UNESCO as a masterpiece of intangible heritage.",

  "Hampi": "The ruins of Vijayanagara, the last great Hindu kingdom's capital, spread across 26 sq km of boulder-strewn landscape in southern India. At its peak in the 15th-16th centuries, it was one of the world's largest cities. Hundreds of temples, royal complexes, and bazaars survive, with the Vittala Temple's stone chariot as its icon.",

  "Potala Palace": "Perched at 3,700 meters in Lhasa, Tibet, this massive palace complex was the winter residence of the Dalai Lama from the 7th century until 1959. Rising 13 stories with over 1,000 rooms, its white and red buildings against the Himalayan sky symbolize Tibetan Buddhism and represent remarkable high-altitude construction.",

  "Teotihuacán": "This ancient Mesoamerican city northeast of Mexico City was one of the largest cities in the world by 100 AD, with a population of over 100,000. The Pyramid of the Sun is the third-largest pyramid on Earth. The civilization that built it remains mysterious — even the Aztecs, who named it 'the place where the gods were created,' did not know its builders.",

  "Old Bridge of Mostar": "The iconic 16th-century Ottoman bridge spanning the Neretva River in Bosnia was a masterpiece of Islamic architecture and engineering. Destroyed during the 1993 Bosnian War, it was meticulously rebuilt using original Ottoman techniques and stones recovered from the river, reopening in 2004 as a symbol of reconciliation.",

  "Table Mountain": "This flat-topped mountain overlooking Cape Town is one of the oldest mountains on Earth, approximately 600 million years old. Its 3 km-wide plateau hosts over 1,470 plant species, many endemic, making it one of the richest floral kingdoms for its size. The 'tablecloth' cloud that frequently caps it is a distinctive natural phenomenon.",

  "Ngorongoro Crater": "This 19 km-wide volcanic caldera in Tanzania forms a natural enclosure for approximately 25,000 large animals, including the densest known population of lions and the endangered black rhinoceros. The crater floor, at 1,800 meters elevation, is one of the few places in Africa where all of the 'Big Five' can be seen in a single day.",

  "Stone Town of Zanzibar": "The historic heart of Zanzibar City is a fine example of a Swahili coastal trading town, blending African, Arab, Indian, and European elements. For centuries it was the center of the Indian Ocean spice trade and, tragically, the East African slave trade. Its coral stone buildings, carved doors, and narrow streets reflect this layered history.",

  "Ruins of Great Zimbabwe": "These medieval stone ruins in southeastern Zimbabwe were the capital of the Kingdom of Zimbabwe from the 11th to 15th centuries. The Great Enclosure's 11-meter-high walls were constructed without mortar. The city controlled gold and ivory trade between the interior and the Swahili coast, and gave the modern country its name.",

  "Okavango Delta": "The world's largest inland delta in Botswana spreads across 20,000 sq km of the Kalahari Desert. Floodwaters from Angola's highlands travel 1,200 km to the delta, where they evaporate rather than reaching the sea. This creates a unique ecosystem supporting vast herds of elephants, buffalo, lions, and over 400 bird species.",

  "Historic Cairo": "One of the world's oldest Islamic cities, Cairo's historic center contains 600+ classified monuments. Founded in 969 AD by the Fatimid dynasty, it became a center of learning and commerce. The Al-Azhar Mosque and University, among the oldest in the world, and the medieval bazaar of Khan el-Khalili are highlights of a millennium of Islamic civilization.",

  "Terracotta Army": "Discovered in 1974 by farmers digging a well near Xi'an, China, this army of approximately 8,000 life-sized clay soldiers was buried with China's first emperor, Qin Shi Huang, around 210 BC. Each figure has unique facial features. The army was meant to protect the emperor in the afterlife and represents extraordinary ancient craftsmanship.",

  "Historic Areas of Istanbul": "Straddling Europe and Asia, Istanbul has been the capital of the Roman, Byzantine, and Ottoman empires. The Hagia Sophia, built in 537 AD, was the world's largest cathedral for nearly a thousand years. Combined with the Blue Mosque, Topkapi Palace, and the Grand Bazaar, the city encapsulates 1,600 years of imperial history.",

  "Ayutthaya Historical Park": "The ruins of Thailand's second capital, founded in 1350, once rivaled European cities in size and splendor. At its peak it had a million residents and was a major international trading port. Burmese invaders destroyed the city in 1767, leaving haunting ruins of temples, monasteries, and a royal palace.",

  "Rice Terraces of the Philippine Cordilleras": "Carved into the mountains of Ifugao province over 2,000 years ago, these terraces rise to 1,500 meters above sea level. If laid end to end, they would circle half the globe. Built by the Ifugao people using minimal tools, they represent an extraordinary example of living cultural landscape and sustainable farming.",

  "Samarkand": "One of the oldest continuously inhabited cities in Central Asia, Samarkand was a key Silk Road crossroads. Under Timur (Tamerlane) in the 14th century, it became an intellectual and architectural center. The Registan Square, with its three magnificent madrasas, is considered one of the most spectacular public squares in the world.",

  "Prambanan Temple": "This 9th-century Hindu temple complex in Java, Indonesia, is the largest Hindu temple in Southeast Asia. Its 47-meter-tall central tower is dedicated to Shiva, flanked by temples to Brahma and Vishnu. The 240 surrounding temples and the detailed relief panels depicting the Ramayana epic showcase the height of Java's Hindu-Buddhist civilization.",

  "Itsukushima Shrine": "This Shinto shrine on Miyajima Island near Hiroshima is famed for its 'floating' torii gate that appears to stand in the sea at high tide. Founded in the 6th century and rebuilt in the 12th century, the shrine complex is built on stilts over the water, harmoniously blending architecture with the island's sacred forest and tidal landscape.",

  "Gyeongju Historic Areas": "Known as 'the museum without walls,' Gyeongju was the capital of the ancient Silla Kingdom for nearly a millennium (57 BC – 935 AD). The area contains royal tombs, Buddhist temple ruins, palace sites, and the Cheomseongdae observatory — one of the oldest surviving astronomical observatories in East Asia.",

  "Kathmandu Valley": "This valley in Nepal contains seven monument zones including Hindu temples, Buddhist stupas, and royal palaces spanning over 2,000 years. Swayambhunath ('Monkey Temple') and Boudhanath stupa are iconic Buddhist sites, while Pashupatinath is Nepal's holiest Hindu temple. The valley's unique Newar architecture blends Hindu and Buddhist traditions.",

  "Baalbek": "This ancient Phoenician city in Lebanon's Bekaa Valley contains some of the best-preserved Roman temples in the world. The Temple of Jupiter features the largest stone blocks ever used in construction — the trilithon stones each weigh approximately 800 tonnes. How the Romans transported and placed them remains an engineering mystery.",

  "Pompeii": "Buried under 4–6 meters of volcanic ash when Mount Vesuvius erupted in 79 AD, Pompeii was frozen in time. Excavations since 1748 have revealed an extraordinarily detailed picture of Roman daily life — streets, houses, shops, baths, theaters, and even food preserved for nearly 2,000 years.",

  "Historic Centre of Bruges": "Medieval Bruges was one of Europe's most important commercial cities and the chief link between Mediterranean and North Sea trade. Its canals, Gothic buildings, and 13th-century belfry tower remain remarkably intact. The city was a center of Flemish art, home to masters like Jan van Eyck.",

  "Swiss Alps Jungfrau-Aletsch": "This area in the Bernese Alps features the Aletsch Glacier, the largest glacier in the Alps at 23 km long, flanked by the famous Eiger, Mönch, and Jungfrau peaks. It provides an outstanding example of Alpine geological processes including glacial sculpting and showcases the effects of climate change on alpine environments.",

  "Giant's Causeway": "About 40,000 interlocking basalt columns on the coast of Northern Ireland were formed by an ancient volcanic eruption approximately 60 million years ago. Most columns are hexagonal, rising up to 12 meters. Irish legend attributes their creation to the giant Finn McCool, who built a causeway to Scotland.",

  "Rila Monastery": "Founded in the 10th century by the hermit St. Ivan of Rila, this monastery in Bulgaria's Rila Mountains is the country's most important cultural and spiritual symbol. Its vibrant frescoes, arched colonnades, and striped stonework represent the Bulgarian National Revival period. It preserved Bulgarian language and culture during Ottoman rule.",

  "Kremlin and Red Square": "The Moscow Kremlin has been Russia's political and spiritual center since the 13th century. The fortified complex contains cathedrals, palaces, and the Tsar Bell and Cannon. Adjacent Red Square features St. Basil's Cathedral with its iconic colorful onion domes, Lenin's Mausoleum, and the GUM department store.",

  "Auschwitz-Birkenau": "The largest of the Nazi concentration and extermination camps, where over 1.1 million people — primarily Jews — were murdered between 1940 and 1945. Preserved as a memorial and museum, it stands as the most significant symbol of the Holocaust and a solemn reminder of the consequences of hatred, racism, and totalitarianism.",

  "Archaeological Site of Delphi": "Regarded by ancient Greeks as the center of the world, Delphi was home to the Oracle of Apollo, the most important oracle in the classical Greek world. Kings and citizens traveled from across the Mediterranean to consult the Pythia. The Temple of Apollo, theater, and stadium are set dramatically on the slopes of Mount Parnassus.",

  "Cologne Cathedral": "This Gothic masterpiece took over 600 years to complete (1248–1880) and was the world's tallest building upon completion. Its twin 157-meter spires dominate Cologne's skyline. The cathedral houses the Shrine of the Three Kings and features stunning medieval stained glass. It survived 14 aerial bombings during World War II.",

  "Tower of London": "Founded in 1066 by William the Conqueror, the Tower has served as a royal palace, prison, armory, treasury, and menagerie. Its most famous prisoners included Anne Boleyn and Sir Walter Raleigh. Today it houses the Crown Jewels and is guarded by the Yeoman Warders (Beefeaters) and the legendary Tower ravens.",

  "Independence Hall": "This building in Philadelphia is where both the Declaration of Independence (1776) and the United States Constitution (1787) were debated and adopted. The Assembly Room where the Founding Fathers signed these documents is preserved as it appeared in the 18th century. It is the birthplace of American democracy.",

  "Historic Centre of Oaxaca": "Founded in 1529 by Spanish colonizers, Oaxaca's historic center showcases beautiful colonial architecture built with distinctive green volcanic stone. The nearby Monte Albán archaeological site was the ancient Zapotec capital from 500 BC. The city is a living center of indigenous Zapotec and Mixtec cultures, cuisine, and mezcal production.",

  "Historic District of Old Quebec": "The only walled city north of Mexico, Old Quebec was founded in 1608 by Samuel de Champlain. The Château Frontenac hotel dominates the skyline above the St. Lawrence River. Its cobblestone streets, fortifications, and French colonial architecture make it the most European-feeling city in North America.",

  "Antigua Guatemala": "This former capital of colonial Central America was devastated by an earthquake in 1773 and largely abandoned. Its ruins of grand cathedrals, convents, and public buildings — set against a backdrop of volcanoes — preserve a remarkable snapshot of 17th- and 18th-century Spanish colonial architecture.",

  "Historic Centre of Lima": "Founded by Francisco Pizarro in 1535, Lima's historic center contains colonial-era churches, monasteries, and mansions built with wealth from silver mines. The San Francisco Monastery's catacombs hold an estimated 25,000 burials. The city became the most important city in Spanish South America for over two centuries.",

  "Nazca Lines": "These enormous geoglyphs etched into the desert floor of southern Peru between 500 BC and 500 AD depict animals, plants, and geometric shapes — some stretching 370 meters. Visible only from the air, their purpose remains debated: astronomical calendar, ritual pathways, or appeals to the gods for water in this arid landscape.",

  "Historic Quarter of Valparaíso": "Chile's principal port city is famous for its steep hillsides covered in colorful houses, connected by funicular elevators (ascensores) dating from the late 19th century. Its bohemian character and improvised urban architecture inspired poet Pablo Neruda, whose house-museum La Sebastiana overlooks the harbor.",

  "Tiwanaku": "This ancient pre-Inca civilization near Lake Titicaca in Bolivia flourished from 300 to 1000 AD and influenced cultures across the Andes. The Akapana pyramid, Kalasasaya temple, and the iconic Gateway of the Sun demonstrate advanced stone-working and astronomical knowledge at 3,850 meters above sea level.",

  "Canaima National Park": "This Venezuelan park covers 30,000 sq km of ancient tepui (table-top mountain) landscape. Angel Falls, the world's highest uninterrupted waterfall at 979 meters, plunges from the summit of Auyán-tepui. The isolated tepui summits harbor unique ecosystems with species found nowhere else, like living remnants of a lost world.",

  "Colonia del Sacramento": "Founded by the Portuguese in 1680, this small Uruguayan town on the Río de la Plata was fiercely contested between Spain and Portugal. Its historic quarter preserves a rare blend of Portuguese and Spanish colonial styles — cobblestone streets, a 17th-century lighthouse, and colonial-era houses that reflect the struggle for control of the region.",

  "Tongariro National Park": "New Zealand's first national park, gifted by Māori chief Te Heuheu Tukino IV in 1887, contains three active volcanoes sacred to the Māori people. Mount Ngauruhoe (used as Mount Doom in the Lord of the Rings films) and the Emerald Lakes of the Tongariro Alpine Crossing showcase dramatic volcanic landscapes.",

  "Sydney Opera House": "Designed by Danish architect Jørn Utzon and completed in 1973, the Opera House's sail-shaped roof shells are an icon of 20th-century architecture. Its construction required revolutionary engineering to realize Utzon's vision. Located on Bennelong Point in Sydney Harbour, it hosts over 1,500 performances annually.",

  "Old City of Jerusalem": "Sacred to Judaism, Christianity, and Islam, Jerusalem's Old City contains the Western Wall, the Church of the Holy Sepulchre, and the Dome of the Rock within less than 1 sq km. Continuously inhabited for over 5,000 years, it is one of the most contested and spiritually significant places on Earth.",

  "Wadi Rum": "Known as the 'Valley of the Moon,' this desert landscape in southern Jordan features dramatic sandstone mountains, natural arches, and ancient rock inscriptions. T.E. Lawrence (Lawrence of Arabia) based his operations here during the Arab Revolt. The Bedouin people have inhabited this landscape for thousands of years.",

  "Suomenlinna": "Built on six islands off Helsinki beginning in 1748, this sea fortress was originally constructed by Sweden to defend against Russian expansion. It later served as a Russian garrison and then a Finnish military base. It is one of the largest maritime fortresses in the world and a unique example of European military architecture.",

  "Historic Centre of Tallinn": "Tallinn's remarkably well-preserved medieval old town retains its 13th-century layout, city walls, and Gothic church spires. As a major Hanseatic League trading city, it grew wealthy from trade between Russia and Western Europe. The Town Hall, dating from 1404, is the oldest surviving Gothic town hall in Northern Europe.",

  "Wooden Churches of Maramureș": "Eight 17th- and 18th-century wooden churches in northern Romania showcase the extraordinary carpentry skills of local craftspeople. Built entirely of wood with tall, narrow spires reaching up to 72 meters, they blend Gothic style with traditional timber construction. Their interiors feature remarkable religious paintings on wood.",

  "Meidan Emam, Isfahan": "This vast public square in Isfahan, Iran, built by Shah Abbas I around 1600, is one of the largest city squares in the world. Surrounded by the Shah Mosque, Sheikh Lotfollah Mosque, Ali Qapu Palace, and the Grand Bazaar, it represents the pinnacle of Safavid Persian architecture and urban design.",

  "Old City of Sana'a": "Inhabited for over 2,500 years, Sana'a is one of the world's oldest continuously inhabited cities. Its distinctive tower houses — multi-story mud-brick buildings decorated with geometric patterns in white gypsum — create a unique skyline. The Great Mosque of Sana'a is one of the earliest in Islam, built during the Prophet Muhammad's lifetime.",

  "Ellora Caves": "This complex of 34 caves carved from basalt cliffs in Maharashtra, India, between the 6th and 11th centuries contains Hindu, Buddhist, and Jain temples side by side. The Kailasa Temple (Cave 16) is the world's largest monolithic rock excavation — an entire mountain was carved from top to bottom to create a freestanding temple.",

  "Rio de Janeiro": "Rio's landscape is a spectacular interaction between city and nature — from the Christ the Redeemer statue atop Corcovado Mountain to Sugarloaf peak rising from Guanabara Bay. The Tijuca National Park is the world's largest urban forest. This dramatic setting between mountains, sea, and tropical forest shaped the city's cultural identity.",

  "Historic Monuments of Kyoto": "As Japan's imperial capital for over a thousand years (794–1868), Kyoto contains 17 UNESCO-listed monuments including golden and silver pavilions, Zen rock gardens, and Shinto shrines. The city was deliberately spared from World War II bombing. Its 2,000 temples and shrines represent the evolution of Japanese art, architecture, and garden design.",

  "Pitons Management Area": "The twin volcanic spires of Gros Piton (770 m) and Petit Piton (743 m) rise dramatically from the Caribbean Sea on Saint Lucia's southwest coast. The area includes geothermal hot springs — the only drive-in volcanic site in the Caribbean — and surrounding coral reefs with exceptional marine biodiversity."
};

// Read, update, write
const filePath = path.join(__dirname, 'data', 'heritage-sites.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

let updated = 0;
const missing = [];
for (const site of data) {
  const summary = SUMMARIES[site.siteName];
  if (summary) {
    site.summary = summary;
    updated++;
  } else {
    missing.push(site.siteName);
  }
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log(`✅ Added summaries to ${updated}/${data.length} heritage sites.`);
if (missing.length) console.log('⚠ Missing:', missing);
