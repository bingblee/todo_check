"use client";

import { useActionState } from "react";
import { createUserAction } from "@/app/admin/users/actions";
import { SubmitButton } from "@/components/submit-button";

export function CreateUserForm() {
  const [state, action] = useActionState(createUserAction, null);
  return <form action={action} className="stack" style={{ marginBottom: 30 }}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, alignItems: "end" }}>
      <label className="field">用户名<input className="input" name="username" required minLength={3} /></label>
      <label className="field">初始密码<input className="input" name="password" type="password" required minLength={8} /></label>
      <SubmitButton pendingText="创建中…">创建账号</SubmitButton>
    </div>
    {state?.error && <div className="error">{state.error}</div>}
    {state?.success && <div className="success">{state.success}</div>}
  </form>;
}
