import { createAnthropicProvider } from "./anthropic";
import { createOllamaProvider } from "./ollama";
import { LlmError, type LlmProvider } from "./types";

export * from "./types";

let cached: LlmProvider | null = null;

/**
 * 어떤 모델을 쓸지 고른다.
 *
 * - CLASSIFIER_PROVIDER가 있으면 그걸 따른다
 * - 없으면 ANTHROPIC_API_KEY가 있을 때 anthropic, 아니면 ollama
 *
 * 덕분에 개발은 로컬 모델로 공짜로 하고, 키를 넣는 순간
 * 코드 수정 없이 Claude로 넘어간다.
 */
export function getLlm(): LlmProvider {
  if (cached) return cached;

  const provider =
    process.env.CLASSIFIER_PROVIDER ??
    (process.env.ANTHROPIC_API_KEY ? "anthropic" : "ollama");

  switch (provider) {
    case "ollama":
      cached = createOllamaProvider();
      break;
    case "anthropic":
      cached = createAnthropicProvider();
      break;
    default:
      throw new LlmError(
        `알 수 없는 CLASSIFIER_PROVIDER: ${provider} (ollama 또는 anthropic)`,
        500,
      );
  }

  return cached;
}
