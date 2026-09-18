/**
 * 분류 정확도 채점기.
 *
 * 앱을 실제로 쓰는 경로 그대로 잰다 — 라이브러리를 직접 부르지 않고
 * /api/classify에 HTTP로 요청한다. 라우트 코드에 문제가 생겨도 잡히도록.
 *
 * 사용:
 *   npm run dev          (다른 터미널에서 먼저 띄워둘 것)
 *   npm run eval
 *   npm run eval -- --name v1 --reps 2 --base http://localhost:3001
 */
import { readFileSync, writeFileSync, mkdirSync, appendFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// ---------- 인자 ----------
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const RUN_NAME = arg("name", "baseline");
const REPS = Number(arg("reps", "1"));
const BASE = arg("base", "http://localhost:3000");
const CASE_TIMEOUT_MS = Number(arg("timeout", "120000"));

const CATEGORIES = ["bug", "balance", "ux", "other"];
const SEVERITIES = ["critical", "major", "minor"];

// ---------- 준비 ----------
const data = JSON.parse(readFileSync(join(here, "cases.json"), "utf8"));
const outDir = join(here, "runs", RUN_NAME);
const tracesDir = join(outDir, "traces");
mkdirSync(tracesDir, { recursive: true });

const resultsPath = join(outDir, "results.jsonl");
const errorsPath = join(outDir, "errors.jsonl");

// 이어 돌리기: 이미 채점된 (케이스, 회차)는 건너뛴다.
const done = new Set();
if (existsSync(resultsPath)) {
  for (const line of readFileSync(resultsPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      done.add(`${r.prompt_id}#${r.rep}`);
    } catch {}
  }
  if (done.size) console.log(`이미 끝난 ${done.size}건은 건너뜁니다 (이어 돌리기).\n`);
}

// ---------- 실행 ----------
async function classifyOnce(input) {
  const ac = new AbortController();
  // 케이스당 벽시계 상한. 스트림이 살아있어도 전체 시간이 넘으면 끊는다.
  const timer = setTimeout(() => ac.abort(), CASE_TIMEOUT_MS);
  try {
    const t0 = Date.now();
    const res = await fetch(`${BASE}/api/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback: input }),
      signal: ac.signal,
    });
    const json = await res.json();
    const latency_s = (Date.now() - t0) / 1000;
    if (!res.ok) {
      return { ok: false, failure: "api_error", detail: json.error ?? res.status, latency_s };
    }
    return { ok: true, json, latency_s };
  } catch (e) {
    return {
      ok: false,
      failure: ac.signal.aborted ? "timeout" : "harness_error",
      detail: String(e?.message ?? e),
      latency_s: CASE_TIMEOUT_MS / 1000,
    };
  } finally {
    clearTimeout(timer);
  }
}

const total = data.cases.length * REPS;
let n = 0;
let provider = null;
let model = null;

console.log(`케이스 ${data.cases.length}개 × ${REPS}회 = ${total}건`);
console.log(`대상: ${BASE}/api/classify`);
console.log(`결과: ${outDir}\n`);

for (let rep = 0; rep < REPS; rep++) {
  for (const c of data.cases) {
    n++;
    const key = `${c.id}#${rep}`;
    if (done.has(key)) continue;

    const r = await classifyOnce(c.input);

    if (!r.ok) {
      // 채점 가능한 출력이 안 나온 실패는 results가 아니라 errors로 간다.
      // results에 0점으로 넣으면 "모델이 틀린 것"과 구분이 안 되고,
      // 이어 돌리기가 영영 재시도하지 않는다.
      appendFileSync(
        errorsPath,
        JSON.stringify({
          prompt_id: c.id,
          rep,
          failure: r.failure,
          detail: r.detail,
          at: new Date().toISOString(),
        }) + "\n",
        "utf8",
      );
      console.log(`[${n}/${total}] ${c.id}  실패(${r.failure}): ${r.detail}`);
      continue;
    }

    const got = r.json.result;
    provider ??= r.json.provider;
    model ??= r.json.model;

    const categoryHit = got.category === c.expected.category;
    const severityHit = got.severity === c.expected.severity;

    const row = {
      prompt_id: c.id,
      rep,
      prompt: c.input,
      tags: c.tags,
      expected: c.expected,
      got: { category: got.category, severity: got.severity },
      grade: {
        // 첫 항목이 대표 점수가 된다. 카테고리가 본체.
        category: categoryHit ? 1 : 0,
        severity: severityHit ? 1 : 0,
        both: categoryHit && severityHit ? 1 : 0,
      },
      summary: got.summary,
      repro_steps: got.reproSteps?.length ?? 0,
      latency_s: Number(r.latency_s.toFixed(2)),
      model: r.json.model,
      provider: r.json.provider,
      usage: r.json.usage,
      status: "ok",
    };

    // 케이스가 끝날 때마다 바로 쓴다. 중간에 죽어도 앞의 결과는 남는다.
    appendFileSync(resultsPath, JSON.stringify(row) + "\n", "utf8");
    writeFileSync(
      join(tracesDir, `${c.id}_rep${rep}.json`),
      JSON.stringify(
        [
          { role: "user", content: c.input },
          { role: "assistant", content: JSON.stringify(got, null, 2) },
        ],
        null,
        2,
      ),
      "utf8",
    );

    const mark = categoryHit && severityHit ? "OK  " : categoryHit ? "~sev" : "X   ";
    const detail = categoryHit && severityHit
      ? ""
      : `  기대 ${c.expected.category}/${c.expected.severity} → 받음 ${got.category}/${got.severity}`;
    console.log(`[${n}/${total}] ${mark} ${c.id}${detail}`);
  }
}

// ---------- 집계 ----------
const rows = readFileSync(resultsPath, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x) => `${(x * 100).toFixed(1)}%`;

/** 이항비율의 95% 신뢰구간 폭(±). 이보다 작은 차이는 우연과 구분할 수 없다. */
function ci95(p, n) {
  if (n === 0) return 0;
  return 1.96 * Math.sqrt((p * (1 - p)) / n);
}

const catAcc = mean(rows.map((r) => r.grade.category));
const sevAcc = mean(rows.map((r) => r.grade.severity));
const bothAcc = mean(rows.map((r) => r.grade.both));

console.log("\n" + "=".repeat(64));
console.log(`실행 "${RUN_NAME}"  ·  ${provider ?? "?"} · ${model ?? "?"}  ·  ${rows.length}건`);
console.log("=".repeat(64));
console.log(`카테고리 정확도   ${pct(catAcc)}  ±${(ci95(catAcc, rows.length) * 100).toFixed(1)}p`);
console.log(`심각도 정확도     ${pct(sevAcc)}  ±${(ci95(sevAcc, rows.length) * 100).toFixed(1)}p`);
console.log(`둘 다 맞음        ${pct(bothAcc)}  ±${(ci95(bothAcc, rows.length) * 100).toFixed(1)}p`);

// 카테고리별 정밀도/재현율 — 전체 평균 하나로는 어느 쪽이 무너졌는지 안 보인다.
console.log("\n카테고리별");
console.log("            재현율(맞힌 비율)   정밀도(그렇다고 한 것 중 맞은 비율)");
for (const cat of CATEGORIES) {
  const actual = rows.filter((r) => r.expected.category === cat);
  const predicted = rows.filter((r) => r.got.category === cat);
  const recall = actual.length ? mean(actual.map((r) => r.grade.category)) : NaN;
  const precision = predicted.length
    ? mean(predicted.map((r) => (r.expected.category === cat ? 1 : 0)))
    : NaN;
  const pad = (s, w) => String(s).padEnd(w);
  console.log(
    `  ${pad(cat, 10)}${pad(
      Number.isNaN(recall) ? "—" : `${pct(recall)} (${actual.length}건)`,
      20,
    )}${Number.isNaN(precision) ? "— (0건)" : `${pct(precision)} (${predicted.length}건)`}`,
  );
}

console.log("\n심각도별 재현율");
for (const sev of SEVERITIES) {
  const actual = rows.filter((r) => r.expected.severity === sev);
  if (!actual.length) continue;
  console.log(
    `  ${sev.padEnd(10)}${pct(mean(actual.map((r) => r.grade.severity)))} (${actual.length}건)`,
  );
}

console.log("\n난이도별 카테고리 정확도");
for (const d of ["쉬움", "보통", "어려움"]) {
  const sub = rows.filter((r) => r.tags[1] === d);
  if (!sub.length) continue;
  console.log(`  ${d.padEnd(8)}${pct(mean(sub.map((r) => r.grade.category)))} (${sub.length}건)`);
}

const misses = rows.filter((r) => !r.grade.both);
if (misses.length) {
  console.log(`\n틀린 케이스 ${misses.length}개`);
  for (const m of misses) {
    console.log(
      `  ${m.prompt_id}  기대 ${m.expected.category}/${m.expected.severity}  →  받음 ${m.got.category}/${m.got.severity}`,
    );
    console.log(`        "${m.prompt.slice(0, 50)}${m.prompt.length > 50 ? "…" : ""}"`);
  }
}

const errCount = existsSync(errorsPath)
  ? readFileSync(errorsPath, "utf8").split("\n").filter(Boolean).length
  : 0;
if (errCount) console.log(`\n실패(채점 불가) ${errCount}건 — ${errorsPath}`);

const avgLatency = mean(rows.map((r) => r.latency_s));
console.log(`\n건당 평균 ${avgLatency.toFixed(1)}초`);

// 이 세트로 감지 가능한 최소 차이. 이보다 작은 변화는 우연과 구분 못 한다.
console.log(
  `해상도: ${rows.length}건에서 카테고리 정확도의 95% 구간은 ±${(
    ci95(catAcc, rows.length) * 100
  ).toFixed(1)}p. 이보다 작은 변화는 개선이라고 말할 수 없음.`,
);

writeFileSync(
  join(outDir, "summary.json"),
  JSON.stringify(
    {
      run: RUN_NAME,
      provider,
      model,
      cases: data.cases.length,
      reps: REPS,
      rows: rows.length,
      errors: errCount,
      category_accuracy: catAcc,
      severity_accuracy: sevAcc,
      both_accuracy: bothAcc,
      category_ci95: ci95(catAcc, rows.length),
      avg_latency_s: avgLatency,
      at: new Date().toISOString(),
    },
    null,
    2,
  ),
  "utf8",
);
console.log(`\n저장: ${join(outDir, "summary.json")}`);
