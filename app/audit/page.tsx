"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { PageContainer } from "@/components/perdiem/page";
import { EmptyState, ErrorState, LoadingRows } from "@/components/perdiem/states";
import { useSelectedMandate } from "@/hooks/use-selected-mandate";
import { useT } from "@/lib/i18n/provider";

/**
 * /audit without an id: jump to the selected mandate's audit (?m= picks it). Every other search
 * param is carried over, so /audit?m=man_A&d=led_002 lands on /audit/man_A?d=led_002.
 */
function AuditIndexInner() {
  const { id, mandates, error, refresh } = useSelectedMandate();
  const params = useSearchParams();
  const router = useRouter();
  const t = useT();
  useEffect(() => {
    if (!id) return;
    const sp = new URLSearchParams(params.toString());
    sp.delete("m");
    const qs = sp.toString();
    router.replace(`/audit/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`);
  }, [id, params, router]);

  if (error && !mandates) return <ErrorState title={t.audit.index.loadError} error={error} onRetry={refresh} />;
  if (mandates && mandates.length === 0)
    return <EmptyState icon={ShieldCheck} title={t.audit.index.emptyTitle} description={t.audit.index.emptyDescription} />;
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
