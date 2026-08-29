import { ReactNode } from "react";

/** Small-caps section header — "Recent news", "Squad", "Social", etc. */
export default function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="text-xs font-bold text-brand-heliotrope uppercase tracking-wider mb-2">{children}</h2>;
}
