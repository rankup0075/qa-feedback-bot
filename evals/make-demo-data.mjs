/**
 * 데모 모드용 데이터를 만든다.
 *
 * 결과를 손으로 지어내지 않는다. 실제 /api/classify 와 /api/group 을 그대로
 * 호출해서 나온 답을 캐시할 뿐이다. 그래서 데모 화면에 뜨는 값은 이 앱이
 * 실제로 만들어낸 값이고, 다만 그 순간이 지금이 아닐 뿐이다.
 *
 * 사용: npm run dev  (다른 터미널)  →  node evals/make-demo-data.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import http from "node:http";

/**
 * node의 fetch는 응답 헤더를 30초 안에 못 받으면 끊는다. 묶기는 그보다 오래
 * 걸리므로 여기서는 타임아웃이 없는 http 모듈을 직접 쓴다.
 */
function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = Buffer.from(JSON.stringify(body), "utf8");
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": payload.length },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, json: JSON.parse(data) });
          } catch (e) {
            reject(new Error(`JSON 파싱 실패 (${res.statusCode}): ${data.slice(0, 200)}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.end(payload);
  });
}

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "http://localhost:3000";

/** 화면의 예시 버튼에 박힌 문장들을 소스에서 그대로 읽어온다. */
function extractSamples(file, varName) {
  const src = readFileSync(join(root, file), "utf8");
  const m = new RegExp(`const ${varName} = (\\[[\\s\\S]*?\\]|\`[\\s\\S]*?\`);`).exec(src);
  if (!m) throw new Error(`${file} 에서 ${varName} 를 못 찾음`);
  const raw = m[1];
  if (raw.startsWith("`")) {
    return raw.slice(1, -1).split("\n").map((l) => l.trim()).filter(Boolean);
  }
  return [...raw.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => JSON.parse(`"${x[1]}"`));
}

const single = extractSamples("src/app/page.tsx", "SAMPLES");
const batch = extractSamples("src/app/batch/page.tsx", "SAMPLE");
const all = [...new Set([...single, ...batch])];

console.log(`단일 예시 ${single.length}개, 일괄 예시 ${batch.length}개, 중복 제거 ${all.length}개\n`);

const norm = (s) => s.trim().replace(/\s+/g, " ");

const classified = new Map();
let provider = null;
let model = null;

for (const [i, feedback] of all.entries()) {
  const { ok, json } = await postJson(`${BASE}/api/classify`, { feedback });
  if (!ok) throw new Error(`분류 실패: ${json.error}`);
  provider ??= json.provider;
  model ??= json.model;
  classified.set(norm(feedback), json.result);
  console.log(`[${i + 1}/${all.length}] ${json.result.category}/${json.result.severity}  ${feedback.slice(0, 30)}…`);
}

console.log("\n일괄 예시를 묶는 중… (30초쯤)");
const items = batch.map((f) => classified.get(norm(f)));
const { ok: gok, json: gjson } = await postJson(`${BASE}/api/group`, { items });
if (!gok) throw new Error(`묶기 실패: ${gjson.error}`);
console.log(`→ ${items.length}건이 ${gjson.groups.length}개 이슈로 묶임`);

/** 묶기 요청은 원문이 아니라 요약만 받으므로, 요약들로 키를 만든다. */
const groupKey = items.map((r) => norm(r.summary)).join("|");

const out = `// 이 파일은 evals/make-demo-data.mjs 가 생성한다. 직접 고치지 말 것.
// 생성 시각: ${new Date().toISOString()}
// 생성에 사용한 모델: ${provider} · ${model}
//
// 실시간 호출이 실패했을 때(무료 할당량 소진, 키 없음 등) 화면이 비지 않도록
// 예시 입력에 한해 미리 계산해둔 결과다. 값은 실제 파이프라인의 출력이다.
import type { ClassifyResult } from "./classify";
import type { IssueGroup } from "./group";

export const DEMO_MODEL = ${JSON.stringify(`${provider}:${model}`)};

const CLASSIFY: Record<string, ClassifyResult> = ${JSON.stringify(
  Object.fromEntries(classified),
  null,
  2,
)};

const GROUP_KEY = ${JSON.stringify(groupKey)};

const GROUPS: IssueGroup[] = ${JSON.stringify(gjson.groups, null, 2)};

const norm = (s: string) => s.trim().replace(/\\s+/g, " ");

/** 예시 피드백이면 미리 계산해둔 분류를 돌려준다. 아니면 null. */
export function demoClassify(feedback: string): ClassifyResult | null {
  return CLASSIFY[norm(feedback)] ?? null;
}

/** 예시 12건 그대로일 때만 미리 계산해둔 묶음을 돌려준다. 아니면 null. */
export function demoGroup(items: ClassifyResult[]): IssueGroup[] | null {
  const key = items.map((r) => norm(r.summary)).join("|");
  return key === GROUP_KEY ? GROUPS : null;
}
`;

const target = join(root, "src/lib/qa/demo-data.ts");
writeFileSync(target, out, "utf8");
console.log(`\n생성: ${target}`);
