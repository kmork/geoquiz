/**
 * Portrait presentation metadata for suspect art.
 *
 * These values control how portraits are framed inside Carmen UI surfaces.
 * The goal is to keep asset cleanup decisions out of ui.js so portrait
 * replacement can happen independently of layout code.
 */

const DEFAULT_PORTRAIT_STYLE = {
  scaleX: 1,
  scaleY: 1,
  x: '0%',
  y: '0%',
};

const PORTRAIT_STYLES = {};

export function getPortraitStyleVars(name) {
  const style = PORTRAIT_STYLES[name] || DEFAULT_PORTRAIT_STYLE;
  return [
    `--portrait-scale-x:${style.scaleX}`,
    `--portrait-scale-y:${style.scaleY}`,
    `--portrait-offset-x:${style.x}`,
    `--portrait-offset-y:${style.y}`,
  ].join(';');
}
