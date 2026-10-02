"use client";

import Link from "next/link";
import { Badge, Button, Card, Empty, ErrorBox, Loading, fmtDateTime } from "@/lib/social-ui";
import { docsApi } from "@/lib/docs-api";
import { usePoll } from "@/lib/usePoll";
import { FORMAT_LABEL, OPERATION_LABEL, STATUS_LABEL, STATUS_TONE } from "@/lib/docs-ui";
import type { DocJob, UsageSummary } from "@/lib/docs-types";

export default function DocsHomePage() {
  const jobs = usePoll(() => docsApi.get<DocJob[]>("/jobs"), 5000);
  const usage = usePoll(() => docsApi.get<UsageSummary>("/usage"), 15000);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Documentos</h1>
          <p className="text-sm text-zinc-500">
            Subí un documento, dejá que la IA lo transforme y descargalo en Word, PDF o Excel.
          </p>
        </div>
        <Link href="/docs/nuevo">
          <Button>+ Nuevo documento</Button>
        </Link>
      </div>

      <ErrorBox message={jobs.error} />

      {usage.data && (
        <Card>
          <p className="text-xs text-zinc-500">
            Gasto de IA acumulado:{" "}
            <span className="font-semibold text-zinc-700">
              ${usage.data.total.costUsd.toFixed(4)}
            </span>{" "}
            · {usage.data.total.calls} llamadas · {usage.data.total.tokensIn + usage.data.total.tokensOut}{" "}
            tokens
          </p>
        </Card>
      )}

      {!jobs.data && !jobs.error && <Loading />}
      {jobs.data && jobs.data.length === 0 && (
        <Card>
          <Empty>
            Todavía no hay documentos. Empezá con <b>Nuevo documento</b>.
          </Empty>
        </Card>
      )}

      <div className="space-y-2">
        {(jobs.data ?? []).map((job) => (
          <Link key={job.id} href={`/docs/${job.id}`} className="block">
            <Card className="transition-colors hover:border-emerald-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[job.status]}>{STATUS_LABEL[job.status]}</Badge>
                    <span className="font-medium">{OPERATION_LABEL[job.operation]}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {job.content?.title || job.instruction || "Sin título"} ·{" "}
                    {fmtDateTime(job.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {job.targetFormats.map((format) => (
                    <Badge key={format} tone="blue">
                      {FORMAT_LABEL[format]}
                    </Badge>
                  ))}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
