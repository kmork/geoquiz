/**
 * Carmen image asset paths — single source of truth.
 *
 * All `carmen/img/` references should go through this module.
 */

export const IMG = {
  carmenFront:       'carmen/img/carmen-front.png',
  skylineFront:      'carmen/img/skyline-syndicate.png',
  renaissanceFront:  'carmen/img/renaissance/detective-front.png',
  musicOn:           'carmen/img/music-icon.png',
  musicOff:          'carmen/img/music-off-icon.png',
  typewriter:        'carmen/img/typewriter.png',
  detectiveFull:     'carmen/img/detective-full.png',
  detectiveArresting:'carmen/img/detective-arresting.png',
  carmenArrested:    'carmen/img/carmen-arrested-2.png',
  suspect: (name) => `carmen/img/${encodeURIComponent(name)}.png`,
};
