import type { Failure } from "@tea-pos/api-client/failures";
import { APP_TAG } from "@tea-pos/api-client/status";
import { useT } from "@tea-pos/i18n/react";
import { CopyButton } from "@tea-pos/ui/CopyButton";
import { Sheet } from "@tea-pos/ui/Sheet";
import { useSyncExternalStore } from "react";

export interface Problem {
    title: string;
    /** Our words for it. */
    text: string;
    failure?: Failure;
}

let open: Problem | null = null;
const listeners = new Set<() => void>();
const set = (p: Problem | null) => {
    open = p;
    listeners.forEach((fn) => fn());
};

/** Shows a failed request in full, to read or to send: opened by a toast's Details, or by a bug. */
export function openErrorSheet(problem: Problem) {
    set(problem);
}

/** Mounted once, by the shell. */
export function ErrorSheetHost() {
    const t = useT();
    const p = useSyncExternalStore(
        (fn) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        () => open,
    );
    const f = p?.failure;
    const at = f ? new Date(f.at) : new Date();
    const rows: [string, string][] = f
        ? [
              [t("errorSheet.time"), at.toLocaleString()],
              [t("errorSheet.request"), `${f.method} ${f.path}`],
              [t("errorSheet.status"), f.status ? String(f.status) : t("errorSheet.noAnswer")],
              ...(f.requestId
                  ? [[t("errorSheet.requestId"), f.requestId] as [string, string]]
                  : []),
              [t("errorSheet.app"), APP_TAG],
          ]
        : [[t("errorSheet.app"), APP_TAG]];
    const details = [
        p?.title,
        f?.status ? `${f.status} · ${f.code ?? "?"}` : "",
        p?.text,
        f?.message ?? "",
        ...rows.map(([k, v]) => `${k}: ${v}`),
    ]
        .filter(Boolean)
        .join("\n");
    return (
        <Sheet open={!!p} onClose={() => set(null)} title={p?.title ?? ""}>
            <div className="space-y-3 pb-2">
                {f?.status && (
                    <span className="inline-block rounded-md bg-red-100 px-2 py-0.5 font-mono text-xs font-semibold text-red-700">
                        {f.status} · {f.code ?? "?"}
                    </span>
                )}
                <div>
                    <p className="text-base font-medium text-gray-900">{p?.text}</p>
                    {f?.message && f.message !== p?.text && (
                        <p className="mt-0.5 text-sm text-gray-600">{f.message}</p>
                    )}
                </div>
                <div className="rounded-xl bg-slate-100 px-3 py-1 divide-y divide-slate-200">
                    {rows.map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-3 py-2 text-sm">
                            <span className="shrink-0 text-gray-700">{k}</span>
                            <span className="min-w-0 break-all text-right font-mono text-xs leading-5 text-gray-900">
                                {v}
                            </span>
                        </div>
                    ))}
                </div>
                <CopyButton
                    value={details}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3.5 font-semibold text-white active:opacity-80"
                >
                    {t("errorSheet.copy")}
                </CopyButton>
            </div>
        </Sheet>
    );
}
