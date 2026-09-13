import { count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function SetupLayout({ children }: { children: React.ReactNode }) {
  const [{ total }] = await db.select({ total: count() }).from(users);
  if (total > 0) redirect("/login");
  return children;
}
