"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { generateSummaryAction } from "@/app/summary/actions";
import { SubmitButton } from "@/components/submit-button";

export function GenerateSummary({ period, anchorDate, themeId, force, stale }: { period: "day" | "week"; anchorDate: string; themeId?: string; force?: boolean; stale?: boolean }) {
  const [state, action] = useActionState(generateSummaryAction, null);
  const router = useRouter();
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  return <form action={action}>
    <input type="hidden" name="period" value={period} />
    <input type="hidden" name="anchorDate" value={anchorDate} />
    <input type="hidden" name="themeId" value={themeId ?? ""} />
    <input type="hidden" name="force" value={force ? "true" : "false"} />
    <SubmitButton pendingText="AI 正在回顾…">{stale ? "数据有变化，更新总结" : force ? "重新生成" : "生成 AI 总结"}</SubmitButton>
    {state?.error && <div className="error" style={{ marginTop: 10 }}>{state.error}</div>}
  </form>;
}
