// data.js — loads unified country data from countries.json
// Exposes window.ALL_COUNTRIES (all entries) and window.DATA (UN members only)
const all = await fetch('data/countries.json').then(r => r.json());
window.ALL_COUNTRIES = all;
window.DATA = all.filter(c => c.un);
