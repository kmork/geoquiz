import { LOCATIONS } from '../../content/locations.js';

const REQUIRED_PROOF_CARDS = 3;

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function approxSamePoint(aLat, aLon, bLat, bLon) {
  if (![aLat, aLon, bLat, bLon].every(Number.isFinite)) return false;
  return Math.abs(aLat - bLat) <= 0.003 && Math.abs(aLon - bLon) <= 0.003;
}

function primaryCapital(countryData) {
  return countryData?.capitals?.[0] || '';
}

function countryHasCity(countryData, city) {
  const wanted = normalize(city);
  if (!wanted) return false;
  if (normalize(primaryCapital(countryData)) === wanted) return true;
  return (countryData?.cities || []).some(item => normalize(item.name) === wanted);
}

function countryMatchesTag(countryData, tag, culturalCountry = null) {
  if (!countryData || !tag) return false;
  const [kind, rawValue = ''] = tag.split(':');
  const value = rawValue.trim();
  const valueLower = normalize(value);
  if (!kind || !value) return false;

  if (kind === 'country') return countryData.country === value;
  if (kind === 'exclude') return countryData.country === value;
  if (kind === 'continent') return countryData.continent === value;
  if (kind === 'climate') return normalize(countryData.climate).includes(valueLower);
  if (kind === 'capital') return normalize(primaryCapital(countryData)).startsWith(valueLower);
  if (kind === 'city') return countryHasCity(countryData, value);
  if (kind === 'famous') {
    return (countryData.famousFor || []).some(item => normalize(item).includes(valueLower));
  }
  if (kind === 'export') {
    return (countryData.exports || []).some(item => normalize(item).includes(valueLower));
  }
  if (kind === 'history') {
    return normalize(countryData.history).includes(valueLower);
  }
  if (kind === 'culture') {
    const haystack = [
      countryData.history,
      ...(countryData.famousFor || []),
      countryData.climate,
      ...(culturalCountry?.culturalTags || []),
    ].map(normalize).join(' ');
    return haystack.includes(valueLower);
  }
  if (kind === 'cultural_place') {
    return (culturalCountry?.culturalPlaces || []).some(place => normalize(place.name).includes(valueLower));
  }
  if (kind === 'cultural_role') {
    return (culturalCountry?.culturalPlaces || []).some(place => normalize(place.role) === valueLower);
  }
  if (kind === 'cultural_object') {
    return (culturalCountry?.culturalObjects || []).some(object => normalize(object.title).includes(valueLower));
  }

  // Direction and atmospheric tags are treated as narrative-only until a
  // curated matcher is added for the experiment.
  return false;
}

function evidenceMatch(countryData, evidence, culturalCountry = null) {
  const tags = evidence?.tags || [];
  if (!tags.length) return { matches: 0, contradictions: 0 };
  let matches = 0;
  let contradictions = 0;
  for (const tag of tags) {
    if (tag.startsWith('exclude:')) {
      if (countryMatchesTag(countryData, tag, culturalCountry)) contradictions++;
      continue;
    }
    if (countryMatchesTag(countryData, tag, culturalCountry)) matches++;
  }
  return { matches, contradictions };
}

function humanizeTagValue(value = '') {
  return String(value || '')
    .trim()
    .replace(/[_-]+/g, ' ');
}

function atlasHintFromTag(tag, evidence) {
  if (!tag || tag.startsWith('exclude:') || tag === 'confirmation') return '';
  const [kind, rawValue = ''] = String(tag).split(':');
  const value = humanizeTagValue(rawValue);
  if (kind === 'export') return `Export clue points toward countries known for ${value}.`;
  if (kind === 'continent') return `Geography clue narrows the lead toward ${value}.`;
  if (kind === 'capital') return `Capital clue points toward countries whose capital starts like "${value}".`;
  if (kind === 'city') return `City clue narrows the trail toward countries tied to ${value}.`;
  if (kind === 'history') return `History clue points toward countries tied to ${value}.`;
  if (kind === 'culture') return `Culture clue fits countries associated with ${value}.`;
  if (kind === 'famous') return `Reference clue points toward countries known for ${value}.`;
  if (kind === 'climate') return `Climate clue narrows the field toward ${value} regions.`;
  if (kind === 'cultural_place') return `Site clue points toward countries linked to ${value}.`;
  if (kind === 'cultural_role') return `Archive clue favors countries with a ${value} role in the object's story.`;
  if (kind === 'cultural_object') return `Object clue points toward countries connected to ${value}.`;
  if (kind === 'country') return `One clue directly names ${value}.`;
  if (evidence?.category === 'Confirmation') return 'Confirmation clue strengthens one destination enough to move.';
  return '';
}

