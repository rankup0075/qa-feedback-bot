/**
 * 실시간 분석 대신 미리 계산해둔 결과를 보여주고 있을 때 띄운다.
 * 결과만 보여주고 출처를 감추면 데모가 아니라 속임수가 된다.
 */
export function DemoNotice({ model, reason }: { model: string; reason?: string }) {
  return (
    <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <strong className="font-semibold">미리 계산해둔 결과입니다.</strong>{" "}
      지금 AI를 호출한 것이 아니라, 같은 코드로 <code>{model}</code>에서 돌려
      저장해둔 값을 보여주고 있어요. 예시 입력에만 준비돼 있습니다.
      {reason && <span className="block mt-1 opacity-75">이유: {reason}</span>}
    </div>
  );
}
