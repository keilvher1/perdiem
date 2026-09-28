"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { PageContainer } from "@/components/perdiem/page";
import { EmptyState, ErrorState, LoadingRows } from "@/components/perdiem/states";
import { useSelectedMandate } from "@/hooks/use-selected-mandate";

/** /audit without an id: jump to the selected mandate's audit. */
function AuditIndexInner() {
  const { id, mandates, error, refresh } = useSelectedMandate();
  const router = useRouter();
  useEffect(() => {
    if (id) router.replace(`/audit/${encodeURIComponent(id)}`);
  }, [id, router]);

  if (error && !mandates) return <ErrorState title="Couldn’t load mandates" error={error} onRetry={refresh} />;
  if (mandates && mandates.length === 0)
    return <EmptyState icon={ShieldCheck} title="Nothing to audit yet" description="Grant a mandate on the Principal page first." />;
  return <LoadingRows rows={3} />;
}

export default function AuditIndexPage() {
  return (
    <PageContainer>
      <Suspense fallback={<LoadingRows rows={3} />}>
        <AuditIndexInner />
      </Suspense>
    </PageContainer>
  );
}
