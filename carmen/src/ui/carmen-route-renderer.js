import { findGeoFeatures } from '../../../js/aliases.js';
import { RouteRenderer } from '../../../js/ui-components/route-renderer.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function callAll(entry, callback) {
  for (const el of entry.elements) callback(el);
}

export class CarmenRouteRenderer extends RouteRenderer {
  constructor(svgElement, worldData, options = {}) {
    super(svgElement, worldData, options);
    this.airportByCountry = options.airportByCountry || {};
  }

  // Hook used by the base RouteRenderer.animateTravel() to draw Carmen planes
  // between capital-area airports instead of country centroids.
  getTravelPoint(countryName) {
    const airport = this.airportByCountry?.[countryName];
    const lat = Number(airport?.lat);
    const lon = Number(airport?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return this.getCentroid(countryName);
    }
    return this.proj([lon, lat]);
  }

  _projectedBBoxSize(feature) {
    const bb = this.bboxOfFeature(feature);
    if (!bb) return null;
    const [x1] = this.proj([bb.minLon, 0]);
    const [x2] = this.proj([bb.maxLon, 0]);
    const [, y1] = this.proj([0, bb.maxLat]);
    const [, y2] = this.proj([0, bb.minLat]);
    return {
      bb,
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
  }

  _isSmallChoice(feature, countryName) {
    const size = this._projectedBBoxSize(feature);
    if (!size) return true;

    const vb = this.svg.viewBox.baseVal;
    const visibleW = Math.max(vb.width || this.MAP_W, 1);
    const visibleH = Math.max(vb.height || this.MAP_H, 1);
    const visibleMin = Math.min(visibleW, visibleH);
    const maxByWidth = size.width / (countryName.length * 0.6);
    const fontSize = Math.min(maxByWidth, size.height * 0.22, 2.5);
    const shapeMax = Math.max(size.width, size.height);
    const shapeMin = Math.min(size.width, size.height);

    // Avoid labeling countries where the user should zoom in and click the
    // real geography instead of relying on an artificial marker.
    return shapeMax < visibleMin * 0.035 || (fontSize < 0.45 && shapeMin < visibleMin * 0.018);
  }

  _wireChoice(el, entry, countryName, onClick) {
    el.addEventListener('click', () => {
      if (!entry.disabled) onClick(countryName);
    });
    el.addEventListener('mouseenter', () => {
      if (!entry.disabled) this._setChoiceState(entry, 'hover');
    });
    el.addEventListener('mouseleave', () => {
      if (!entry.disabled) this._setChoiceState(entry, 'idle');
    });
  }

  _setChoiceState(entry, state) {
    const palette = {
      idle: {
        fill: 'rgba(148, 163, 184, 0.5)',
        stroke: 'rgba(148, 163, 184, 0.7)',
      },
      hover: {
        fill: 'rgba(148, 163, 184, 0.46)',
        stroke: 'rgba(148, 163, 184, 0.95)',
      },
      correct: {
        fill: 'rgba(34, 197, 94, 0.35)',
        stroke: 'rgba(34, 197, 94, 0.9)',
      },
      wrong: {
        fill: 'rgba(239, 68, 68, 0.35)',
        stroke: 'rgba(239, 68, 68, 0.9)',
      },
    }[state] || {};

    for (const path of entry.paths) {
      path.setAttribute('fill', palette.fill);
      path.setAttribute('stroke', palette.stroke);
    }
  }

  drawNeighborChoices(neighbors, onClick) {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', 'carmen-neighbor-choices');
    this.svg.appendChild(group);

    const btnMap = {};

    for (const name of neighbors) {
      const features = findGeoFeatures(this.worldFeatures, name);
      if (features.length === 0) continue;

      const entry = {
        paths: [],
        labels: [],
        elements: [],
        disabled: false,
      };

      for (const feature of features) {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', this.pathFromFeature(feature));
        path.setAttribute('fill', 'rgba(148, 163, 184, 0.2)');
        path.setAttribute('stroke', 'rgba(148, 163, 184, 0.6)');
        path.setAttribute('stroke-width', '1.2');
        path.setAttribute('vector-effect', 'non-scaling-stroke');
        path.setAttribute('cursor', 'pointer');
        path.setAttribute('class', 'carmen-map-choice');
        path.setAttribute('data-country', name);
        group.appendChild(path);
        entry.paths.push(path);
        entry.elements.push(path);
        this._wireChoice(path, entry, name, onClick);
      }

      const centroid = this.getCentroid(name);
      const primaryFeature = features[0];
      const smallChoice = primaryFeature ? this._isSmallChoice(primaryFeature, name) : true;

      if (centroid && primaryFeature && !smallChoice) {
        const size = this._projectedBBoxSize(primaryFeature);
        if (size) {
          const maxByWidth = size.width / (name.length * 0.6);
          const fontSize = Math.min(maxByWidth, size.height * 0.22, 2.5);
          const text = document.createElementNS(SVG_NS, 'text');
          text.setAttribute('x', centroid[0]);
          text.setAttribute('y', centroid[1]);
          text.setAttribute('text-anchor', 'middle');
          text.setAttribute('dominant-baseline', 'central');
          text.setAttribute('font-size', fontSize);
          text.setAttribute('class', 'carmen-map-label');
          text.setAttribute('pointer-events', 'none');
          text.textContent = name;
          group.appendChild(text);
          entry.labels.push(text);
        }
      }

      btnMap[name] = entry;
    }

    return {
      highlight: (country, correct) => {
        const entry = btnMap[country];
        if (!entry) return;
        this._setChoiceState(entry, correct ? 'correct' : 'wrong');
        callAll(entry, el => el.setAttribute?.('cursor', 'default'));
        entry.disabled = true;
      },
      disableAll: () => {
        for (const entry of Object.values(btnMap)) {
          entry.disabled = true;
          callAll(entry, el => el.setAttribute?.('cursor', 'default'));
        }
      },
      remove: () => {
        group.remove();
      },
    };
  }

  drawWorldCandidates(candidates, onClick, options = {}) {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', 'carmen-world-candidates');
    this.svg.appendChild(group);

    const palette = {
      unknown: { fill: 'rgba(148, 163, 184, 0.08)', stroke: 'rgba(148, 163, 184, 0.24)', strokeWidth: '0.95' },
      partial: { fill: 'rgba(245, 158, 11, 0.14)', stroke: 'rgba(245, 158, 11, 0.34)', strokeWidth: '0.95' },
      pattern: { fill: 'rgba(168, 85, 247, 0.14)', stroke: 'rgba(168, 85, 247, 0.42)', strokeWidth: '1.05' },
      strong: { fill: 'rgba(34, 197, 94, 0.16)', stroke: 'rgba(74, 222, 128, 0.62)', strokeWidth: '1.2' },
      contradicted: { fill: 'rgba(239, 68, 68, 0.03)', stroke: 'rgba(248, 113, 113, 0.32)', strokeWidth: '0.95' },
      current: { fill: 'rgba(251, 191, 36, 0.22)', stroke: 'rgba(251, 191, 36, 0.92)', strokeWidth: '1.45' },
      selected: { fill: 'rgba(59, 130, 246, 0.24)', stroke: 'rgba(96, 165, 250, 0.9)', strokeWidth: '1.5' },
    };
    const candidateByCountry = Object.fromEntries((candidates || []).map(item => [item.country, item]));
    const hintsEnabled = options.hintsEnabled !== false;
    let selectedCountry = options.selectedCountry || '';
    const entriesByCountry = new Map();

    const getColorForCandidate = (candidate) => {
      const baseColor = hintsEnabled ? (palette[candidate.state] || palette.unknown) : palette.unknown;
      return candidate.country === selectedCountry ? palette.selected : baseColor;
    };

    const applyEntryColor = (entry) => {
      if (!entry) return;
      const color = getColorForCandidate(entry.candidate);
      for (const path of entry.paths) {
        path.setAttribute('fill', color.fill);
        path.setAttribute('stroke', color.stroke);
        path.setAttribute('stroke-width', color.strokeWidth || '1');
      }
    };

    for (const candidate of candidates || []) {
      const features = findGeoFeatures(this.worldFeatures, candidate.country);
      if (!features.length) continue;
      const entry = { candidate, paths: [] };
      entriesByCountry.set(candidate.country, entry);
      const color = getColorForCandidate(candidate);
      for (const feature of features) {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', this.pathFromFeature(feature));
        path.setAttribute('fill', color.fill);
        path.setAttribute('stroke', color.stroke);
        path.setAttribute('stroke-width', color.strokeWidth || '1');
        path.setAttribute('vector-effect', 'non-scaling-stroke');
        path.setAttribute('cursor', 'pointer');
        path.setAttribute('class', `carmen-world-map-candidate ${candidate.state}`);
        path.setAttribute('data-country', candidate.country);
        path.setAttribute('aria-label', candidate.country);
        if (candidate.hintSummary) {
          path.setAttribute('title', `${candidate.country}: ${candidate.hintSummary}`);
        } else {
          path.setAttribute('title', candidate.country);
        }
        path.addEventListener('mouseenter', () => {
          path.setAttribute('fill', 'rgba(203, 213, 225, 0.24)');
          path.setAttribute('stroke', 'rgba(226, 232, 240, 0.52)');
        });
        path.addEventListener('mouseleave', () => {
          applyEntryColor(entry);
        });
        path.addEventListener('click', () => onClick?.(candidate.country, candidateByCountry[candidate.country]));
        group.appendChild(path);
        entry.paths.push(path);
      }
    }

    return {
      setSelected: (country = '') => {
        selectedCountry = country || '';
        for (const entry of entriesByCountry.values()) applyEntryColor(entry);
      },
      remove: () => group.remove(),
    };
  }
}
