import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { SettingsForms } from "@/components/settings-forms";
import { logoutAction } from "@/app/(auth)/actions";

export default async function SettingsPage() {
  const user = await requireUser();
  return <main className="content-page"><div className="content-wrap"><PageHeader title="设置" /><section className="page-card"><p className="eyebrow">SETTINGS</p><h1>{user.username}</h1><p className="muted">账号、安全、管理功能都集中在这里。</p>
    <div className="settings-links">
      {user.role === "admin" && <Link href="/admin/users" className="settings-link"><div><strong>用户管理</strong><small>创建账号、重置密码或停用用户</small></div><span>→</span></Link>}
      <form action={logoutAction}><button className="settings-link" style={{ width: "100%", cursor: "pointer", color: "var(--danger)" }}><div><strong>退出登录</strong><small>结束当前设备上的登录会话</small></div><span>→</span></button></form>
    </div>
    <SettingsForms timezone={user.timezone} />
  </section></div></main>;
}
