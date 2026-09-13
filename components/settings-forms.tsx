"use client";

import { useActionState } from "react";
import { changePasswordAction, updateTimezoneAction } from "@/app/settings/actions";
import { SubmitButton } from "@/components/submit-button";

export function SettingsForms({ timezone }: { timezone: string }) {
  const [passwordState, passwordAction] = useActionState(changePasswordAction, null);
  const [timezoneState, timezoneAction] = useActionState(updateTimezoneAction, null);
  return <div className="summary-columns">
    <section className="summary-block"><h3>修改密码</h3><form action={passwordAction} className="stack"><label className="field">当前密码<input className="input" name="currentPassword" type="password" required /></label><label className="field">新密码<input className="input" name="newPassword" type="password" required minLength={8} /></label>{passwordState?.error && <div className="error">{passwordState.error}</div>}{passwordState?.success && <div className="success">{passwordState.success}</div>}<SubmitButton>更新密码</SubmitButton></form></section>
    <section className="summary-block"><h3>日期与时区</h3><p className="muted">每日打卡和总结的日期边界以此时区为准。</p><form action={timezoneAction} className="stack"><label className="field">IANA 时区<input className="input" name="timezone" defaultValue={timezone} placeholder="Asia/Shanghai" required /></label>{timezoneState?.error && <div className="error">{timezoneState.error}</div>}{timezoneState?.success && <div className="success">{timezoneState.success}</div>}<SubmitButton>保存时区</SubmitButton></form></section>
  </div>;
}
