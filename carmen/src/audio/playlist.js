/**
 * Audio asset paths — single source of truth for every audio file used by Carmen.
 *
 * Pure data, no playback logic. The audio engine imports from here.
 */

export const BGM_TRACKS = [
  'carmen/audio/Alley Thoughts.mp3',
  'carmen/audio/Ashtray Alibi 2.mp3',
  'carmen/audio/Ashtray Alibi.mp3',
  'carmen/audio/Bass Walker.mp3',
  'carmen/audio/Black Coffee Stakeout.mp3',
  'carmen/audio/Broken Casefiles 2.mp3',
  'carmen/audio/Broken Casefiles.mp3',
  'carmen/audio/Case Soda Pop.mp3',
  'carmen/audio/Casefile Chrome.mp3',
  'carmen/audio/Cigar Ashes 2.mp3',
  'carmen/audio/Cigar Ashes.mp3',
  'carmen/audio/Coal-Lit Case.mp3',
  'carmen/audio/Cobalt Alibi 2.mp3',
  'carmen/audio/Cobalt Alibi.mp3',
  'carmen/audio/Cool Vibes.mp3',
  'carmen/audio/Covert Affair.mp3',
  'carmen/audio/Fallen Petals.mp3',
  'carmen/audio/Just As Soon.mp3',
  'carmen/audio/Lacquered Alibi 2.mp3',
  'carmen/audio/Lacquered Alibi.mp3',
  'carmen/audio/Night Walk In Paris.mp3',
  'carmen/audio/Night Walk Interlude.mp3',
  'carmen/audio/Noir Alley.mp3',
  'carmen/audio/Signs To Nowhere.mp3',
  'carmen/audio/Smoldered Alibis.mp3',
  'carmen/audio/Tin Stethoscope 2.mp3',
  'carmen/audio/Tin Stethoscope.mp3',
];

export const SPECIAL_TRACKS = {
  lineup:   'carmen/audio/Pressure at 3AM.mp3',
  victory:  'carmen/audio/Catching The Thief.mp3',
  fail:     'carmen/audio/Midnight Impulse.mp3',
  narrator: 'carmen/audio/narrator - intro.mp3',
  clock:    'carmen/audio/clock-ticking.mp3',
};

export const AMBIENT_SOUNDS = {
  airport:   'carmen/audio/airport-terminal.mp3',
  market:    'carmen/audio/market-area.mp3',
  hotel:     'carmen/audio/hotel-bell.mp3',
  taxi:      'carmen/audio/taxi.mp3',
  airplane:  'carmen/audio/airplane.mp3',
  footsteps: 'carmen/audio/footsteps.mp3',
  rain1:     'carmen/audio/rain1.mp3',
  rain2:     'carmen/audio/rain2.mp3',
  siren1:    'carmen/audio/siren1.mp3',
  siren2:    'carmen/audio/siren2.mp3',
};
