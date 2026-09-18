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
const LINE = 12 + W * 3 + 7 + 12;

console.log("\n실행 기록\n" + "=".repeat(LINE));
console.log(
  pad("실행", 12) + padL("카테고리", W) + padL("심각도", W) + padL("둘 다", W) +
  padL("건수", 7) + "  모델",
);
console.log("-".repeat(LINE));

const base = runs[0];
for (const r of runs) {
  const cell = (cur, prev) => {
    const s = pct(cur);
    if (r === base) return s;
    const d = (cur - prev) * 100;
    return `${s} (${d > 0 ? "+" : ""}${d.toFixed(1)})`;
  };
  console.log(
    pad(r.run, 12) +
      padL(cell(r.category_accuracy, base.category_accuracy), W) +
      padL(cell(r.severity_accuracy, base.severity_accuracy), W) +
      padL(cell(r.both_accuracy, base.both_accuracy), W) +
      padL(r.rows, 7) +
      "  " + r.model,
  );
}

const last = runs[runs.length - 1];
const floor = last.category_ci95 * 100;
console.log("-".repeat(LINE));
console.log(
  `\n첫 실행 "${base.run}" 대비 변화를 괄호로 표시했습니다 (단위: %포인트).`,
);
console.log(
  `케이스 ${last.cases}개 기준 95% 구간은 ±${floor.toFixed(1)}p.\n` +
    `이보다 작은 차이는 개선이라고 말할 수 없습니다 — 우연히 그만큼 흔들립니다.`,
);
