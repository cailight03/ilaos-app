import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header className={`flex items-start justify-between pt-2 lg:justify-end lg:pt-0 ${children ? "" : "lg:hidden"}`}>
      <div className="lg:hidden">
        <h1 className="text-[34px] leading-10 font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-[15px] text-label2">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}
