import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const client = new Anthropic(); // .env.local의 ANTHROPIC_API_KEY를 자동으로 읽음

const ResultSchema = z.object({
  category: z.enum(["bug", "balance", "ux", "other"]),
  severity: z.enum(["critical", "major", "minor"]),
  summary: z.string(),
  reproSteps: z.array(z.string()),
});

const SYSTEM = `너는 게임 QA 담당자야. 플레이테스터 피드백을 분석해서 분류해.
- category: 크래시/버그는 bug, 난이도나 수치 문제는 balance, 조작감이나 UI 불편은 ux, 나머지는 other
- severity: 진행 불가나 데이터 손실은 critical, 주요 기능이 망가지면 major, 사소한 불편은 minor
- summary: 한 줄 요약
- reproSteps: 피드백에서 읽어낼 수 있는 재현 단계. 알 수 없으면 빈 배열.`;

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
    const msg = await client.messages.parse({
      model: "claude-haiku-4-5", // 분류 작업은 빠르고 싼 모델로 충분
      max_tokens: 1000,
      system: SYSTEM,
      messages: [{ role: "user", content: feedback }],
      output_config: { format: zodOutputFormat(ResultSchema) },
    });

    // 스키마를 지켰더라도 max_tokens에 걸려 잘리면 parsed_output이 null이 됨
    if (!msg.parsed_output) {
      return Response.json(
        { error: "분류 결과를 파싱하지 못했어", stopReason: msg.stop_reason },
        { status: 502 },
      );
    }

    return Response.json({ result: msg.parsed_output, usage: msg.usage });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "요청이 몰렸어. 잠시 후 다시" }, { status: 429 });
    }
    if (e instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "API 키가 없거나 잘못됐어" }, { status: 500 });
    }
    console.error(e);
    return Response.json({ error: "분류 실패" }, { status: 500 });
  }
}
