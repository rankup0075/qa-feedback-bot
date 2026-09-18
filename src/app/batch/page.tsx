"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CategoryBadge, SeverityBadge } from "@/components/Badges";
import type { Category, ClassifyResult } from "@/lib/qa/classify";
import type { IssueGroup } from "@/lib/qa/group";
import {
  CATEGORY_CHART_COLOR,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
} from "@/lib/qa/labels";

const SAMPLE = `보스방 들어가자마자 가끔 캐릭터가 벽에 끼어서 못 움직여요. 재접속해야 풀림
3챕터 보스방에서 벽 사이에 캐릭터가 박혀버렸어요. 나가지지도 않고 그냥 갇힘
보스 방 입구 쪽 기둥에 끼면 이동이 안 됩니다. 로그아웃 말곤 방법이 없네요
3챕터 중간보스가 너무 세요. 같은 레벨 다른 보스들보다 체력이 3배는 되는 느낌이라 진도가 안 나갑니다
3챕터 보스 난이도 조정 좀 해주세요. 여기서만 20번 죽었습니다
세이브하고 껐다 켜니까 캐릭터 진행도가 통째로 날아갔습니다. 3시간 플레이한 게 사라졌어요
게임 종료 후 재접속하니 세이브 파일이 없어졌어요. 처음부터 다시 해야 합니다
인벤토리 정렬 버튼이 어디 있는지 한참 찾았어요. 아이콘만 있고 설명이 없어서 뭔지 모르겠더라고요
튜토리얼 스킵 버튼을 눌러도 다음 대사로 안 넘어가요
대화 중에 배경음악이 갑자기 끊깁니다
설정 화면에 "해상돗" 이라고 오타가 있어요
사람 많은 마을에서 프레임이 20까지 떨어집니다`;

type Item = { feedback: string; result: ClassifyResult };

type Phase =
  | { kind: "idle" }
  | { kind: "classifying"; done: number; total: number }
  | { kind: "grouping" }
  | { kind: "done" };


