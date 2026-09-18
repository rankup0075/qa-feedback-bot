import { getLlm, LlmError } from "@/lib/llm";
import { classify } from "@/lib/qa/classify";

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
    if (e instanceof LlmError) {
      console.error(e.message, e.cause);
      return Response.json({ error: e.message }, { status: e.status });
    }
    console.error(e);
    return Response.json({ error: "분류 실패" }, { status: 500 });
  }
}
