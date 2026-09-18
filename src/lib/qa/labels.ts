import type { Category, Severity } from "./classify";

export const CATEGORY_LABEL: Record<Category, string> = {
  bug: "버그",
  balance: "밸런스",
  ux: "사용성",
  other: "기타",
};

export const CATEGORY_STYLE: Record<Category, string> = {
  bug: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  balance: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  ux: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  other: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "치명적",
  major: "중요",
  minor: "경미",
};

export const SEVERITY_STYLE: Record<Severity, string> = {
  critical: "bg-red-600 text-white",
  major: "bg-orange-500 text-white",
  minor: "bg-zinc-500 text-white",
};

/**
 * 막대 그래프용 색. 배지의 연한 배경색과 달리, 마크로 쓰이는 색이라
 * 별도 기준을 만족해야 한다. 이 네 값은 dataviz 검증기로
 * 라이트(#ffffff)·다크(#0a0a0a) 양쪽에서 모든 쌍을 검사해 통과시킨 조합이다.
 * 색각이상 분리도가 7.7(6~8 구간)이라 색만으로 구분시키면 안 되고,
 * 반드시 이름 레이블과 세그먼트 사이 간격을 함께 둬야 한다.
 */
export const CATEGORY_CHART_COLOR: Record<Category, string> = {
  bug: "#ec003f",
  balance: "#e17100",
  ux: "#0084d1",
  other: "#009E73",
};

export const CATEGORY_ORDER: Category[] = ["bug", "balance", "ux", "other"];
export const SEVERITY_ORDER: Severity[] = ["critical", "major", "minor"];
