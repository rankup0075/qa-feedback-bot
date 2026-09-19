"use client";

import Link from "next/link";
import { useState } from "react";
import { CategoryBadge, SeverityBadge } from "@/components/Badges";
import { DemoNotice } from "@/components/DemoNotice";
import type { ClassifyResult } from "@/lib/qa/classify";

type ApiResponse = {
  result: ClassifyResult;
  usage: { inputTokens: number; outputTokens: number };
  provider: string;
  model: string;
  demoReason?: string;
};

const SAMPLES = [
  "보스방 들어가자마자 가끔 캐릭터가 벽에 끼어서 못 움직여요. 재접속해야 풀림",
  "3챕터 중간보스가 너무 세요. 같은 레벨 다른 보스들보다 체력이 3배는 되는 느낌이라 진도가 안 나갑니다.",
  "인벤토리 정렬 버튼이 어디 있는지 한참 찾았어요. 아이콘만 있고 설명이 없어서 뭔지 모르겠더라고요.",
  "세이브하고 껐다 켜니까 캐릭터 진행도가 통째로 날아갔습니다. 3시간 플레이한 게 사라졌어요.",
];

export default function Home() {
  const [feedback, setFeedback] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function classify() {
    if (!feedback.trim() || loading) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? `요청 실패 (${res.status})`);
        return;
      }
      setData(json as ApiResponse);
    } catch {
      setError("서버에 연결하지 못했어. 터미널에서 npm run dev가 돌고 있는지 확인해줘.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
      <header className="mb-8">
        <h1 className="text-2xl font-bold sm:text-3xl">QA 피드백 분류기</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          플레이테스터 피드백을 붙여넣으면 AI가 분류하고 재현 단계를 정리해줍니다.
        </p>
        <Link
          href="/batch"
          className="mt-3 inline-block text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
        >
          여러 개 한 번에 분석하기 →
        </Link>
      </header>

      <section>
        <label htmlFor="feedback" className="mb-2 block text-sm font-medium">
          피드백
        </label>
        <textarea
          id="feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) classify();
          }}
          rows={5}
          placeholder="예) 보스방 들어가자마자 캐릭터가 벽에 끼어서 못 움직여요"
          className="w-full resize-y rounded-lg border border-zinc-300 bg-white p-3 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={classify}
            disabled={loading || !feedback.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
          >
            {loading ? "분류 중…" : "분류하기"}
          </button>
          <span className="text-xs text-zinc-500">Ctrl + Enter</span>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs text-zinc-500">예시로 채우기</p>
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((s, i) => (
              <button
                key={i}
                onClick={() => setFeedback(s)}
                className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                예시 {i + 1}
              </button>
            ))}
          </div>
        </div>
      </section>

      {error && (
        <p className="mt-8 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {data && (
        <section className="mt-8 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge value={data.result.category} />
            <SeverityBadge value={data.result.severity} />
          </div>

          <h2 className="mt-4 text-base font-semibold">{data.result.summary}</h2>

          <div className="mt-4">
            <h3 className="text-xs font-medium text-zinc-500">재현 단계</h3>
            {data.result.reproSteps.length > 0 ? (
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                {data.result.reproSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">
                피드백에서 재현 단계를 알 수 없음
              </p>
            )}
          </div>

          <footer className="mt-5 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
            {data.provider === "demo" ? (
              <>미리 계산된 결과 · {data.model}</>
            ) : (
              <>
                {data.provider} · {data.model} · 토큰 {data.usage.inputTokens} in /{" "}
                {data.usage.outputTokens} out
              </>
            )}
          </footer>
        </section>
      )}

      {data?.provider === "demo" && (
        <DemoNotice model={data.model} reason={data.demoReason} />
      )}
    </main>
  );
}
