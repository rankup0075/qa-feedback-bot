import { createAnthropicProvider } from "./anthropic";
import { createGeminiProvider } from "./gemini";
import { createOllamaProvider } from "./ollama";
import { LlmError, type LlmProvider } from "./types";

export * from "./types";

let cached: LlmProvider | null = null;

/**
 * 어떤 모델을 쓸지 고른다.
 *
 * - CLASSIFIER_PROVIDER가 있으면 그걸 따른다
 * - 없으면 키가 있는 클라우드 모델을, 그것도 없으면 로컬 ollama를 쓴다
 *
 * 개발은 로컬 모델로 공짜로 하고, 배포된 서버에서는 키만 넣으면
 * 코드 수정 없이 클라우드 모델로 넘어간다. Ollama는 이 컴퓨터에서만
 * 돌기 때문에 Vercel 같은 곳에서는 쓸 수 없다.
 */
export function getLlm(): LlmProvider {
  if (cached) return cached;

  const provider =
    process.env.CLASSIFIER_PROVIDER ??
    (process.env.ANTHROPIC_API_KEY
      ? "anthropic"
      : process.env.GEMINI_API_KEY
        ? "gemini"
        : "ollama");

  switch (provider) {
    case "ollama":
      cached = createOllamaProvider();
      break;
    case "anthropic":
      cached = createAnthropicProvider();
      break;
    case "gemini":
      cached = createGeminiProvider();
      break;
    default:
      throw new LlmError(
        `알 수 없는 CLASSIFIER_PROVIDER: ${provider} (ollama · gemini · anthropic)`,
        500,
      );
  }

  return cached;
}
