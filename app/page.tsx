import { count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [{ total }] = await db.select({ total: count() }).from(users);
  if (total === 0) redirect("/setup");
  const user = await getCurrentUser();
  redirect(user ? "/app" : "/login");
}
