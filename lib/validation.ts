import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "用户名至少 3 个字符")
  .max(32, "用户名最多 32 个字符")
  .regex(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, "仅支持中文、字母、数字和下划线");

export const passwordSchema = z
  .string()
  .min(8, "密码至少 8 个字符")
  .max(128, "密码过长")
  .regex(/[A-Za-z]/, "密码需包含字母")
  .regex(/\d/, "密码需包含数字");

export function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
