// Scores the resolver against the engine's answers kept by truth.js: the mean error in side A's win chance and in
// the share each side lost, and how often it calls the favourite, by ground and by size.
//   node tools/resolver/score.js <file> [...more files]
const fs = require("fs");
const { predict } = require("./resolver.js");
const rows = process.argv.slice(2).flatMap(f => JSON.parse(fs.readFileSync(f, "utf8")));
const groups = {};
for (const r of rows) {
  const p = predict(r.A, r.B, { ground: r.ground, hold: r.deploy === "hold" ? 1 : undefined, seed: 1, sims: 200 });
  const g = (groups[`${r.ground} ${r.deploy} ${r.size}`] ||= { n: 0, w: 0, l: 0, called: 0 });
  g.n++; g.w += Math.abs(r.pA - p.pWinA); g.l += (Math.abs(r.lossA - p.lossA) + Math.abs(r.lossB - p.lossB)) / 2;
  if ((r.pA > 0.5) === (p.pWinA > 0.5) || Math.abs(r.pA - 0.5) < 0.15) g.called++;
}
const all = Object.values(groups).reduce((a, g) => ({ n: a.n + g.n, w: a.w + g.w, l: a.l + g.l, called: a.called + g.called }), { n: 0, w: 0, l: 0, called: 0 });
for (const [k, g] of [...Object.entries(groups), ["all", all]]) console.log(`${k.padEnd(24)} ${String(g.n).padStart(4)} battles   win chance off by ${(g.w / g.n * 100).toFixed(1).padStart(5)} points   share lost off by ${(g.l / g.n * 100).toFixed(1).padStart(5)}   favourite called ${g.called}/${g.n}`);
