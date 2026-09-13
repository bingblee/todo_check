import Link from "next/link";

export function PageHeader({ title, trailing }: { title: string; trailing?: React.ReactNode }) {
  return <header className="page-nav">
    <Link href="/app" className="brand"><span className="brand-mark">✓</span><span>{title}</span></Link>
    <div className="inline-actions">{trailing}<Link href="/app" className="button ghost small">返回今日</Link></div>
  </header>;
}
