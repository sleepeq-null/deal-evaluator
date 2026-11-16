// Run with: node test.js
const assert = require("assert");
const F = require("./finance.js");

const near = (a, b, tol = 1e-4) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

// NPV: -1000 + 500/1.1 + 600/1.21 = -1000 + 454.545 + 495.868 = -49.587
near(F.npv(0.1, [-1000, 500, 600]), -49.5868, 1e-3);

// IRR: -100, +110 => 10%
near(F.irr([-100, 110]), 0.1);
// IRR textbook: -1000, 400, 400, 400 => ~9.7010%
near(F.irr([-1000, 400, 400, 400]), 0.097010, 1e-5);
// No sign change => null
assert.strictEqual(F.irr([100, 100]), null);

// Payback: -1000, 400, 400, 400 => 2.5 years
near(F.payback([-1000, 400, 400, 400]), 2.5);
assert.strictEqual(F.payback([-1000, 100, 100]), null);

// buildFlows with growth and exit
const flows = F.buildFlows({ investment: 1000, year1: 100, growth: 0.1, years: 3, exitValue: 500 });
assert.deepStrictEqual(flows.map((f) => +f.toFixed(6)), [-1000, 100, 110, 621]);

// evaluate
const r = F.evaluate({ investment: 1000, year1: 400, growth: 0, years: 3, exitValue: 0, discountRate: 0.08 });
near(r.moic, 1.2);
near(r.roi, 0.2);
assert.ok(r.npv > 0 && r.irr > 0.08);

// score: strong deal -> Pursue, terrible deal -> Pass
const crit = (rating) => [{ weight: 1, rating }, { weight: 1, rating: 6 - rating, invert: true }];
const good = F.evaluate({ investment: 1000, year1: 500, growth: 0, years: 5, exitValue: 0, discountRate: 0.1 });
assert.strictEqual(F.score(good, { discountRate: 0.1 }, crit(5)).verdict, "Pursue");
const bad = F.evaluate({ investment: 1000, year1: 100, growth: 0, years: 3, exitValue: 0, discountRate: 0.1 });
assert.strictEqual(F.score(bad, { discountRate: 0.1 }, crit(1)).verdict, "Pass");

console.log("All tests passed.");
