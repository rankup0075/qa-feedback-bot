import { Ollama } from "ollama";
import { z } from "zod";
import { LlmError, type Effort, type Generated, type LlmProvider } from "./types";

const DEFAULT_MODEL = "qwen3:8b";
const DEFAULT_HOST = "http://127.0.0.1:11434";

export function createOllamaProvider(): LlmProvider {
  const model = process.env.OLLAMA_MODEL ?? DEFAULT_MODEL;
  const host = process.env.OLLAMA_HOST ?? DEFAULT_HOST;
  const client = new Ollama({ host });

  return {
    provider: "ollama",
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
      // zod 스키마를 JSON Schema로 바꿔 넘기면, 모델이 이 형태를
      // 벗어난 출력을 아예 만들 수 없게 강제된다.
      const format = z.toJSONSchema(schema);

      let res;
      try {
        res = await client.chat({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          format,
          // careful이면 추론을 켠다. 8배쯤 느려지지만, 의미가 먼 중복을
          // 묶는 판단은 이걸 켜야 맞는다.
          think: effort === "careful",
          options: { temperature: 0 }, // 같은 입력엔 같은 답이 나와야 함
          // 기본값(5분)이면 잠깐만 쉬어도 5.6GB를 GPU에 다시 올리느라
          // 한 번에 40초씩 날아간다. 개발 중에는 붙잡아두는 편이 낫다.
          keep_alive: process.env.OLLAMA_KEEP_ALIVE ?? "30m",
        });
      } catch (e) {
        // 예외를 전부 "연결 실패"로 뭉뚱그리면 진짜 원인이 가려진다.
        // 타임아웃과 서버 부재는 대응이 다르므로 구분해서 알린다.
        const msg = String((e as Error)?.message ?? e);
        const cause = String((e as { cause?: unknown })?.cause ?? "");

        if (/timeout|UND_ERR_HEADERS_TIMEOUT|UND_ERR_BODY_TIMEOUT/i.test(msg + cause)) {
          throw new LlmError(
            `Ollama 응답이 너무 오래 걸렸어. 모델이 GPU에 다시 올라가는 중일 수 있어 — 잠시 후 다시 시도해줘.`,
            504,
            { cause: e },
          );
        }
        if (/ECONNREFUSED|fetch failed|ENOTFOUND|ECONNRESET/i.test(msg + cause)) {
          throw new LlmError(
            `Ollama에 연결하지 못했어 (${host}). Ollama가 실행 중인지, '${model}' 모델을 받았는지 확인해줘.`,
            503,
            { cause: e },
          );
        }
        throw new LlmError(`Ollama 호출 실패: ${msg}`, 502, { cause: e });
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(res.message.content);
      } catch (e) {
        throw new LlmError("모델이 JSON이 아닌 걸 돌려줬어", 502, { cause: e });
      }

      // 스키마를 강제했더라도 클라이언트에서 한 번 더 검증한다.
      const check = schema.safeParse(parsed);
      if (!check.success) {
        throw new LlmError("모델 출력이 스키마와 맞지 않아", 502, {
          cause: check.error,
        });
      }

      return {
        data: check.data,
        usage: {
          inputTokens: res.prompt_eval_count,
          outputTokens: res.eval_count,
        },
      };
    },
  };
}
