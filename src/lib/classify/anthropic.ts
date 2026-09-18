import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  ClassifyError,
  ResultSchema,
  SYSTEM,
  type Classification,
  type Classifier,
} from "./types";

const DEFAULT_MODEL = "claude-haiku-4-5";

export function createAnthropicClassifier(): Classifier {
  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const client = new Anthropic(); // ANTHROPIC_API_KEY를 환경에서 읽음

  return {
    provider: "anthropic",
    model,

    async classify(feedback: string): Promise<Classification> {
      let msg;
      try {
        // messages.parse + zodOutputFormat: 서버가 스키마를 강제하고
        // SDK가 파싱까지 해준다. 마크다운 펜스를 벗겨낼 필요가 없음.
        msg = await client.messages.parse({
          model,
          max_tokens: 1000,
          system: SYSTEM,
          messages: [{ role: "user", content: feedback }],
          output_config: { format: zodOutputFormat(ResultSchema) },
        });
      } catch (e) {
        if (e instanceof Anthropic.RateLimitError) {
          throw new ClassifyError("요청이 몰렸어. 잠시 후 다시", 429, { cause: e });
        }
        if (e instanceof Anthropic.AuthenticationError) {
          throw new ClassifyError("ANTHROPIC_API_KEY가 없거나 잘못됐어", 500, {
            cause: e,
          });
        }
        throw new ClassifyError("Claude 호출 실패", 502, { cause: e });
      }

      // max_tokens에 걸려 잘리면 스키마를 만족하지 못해 null이 된다.
      if (!msg.parsed_output) {
        throw new ClassifyError(
          `분류 결과를 파싱하지 못했어 (stop_reason: ${msg.stop_reason})`,
          502,
        );
      }

      return {
        result: msg.parsed_output,
        usage: {
          inputTokens: msg.usage.input_tokens,
          outputTokens: msg.usage.output_tokens,
        },
        provider: "anthropic",
        model,
      };
    },
  };
}
