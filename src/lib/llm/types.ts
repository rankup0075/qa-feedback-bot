import type { z } from "zod";

export type Usage = {
  inputTokens: number;
  outputTokens: number;
};

export type Generated<T> = {
  data: T;
  usage: Usage;
};

/**
 * 답하기 전에 모델이 얼마나 생각할지.
 *
 * - fast: 바로 답한다. 분류처럼 기준이 명확한 작업용.
 * - careful: 추론을 켠다. 느려지는 대신 판단이 좋아진다.
 *   중복 묶기처럼 "이 둘이 같은 문제인가"를 따져야 하는 작업용.
 *
 * 모델마다 켜는 방법이 달라서(로컬 모델은 think, Claude는 thinking)
 * 위층은 이 두 단어만 알면 되게 감싼다.
 */
export type Effort = "fast" | "careful";

/**
 * LLM에게 시키는 일은 결국 하나로 요약된다:
 * "이 지시(system)와 이 입력(user)을 읽고, 이 스키마(schema) 형태로 답해라."
 *
 * 분류든 그룹핑이든 전부 이 위에 올린다. 프로바이더 구현체는
 * 이 메서드 하나만 만족하면 되고, 위층은 어느 모델이 붙었는지 몰라도 된다.
 */
export interface LlmProvider {
  readonly provider: string;
  readonly model: string;
  generate<T>(args: {
    system: string;
    user: string;
    schema: z.ZodType<T>;
    effort?: Effort; // 기본 fast
  }): Promise<Generated<T>>;
}

/** 구현체가 HTTP 상태 코드를 정해서 던질 수 있게 하는 에러 타입. */
export class LlmError extends Error {
  constructor(
    message: string,
    readonly status: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "LlmError";
  }
}
