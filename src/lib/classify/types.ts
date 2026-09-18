import { z } from "zod";

/** AI가 돌려줘야 하는 분류 결과의 형태. 프로바이더가 뭐든 이 스키마는 동일해. */
export const ResultSchema = z.object({
  category: z.enum(["bug", "balance", "ux", "other"]),
  severity: z.enum(["critical", "major", "minor"]),
  summary: z.string(),
  reproSteps: z.array(z.string()),
});

export type ClassifyResult = z.infer<typeof ResultSchema>;

/** 토큰 사용량. 로컬 모델은 돈이 안 들지만 프롬프트 길이를 재는 데 쓸모 있어. */
export type Usage = {
  inputTokens: number;
  outputTokens: number;
};

export type Classification = {
  result: ClassifyResult;
  usage: Usage;
  provider: string;
  model: string;
};

/**
 * 분류기 인터페이스. 구현체(ollama / anthropic)가 이걸 만족하기만 하면
 * 라우트 코드는 어느 쪽이 붙었는지 몰라도 돼.
 */
export interface Classifier {
  readonly provider: string;
  readonly model: string;
  classify(feedback: string): Promise<Classification>;
}

/** 구현체가 HTTP 상태 코드를 정해서 던질 수 있게 하는 에러 타입. */
export class ClassifyError extends Error {
  constructor(
    message: string,
    readonly status: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "ClassifyError";
  }
}

export const SYSTEM = `너는 게임 QA 담당자야. 플레이테스터 피드백을 분석해서 분류해.
- category: 크래시/버그는 bug, 난이도나 수치 문제는 balance, 조작감이나 UI 불편은 ux, 나머지는 other
- severity: 진행 불가나 데이터 손실은 critical, 주요 기능이 망가지면 major, 사소한 불편은 minor
- summary: 한국어 한 줄 요약
- reproSteps: 피드백에서 읽어낼 수 있는 재현 단계를 한국어로. 알 수 없으면 빈 배열.`;
