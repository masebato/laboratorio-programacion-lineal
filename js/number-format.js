/*
 * number-format.js
 * Presenta valores numéricos como fracciones o decimales.
 */
(function () {
  function asFraction(value) {
    const sign = value < 0 ? '-' : '';
    const positiveValue = Math.abs(value);
    let remainder = positiveValue;
    let previousNumerator = 0;
    let numerator = 1;
    let previousDenominator = 1;
    let denominator = 0;

    for (let iteration = 0; iteration < 32; iteration += 1) {
      const wholePart = Math.floor(remainder);
      const nextNumerator = wholePart * numerator + previousNumerator;
      const nextDenominator = wholePart * denominator + previousDenominator;

      if (nextDenominator > 100000) break;
      if (Math.abs(positiveValue - nextNumerator / nextDenominator) < 1e-9) {
        return sign + (nextDenominator === 1
          ? String(nextNumerator)
          : `${nextNumerator}/${nextDenominator}`);
      }

      previousNumerator = numerator;
      numerator = nextNumerator;
      previousDenominator = denominator;
      denominator = nextDenominator;

      const fractionalPart = remainder - wholePart;
      if (fractionalPart < 1e-14) break;
      remainder = 1 / fractionalPart;
    }

    return sign + positiveValue.toFixed(3).replace(/\.?0+$/, '');
  }

  function formatNumber(value) {
    if (Math.abs(value) < 1e-9) return '0';
    const formatChoice = document.querySelector('#number-format')?.value || 'fraction';
    if (formatChoice === 'fraction') return asFraction(value);
    return Number(value.toFixed(3)).toString();
  }

  window.ModelNumberFormat = { formatNumber };
})();

