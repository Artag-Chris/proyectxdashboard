"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-4">
        <h2 className="text-xl font-semibold">Algo sali&oacute; mal</h2>
        <p className="text-zinc-500 text-sm">
          Ocurri&oacute; un error inesperado al cargar esta secci&oacute;n.
        </p>
        <button
          onClick={() => unstable_retry()}
          className="px-4 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 transition-colors"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
