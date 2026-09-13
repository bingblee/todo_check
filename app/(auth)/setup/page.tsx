"use client";

import { useActionState } from "react";
import { setupAction } from "../actions";
import { SubmitButton } from "@/components/submit-button";

export default function SetupPage() {
  const [state, action] = useActionState(setupAction, null);
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">✓</div>
        <p className="eyebrow">首次启动</p>
        <h1>创建管理员</h1>
        <p className="muted">这是唯一一次开放的初始化入口。创建后，你可以在后台为其他人开通账号。</p>
        <form action={action} className="stack">
          <label className="field">管理员用户名<input className="input" name="username" autoComplete="username" required minLength={3} /></label>
          <label className="field">密码<input className="input" name="password" type="password" autoComplete="new-password" required minLength={8} /></label>
          <p className="muted" style={{ fontSize: 12 }}>至少 8 位，包含字母和数字。</p>
          {state?.error && <div className="error" role="alert">{state.error}</div>}
          <SubmitButton pendingText="正在初始化…">创建并进入</SubmitButton>
        </form>
      </section>
    </main>
  );
}
