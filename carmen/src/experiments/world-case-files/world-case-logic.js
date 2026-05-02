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

function stopSlug(stop = {}, fallback = 'stop') {
  return normalize(stop.id || stop.scene || stop.city || fallback).replace(/[^a-z0-9]+/g, '-') || fallback;
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
    this.currentStopIndex = 0;
    this.currentCountry = caseData.start.country;
    this.visited = [caseData.start.country];
    this.evidence = [];
    this.investigatedByStop = new Map();
    this.deadEnds = [];
    this.finalSolved = false;
    this.completedStopIds = [];
    this.fieldStopHistory = [];
    this.currentFieldLocation = null;
    this.unlockedLocationsByStop = new Map();
    this.revealedLocationsByStop = new Map();
    this.discoveredImagesByStop = new Map();
    this.imageObservations = new Map();
    this.questionsAskedByStopLocation = new Map();
    this.lastDeadEndExplanation = '';
    this.wrongHotspotCount = 0;
    this.wrongPuzzleAttemptCount = 0;
    this._setFieldLocation(this._buildFieldStopFromStop(this.currentRouteStop, 'scene'));
  }

  get mode() { return 'world_case_files'; }
  get totalLegs() { return Math.max(0, this.caseData.route.length - 1); }
  get currentRouteStop() { return this.caseData.route[this.currentStopIndex] || this.caseData.start; }
  get targetRouteStop() { return this.caseData.route[this.currentStopIndex + 1] || null; }
  get currentLegData() { return this.caseData.legs?.[this.currentStopIndex] || null; }
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

  _stopKey(stop = this.currentRouteStop) {
    return stop?.id || stopSlug(stop);
  }

  getProgress() {
    const currentStop = this.currentRouteStop;
    const targetStop = this.targetRouteStop;
    const fieldLocation = this.currentFieldLocation || null;
    return {
      stopIndex: this.currentStopIndex,
      totalStops: this.caseData.route.length,
      totalLegs: this.totalLegs,
      city: fieldLocation?.city || currentStop.city || this.currentCountry,
      country: fieldLocation?.country || this.currentCountry,
      scene: currentStop.scene || '',
      learningGoal: currentStop.learningGoal || '',
      thiefClaim: currentStop.thiefClaim || '',
      truthComplication: currentStop.truthComplication || '',
      targetCity: targetStop?.city || '',
      targetCountry: targetStop?.country || '',
      evidenceCount: this.evidence.length,
      sceneSummary: currentStop.sceneSummary || '',
      sceneTitle: fieldLocation?.kind && fieldLocation.kind !== 'scene'
        ? (fieldLocation.city || fieldLocation.country || '')
        : (currentStop.title || currentStop.scene || currentStop.city || ''),
      activeWorks: currentStop.focusWorks || [],
      threatenedWorks: currentStop.threatenedWorks || [],
      stolenWorks: currentStop.stolenWorks || [],
      escalationText: currentStop.escalationText || '',
      fieldStopKind: fieldLocation?.kind || 'scene',
    };
  }

  // Backward-compat aliases — each stop now serves as its own scene.
  getCurrentScene() {
    return this.currentRouteStop;
  }

  getCurrentSceneKey() {
    return this._stopKey(this.currentRouteStop);
  }

  getCurrentWorks(stop = this.currentRouteStop) {
    const focusWorks = stop?.focusWorks || [];
    return focusWorks.map(title => this.workMap[normalize(title)] || {
      title,
      artist: '',
      institution: '',
      city: stop?.city || '',
      country: stop?.country || '',
      description: '',
      imagePath: '',
      imageReady: false,
      evidenceImages: [],
    });
  }

  getCurrentPrimaryWork(stop = this.currentRouteStop) {
    return this.getCurrentWorks(stop)[0] || null;
  }

  getCurrentArtifactPanel() {
    const displayContext = this.getDisplaySceneContext();
    if (this.currentFieldLocation?.kind && this.currentFieldLocation.kind !== 'scene' && !displayContext) {
      return {
        caseTitle: this.caseData.title,
        sceneTitle: this.currentFieldLocation.city || this.currentFieldLocation.country || 'Field stop',
        currentObjective: 'Review the dead-end report, then return to the trail to choose the next lead.',
        summary: this.currentFieldLocation.explanation || 'ACME logged a field stop that did not advance the case.',
        primaryWork: null,
        works: [],
        evidenceImages: [],
      };
    }
    const stop = displayContext?.stop || this.currentRouteStop;
    const works = this.getCurrentWorks(stop);
    const primaryWork = works[0] || null;
    return {
      caseTitle: this.caseData.title,
      sceneTitle: stop.title || stop.scene || stop.city || '',
      currentObjective: stop.investigationPrompt || stop.learningGoal || '',
      summary: stop.escalationText || stop.sceneSummary || this.caseData.artifact?.hint || '',
      primaryWork,
      works,
      evidenceImages: [
        ...(primaryWork?.evidenceImages || []),
        ...(stop.evidenceImages || []),
      ],
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
        secondary: targetStop.scene || targetStop.title || '',
      };
    }
    const stop = this.getStopForCountry(country);
    const sceneBits = [stop.city, stop.country].filter(Boolean);
    return {
      primary: sceneBits.join(', ') || country,
      secondary: stop.scene || stop.title || '',
    };
  }

  getLocations() {
    return this.getMapLocations();
  }

  _buildFieldStopFromStop(stop = {}, kind = 'scene', extra = {}) {
    const country = stop.country || this.currentCountry;
    return {
      kind,
      country,
      city: stop.city || primaryCapital(this.countryMap[country]) || country,
      lat: Number(stop.lat),
      lon: Number(stop.lon),
      scene: stop.scene || stop.title || stop.city || '',
      stopIndex: this.currentStopIndex,
      ...extra,
    };
  }

  _setFieldLocation(stop, appendHistory = true) {
    this.currentFieldLocation = {
      ...stop,
      lat: Number(stop?.lat),
      lon: Number(stop?.lon),
    };
    if (appendHistory) this.fieldStopHistory.push({ ...this.currentFieldLocation });
  }

  getCurrentFieldLocation() {
    return this.currentFieldLocation ? { ...this.currentFieldLocation } : null;
  }

  _buildStopContext(stop, stopIndex) {
    return {
      stop,
      stopIndex,
      // Aliases for legacy callers — each stop now IS its own scene.
      scene: stop,
      sceneIndex: 0,
      sceneKey: this._stopKey(stop),
      stopKey: this._stopKey(stop),
      isCurrentAuthored: stopIndex === this.currentStopIndex,
    };
  }

  getDisplaySceneContext() {
    if (this.currentFieldLocation?.kind === 'scene') {
      return this._buildStopContext(this.currentRouteStop, this.currentStopIndex);
    }
    return this.findSceneContextForLocation(this.currentFieldLocation?.country, this.currentFieldLocation?.city);
  }

  findSceneContextForLocation(country, city) {
    const wantedCountry = normalize(country);
    const wantedCity = normalize(city);
    if (!wantedCountry || !wantedCity) return null;
    let best = null;
    for (let stopIndex = 0; stopIndex < this.caseData.route.length; stopIndex += 1) {
      const stop = this.caseData.route[stopIndex];
      if (normalize(stop.country) !== wantedCountry) continue;
      if (normalize(stop.city) !== wantedCity) continue;
      const context = this._buildStopContext(stop, stopIndex);
      if (!best) {
        best = context;
        continue;
      }
      const bestDistance = Math.abs(best.stopIndex - this.currentStopIndex);
      const currentDistance = Math.abs(stopIndex - this.currentStopIndex);
      if (currentDistance < bestDistance || (currentDistance === bestDistance && stopIndex > best.stopIndex)) {
        best = context;
      }
    }
    return best;
  }

  getMapLocations() {
    const displayContext = this.getDisplaySceneContext();
    if (this.currentFieldLocation?.kind && this.currentFieldLocation.kind !== 'scene' && !displayContext) {
      return LOCATIONS.map(location => ({
        id: location.id,
        emoji: location.emoji,
        name: location.name,
      }));
    }
    const currentStop = displayContext?.stop || this.currentRouteStop || {};
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
        hideInList: approxSamePoint(place.lat, place.lon, currentStop.lat, currentStop.lon) ||
          normalize(place.name).includes(normalize(currentStop.scene)) ||
          normalize(currentStop.scene).includes(normalize(place.name)),
        })),
    ];
  }

  getSceneActions() {
    const displayContext = this.getDisplaySceneContext();
    if (this.currentFieldLocation?.kind && this.currentFieldLocation.kind !== 'scene' && !displayContext) return [];
    const stop = displayContext?.stop || this.currentRouteStop;
    const stopId = displayContext?.stopKey || this._stopKey(stop);
    const stopHasLockedLocations = this._stopHasLockedCustomLocations(stop);
    return (stop.customLocations || []).map((location, index) => {
      const id = location.id || `custom-${stop.id || 'stop'}-${index + 1}`;
      const discoveryState = this._getLocationDiscoveryState(stopId, stop, id);
      if (discoveryState === 'hidden') return null;
      const locked = stopHasLockedLocations && !this._isCustomLocationUnlocked(stopId, id);
      const requiredImage = locked ? this._findUnlockingImage(stop, id) : null;
      const isAnonymous = discoveryState === 'anonymous';
      return {
        id,
        emoji: isAnonymous ? (location.anonymousEmoji || '❓') : (location.emoji || '🧩'),
        name: isAnonymous ? (location.anonymousName || 'Unknown lead') : (location.name || location.title || 'Scene desk'),
        type: location.type || 'scene-puzzle',
        prefix: location.prefix || '',
        lat: location.lat,
        lon: location.lon,
        description: isAnonymous ? '' : (location.description || ''),
        locked,
        discoveryState,
        anonymousName: location.anonymousName || '',
        anonymousEmoji: location.anonymousEmoji || '',
        realName: location.name || location.title || '',
        realEmoji: location.emoji || '',
        requiredImageId: requiredImage?.id || null,
        requiredImageTitle: requiredImage?.title || '',
      };
    }).filter(Boolean);
  }

  getSceneEvidenceImages() {
    const displayContext = this.getDisplaySceneContext();
    if (this.currentFieldLocation?.kind && this.currentFieldLocation.kind !== 'scene' && !displayContext) return [];
    const stop = displayContext?.stop || this.currentRouteStop;
    const stopId = displayContext?.stopKey || this._stopKey(stop);
    const works = this.getCurrentWorks(stop);
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
    for (const item of stop.evidenceImages || []) {
      if (!this._isImageDiscovered(stopId, stop, item.id)) continue;
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
    const displayContext = this.getDisplaySceneContext();
    return new Set(this.investigatedByStop.get(displayContext?.stopKey || this.getCurrentSceneKey()) || []);
  }

  getInformant(locationId) {
    if (this._isCulturalLocationId(locationId)) {
      const place = this.getCulturalPlaceByLocationId(locationId);
      return {
        emoji: this._culturalPlaceEmoji(place?.role),
        prefix: `${place?.name || 'Cultural archive'} records show`,
      };
    }
    const stop = this.getDisplaySceneContext()?.stop || this.currentRouteStop;
    const stopId = this.getDisplaySceneContext()?.stopKey || this.getCurrentSceneKey();
    const customLocation = (stop?.customLocations || []).find(loc => loc.id === locationId);
    if (customLocation) {
      const discoveryState = this._getLocationDiscoveryState(stopId, stop, locationId);
      const isAnonymous = discoveryState === 'anonymous';
      return {
        emoji: isAnonymous ? (customLocation.anonymousEmoji || '❓') : (customLocation.emoji || '🧩'),
        prefix: isAnonymous
          ? (customLocation.anonymousName || 'Unknown lead')
          : (customLocation.prefix || `${customLocation.name || 'Scene puzzle'} indicates`),
      };
    }
    const location = LOCATIONS.find(item => item.id === locationId);
    const informant = location?.informants?.[0];
    return informant || { emoji: location?.emoji || '🔎', prefix: location?.name || 'Field office' };
  }

  investigate(locationId) {
    const displayContext = this.getDisplaySceneContext();
    if (this.currentFieldLocation?.kind && this.currentFieldLocation.kind !== 'scene' && !displayContext) return null;
    const stop = displayContext?.stop || this.currentRouteStop;
    const fieldLocation = this.currentFieldLocation || {};
    const key = displayContext?.stopKey || this.getCurrentSceneKey();

    const customLocation = (stop.customLocations || []).find(loc => loc.id === locationId);
    if (customLocation && this._stopHasLockedCustomLocations(stop) && !this._isCustomLocationUnlocked(key, locationId)) {
      const requiredImage = this._findUnlockingImage(stop, locationId);
      return {
        blocked: true,
        locationId,
        customLocation,
        requiredImageId: requiredImage?.id || null,
        requiredImageTitle: requiredImage?.title || '',
      };
    }

    const interaction = stop.interactions?.[locationId];
    if (interaction?.type === 'witness-questions') {
      return {
        interaction: 'witness-questions',
        locationId,
        intro: interaction.intro || '',
        questions: this._buildVisibleQuestions(stop, locationId, interaction.questions || []),
      };
    }

    const investigated = this.investigatedByStop.get(key) || new Set();
    if (investigated.has(locationId)) {
      const staleEvidence = this.evidence.find(e =>
        e.locationId === locationId && e.staleAvailable && e.staleUpgrade
      );
      if (staleEvidence) {
        this._consumeStale(staleEvidence);
        this._applyClueMarksStale(stop, staleEvidence);
        this._applyCulturalCorroboration(stop);
        const progress = displayContext?.isCurrentAuthored ? this.progressStopIfReady() : { type: 'stop_pending' };
        return { evidence: staleEvidence, progress, restale: true };
      }
      return null;
    }
    investigated.add(locationId);
    this.investigatedByStop.set(key, investigated);

    let clue = (stop.clues || []).find(item => item.locationId === locationId && !this.evidence.some(e => e.id === item.id));
    if (!clue && fieldLocation.country && fieldLocation.country !== this.currentRouteStop.country) {
      clue = (stop.followups || []).find(item =>
        item.afterCountry === fieldLocation.country &&
        item.locationId === locationId &&
        !this.evidence.some(e => e.id === `${stop.id}-${item.locationId}-followup`)
      );
      if (clue) {
        clue = {
          ...clue,
          id: `${stop.id}-${clue.locationId}-followup`,
          title: 'Follow-up confirmation',
          action: 'Ask follow-up question',
          strength: 3,
        };
      }
    }
    if (!clue) return null;
    return this._dispenseClue(clue, { stop, displayContext, fieldLocation, customLocation });
  }

  _dispenseClue(clue, { stop, displayContext, fieldLocation, customLocation }) {
    const isPreliminary = !customLocation && this._stopHasLockedCustomLocations(stop) && clue.category !== 'Puzzle Evidence';
    const evidence = {
      ...clue,
      stopIndex: this.currentStopIndex,
      stopId: stop.id,
      sceneId: stop.id,
      sceneTitle: stop.title || stop.scene || stop.city || '',
      fromCountry: this.currentRouteStop.country,
      targetCountry: this.targetRouteStop?.country || '',
      foundInCountry: fieldLocation.country || this.currentCountry,
      foundInCity: fieldLocation.city || stop.city || this.currentRouteStop?.city || this.currentCountry,
      category: clue.category || (
        clue.tags?.some(tag => tag.startsWith('culture:') || tag.startsWith('famous:') || tag.startsWith('history:') || tag.startsWith('cultural_'))
          ? 'Cultural Evidence'
          : clue.tags?.some(tag => tag.startsWith('country:') || tag.startsWith('city:') || tag === 'confirmation')
            ? 'Confirmation'
            : 'Route Evidence'
      ),
      corroborated: !isPreliminary,
      vagueText: isPreliminary ? this._buildVagueWitnessText(clue) : null,
      staleAvailable: false,
    };
    this.evidence.push(evidence);

    if (!isPreliminary) {
      this._applyClueMarksStale(stop, clue);
    }
    this._applyCulturalCorroboration(stop);

    const progress = displayContext?.isCurrentAuthored ? this.progressStopIfReady() : { type: 'stop_pending' };
    return { evidence, progress };
  }

  _questionAskedKey(stopId, locationId) {
    return `${stopId}::${locationId}`;
  }

  _isQuestionUnlocked(stop, locationId, question) {
    const conditions = question.unlockedBy || [];
    if (!conditions.length) return true;
    const stopId = stop.id || this._stopKey(stop);
    return conditions.every((token) => {
      const parts = String(token).split(':');
      const kind = parts[0];
      if (kind === 'image') {
        const imageId = parts[1];
        const sub = parts[2];
        const obs = this.imageObservations.get(imageId);
        if (!obs) return false;
        if (sub === 'hotspot') {
          const hotspotId = parts.slice(3).join(':');
          return !!(obs.hotspotsHit && obs.hotspotsHit.has(hotspotId));
        }
        if (sub === 'puzzleSolved') {
          return obs.puzzleSolved === true;
        }
        return false;
      }
      if (kind === 'clue') {
        const clueId = parts.slice(1).join(':');
        return this.evidence.some((e) => e.id === clueId);
      }
      if (kind === 'question') {
        const locId = parts[1];
        const qId = parts.slice(2).join(':');
        const set = this.questionsAskedByStopLocation.get(this._questionAskedKey(stopId, locId));
        return !!(set && set.has(qId));
      }
      return false;
    });
  }

  _buildVisibleQuestions(stop, locationId, questions) {
    const stopId = stop.id || this._stopKey(stop);
    const askedSet = this.questionsAskedByStopLocation.get(this._questionAskedKey(stopId, locationId)) || new Set();
    return questions
      .filter((q) => this._isQuestionUnlocked(stop, locationId, q))
      .map((q) => ({
        id: q.id,
        text: q.text,
        asked: askedSet.has(q.id),
        answer: askedSet.has(q.id) ? (q.answer || '') : '',
        providesClue: q.providesClue || null,
      }));
  }

  askWitnessQuestion(locationId, questionId) {
    const displayContext = this.getDisplaySceneContext();
    const stop = displayContext?.stop || this.currentRouteStop;
    const fieldLocation = this.currentFieldLocation || {};
    const interaction = stop.interactions?.[locationId];
    if (!interaction || interaction.type !== 'witness-questions') return null;
    const question = (interaction.questions || []).find((q) => q.id === questionId);
    if (!question) return null;
    if (!this._isQuestionUnlocked(stop, locationId, question)) return null;

    const stopId = stop.id || this._stopKey(stop);
    const askedKey = this._questionAskedKey(stopId, locationId);
    const askedSet = this.questionsAskedByStopLocation.get(askedKey) || new Set();
    const wasAsked = askedSet.has(questionId);
    askedSet.add(questionId);
    this.questionsAskedByStopLocation.set(askedKey, askedSet);

    let evidence = null;
    let progress = { type: 'stop_pending' };
    if (!wasAsked && question.providesClue) {
      const clue = (stop.clues || []).find((c) => c.id === question.providesClue);
      if (clue && !this.evidence.some((e) => e.id === clue.id)) {
        const customLocation = (stop.customLocations || []).find((loc) => loc.id === locationId);
        const investigated = this.investigatedByStop.get(stopId) || new Set();
        investigated.add(locationId);
        this.investigatedByStop.set(stopId, investigated);
        const dispatched = this._dispenseClue(clue, { stop, displayContext, fieldLocation, customLocation });
        evidence = dispatched.evidence;
        progress = dispatched.progress;
      }
    }

    return {
      interaction: 'witness-questions',
      locationId,
      intro: interaction.intro || '',
      answer: question.answer || '',
      providedClue: !!evidence,
      evidence,
      progress,
      questions: this._buildVisibleQuestions(stop, locationId, interaction.questions || []),
    };
  }

  _stopHasLockedCustomLocations(stop) {
    return (stop?.evidenceImages || []).some(img => Array.isArray(img.hotspots) || img.puzzle);
  }

  _isCustomLocationUnlocked(stopId, locationId) {
    const set = this.unlockedLocationsByStop.get(stopId);
    return !!(set && set.has(locationId));
  }

  _markCustomLocationUnlocked(stopId, locationId) {
    const set = this.unlockedLocationsByStop.get(stopId) || new Set();
    set.add(locationId);
    this.unlockedLocationsByStop.set(stopId, set);
  }

  _ensureStopDiscovery(stopId, stop) {
    if (!this.revealedLocationsByStop.has(stopId)) {
      const revealed = new Set();
      for (const loc of (stop?.customLocations || [])) {
        const state = loc.discoveryState || 'revealed';
        if (state === 'revealed') revealed.add(loc.id);
      }
      this.revealedLocationsByStop.set(stopId, revealed);
    }
    if (!this.discoveredImagesByStop.has(stopId)) {
      const discovered = new Set();
      for (const img of (stop?.evidenceImages || [])) {
        const state = img.imageDiscoveryState || 'discovered';
        if (state === 'discovered') discovered.add(img.id);
      }
      this.discoveredImagesByStop.set(stopId, discovered);
    }
  }

  _getLocationDiscoveryState(stopId, stop, locationId) {
    this._ensureStopDiscovery(stopId, stop);
    if (this.revealedLocationsByStop.get(stopId)?.has(locationId)) return 'revealed';
    const loc = (stop?.customLocations || []).find(l => l.id === locationId);
    return loc?.discoveryState || 'revealed';
  }

  _isImageDiscovered(stopId, stop, imageId) {
    this._ensureStopDiscovery(stopId, stop);
    return this.discoveredImagesByStop.get(stopId)?.has(imageId) || false;
  }

  _revealCustomLocation(stopId, locationId) {
    const stop = this.getDisplaySceneContext()?.stop || this.currentRouteStop;
    this._ensureStopDiscovery(stopId, stop);
    const set = this.revealedLocationsByStop.get(stopId);
    if (set && !set.has(locationId)) {
      set.add(locationId);
      return true;
    }
    return false;
  }

  _discoverImage(stopId, imageId) {
    const stop = this.getDisplaySceneContext()?.stop || this.currentRouteStop;
    this._ensureStopDiscovery(stopId, stop);
    const set = this.discoveredImagesByStop.get(stopId);
    if (set && !set.has(imageId)) {
      set.add(imageId);
      return true;
    }
    return false;
  }

  _findUnlockingImage(stop, locationId) {
    return (stop.evidenceImages || []).find(image => {
      if (Array.isArray(image.unlocks) && image.unlocks.includes(locationId)) return true;
      if (Array.isArray(image.hotspots)) {
        return image.hotspots.some(hotspot => Array.isArray(hotspot.unlocks) && hotspot.unlocks.includes(locationId));
      }
      return false;
    }) || null;
  }

  _buildVagueWitnessText(clue) {
    const category = clue.category || '';
    if (category === 'Cultural Evidence') return 'A cultural reference is hinted at, but the clerk will not name the destination without something more solid to compare against.';
    if (category === 'Confirmation') return 'Customs paperwork is consistent with the case, but it stops short of naming a specific country until corroborating evidence is filed.';
    return 'A partial lead is on offer, but the witness wants supporting evidence before they will commit to a country or city.';
  }

  getUnlockedCustomLocations() {
    const key = this.getDisplaySceneContext()?.stopKey || this.getCurrentSceneKey();
    return new Set(this.unlockedLocationsByStop.get(key) || []);
  }

  getImageObservation(imageId) {
    const obs = this.imageObservations.get(imageId);
    return obs ? {
      hotspotsHit: new Set(obs.hotspotsHit),
      puzzleSolved: !!obs.puzzleSolved,
      sealsPlaced: new Set(obs.sealsPlaced || []),
    } : { hotspotsHit: new Set(), puzzleSolved: false, sealsPlaced: new Set() };
  }

  observeImageHotspot(imageId, hotspotId) {
    const stop = this.getDisplaySceneContext()?.stop || this.currentRouteStop;
    const image = (stop.evidenceImages || []).find(item => item.id === imageId);
    if (!image) return { result: 'unknown_image' };
    const hotspot = (image.hotspots || []).find(item => item.id === hotspotId);
    if (!hotspot) return { result: 'unknown_hotspot' };
    const obs = this.imageObservations.get(imageId) || { hotspotsHit: new Set(), puzzleSolved: false };
    if (!hotspot.correct) {
      this.wrongHotspotCount += 1;
      this.imageObservations.set(imageId, obs);
      return { result: 'wrong', hotspot };
    }
    if (obs.hotspotsHit.has(hotspotId)) {
      return { result: 'already', hotspot };
    }
    obs.hotspotsHit.add(hotspotId);
    this.imageObservations.set(imageId, obs);
    const stopId = this.getDisplaySceneContext()?.stopKey || this.getCurrentSceneKey();
    const unlockedLocationIds = [];
    const revealedLocationIds = [];
    const discoveredImageIds = [];
    const staledClueIds = [];
    for (const id of (hotspot.unlocks || [])) {
      this._markCustomLocationUnlocked(stopId, id);
      unlockedLocationIds.push(id);
    }
    for (const id of (hotspot.reveals || [])) {
      if (this._revealCustomLocation(stopId, id)) revealedLocationIds.push(id);
    }
    for (const id of (hotspot.discoversImages || [])) {
      if (this._discoverImage(stopId, id)) discoveredImageIds.push(id);
    }
    for (const id of (hotspot.marksStale || [])) {
      if (this._markEvidenceStale(id)) staledClueIds.push(id);
    }
    return {
      result: 'correct',
      hotspot,
      unlockedLocationIds,
      revealedLocationIds,
      discoveredImageIds,
      staledClueIds,
    };
  }

  solveImagePuzzle(imageId, attempt) {
    const stop = this.getDisplaySceneContext()?.stop || this.currentRouteStop;
    const image = (stop.evidenceImages || []).find(item => item.id === imageId);
    if (!image || !image.puzzle) return { result: 'unknown_puzzle' };
    const stopId = this.getDisplaySceneContext()?.stopKey || this.getCurrentSceneKey();
    if (image.puzzle.type === 'seal-cipher') {
      return this._solveSealCipher(image, attempt, stopId);
    }
    const obs = this.imageObservations.get(imageId) || { hotspotsHit: new Set(), puzzleSolved: false };
    if (obs.puzzleSolved) return { result: 'already' };
    const expected = String(image.puzzle.solution || '').toUpperCase();
    const guess = String(attempt || '').toUpperCase();
    if (expected && guess !== expected) {
      this.wrongPuzzleAttemptCount += 1;
      return { result: 'wrong' };
    }
    obs.puzzleSolved = true;
    this.imageObservations.set(imageId, obs);
    const unlockedLocationIds = [];
    const staledClueIds = [];
    for (const id of (image.unlocks || [])) {
      this._markCustomLocationUnlocked(stopId, id);
      unlockedLocationIds.push(id);
    }
    for (const id of (image.puzzle.marksStale || [])) {
      if (this._markEvidenceStale(id)) staledClueIds.push(id);
    }
    return { result: 'solved', unlockedLocationIds, staledClueIds };
  }

  _solveSealCipher(image, attempt, stopId) {
    const sealId = attempt?.sealId;
    const destinationId = attempt?.destinationId;
    const seal = (image.puzzle.seals || []).find(s => s.id === sealId);
    if (!seal) return { result: 'unknown_seal' };
    if (!seal.active) {
      return {
        result: 'inactive_seal',
        sealId,
        evidencePendingText: seal.evidencePendingText || 'This seal is awaiting field evidence.',
      };
    }
    if (seal.destination !== destinationId) {
      this.wrongPuzzleAttemptCount += 1;
      return { result: 'wrong', sealId, destinationId };
    }
    const obs = this.imageObservations.get(image.id) || { hotspotsHit: new Set(), puzzleSolved: false, sealsPlaced: new Set() };
    if (!obs.sealsPlaced) obs.sealsPlaced = new Set();
    if (obs.sealsPlaced.has(sealId)) {
      return { result: 'already', sealId, destinationId };
    }
    obs.sealsPlaced.add(sealId);
    const activeSeals = (image.puzzle.seals || []).filter(s => s.active);
    const allPlaced = activeSeals.every(s => obs.sealsPlaced.has(s.id));
    if (allPlaced) obs.puzzleSolved = true;
    this.imageObservations.set(image.id, obs);
    const unlockedLocationIds = [];
    const staledClueIds = [];
    if (allPlaced) {
      for (const id of (image.unlocks || [])) {
        this._markCustomLocationUnlocked(stopId, id);
        unlockedLocationIds.push(id);
      }
      for (const id of (image.puzzle.marksStale || [])) {
        if (this._markEvidenceStale(id)) staledClueIds.push(id);
      }
    }
    return {
      result: allPlaced ? 'solved' : 'partial',
      sealId,
      destinationId,
      unlockedLocationIds,
      staledClueIds,
    };
  }

  _markEvidenceStale(clueId) {
    const evidence = this.evidence.find(item => item.id === clueId);
    if (!evidence) return false;
    if (evidence.corroborated && !evidence.staleUpgrade) return false;
    if (evidence.staleAvailable) return false;
    if (!evidence.staleUpgrade) return false;
    evidence.staleAvailable = true;
    return true;
  }

  _consumeStale(evidence) {
    const upgrade = evidence.staleUpgrade;
    if (upgrade) {
      if (upgrade.upgradedText !== undefined) evidence.text = upgrade.upgradedText;
      if (upgrade.upgradedTitle !== undefined) evidence.title = upgrade.upgradedTitle;
      if (upgrade.upgradedTags !== undefined) evidence.tags = upgrade.upgradedTags;
      if (upgrade.upgradedStrength !== undefined) evidence.strength = upgrade.upgradedStrength;
      if (upgrade.upgradedAction !== undefined) evidence.action = upgrade.upgradedAction;
    }
    evidence.corroborated = true;
    evidence.staleAvailable = false;
    evidence.vagueText = null;
  }

  _applyClueMarksStale(stop, clueOrEvidence) {
    if (!clueOrEvidence) return;
    const clueRef = (stop?.clues || []).find(c => c.id === clueOrEvidence.id);
    const marksStale = clueRef?.marksStale || clueOrEvidence.marksStale || [];
    for (const id of marksStale) {
      this._markEvidenceStale(id);
    }
  }

  _applyCulturalCorroboration(stop) {
    const requires = stop?.culturalCorroborationRequires || [];
    if (!requires.length) return;
    const allCorroborated = requires.every(id =>
      this.evidence.some(e => e.id === id && e.corroborated)
    );
    if (!allCorroborated) return;
    for (const id of (stop.culturalCorroborationStales || [])) {
      this._markEvidenceStale(id);
    }
  }

  scenePuzzleRequired(stop = this.currentRouteStop) {
    return (stop?.evidenceImages || []).some(img => !!img.puzzle);
  }

  scenePuzzleSolved(stop = this.currentRouteStop) {
    if (!this.scenePuzzleRequired(stop)) return true;
    return (stop.evidenceImages || []).some(img => img.puzzle && this.imageObservations.get(img.id)?.puzzleSolved);
  }

  progressStopIfReady() {
    if (!this.isCurrentSceneReady()) return { type: 'stop_pending' };
    return {
      type: 'stop_ready',
      scene: this.currentRouteStop,
      stop: this.currentRouteStop,
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
    const displayContext = this.getDisplaySceneContext();
    if (this.currentFieldLocation?.kind && this.currentFieldLocation.kind !== 'scene' && !displayContext) return [];
    const stop = displayContext?.stop || this.currentRouteStop;
    const stopCity = normalize(stop?.city);
    return this.culturalPlaces.filter(place => {
      if (place.country !== country) return false;
      if (!stopCity) return true;
      return normalize(place.city) === stopCity;
    });
  }

  getStopForCountry(country) {
    if (normalize(this.currentRouteStop?.country) === normalize(country)) {
      return this.currentRouteStop;
    }
    if (normalize(this.targetRouteStop?.country) === normalize(country)) {
      return this.targetRouteStop;
    }
    const stop = this.caseData.route.find(item => normalize(item.country) === normalize(country));
    if (stop) return stop;
    return {
      country,
      city: primaryCapital(this.countryMap[country]) || country,
      scene: 'ACME field office',
    };
  }

  getSceneForCountry(country) {
    return this.getStopForCountry(country);
  }

  getActiveEvidence() {
    return this.evidence.filter(item => item.stopIndex === this.currentStopIndex);
  }

  analyzeCandidates() {
    const activeEvidence = this.getActiveEvidence();
    const targetCountry = this.targetRouteStop?.country;
    const currentFieldCountry = this.currentFieldLocation?.country || this.currentCountry;
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
      else if (countryData.country === currentFieldCountry) state = 'current';
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
    if (candidate.country === (this.currentFieldLocation?.country || this.currentCountry)) {
      return this.currentFieldLocation?.kind === 'scene'
        ? 'Current scene. Finish the local lead before moving the case onward.'
        : 'Current field stop. Move onward when the lead is clear.';
    }
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
    const currentStop = this.currentRouteStop;
    const hasRoute = activeEvidence.some(item => item.category === 'Route Evidence' && item.corroborated !== false);
    const hasCulture = activeEvidence.some(item => item.category === 'Cultural Evidence' && item.corroborated !== false);
    const hasConfirmation = activeEvidence.some(item => item.category === 'Confirmation' && item.corroborated !== false);
    const hasPuzzleEvidence = activeEvidence.some(item => item.category === 'Puzzle Evidence' && item.corroborated !== false);
    const stopRequiresPuzzleImage = this.scenePuzzleRequired(currentStop);
    const stopHasLockedLocations = this._stopHasLockedCustomLocations(currentStop);
    const requirePuzzle = stopHasLockedLocations
      ? stopRequiresPuzzleImage
      : (!!currentStop.requirePuzzle || (currentStop.clues || []).some(item => item.category === 'Puzzle Evidence'));
    const puzzleSolved = stopHasLockedLocations
      ? this.scenePuzzleSolved(currentStop)
      : (!requirePuzzle || hasPuzzleEvidence);
    const strongCandidateCount = this.analyzeCandidates().filter(item => item.state === 'strong').length;
    const corroboratedCount = activeEvidence.filter(item => item.corroborated !== false).length;
    return {
      leadFound: activeEvidence.length > 0,
      patternSupported: hasCulture,
      contradictionsChecked: activeEvidence.some(item => (item.tags || []).some(tag => tag.startsWith('exclude:'))),
      destinationLikely: strongCandidateCount <= 3 && corroboratedCount >= 3,
      evidenceReady: hasRoute && hasCulture && hasConfirmation && (!requirePuzzle || puzzleSolved) && corroboratedCount >= Math.max(REQUIRED_PROOF_CARDS, currentStop.minimumEvidence || 0),
      puzzleSolved,
    };
  }

  isCurrentSceneReady() {
    return this.getConfidence().evidenceReady;
  }

  canSubmitProof(country) {
    const confidence = this.getConfidence();
    return country === this.targetRouteStop?.country && confidence.evidenceReady;
  }

  getExpectedTravelCity() {
    return this.targetRouteStop?.city || '';
  }

  travelToSelection(selection = {}) {
    const target = this.targetRouteStop;
    if (!target) return { type: 'complete' };
    const country = selection?.country || '';
    const city = selection?.city || '';
    const lat = Number(selection?.lat);
    const lon = Number(selection?.lon);
    const from = this.currentFieldLocation?.country || this.currentCountry;
    const expectedCity = this.getExpectedTravelCity();
    const baseFieldStop = this._buildFieldStopFromStop({
      country,
      city: city || primaryCapital(this.countryMap[country]) || country,
      lat,
      lon,
      scene: city || country,
    }, 'field_stop');
    const wasVisitedCountry = this.visited.includes(country);
    if (!wasVisitedCountry) this.visited.push(country);

    if (country === target.country && expectedCity && normalize(city) && normalize(city) !== normalize(expectedCity)) {
      const explanation = `ACME checks ${city}, but the lead does not resolve there. The country fits, but this city does not match the active case file.`;
      const fieldStop = {
        ...baseFieldStop,
        kind: 'wrong_city',
        expectedCity,
        explanation,
      };
      this._setFieldLocation(fieldStop);
      this.deadEnds.push({ stopIndex: this.currentStopIndex, country, city, explanation, kind: 'wrong_city' });
      return {
        type: 'wrong_city',
        from,
        country,
        city,
        expectedCity,
        fieldStop,
        explanation,
      };
    }
    const revisitedSceneContext = this.findSceneContextForLocation(country, city || primaryCapital(this.countryMap[country]) || country);
    if (revisitedSceneContext && revisitedSceneContext.stopIndex <= this.currentStopIndex && country !== target.country) {
      const explanation = revisitedSceneContext.isCurrentAuthored
        ? 'ACME returns to the active scene. The remaining clues can still be gathered here before the trail moves on.'
        : 'ACME reopens the earlier scene. New evidence may unlock if the latest lead gives you a better question to ask.';
      const fieldStop = this._buildFieldStopFromStop(
        revisitedSceneContext.stop,
        revisitedSceneContext.isCurrentAuthored ? 'scene' : 'revisited',
        {
          explanation,
          stopIndex: revisitedSceneContext.stopIndex,
        }
      );
      this._setFieldLocation(fieldStop);
      return {
        type: 'revisited',
        from,
        country,
        city: fieldStop.city,
        fieldStop,
        explanation,
      };
    }
    if (country !== target.country) {
      const isLocalCountryMove = country === (this.currentFieldLocation?.country || this.currentCountry);
      const explanation = isLocalCountryMove
        ? `${baseFieldStop.city} does not open the next lead. ACME stays on the ${country} file, but this stop does not advance the case.`
        : (this.caseData.deadEnds?.[country] || this.caseData.deadEnds?.default || 'The field office found no match for the evidence.');
      const fieldStop = { ...baseFieldStop, kind: 'dead_end_country', explanation };
      this._setFieldLocation(fieldStop);
      this.deadEnds.push({ stopIndex: this.currentStopIndex, country, city: fieldStop.city, explanation, kind: 'dead_end_country' });
      return { type: 'dead_end', from, country, city: fieldStop.city, fieldStop, explanation };
    }
    if (!this.canSubmitProof(country)) {
      const explanation = 'The destination fits, but ACME will not advance the case until route, cultural, confirmation, and puzzle evidence are all on the board.';
      const fieldStop = { ...baseFieldStop, kind: 'arrived_unproven', city: city || target.city || baseFieldStop.city, explanation };
      this._setFieldLocation(fieldStop);
      return {
        type: 'arrived_unproven',
        from,
        country,
        city: fieldStop.city,
        fieldStop,
        explanation,
      };
    }
    this.completedStopIds.push(this._stopKey(this.currentRouteStop));
    this.currentStopIndex++;
    this.currentCountry = country;
    this._setFieldLocation(this._buildFieldStopFromStop(this.currentRouteStop, 'scene'));
    const solved = this.currentStopIndex >= this.totalLegs;
    if (solved) this.finalSolved = true;
    return {
      type: solved ? 'case_ready' : 'advanced',
      from,
      country,
      city: city || target.city || '',
      next: this.targetRouteStop,
      scene: this.currentRouteStop,
      currentScene: this.currentRouteStop,
      fieldStop: this.getCurrentFieldLocation(),
    };
  }

  travelTo(country) {
    return this.travelToSelection({ country });
  }

  getProofCards() {
    return this.getActiveEvidence().slice(-5);
  }

  getBoardState() {
    const displayContext = this.getDisplaySceneContext();
    const observations = {};
    for (const [imageId, obs] of this.imageObservations.entries()) {
      observations[imageId] = {
        hotspotsHit: new Set(obs.hotspotsHit),
        puzzleSolved: !!obs.puzzleSolved,
        sealsPlaced: new Set(obs.sealsPlaced || []),
      };
    }
    return {
      caseTitle: this.caseData.title,
      pattern: this.caseData.pattern,
      current: this.getProgress(),
      confidence: this.getConfidence(),
      statusBar: this.getStatusBarState(),
      summary: this.getCandidateSummary(),
      atlasHints: this.getAtlasHints(),
      evidence: [...this.evidence],
      deadEnds: [...this.deadEnds],
      fieldStopHistory: [...this.fieldStopHistory],
      route: this.caseData.route,
      culturalPlaces: this.culturalPlaces,
      culturalObjects: this.culturalObjects,
      currentScene: this.currentRouteStop,
      displayScene: displayContext?.stop || null,
      currentWorks: this.getCurrentWorks(),
      sceneActions: this.getSceneActions(),
      sceneEvidenceImages: this.getSceneEvidenceImages(),
      artifactPanel: this.getCurrentArtifactPanel(),
      completedStopIds: [...this.completedStopIds],
      currentFieldLocation: this.getCurrentFieldLocation(),
      unlockedCustomLocations: this.getUnlockedCustomLocations(),
      revealedCustomLocations: this.getRevealedCustomLocations(),
      discoveredEvidenceImages: this.getDiscoveredEvidenceImages(),
      imageObservations: observations,
      questionsAsked: Object.fromEntries(
        [...this.questionsAskedByStopLocation].map(([k, v]) => [k, [...v]])
      ),
    };
  }

  getRevealedCustomLocations() {
    const displayContext = this.getDisplaySceneContext();
    const stopId = displayContext?.stopKey || this.getCurrentSceneKey();
    const stop = displayContext?.stop || this.currentRouteStop;
    this._ensureStopDiscovery(stopId, stop);
    return new Set(this.revealedLocationsByStop.get(stopId) || []);
  }

  getDiscoveredEvidenceImages() {
    const displayContext = this.getDisplaySceneContext();
    const stopId = displayContext?.stopKey || this.getCurrentSceneKey();
    const stop = displayContext?.stop || this.currentRouteStop;
    this._ensureStopDiscovery(stopId, stop);
    return new Set(this.discoveredImagesByStop.get(stopId) || []);
  }

  getStatusBarState() {
    const current = this.getProgress();
    const confidence = this.getConfidence();
    const currentStop = this.currentRouteStop;
    const puzzleRequired = !!currentStop.requirePuzzle || (currentStop.clues || []).some(item => item.category === 'Puzzle Evidence');
    const city = current.city || currentStop.city || '';
    const country = current.country || this.currentCountry || '';
    const samePlace = normalize(city) && normalize(city) === normalize(country);
    const locationLabel = [city, samePlace ? '' : country].filter(Boolean).join(', ') || country || 'Current scene';

    const active = this.getActiveEvidence();
    const categoryState = (category) => {
      if (active.some(i => i.category === category && i.corroborated !== false)) return 'complete';
      if (active.some(i => i.category === category && i.corroborated === false)) return 'partial';
      return 'incomplete';
    };
    const corroboratedCount = active.filter(i => i.corroborated !== false).length;
    const proofThreshold = Math.max(REQUIRED_PROOF_CARDS, currentStop.minimumEvidence || 0);

    return {
      locationLabel,
      evidenceGauge: [
        { id: 'route', label: 'Route', state: categoryState('Route Evidence') },
        { id: 'culture', label: 'Culture', state: categoryState('Cultural Evidence') },
        { id: 'confirmation', label: 'Confirm', state: categoryState('Confirmation') },
        {
          id: 'puzzle',
          label: 'Puzzle',
          state: !puzzleRequired ? 'not_required' : confidence.puzzleSolved ? 'complete' : 'incomplete',
        },
        {
          id: 'proof',
          label: 'Proof',
          state: corroboratedCount >= proofThreshold ? 'complete' : 'incomplete',
          value: Math.min(corroboratedCount, proofThreshold),
          max: proofThreshold,
        },
      ],
      ready: confidence.evidenceReady,
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
