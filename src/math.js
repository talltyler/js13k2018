
export const pow = Math.pow;

export const sin = Math.sin;

export const exp = Math.exp;

export const abs = Math.abs;

export const PI = 3.1415;

export const LN2 = 0.6931;

export function sqr (x) {
  return x * x;
}

export function cube (x) {
  return x * x * x;
}

export function sign (x) {
  return x < 0 ? -1 : 1;
}

export function log (x, b) {
  return Math.log(x) / Math.log(b);
}

export function floor (x) {
  return x | 0;
}

// http://stackoverflow.com/questions/3096646/how-to-convert-a-floating-point-number-to-its-binary-representation-ieee-754-i
export function assembleFloat(sign, exponent, mantissa) {
  return (sign << 31) | (exponent << 23) | (mantissa);
}

export function floatToNumber(flt) {
  if (isNaN(flt)) // Special case: NaN
    return assembleFloat(0, 0xFF, 0x1337); // Mantissa is nonzero for NaN

  var sign = (flt < 0) ? 1 : 0;
  flt = abs(flt);
  if (flt == 0.0) // Special case: +-0
    return assembleFloat(sign, 0, 0);

  var exponent = floor(Math.log(flt) / LN2);
  if (exponent > 127 || exponent < -126) // Special case: +-Infinity (and huge numbers)
    return assembleFloat(sign, 0xFF, 0); // Mantissa is zero for +-Infinity

  var mantissa = flt / pow(2, exponent);
  return assembleFloat(sign, exponent + 127, (mantissa * pow(2, 23)) & 0x7FFFFF);
}

// http://stackoverflow.com/a/16001019
export function numberToFloat(bytes) {
    var sign = (bytes & 0x80000000) ? -1 : 1;
    var exponent = ((bytes >> 23) & 255) - 127;
    var significand = (bytes & ~(-1 << 23));

    if (exponent == 128)
        return sign * ((significand) ? NaN : Infinity);

    if (exponent == -127) {
        if (significand == 0) return sign * 0.0;
        exponent = -126;
        significand /= (1 << 22);
    } else significand = (significand | (1 << 23)) / (1 << 23);

    return sign * significand * pow(2, exponent);
}