export class WorldCaseFilesLogic {
  constructor({ caseData, countries, culturalPlaces = [], culturalObjects = [], candidateIndex = null }) {
    this.caseData = caseData;
    this.countries = countries || [];
    this.countryMap = Object.fromEntries(this.countries.map(country => [country.country, country]));
    this.culturalPlaces = (culturalPlaces || []).filter(place => place.caseId === caseData.id);
    this.culturalObjects = (culturalObjects || []).filter(object => object.id === caseData.id);
    this.candidateIndex = candidateIndex?.countries || {};
    this.currentLeg = 0;
    this.currentCountry = caseData.start.country;
    this.visited = [caseData.start.country];
    this.evidence = [];
    this.investigatedByScene = new Map();
    this.deadEnds = [];
    this.finalSolved = false;
  }

  get mode() { return 'world_case_files'; }
  get totalLegs() { return this.caseData.legs.length; }
  get currentRouteStop() { return this.caseData.route[this.currentLeg] || this.caseData.start; }
  get targetRouteStop() { return this.caseData.route[this.currentLeg + 1] || null; }
  get currentLegData() { return this.caseData.legs[this.currentLeg] || null; }
  get artifact() { return this.caseData.artifact; }

  start() {
    return {
      artifact: this.artifact,
      startCountry: this.caseData.start.country,
      startCity: this.caseData.start.city,
      caseTitle: this.caseData.title,
      progress: this.getProgress(),
    };
  }

  getProgress() {
    const currentStop = this.currentRouteStop;
    const targetStop = this.targetRouteStop;
    return {
      leg: this.currentLeg,
      totalLegs: this.totalLegs,
      city: currentStop.city,
      country: this.currentCountry,
      scene: currentStop.scene || '',
      biographyStage: currentStop.biographyStage || '',
      learningGoal: currentStop.learningGoal || '',
      thiefClaim: currentStop.thiefClaim || '',
      truthComplication: currentStop.truthComplication || '',
      targetCity: targetStop?.city || '',
      targetCountry: targetStop?.country || '',
      targetBiographyStage: targetStop?.biographyStage || '',
      evidenceCount: this.evidence.length,
    };
  }

  hasMultipleStopsInCountry(country) {
    const wanted = normalize(country);
    return this.caseData.route.filter(stop => normalize(stop.country) === wanted).length > 1;
  }

  getTravelLabel(country) {
    const targetStop = this.targetRouteStop;
    if (targetStop?.country === country) {
      const sceneBits = [targetStop.city, targetStop.country].filter(Boolean);
      return {
        primary: sceneBits.join(', ') || country,
        secondary: this.hasMultipleStopsInCountry(country)
          ? `Return to ${country} for the ${targetStop.scene || targetStop.biographyStage || 'next scene'}.`
          : (targetStop.scene || ''),
      };
    }
    const scene = this.getSceneForCountry(country);
    const sceneBits = [scene.city, scene.country].filter(Boolean);
    return {
      primary: sceneBits.join(', ') || country,
      secondary: scene.scene || '',
    };
  }

  getLocations() {
    const currentStop = this.currentRouteStop || {};
    const baseLocations = LOCATIONS.map(location => ({
      id: location.id,
      emoji: location.emoji,
      name: location.name,
    }));
    return [
      ...baseLocations,
      ...this.getSceneCulturalPlaces().map(place => ({
        id: this._culturalLocationId(place.id),
        emoji: this._culturalPlaceEmoji(place.role),
        name: place.name,
        type: 'cultural-place',
        role: place.role,
        placeId: place.id,
        lat: place.lat,
        lon: place.lon,
        placeName: place.name,
        description: place.description,
        hideOnMap: approxSamePoint(place.lat, place.lon, currentStop.lat, currentStop.lon) ||
          normalize(place.name).includes(normalize(currentStop.scene)) ||
          normalize(currentStop.scene).includes(normalize(place.name)),
      })),
    ];
  }

  getInvestigatedLocationIds() {
    return new Set(this.investigatedByScene.get(this._sceneKey()) || []);
  }

  getInformant(locationId) {
    if (this._isCulturalLocationId(locationId)) {
      const place = this.getCulturalPlaceByLocationId(locationId);
      return {
        emoji: this._culturalPlaceEmoji(place?.role),
        prefix: `${place?.name || 'Cultural archive'} records show`,
      };
    }
    const location = LOCATIONS.find(item => item.id === locationId);
    const informant = location?.informants?.[0];
    return informant || { emoji: location?.emoji || '🔎', prefix: location?.name || 'Field office' };
  }

  _sceneKey(country = this.currentCountry, leg = this.currentLeg) {
    return `${leg}:${country}`;
  }