export default function BatchPage() {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [items, setItems] = useState<Item[]>([]);
  const [groups, setGroups] = useState<IssueGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ provider: string; model: string } | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const lines = useMemo(
    () => text.split("\n").map((l) => l.trim()).filter(Boolean),
    [text],
  );

  const busy = phase.kind === "classifying" || phase.kind === "grouping";

  const categoryCounts = useMemo(() => {
    const counts = new Map<Category, number>();
    for (const it of items) {
      counts.set(it.result.category, (counts.get(it.result.category) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  const criticalGroups = useMemo(
    () => groups?.filter((g) => g.severity === "critical").length ?? 0,
    [groups],
  );

  async function run() {
    if (lines.length === 0 || busy) return;

    setError(null);
    setItems([]);
    setGroups(null);
    setOpen(null);

    // 로컬 모델은 GPU 한 장을 쓰므로 한 번에 하나씩 보낸다.
    // 대신 결과가 나올 때마다 화면에 바로 반영해서 진행 상황이 보이게 한다.
    const collected: Item[] = [];
    for (let i = 0; i < lines.length; i++) {
      setPhase({ kind: "classifying", done: i, total: lines.length });
      try {
        const res = await fetch("/api/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback: lines[i] }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? `분류 실패 (${res.status})`);
          setPhase({ kind: "idle" });
          return;
        }
        setMeta({ provider: json.provider, model: json.model });
        collected.push({ feedback: lines[i], result: json.result });
        setItems([...collected]);
      } catch {
        setError("서버에 연결하지 못했어. npm run dev가 돌고 있는지 확인해줘.");
        setPhase({ kind: "idle" });
        return;
      }
    }

    setPhase({ kind: "grouping" });
    try {
      const res = await fetch("/api/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: collected.map((c) => c.result) }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `묶기 실패 (${res.status})`);
        setPhase({ kind: "idle" });
        return;
      }
      setGroups(json.groups as IssueGroup[]);
      setPhase({ kind: "done" });
    } catch {
      setError("묶는 중에 서버 연결이 끊겼어.");
      setPhase({ kind: "idle" });
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
      <header className="mb-8">
        <h1 className="text-2xl font-bold sm:text-3xl">피드백 일괄 분석</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          피드백을 한 줄에 하나씩 넣으면, 분류한 뒤 같은 문제끼리 묶어 많이 보고된
          순서로 보여줍니다.
        </p>
        <Link
          href="/"
          className="mt-3 inline-block text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
        >
          ← 하나씩 분류하기
        </Link>
      </header>

      <section>
        <label htmlFor="bulk" className="mb-2 block text-sm font-medium">
          피드백 <span className="font-normal text-zinc-500">(한 줄에 하나)</span>
        </label>
        <textarea
          id="bulk"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={"보스방에서 벽에 끼어요\n3챕터 보스가 너무 셉니다\n..."}
          className="w-full resize-y rounded-lg border border-zinc-300 bg-white p-3 font-mono text-xs leading-relaxed outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={run}
            disabled={busy || lines.length === 0}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
          >
            {busy ? "분석 중…" : `${lines.length}개 분석하기`}
          </button>
          <button
            onClick={() => setText(SAMPLE)}
            disabled={busy}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            예시 12개 넣기
          </button>
        </div>

        {lines.length > 0 && !busy && phase.kind !== "done" && (
          <p className="mt-2 text-xs text-zinc-500">
            분류는 한 건당 2초, 묶기는 30초쯤 걸려요. {lines.length}개면 약{" "}
            {lines.length * 2 + 30}초.
          </p>
        )}
      </section>

      {busy && (
        <section className="mt-8" aria-live="polite">
          <div className="mb-2 flex justify-between text-xs text-zinc-500">
            <span>
              {phase.kind === "classifying"
                ? `분류 중… ${phase.done} / ${phase.total}`
                : "같은 문제끼리 묶는 중… (30초쯤 걸려요)"}
            </span>
            {phase.kind === "classifying" && (
              <span>{Math.round((phase.done / phase.total) * 100)}%</span>
            )}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-zinc-900 transition-all dark:bg-white"
              style={{
                width:
                  phase.kind === "classifying"
                    ? `${(phase.done / phase.total) * 100}%`
                    : "100%",
              }}
            />
          </div>
        </section>
      )}

      {error && (
        <p className="mt-8 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {groups && (
        <>
          {/* 요약 지표 — 차트가 아니라 숫자 그대로가 가장 잘 읽히는 자리 */}
          <section className="mt-10 grid grid-cols-3 gap-3">
            <StatTile label="받은 피드백" value={items.length} />
            <StatTile label="실제 이슈" value={groups.length} />
            <StatTile label="치명적 이슈" value={criticalGroups} />
          </section>

          {/* 카테고리 분포 — 이름 레이블과 2px 간격이 색과 함께 카테고리를 구분한다 */}
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-medium">카테고리 분포</h2>
            <div className="flex h-3 w-full gap-[2px] overflow-hidden">
              {CATEGORY_ORDER.filter((c) => (categoryCounts.get(c) ?? 0) > 0).map((c) => (
                <div
                  key={c}
                  className="h-full rounded-[2px]"
                  style={{
                    width: `${((categoryCounts.get(c) ?? 0) / items.length) * 100}%`,
                    backgroundColor: CATEGORY_CHART_COLOR[c],
                  }}
                />
              ))}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
              {CATEGORY_ORDER.filter((c) => (categoryCounts.get(c) ?? 0) > 0).map((c) => (
                <li key={c} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="inline-block size-2.5 rounded-[2px]"
                    style={{ backgroundColor: CATEGORY_CHART_COLOR[c] }}
                    aria-hidden
                  />
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {CATEGORY_LABEL[c]}
                  </span>
                  <span className="font-medium tabular-nums">{categoryCounts.get(c)}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 이슈 목록 — 많이 보고된 순 */}
          <section className="mt-10">
            <h2 className="mb-3 text-sm font-medium">
              이슈 목록{" "}
              <span className="font-normal text-zinc-500">(많이 보고된 순)</span>
            </h2>
            <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {groups.map((g, gi) => (
                <li key={gi}>
                  <button
                    onClick={() => setOpen(open === gi ? null : gi)}
                    aria-expanded={open === gi}
                    className="flex w-full items-start gap-3 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <span className="mt-0.5 min-w-8 rounded bg-zinc-900 px-1.5 py-0.5 text-center text-xs font-bold tabular-nums text-white dark:bg-white dark:text-zinc-900">
                      {g.count}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{g.title}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <CategoryBadge value={g.category} />
                        <SeverityBadge value={g.severity} />
                      </span>
                    </span>
                    <span className="mt-1 text-xs text-zinc-400">
                      {open === gi ? "▲" : "▼"}
                    </span>
                  </button>

                  {open === gi && (
                    <ul className="space-y-3 pb-4 pl-11 pr-2">
                      {g.memberIndexes.map((mi) => (
                        <li
                          key={mi}
                          className="border-l-2 border-zinc-200 pl-3 dark:border-zinc-800"
                        >
                          <p className="text-xs text-zinc-500">원본 피드백</p>
                          <p className="mt-0.5 text-sm">{items[mi]?.feedback}</p>
                          {items[mi]?.result.reproSteps.length > 0 && (
                            <>
                              <p className="mt-2 text-xs text-zinc-500">재현 단계</p>
                              <ol className="mt-0.5 list-decimal space-y-0.5 pl-4 text-xs text-zinc-600 dark:text-zinc-400">
                                {items[mi].result.reproSteps.map((s, si) => (
                                  <li key={si}>{s}</li>
                                ))}
                              </ol>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {meta && (
            <p className="mt-6 text-xs text-zinc-500">
              {meta.provider} · {meta.model} · 피드백 {items.length}건 분류 후 묶기
            </p>
          )}
        </>
      )}

      {/* 묶기 전에도 분류된 것부터 보여준다 */}
      {!groups && items.length > 0 && (
        <section className="mt-8 space-y-2">
          {items.map((it, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex shrink-0 flex-wrap gap-1.5">
                <CategoryBadge value={it.result.category} />
                <SeverityBadge value={it.result.severity} />
              </div>
              <p className="text-sm">{it.result.summary}</p>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
