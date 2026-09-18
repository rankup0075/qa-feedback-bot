import { z } from "zod";
import type { Generated, LlmProvider, Usage } from "@/lib/llm";
import type { Category, ClassifyResult, Severity } from "./classify";

export type IssueGroup = {
  title: string;
  category: Category;
  severity: Severity;
  count: number;
  memberIndexes: number[];
};

const DISTINCT_SYSTEM = `너는 게임 QA 담당자야. 여러 플레이테스터가 보고한 이슈 목록을 받아서,
중복을 걷어낸 "실제 이슈 목록"을 만들어.

판단 기준은 장소나 단어가 아니라 **증상**이다.
- 증상이 같으면, 말이 달라도 하나로 합친다.
  예: "세이브가 날아감" / "재접속하니 세이브 파일이 없어짐" → 둘 다 세이브 데이터 소실. 하나.
  예: "벽에 끼임" / "기둥에 박혀 못 나감" → 둘 다 지형에 갇힘. 하나.
- 같은 대상에 대한 불만이면, 지적한 측면이 달라도 하나로 합친다.
  예: "3챕터 보스 체력이 3배라 진도가 안 나감" / "3챕터 보스 난이도가 너무 어려움"
      → 체력이든 난이도든 결국 그 보스가 너무 세다는 같은 말. 하나.
- 증상이 다르면, 같은 장소에서 일어나도 따로 둔다.
  예: "3챕터 보스방에서 벽에 낌" / "3챕터 보스가 너무 셈" → 같은 3챕터지만 하나는 갇힘, 하나는 난이도. 따로.
- 각 이름은 개발자가 티켓 제목으로 쓸 수 있는 한국어 한 줄로.
- 입력보다 반드시 적거나 같은 개수가 나온다. 중복이 없으면 그대로 두면 된다.`;

const ASSIGN_SYSTEM = `너는 게임 QA 담당자야. 각 보고가 어느 이슈에 해당하는지 배정해.

입력의 각 줄에 대해, 그 줄이 속한 이슈 이름을 순서대로 하나씩 출력해.
1번째 이름은 1번째 줄의 이슈, 2번째 이름은 2번째 줄의 이슈다.
반드시 주어진 이슈 목록에 있는 이름만 그대로 써야 한다.`;

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 3,
  major: 2,
  minor: 1,
};

function worstSeverity(items: ClassifyResult[]): Severity {
  return items.reduce<Severity>(
    (worst, i) =>
      SEVERITY_RANK[i.severity] > SEVERITY_RANK[worst] ? i.severity : worst,
    "minor",
  );
}

/**
 * 카테고리별로 나눠서 넘기므로 category/severity 태그는 모든 줄에 똑같이
 * 붙는 군더더기다. 넣었더니 모델이 그 태그를 이슈 제목에 그대로 복사했고,
 * 요약 대신 태그에 주의를 뺏겼다. 요약만 넘긴다.
 */
function listing(items: ClassifyResult[]): string {
  return items.map((it, i) => `${i + 1}번째 줄: ${it.summary}`).join("\n");
}

/** 그래도 태그를 붙여 오면 떼어낸다. */
function cleanTitle(s: string): string {
  return s.replace(/^\s*\[[^\]]*\]\s*/, "").trim();
}

/**
 * 분류된 이슈들을 중복끼리 묶는다.
 *
 * 카테고리마다 따로 묶는다. 버그와 밸런스는 애초에 같은 이슈일 수 없는데,
 * 한 덩어리로 넘기면 모델이 "3챕터 보스방에서 벽에 낌"(버그)과
 * "3챕터 보스가 너무 셈"(밸런스)을 같은 장소라는 이유로 붙여버린다.
 * 나눠서 넘기면 그 실수가 구조적으로 불가능해지고, 한 번에 비교할
 * 목록도 짧아져 판단이 쉬워진다.
 *
 * 개수·심각도는 모델이 아니라 코드가 실제 데이터에서 계산한다.
 */
export async function group(
  llm: LlmProvider,
  items: ClassifyResult[],
): Promise<Generated<IssueGroup[]>> {
  const byCategory = new Map<Category, number[]>();
  for (let i = 0; i < items.length; i++) {
    const bucket = byCategory.get(items[i].category);
    if (bucket) bucket.push(i);
    else byCategory.set(items[i].category, [i]);
  }

  const groups: IssueGroup[] = [];
  const usage: Usage = { inputTokens: 0, outputTokens: 0 };

  for (const [, indexes] of byCategory) {
    // 한 건뿐이면 물어볼 것도 없다. 호출을 아낀다.
    if (indexes.length === 1) {
      const i = indexes[0];
      groups.push({
        title: items[i].summary,
        category: items[i].category,
        severity: items[i].severity,
        count: 1,
        memberIndexes: [i],
      });
      continue;
    }

    const sub = await groupOne(
      llm,
      indexes.map((i) => items[i]),
    );
    usage.inputTokens += sub.usage.inputTokens;
    usage.outputTokens += sub.usage.outputTokens;

    // groupOne은 부분 목록 기준 인덱스를 돌려주므로 원래 번호로 되돌린다.
    for (const g of sub.data) {
      groups.push({ ...g, memberIndexes: g.memberIndexes.map((m) => indexes[m]) });
    }
  }

  groups.sort(
    (a, b) =>
      b.count - a.count || SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  );

  return { data: groups, usage };
}

