"use server";

import { and, count, eq, gte } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiUsage, summaries } from "@/lib/db/schema";
import { getSummarySnapshot } from "@/lib/summary-data";
import { localDateInTimeZone } from "@/lib/dates";

const contentSchema = z.object({
  headline: z.string().min(1).max(80),
  overview: z.string().min(1).max(600),
  highlights: z.array(z.string().max(200)).max(5),
  improvements: z.array(z.string().max(200)).max(5),
  nextAction: z.string().min(1).max(300),
});

export type GenerateState = { ok?: boolean; error?: string } | null;

export async function generateSummaryAction(_: GenerateState, formData: FormData): Promise<GenerateState> {
  const user = await requireUser();
  const period = formData.get("period") === "week" ? "week" : "day";
  const anchorDate = String(formData.get("anchorDate") ?? "");
  const themeId = String(formData.get("themeId") ?? "") || undefined;
  const force = formData.get("force") === "true";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) return { error: "日期格式不正确" };
  const snapshot = await getSummarySnapshot(user.id, period, anchorDate, themeId, localDateInTimeZone(user.timezone));
  if (themeId && snapshot.themes.length === 0) return { error: "没有权限访问该主题" };
  if (snapshot.cached?.sourceHash === snapshot.sourceHash && !force) return { ok: true };
  if (!process.env.DEEPSEEK_API_KEY) return { error: "服务器尚未配置 DEEPSEEK_API_KEY" };

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [{ total }] = await db.select({ total: count() }).from(aiUsage).where(and(eq(aiUsage.userId, user.id), gte(aiUsage.createdAt, startOfDay.toISOString())));
  const limit = Number(process.env.AI_DAILY_LIMIT ?? 10);
  if (total >= limit) return { error: `今天已达到 ${limit} 次生成上限` };

  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";
  try {
    const response = await fetch(`${process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com"}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify({
        model,
        thinking: { type: "disabled" },
        messages: [
          { role: "system", content: "你是温和、具体的习惯复盘助手。根据用户真实打卡统计生成简洁中文总结，不虚构事实，不批评用户。必须输出 json，格式为 {\"headline\":string,\"overview\":string,\"highlights\":string[],\"improvements\":string[],\"nextAction\":string}。" },
          { role: "user", content: `总结周期：${snapshot.startDate} 至 ${snapshot.endDate}\n统计数据：${JSON.stringify(snapshot.stats)}` },
        ],
        response_format: { type: "json_object" },
        max_tokens: 900,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new Error(`DeepSeek ${response.status}`);
    const result = await response.json();
    const raw = result?.choices?.[0]?.message?.content;
    const content = contentSchema.parse(JSON.parse(raw));
    const now = new Date().toISOString();
    db.transaction((tx) => {
      if (snapshot.cached) {
        tx.update(summaries).set({ sourceHash: snapshot.sourceHash, statsJson: JSON.stringify(snapshot.stats), contentJson: JSON.stringify(content), model, updatedAt: now }).where(eq(summaries.id, snapshot.cached.id)).run();
      } else {
        tx.insert(summaries).values({ id: randomUUID(), userId: user.id, period, startDate: snapshot.startDate, endDate: snapshot.endDate, themeId: themeId ?? null, sourceHash: snapshot.sourceHash, statsJson: JSON.stringify(snapshot.stats), contentJson: JSON.stringify(content), model, createdAt: now, updatedAt: now }).run();
      }
      tx.insert(aiUsage).values({ id: randomUUID(), userId: user.id, createdAt: now }).run();
    });
    revalidatePath("/summary");
    return { ok: true };
  } catch (error) {
    console.error("DeepSeek summary failed", error);
    return { error: "AI 总结生成失败，统计数据已保留，请稍后重试" };
  }
}
