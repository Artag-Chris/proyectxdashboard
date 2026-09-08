import type { VacancyStatus } from "@/lib/cv-types";

export const STATUS_LABEL: Record<VacancyStatus, string> = {
  RAW: "Cruda",
  NORMALIZED: "Normalizada",
  MATCHED: "Match",
  RESUME_READY: "HV lista",
  APPLIED: "Aplicada",
  IGNORED: "Ignorada",
};

export function StatusBadge({ status }: { status: VacancyStatus }) {
  const map: Record<VacancyStatus, string> = {
    RAW: "bg-gray-100 text-gray-600",
    NORMALIZED: "bg-blue-100 text-blue-700",
    MATCHED: "bg-amber-100 text-amber-700",
    RESUME_READY: "bg-green-100 text-green-700",
    APPLIED: "bg-violet-100 text-violet-700",
    IGNORED: "bg-gray-100 text-gray-400",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Score({ score }: { score: number | null }) {
  if (score === null) return <span className="text-zinc-300">—</span>;
  const color = score >= 80 ? "text-green-600" : score >= 60 ? "text-amber-600" : "text-red-500";
  return <span className={`text-sm font-bold ${color}`}>{score}</span>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-zinc-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
