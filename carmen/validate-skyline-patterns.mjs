import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CarmenGameLogic } from './src/core/game-logic.js';
import {
  CapitalFlightRouteProvider,
  CASE_PATTERN_TYPES,
} from './src/campaigns/skyline-syndicate/flight-route-provider.js';
import { buildSkylineFinalManifestProof } from './src/campaigns/skyline-syndicate/final-manifest-proof.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const runsPerCase = Number.parseInt(process.argv[2] || '50', 10);

async function readJson(path) {
  return JSON.parse(await readFile(resolve(repoRoot, path), 'utf8'));
}

function casePhase(caseNumber) {
  if (caseNumber >= 10) return 'finale';
  if (caseNumber >= 7) return 'pursuit';
  if (caseNumber >= 4) return 'whispers';
  return 'prelude';
}

function buildLogic({ caseNumber, countries, facts, heritageSites, routeProvider }) {
  const phase = casePhase(caseNumber);
  return new CarmenGameLogic({
    countries,
    facts,
    heritageSites,
    rivers: [],
    mountains: [],
    empires: [],
    caseNumber,
    totalCases: 10,
    mode: 'skyline_syndicate',
    phaseOverride: phase,
    configPhase: phase,
    routeProvider,
  });
}

function validateRun({ logic, caseNumber, runNumber }) {
  logic.start();

  const expectedStops = logic.diff.stops + 1;
  const expectedPattern = CASE_PATTERN_TYPES[caseNumber];
  const actualPatterns = logic.routePatterns.map(pattern => pattern.id);
  const errors = [];

  if (logic.route.length < expectedStops) {
    errors.push({
      type: 'short-route',
      routeLength: logic.route.length,
      expectedStops,
      route: logic.route,
    });
  }

  if (!logic.routePatterns.length) {
    errors.push({
      type: 'missing-pattern',
      route: logic.route,
    });
  }

  if (expectedPattern && !actualPatterns.includes(expectedPattern)) {
    errors.push({
      type: 'missing-assigned-pattern',
      expectedPattern,
      actualPatterns,
      route: logic.route,
    });
  }

  if (caseNumber === 10 && !errors.length) {
    try {
      const proof = buildSkylineFinalManifestProof(logic);
      const correctCount = proof.candidates.filter(candidate => candidate.correct).length;
      const redactedCount = proof.segments.filter(segment => segment.redacted).length;
      const candidateKeys = new Set(proof.candidates.map(candidate => candidate.key));

      if (redactedCount !== 1) {
        errors.push({
          type: 'invalid-final-proof-redaction',
          redactedCount,
          route: logic.route,
        });
      }

      if (proof.candidates.length !== 3 || correctCount !== 1 || candidateKeys.size !== 3) {
        errors.push({
          type: 'invalid-final-proof-candidates',
          candidateCount: proof.candidates.length,
          correctCount,
          uniqueCandidateCount: candidateKeys.size,
          route: logic.route,
        });
      }
    } catch (error) {
      errors.push({
        type: 'final-proof-build-failed',
        message: error.message,
        route: logic.route,
      });
    }
  }

  return {
    caseNumber,
    runNumber,
    expectedPattern,
    actualPatterns,
    routeLength: logic.route.length,
    errors,
  };
}

async function main() {
  if (!Number.isInteger(runsPerCase) || runsPerCase < 1) {
    throw new Error('Usage: node carmen/validate-skyline-patterns.mjs [runsPerCase]');
  }

  const [countries, facts, heritageSites, routeData] = await Promise.all([
    readJson('data/countries.json'),
    readJson('data/country-facts.json'),
    readJson('data/heritage-sites.json'),
    readJson('data/capital-flight-routes.json'),
  ]);
  const routeProvider = new CapitalFlightRouteProvider(routeData);
  const failures = [];

  for (let caseNumber = 1; caseNumber <= 10; caseNumber++) {
    const expectedPattern = CASE_PATTERN_TYPES[caseNumber];
    let matched = 0;

    for (let runNumber = 1; runNumber <= runsPerCase; runNumber++) {
      const logic = buildLogic({ caseNumber, countries, facts, heritageSites, routeProvider });
      const result = validateRun({ logic, caseNumber, runNumber });
      if (result.errors.length) {
        failures.push(result);
      } else {
        matched++;
      }
    }

    console.log(`Case ${caseNumber}: ${matched}/${runsPerCase} routes matched ${expectedPattern}`);
  }

  if (failures.length) {
    console.error(`\n${failures.length} Skyline pattern validation failure(s):`);
    console.error(JSON.stringify(failures.slice(0, 20), null, 2));
    if (failures.length > 20) console.error(`...and ${failures.length - 20} more`);
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
