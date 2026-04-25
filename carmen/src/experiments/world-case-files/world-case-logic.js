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

function sceneSlug(scene = {}, fallback = 'scene') {
  return normalize(scene.id || scene.scene || scene.city || fallback).replace(/[^a-z0-9]+/g, '-') || fallback;
}

export class WorldCaseFilesLogic {
  constructor({ caseData, countries, culturalPlaces = [], culturalObjects = [], candidateIndex = null }) {
    this.caseData = caseData;
    this.countries = countries || [];
    this.countryMap = Object.fromEntries(this.countries.map(country => [country.country, country]));
    this.workMap = Object.fromEntries((caseData.works || []).map(work => [normalize(work.title), work]));
    this.culturalPlaces = (culturalPlaces || []).filter(place => place.caseId === caseData.id);
    this.culturalObjects = (culturalObjects || []).filter(object => object.id === caseData.id);
    this.candidateIndex = candidateIndex?.countries || {};
    this.currentLeg = 0;
    this.currentSceneIndex = 0;
    this.currentCountry = caseData.start.country;
    this.visited = [caseData.start.country];
    this.evidence = [];
    this.investigatedByScene = new Map();
    this.deadEnds = [];
    this.finalSolved = false;
    this.completedSceneKeys = [];
  }

  get mode() { return 'world_case_files'; }
  get totalLegs() { return Math.max(0, this.caseData.route.length - 1); }
  get currentRouteStop() { return this.caseData.route[this.currentLeg] || this.caseData.start; }
  get targetRouteStop() { return this.caseData.route[this.currentLeg + 1] || null; }
  get currentLegData() { return this.caseData.legs?.[this.currentLeg] || null; }
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
    const currentScene = this.getCurrentScene();
    return {
      leg: this.currentLeg,
      totalLegs: this.totalLegs,
      city: currentScene.city || currentStop.city || this.currentCountry,
      country: this.currentCountry,
      scene: currentScene.scene || currentStop.scene || '',
      biographyStage: currentScene.biographyStage || currentStop.biographyStage || '',
      learningGoal: currentScene.learningGoal || currentStop.learningGoal || '',
      thiefClaim: currentScene.thiefClaim || currentStop.thiefClaim || '',
      truthComplication: currentScene.truthComplication || currentStop.truthComplication || '',
      targetCity: targetStop?.city || '',
      targetCountry: targetStop?.country || '',
      targetBiographyStage: targetStop?.biographyStage || '',
      evidenceCount: this.evidence.length,
      chapterTitle: currentStop.chapterTitle || currentStop.scene || currentStop.city || '',
      chapterSummary: currentStop.chapterSummary || '',
      sceneTitle: currentScene.title || currentScene.scene || currentScene.city || '',
      sceneIndex: this.currentSceneIndex,
      sceneCount: this.getSceneList(currentStop).length,
      activeWorks: currentScene.focusWorks || [],
      threatenedWorks: currentScene.threatenedWorks || [],
      stolenWorks: currentScene.stolenWorks || [],
      escalationText: currentScene.escalationText || currentStop.escalationText || '',
      chapterReady: this.isCurrentSceneReady() && !this.getNextScene(),
    };
  }

  getSceneList(stop = this.currentRouteStop) {
    if (Array.isArray(stop?.localScenes) && stop.localScenes.length) {
      return stop.localScenes.map((scene, index) => ({
        ...scene,
        id: scene.id || `${sceneSlug(stop, 'chapter')}-scene-${index + 1}`,
      }));
    }
    const legacyLeg = stop === this.currentRouteStop ? this.currentLegData : null;
    return [{
      id: `${sceneSlug(stop, 'scene')}-legacy`,
      city: stop?.city,
      country: stop?.country,
      scene: stop?.scene,
      lat: stop?.lat,
      lon: stop?.lon,
      biographyStage: stop?.biographyStage,
      learningGoal: stop?.learningGoal,
      thiefClaim: stop?.thiefClaim,
      truthComplication: stop?.truthComplication,
      investigationPrompt: stop?.investigationPrompt,
      clues: legacyLeg?.clues || [],
      followups: legacyLeg?.followups || [],
      customLocations: [],
      pois: null,
      evidenceImages: stop?.evidenceImages || [],
      focusWorks: stop?.focusWorks || [],
      threatenedWorks: stop?.threatenedWorks || [],
      stolenWorks: stop?.stolenWorks || [],
      title: stop?.scene || stop?.city || stop?.country,
      requirePuzzle: false,
    }];
  }

  getCurrentScene() {
    const scenes = this.getSceneList();
    return scenes[this.currentSceneIndex] || scenes[0] || {};
  }

  getNextScene() {
    const scenes = this.getSceneList();
    return scenes[this.currentSceneIndex + 1] || null;
  }

  getCurrentSceneKey() {
    const scene = this.getCurrentScene();
    return `${this.currentLeg}:${scene.id || sceneSlug(scene, 'scene')}`;
  }

  getCurrentWorks(scene = this.getCurrentScene()) {
    const focusWorks = scene?.focusWorks || [];
    return focusWorks.map(title => this.workMap[normalize(title)] || {
      title,
      artist: '',
      institution: '',
      city: scene?.city || '',
      country: scene?.country || '',
      description: '',
      imagePath: '',
      imageReady: false,
      evidenceImages: [],
    });
  }

  getCurrentPrimaryWork(scene = this.getCurrentScene()) {
    return this.getCurrentWorks(scene)[0] || null;
  }

  getCurrentArtifactPanel() {
    const currentScene = this.getCurrentScene();
    const works = this.getCurrentWorks(currentScene);
    const primaryWork = works[0] || null;
    return {
      caseTitle: this.caseData.title,
      chapterTitle: this.currentRouteStop.chapterTitle || this.currentRouteStop.scene || '',
      sceneTitle: currentScene.title || currentScene.scene || currentScene.city || '',
      currentObjective: currentScene.investigationPrompt || currentScene.learningGoal || this.currentRouteStop.learningGoal || '',
      summary: currentScene.escalationText || this.currentRouteStop.chapterSummary || this.caseData.artifact?.hint || '',
      primaryWork,
      works,
      evidenceImages: [
        ...(primaryWork?.evidenceImages || []),
        ...(currentScene.evidenceImages || []),
      ],
    };
  }

  getLocalTrailState(stop = this.currentRouteStop) {
    const scenes = this.getSceneList(stop);
    if (scenes.length <= 1) return null;
    const activeStop = stop === this.currentRouteStop;
    const currentIndex = activeStop ? this.currentSceneIndex : 0;
    return {
      label: stop.localTrailLabel || `${stop.city || stop.country} museum line`,
      style: stop.localTravelStyle || 'rail',
      chapterTitle: stop.chapterTitle || stop.scene || stop.city || stop.country,
      nodes: scenes.map((scene, index) => ({
        id: scene.id,
        city: scene.city || stop.city || stop.country,
        title: scene.title || scene.scene || scene.city || `Scene ${index + 1}`,
        role: scene.sceneType || 'scene',
        status: activeStop
          ? index < currentIndex ? 'visited'
          : index === currentIndex ? 'current'
          : index === currentIndex + 1 ? 'next'
          : 'upcoming'
          : index === 0 ? 'current' : 'upcoming',
      })),
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
          ? `Return to ${country} for the ${targetStop.scene || targetStop.chapterTitle || targetStop.biographyStage || 'next scene'}.`
          : (targetStop.scene || targetStop.chapterTitle || ''),
      };
    }
    const scene = this.getSceneForCountry(country);
    const sceneBits = [scene.city, scene.country].filter(Boolean);
    return {
      primary: sceneBits.join(', ') || country,
      secondary: scene.scene || scene.chapterTitle || '',
    };
  }

  getLocations() {
    return this.getMapLocations();
  }

  getMapLocations() {
    const currentStop = this.currentRouteStop || {};
    const currentScene = this.getCurrentScene();
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
        hideOnMap: approxSamePoint(place.lat, place.lon, currentScene.lat, currentScene.lon) ||
          approxSamePoint(place.lat, place.lon, currentStop.lat, currentStop.lon) ||
          normalize(place.name).includes(normalize(currentScene.scene)) ||
          normalize(currentScene.scene).includes(normalize(place.name)),
        hideInList: approxSamePoint(place.lat, place.lon, currentScene.lat, currentScene.lon) ||
          approxSamePoint(place.lat, place.lon, currentStop.lat, currentStop.lon) ||
          normalize(place.name).includes(normalize(currentScene.scene)) ||
          normalize(currentScene.scene).includes(normalize(place.name)),
        })),
    ];
  }

  getSceneActions() {
    const currentScene = this.getCurrentScene();
    return (currentScene.customLocations || []).map((location, index) => ({
      id: location.id || `custom-${currentScene.id || 'scene'}-${index + 1}`,
      emoji: location.emoji || '🧩',
      name: location.name || location.title || 'Scene desk',
      type: location.type || 'scene-puzzle',
      prefix: location.prefix || '',
      lat: location.lat,
      lon: location.lon,
      description: location.description || '',
    }));
  }

  getSceneEvidenceImages() {
    const currentScene = this.getCurrentScene();
    const works = this.getCurrentWorks(currentScene);
    const primaryWork = works[0] || null;
    const images = [];
    if (primaryWork?.imagePath) {
      images.push({
        id: `${primaryWork.id || normalize(primaryWork.title)}-reference`,
        title: `${primaryWork.title} reference image`,
        imagePath: primaryWork.imagePath,
        imagePurpose: 'painting_reference',
        imageNotes: primaryWork.description || '',
        subtitle: [
          primaryWork.artist,
          primaryWork.institution,
          [primaryWork.city, primaryWork.country].filter(Boolean).join(', '),
        ].filter(Boolean).join(' • '),
      });
    }
    for (const item of primaryWork?.evidenceImages || []) {
      images.push({ ...item });
    }
    for (const item of currentScene.evidenceImages || []) {
      images.push({ ...item });
    }
    const seen = new Set();
    return images.filter(item => {
      const key = `${item.imagePath || ''}::${item.title || ''}`;
      if (!key.trim()) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  getInvestigatedLocationIds() {
    return new Set(this.investigatedByScene.get(this.getCurrentSceneKey()) || []);
  }

  getInformant(locationId) {
    if (this._isCulturalLocationId(locationId)) {
      const place = this.getCulturalPlaceByLocationId(locationId);
      return {
        emoji: this._culturalPlaceEmoji(place?.role),
        prefix: `${place?.name || 'Cultural archive'} records show`,
      };
    }
    const customLocation = this.getLocations().find(item => item.id === locationId && item.type && item.type !== 'cultural-place');
    if (customLocation) {
      return {
        emoji: customLocation.emoji || '🧩',
        prefix: customLocation.prefix || `${customLocation.name || 'Scene puzzle'} indicates`,
      };
    }
    const location = LOCATIONS.find(item => item.id === locationId);
    const informant = location?.informants?.[0];
    return informant || { emoji: location?.emoji || '🔎', prefix: location?.name || 'Field office' };
  }

  investigate(locationId) {
    const scene = this.getCurrentScene();
    const key = this.getCurrentSceneKey();
    const investigated = this.investigatedByScene.get(key) || new Set();
    if (investigated.has(locationId)) return null;
    investigated.add(locationId);
    this.investigatedByScene.set(key, investigated);

    let clue = (scene.clues || []).find(item => item.locationId === locationId && !this.evidence.some(e => e.id === item.id));
    if (!clue && this.currentCountry !== this.currentRouteStop.country) {
      clue = (scene.followups || []).find(item =>
        item.afterCountry === this.currentCountry &&
        item.locationId === locationId &&
        !this.evidence.some(e => e.id === `${scene.id}-${item.locationId}-followup`)
      );
      if (clue) {
        clue = {
          ...clue,
          id: `${scene.id}-${clue.locationId}-followup`,
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
      sceneIndex: this.currentSceneIndex,
      sceneId: scene.id,
      sceneTitle: scene.title || scene.scene || scene.city || '',
      fromCountry: this.currentRouteStop.country,
      targetCountry: this.targetRouteStop?.country || '',
      foundInCountry: this.currentCountry,
      foundInCity: scene.city || this.currentRouteStop?.city || this.currentCountry,
      category: clue.category || (
        clue.tags?.some(tag => tag.startsWith('culture:') || tag.startsWith('famous:') || tag.startsWith('history:') || tag.startsWith('cultural_'))
          ? 'Cultural Evidence'
          : clue.tags?.some(tag => tag.startsWith('country:') || tag.startsWith('city:') || tag === 'confirmation')
            ? 'Confirmation'
            : 'Route Evidence'
      ),
    };
    this.evidence.push(evidence);

    const progress = this.progressSceneIfReady();
    return { evidence, progress };
  }

  progressSceneIfReady() {
    if (!this.isCurrentSceneReady()) return { type: 'scene_pending' };
    const currentScene = this.getCurrentScene();
    if (this.getNextScene()) {
      this.completedSceneKeys.push(this.getCurrentSceneKey());
      this.currentSceneIndex += 1;
      return {
        type: 'scene_advanced',
        fromScene: currentScene,
        toScene: this.getCurrentScene(),
        chapterTitle: this.currentRouteStop.chapterTitle || this.currentRouteStop.scene || '',
      };
    }
    return {
      type: 'chapter_ready',
      scene: currentScene,
      targetCountry: this.targetRouteStop?.country || '',
    };
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
    const scene = this.getCurrentScene();
    const sceneCity = normalize(scene?.city);
    return this.culturalPlaces.filter(place => {
      if (place.country !== country) return false;
      if (!sceneCity) return true;
      return normalize(place.city) === sceneCity;
    });
  }

  getSceneForCountry(country) {
    if (normalize(this.currentRouteStop?.country) === normalize(country)) {
      return this.getCurrentScene();
    }
    if (normalize(this.targetRouteStop?.country) === normalize(country)) {
      return this.getSceneList(this.targetRouteStop)[0] || this.targetRouteStop;
    }
    const stop = this.caseData.route.find(item => normalize(item.country) === normalize(country));
    if (stop) return this.getSceneList(stop)[0] || stop;
    return {
      country,
      city: primaryCapital(this.countryMap[country]) || country,
      scene: 'ACME field office',
    };
  }

  getActiveEvidence() {
    return this.evidence.filter(item => item.legIndex === this.currentLeg && item.sceneIndex === this.currentSceneIndex);
  }

  analyzeCandidates() {
    const activeEvidence = this.getActiveEvidence();
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
    if (candidate.country === this.currentCountry) return 'Current scene. Finish the local chapter before moving the case onward.';
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
    const activeEvidence = this.getActiveEvidence();
    const currentScene = this.getCurrentScene();
    const hasRoute = activeEvidence.some(item => item.category === 'Route Evidence');
    const hasCulture = activeEvidence.some(item => item.category === 'Cultural Evidence');
    const hasConfirmation = activeEvidence.some(item => item.category === 'Confirmation');
    const hasPuzzle = activeEvidence.some(item => item.category === 'Puzzle Evidence');
    const requirePuzzle = !!currentScene.requirePuzzle || (currentScene.clues || []).some(item => item.category === 'Puzzle Evidence');
    const strongCandidateCount = this.analyzeCandidates().filter(item => item.state === 'strong').length;
    return {
      leadFound: activeEvidence.length > 0,
      patternSupported: hasCulture,
      contradictionsChecked: activeEvidence.some(item => (item.tags || []).some(tag => tag.startsWith('exclude:'))),
      destinationLikely: strongCandidateCount <= 3 && activeEvidence.length >= 3,
      evidenceReady: hasRoute && hasCulture && hasConfirmation && (!requirePuzzle || hasPuzzle) && activeEvidence.length >= Math.max(REQUIRED_PROOF_CARDS, currentScene.minimumEvidence || 0),
      puzzleSolved: !requirePuzzle || hasPuzzle,
    };
  }

  isCurrentSceneReady() {
    return this.getConfidence().evidenceReady;
  }

  canSubmitProof(country) {
    const confidence = this.getConfidence();
    return country === this.targetRouteStop?.country && confidence.evidenceReady && !this.getNextScene();
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
        explanation: this.getNextScene()
          ? 'The country fits, but ACME still needs the remaining local scenes solved before the chapter can move onward.'
          : 'The destination fits, but ACME will not advance the case until route, cultural, confirmation, and puzzle evidence are all on the board.',
      };
    }
    this.currentLeg++;
    this.currentSceneIndex = 0;
    this.currentCountry = country;
    const solved = this.currentLeg >= this.totalLegs;
    if (solved) this.finalSolved = true;
    return {
      type: solved ? 'case_ready' : 'advanced',
      from,
      country,
      next: this.targetRouteStop,
      scene: this.currentRouteStop,
      currentScene: this.getCurrentScene(),
    };
  }

  getProofCards() {
    return this.getActiveEvidence().slice(-5);
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
      currentScene: this.getCurrentScene(),
      currentWorks: this.getCurrentWorks(),
      sceneActions: this.getSceneActions(),
      sceneEvidenceImages: this.getSceneEvidenceImages(),
      artifactPanel: this.getCurrentArtifactPanel(),
      localTrail: this.getLocalTrailState(),
      completedSceneKeys: [...this.completedSceneKeys],
    };
  }

  getAtlasHints() {
    const activeEvidence = this.getActiveEvidence();
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
