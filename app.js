(function () {
  "use strict";
  const F = window.Finance;
  const $ = (id) => document.getElementById(id);
  const STORE_KEY = "deal-evaluator.deals";

  const CRITERIA = [
    { key: "strategic", label: "Strategic fit", weight: 3 },
    { key: "market", label: "Market attractiveness", weight: 2 },
    { key: "team", label: "Management / team", weight: 2 },
    { key: "moat", label: "Competitive advantage", weight: 2 },
    { key: "integration", label: "Ease of integration", weight: 1 },
    { key: "risk", label: "Risk level", weight: 3, invert: true },
  ];
  const ratings = Object.fromEntries(CRITERIA.map((c) => [c.key, c.invert ? 2 : 3]));

  // ---------- formatting ----------
  const money = (v) => {
    if (v == null || !isFinite(v)) return "—";
    const a = Math.abs(v);
    const s = a >= 1e9 ? (a / 1e9).toFixed(2) + "B" : a >= 1e6 ? (a / 1e6).toFixed(2) + "M" : a >= 1e3 ? (a / 1e3).toFixed(1) + "K" : a.toFixed(0);
    return (v < 0 ? "−$" : "$") + s;
  };
  const pct = (v) => (v == null || !isFinite(v) ? "—" : (v * 100).toFixed(1) + "%");
  const yrs = (v) => (v == null ? "Never" : v.toFixed(1) + " yrs");
  const x = (v) => (v == null ? "—" : v.toFixed(2) + "×");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- criteria UI ----------
  function renderCriteria() {
    $("criteria").innerHTML = CRITERIA.map((c) => `
      <div class="crit">
        <div>${c.label}<div class="w">weight ${c.weight}${c.invert ? " · lower is better" : ""}</div></div>
        <input type="range" min="1" max="5" step="1" value="${ratings[c.key]}" data-key="${c.key}" aria-label="${c.label}" />
        <output id="out-${c.key}">${ratings[c.key]}</output>
      </div>`).join("");
    $("criteria").querySelectorAll("input").forEach((el) =>
      el.addEventListener("input", () => {
        ratings[el.dataset.key] = +el.value;
        $("out-" + el.dataset.key).textContent = el.value;
        update();
      })
    );
  }

  // ---------- read inputs ----------
  function readInputs() {
    const num = (id) => parseFloat($(id).value) || 0;
    const custom = $("customFlows").value
      .split(/[,\s]+/).map((s) => s.trim()).filter(Boolean).map(Number).filter((n) => isFinite(n));
    return {
      name: $("name").value.trim() || "Untitled deal",
      investment: num("investment"),
      discountRate: num("discountRate") / 100,
      year1: num("year1"),
      growth: num("growth") / 100,
      years: Math.max(1, Math.min(30, Math.round(num("years")) || 1)),
      exitValue: num("exitValue"),
      customFlows: custom.length ? custom : null,
    };
  }

  function writeInputs(d) {
    $("name").value = d.name;
    $("investment").value = d.investment;
    $("discountRate").value = +(d.discountRate * 100).toFixed(4);
    $("year1").value = d.year1;
    $("growth").value = +(d.growth * 100).toFixed(4);
    $("years").value = d.years;
    $("exitValue").value = d.exitValue;
    $("customFlows").value = d.customFlows ? d.customFlows.join(", ") : "";
    if (d.ratings) Object.assign(ratings, d.ratings);
    renderCriteria();
    update();
  }

  const criteriaWithRatings = () => CRITERIA.map((c) => ({ ...c, rating: ratings[c.key] }));

  // ---------- render ----------
  function update() {
    const inputs = readInputs();
    const r = F.evaluate(inputs);
    const s = F.score(r, inputs, criteriaWithRatings());

    const vc = $("verdictCard");
    vc.className = "card verdict " + s.tone;
    $("verdict").textContent = s.verdict;
    $("overall").textContent = s.overall;
    $("finScore").textContent = s.financial;
    $("qualScore").textContent = s.qualitative;

    const metrics = [
      ["NPV", money(r.npv), r.npv >= 0 ? "pos" : "neg"],
      ["IRR", r.irr == null ? "n/a" : pct(r.irr), r.irr != null && r.irr >= inputs.discountRate ? "pos" : "neg"],
      ["ROI", pct(r.roi), r.roi >= 0 ? "pos" : "neg"],
      ["MOIC", x(r.moic), ""],
      ["Profitability index", x(r.profitabilityIndex), r.profitabilityIndex >= 1 ? "pos" : "neg"],
      ["Payback", yrs(r.payback), ""],
      ["Discounted payback", yrs(r.discountedPayback), ""],
    ];
    $("metrics").innerHTML = metrics.map(([k, v, cls]) =>
      `<div class="metric"><div class="k">${k}</div><div class="v ${cls}">${v}</div></div>`).join("");

    renderChart(r.flows);
    renderSensitivity(inputs);
  }

  function renderChart(flows) {
    const W = 640, H = 220, pad = { l: 56, r: 10, t: 10, b: 26 };
    let cum = 0;
    const cumul = flows.map((f) => (cum += f));
    const all = flows.concat(cumul, [0]);
    const max = Math.max(...all), min = Math.min(...all);
    const span = max - min || 1;
    const y = (v) => pad.t + ((max - v) / span) * (H - pad.t - pad.b);
    const bw = (W - pad.l - pad.r) / flows.length;
    const cx = (i) => pad.l + bw * i + bw / 2;

    const bars = flows.map((f, i) => {
      const top = Math.min(y(f), y(0)), h = Math.abs(y(f) - y(0));
      return `<rect x="${cx(i) - bw * 0.3}" y="${top}" width="${bw * 0.6}" height="${Math.max(h, 1)}" rx="3"
        fill="${f >= 0 ? "var(--good)" : "var(--bad)"}" opacity="0.8"><title>Year ${i}: ${money(f)}</title></rect>`;
    }).join("");
    const line = cumul.map((v, i) => `${i ? "L" : "M"}${cx(i)},${y(v)}`).join(" ");
    const dots = cumul.map((v, i) => `<circle cx="${cx(i)}" cy="${y(v)}" r="3" fill="var(--accent)"><title>Cumulative yr ${i}: ${money(v)}</title></circle>`).join("");
    const labels = flows.map((_, i) => `<text x="${cx(i)}" y="${H - 8}" text-anchor="middle">Y${i}</text>`).join("");
    const ticks = [max, (max + min) / 2, min].map((v) => `<text x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end">${money(v)}</text>`).join("");

    $("chart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cash flows by year">
      <line x1="${pad.l}" x2="${W - pad.r}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line)" />
      ${bars}<path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2" />${dots}${labels}${ticks}
    </svg><div class="hint">Bars: yearly net cash flow (incl. exit in final year). Line: cumulative.</div>`;
  }

  function renderSensitivity(inputs) {
    const rd = [-0.04, -0.02, 0, 0.02, 0.04];
    const fd = [-0.3, -0.15, 0, 0.15, 0.3];
    const grid = F.sensitivity(inputs, rd, fd);
    const head = `<tr><th>Rate \\ CF</th>${fd.map((d) => `<th>${d > 0 ? "+" : ""}${(d * 100).toFixed(0)}%</th>`).join("")}</tr>`;
    const rows = grid.map((row, i) => `<tr><th>${pct(inputs.discountRate + rd[i])}</th>${row.map((v, j) =>
      `<td class="${v >= 0 ? "cell-pos" : "cell-neg"}${rd[i] === 0 && fd[j] === 0 ? " base" : ""}">${money(v)}</td>`).join("")}</tr>`).join("");
    $("sens").innerHTML = head + rows;
  }

  // ---------- persistence ----------
  function loadDeals() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; }
  }
  function saveDeals(deals) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(deals)); } catch { /* storage unavailable */ }
  }
  const snapshot = () => ({ ...readInputs(), ratings: { ...ratings }, savedAt: new Date().toISOString() });

  function renderSaved() {
    const deals = loadDeals();
    $("noSaved").hidden = deals.length > 0;
    if (!deals.length) { $("saved").innerHTML = ""; return; }
    const rows = deals.map((d, i) => {
      const r = F.evaluate(d);
      const s = F.score(r, d, CRITERIA.map((c) => ({ ...c, rating: (d.ratings || {})[c.key] ?? 3 })));
      return `<tr><td>${esc(d.name)}</td><td>${money(r.npv)}</td><td>${r.irr == null ? "n/a" : pct(r.irr)}</td>
        <td>${x(r.moic)}</td><td>${s.overall}</td><td class="${s.tone === "good" ? "pos" : s.tone === "bad" ? "neg" : ""}">${s.verdict}</td>
        <td><button class="link" data-load="${i}">Load</button><button class="link" data-del="${i}">Delete</button></td></tr>`;
    }).join("");
    $("saved").innerHTML = `<tr><th>Deal</th><th>NPV</th><th>IRR</th><th>MOIC</th><th>Score</th><th>Verdict</th><th></th></tr>${rows}`;
  }

  $("saved").addEventListener("click", (e) => {
    const deals = loadDeals();
    if (e.target.dataset.load != null) writeInputs(deals[+e.target.dataset.load]);
    if (e.target.dataset.del != null) { deals.splice(+e.target.dataset.del, 1); saveDeals(deals); renderSaved(); }
  });

  $("save").addEventListener("click", () => {
    const deals = loadDeals();
    const snap = snapshot();
    const idx = deals.findIndex((d) => d.name === snap.name);
    if (idx >= 0) deals[idx] = snap; else deals.push(snap);
    saveDeals(deals);
    renderSaved();
  });

  $("export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ current: snapshot(), saved: loadDeals() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "deals.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $("import").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (Array.isArray(data.saved)) { saveDeals(data.saved); renderSaved(); }
      if (data.current) writeInputs(data.current);
    } catch { alert("Could not read that file."); }
    e.target.value = "";
  });

  document.querySelectorAll("#inputs input[type=text], #inputs input[type=number]").forEach((el) =>
    el.addEventListener("input", update));

  renderCriteria();
  update();
  renderSaved();
})();
