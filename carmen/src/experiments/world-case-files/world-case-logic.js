import { LOCATIONS } from '../../content/locations.js';

const REQUIRED_PROOF_CARDS = 3;

function normalize(value) {
  return String(value || '').trim().toLowerCase();
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

function countryMatchesTag(countryData, tag) {
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
    ].map(normalize).join(' ');
    return haystack.includes(valueLower);
  }

  // Direction and atmospheric tags are treated as narrative-only until a
  // curated matcher is added for the experiment.
  return false;
}

function evidenceMatch(countryData, evidence) {
  const tags = evidence?.tags || [];
  if (!tags.length) return { matches: 0, contradictions: 0 };
  let matches = 0;
  let contradictions = 0;
  for (const tag of tags) {
    if (tag.startsWith('exclude:')) {
      if (countryMatchesTag(countryData, tag)) contradictions++;
      continue;
    }
    if (countryMatchesTag(countryData, tag)) matches++;
  }
  return { matches, contradictions };
}

export class WorldCaseFilesLogic {
  constructor({ caseData, countries }) {
    this.caseData = caseData;
    this.countries = countries || [];
    this.countryMap = Object.fromEntries(this.countries.map(country => [country.country, country]));
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
    return {
      leg: this.currentLeg,
      totalLegs: this.totalLegs,
      city: this.currentRouteStop.city,
      country: this.currentCountry,
      targetCity: this.targetRouteStop?.city || '',
      targetCountry: this.targetRouteStop?.country || '',
      evidenceCount: this.evidence.length,
    };
  }

  getLocations() {
    return LOCATIONS.map(location => ({
      id: location.id,
      emoji: location.emoji,
      name: location.name,
    }));
  }

  getInvestigatedLocationIds() {
    return new Set(this.investigatedByScene.get(this._sceneKey()) || []);
  }

  getInformant(locationId) {
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
      foundInCity: this.getSceneForCountry(this.currentCountry)?.city || this.currentCountry,
      category: clue.tags?.some(tag => tag.startsWith('culture:') || tag.startsWith('famous:') || tag.startsWith('history:'))
        ? 'Cultural Evidence'
        : clue.tags?.some(tag => tag.startsWith('country:') || tag.startsWith('city:') || tag === 'confirmation')
          ? 'Confirmation'
          : 'Route Evidence',
    };
    this.evidence.push(evidence);
    return evidence;
  }

  getSceneForCountry(country) {
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
      for (const evidence of activeEvidence) {
        const result = evidenceMatch(countryData, evidence);
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
      };
    });
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
      evidence: [...this.evidence],
      deadEnds: [...this.deadEnds],
      route: this.caseData.route,
    };
  }
}
