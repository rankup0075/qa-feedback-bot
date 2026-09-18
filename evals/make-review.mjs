// cases.json을 사람이 읽고 검토할 수 있는 HTML 표로 뽑는다.
// 사용: node evals/make-review.mjs   →  evals/review.html
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, "cases.json"), "utf8"));

// 앱의 카테고리 색과 동일 (dataviz 검증기로 라이트/다크 모두 통과시킨 조합)
const COLOR = {
  bug: "#ec003f",
  balance: "#e17100",
  ux: "#0084d1",
  other: "#009E73",
};
const CAT_KO = { bug: "버그", balance: "밸런스", ux: "사용성", other: "기타" };
const SEV_KO = { critical: "치명적", major: "중요", minor: "경미" };

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const counts = {};
for (const c of data.cases) {
  const k = `${c.expected.category}/${c.expected.severity}`;
  counts[k] = (counts[k] ?? 0) + 1;
}
const catCounts = {};
const sevCounts = {};
const diffCounts = {};
for (const c of data.cases) {
  catCounts[c.expected.category] = (catCounts[c.expected.category] ?? 0) + 1;
  sevCounts[c.expected.severity] = (sevCounts[c.expected.severity] ?? 0) + 1;
  const d = c.tags[1] ?? "보통";
  diffCounts[d] = (diffCounts[d] ?? 0) + 1;
}

const rows = data.cases
  .map(
    (c) => `
      <tr>
        <td class="id">${esc(c.id)}</td>
        <td class="input">${esc(c.input)}</td>
        <td><span class="chip" style="background:${COLOR[c.expected.category]}">${CAT_KO[c.expected.category]}</span></td>
        <td><span class="sev sev-${c.expected.severity}">${SEV_KO[c.expected.severity]}</span></td>
        <td class="diff">${esc(c.tags[1] ?? "")}</td>
        <td class="note">${c.note ? esc(c.note) : ""}</td>
      </tr>`,
  )
  .join("");

const policyRows = Object.entries(data.policy.category)
  .map(
    ([k, v]) =>
      `<tr><td><span class="chip" style="background:${COLOR[k]}">${CAT_KO[k]}</span></td><td>${esc(v)}</td></tr>`,
  )
  .join("");

const sevRows = Object.entries(data.policy.severity)
  .map(([k, v]) => `<tr><td><span class="sev sev-${k}">${SEV_KO[k]}</span></td><td>${esc(v)}</td></tr>`)
  .join("");

const noteItems = data.policy.notes.map((n) => `<li>${esc(n)}</li>`).join("");

const summaryChips = [
  ...Object.entries(catCounts).map(
    ([k, v]) => `<span class="chip" style="background:${COLOR[k]}">${CAT_KO[k]} ${v}</span>`,
  ),
  ...Object.entries(sevCounts).map(([k, v]) => `<span class="sev sev-${k}">${SEV_KO[k]} ${v}</span>`),
  ...Object.entries(diffCounts).map(([k, v]) => `<span class="plain">${esc(k)} ${v}</span>`),
].join(" ");

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>분류 정확도 테스트 케이스 검토</title>
<style>
  :root { --bg:#ffffff; --fg:#18181b; --muted:#71717b; --line:#e4e4e7; --panel:#fafafa; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0a0a0a; --fg:#ededed; --muted:#a1a1aa; --line:#27272a; --panel:#141414; }
  }
  * { box-sizing: border-box; }
  body { margin:0; padding:24px 16px 64px; background:var(--bg); color:var(--fg);
         font-family: "Malgun Gothic", system-ui, sans-serif; line-height:1.6; }
  .wrap { max-width: 1000px; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin: 0 0 4px; }
  h2 { font-size: 1.05rem; margin: 32px 0 10px; }
  p.sub { color:var(--muted); margin:0 0 18px; font-size:.9rem; }
  .chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px; }
  .chip, .sev, .plain { display:inline-block; padding:2px 9px; border-radius:999px;
         font-size:.75rem; font-weight:700; color:#fff; white-space:nowrap; }
  .sev-critical { background:#b91c1c; }
  .sev-major    { background:#c2410c; }
  .sev-minor    { background:#52525b; }
  .plain { background:transparent; color:var(--muted); border:1px solid var(--line); font-weight:500; }
  table { width:100%; border-collapse:collapse; font-size:.88rem; }
  th, td { text-align:left; padding:9px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { font-size:.75rem; color:var(--muted); font-weight:600; text-transform:none;
       position:sticky; top:0; background:var(--bg); }
  td.id { color:var(--muted); font-variant-numeric:tabular-nums; white-space:nowrap; }
  td.input { min-width: 260px; }
  td.diff { color:var(--muted); white-space:nowrap; }
  td.note { color:var(--muted); font-size:.8rem; }
  .panel { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px; }
  .panel table td:first-child { white-space:nowrap; width:1%; }
  ul { margin:10px 0 0; padding-left:20px; }
  li { margin-bottom:4px; font-size:.88rem; }
  .ask { margin-top:36px; border-left:3px solid #0084d1; padding:10px 0 10px 14px; }
  .ask strong { display:block; margin-bottom:6px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>분류 정확도 테스트 케이스</h1>
  <p class="sub">${data.cases.length}개 · 이 표의 &ldquo;정답&rdquo;이 맞는지 확인해줘. 여기서 승인한 기준으로 점수가 매겨져.</p>
  <div class="chips">${summaryChips}</div>

  <h2>라벨링 기준 &mdash; 카테고리</h2>
  <div class="panel"><table><tbody>${policyRows}</tbody></table></div>

  <h2>라벨링 기준 &mdash; 심각도</h2>
  <div class="panel"><table><tbody>${sevRows}</tbody></table></div>

  <h2>애매한 경우에 대한 결정</h2>
  <div class="panel"><ul>${noteItems}</ul></div>

  <h2>케이스 ${data.cases.length}개</h2>
  <table>
    <thead><tr><th>#</th><th>피드백</th><th>카테고리</th><th>심각도</th><th>난이도</th><th>메모</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="ask">
    <strong>확인해줄 것</strong>
    1. 위 &ldquo;라벨링 기준&rdquo;에 동의하는지 &mdash; 특히 성능 저하를 bug로, 오타를 other로 본 것.<br>
    2. 30개 중 정답이 틀렸다고 생각되는 번호.<br>
    3. 실제 게임 QA에서 자주 보는데 여기 빠진 유형.
  </div>
</div>
</body>
</html>
`;

const out = join(here, "review.html");
writeFileSync(out, html, "utf8");
console.log(`생성: ${out}`);
console.log(`케이스 ${data.cases.length}개`);
console.log("카테고리별:", catCounts);
console.log("심각도별:", sevCounts);
console.log("난이도별:", diffCounts);
