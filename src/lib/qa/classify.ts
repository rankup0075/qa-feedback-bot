import { z } from "zod";
import type { Generated, LlmProvider } from "@/lib/llm";

export const ClassifySchema = z.object({
  category: z.enum(["bug", "balance", "ux", "other"]),
  severity: z.enum(["critical", "major", "minor"]),
  summary: z.string(),
  reproSteps: z.array(z.string()),
});

export type ClassifyResult = z.infer<typeof ClassifySchema>;
export type Category = ClassifyResult["category"];
export type Severity = ClassifyResult["severity"];

const SYSTEM = `너는 게임 QA 담당자야. 플레이테스터 피드백을 분석해서 분류해.
- category: 동작이 의도대로 안 되거나 크래시/멈춤은 bug, 난이도나 수치 조정 문제는 balance, 조작감이나 UI를 못 찾는 불편은 ux, 나머지는 other
- severity: 진행 불가나 데이터 손실은 critical, 주요 기능이 망가지면 major, 사소한 불편은 minor
- summary: 한국어 한 줄 요약
- reproSteps: 피드백에서 읽어낼 수 있는 재현 단계를 한국어로. 알 수 없으면 빈 배열.

버튼이나 기능이 "눌러도 안 된다"는 건 불편이 아니라 동작 실패야. bug로 분류해.`;

export function classify(
  llm: LlmProvider,
  feedback: string,
): Promise<Generated<ClassifyResult>> {
  return llm.generate({ system: SYSTEM, user: feedback, schema: ClassifySchema });
}
