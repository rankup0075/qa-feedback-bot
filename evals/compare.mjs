// evals/runs/* 의 summary.json을 모아 점수 추이를 표로 보여준다.
// 사용: node evals/compare.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const runsDir = join(here, "runs");

if (!existsSync(runsDir)) {
  console.log("아직 실행 기록이 없습니다. 먼저 npm run eval 을 돌리세요.");
  process.exit(0);
}

const runs = readdirSync(runsDir)
  .map((name) => join(runsDir, name, "summary.json"))
  .filter(existsSync)
  .map((p) => JSON.parse(readFileSync(p, "utf8")))
  .sort((a, b) => new Date(a.at) - new Date(b.at));

if (runs.length === 0) {
  console.log("summary.json이 있는 실행이 없습니다.");
  process.exit(0);
}

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const pad = (s, w) => String(s).padEnd(w);
const padL = (s, w) => String(s).padStart(w);

const W = 16; // "97.0% (+12.1)" 가 들어갈 폭
const LINE = 14 + W * 3 + 7 + 12;

// 세트가 다르면 점수를 나란히 비교할 수 없다. 세트별로 나눠서 보여준다.
const bySet = new Map();
for (const r of runs) {
  const set = r.cases_file ?? "cases.json";
  if (!bySet.has(set)) bySet.set(set, []);
  bySet.get(set).push(r);
}

for (const [set, group] of bySet) {
  const isHoldout = set !== "cases.json";
  console.log(
    `\n${isHoldout ? "검증 세트" : "튜닝 세트"} — ${set} (${group[0].cases}개)\n` +
      "=".repeat(LINE),
  );
  console.log(
    pad("실행", 14) + padL("카테고리", W) + padL("심각도", W) + padL("둘 다", W) +
      padL("건수", 7) + "  모델",
  );
  console.log("-".repeat(LINE));

  const base = group[0];
  for (const r of group) {
    const cell = (cur, prev) => {
      const s = pct(cur);
      if (r === base) return s;
      const d = (cur - prev) * 100;
      return `${s} (${d > 0 ? "+" : ""}${d.toFixed(1)})`;
    };
    console.log(
      pad(r.run, 14) +
        padL(cell(r.category_accuracy, base.category_accuracy), W) +
        padL(cell(r.severity_accuracy, base.severity_accuracy), W) +
        padL(cell(r.both_accuracy, base.both_accuracy), W) +
        padL(r.rows, 7) +
        "  " + r.model,
    );
  }
  console.log("-".repeat(LINE));
  const last = group[group.length - 1];
  console.log(
    `케이스 ${last.cases}개 기준 95% 구간 ±${(last.category_ci95 * 100).toFixed(1)}p — ` +
      `이보다 작은 차이는 개선이라 말할 수 없습니다.`,
  );
}

if (bySet.size > 1) {
  console.log(
    "\n튜닝 세트 점수와 검증 세트 점수를 직접 비교하지 마세요. 케이스가 다릅니다.\n" +
      "검증 세트는 프롬프트를 고칠 때 한 번도 보지 않은 문제이므로,\n" +
      "두 점수의 격차가 곧 '튜닝 세트에 얼마나 끼워맞춰졌는지'입니다.",
  );
}
