# Deal Evaluator

A zero-dependency web app for sanity-checking business deals — acquisitions, investments, partnerships, capex projects.

Enter the upfront cost, expected cash flows, holding period, exit value and your hurdle rate, then rate the soft factors. You get:

- **Financial metrics** — NPV, IRR, ROI, MOIC, profitability index, simple and discounted payback
- **Cash-flow chart** — yearly flows plus cumulative position
- **Sensitivity grid** — NPV across ±4% discount rate and ±30% cash-flow swings
- **Weighted scorecard** — strategic fit, market, team, moat, integration, risk
- **Verdict** — *Pursue*, *Negotiate* or *Pass*, from a 0–100 score (60% financial, 40% qualitative)
- **Save / compare** deals in the browser, with JSON import and export

## Run it

Open `index.html` in any browser. No build step, no server.

## Tests

```bash
node test.js
```

## How the score works

- **Financial (0–100):** starts at 50, adds up to ±35 for IRR above/below the hurdle rate and up to ±15 for profitability index above/below 1.0.
- **Qualitative (0–100):** weighted average of the 1–5 ratings (risk is inverted, so lower risk scores higher).
- **Verdict:** *Pursue* if overall ≥ 70 and NPV ≥ 0; *Negotiate* if overall ≥ 50; otherwise *Pass*.

Tune the weights in `app.js` (`CRITERIA`) and the scoring in `finance.js` (`score`).

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Layout |
| `styles.css` | Styling (light + dark) |
| `finance.js` | NPV / IRR / payback / scoring math (browser + Node) |
| `app.js` | UI, chart, sensitivity table, saved deals |
| `test.js` | Unit tests for the math |
