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
    this.fieldStopHistory = [];
    this.currentFieldLocation = null;
    this.unlockedLocationsByScene = new Map();
    this.revealedLocationsByScene = new Map();
    this.discoveredImagesByScene = new Map();
    this.imageObservations = new Map();
    this.lastDeadEndExplanation = '';
    this.wrongHotspotCount = 0;
    this.wrongPuzzleAttemptCount = 0;
    this._setFieldLocation(this._buildFieldStopFromScene(this.getCurrentScene(), 'scene'));
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
    const fieldLocation = this.currentFieldLocation || null;
    return {
      leg: this.currentLeg,
      totalLegs: this.totalLegs,
      city: fieldLocation?.city || currentScene.city || currentStop.city || this.currentCountry,
      country: fieldLocation?.country || this.currentCountry,
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
      sceneTitle: fieldLocation?.kind && fieldLocation.kind !== 'scene'
        ? (fieldLocation.city || fieldLocation.country || '')
        : (currentScene.title || currentScene.scene || currentScene.city || ''),
      sceneIndex: this.currentSceneIndex,
      sceneCount: this.getSceneList(currentStop).length,
      activeWorks: currentScene.focusWorks || [],
      threatenedWorks: currentScene.threatenedWorks || [],
      stolenWorks: currentScene.stolenWorks || [],
      escalationText: currentScene.escalationText || currentStop.escalationText || '',
      chapterReady: this.isCurrentSceneReady() && !this.getNextScene(),
      fieldStopKind: fieldLocation?.kind || 'scene',
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
    const displayContext = this.getDisplaySceneContext();
    if (this.currentFieldLocation?.kind && this.currentFieldLocation.kind !== 'scene' && !displayContext) {
      return {
        caseTitle: this.caseData.title,
        chapterTitle: this.currentRouteStop.chapterTitle || this.currentRouteStop.scene || '',
        sceneTitle: this.currentFieldLocation.city || this.currentFieldLocation.country || 'Field stop',
        currentObjective: 'Review the dead-end report, then return to the trail to choose the next lead.',
        summary: this.currentFieldLocation.explanation || 'ACME logged a field stop that did not advance the case.',
        primaryWork: null,
        works: [],
        evidenceImages: [],
      };
    }
    const currentScene = displayContext?.scene || this.getCurrentScene();
    const currentStop = displayContext?.stop || this.currentRouteStop;
    const works = this.getCurrentWorks(currentScene);
    const primaryWork = works[0] || null;
    return {
      caseTitle: this.caseData.title,
      chapterTitle: currentStop.chapterTitle || currentStop.scene || '',
      sceneTitle: currentScene.title || currentScene.scene || currentScene.city || '',
      currentObjective: currentScene.investigationPrompt || currentScene.learningGoal || currentStop.learningGoal || '',
      summary: currentScene.escalationText || currentStop.chapterSummary || this.caseData.artifact?.hint || '',
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

  _buildFieldStopFromScene(scene = {}, kind = 'scene', extra = {}) {
    const country = scene.country || this.currentCountry;
    return {
      kind,
      country,
      city: scene.city || primaryCapital(this.countryMap[country]) || country,
      lat: Number(scene.lat),
      lon: Number(scene.lon),
      scene: scene.scene || scene.title || scene.city || '',
      legIndex: this.currentLeg,
      sceneIndex: this.currentSceneIndex,
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

  _buildSceneContext(stop, stopIndex, scene, sceneIndex) {
    return {
      stop,
      stopIndex,
      scene,
      sceneIndex,
      sceneKey: `${stopIndex}:${scene.id || sceneSlug(scene, 'scene')}`,
      isCurrentAuthored: stopIndex === this.currentLeg && sceneIndex === this.currentSceneIndex,
    };
  }

  getDisplaySceneContext() {
    if (this.currentFieldLocation?.kind === 'scene') {
      return this._buildSceneContext(this.currentRouteStop, this.currentLeg, this.getCurrentScene(), this.currentSceneIndex);
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
      const scenes = this.getSceneList(stop);
      for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex += 1) {
        const scene = scenes[sceneIndex];
        if (normalize(scene.country || stop.country) !== wantedCountry) continue;
        if (normalize(scene.city || stop.city) !== wantedCity) continue;
        const context = this._buildSceneContext(stop, stopIndex, scene, sceneIndex);
        if (!best) {
          best = context;
          continue;
        }
        const bestDistance = Math.abs(best.stopIndex - this.currentLeg);
        const currentDistance = Math.abs(stopIndex - this.currentLeg);
        if (currentDistance < bestDistance || (currentDistance === bestDistance && stopIndex > best.stopIndex)) {
          best = context;
        }
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
    const currentScene = displayContext?.scene || this.getCurrentScene();
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
    const displayContext = this.getDisplaySceneContext();
    if (this.currentFieldLocation?.kind && this.currentFieldLocation.kind !== 'scene' && !displayContext) return [];
    const currentScene = displayContext?.scene || this.getCurrentScene();
    const sceneKey = displayContext?.sceneKey || this.getCurrentSceneKey();
    const sceneHasLockedLocations = this._sceneHasLockedCustomLocations(currentScene);
    return (currentScene.customLocations || []).map((location, index) => {
      const id = location.id || `custom-${currentScene.id || 'scene'}-${index + 1}`;
      const discoveryState = this._getLocationDiscoveryState(sceneKey, currentScene, id);
      if (discoveryState === 'hidden') return null;
      const locked = sceneHasLockedLocations && !this._isCustomLocationUnlocked(sceneKey, id);
      const requiredImage = locked ? this._findUnlockingImage(currentScene, id) : null;
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
    const currentScene = displayContext?.scene || this.getCurrentScene();
    const sceneKey = displayContext?.sceneKey || this.getCurrentSceneKey();
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
      if (!this._isImageDiscovered(sceneKey, currentScene, item.id)) continue;
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
    return new Set(this.investigatedByScene.get(displayContext?.sceneKey || this.getCurrentSceneKey()) || []);
  }

  getInformant(locationId) {
    if (this._isCulturalLocationId(locationId)) {
      const place = this.getCulturalPlaceByLocationId(locationId);
      return {
        emoji: this._culturalPlaceEmoji(place?.role),
        prefix: `${place?.name || 'Cultural archive'} records show`,
      };
    }
    const scene = this.getDisplaySceneContext()?.scene || this.getCurrentScene();
    const sceneKey = this.getDisplaySceneContext()?.sceneKey || this.getCurrentSceneKey();
    const sceneCustomLocation = (scene?.customLocations || []).find(loc => loc.id === locationId);
    if (sceneCustomLocation) {
      const discoveryState = this._getLocationDiscoveryState(sceneKey, scene, locationId);
      const isAnonymous = discoveryState === 'anonymous';
      return {
        emoji: isAnonymous ? (sceneCustomLocation.anonymousEmoji || '❓') : (sceneCustomLocation.emoji || '🧩'),
        prefix: isAnonymous
          ? (sceneCustomLocation.anonymousName || 'Unknown lead')
          : (sceneCustomLocation.prefix || `${sceneCustomLocation.name || 'Scene puzzle'} indicates`),
      };
    }
    const location = LOCATIONS.find(item => item.id === locationId);
    const informant = location?.informants?.[0];
    return informant || { emoji: location?.emoji || '🔎', prefix: location?.name || 'Field office' };
  }

  investigate(locationId) {
    const displayContext = this.getDisplaySceneContext();
    if (this.currentFieldLocation?.kind && this.currentFieldLocation.kind !== 'scene' && !displayContext) return null;
    const scene = displayContext?.scene || this.getCurrentScene();
    const fieldLocation = this.currentFieldLocation || {};
    const key = displayContext?.sceneKey || this.getCurrentSceneKey();

    const customLocation = (scene.customLocations || []).find(loc => loc.id === locationId);
    if (customLocation && this._sceneHasLockedCustomLocations(scene) && !this._isCustomLocationUnlocked(key, locationId)) {
      const requiredImage = this._findUnlockingImage(scene, locationId);
      return {
        blocked: true,
        locationId,
        customLocation,
        requiredImageId: requiredImage?.id || null,
        requiredImageTitle: requiredImage?.title || '',
      };
    }

    const investigated = this.investigatedByScene.get(key) || new Set();
    if (investigated.has(locationId)) {
      const staleEvidence = this.evidence.find(e =>
        e.locationId === locationId && e.staleAvailable && e.staleUpgrade
      );
      if (staleEvidence) {
        this._consumeStale(staleEvidence);
        this._applyClueMarksStale(scene, staleEvidence);
        this._applyCulturalCorroboration(scene);
        const progress = displayContext?.isCurrentAuthored ? this.progressSceneIfReady() : { type: 'scene_pending' };
        return { evidence: staleEvidence, progress, restale: true };
      }
      return null;
    }
    investigated.add(locationId);
    this.investigatedByScene.set(key, investigated);

    let clue = (scene.clues || []).find(item => item.locationId === locationId && !this.evidence.some(e => e.id === item.id));
    if (!clue && fieldLocation.country && fieldLocation.country !== this.currentRouteStop.country) {
      clue = (scene.followups || []).find(item =>
        item.afterCountry === fieldLocation.country &&
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
    const isPreliminary = !customLocation && this._sceneHasLockedCustomLocations(scene) && clue.category !== 'Puzzle Evidence';
    const evidence = {
      ...clue,
      legIndex: this.currentLeg,
      sceneIndex: this.currentSceneIndex,
      sceneId: scene.id,
      sceneTitle: scene.title || scene.scene || scene.city || '',
      fromCountry: this.currentRouteStop.country,
      targetCountry: this.targetRouteStop?.country || '',
      foundInCountry: fieldLocation.country || this.currentCountry,
      foundInCity: fieldLocation.city || scene.city || this.currentRouteStop?.city || this.currentCountry,
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
      this._applyClueMarksStale(scene, clue);
    }
    this._applyCulturalCorroboration(scene);

    const progress = displayContext?.isCurrentAuthored ? this.progressSceneIfReady() : { type: 'scene_pending' };
    return { evidence, progress };
  }

  _sceneHasLockedCustomLocations(scene) {
    return (scene.evidenceImages || []).some(img => Array.isArray(img.hotspots) || img.puzzle);
  }

  _isCustomLocationUnlocked(sceneKey, locationId) {
    const set = this.unlockedLocationsByScene.get(sceneKey);
    return !!(set && set.has(locationId));
  }

  _markCustomLocationUnlocked(sceneKey, locationId) {
    const set = this.unlockedLocationsByScene.get(sceneKey) || new Set();
    set.add(locationId);
    this.unlockedLocationsByScene.set(sceneKey, set);
  }

  _ensureSceneDiscovery(sceneKey, scene) {
    if (!this.revealedLocationsByScene.has(sceneKey)) {
      const revealed = new Set();
      for (const loc of (scene?.customLocations || [])) {
        const state = loc.discoveryState || 'revealed';
        if (state === 'revealed') revealed.add(loc.id);
      }
      this.revealedLocationsByScene.set(sceneKey, revealed);
    }
    if (!this.discoveredImagesByScene.has(sceneKey)) {
      const discovered = new Set();
      for (const img of (scene?.evidenceImages || [])) {
        const state = img.imageDiscoveryState || 'discovered';
        if (state === 'discovered') discovered.add(img.id);
      }
      this.discoveredImagesByScene.set(sceneKey, discovered);
    }
  }

  _getLocationDiscoveryState(sceneKey, scene, locationId) {
    this._ensureSceneDiscovery(sceneKey, scene);
    if (this.revealedLocationsByScene.get(sceneKey)?.has(locationId)) return 'revealed';
    const loc = (scene?.customLocations || []).find(l => l.id === locationId);
    return loc?.discoveryState || 'revealed';
  }

  _isImageDiscovered(sceneKey, scene, imageId) {
    this._ensureSceneDiscovery(sceneKey, scene);
    return this.discoveredImagesByScene.get(sceneKey)?.has(imageId) || false;
  }

  _revealCustomLocation(sceneKey, locationId) {
    const scene = this.getDisplaySceneContext()?.scene || this.getCurrentScene();
    this._ensureSceneDiscovery(sceneKey, scene);
    const set = this.revealedLocationsByScene.get(sceneKey);
    if (set && !set.has(locationId)) {
      set.add(locationId);
      return true;
    }
    return false;
  }

  _discoverImage(sceneKey, imageId) {
    const scene = this.getDisplaySceneContext()?.scene || this.getCurrentScene();
    this._ensureSceneDiscovery(sceneKey, scene);
    const set = this.discoveredImagesByScene.get(sceneKey);
    if (set && !set.has(imageId)) {
      set.add(imageId);
      return true;
    }
    return false;
  }

  _findUnlockingImage(scene, locationId) {
    return (scene.evidenceImages || []).find(image => {
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
    const key = this.getDisplaySceneContext()?.sceneKey || this.getCurrentSceneKey();
    return new Set(this.unlockedLocationsByScene.get(key) || []);
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
    const scene = this.getDisplaySceneContext()?.scene || this.getCurrentScene();
    const image = (scene.evidenceImages || []).find(item => item.id === imageId);
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
    const sceneKey = this.getDisplaySceneContext()?.sceneKey || this.getCurrentSceneKey();
    const unlockedLocationIds = [];
    const revealedLocationIds = [];
    const discoveredImageIds = [];
    const staledClueIds = [];
    for (const id of (hotspot.unlocks || [])) {
      this._markCustomLocationUnlocked(sceneKey, id);
      unlockedLocationIds.push(id);
    }
    for (const id of (hotspot.reveals || [])) {
      if (this._revealCustomLocation(sceneKey, id)) revealedLocationIds.push(id);
    }
    for (const id of (hotspot.discoversImages || [])) {
      if (this._discoverImage(sceneKey, id)) discoveredImageIds.push(id);
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
    const scene = this.getDisplaySceneContext()?.scene || this.getCurrentScene();
    const image = (scene.evidenceImages || []).find(item => item.id === imageId);
    if (!image || !image.puzzle) return { result: 'unknown_puzzle' };
    const sceneKey = this.getDisplaySceneContext()?.sceneKey || this.getCurrentSceneKey();
    if (image.puzzle.type === 'seal-cipher') {
      return this._solveSealCipher(image, attempt, sceneKey);
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
      this._markCustomLocationUnlocked(sceneKey, id);
      unlockedLocationIds.push(id);
    }
    for (const id of (image.puzzle.marksStale || [])) {
      if (this._markEvidenceStale(id)) staledClueIds.push(id);
    }
    return { result: 'solved', unlockedLocationIds, staledClueIds };
  }

  _solveSealCipher(image, attempt, sceneKey) {
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
        this._markCustomLocationUnlocked(sceneKey, id);
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

  _applyClueMarksStale(scene, clueOrEvidence) {
    if (!clueOrEvidence) return;
    const clueRef = (scene?.clues || []).find(c => c.id === clueOrEvidence.id);
    const marksStale = clueRef?.marksStale || clueOrEvidence.marksStale || [];
    for (const id of marksStale) {
      this._markEvidenceStale(id);
    }
  }

  _applyCulturalCorroboration(scene) {
    const requires = scene?.culturalCorroborationRequires || [];
    if (!requires.length) return;
    const allCorroborated = requires.every(id =>
      this.evidence.some(e => e.id === id && e.corroborated)
    );
    if (!allCorroborated) return;
    for (const id of (scene.culturalCorroborationStales || [])) {
      this._markEvidenceStale(id);
    }
  }

  scenePuzzleRequired(scene = this.getCurrentScene()) {
    return (scene?.evidenceImages || []).some(img => !!img.puzzle);
  }

  scenePuzzleSolved(scene = this.getCurrentScene()) {
    if (!this.scenePuzzleRequired(scene)) return true;
    return (scene.evidenceImages || []).some(img => img.puzzle && this.imageObservations.get(img.id)?.puzzleSolved);
  }

  progressSceneIfReady() {
    if (!this.isCurrentSceneReady()) return { type: 'scene_pending' };
    const currentScene = this.getCurrentScene();
    if (this.getNextScene()) {
      this.completedSceneKeys.push(this.getCurrentSceneKey());
      this.currentSceneIndex += 1;
      this._setFieldLocation(this._buildFieldStopFromScene(this.getCurrentScene(), 'scene'));
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
    const displayContext = this.getDisplaySceneContext();
    if (this.currentFieldLocation?.kind && this.currentFieldLocation.kind !== 'scene' && !displayContext) return [];
    const scene = displayContext?.scene || this.getCurrentScene();
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
        ? 'Current scene. Finish the local chapter before moving the case onward.'
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
    const currentScene = this.getCurrentScene();
    const hasRoute = activeEvidence.some(item => item.category === 'Route Evidence' && item.corroborated !== false);
    const hasCulture = activeEvidence.some(item => item.category === 'Cultural Evidence' && item.corroborated !== false);
    const hasConfirmation = activeEvidence.some(item => item.category === 'Confirmation' && item.corroborated !== false);
    const hasPuzzleEvidence = activeEvidence.some(item => item.category === 'Puzzle Evidence' && item.corroborated !== false);
    const sceneRequiresPuzzleImage = this.scenePuzzleRequired(currentScene);
    const sceneHasLockedLocations = this._sceneHasLockedCustomLocations(currentScene);
    const requirePuzzle = sceneHasLockedLocations
      ? sceneRequiresPuzzleImage
      : (!!currentScene.requirePuzzle || (currentScene.clues || []).some(item => item.category === 'Puzzle Evidence'));
    const puzzleSolved = sceneHasLockedLocations
      ? this.scenePuzzleSolved(currentScene)
      : (!requirePuzzle || hasPuzzleEvidence);
    const strongCandidateCount = this.analyzeCandidates().filter(item => item.state === 'strong').length;
    const corroboratedCount = activeEvidence.filter(item => item.corroborated !== false).length;
    return {
      leadFound: activeEvidence.length > 0,
      patternSupported: hasCulture,
      contradictionsChecked: activeEvidence.some(item => (item.tags || []).some(tag => tag.startsWith('exclude:'))),
      destinationLikely: strongCandidateCount <= 3 && corroboratedCount >= 3,
      evidenceReady: hasRoute && hasCulture && hasConfirmation && (!requirePuzzle || puzzleSolved) && corroboratedCount >= Math.max(REQUIRED_PROOF_CARDS, currentScene.minimumEvidence || 0),
      puzzleSolved,
    };
  }

  isCurrentSceneReady() {
    return this.getConfidence().evidenceReady;
  }

  canSubmitProof(country) {
    const confidence = this.getConfidence();
    return country === this.targetRouteStop?.country && confidence.evidenceReady && !this.getNextScene();
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
    const baseFieldStop = this._buildFieldStopFromScene({
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
      this.deadEnds.push({ legIndex: this.currentLeg, country, city, explanation, kind: 'wrong_city' });
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
    if (revisitedSceneContext && revisitedSceneContext.stopIndex <= this.currentLeg && country !== target.country) {
      const explanation = revisitedSceneContext.isCurrentAuthored
        ? 'ACME returns to the active scene. The remaining clues can still be gathered here before the chapter moves on.'
        : 'ACME reopens the earlier scene. New evidence may unlock if the latest lead gives you a better question to ask.';
      const fieldStop = this._buildFieldStopFromScene(
        revisitedSceneContext.scene,
        revisitedSceneContext.isCurrentAuthored ? 'scene' : 'revisited',
        {
          explanation,
          legIndex: revisitedSceneContext.stopIndex,
          sceneIndex: revisitedSceneContext.sceneIndex,
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
      this.deadEnds.push({ legIndex: this.currentLeg, country, city: fieldStop.city, explanation, kind: 'dead_end_country' });
      return { type: 'dead_end', from, country, city: fieldStop.city, fieldStop, explanation };
    }
    if (!this.canSubmitProof(country)) {
      const explanation = this.getNextScene()
        ? 'The country fits, but ACME still needs the remaining local scenes solved before the chapter can move onward.'
        : 'The destination fits, but ACME will not advance the case until route, cultural, confirmation, and puzzle evidence are all on the board.';
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
    this.currentLeg++;
    this.currentSceneIndex = 0;
    this.currentCountry = country;
    this._setFieldLocation(this._buildFieldStopFromScene(this.getCurrentScene(), 'scene'));
    const solved = this.currentLeg >= this.totalLegs;
    if (solved) this.finalSolved = true;
    return {
      type: solved ? 'case_ready' : 'advanced',
      from,
      country,
      city: city || target.city || '',
      next: this.targetRouteStop,
      scene: this.currentRouteStop,
      currentScene: this.getCurrentScene(),
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
      currentScene: this.getCurrentScene(),
      displayScene: displayContext?.scene || null,
      currentWorks: this.getCurrentWorks(),
      sceneActions: this.getSceneActions(),
      sceneEvidenceImages: this.getSceneEvidenceImages(),
      artifactPanel: this.getCurrentArtifactPanel(),
      localTrail: this.getLocalTrailState(),
      completedSceneKeys: [...this.completedSceneKeys],
      currentFieldLocation: this.getCurrentFieldLocation(),
      unlockedCustomLocations: this.getUnlockedCustomLocations(),
      revealedCustomLocations: this.getRevealedCustomLocations(),
      discoveredEvidenceImages: this.getDiscoveredEvidenceImages(),
      imageObservations: observations,
    };
  }

  getRevealedCustomLocations() {
    const displayContext = this.getDisplaySceneContext();
    const sceneKey = displayContext?.sceneKey || this.getCurrentSceneKey();
    const scene = displayContext?.scene || this.getCurrentScene();
    this._ensureSceneDiscovery(sceneKey, scene);
    return new Set(this.revealedLocationsByScene.get(sceneKey) || []);
  }

  getDiscoveredEvidenceImages() {
    const displayContext = this.getDisplaySceneContext();
    const sceneKey = displayContext?.sceneKey || this.getCurrentSceneKey();
    const scene = displayContext?.scene || this.getCurrentScene();
    this._ensureSceneDiscovery(sceneKey, scene);
    return new Set(this.discoveredImagesByScene.get(sceneKey) || []);
  }

  getStatusBarState() {
    const current = this.getProgress();
    const confidence = this.getConfidence();
    const currentScene = this.getCurrentScene();
    const routeRequired = true;
    const cultureRequired = true;
    const confirmationRequired = true;
    const puzzleRequired = !!currentScene.requirePuzzle || (currentScene.clues || []).some(item => item.category === 'Puzzle Evidence');
    const city = current.city || currentScene.city || '';
    const country = current.country || this.currentCountry || '';
    const samePlace = normalize(city) && normalize(city) === normalize(country);
    const locationLabel = [city, samePlace ? '' : country].filter(Boolean).join(', ') || country || 'Current scene';

    return {
      locationLabel,
      evidenceGauge: [
        {
          id: 'route',
          label: 'Route',
          state: routeRequired && confidence.leadFound && this.getActiveEvidence().some(item => item.category === 'Route Evidence')
            ? 'complete'
            : 'incomplete',
        },
        {
          id: 'culture',
          label: 'Culture',
          state: cultureRequired && confidence.patternSupported ? 'complete' : 'incomplete',
        },
        {
          id: 'confirmation',
          label: 'Confirm',
          state: confirmationRequired && this.getActiveEvidence().some(item => item.category === 'Confirmation')
            ? 'complete'
            : 'incomplete',
        },
        {
          id: 'puzzle',
          label: 'Puzzle',
          state: !puzzleRequired ? 'not_required' : confidence.puzzleSolved ? 'complete' : 'incomplete',
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
