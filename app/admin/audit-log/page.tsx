import { Suspense } from "react";
import { TriangleAlert } from "lucide-react";
import { PageMain } from "../_components/page-main";
import { PageHeader } from "../_components/page-header";
import { requireAuditAccess } from "@/src/lib/session";
import { listAudit, type AuditEntry } from "@/src/lib/audit-log";

const dateTime = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

export default function AuditLogPage() {
  return (
    <PageMain>
      <Suspense fallback={<AuditSkeleton />}>
        <Content />
      </Suspense>
    </PageMain>
  );
}

async function Content() {
  await requireAuditAccess();

  let entries: AuditEntry[];
  try {
    entries = await listAudit(200);
  } catch (err) {
    console.error("[audit-log]", err);
    return (
      <>
        <PageHeader title="Audit Log" subtitle="Ilao's Microbakery" />
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-separator bg-card p-4 text-[15px] text-red-600 shadow-sm">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          Couldn&apos;t load the audit log.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Audit Log" subtitle="Ilao's Microbakery" />
      <ul className="divide-y divide-separator overflow-hidden rounded-xl border border-separator bg-card shadow-sm">
        {entries.length === 0 ? (
          <li className="px-4 py-6 text-center text-[15px] text-label2">No changes recorded yet.</li>
        ) : (
          entries.map((a) => (
            <li key={a.id} className="flex flex-col gap-0.5 px-4 py-3">
              <p className="text-[15px]">{a.actor} · {a.action} · {a.module}</p>
              <p className="text-[13px] text-label2">{dateTime.format(new Date(a.createdAt))}</p>
            </li>
          ))
        )}
      </ul>
    </>
  );
}

function AuditSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5 pt-2" aria-busy aria-label="Loading audit log">
      <div className="h-14 w-40 rounded-xl bg-fill" />
      <div className="h-64 rounded-xl bg-fill" />
    </div>
  );
}
