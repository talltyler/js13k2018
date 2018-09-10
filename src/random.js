let seed = 0;

/**
 * Set random seed value.
 *
 * @param  {int} [value]
 * @api public
 */
export function setSeed (value) {
  seed = value;
}

/**
 * Return a float within [0.0, 1.0).
 *
 * @param  {number} [max]
 * @return {float}
 * @api public
 */
export function random (max=1) {
  let x = Math.sin(.8765111159592828 + seed++) * 1e4
  return (x - Math.floor(x)) * max;
}

/**
 * Return an integer within [0, max).
 *
 * @param  {number} [max]
 * @return {int}
 * @api public
 */
export function int(max) {
  return random(max || 0xfffffff) | 0;
}

/**
 * Return a boolean.
 *
 * @return {Boolean}
 * @api public
 */
export function bool () {
  return random() > 0.5;
}

/**
 * Return an integer within [min, max).
 *
 * @param  {int} min
 * @param  {int} max
 * @return {int}
 * @api public
 */
export function rangeInt (min, max) {
  return int(max - min) + min;
}

export function range (min, max) {
  return random(max - min) + min;
}

/**
 * Pick an element from the source.
 *
 * @param  {mixed[]} source
 * @return {mixed}
 * @api public
 */
export function pick (source) {
  return source[range(0, source.length)];
}


export function rnd(max) {
  return Math.floor(random(max + 1));
}
