import { getLlm, LlmError } from "@/lib/llm";
import { classify } from "@/lib/qa/classify";
import { DEMO_MODEL, demoClassify } from "@/lib/qa/demo-data";

export async function POST(req: Request) {
  let feedback: unknown;
  try {
    ({ feedback } = await req.json());
  } catch {
    return Response.json({ error: "JSON 본문이 필요해" }, { status: 400 });
  }

  if (typeof feedback !== "string" || feedback.trim() === "") {
    return Response.json({ error: "feedback이 필요해" }, { status: 400 });
  }

  try {
    const llm = getLlm();
    const { data, usage } = await classify(llm, feedback);
    return Response.json({
      result: data,
      usage,
      provider: llm.provider,
      model: llm.model,
    });
  } catch (e) {
    // 실시간 호출이 안 되면 예시 입력에 한해 미리 계산해둔 결과로 넘어간다.
    // 화면이 비어버리는 것보다 낫고, 응답에 demo 표시가 실려 나가므로
    // 지금 보는 게 실시간이 아니라는 사실이 숨겨지지 않는다.
    const cached = demoClassify(feedback);
    if (cached) {
      return Response.json({
        result: cached,
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
    return Response.json({ error: "분류 실패" }, { status: 500 });
  }
}

export const maxDuration = 60;
