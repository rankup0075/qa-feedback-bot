import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { LlmError, type Effort, type Generated, type LlmProvider } from "./types";

const DEFAULT_MODEL = "claude-haiku-4-5";

export function createAnthropicProvider(): LlmProvider {
  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const client = new Anthropic(); // ANTHROPIC_API_KEY를 환경에서 읽음

  return {
    provider: "anthropic",
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
      const maxTokens = 4000;
      let msg;
      try {
        // messages.parse + zodOutputFormat: 서버가 스키마를 강제하고
        // SDK가 파싱까지 해준다. 마크다운 펜스를 벗겨낼 필요가 없음.
        msg = await client.messages.parse({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: user }],
          output_config: { format: zodOutputFormat(schema) },
          // Haiku 4.5는 예산을 지정하는 방식으로 추론을 켠다.
          // (최신 Opus/Sonnet 계열은 adaptive를 쓰므로, 모델을 바꾸면 여기도 손봐야 함)
          ...(effort === "careful"
            ? { thinking: { type: "enabled" as const, budget_tokens: 2048 } }
            : {}),
        });
      } catch (e) {
        if (e instanceof Anthropic.RateLimitError) {
          throw new LlmError("요청이 몰렸어. 잠시 후 다시", 429, { cause: e });
        }
        if (e instanceof Anthropic.AuthenticationError) {
          throw new LlmError("ANTHROPIC_API_KEY가 없거나 잘못됐어", 500, {
            cause: e,
          });
        }
        throw new LlmError("Claude 호출 실패", 502, { cause: e });
      }

      // max_tokens에 걸려 잘리면 스키마를 만족하지 못해 null이 된다.
      if (msg.parsed_output === null) {
        throw new LlmError(
          `결과를 파싱하지 못했어 (stop_reason: ${msg.stop_reason})`,
          502,
        );
      }

      return {
        data: msg.parsed_output,
        usage: {
          inputTokens: msg.usage.input_tokens,
          outputTokens: msg.usage.output_tokens,
        },
      };
    },
  };
}
