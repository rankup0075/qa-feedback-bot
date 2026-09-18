import { ClassifyError, getClassifier } from "@/lib/classify";

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
    const classifier = getClassifier();
    const { result, usage, provider, model } = await classifier.classify(feedback);
    return Response.json({ result, usage, provider, model });
  } catch (e) {
    if (e instanceof ClassifyError) {
      console.error(e.message, e.cause);
      return Response.json({ error: e.message }, { status: e.status });
    }
    console.error(e);
    return Response.json({ error: "분류 실패" }, { status: 500 });
  }
}
