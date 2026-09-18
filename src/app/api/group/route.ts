import { getLlm, LlmError } from "@/lib/llm";
import { ClassifySchema } from "@/lib/qa/classify";
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
    if (e instanceof LlmError) {
      console.error(e.message, e.cause);
      return Response.json({ error: e.message }, { status: e.status });
    }
    console.error(e);
    return Response.json({ error: "묶기 실패" }, { status: 500 });
  }
}
