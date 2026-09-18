import { Ollama } from "ollama";
import { z } from "zod";
import {
  ClassifyError,
  ResultSchema,
  SYSTEM,
  type Classification,
  type Classifier,
} from "./types";

const DEFAULT_MODEL = "qwen3:8b";
const DEFAULT_HOST = "http://127.0.0.1:11434";

// zod 스키마를 JSON Schema로 변환해서 Ollama에 넘기면,
// 모델이 이 형태를 벗어난 출력을 아예 만들 수 없게 강제돼.
const jsonSchema = z.toJSONSchema(ResultSchema);

export function createOllamaClassifier(): Classifier {
  const model = process.env.OLLAMA_MODEL ?? DEFAULT_MODEL;
  const host = process.env.OLLAMA_HOST ?? DEFAULT_HOST;
  const client = new Ollama({ host });

  return {
    provider: "ollama",
    model,

    async classify(feedback: string): Promise<Classification> {
      let res;
      try {
        res = await client.chat({
          model,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: feedback },
          ],
          format: jsonSchema,
          think: false, // Qwen3는 추론 모델이라, 분류엔 불필요하고 느리기만 해
          options: { temperature: 0 }, // 분류는 매번 같은 답이 나와야 함
        });
      } catch (e) {
        throw new ClassifyError(
          `Ollama에 연결하지 못했어 (${host}). Ollama가 실행 중인지, '${model}' 모델을 받았는지 확인해줘.`,
          503,
          { cause: e },
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(res.message.content);
      } catch (e) {
        throw new ClassifyError("모델이 JSON이 아닌 걸 돌려줬어", 502, { cause: e });
      }

      // 스키마를 강제했더라도 클라이언트에서 한 번 더 검증한다.
      // 프로바이더를 갈아끼워도 이 지점의 보장은 동일하게 유지됨.
      const check = ResultSchema.safeParse(parsed);
      if (!check.success) {
        throw new ClassifyError("모델 출력이 스키마와 맞지 않아", 502, {
          cause: check.error,
        });
      }

      return {
        result: check.data,
        usage: {
          inputTokens: res.prompt_eval_count,
          outputTokens: res.eval_count,
        },
        provider: "ollama",
        model,
      };
    },
  };
}