/**
 * 한 카테고리 안에서 묶는다. 모델을 두 번 부른다.
 *
 * 왜 한 번에 안 하는가. 한 번에 시키면 두 가지 중 하나가 깨진다.
 *  - "3번과 7번이 같은 그룹"처럼 번호를 답하게 하면, 작은 모델은 한 칸씩
 *    밀린 인덱스를 자주 내놓고 엉뚱한 피드백이 엉뚱한 이슈에 붙는다.
 *  - "각 줄의 그룹 이름을 순서대로"만 시키면 인덱스는 맞지만, 줄마다 조금씩
 *    다르게 이름을 지어버려서 중복이 하나도 묶이지 않는다.
 *
 * 그래서 이름을 먼저 확정하고(1단계), 배정은 그 이름들만 고를 수 있는
 * enum 스키마로 막는다(2단계). 같은 이름을 쓰라고 "부탁"하는 대신
 * 다른 이름을 쓸 수 없게 만드는 것이다. 위치가 곧 매핑이라 셈도 필요 없다.
 */
async function groupOne(
  llm: LlmProvider,
  items: ClassifyResult[],
): Promise<Generated<IssueGroup[]>> {
  const text = listing(items);

  // 1단계 — 중복을 걷어낸 이슈 이름 후보.
  // 여기만 careful을 쓴다. "세이브가 날아감"과 "재접속하니 세이브 파일이
  // 없어짐"이 같은 문제인지 판단하려면 모델이 실제로 따져봐야 하고,
  // fast로는 이런 중복을 놓친다. 느린 만큼 값을 한다.
  const distinct = await llm.generate({
    system: DISTINCT_SYSTEM,
    user: text,
    effort: "careful",
    schema: z.object({
      issues: z.array(z.string()).min(1).max(items.length),
    }),
  });

  const titles = [...new Set(distinct.data.issues.map(cleanTitle).filter(Boolean))];

  // 후보를 못 받았으면 묶지 않고 각자 하나씩 둔다. 누락보다 안 묶이는 게 낫다.
  if (titles.length === 0) {
    return { data: ungrouped(items), usage: distinct.usage };
  }

  // 2단계 — 각 줄을 후보 중 하나에 배정. enum이라 목록 밖 이름은 나올 수 없다.
  const assigned = await llm.generate({
    system: ASSIGN_SYSTEM,
    user: `이슈 목록:\n${titles.map((t) => `- ${t}`).join("\n")}\n\n보고:\n${text}`,
    schema: z.object({
      assignments: z
        .array(z.enum(titles as [string, ...string[]]))
        .length(items.length),
    }),
  });

  const usage: Usage = {
    inputTokens: distinct.usage.inputTokens + assigned.usage.inputTokens,
    outputTokens: distinct.usage.outputTokens + assigned.usage.outputTokens,
  };

  const byTitle = new Map<string, number[]>();
  const loners: number[] = [];

  for (let i = 0; i < items.length; i++) {
    const title = assigned.data.assignments[i];
    if (!title) {
      loners.push(i); // 길이가 모자란 경우 — 그 줄은 홀로 남긴다
      continue;
    }
    const bucket = byTitle.get(title);
    if (bucket) bucket.push(i);
    else byTitle.set(title, [i]);
  }

  const groups: IssueGroup[] = [];

  for (const [title, memberIndexes] of byTitle) {
    const memberItems = memberIndexes.map((m) => items[m]);
    groups.push({
      title,
      category: memberItems[0].category, // groupOne 안에서는 모두 같은 카테고리
      severity: worstSeverity(memberItems),
      count: memberIndexes.length,
      memberIndexes,
    });
  }

  for (const i of loners) {
    groups.push({
      title: items[i].summary,
      category: items[i].category,
      severity: items[i].severity,
      count: 1,
      memberIndexes: [i],
    });
  }

  // 정렬은 바깥 group()이 전체를 모은 뒤 한 번만 한다.
  return { data: groups, usage };
}

function ungrouped(items: ClassifyResult[]): IssueGroup[] {
  return items.map((it, i) => ({
    title: it.summary,
    category: it.category,
    severity: it.severity,
    count: 1,
    memberIndexes: [i],
  }));
}
