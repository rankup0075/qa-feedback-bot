import type { Category, Severity } from "@/lib/qa/classify";
import {
  CATEGORY_LABEL,
  CATEGORY_STYLE,
  SEVERITY_LABEL,
  SEVERITY_STYLE,
} from "@/lib/qa/labels";

const BASE = "rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap";

export function CategoryBadge({ value }: { value: Category }) {
  return <span className={`${BASE} ${CATEGORY_STYLE[value]}`}>{CATEGORY_LABEL[value]}</span>;
}

export function SeverityBadge({ value }: { value: Severity }) {
  return <span className={`${BASE} ${SEVERITY_STYLE[value]}`}>{SEVERITY_LABEL[value]}</span>;
}
