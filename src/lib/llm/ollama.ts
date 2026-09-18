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
        });
      } catch (e) {
        throw new LlmError(
          `Ollama에 연결하지 못했어 (${host}). Ollama가 실행 중인지, '${model}' 모델을 받았는지 확인해줘.`,
          503,
          { cause: e },
        );
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