  investigate(locationId) {
    const leg = this.currentLegData;
    if (!leg) return null;
    const key = this._sceneKey();
    const investigated = this.investigatedByScene.get(key) || new Set();
    if (investigated.has(locationId)) return null;
    investigated.add(locationId);
    this.investigatedByScene.set(key, investigated);

    let clue = leg.clues.find(item => item.locationId === locationId && !this.evidence.some(e => e.id === item.id));
    if (!clue && this.currentCountry !== leg.from) {
      clue = leg.followups?.find(item =>
        item.afterCountry === this.currentCountry &&
        item.locationId === locationId &&
        !this.evidence.some(e => e.id === `${leg.from}-${item.locationId}-followup`)
      );
      if (clue) {
        clue = {
          ...clue,
          id: `${leg.from}-${clue.locationId}-followup`,
          title: 'Follow-up confirmation',
          action: 'Ask follow-up question',
          strength: 3,
        };
      }
    }
    if (!clue) return null;
    const evidence = {
      ...clue,
      legIndex: this.currentLeg,
      fromCountry: leg.from,
      targetCountry: leg.to,
      foundInCountry: this.currentCountry,
      foundInCity: this.currentRouteStop?.city || this.currentCountry,
      category: clue.category || (
        clue.tags?.some(tag => tag.startsWith('culture:') || tag.startsWith('famous:') || tag.startsWith('history:') || tag.startsWith('cultural_'))
          ? 'Cultural Evidence'
          : clue.tags?.some(tag => tag.startsWith('country:') || tag.startsWith('city:') || tag === 'confirmation')
            ? 'Confirmation'
            : 'Route Evidence'
      ),
    };
    this.evidence.push(evidence);
    return evidence;
  }

  _isCulturalLocationId(locationId) {
    return String(locationId || '').startsWith('cultural:');
  }

  _culturalLocationId(placeId) {
    return `cultural:${placeId}`;
  }

  _culturalPlaceEmoji(role = '') {
    if (role.includes('archive') || role.includes('record')) return '📜';
    if (role.includes('site')) return '🏺';
    if (role.includes('proof')) return '🧾';
    return '🏛️';
  }

  getCulturalPlaceByLocationId(locationId) {
    const placeId = String(locationId || '').replace(/^cultural:/, '');
    return this.culturalPlaces.find(place => place.id === placeId) || null;
  }

  getSceneCulturalPlaces(country = this.currentCountry) {
    const scene = this.getSceneForCountry(country);
    const sceneCity = normalize(scene?.city);
    return this.culturalPlaces.filter(place => {
      if (place.country !== country) return false;
      if (!sceneCity) return true;
      return normalize(place.city) === sceneCity;
    });
  }

  getSceneForCountry(country) {
    if (normalize(this.currentRouteStop?.country) === normalize(country)) {
      return this.currentRouteStop;
    }
    if (normalize(this.targetRouteStop?.country) === normalize(country)) {
      return this.targetRouteStop;
    }
    return this.caseData.route.find(stop => stop.country === country) || {
      country,
      city: primaryCapital(this.countryMap[country]) || country,
      scene: 'ACME field office',
    };
  }

  analyzeCandidates() {
    const activeEvidence = this.evidence.filter(item => item.legIndex === this.currentLeg);
    const targetCountry = this.targetRouteStop?.country;
    return this.countries.map(countryData => {
      let matches = 0;
      let contradictions = 0;
      let strength = 0;
      const matchedEvidence = [];
      const contradictedEvidence = [];
      const culturalCountry = this.candidateIndex[countryData.country] || null;
      for (const evidence of activeEvidence) {
        const result = evidenceMatch(countryData, evidence, culturalCountry);
        if (result.matches > 0) {
          matches += result.matches;
          strength += evidence.strength || 1;
          matchedEvidence.push(evidence);
        }
        if (result.contradictions > 0) {
          contradictions += result.contradictions;
          contradictedEvidence.push(evidence);
        }
      }
      let state = 'unknown';
      if (contradictions > 0) state = 'contradicted';
      else if (countryData.country === this.currentCountry) state = 'current';
      else if (matches >= 4 || strength >= 7) state = 'strong';
      else if (matches >= 2 || strength >= 4) state = 'pattern';
      else if (matches > 0) state = 'partial';
      return {
        country: countryData.country,
        capital: primaryCapital(countryData),
        state,
        matches,
        contradictions,
        strength,
        correct: countryData.country === targetCountry,
        matchedEvidence,
        contradictedEvidence,
        travelLabel: this.getTravelLabel(countryData.country),
        hintSummary: this.getCandidateHintSummary({
          country: countryData.country,
          state,
          matchedEvidence,
          contradictedEvidence,
        }),
      };
    });
  }

