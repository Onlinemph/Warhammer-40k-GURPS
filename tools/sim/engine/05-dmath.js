  // ------------------------------------------------------------------ deterministic maths
  // A replay is the seed plus the engine, re-run in whatever browser opens it, so every number that can change
  // what happens must come out bit for bit the same in every JavaScript engine. + - * / and Math.sqrt are
  // correctly rounded by the standard, so they are; Math.sin, exp, log, pow, atan2 and hypot are only
  // approximations, and engines differ in the last bit. The engine uses these instead (test/rules.test.js fails
  // if it calls one of those Math functions directly).
  const SQRT3 = Math.sqrt(3), SQRT2 = Math.sqrt(2), LN2 = 0.6931471805599453, TAU = 6.283185307179586;
  // x to a whole power by repeated multiplication
  function powi(x, n) { let r = 1; for (let i = 0; i < n; i++) r *= x; return r; }
  // 2 to a power in half steps (Enhanced Move comes in halves)
  const pow2h = L => { const w = Math.floor(L); return powi(2, w) * (L - w >= 0.5 ? SQRT2 : 1); };
  // floor(log2(n)) for n >= 1, by halving
  function ilog2(n) { let k = 0; n = Math.floor(n); while (n >= 2) { n = Math.floor(n / 2); k++; } return k; }
  const hyp = (x, y) => Math.sqrt(x * x + y * y);
  // e^x: x = k ln2 + r with |r| <= ln2/2, a Taylor series for e^r (ample terms for doubles), times 2^k
  function dexp(x) {
    if (x > 700) return Infinity; if (x < -700) return 0;
    const k = Math.round(x / LN2), r = x - k * LN2;
    let term = 1, sum = 1;
    for (let i = 1; i < 22; i++) { term = term * r / i; sum += term; }
    return k >= 0 ? sum * powi(2, k) : sum / powi(2, -k);
  }
  // sin x: reduced to [-pi, pi], then a Taylor series
  function dsin(x) {
    x = x - TAU * Math.round(x / TAU);
    let term = x, sum = x;
    for (let i = 1; i < 14; i++) { term = -term * x * x / ((2 * i) * (2 * i + 1)); sum += term; }
    return sum;
  }
  // ln x for x > 0: halve or double into [1, 2), then 2 atanh((m-1)/(m+1)) as a series
  function dlog(x) {
    if (!(x > 0)) return x === 0 ? -Infinity : NaN;
    let k = 0;
    while (x >= 2) { x /= 2; k++; }
    while (x < 1) { x *= 2; k--; }
    const t = (x - 1) / (x + 1), t2 = t * t;
    let term = t, sum = t;
    for (let i = 1; i < 40; i++) { term *= t2; sum += term / (2 * i + 1); }
    return 2 * sum + k * LN2;
  }
  // x^y for x >= 0: a whole power by multiplication, the fraction by dexp(f ln x)
  function dpow(x, y) {
    if (y === Math.floor(y) && y >= 0) return powi(x, y);
    if (x === 0) return y > 0 ? 0 : Infinity;
    const w = Math.floor(y), f = y - w, base = w >= 0 ? powi(x, w) : 1 / powi(x, -w);
    return f ? base * dexp(f * dlog(x)) : base;
  }
