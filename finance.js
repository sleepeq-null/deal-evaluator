/* Core deal-math. Works in the browser (window.Finance) and in Node (require). */
(function (root) {
  "use strict";

  /** Net present value. flows[0] is at t=0 (usually negative investment). rate is decimal. */
  function npv(rate, flows) {
    return flows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
  }

  /** Internal rate of return via bisection with Newton refinement. Returns null if none found. */
  function irr(flows) {
    const hasPos = flows.some((f) => f > 0);
    const hasNeg = flows.some((f) => f < 0);
    if (!hasPos || !hasNeg) return null;

    let lo = -0.9999, hi = 10;
    let fLo = npv(lo, flows), fHi = npv(hi, flows);
    if (fLo * fHi > 0) return null;

    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      const fMid = npv(mid, flows);
      if (Math.abs(fMid) < 1e-9 || hi - lo < 1e-10) return mid;
      if (fLo * fMid < 0) { hi = mid; fHi = fMid; } else { lo = mid; fLo = fMid; }
    }
    return (lo + hi) / 2;
  }

  /** Years until cumulative cash flow turns non-negative (interpolated). null if never. */
  function payback(flows, rate) {
    let cum = 0;
    for (let t = 0; t < flows.length; t++) {
      const cf = rate == null ? flows[t] : flows[t] / Math.pow(1 + rate, t);
      const prev = cum;
      cum += cf;
      if (t > 0 && prev < 0 && cum >= 0) return t - 1 + -prev / cf;
      if (t === 0 && cum >= 0) return 0;
    }
    return null;
  }

  /**
   * Build a cash-flow series from deal inputs.
   * investment: upfront cost (positive number), year1: first-year net cash flow,
   * growth: annual growth (decimal), years: holding period, exitValue: proceeds at final year.
   * customFlows: optional array of yearly flows that overrides year1/growth.
   */
  function buildFlows({ investment, year1, growth, years, exitValue, customFlows }) {
    const flows = [-Math.abs(investment || 0)];
    if (customFlows && customFlows.length) {
      customFlows.forEach((f) => flows.push(f));
    } else {
      for (let y = 1; y <= years; y++) flows.push(year1 * Math.pow(1 + growth, y - 1));
    }
    if (flows.length > 1) flows[flows.length - 1] += exitValue || 0;
    return flows;
  }

  function evaluate(inputs) {
    const flows = buildFlows(inputs);
    const rate = inputs.discountRate;
    const invested = -flows[0];
    const inflows = flows.slice(1).reduce((a, b) => a + b, 0);
    const pvInflows = npv(rate, [0].concat(flows.slice(1)));
    return {
      flows,
      npv: npv(rate, flows),
      irr: irr(flows),
      payback: payback(flows),
      discountedPayback: payback(flows, rate),
      roi: invested ? (inflows - invested) / invested : null,
      moic: invested ? inflows / invested : null,
      profitabilityIndex: invested ? pvInflows / invested : null,
    };
  }

  /** NPV grid across discount-rate deltas (rows) and cash-flow multipliers (cols). */
  function sensitivity(inputs, rateDeltas, flowDeltas) {
    return rateDeltas.map((dr) =>
      flowDeltas.map((df) => {
        const adj = Object.assign({}, inputs, {
          year1: inputs.year1 * (1 + df),
          exitValue: (inputs.exitValue || 0) * (1 + df),
          customFlows: inputs.customFlows && inputs.customFlows.map((f) => f * (1 + df)),
        });
        return npv(inputs.discountRate + dr, buildFlows(adj));
      })
    );
  }

  /**
   * Turn financial metrics + qualitative 1-5 ratings into a 0-100 score and verdict.
   * criteria: [{ weight, rating, invert }] — invert=true means higher rating is worse (e.g. risk).
   */
  function score(result, inputs, criteria) {
    // Financial sub-score (0-100)
    const hurdle = inputs.discountRate;
    let fin = 50;
    if (result.irr != null) fin += clamp((result.irr - hurdle) * 250, -35, 35);
    else fin -= 35;
    if (result.profitabilityIndex != null) fin += clamp((result.profitabilityIndex - 1) * 30, -15, 15);
    fin = clamp(fin, 0, 100);

    // Qualitative sub-score (0-100)
    const totalW = criteria.reduce((a, c) => a + c.weight, 0) || 1;
    const qual =
      criteria.reduce((a, c) => {
        const r = c.invert ? 6 - c.rating : c.rating;
        return a + ((r - 1) / 4) * c.weight;
      }, 0) / totalW * 100;

    const overall = Math.round(fin * 0.6 + qual * 0.4);
    let verdict, tone;
    if (result.npv < 0 && overall < 60) { verdict = "Pass"; tone = "bad"; }
    else if (overall >= 70 && result.npv >= 0) { verdict = "Pursue"; tone = "good"; }
    else if (overall >= 50) { verdict = "Negotiate"; tone = "warn"; }
    else { verdict = "Pass"; tone = "bad"; }
    return { financial: Math.round(fin), qualitative: Math.round(qual), overall, verdict, tone };
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  const api = { npv, irr, payback, buildFlows, evaluate, sensitivity, score };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Finance = api;
})(typeof window !== "undefined" ? window : globalThis);
