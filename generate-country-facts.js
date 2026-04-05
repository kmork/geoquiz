/**
 * One-time script to add famousFor, exports, and history fields
 * to all 194 UN member countries in data/countries.json.
 *
 * Usage: node generate-country-facts.js
 */

const fs = require('fs');
const path = require('path');

const FACTS = {
  "Afghanistan": {
    famousFor: ["Hindu Kush mountains", "ancient Silk Road trade routes", "lapis lazuli gemstones"],
    exports: ["dried fruits", "carpets", "precious stones", "medicinal herbs"],
    history: "Afghanistan sits at the crossroads of Central and South Asia and has been invaded by many empires, from Alexander the Great to the Mongols. It became a monarchy in 1747 under Ahmad Shah Durrani. Decades of conflict since the 1970s, including Soviet invasion and civil wars, have deeply shaped the nation."
  },
  "Albania": {
    famousFor: ["Albanian Riviera coastline", "ancient Butrint ruins", "mountain villages"],
    exports: ["footwear", "textiles", "chromium ore", "crude oil"],
    history: "Albania was part of the Ottoman Empire for nearly five centuries until declaring independence in 1912. After World War II it became one of Europe's most isolated communist states under Enver Hoxha. It transitioned to democracy in the early 1990s and is now an EU candidate country."
  },
  "Algeria": {
    famousFor: ["Sahara Desert", "Roman ruins at Timgad and Djémila", "Casbah of Algiers"],
    exports: ["petroleum", "natural gas", "phosphates"],
    history: "Algeria was a major part of the Roman Empire and later came under Ottoman rule. France colonized it in 1830, and a brutal war of independence from 1954 to 1962 led to sovereignty. It is Africa's largest country by area and a major oil and gas producer."
  },
  "Andorra": {
    famousFor: ["Pyrenees skiing", "duty-free shopping"],
    exports: ["electrical equipment", "tobacco products", "furniture"],
    history: "Andorra is a tiny principality in the Pyrenees between France and Spain, traditionally governed by two co-princes: the French president and the Bishop of Urgell. It has existed since Charlemagne's era and adopted a modern constitution in 1993. Tourism and banking drive its prosperous economy."
  },
  "Angola": {
    famousFor: ["Kalandula Falls", "diverse wildlife", "Atlantic coastline"],
    exports: ["crude oil", "diamonds", "refined petroleum", "coffee"],
    history: "Angola was a Portuguese colony for over 400 years and a major source of the Atlantic slave trade. After gaining independence in 1975, it suffered a devastating civil war lasting until 2002. It is now sub-Saharan Africa's second-largest oil producer."
  },
  "Antigua and Barbuda": {
    famousFor: ["365 beaches", "English Harbour and Nelson's Dockyard"],
    exports: ["petroleum products", "transport equipment", "electronics"],
    history: "Antigua and Barbuda were colonized by the British in the 17th century and became a major sugar-producing colony relying on enslaved labor. The islands gained independence in 1981. Tourism now accounts for the majority of the nation's GDP."
  },
  "Argentina": {
    famousFor: ["tango", "Patagonia", "beef and wine"],
    exports: ["soybeans", "corn", "beef", "petroleum", "vehicles"],
    history: "Argentina declared independence from Spain in 1816 and attracted waves of European immigration in the late 19th century. It experienced political instability including military dictatorships in the 20th century. Today it is South America's second-largest economy, known for agriculture and culture."
  },
  "Armenia": {
    famousFor: ["Mount Ararat views", "ancient monasteries", "first nation to adopt Christianity"],
    exports: ["copper ore", "gold", "diamonds", "tobacco"],
    history: "Armenia is one of the world's oldest civilizations, and in 301 AD became the first nation to adopt Christianity as its state religion. It suffered the 1915 genocide under the Ottoman Empire. It declared independence from the Soviet Union in 1991."
  },
  "Australia": {
    famousFor: ["Great Barrier Reef", "Sydney Opera House", "unique wildlife"],
    exports: ["iron ore", "coal", "natural gas", "gold", "wheat"],
    history: "Australia's Indigenous peoples have inhabited the continent for over 65,000 years, making it one of the oldest continuous cultures on Earth. Britain established a penal colony in 1788, and the six colonies federated in 1901. It is now a prosperous multicultural democracy and a major commodity exporter."
  },
  "Austria": {
    famousFor: ["Alpine skiing", "classical music heritage", "Viennese coffee houses"],
    exports: ["machinery", "vehicles", "pharmaceuticals", "electrical equipment"],
    history: "Austria was the center of the Habsburg Empire, one of Europe's most powerful dynasties for over 600 years. After World War I the empire dissolved and Austria became a republic. It joined the European Union in 1995 and is known for its cultural contributions to music and the arts."
  },
  "Azerbaijan": {
    famousFor: ["mud volcanoes", "Flame Towers of Baku", "ancient fire temples"],
    exports: ["crude oil", "natural gas", "fruits", "cotton"],
    history: "Azerbaijan has been influenced by Persian, Turkish, and Russian empires throughout its history. It was the first Muslim-majority democratic republic in 1918 before Soviet annexation. After regaining independence in 1991, oil wealth has driven rapid modernization of the capital Baku."
  },
  "Bahamas": {
    famousFor: ["crystal-clear turquoise waters", "swimming pigs of Exuma"],
    exports: ["crawfish", "salt", "polystyrene products", "rum"],
    history: "The Bahamas were the site of Christopher Columbus's first landfall in the Americas in 1492. The islands were a British colony and a haven for pirates before becoming a crown colony. They gained independence in 1973 and now thrive on tourism and financial services."
  },
  "Bahrain": {
    famousFor: ["Formula 1 Grand Prix", "ancient Dilmun civilization", "pearl diving heritage"],
    exports: ["refined petroleum", "aluminum", "iron ore"],
    history: "Bahrain was the center of the ancient Dilmun civilization and a famous pearl diving hub for centuries. It became a British protectorate in the 19th century and gained independence in 1971. It was the first Gulf state to discover oil and has since diversified into banking and tourism."
  },
  "Bangladesh": {
    famousFor: ["Sundarbans mangrove forest", "world's longest natural beach at Cox's Bazar", "garment industry"],
    exports: ["textiles", "garments", "footwear", "fish", "jute"],
    history: "Bangladesh was part of British India and then East Pakistan after the 1947 partition. A brutal liberation war in 1971 led to independence. Despite challenges from flooding and poverty, it has become one of the world's fastest-growing economies, led by its massive garment sector."
  },
  "Barbados": {
    famousFor: ["rum production", "cricket", "beautiful beaches"],
    exports: ["rum", "sugar", "chemicals", "electrical components"],
    history: "Barbados was claimed by the British in 1627 and became a major sugar colony built on enslaved African labor. It gained independence in 1966 and became a republic in 2021, removing the British monarch as head of state. It is one of the most developed Caribbean nations."
  },
  "Belarus": {
    famousFor: ["Białowieża Forest and European bison", "Soviet-era architecture"],
    exports: ["refined petroleum", "potash fertilizers", "dairy products", "machinery"],
    history: "Belarus was part of the Grand Duchy of Lithuania and later the Russian Empire. It suffered enormously in World War II, losing a quarter of its population. After independence from the Soviet Union in 1991, it has been governed by the same president since 1994."
  },
  "Belgium": {
    famousFor: ["chocolate", "waffles", "comic strips and Tintin"],
    exports: ["chemicals", "vehicles", "diamonds", "pharmaceuticals", "machinery"],
    history: "Belgium gained independence from the Netherlands in 1830. It was a major colonial power in Africa, particularly in the Congo. Brussels serves as the de facto capital of the European Union and NATO, making Belgium a hub of international diplomacy."
  },
  "Belize": {
    famousFor: ["Great Blue Hole", "Maya ruins", "barrier reef"],
    exports: ["sugar", "bananas", "citrus", "marine products", "crude oil"],
    history: "Belize was part of the ancient Maya civilization and later became the British colony of British Honduras. It gained independence in 1981 and is the only Central American country with English as its official language. Its barrier reef is the second largest in the world."
  },
  "Benin": {
    famousFor: ["birthplace of Vodun (Voodoo)", "Kingdom of Dahomey", "Royal Palaces of Abomey"],
    exports: ["cotton", "cashew nuts", "gold", "palm oil"],
    history: "Benin was home to the powerful Kingdom of Dahomey, known for its female warriors. It became the French colony of Dahomey and gained independence in 1960. After a period of Marxist government, it transitioned to multiparty democracy in 1990, becoming a model for African democratization."
  },
  "Bhutan": {
    famousFor: ["Gross National Happiness index", "Tiger's Nest monastery", "pristine Himalayan landscapes"],
    exports: ["hydroelectricity", "ferrosilicon", "cement", "cardamom"],
    history: "Bhutan has maintained its sovereignty throughout its history, never colonized by any foreign power. The monarchy was established in 1907, and the country transitioned to a constitutional monarchy in 2008. It measures progress through Gross National Happiness rather than GDP."
  },
  "Bolivia": {
    famousFor: ["Salar de Uyuni salt flat", "Lake Titicaca", "ancient Tiwanaku ruins"],
    exports: ["natural gas", "zinc", "gold", "soybeans", "tin"],
    history: "Bolivia was part of the Inca Empire and then a Spanish colony known as Upper Peru. Named after independence hero Simón Bolívar, it gained freedom in 1825. It lost its Pacific coastline to Chile in the 1879 War of the Pacific and remains landlocked."
  },
  "Bosnia and Herzegovina": {
    famousFor: ["Stari Most bridge in Mostar", "Ottoman heritage", "diverse religious architecture"],
    exports: ["electricity", "aluminum", "metals", "wood", "footwear"],
    history: "Bosnia and Herzegovina was part of the Ottoman and Austro-Hungarian empires before joining Yugoslavia. The assassination of Archduke Franz Ferdinand in Sarajevo in 1914 sparked World War I. The devastating Bosnian War of 1992-1995 led to the Dayton Agreement and its current unique governance structure."
  },
  "Botswana": {
    famousFor: ["Okavango Delta", "Kalahari Desert wildlife", "diamond mining"],
    exports: ["diamonds", "copper", "nickel", "beef", "soda ash"],
    history: "Botswana was the British protectorate of Bechuanaland and gained independence in 1966 as one of the world's poorest nations. The discovery of diamonds transformed it into one of Africa's most prosperous and stable democracies. It is often cited as a model of good governance in Africa."
  },
  "Brazil": {
    famousFor: ["Amazon rainforest", "Carnival", "football"],
    exports: ["soybeans", "iron ore", "crude oil", "sugar", "beef"],
    history: "Brazil was a Portuguese colony from 1500 and the center of a vast empire. It became an independent empire in 1822 and a republic in 1889. It is the largest country in South America and the fifth largest in the world, with immense biodiversity in the Amazon basin."
  },
  "Brunei": {
    famousFor: ["Sultan's golden-domed palace", "oil wealth", "pristine rainforests"],
    exports: ["crude oil", "natural gas", "refined petroleum"],
    history: "Brunei was once a powerful sultanate controlling much of Borneo and the Philippines. It became a British protectorate in 1888 and gained full independence in 1984. Oil and gas wealth has made it one of the richest nations in the world per capita."
  },
  "Bulgaria": {
    famousFor: ["Rose Valley and rose oil production", "ancient Thracian heritage", "Black Sea coast"],
    exports: ["refined petroleum", "copper", "machinery", "wheat", "clothing"],
    history: "Bulgaria was founded in 681 AD and is one of Europe's oldest states. It was under Ottoman rule for nearly 500 years before gaining independence in 1878. After decades of communist rule, it transitioned to democracy in 1989 and joined the European Union in 2007."
  },
  "Burkina Faso": {
    famousFor: ["FESPACO film festival", "Ruins of Loropéni", "vibrant mask traditions"],
    exports: ["gold", "cotton", "sesame seeds", "cashew nuts"],
    history: "Burkina Faso was the French colony of Upper Volta, gaining independence in 1960. Revolutionary leader Thomas Sankara renamed the country in 1984, meaning 'Land of Honest People.' It remains one of the world's least developed nations and has experienced several coups."
  },
  "Burundi": {
    famousFor: ["source of the Nile River", "Lake Tanganyika", "traditional drumming"],
    exports: ["coffee", "tea", "gold", "sugar"],
    history: "Burundi was a kingdom for centuries before becoming part of German and then Belgian colonial territories. It gained independence in 1962 and has been marked by ethnic tensions between Hutu and Tutsi populations. It is one of the most densely populated countries in Africa."
  },
  "Cabo Verde": {
    famousFor: ["volcanic islands", "morna music genre", "windsurfing"],
    exports: ["fish", "clothing", "footwear", "bananas"],
    history: "Cabo Verde was uninhabited until Portuguese settlers arrived in the 15th century, making it a hub of the Atlantic slave trade. It gained independence from Portugal in 1975. Despite few natural resources, it has become one of Africa's most stable democracies."
  },
  "Cambodia": {
    famousFor: ["Angkor Wat temple complex", "Khmer heritage", "Mekong River"],
    exports: ["clothing", "footwear", "rice", "rubber", "fish"],
    history: "Cambodia was the seat of the mighty Khmer Empire from the 9th to 15th centuries, which built Angkor Wat. French colonization lasted from 1863 to 1953. The Khmer Rouge genocide in the 1970s killed an estimated two million people, and the country has since been rebuilding."
  },
  "Cameroon": {
    famousFor: ["diverse ecosystems from coast to Sahel", "football excellence", "Mount Cameroon"],
    exports: ["crude oil", "cocoa", "coffee", "timber", "bananas"],
    history: "Cameroon was a German colony before being divided between France and Britain after World War I. The French portion gained independence in 1960 and merged with the southern British part in 1961. It is known as 'Africa in Miniature' for its geographic and cultural diversity."
  },
  "Canada": {
    famousFor: ["Niagara Falls", "Rocky Mountains", "maple syrup"],
    exports: ["crude oil", "vehicles", "gold", "natural gas", "lumber"],
    history: "Canada's Indigenous peoples have lived on the land for thousands of years. French and British colonization began in the 16th century, and Canada became a self-governing dominion in 1867. It is the world's second-largest country by area and is known for its multiculturalism and vast wilderness."
  },
  "Central African Republic": {
    famousFor: ["dense tropical rainforests", "Dzanga-Sangha gorilla reserve"],
    exports: ["diamonds", "timber", "cotton", "coffee"],
    history: "The Central African Republic was a French colony known as Ubangi-Shari before gaining independence in 1960. It has experienced chronic political instability, including the infamous rule of self-proclaimed Emperor Bokassa. Ongoing conflict and poverty make it one of the world's least developed countries."
  },
  "Chad": {
    famousFor: ["Lake Chad", "Saharan rock art in Ennedi", "diverse landscapes from desert to savanna"],
    exports: ["crude oil", "cotton", "gold", "gum arabic"],
    history: "Chad has been home to advanced civilizations, including the Kanem-Bornu Empire. It was colonized by France and gained independence in 1960. Civil wars and conflicts with Libya marked much of its post-independence history, and it remains one of the poorest nations in the world."
  },
  "Chile": {
    famousFor: ["Atacama Desert", "Easter Island", "Patagonian fjords"],
    exports: ["copper", "lithium", "salmon", "wine", "fruit"],
    history: "Chile was home to the Mapuche people before Spanish colonization. It gained independence in 1818 and experienced rapid growth in the 19th century from mining. A military coup in 1973 led to Pinochet's dictatorship; democracy was restored in 1990."
  },
  "China": {
    famousFor: ["Great Wall", "Terracotta Army", "ancient civilization"],
    exports: ["electronics", "machinery", "textiles", "furniture", "plastics"],
    history: "China is one of the world's oldest civilizations, with over 4,000 years of recorded history. Dynastic rule ended with the Republic in 1912, and the People's Republic was founded in 1949. Economic reforms since 1978 have made it the world's second-largest economy."
  },
  "Colombia": {
    famousFor: ["coffee", "emeralds", "biodiversity"],
    exports: ["crude oil", "coffee", "coal", "gold", "bananas"],
    history: "Colombia was a center of pre-Columbian civilizations and became a key part of the Spanish Empire. It gained independence in 1819 under Simón Bolívar. Decades of internal conflict between the government and guerrilla groups ended with a peace deal in 2016."
  },
  "Comoros": {
    famousFor: ["ylang-ylang perfume production", "volcanic islands", "coelacanth discovery"],
    exports: ["cloves", "vanilla", "ylang-ylang", "copra"],
    history: "The Comoros islands have been influenced by Arab, African, and French cultures over centuries. They gained independence from France in 1975, though Mayotte voted to remain French. The nation has experienced over 20 coups or attempted coups since independence."
  },
  "Congo": {
    famousFor: ["Congo River", "tropical rainforests", "Brazzaville riverfront"],
    exports: ["crude oil", "timber", "potash", "sugar"],
    history: "The Republic of the Congo was part of French Equatorial Africa and gained independence in 1960. It became Africa's first Marxist state in 1970 but transitioned to multiparty politics in the 1990s. Oil production dominates the economy despite vast forest resources."
  },
  "Costa Rica": {
    famousFor: ["cloud forests", "biodiversity", "no standing army"],
    exports: ["medical devices", "bananas", "pineapples", "coffee"],
    history: "Costa Rica gained independence from Spain in 1821 and abolished its military in 1948 after a brief civil war. It has since become Central America's most stable democracy. The country is a global leader in environmental conservation, with over 25% of its land protected."
  },
  "Côte d'Ivoire": {
    famousFor: ["world's largest cocoa producer", "Basilica of Our Lady of Peace", "diverse ethnic cultures"],
    exports: ["cocoa", "cashew nuts", "rubber", "gold", "refined petroleum"],
    history: "Côte d'Ivoire was a French colony that gained independence in 1960. Under Félix Houphouët-Boigny it experienced an 'economic miracle' driven by cocoa exports. A civil war in the 2000s disrupted the country, but it has since recovered as West Africa's largest economy."
  },
  "Croatia": {
    famousFor: ["Dubrovnik old town", "Plitvice Lakes", "Adriatic coastline"],
    exports: ["refined petroleum", "pharmaceuticals", "vehicles", "wood", "electrical equipment"],
    history: "Croatia was part of the Austro-Hungarian Empire and later Yugoslavia. It declared independence in 1991, leading to a war that ended in 1995. It joined the European Union in 2013 and the eurozone in 2023, and is known for its stunning Adriatic coast."
  },
  "Cuba": {
    famousFor: ["classic American cars", "cigars", "salsa music"],
    exports: ["sugar", "nickel", "tobacco", "medical products", "citrus"],
    history: "Cuba was a Spanish colony until 1898 and briefly under US influence. Fidel Castro's revolution in 1959 established a communist state allied with the Soviet Union. The US trade embargo, in place since 1962, has profoundly shaped the country's economy and international relations."
  },
  "Cyprus": {
    famousFor: ["birthplace of Aphrodite", "ancient ruins", "Mediterranean beaches"],
    exports: ["refined petroleum", "ships", "pharmaceuticals", "cheese"],
    history: "Cyprus has been ruled by many civilizations including Greeks, Romans, Ottomans, and the British. It gained independence in 1960 but has been divided since Turkey's 1974 invasion of the north. The Republic of Cyprus joined the European Union in 2004."
  },
  "Czechia": {
    famousFor: ["Prague Castle", "beer brewing tradition", "Bohemian crystal"],
    exports: ["vehicles", "machinery", "electronics", "glass", "iron and steel"],
    history: "The Czech lands were the heart of the Kingdom of Bohemia and later part of the Austro-Hungarian Empire. Czechoslovakia was created in 1918 and peacefully split into Czechia and Slovakia in 1993. It joined the EU in 2004 and is a major manufacturing hub."
  },
  "Democratic Republic of the Congo": {
    famousFor: ["Congo River", "vast mineral wealth", "Virunga mountain gorillas"],
    exports: ["cobalt", "copper", "diamonds", "gold", "crude oil"],
    history: "The DRC was brutally exploited as King Leopold II's personal colony before becoming the Belgian Congo. It gained independence in 1960 and was known as Zaire under Mobutu's dictatorship from 1965 to 1997. It holds enormous mineral wealth but has been devastated by ongoing conflict."
  },
  "Denmark": {
    famousFor: ["LEGO", "Viking heritage", "hygge lifestyle"],
    exports: ["pharmaceuticals", "machinery", "wind turbines", "pork", "dairy"],
    history: "Denmark was the center of the Viking world and one of Europe's oldest kingdoms. It once controlled a vast Nordic empire including Norway and Iceland. Today it is known for its welfare state, renewable energy leadership, and consistently ranking among the world's happiest countries."
  },
  "Djibouti": {
    famousFor: ["Lake Assal (Africa's lowest point)", "strategic port location"],
    exports: ["livestock", "coffee", "salt"],
    history: "Djibouti was the French colony of French Somaliland, gaining independence in 1977. Its strategic location at the entrance to the Red Sea and Suez Canal has made it home to multiple foreign military bases. It serves as a key shipping and logistics hub for East Africa."
  },
  "Dominica": {
    famousFor: ["Boiling Lake", "lush rainforests", "Caribbean's 'Nature Isle'"],
    exports: ["bananas", "soap", "coconuts", "citrus"],
    history: "Dominica was one of the last Caribbean islands to be colonized due to the fierce resistance of the indigenous Kalinago people. It changed hands between France and Britain before gaining independence in 1978. It is one of the youngest islands in the Caribbean, formed by volcanic activity."
  },
  "Dominican Republic": {
    famousFor: ["Caribbean beaches", "merengue music", "baseball talent"],
    exports: ["gold", "cigars", "sugar", "medical instruments", "bananas"],
    history: "The Dominican Republic shares the island of Hispaniola with Haiti and was the site of the first permanent European settlement in the Americas. It gained independence from Haiti in 1844 and endured Trujillo's dictatorship from 1930 to 1961. Tourism is now its largest industry."
  },
  "Ecuador": {
    famousFor: ["Galápagos Islands", "Amazon rainforest", "equatorial line"],
    exports: ["crude oil", "bananas", "shrimp", "cocoa", "flowers"],
    history: "Ecuador was part of the Inca Empire and then a Spanish colony. It gained independence in 1830 and is named for the equator that runs through it. The Galápagos Islands inspired Darwin's theory of evolution and remain a global biodiversity treasure."
  },
  "Egypt": {
    famousFor: ["Pyramids of Giza", "Nile River", "ancient pharaonic civilization"],
    exports: ["crude oil", "natural gas", "gold", "textiles", "fertilizers"],
    history: "Egypt is one of the world's oldest civilizations, with the pharaonic era spanning over 3,000 years. It was ruled by Greeks, Romans, Arabs, Ottomans, and the British before gaining independence in 1922. The Suez Canal, opened in 1869, remains one of the world's most vital waterways."
  },
  "El Salvador": {
    famousFor: ["Mayan ruins of Joya de Cerén", "Pacific surf beaches", "pupusa cuisine"],
    exports: ["textiles", "coffee", "sugar", "ethanol", "iron and steel"],
    history: "El Salvador was part of the Mayan civilization and later a Spanish colony. It became the smallest and most densely populated Central American nation after independence in 1821. A devastating civil war from 1979 to 1992 killed over 75,000 people."
  },
  "Equatorial Guinea": {
    famousFor: ["Bioko Island", "oil wealth", "only Spanish-speaking African country"],
    exports: ["crude oil", "natural gas", "timber", "cocoa"],
    history: "Equatorial Guinea was a Spanish colony and the only Spanish-speaking country in mainland Africa. It gained independence in 1968 and experienced dictatorship under Macías Nguema. Oil discovered in the 1990s made it one of Africa's wealthiest nations per capita, though inequality remains extreme."
  },
  "Eritrea": {
    famousFor: ["Art Deco architecture in Asmara", "Red Sea coastline", "Dahlak Archipelago"],
    exports: ["gold", "zinc", "copper", "salt", "livestock"],
    history: "Eritrea was an Italian colony and later federated with Ethiopia by the UN. A 30-year war of independence ended in 1993 when Eritrea became Africa's newest nation at the time. A border war with Ethiopia from 1998 to 2000 ended with a peace deal in 2018."
  },
  "Estonia": {
    famousFor: ["digital society and e-governance", "medieval old town of Tallinn", "song festival tradition"],
    exports: ["electronics", "mineral fuels", "wood", "machinery", "food products"],
    history: "Estonia was ruled by Danes, Germans, Swedes, and Russians over the centuries. It first gained independence in 1918, was occupied by the Soviet Union in 1940, and regained independence in 1991. It has since become a global leader in digital innovation and e-governance."
  },
  "Eswatini": {
    famousFor: ["Incwala ceremony", "Hlane Royal National Park", "last absolute monarchy in Africa"],
    exports: ["sugar", "soft drink concentrates", "textiles", "wood pulp"],
    history: "Eswatini (formerly Swaziland) is one of Africa's last absolute monarchies, with a royal dynasty dating back centuries. It was a British protectorate from 1903 to 1968. It renamed itself Eswatini in 2018 to mark 50 years of independence."
  },
  "Ethiopia": {
    famousFor: ["birthplace of coffee", "Lalibela rock-hewn churches", "Lucy fossil"],
    exports: ["coffee", "sesame seeds", "cut flowers", "gold", "leather"],
    history: "Ethiopia is one of the oldest nations in the world and was never colonized, except for a brief Italian occupation from 1936 to 1941. Emperor Haile Selassie ruled until 1974, followed by a Marxist regime. It has experienced rapid economic growth in recent decades."
  },
  "Fiji": {
    famousFor: ["tropical islands", "coral reefs", "rugby culture"],
    exports: ["sugar", "fish", "water", "clothing", "gold"],
    history: "Fiji was settled by Melanesian and Polynesian peoples over 3,500 years ago. It became a British colony in 1874 and gained independence in 1970. Multiple coups have disrupted its politics, but it remains the most developed Pacific Island nation."
  },
  "Finland": {
    famousFor: ["saunas", "Northern Lights", "Santa Claus Village"],
    exports: ["machinery", "paper", "refined petroleum", "vehicles", "electronics"],
    history: "Finland was part of Sweden for centuries and then a Russian Grand Duchy from 1809. It declared independence in 1917 and fought the Soviet Union in the Winter War of 1939. It joined the European Union in 1995 and NATO in 2023, and consistently ranks among the world's happiest countries."
  },
  "France": {
    famousFor: ["Eiffel Tower", "wine and cuisine", "fashion"],
    exports: ["aircraft", "vehicles", "pharmaceuticals", "wine", "machinery"],
    history: "France has been a major European power since the Middle Ages. The French Revolution of 1789 transformed its monarchy into a republic and inspired democratic movements worldwide. Today it is a leading EU member, a permanent UN Security Council member, and a global cultural influence."
  },
  "Gabon": {
    famousFor: ["Lopé National Park", "equatorial rainforests", "gorilla and elephant sanctuaries"],
    exports: ["crude oil", "manganese", "timber", "uranium"],
    history: "Gabon was part of French Equatorial Africa and gained independence in 1960. The Bongo family ruled for over 55 years until a military coup in 2023. Oil wealth has made it one of sub-Saharan Africa's most prosperous nations per capita."
  },
  "Gambia": {
    famousFor: ["River Gambia", "birdwatching", "Roots heritage tourism"],
    exports: ["peanuts", "fish", "cotton", "palm kernels"],
    history: "Gambia was a British colony centered on the river of the same name, surrounded by French-controlled Senegal. It gained independence in 1965 and is Africa's smallest mainland nation. Alex Haley's book 'Roots' brought international attention to its role in the slave trade."
  },
  "Georgia": {
    famousFor: ["ancient wine-making tradition", "Caucasus Mountains", "cave city of Vardzia"],
    exports: ["copper", "vehicles", "wine", "ferroalloys", "hazelnuts"],
    history: "Georgia is one of the world's oldest civilizations, with a wine-making tradition dating back 8,000 years. It was part of the Russian Empire and Soviet Union before regaining independence in 1991. Conflict with Russia over South Ossetia and Abkhazia continues to shape its politics."
  },
  "Germany": {
    famousFor: ["automotive engineering", "Oktoberfest", "Brandenburg Gate"],
    exports: ["vehicles", "machinery", "chemicals", "electronics", "pharmaceuticals"],
    history: "Germany was unified as a nation-state in 1871 under Bismarck. It was responsible for both World Wars and was divided into East and West during the Cold War. Reunification in 1990 made it Europe's largest economy and a driving force of the European Union."
  },
  "Ghana": {
    famousFor: ["Cape Coast Castle", "Ashanti culture", "cocoa production"],
    exports: ["gold", "crude oil", "cocoa", "timber", "manganese"],
    history: "Ghana was home to the powerful Ashanti Empire and was a major center of the gold and slave trades. Known as the Gold Coast under British rule, it became the first sub-Saharan African country to gain independence in 1957 under Kwame Nkrumah."
  },
  "Greece": {
    famousFor: ["Acropolis and Parthenon", "birthplace of democracy", "Greek islands"],
    exports: ["refined petroleum", "aluminum", "olive oil", "pharmaceuticals", "fish"],
    history: "Ancient Greece was the cradle of Western civilization, giving birth to democracy, philosophy, and the Olympic Games. After centuries of Ottoman rule, modern Greece gained independence in 1830. It joined the EU in 1981 and faced a severe debt crisis in 2009-2018."
  },
  "Grenada": {
    famousFor: ["nutmeg production (Spice Isle)", "Grand Anse Beach"],
    exports: ["nutmeg", "mace", "cocoa", "fish", "fruit"],
    history: "Grenada was colonized by the French and then the British, gaining independence in 1974. A Marxist coup in 1979 led to a US invasion in 1983. Known as the 'Spice Isle,' it is one of the world's largest producers of nutmeg."
  },
  "Guatemala": {
    famousFor: ["Tikal Maya ruins", "Antigua Guatemala", "volcanic highlands"],
    exports: ["bananas", "coffee", "sugar", "palm oil", "textiles"],
    history: "Guatemala was the heart of the ancient Maya civilization and later a Spanish colony. It gained independence in 1821 and suffered a 36-year civil war from 1960 to 1996. It is Central America's most populous country with a rich Indigenous cultural heritage."
  },
  "Guinea": {
    famousFor: ["Fouta Djallon highlands", "bauxite reserves", "source of the Niger River"],
    exports: ["bauxite", "gold", "alumina", "fish", "diamonds"],
    history: "Guinea was part of several West African empires before French colonization. It was the first French African colony to gain independence in 1958, voting 'no' in de Gaulle's referendum. It holds the world's largest bauxite reserves."
  },
  "Guinea-Bissau": {
    famousFor: ["Bijagós Archipelago", "cashew nut production"],
    exports: ["cashew nuts", "fish", "timber", "peanuts"],
    history: "Guinea-Bissau was a Portuguese colony used heavily in the slave trade. A long guerrilla war led to independence in 1974. It has experienced chronic political instability with multiple coups and is one of the world's poorest nations."
  },
  "Guyana": {
    famousFor: ["Kaieteur Falls", "vast rainforests", "recent oil discovery"],
    exports: ["gold", "crude oil", "rice", "sugar", "bauxite"],
    history: "Guyana was colonized by the Dutch and then the British, gaining independence in 1966. It is the only English-speaking country in South America. The recent discovery of massive offshore oil reserves is rapidly transforming its economy."
  },
  "Haiti": {
    famousFor: ["Citadelle Laferrière", "first Black republic", "vibrant art scene"],
    exports: ["textiles", "cocoa", "mangoes", "coffee", "essential oils"],
    history: "Haiti was a French colony and the world's most profitable slave colony. A slave revolt led to independence in 1804, making it the first free Black republic and the second independent nation in the Americas. Centuries of political instability and natural disasters have left it the poorest country in the Western Hemisphere."
  },
  "Honduras": {
    famousFor: ["Copán Maya ruins", "Bay Islands diving", "cloud forests"],
    exports: ["coffee", "bananas", "palm oil", "shrimp", "textiles"],
    history: "Honduras was part of the Maya civilization and became a Spanish colony. It gained independence in 1821 and became the origin of the term 'banana republic' due to US fruit company influence. It faces challenges from poverty, crime, and hurricanes."
  },
  "Hungary": {
    famousFor: ["thermal baths of Budapest", "Parliament building", "goulash"],
    exports: ["vehicles", "machinery", "electronics", "pharmaceuticals", "food products"],
    history: "Hungary was founded in 895 AD by Magyar tribes. It was a major part of the Austro-Hungarian Empire until its dissolution in 1918. After decades of communist rule under the Soviet Union, it transitioned to democracy in 1989 and joined the EU in 2004."
  },
  "Iceland": {
    famousFor: ["geysers and hot springs", "Northern Lights", "Viking heritage"],
    exports: ["aluminum", "fish", "ferrosilicon", "geothermal energy"],
    history: "Iceland was settled by Norse Vikings in the 9th century and established one of the world's oldest parliaments, the Althing, in 930 AD. It was under Norwegian and then Danish rule before gaining full independence in 1944. It is powered almost entirely by renewable geothermal and hydroelectric energy."
  },
  "India": {
    famousFor: ["Taj Mahal", "diverse cultures and languages", "Bollywood"],
    exports: ["refined petroleum", "pharmaceuticals", "gems and jewelry", "rice", "textiles"],
    history: "India is one of the world's oldest civilizations, home to the Indus Valley civilization over 4,500 years ago. It was ruled by the British Empire until gaining independence in 1947 under Mahatma Gandhi's nonviolent movement. It is the world's most populous country and largest democracy."
  },
  "Indonesia": {
    famousFor: ["Bali", "Komodo dragons", "world's largest archipelago"],
    exports: ["palm oil", "coal", "petroleum gas", "rubber", "nickel"],
    history: "Indonesia was home to powerful maritime empires and was colonized by the Dutch for over 300 years. It declared independence in 1945 under Sukarno. With over 17,000 islands and 270 million people, it is the world's largest archipelago and fourth most populous nation."
  },
  "Iran": {
    famousFor: ["Persepolis ruins", "Persian carpets", "ancient Persian civilization"],
    exports: ["crude oil", "petrochemicals", "plastics", "iron and steel", "fruits"],
    history: "Iran is heir to one of the world's oldest civilizations, the Persian Empire founded by Cyrus the Great in 550 BC. A 1979 revolution overthrew the Shah and established an Islamic Republic. International sanctions over its nuclear program have shaped modern Iranian politics."
  },
  "Iraq": {
    famousFor: ["ancient Mesopotamia (cradle of civilization)", "Babylon ruins", "Marshlands of southern Iraq"],
    exports: ["crude oil", "refined petroleum", "gold"],
    history: "Iraq encompasses ancient Mesopotamia, where writing, agriculture, and cities first developed. It became a British mandate after World War I and an independent kingdom in 1932. The 2003 US invasion toppled Saddam Hussein's regime, leading to years of conflict and reconstruction."
  },
  "Ireland": {
    famousFor: ["Cliffs of Moher", "literary tradition", "Guinness"],
    exports: ["pharmaceuticals", "medical devices", "chemicals", "software", "dairy"],
    history: "Ireland was under British rule for centuries and suffered the devastating Great Famine of the 1840s. It gained independence in 1922 after a war of independence. The 'Celtic Tiger' economic boom of the 1990s-2000s transformed it into one of Europe's most prosperous nations."
  },
  "Israel": {
    famousFor: ["Jerusalem holy sites", "Dead Sea", "tech startup ecosystem"],
    exports: ["diamonds", "electronics", "machinery", "pharmaceuticals", "chemicals"],
    history: "Israel was established in 1948 as a homeland for the Jewish people following the Holocaust. The ongoing Israeli-Palestinian conflict has defined much of its history. It has developed a highly advanced economy and is known as the 'Startup Nation' for its tech sector."
  },
  "Italy": {
    famousFor: ["Colosseum and Roman ruins", "Renaissance art", "pizza and pasta"],
    exports: ["machinery", "vehicles", "pharmaceuticals", "clothing", "wine"],
    history: "Italy was the center of the Roman Empire and the birthplace of the Renaissance. It unified as a nation in 1861 after centuries of fragmented city-states. It is a founding member of the European Union and home to the Vatican City."
  },
  "Jamaica": {
    famousFor: ["reggae music and Bob Marley", "Blue Mountain coffee", "sprinting champions"],
    exports: ["aluminum oxide", "rum", "coffee", "sugar", "chemicals"],
    history: "Jamaica was inhabited by the Taíno people before Spanish and then British colonization. Sugar plantations built on enslaved African labor dominated the economy for centuries. It gained independence in 1962 and has had an outsized cultural impact through music and athletics."
  },
  "Japan": {
    famousFor: ["Mount Fuji", "cherry blossoms", "sushi and anime"],
    exports: ["vehicles", "machinery", "electronics", "iron and steel", "plastics"],
    history: "Japan has an imperial dynasty dating back over 2,600 years, the world's oldest continuing hereditary monarchy. After rapid modernization in the Meiji era, it became a major power. Post-World War II reconstruction led to an economic miracle, making it the world's third-largest economy."
  },
  "Jordan": {
    famousFor: ["Petra", "Dead Sea", "Wadi Rum desert"],
    exports: ["phosphates", "fertilizers", "potash", "textiles", "pharmaceuticals"],
    history: "Jordan's territory includes ancient Nabataean, Roman, and Ottoman sites. The Hashemite Kingdom was established in 1921 under British mandate and became fully independent in 1946. It has been a key mediator in Middle Eastern conflicts and hosts large numbers of refugees."
  },
  "Kazakhstan": {
    famousFor: ["vast steppe landscapes", "Baikonur Cosmodrome", "nomadic heritage"],
    exports: ["crude oil", "natural gas", "uranium", "copper", "wheat"],
    history: "Kazakhstan was home to nomadic Turkic and Mongol peoples and part of the Silk Road. It was incorporated into the Russian Empire and later the Soviet Union, where it was used for nuclear testing. It became independent in 1991 and is Central Asia's largest and wealthiest nation."
  },
  "Kenya": {
    famousFor: ["Maasai Mara wildlife reserve", "Great Rift Valley", "long-distance runners"],
    exports: ["tea", "cut flowers", "coffee", "vegetables", "titanium ore"],
    history: "Kenya is home to some of humanity's oldest archaeological sites. It was a British colony from the late 19th century, and the Mau Mau uprising played a key role in achieving independence in 1963. It is East Africa's largest economy and a leader in mobile banking innovation."
  },
  "Kiribati": {
    famousFor: ["straddling four hemispheres", "first place to see the new year"],
    exports: ["fish", "coconut products", "seaweed"],
    history: "Kiribati is a nation of 33 coral atolls scattered across the central Pacific. It was a British colony known as the Gilbert Islands and gained independence in 1979. Rising sea levels due to climate change pose an existential threat to the low-lying nation."
  },
  "Kuwait": {
    famousFor: ["oil wealth", "Kuwait Towers", "pearl diving heritage"],
    exports: ["crude oil", "refined petroleum", "petrochemicals"],
    history: "Kuwait was a small trading port and pearl diving center before oil was discovered in 1938. It gained independence from Britain in 1961. Iraq's invasion in 1990 led to the Gulf War, after which Kuwait was liberated by a US-led coalition."
  },
  "Kyrgyzstan": {
    famousFor: ["Tian Shan mountains", "nomadic yurt culture", "Issyk-Kul Lake"],
    exports: ["gold", "cotton", "tobacco", "dairy products", "mercury"],
    history: "Kyrgyzstan has a rich nomadic heritage tied to the epic poem 'Manas.' It was absorbed into the Russian Empire and then the Soviet Union. After independence in 1991, it has experienced several political revolutions but maintains a more democratic tradition than its Central Asian neighbors."
  },
  "Laos": {
    famousFor: ["Luang Prabang temples", "Mekong River", "Plain of Jars"],
    exports: ["electricity", "gold", "copper", "coffee", "rubber"],
    history: "Laos was the seat of the Kingdom of Lan Xang from the 14th century. It was a French protectorate until 1953 and was heavily bombed during the Vietnam War, making it the most bombed country per capita in history. It has been a communist state since 1975."
  },
  "Latvia": {
    famousFor: ["Art Nouveau architecture in Riga", "Song and Dance Festival", "Baltic amber"],
    exports: ["wood", "machinery", "metals", "food products", "textiles"],
    history: "Latvia was ruled by German crusaders, Swedes, and Russians before first gaining independence in 1918. Soviet occupation from 1940 to 1991 was resisted through a cultural movement. Latvia regained independence in 1991 and joined the EU and NATO in 2004."
  },
  "Lebanon": {
    famousFor: ["ancient Phoenician heritage", "Cedars of God", "Beirut's nightlife"],
    exports: ["gold", "jewelry", "iron and steel", "food products"],
    history: "Lebanon is the homeland of the ancient Phoenicians, who invented the alphabet. French mandate rule ended in 1943 with independence. A devastating 15-year civil war from 1975 to 1990 and the 2020 Beirut port explosion have deeply affected the nation."
  },
  "Lesotho": {
    famousFor: ["mountain kingdom entirely above 1,000 meters", "Maletsunyane Falls"],
    exports: ["diamonds", "clothing", "wool", "mohair", "water"],
    history: "Lesotho was founded by King Moshoeshoe I in the 19th century as a refuge from Zulu wars. It became the British protectorate of Basutoland and gained independence in 1966. It is the only country entirely above 1,000 meters elevation and is completely surrounded by South Africa."
  },
  "Liberia": {
    famousFor: ["oldest republic in Africa", "rubber plantations", "Sapo National Park"],
    exports: ["iron ore", "rubber", "gold", "timber", "palm oil"],
    history: "Liberia was founded in 1847 by freed American slaves, making it Africa's oldest republic. Tensions between settlers and indigenous groups persisted for decades. Two devastating civil wars from 1989 to 2003 killed over 250,000 people, followed by a challenging rebuilding process."
  },
  "Libya": {
    famousFor: ["Sahara Desert", "ancient Roman city of Leptis Magna"],
    exports: ["crude oil", "natural gas", "refined petroleum"],
    history: "Libya was part of the Roman Empire and later the Ottoman Empire before Italian colonization in 1911. Muammar Gaddafi ruled for 42 years until he was overthrown in 2011. The country has since struggled with rival governments and militia control."
  },
  "Liechtenstein": {
    famousFor: ["Alpine scenery", "Royal family's art collection", "financial center"],
    exports: ["dental products", "electronics", "metal goods", "ceramics"],
    history: "Liechtenstein is one of the world's smallest countries, nestled between Switzerland and Austria. The principality was created within the Holy Roman Empire in 1719. It abolished its military in 1868 and has since become a prosperous financial center with very low taxes."
  },
  "Lithuania": {
    famousFor: ["Hill of Crosses", "Vilnius Old Town", "basketball passion"],
    exports: ["refined petroleum", "furniture", "wheat", "chemicals", "plastics"],
    history: "Lithuania was once one of Europe's largest countries as part of the Grand Duchy of Lithuania, stretching to the Black Sea. It was annexed by Russia and later the Soviet Union. It was the first Soviet republic to declare independence in 1990, joining the EU in 2004."
  },
  "Luxembourg": {
    famousFor: ["medieval castles", "European Union institutions", "banking sector"],
    exports: ["iron and steel", "machinery", "rubber products", "glass"],
    history: "Luxembourg has been a duchy since the 10th century and was a founding member of the European Union. Despite its small size, it is one of the world's wealthiest countries per capita. It hosts several EU institutions, including the European Court of Justice."
  },
  "Madagascar": {
    famousFor: ["unique lemurs", "baobab trees", "extraordinary biodiversity"],
    exports: ["vanilla", "cloves", "nickel", "clothing", "seafood"],
    history: "Madagascar split from the Indian subcontinent around 88 million years ago, developing unique flora and fauna found nowhere else on Earth. The Malagasy kingdom unified the island before French colonization in 1896. It gained independence in 1960 and is the world's fourth-largest island."
  },
  "Malawi": {
    famousFor: ["Lake Malawi", "friendly people (Warm Heart of Africa)"],
    exports: ["tobacco", "tea", "sugar", "cotton", "uranium"],
    history: "Malawi was the British protectorate of Nyasaland, gaining independence in 1966. Hastings Banda ruled as dictator until multiparty democracy was established in 1994. Lake Malawi, one of Africa's Great Rift Valley lakes, contains more fish species than any other lake in the world."
  },
  "Malaysia": {
    famousFor: ["Petronas Twin Towers", "tropical rainforests", "diverse cuisine"],
    exports: ["electronics", "palm oil", "petroleum", "rubber", "chemicals"],
    history: "Malaysia's strategic location on the Strait of Malacca made it a trading hub for centuries. It was colonized by the Portuguese, Dutch, and British. The Federation of Malaysia was formed in 1963, and rapid industrialization has made it one of Southeast Asia's most developed nations."
  },
  "Maldives": {
    famousFor: ["overwater bungalows", "coral atolls", "crystal-clear waters"],
    exports: ["fish", "clothing", "coconut products"],
    history: "The Maldives is the world's lowest-lying country, with no point above 2.4 meters. It was a sultanate influenced by Arab traders and a British protectorate until independence in 1965. Rising sea levels threaten its very existence, making climate change an urgent national priority."
  },
  "Mali": {
    famousFor: ["Timbuktu", "Djenné's Great Mosque", "ancient trading empires"],
    exports: ["gold", "cotton", "livestock", "salt"],
    history: "Mali was the center of several powerful West African empires, including the Mali Empire whose ruler Mansa Musa was the wealthiest person in history. Timbuktu was a legendary center of learning. It was a French colony before gaining independence in 1960 and faces ongoing security challenges."
  },
  "Malta": {
    famousFor: ["ancient megalithic temples", "Knights of St. John heritage", "Mediterranean culture"],
    exports: ["pharmaceuticals", "electronics", "petroleum", "fish"],
    history: "Malta has been inhabited since 5900 BC and holds some of the world's oldest freestanding structures. Ruled by Phoenicians, Romans, Arabs, Normans, and the Knights of St. John, it became a British colony crucial in World War II. It gained independence in 1964 and joined the EU in 2004."
  },
  "Marshall Islands": {
    famousFor: ["Bikini Atoll nuclear test site", "coral atolls", "traditional outrigger canoe sailing"],
    exports: ["fish", "coconut oil", "copra"],
    history: "The Marshall Islands were colonized by Spain, Germany, and Japan before US administration after World War II. The US conducted 67 nuclear tests there between 1946 and 1958, including at Bikini Atoll. The islands gained independence in 1986 and face severe threats from rising sea levels."
  },
  "Mauritania": {
    famousFor: ["Sahara Desert", "Banc d'Arguin National Park", "Richat Structure (Eye of the Sahara)"],
    exports: ["iron ore", "gold", "fish", "copper"],
    history: "Mauritania was part of the great trans-Saharan trade routes and the Almoravid Empire. It became a French colony and gained independence in 1960. It was the last country in the world to officially abolish slavery in 1981, though the practice persists in some areas."
  },
  "Mauritius": {
    famousFor: ["dodo bird (extinct)", "multicultural society", "tropical beaches"],
    exports: ["clothing", "sugar", "fish", "diamonds", "rum"],
    history: "Mauritius was uninhabited until Dutch settlement in the 17th century, followed by French and British colonial rule. The dodo bird, native only to Mauritius, went extinct in the 1680s. Since independence in 1968, it has become one of Africa's most prosperous and democratic nations."
  },
  "Mexico": {
    famousFor: ["Aztec and Maya pyramids", "tacos and tequila", "Day of the Dead"],
    exports: ["vehicles", "electronics", "crude oil", "machinery", "medical instruments"],
    history: "Mexico was home to advanced civilizations including the Olmec, Maya, and Aztec. Spanish conquest in 1521 led to 300 years of colonial rule. After independence in 1821 and a revolution in 1910, it has become Latin America's second-largest economy."
  },
  "Micronesia": {
    famousFor: ["ancient ruins of Nan Madol", "coral reefs", "traditional navigation"],
    exports: ["fish", "clothing", "bananas", "black pepper"],
    history: "The Federated States of Micronesia comprises over 600 islands across the western Pacific. They were colonized by Spain, Germany, Japan, and then administered by the US. Independence came in 1986 under a Compact of Free Association with the United States."
  },
  "Moldova": {
    famousFor: ["wine cellars (Mileștii Mici is world's largest)", "monasteries"],
    exports: ["sunflower oil", "wine", "wheat", "clothing", "footwear"],
    history: "Moldova was the core of the medieval Principality of Moldavia. It was annexed by Russia in 1812 and later became part of the Soviet Union. After independence in 1991, the breakaway region of Transnistria has remained a frozen conflict. It is one of Europe's poorest countries."
  },
  "Monaco": {
    famousFor: ["Monte Carlo Casino", "Formula 1 Grand Prix", "luxury yachts"],
    exports: ["chemicals", "plastics", "rubber products"],
    history: "Monaco has been ruled by the Grimaldi family since 1297, making it one of the oldest ruling dynasties in Europe. The tiny city-state on the French Riviera has no income tax and is famous for its wealth and glamour. It is the world's second-smallest country and most densely populated."
  },
  "Mongolia": {
    famousFor: ["Genghis Khan's empire", "vast steppe grasslands", "nomadic herding culture"],
    exports: ["copper", "gold", "coal", "iron ore", "cashmere"],
    history: "Mongolia was the center of the largest contiguous land empire in history under Genghis Khan in the 13th century. It became a Soviet satellite state in 1924 and transitioned to democracy in 1990. It remains one of the most sparsely populated countries in the world."
  },
  "Montenegro": {
    famousFor: ["Bay of Kotor", "Adriatic coastline", "Durmitor National Park"],
    exports: ["aluminum", "electricity", "iron and steel", "wood", "wine"],
    history: "Montenegro was an independent principality that resisted Ottoman conquest for centuries. It merged with Serbia and other states to form Yugoslavia. After the peaceful 2006 independence referendum, it became Europe's newest state and an EU candidate country."
  },
  "Morocco": {
    famousFor: ["Marrakech medina", "Sahara Desert", "Fez's leather tanneries"],
    exports: ["phosphates", "vehicles", "electronics", "citrus", "textiles"],
    history: "Morocco has been home to Berber peoples for millennia and was a powerful empire under various dynasties. It was divided between French and Spanish protectorates before gaining independence in 1956. It is the world's largest exporter of phosphates and a growing automotive hub."
  },
  "Mozambique": {
    famousFor: ["Bazaruto Archipelago", "Island of Mozambique", "marine biodiversity"],
    exports: ["aluminum", "coal", "natural gas", "electricity", "tobacco"],
    history: "Mozambique was a Portuguese colony for nearly 500 years and a major slave-trading center. A bloody war of independence ended in 1975, followed by a civil war until 1992. It is now one of Africa's fastest-growing economies, driven by massive natural gas discoveries."
  },
  "Myanmar": {
    famousFor: ["Bagan temple plains", "Shwedagon Pagoda", "Inle Lake"],
    exports: ["natural gas", "garments", "jade", "rice", "beans"],
    history: "Myanmar was the seat of powerful Burmese kingdoms before British colonization in the 19th century. It gained independence in 1948 and endured decades of military rule. A brief democratic opening was reversed by a 2021 military coup, leading to widespread civil conflict."
  },
  "Namibia": {
    famousFor: ["Namib Desert and sand dunes", "Etosha salt pan", "Skeleton Coast"],
    exports: ["diamonds", "uranium", "zinc", "fish", "beef"],
    history: "Namibia was colonized by Germany in the 1880s, which committed a genocide against the Herero and Nama peoples. South Africa administered it after World War I and imposed apartheid. A long liberation struggle led to independence in 1990."
  },
  "Nauru": {
    famousFor: ["world's smallest republic", "phosphate mining history"],
    exports: ["phosphates", "coconut products"],
    history: "Nauru is a tiny Pacific island that became one of the world's wealthiest nations per capita due to phosphate mining. German, Japanese, and Australian administration preceded independence in 1968. The exhaustion of phosphate reserves has left the nation economically vulnerable."
  },
  "Nepal": {
    famousFor: ["Mount Everest", "Hindu and Buddhist temples", "Himalayan trekking"],
    exports: ["palm oil", "clothing", "carpets", "textiles", "juice"],
    history: "Nepal is the birthplace of Siddhartha Gautama (Buddha) and was never colonized. The Shah dynasty unified the country in 1768 and it was ruled as a Hindu kingdom. A Maoist insurgency and political upheaval led to the abolition of the monarchy in 2008 and establishment of a republic."
  },
  "Netherlands": {
    famousFor: ["tulips and windmills", "canals of Amsterdam", "cycling culture"],
    exports: ["machinery", "chemicals", "refined petroleum", "food products", "flowers"],
    history: "The Netherlands was a major colonial and trading power during its Golden Age in the 17th century. The Dutch East India Company was the world's first multinational corporation. Despite being one of Europe's lowest-lying countries, innovative water management has reclaimed much land from the sea."
  },
  "New Zealand": {
    famousFor: ["Māori culture", "Lord of the Rings filming locations", "stunning fjords"],
    exports: ["dairy", "meat", "wood", "fruit", "wine"],
    history: "New Zealand was settled by Polynesian Māori around 1250 AD and colonized by Britain after the 1840 Treaty of Waitangi. It was the first country to grant women the right to vote in 1893. It is known for its environmental stewardship and adventure tourism."
  },
  "Nicaragua": {
    famousFor: ["volcanic landscapes", "colonial city of Granada", "Lake Nicaragua"],
    exports: ["coffee", "beef", "gold", "sugar", "textiles"],
    history: "Nicaragua was a Spanish colony and Central America's largest country by area. The Sandinista revolution overthrew the Somoza dictatorship in 1979, followed by a US-backed Contra war in the 1980s. Political tensions continue to shape the nation."
  },
  "Niger": {
    famousFor: ["Sahara Desert", "Agadez mosque", "dinosaur fossils"],
    exports: ["uranium", "gold", "oil", "cowpeas", "onions"],
    history: "Niger was part of several Saharan empires and kingdoms before French colonization. It gained independence in 1960 and has experienced multiple coups. Despite being one of the world's poorest countries, it holds significant uranium reserves that supply nuclear power worldwide."
  },
  "Nigeria": {
    famousFor: ["Nollywood film industry", "diverse ethnic cultures", "Afrobeats music"],
    exports: ["crude oil", "natural gas", "cocoa", "rubber"],
    history: "Nigeria was home to advanced kingdoms including Benin, Hausa, and Yoruba states. British colonization merged diverse ethnic groups into one nation, gaining independence in 1960. A civil war (1967-1970) and oil wealth have shaped its trajectory as Africa's most populous nation and largest economy."
  },
  "North Korea": {
    famousFor: ["DMZ border zone", "extreme secrecy", "mass choreographed performances"],
    exports: ["minerals", "textiles", "metallurgical products", "weapons"],
    history: "Korea was divided at the 38th parallel after World War II, with the Soviet-backed north becoming the Democratic People's Republic in 1948. The Korean War (1950-1953) ended in an armistice, not a peace treaty. It remains one of the world's most isolated and authoritarian states under the Kim dynasty."
  },
  "North Macedonia": {
    famousFor: ["Lake Ohrid", "Matka Canyon", "Ottoman bazaars"],
    exports: ["catalytic converters", "textiles", "iron and steel", "tobacco"],
    history: "North Macedonia was part of the Ottoman Empire for 500 years and then Yugoslavia. It peacefully declared independence in 1991 but faced a long name dispute with Greece. The 2018 Prespa Agreement resolved the issue by adding 'North' to its name, paving the way for NATO membership."
  },
  "Norway": {
    famousFor: ["fjords", "Northern Lights", "Viking heritage"],
    exports: ["crude oil", "natural gas", "fish", "aluminum", "machinery"],
    history: "Norway was a Viking heartland and later in unions with Denmark and Sweden. It gained full independence in 1905. The discovery of North Sea oil in the 1960s transformed it into one of the world's wealthiest nations, with the largest sovereign wealth fund on Earth."
  },
  "Oman": {
    famousFor: ["ancient frankincense trade", "dramatic fjords of Musandam", "Sultan Qaboos Grand Mosque"],
    exports: ["crude oil", "refined petroleum", "natural gas", "iron ore"],
    history: "Oman was a powerful maritime empire that controlled trading posts from East Africa to India. It was the first Arab state to have diplomatic relations with the US in 1833. Sultan Qaboos modernized the country over his 50-year reign until his death in 2020."
  },
  "Pakistan": {
    famousFor: ["K2 and Karakoram mountains", "Mohenjo-daro ruins", "Mughal architecture"],
    exports: ["textiles", "rice", "leather goods", "surgical instruments", "sports goods"],
    history: "Pakistan was created in 1947 when British India was partitioned into Hindu-majority India and Muslim-majority Pakistan. East Pakistan broke away to form Bangladesh in 1971. It is the world's fifth most populous country and the only Muslim-majority nation with nuclear weapons."
  },
  "Palau": {
    famousFor: ["Rock Islands", "jellyfish lake", "pristine marine ecosystems"],
    exports: ["fish", "shellfish", "copra"],
    history: "Palau was colonized by Spain, Germany, Japan, and then administered by the US after World War II. It gained independence in 1994 under a Compact of Free Association with the US. It established one of the world's largest marine sanctuaries, protecting 80% of its waters."
  },
  "Panama": {
    famousFor: ["Panama Canal", "biodiversity bridge between continents"],
    exports: ["gold", "bananas", "shrimp", "sugar", "iron scrap"],
    history: "Panama was part of Colombia until the US supported its independence in 1903 to build the Panama Canal. The canal, completed in 1914, is one of the most important waterways in the world. Panama took full control of it in 1999 and has become a major financial hub."
  },
  "Papua New Guinea": {
    famousFor: ["extraordinary linguistic diversity", "tribal cultures", "coral reefs"],
    exports: ["gold", "oil", "palm oil", "coffee", "copper"],
    history: "Papua New Guinea is one of the most culturally diverse countries on Earth, with over 800 languages spoken. The eastern half of New Guinea was administered by Australia until independence in 1975. Many communities in the highlands had no contact with the outside world until the 20th century."
  },
  "Paraguay": {
    famousFor: ["Itaipu Dam (one of world's largest)", "Jesuit missions ruins", "yerba mate"],
    exports: ["soybeans", "beef", "electricity", "corn", "wheat"],
    history: "Paraguay was colonized by Spain and gained independence in 1811. The devastating War of the Triple Alliance (1864-1870) killed up to 90% of its male population. A long dictatorship under Stroessner lasted from 1954 to 1989 before a transition to democracy."
  },
  "Peru": {
    famousFor: ["Machu Picchu", "Nazca Lines", "Amazon rainforest"],
    exports: ["copper", "gold", "zinc", "fishmeal", "coffee"],
    history: "Peru was the center of the Inca Empire, the largest empire in pre-Columbian America. Spanish conquest under Pizarro in 1533 brought colonial rule for nearly 300 years. It gained independence in 1821 and holds extraordinary archaeological and natural treasures."
  },
  "Philippines": {
    famousFor: ["thousands of islands", "rice terraces of Banaue", "whale shark encounters"],
    exports: ["electronics", "semiconductors", "coconut oil", "fruits", "copper"],
    history: "The Philippines was a Spanish colony for over 300 years and then a US territory until independence in 1946. Named after King Philip II of Spain, it is an archipelago of over 7,600 islands. It is one of Asia's most vibrant democracies with a large overseas workforce."
  },
  "Poland": {
    famousFor: ["Auschwitz memorial", "Kraków's historic old town", "Wieliczka Salt Mine"],
    exports: ["machinery", "vehicles", "furniture", "electronics", "food products"],
    history: "Poland was once one of Europe's largest kingdoms. It was partitioned and erased from the map for 123 years before reemerging in 1918. It suffered enormously in World War II, including the Holocaust, and lived under communist rule until the Solidarity movement led to democracy in 1989."
  },
  "Portugal": {
    famousFor: ["Age of Exploration heritage", "pastéis de nata", "Fado music"],
    exports: ["vehicles", "refined petroleum", "footwear", "paper", "wine"],
    history: "Portugal launched the Age of Exploration in the 15th century, building a global empire from Brazil to Macau. It was Europe's longest-lasting dictatorship until the 1974 Carnation Revolution restored democracy. It joined the EU in 1986 and adopted the euro in 1999."
  },
  "Qatar": {
    famousFor: ["2022 FIFA World Cup host", "natural gas wealth", "Museum of Islamic Art"],
    exports: ["natural gas", "crude oil", "refined petroleum", "aluminum", "fertilizers"],
    history: "Qatar was a pearl diving and fishing community before oil was discovered in the 1940s. It gained independence from Britain in 1971. It holds the world's third-largest natural gas reserves and has leveraged its wealth to become a major diplomatic and sporting player."
  },
  "Romania": {
    famousFor: ["Dracula's Bran Castle", "painted monasteries of Bucovina", "Carpathian Mountains"],
    exports: ["vehicles", "machinery", "electronics", "wheat", "clothing"],
    history: "Romania traces its roots to the ancient Dacians and Roman colonization. It gained independence from the Ottoman Empire in 1877. The brutal dictatorship of Nicolae Ceaușescu ended with his execution in the 1989 revolution. Romania joined the EU in 2007."
  },
  "Russia": {
    famousFor: ["Red Square and Kremlin", "Trans-Siberian Railway", "ballet and literature"],
    exports: ["crude oil", "natural gas", "metals", "wheat", "timber"],
    history: "Russia grew from the medieval Grand Duchy of Moscow into the world's largest country by area. The 1917 revolution established the Soviet Union, which collapsed in 1991. Under its vast territory spanning 11 time zones, Russia holds enormous natural resources and a complex geopolitical position."
  },
  "Rwanda": {
    famousFor: ["mountain gorillas", "remarkable post-genocide recovery", "clean streets"],
    exports: ["coffee", "tea", "tin ore", "gold", "coltan"],
    history: "Rwanda's history was tragically defined by the 1994 genocide, in which an estimated 800,000 Tutsi and moderate Hutu were killed in 100 days. Since then, the country has achieved remarkable economic growth and reconciliation under President Kagame, earning the nickname 'the Singapore of Africa.'"
  },
  "Saint Kitts and Nevis": {
    famousFor: ["Brimstone Hill Fortress", "sugar plantation heritage", "smallest Caribbean nation"],
    exports: ["electronics", "beverages", "tobacco", "sugar"],
    history: "Saint Kitts was the first Caribbean island colonized by both the British and French. Sugar cultivation using enslaved labor dominated for centuries. It gained independence in 1983 and is the smallest sovereign state in the Western Hemisphere."
  },
  "Saint Lucia": {
    famousFor: ["twin Pitons volcanic peaks", "lush rainforests"],
    exports: ["bananas", "beverages", "cocoa", "vegetables"],
    history: "Saint Lucia changed hands between Britain and France 14 times, more than any other Caribbean island. It gained independence in 1974. Despite its small size, it has produced two Nobel laureates: economist Arthur Lewis and poet Derek Walcott."
  },
  "Saint Vincent and the Grenadines": {
    famousFor: ["sailing and yacht culture", "La Soufrière volcano", "Tobago Cays"],
    exports: ["bananas", "flour", "rice", "fish"],
    history: "Saint Vincent was one of the last Caribbean islands colonized due to resistance by the indigenous Garifuna and Carib peoples. It became a British colony dependent on sugar and gained independence in 1979. The La Soufrière volcano erupted most recently in 2021."
  },
  "Samoa": {
    famousFor: ["traditional fa'a Samoa culture", "lava fields", "Robert Louis Stevenson's final home"],
    exports: ["fish", "coconut products", "taro", "automotive parts"],
    history: "Samoa was governed by Germany and then New Zealand before becoming the first Pacific Island nation to gain independence in 1962. It crossed the International Date Line in 2011 to align with Asian trading partners. Traditional chiefs (matai) still play a central role in governance."
  },
  "San Marino": {
    famousFor: ["world's oldest republic", "three medieval towers", "Mount Titano"],
    exports: ["building stone", "ceramics", "clothing", "electronics"],
    history: "San Marino claims to be the world's oldest surviving republic, founded in 301 AD by Saint Marinus. Entirely surrounded by Italy, it maintained independence through diplomacy even as Italian states unified around it. It has one of the world's highest GDPs per capita."
  },
  "Sao Tome and Principe": {
    famousFor: ["cocoa plantations", "equatorial biodiversity", "colonial architecture"],
    exports: ["cocoa", "palm oil", "coffee", "copra"],
    history: "São Tomé and Príncipe were uninhabited volcanic islands settled by the Portuguese in the 15th century as sugar and later cocoa plantations. They gained independence in 1975. They are Africa's second-smallest nation and lie on the equator in the Gulf of Guinea."
  },
  "Saudi Arabia": {
    famousFor: ["Mecca and Medina holy sites", "oil wealth", "vast desert landscapes"],
    exports: ["crude oil", "refined petroleum", "petrochemicals", "plastics"],
    history: "Saudi Arabia was unified by the House of Saud in 1932. The discovery of oil in 1938 transformed it from a desert kingdom into a global economic power. It is the custodian of Islam's two holiest cities and the world's largest oil exporter."
  },
  "Senegal": {
    famousFor: ["Gorée Island slave trade memorial", "vibrant music scene", "teranga hospitality"],
    exports: ["gold", "fish", "phosphoric acid", "peanuts", "refined petroleum"],
    history: "Senegal was a key departure point for the Atlantic slave trade and a center of French West Africa. It gained independence in 1960 and is one of Africa's most stable democracies, with peaceful transfers of power. Dakar is a major West African cultural and economic hub."
  },
  "Serbia": {
    famousFor: ["Belgrade nightlife", "medieval monasteries", "Nikola Tesla's birthplace"],
    exports: ["vehicles", "iron and steel", "rubber", "electricity", "cereals"],
    history: "Serbia was the heart of the medieval Serbian Empire before Ottoman conquest. It played a key role in both World Wars and was the dominant republic in Yugoslavia. The breakup of Yugoslavia in the 1990s and the Kosovo conflict defined its recent history."
  },
  "Seychelles": {
    famousFor: ["pristine beaches", "coco de mer palm", "giant Aldabra tortoises"],
    exports: ["fish", "refined petroleum", "coconut products"],
    history: "The Seychelles were uninhabited until French settlement in the 18th century, later becoming a British colony. They gained independence in 1976. With only 100,000 people across 115 islands, it has the smallest population of any African sovereign state."
  },
  "Sierra Leone": {
    famousFor: ["diamond mining", "Freetown's Cotton Tree", "Bunce Island slave trade history"],
    exports: ["iron ore", "diamonds", "titanium ore", "cocoa", "coffee"],
    history: "Sierra Leone's capital Freetown was founded in 1787 as a settlement for freed slaves from Britain. British colonial rule lasted until independence in 1961. A devastating civil war fueled by 'blood diamonds' lasted from 1991 to 2002, and the country was later struck by the 2014 Ebola epidemic."
  },
  "Singapore": {
    famousFor: ["Marina Bay Sands", "street food culture", "garden city"],
    exports: ["electronics", "refined petroleum", "machinery", "chemicals", "pharmaceuticals"],
    history: "Singapore was a small fishing village before the British established a trading post in 1819. It briefly joined Malaysia after independence from Britain but separated in 1965. Under Lee Kuan Yew's leadership, it transformed from a third-world to a first-world nation in a single generation."
  },
  "Slovakia": {
    famousFor: ["Tatra Mountains", "medieval castles", "Bratislava old town"],
    exports: ["vehicles", "electronics", "machinery", "iron and steel", "rubber"],
    history: "Slovakia was part of the Kingdom of Hungary for a millennium before Czechoslovakia was created in 1918. It peacefully separated from the Czech Republic in 1993 in the 'Velvet Divorce.' It joined the EU and NATO in 2004 and the eurozone in 2009."
  },
  "Slovenia": {
    famousFor: ["Lake Bled", "Postojna Cave", "Julian Alps"],
    exports: ["vehicles", "pharmaceuticals", "machinery", "furniture", "aluminum"],
    history: "Slovenia was part of the Austro-Hungarian Empire and then Yugoslavia. It declared independence in 1991 after a brief 10-day war. It was the first former Yugoslav republic to join the EU in 2004 and the eurozone in 2007, and is one of the most developed countries in Eastern Europe."
  },
  "Solomon Islands": {
    famousFor: ["World War II battlefields", "coral reefs", "traditional canoe culture"],
    exports: ["timber", "fish", "palm oil", "cocoa", "copra"],
    history: "The Solomon Islands were the site of fierce World War II fighting, including the Battle of Guadalcanal. They were a British protectorate until independence in 1978. The country experienced ethnic conflict in the late 1990s, resolved with Australian-led peacekeeping intervention."
  },
  "Somalia": {
    famousFor: ["longest coastline in mainland Africa", "ancient port cities", "camel herding culture"],
    exports: ["livestock", "bananas", "charcoal", "fish"],
    history: "Somalia was divided between British, Italian, and French colonial spheres. It unified and gained independence in 1960. The collapse of central government in 1991 led to decades of civil war, piracy, and humanitarian crisis, though stability has been slowly returning."
  },
  "South Africa": {
    famousFor: ["Table Mountain", "Kruger National Park", "Nelson Mandela's legacy"],
    exports: ["gold", "diamonds", "platinum", "vehicles", "iron ore"],
    history: "South Africa was colonized by the Dutch and British, and its history was dominated by the apartheid system of racial segregation from 1948 to 1994. Nelson Mandela's release and the first democratic elections in 1994 marked a peaceful transition. It is Africa's most industrialized economy."
  },
  "South Korea": {
    famousFor: ["K-pop", "Samsung and tech industry", "ancient Buddhist temples"],
    exports: ["semiconductors", "vehicles", "ships", "electronics", "petrochemicals"],
    history: "Korea was divided after World War II, and the Korean War (1950-1953) devastated the peninsula. South Korea transformed from one of the world's poorest countries to an economic powerhouse in just decades, known as the 'Miracle on the Han River.' Its cultural exports now reach global audiences."
  },
  "South Sudan": {
    famousFor: ["Sudd wetland", "world's newest country", "diverse ethnic groups"],
    exports: ["crude oil", "timber", "gold"],
    history: "South Sudan gained independence from Sudan in 2011 after decades of civil war, becoming the world's newest country. A civil war erupted in 2013 between rival political factions. Despite having significant oil reserves, it remains one of the least developed nations in the world."
  },
  "Spain": {
    famousFor: ["Sagrada Familia", "flamenco", "La Tomatina festival"],
    exports: ["vehicles", "refined petroleum", "medicines", "olive oil", "citrus"],
    history: "Spain was a global superpower in the 16th-17th centuries, colonizing much of the Americas. The Spanish Civil War (1936-1939) led to Franco's dictatorship until 1975. It transitioned to democracy, joined the EU in 1986, and is now one of Europe's largest economies."
  },
  "Sri Lanka": {
    famousFor: ["Ceylon tea", "ancient Sigiriya rock fortress", "Buddhist heritage"],
    exports: ["tea", "clothing", "rubber", "coconut products", "spices"],
    history: "Sri Lanka, known historically as Ceylon, has over 2,500 years of recorded history as a center of Buddhist civilization. It gained independence from Britain in 1948. A 26-year civil war between the government and Tamil Tigers ended in 2009."
  },
  "Sudan": {
    famousFor: ["Nubian pyramids at Meroë", "confluence of the Blue and White Nile"],
    exports: ["gold", "crude oil", "livestock", "sesame seeds", "peanuts"],
    history: "Sudan was home to the ancient Kingdom of Kush and powerful Nubian civilizations. It was an Anglo-Egyptian condominium before gaining independence in 1956. Decades of civil war led to South Sudan's secession in 2011. Ongoing conflict continues to affect the nation."
  },
  "Suriname": {
    famousFor: ["Amazon rainforest covering 93% of land", "diverse ethnic mix"],
    exports: ["gold", "crude oil", "rice", "bananas", "shrimp"],
    history: "Suriname was a Dutch colony known for sugar plantations worked by enslaved Africans and later indentured laborers from Asia. It gained independence from the Netherlands in 1975. It is South America's smallest country and one of the most ethnically diverse nations in the world."
  },
  "Sweden": {
    famousFor: ["IKEA", "Northern Lights", "Nobel Prize"],
    exports: ["vehicles", "machinery", "pharmaceuticals", "iron and steel", "paper"],
    history: "Sweden was a major European power during the 17th-18th centuries. It has remained neutral in conflicts since 1814, the longest period of peace for any European nation. It built a comprehensive welfare state in the 20th century and joined NATO in 2024 after decades of non-alignment."
  },
  "Switzerland": {
    famousFor: ["Swiss Alps", "chocolate and cheese", "watchmaking"],
    exports: ["gold", "pharmaceuticals", "watches", "machinery", "chemicals"],
    history: "Switzerland was founded in 1291 as a defensive alliance of cantons and has maintained neutrality since 1515. It is not a member of the EU but sits at the heart of Europe. Its banking secrecy, direct democracy, and multilingual culture with four official languages make it unique."
  },
  "Syria": {
    famousFor: ["ancient city of Damascus (one of world's oldest)", "Palmyra ruins"],
    exports: ["crude oil", "olive oil", "fruits", "textiles", "livestock"],
    history: "Syria is home to some of the world's oldest civilizations. Damascus has been continuously inhabited for over 11,000 years. A devastating civil war beginning in 2011 caused massive displacement and destruction, creating one of the worst humanitarian crises of the 21st century."
  },
  "Tajikistan": {
    famousFor: ["Pamir Mountains (Roof of the World)", "ancient Silk Road cities"],
    exports: ["aluminum", "gold", "cotton", "zinc", "electricity"],
    history: "Tajikistan was part of the Silk Road and was influenced by Persian, Turkic, and Mongol civilizations. It was incorporated into the Soviet Union and gained independence in 1991, followed by a devastating civil war. It is the poorest of the former Soviet states."
  },
  "Tanzania": {
    famousFor: ["Mount Kilimanjaro", "Serengeti migration", "Zanzibar spice island"],
    exports: ["gold", "coffee", "cashew nuts", "tobacco", "gemstones"],
    history: "Tanzania is home to Olduvai Gorge, one of the most important paleoanthropological sites on Earth. It was a German and then British colony before gaining independence in 1961. Tanganyika merged with Zanzibar in 1964 to form Tanzania under Julius Nyerere's leadership."
  },
  "Thailand": {
    famousFor: ["ornate Buddhist temples", "Thai cuisine", "tropical islands"],
    exports: ["electronics", "vehicles", "rubber", "rice", "jewelry"],
    history: "Thailand is the only Southeast Asian country never colonized by a European power. The Kingdom of Siam was renamed Thailand in 1939, meaning 'Land of the Free.' A constitutional monarchy since 1932, it has experienced multiple military coups but remains a major regional economy."
  },
  "Timor-Leste": {
    famousFor: ["Cristo Rei statue", "coral reefs", "coffee growing highlands"],
    exports: ["crude oil", "natural gas", "coffee"],
    history: "Timor-Leste was a Portuguese colony for over 400 years before Indonesia invaded in 1975. A brutal occupation killed an estimated 100,000 people. A UN-supervised referendum in 1999 led to independence in 2002, making it one of the youngest nations in the world."
  },
  "Togo": {
    famousFor: ["Koutammakou UNESCO landscape", "voodoo festivals", "Togoville"],
    exports: ["gold", "refined petroleum", "phosphates", "cotton", "cocoa"],
    history: "Togo was a German colony known as Togoland before being divided between France and Britain after World War I. The French portion gained independence in 1960. One family dominated politics for over 50 years, and the country has a unique blend of traditional and modern cultures."
  },
  "Tonga": {
    famousFor: ["only Pacific monarchy", "whale watching", "blowholes of Houma"],
    exports: ["squash", "fish", "vanilla", "root crops"],
    history: "Tonga is the only Pacific island nation that was never formally colonized. Its monarchy dates back over 1,000 years. It became a British protectorate but maintained self-governance until full independence in 1970. Rugby and Christianity are central to Tongan culture."
  },
  "Trinidad and Tobago": {
    famousFor: ["Carnival", "steelpan music (invented here)", "Pitch Lake"],
    exports: ["petroleum", "natural gas", "ammonia", "methanol", "chemicals"],
    history: "Trinidad was colonized by Spain and then Britain, while Tobago changed hands multiple times among European powers. The islands gained independence in 1962. The invention of the steelpan drum and the vibrant Carnival celebration are major cultural contributions to the world."
  },
  "Tunisia": {
    famousFor: ["Carthage ruins", "Star Wars filming locations", "Mediterranean beaches"],
    exports: ["refined petroleum", "olive oil", "phosphates", "textiles", "dates"],
    history: "Tunisia was the center of ancient Carthage and later a key part of the Roman Empire. It was a French protectorate from 1881 to 1956. The 2010-2011 Jasmine Revolution sparked the Arab Spring and led to the only successful democratic transition in the region, though challenges remain."
  },
  "Turkey": {
    famousFor: ["Hagia Sophia", "Cappadocia", "ancient Troy"],
    exports: ["vehicles", "machinery", "textiles", "iron and steel", "electronics"],
    history: "Turkey bridges Europe and Asia and was the center of the Ottoman Empire for over 600 years. Mustafa Kemal Atatürk founded the secular republic in 1923 from the empire's remains. It is a NATO member and a major regional power with a dynamic, growing economy."
  },
  "Turkmenistan": {
    famousFor: ["Darvaza Gas Crater (Door to Hell)", "Akhal-Teke horses", "white marble capital"],
    exports: ["natural gas", "crude oil", "petrochemicals", "textiles", "cotton"],
    history: "Turkmenistan was part of ancient Persian empires and the Silk Road. It was incorporated into the Russian Empire and Soviet Union. Since independence in 1991, it has been ruled by authoritarian leaders and sits on one of the world's largest natural gas reserves."
  },
  "Tuvalu": {
    famousFor: ["one of world's smallest and least-visited countries", ".tv internet domain"],
    exports: ["fish", "coconut products"],
    history: "Tuvalu is a Polynesian island nation of nine tiny coral atolls in the Pacific. It was a British colony as part of the Gilbert and Ellice Islands before independence in 1978. With a highest point of just 4.6 meters, it is one of the countries most threatened by rising sea levels."
  },
  "Uganda": {
    famousFor: ["mountain gorillas in Bwindi", "source of the Nile", "diverse birdlife"],
    exports: ["coffee", "gold", "fish", "tea", "tobacco"],
    history: "Uganda was home to powerful kingdoms including Buganda before British colonization. It gained independence in 1962 and endured the brutal dictatorship of Idi Amin in the 1970s. Winston Churchill called it 'the pearl of Africa' for its natural beauty."
  },
  "Ukraine": {
    famousFor: ["Kyiv's golden-domed churches", "breadbasket of Europe", "Chernobyl site"],
    exports: ["corn", "sunflower oil", "iron ore", "wheat", "steel"],
    history: "Ukraine was the center of the medieval Kyivan Rus' state and later controlled by Lithuania, Poland, and Russia. It gained independence from the Soviet Union in 1991. Russia's annexation of Crimea in 2014 and full-scale invasion in 2022 have profoundly shaped its modern identity."
  },
  "United Arab Emirates": {
    famousFor: ["Burj Khalifa (world's tallest building)", "luxury shopping", "desert safaris"],
    exports: ["crude oil", "refined petroleum", "gold", "aluminum", "diamonds"],
    history: "The UAE was formed in 1971 when seven emirates unified after British withdrawal. Oil wealth transformed it from a collection of fishing and trading ports into a global hub for commerce, tourism, and aviation. Dubai and Abu Dhabi are its most prominent emirates."
  },
  "United Kingdom": {
    famousFor: ["Big Ben and Buckingham Palace", "Shakespeare", "The Beatles"],
    exports: ["vehicles", "machinery", "pharmaceuticals", "gold", "crude oil"],
    history: "The United Kingdom was forged from the union of England, Scotland, Wales, and Northern Ireland. The British Empire was the largest in history, spanning a quarter of the world's land. It was a pioneer of the Industrial Revolution and parliamentary democracy."
  },
  "United States": {
    famousFor: ["Statue of Liberty", "Grand Canyon", "Hollywood"],
    exports: ["refined petroleum", "aircraft", "vehicles", "machinery", "electronics"],
    history: "The United States declared independence from Britain in 1776 and expanded westward across the continent. A civil war over slavery was fought from 1861 to 1865. It emerged as the world's dominant superpower after World War II and remains the largest economy globally."
  },
  "Uruguay": {
    famousFor: ["progressive social policies", "gaucho culture", "Punta del Este beaches"],
    exports: ["beef", "soybeans", "cellulose", "rice", "dairy"],
    history: "Uruguay gained independence from Brazil in 1828 and became one of Latin America's first welfare states in the early 20th century. It suffered a military dictatorship from 1973 to 1985 but has since become one of the continent's most stable and progressive democracies."
  },
  "Uzbekistan": {
    famousFor: ["Samarkand's Registan Square", "Silk Road heritage", "Islamic architecture"],
    exports: ["gold", "cotton", "natural gas", "uranium", "textiles"],
    history: "Uzbekistan was the heart of the ancient Silk Road, with Samarkand and Bukhara among the world's great trading cities. Timur (Tamerlane) built a vast empire from here in the 14th century. After Soviet rule, it gained independence in 1991 and is Central Asia's most populous country."
  },
  "Vanuatu": {
    famousFor: ["active volcanoes", "land diving (origin of bungee jumping)", "diverse Melanesian culture"],
    exports: ["copra", "beef", "cocoa", "timber", "kava"],
    history: "Vanuatu was jointly administered by Britain and France as the New Hebrides, one of the few condominiums in colonial history. It gained independence in 1980. It is one of the most linguistically diverse countries per capita, with over 100 indigenous languages."
  },
  "Vatican City": {
    famousFor: ["St. Peter's Basilica", "Sistine Chapel", "center of the Catholic Church"],
    exports: ["postage stamps", "publications", "souvenirs"],
    history: "Vatican City is the world's smallest independent state, established by the 1929 Lateran Treaty with Italy. It is the spiritual and administrative center of the Roman Catholic Church, led by the Pope. Its museums and the Sistine Chapel attract millions of visitors annually."
  },
  "Venezuela": {
    famousFor: ["Angel Falls (world's highest waterfall)", "oil reserves", "tepui table-top mountains"],
    exports: ["crude oil", "refined petroleum", "gold", "iron ore"],
    history: "Venezuela was colonized by Spain and liberated by Simón Bolívar in 1821. It became one of the world's wealthiest nations due to oil, but economic mismanagement and political crisis under Chávez and Maduro have caused hyperinflation and mass emigration."
  },
  "Vietnam": {
    famousFor: ["Ha Long Bay", "phở cuisine", "Cu Chi tunnels"],
    exports: ["electronics", "footwear", "textiles", "seafood", "coffee"],
    history: "Vietnam has a thousand-year history of resisting foreign domination, including Chinese, French, and American intervention. The Vietnam War ended in 1975 with reunification. Economic reforms since 1986 (Đổi Mới) have transformed it into one of Asia's fastest-growing economies."
  },
  "Yemen": {
    famousFor: ["Socotra Island biodiversity", "Old Sana'a architecture", "ancient incense trade"],
    exports: ["crude oil", "gold", "fish", "coffee"],
    history: "Yemen was home to the ancient Kingdom of Sheba and a center of the frankincense and myrrh trade. North and South Yemen unified in 1990. A civil war beginning in 2014 has created one of the world's worst humanitarian crises."
  },
  "Zambia": {
    famousFor: ["Victoria Falls", "South Luangwa National Park", "copper mining"],
    exports: ["copper", "gold", "gemstones", "tobacco", "sugar"],
    history: "Zambia was the British protectorate of Northern Rhodesia before gaining independence in 1964 under Kenneth Kaunda. Its economy has long depended on copper mining in the Copperbelt region. It is one of Africa's most urbanized countries and a stable multiparty democracy."
  },
  "Zimbabwe": {
    famousFor: ["Victoria Falls", "Great Zimbabwe ruins", "diverse wildlife"],
    exports: ["gold", "tobacco", "diamonds", "ferroalloys", "nickel"],
    history: "Zimbabwe takes its name from the Great Zimbabwe stone ruins, a medieval trading center. It was the British colony of Rhodesia until Robert Mugabe led it to independence in 1980. Hyperinflation and political crisis in the 2000s devastated the economy, which is slowly recovering."
  }
};

// Read, update, write
const filePath = path.join(__dirname, 'data', 'countries.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

let updated = 0;
for (const entry of data) {
  if (!entry.un) continue;
  const facts = FACTS[entry.country];
  if (facts) {
    entry.famousFor = facts.famousFor;
    entry.exports = facts.exports;
    entry.history = facts.history;
    updated++;
  } else {
    console.warn(`⚠ No facts for: ${entry.country}`);
  }
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log(`✅ Updated ${updated} of 194 UN countries.`);
