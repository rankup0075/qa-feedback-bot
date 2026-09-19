import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { LlmError, type Effort, type Generated, type LlmProvider } from "./types";

// 무료 티어는 Flash 계열만 쓸 수 있다. 모델 이름이 바뀌면 GEMINI_MODEL로 덮어쓴다.
const DEFAULT_MODEL = "gemini-3.5-flash";

export function createGeminiProvider(): LlmProvider {
  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new LlmError("GEMINI_API_KEY가 없어", 500);
  }

  const ai = new GoogleGenAI({ apiKey });

  return {
    provider: "gemini",
    model,

    async generate<T>({
      system,
      user,
      schema,
      effort = "fast",
    }: {
      system: string;
      user: string;
      schema: z.ZodType<T>;
      effort?: Effort;
    }): Promise<Generated<T>> {
      // zod 스키마를 JSON Schema로. $schema 키는 Gemini가 거부하므로 떼어낸다.
      const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
      delete jsonSchema.$schema;

      let res;
      try {
        res = await ai.models.generateContent({
          model,
          contents: user,
          config: {
            systemInstruction: system,
            responseMimeType: "application/json",
            responseJsonSchema: jsonSchema,
            temperature: 0, // 같은 입력엔 같은 답이 나와야 함
            // careful이면 추론을 켠다. -1은 모델이 알아서 정하는 값.
            thinkingConfig: { thinkingBudget: effort === "careful" ? -1 : 0 },
          },
        });
      } catch (e) {
        const msg = String((e as Error)?.message ?? e);
        // 무료 티어에서 가장 흔한 실패. 데모 모드로 넘어갈 수 있게 429로 구분한다.
        if (/429|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(msg)) {
          throw new LlmError("Gemini 무료 할당량을 넘었어", 429, { cause: e });
        }
        if (/API key|401|403|PERMISSION_DENIED|UNAUTHENTICATED/i.test(msg)) {
          throw new LlmError("GEMINI_API_KEY가 잘못됐어", 500, { cause: e });
        }
        if (/not found|404|NOT_FOUND/i.test(msg)) {
          throw new LlmError(
            `'${model}' 모델을 찾을 수 없어. GEMINI_MODEL 환경변수로 바꿔줘.`,
            502,
            { cause: e },
          );
        }
        throw new LlmError("Gemini 호출 실패", 502, { cause: e });
      }

      const text = res.text;
      if (!text) {
        throw new LlmError("Gemini가 빈 응답을 돌려줬어", 502);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        throw new LlmError("모델이 JSON이 아닌 걸 돌려줬어", 502, { cause: e });
      }

      // 스키마를 강제했더라도 클라이언트에서 한 번 더 검증한다.
      const check = schema.safeParse(parsed);
      if (!check.success) {
        throw new LlmError("모델 출력이 스키마와 맞지 않아", 502, { cause: check.error });
      }

      return {
        data: check.data,
        usage: {
          inputTokens: res.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: res.usageMetadata?.candidatesTokenCount ?? 0,
        },
      };
    },
  };
}
