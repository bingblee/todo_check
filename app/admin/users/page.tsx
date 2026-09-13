import { asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { PageHeader } from "@/components/page-header";
import { CreateUserForm } from "@/components/create-user-form";
import { resetUserPasswordAction, toggleUserActiveAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const admin = await requireAdmin();
  const rows = await db.select().from(users).orderBy(asc(users.createdAt));
  return <main className="content-page"><div className="content-wrap">
    <PageHeader title="用户管理" />
    <section className="page-card">
      <p className="eyebrow">ADMIN</p><h1>账号管理</h1><p className="muted">应用不开放注册。请在这里创建账号，并通过安全方式把初始密码交给使用者。</p>
      <CreateUserForm />
      <table className="admin-table"><thead><tr><th>用户名</th><th>角色</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead><tbody>{rows.map((user) => <tr key={user.id}>
        <td><strong>{user.username}</strong>{user.id === admin.id && <span className="muted">（当前）</span>}</td><td>{user.role === "admin" ? "管理员" : "普通用户"}</td><td>{user.isActive ? "正常" : "已停用"}</td><td>{user.createdAt.slice(0, 10)}</td><td>{user.role !== "admin" && <div className="inline-actions">
          <form action={resetUserPasswordAction} style={{ display: "flex", gap: 6 }}><input type="hidden" name="userId" value={user.id} /><input className="input" style={{ minHeight: 38, width: 150, padding: "6px 9px" }} name="password" type="password" placeholder="新密码" required minLength={8} /><button className="button ghost small">重置</button></form>
          <form action={toggleUserActiveAction}><input type="hidden" name="userId" value={user.id} /><button className={`button small ${user.isActive ? "danger" : "secondary"}`}>{user.isActive ? "停用" : "启用"}</button></form>
        </div>}</td>
      </tr>)}</tbody></table>
    </section>
  </div></main>;
}
