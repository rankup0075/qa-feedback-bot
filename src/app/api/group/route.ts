import { getLlm, LlmError } from "@/lib/llm";
import { ClassifySchema } from "@/lib/qa/classify";
import { DEMO_MODEL, demoGroup } from "@/lib/qa/demo-data";
import { group } from "@/lib/qa/group";
import { z } from "zod";

const BodySchema = z.object({
  items: z.array(ClassifySchema).min(1).max(200),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON 본문이 필요해" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "분류된 이슈 목록(items)이 1~200개 필요해" },
      { status: 400 },
    );
  }

  try {
    const llm = getLlm();
    const { data, usage } = await group(llm, parsed.data.items);
    return Response.json({
      groups: data,
      usage,
      provider: llm.provider,
      model: llm.model,
    });
  } catch (e) {
    // 분류와 같은 규칙. 예시 12건 그대로일 때만 미리 계산해둔 묶음을 쓴다.
    const cached = demoGroup(parsed.data.items);
    if (cached) {
      return Response.json({
        groups: cached,
        usage: { inputTokens: 0, outputTokens: 0 },
        provider: "demo",
        model: DEMO_MODEL,
        demoReason: e instanceof LlmError ? e.message : "실시간 분석을 쓸 수 없음",
      });
    }

    if (e instanceof LlmError) {
      console.error(e.message, e.cause);
      return Response.json({ error: e.message }, { status: e.status });
    }
    console.error(e);
    return Response.json({ error: "묶기 실패" }, { status: 500 });
  }
}

// 묶기는 카테고리마다 모델을 두 번 부르므로 기본 제한으로는 모자랄 수 있다.
// Vercel 무료 플랜의 상한이 300초다.
export const maxDuration = 300;
