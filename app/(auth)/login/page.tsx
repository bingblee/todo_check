"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";
import { SubmitButton } from "@/components/submit-button";

export default function LoginPage() {
  const [state, action] = useActionState(loginAction, null);
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand-mark">✓</div>
        <p className="eyebrow">拾光清单</p>
        <h1>欢迎回来</h1>
        <p className="muted">把想做的事，变成每天看得见的积累。</p>
        <form action={action} className="stack">
          <label className="field">用户名<input className="input" name="username" autoComplete="username" required /></label>
          <label className="field">密码<input className="input" name="password" type="password" autoComplete="current-password" required /></label>
          {state?.error && <div className="error" role="alert">{state.error}</div>}
          <SubmitButton pendingText="正在登录…">登录</SubmitButton>
        </form>
      </section>
    </main>
  );
}