  getCandidateHintSummary(candidate) {
    if (!candidate) return '';
    if (candidate.country === this.currentCountry) return 'Current scene. Gather more evidence before moving the case onward.';
    if (candidate.state === 'contradicted') return 'Collected evidence contradicts this destination.';
    const matched = candidate.matchedEvidence || [];
    if (matched.length) {
      const evidence = matched[0];
      const tagHint = (evidence.tags || []).map(tag => atlasHintFromTag(tag, evidence)).find(Boolean);
      if (tagHint) return tagHint;
      return evidence.title || evidence.text || 'Some collected evidence points here.';
    }
    if (candidate.state === 'unknown') return 'No collected evidence points here yet.';
    return 'This destination partly fits the current evidence.';
  }

  getCandidateSummary() {
    const candidates = this.analyzeCandidates();
    return {
      total: candidates.length,
      partial: candidates.filter(c => c.state === 'partial').length,
      pattern: candidates.filter(c => c.state === 'pattern').length,
      strong: candidates.filter(c => c.state === 'strong').length,
      contradicted: candidates.filter(c => c.state === 'contradicted').length,
    };
  }

  getConfidence() {
    const activeEvidence = this.evidence.filter(item => item.legIndex === this.currentLeg);
    const hasRoute = activeEvidence.some(item => item.category === 'Route Evidence');
    const hasCulture = activeEvidence.some(item => item.category === 'Cultural Evidence');
    const hasConfirmation = activeEvidence.some(item => item.category === 'Confirmation');
    const strongCandidateCount = this.analyzeCandidates().filter(item => item.state === 'strong').length;
    return {
      leadFound: activeEvidence.length > 0,
      patternSupported: hasCulture,
      contradictionsChecked: activeEvidence.some(item => (item.tags || []).some(tag => tag.startsWith('exclude:'))),
      destinationLikely: strongCandidateCount <= 3 && activeEvidence.length >= 3,
      evidenceReady: hasRoute && hasCulture && hasConfirmation && activeEvidence.length >= REQUIRED_PROOF_CARDS,
    };
  }

  canSubmitProof(country) {
    const confidence = this.getConfidence();
    return country === this.targetRouteStop?.country && confidence.evidenceReady;
  }

  travelTo(country) {
    const target = this.targetRouteStop;
    if (!target) return { type: 'complete' };
    const from = this.currentCountry;
    const wasVisited = this.visited.includes(country);
    this.currentCountry = country;
    if (!wasVisited) this.visited.push(country);
    if (country !== target.country && wasVisited && this.caseData.route.findIndex(stop => stop.country === country) <= this.currentLeg) {
      return {
        type: 'revisited',
        from,
        country,
        explanation: 'ACME reopens the earlier scene. New evidence may unlock if the latest lead gives you a better question to ask.',
      };
    }
    if (country !== target.country) {
      const explanation = this.caseData.deadEnds?.[country] || this.caseData.deadEnds?.default || 'The field office found no match for the evidence.';
      this.deadEnds.push({ legIndex: this.currentLeg, country, explanation });
      return { type: 'dead_end', from, country, explanation };
    }
    if (!this.canSubmitProof(country)) {
      return {
        type: 'arrived_unproven',
        from,
        country,
        explanation: 'The destination fits, but ACME will not advance the case until route, cultural, and confirmation evidence are all on the board.',
      };
    }
    this.currentLeg++;
    this.currentCountry = country;
    const solved = this.currentLeg >= this.totalLegs;
    if (solved) this.finalSolved = true;
    return {
      type: solved ? 'case_ready' : 'advanced',
      from,
      country,
      next: this.targetRouteStop,
      scene: this.currentRouteStop,
    };
  }

  getProofCards() {
    return this.evidence
      .filter(item => item.legIndex === this.currentLeg)
      .slice(-5);
  }

  getBoardState() {
    return {
      caseTitle: this.caseData.title,
      pattern: this.caseData.pattern,
      current: this.getProgress(),
      confidence: this.getConfidence(),
      summary: this.getCandidateSummary(),
      atlasHints: this.getAtlasHints(),
      evidence: [...this.evidence],
      deadEnds: [...this.deadEnds],
      route: this.caseData.route,
      culturalPlaces: this.culturalPlaces,
      culturalObjects: this.culturalObjects,
    };
  }

  getAtlasHints() {
    const activeEvidence = this.evidence.filter(item => item.legIndex === this.currentLeg);
    const seen = new Set();
    const hints = [];
    for (const evidence of activeEvidence) {
      const tagHint = (evidence.tags || []).map(tag => atlasHintFromTag(tag, evidence)).find(Boolean);
      const text = tagHint || evidence.title || evidence.text || '';
      if (!text) continue;
      const normalizedText = normalize(text);
      if (seen.has(normalizedText)) continue;
      seen.add(normalizedText);
      hints.push({
        id: evidence.id,
        text,
        category: evidence.category || 'Evidence',
        strength: evidence.strength || 1,
      });
    }
    return hints.sort((a, b) => (b.strength - a.strength) || a.text.localeCompare(b.text));
  }
}
