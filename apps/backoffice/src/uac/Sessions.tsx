import { formatDay } from "@tea-pos/format";
import { useLocale, useT } from "@tea-pos/i18n/react";
import { useMe } from "@tea-pos/api-client/me";
import { ConfirmSheet } from "@tea-pos/shell/FormFooter";
import { HeaderTitle } from "@tea-pos/shell/HeaderActions";
import { SettingsGroup } from "@tea-pos/shell/Settings";
import { useAccess, useSlug } from "@tea-pos/shell/tenant";
import { Badge } from "@tea-pos/ui/Badge";
import { Skeleton } from "@tea-pos/ui/Skeleton";
import { toast } from "@tea-pos/ui/toast";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Laptop, LogOut, Smartphone } from "lucide-react";
import { useState, type ReactNode } from "react";

import {
    useEndSession,
    useLogoutPerson,
    useUacPerson,
    useUacSessions,
    type Person,
    type Session,
} from "./uac";

/** Who may end a person's sessions: admins, and only the owner the owner's. */
function useCanEnd(p: Person) {
    const { canWrite, owner } = useAccess();
    return canWrite && (!p.owner || owner);
}

const LOOPBACK = new Set(["::1", "127.0.0.1"]);

// "Today" and "Yesterday" mid-sentence; a date stays as it is.
const day = (d: string) => (/\d/.test(d) ? d : d.toLowerCase());

/** One session: the device and app, when it was last used and from where. */
function SessionRow({ session: s, right }: { session: Session; right?: ReactNode }) {
    const t = useT();
    const locale = useLocale();
    const phone = /iPhone|Android|iPad/.test(s.device ?? "");
    const Icon = phone ? Smartphone : Laptop;
    const details = [
        t(s.app === "seller" ? "uac.seller" : "uac.office"),
        t("uac.activeOn").replace("{day}", day(formatDay(s.lastSeenAt, locale))),
        // A session made on a laptop against staging has no outside address: nothing to show.
        s.ip && !LOOPBACK.has(s.ip) ? s.ip : "",
    ].filter(Boolean);
    return (
        <div className="flex items-center gap-3 border-b-2 border-slate-100 py-3.5 last:border-b-0">
            <Icon size={22} strokeWidth={2} className="shrink-0 text-gray-900" />
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="truncate text-base font-medium text-gray-900">
                        {s.device || t("uac.unknownDevice")}
                    </p>
                    {s.current && <Badge>{t("uac.thisDevice")}</Badge>}
                </div>
                <p className="truncate text-xs text-gray-500">{details.join(" · ")}</p>
            </div>
            {right}
        </div>
    );
}

/** On a person's page: where they are signed in, read only; Manage › ends one. Admins only. */
export function SessionsCard({ person: p }: { person: Person }) {
    const t = useT();
    const slug = useSlug();
    const canEnd = useCanEnd(p);
    const { data, isError } = useUacSessions(p.id);
    return (
        <SettingsGroup title={t("uac.sessions")}>
            {isError && !data ? (
                <p className="py-4 text-sm text-gray-500">{t("common.failed")}</p>
            ) : !data ? (
                <Skeleton className="my-3 h-12 rounded-xl" />
            ) : data.sessions.length === 0 ? (
                <p className="py-4 text-sm text-gray-500">{t("uac.noSessions")}</p>
            ) : (
                data.sessions.map((s) => <SessionRow key={s.id} session={s} />)
            )}
            {canEnd && !!data?.sessions.length && (
                <Link
                    to="/$tenant/uac/$userId/sessions"
                    params={{ tenant: slug, userId: p.id }}
                    className="-mx-4 flex items-center justify-end gap-1 border-t-2 border-slate-100 px-4 py-3.5 text-sm font-semibold text-brand active:bg-gray-50"
                >
                    {t("uac.manageSessions")}
                    <ChevronRight size={18} strokeWidth={2.5} />
                </Link>
            )}
        </SettingsGroup>
    );
}

/** A person's sessions, each ended on its own, or all at once (which asks first). */
export function SessionsPage({ userId }: { userId: string }) {
    const t = useT();
    const { data: p } = useUacPerson(userId);
    const { data } = useUacSessions(userId);
    const self = useMe().data?.user.id === userId;
    if (!p || !data) return <Skeleton className="h-60 rounded-2xl" />;
    return (
        <div className="space-y-4">
            <HeaderTitle>{p.name}</HeaderTitle>
            <SettingsGroup>
                {data.sessions.length === 0 ? (
                    <p className="py-4 text-sm text-gray-500">{t("uac.noSessions")}</p>
                ) : (
                    data.sessions.map((s) => <EndRow key={s.id} person={p} session={s} />)
                )}
                {!self && data.sessions.length > 0 && <Everywhere person={p} />}
            </SettingsGroup>
        </div>
    );
}

function EndRow({ person: p, session: s }: { person: Person; session: Session }) {
    const t = useT();
    const end = useEndSession(p.id);
    const canEnd = useCanEnd(p);
    return (
        <SessionRow
            session={s}
            right={
                canEnd &&
                !s.current && (
                    <button
                        disabled={end.isPending}
                        onClick={() =>
                            end.mutate(
                                { sessionId: s.id },
                                {
                                    onSuccess: () =>
                                        toast(
                                            t("uac.sessionEnded").replace(
                                                "{device}",
                                                s.device || t("uac.unknownDevice"),
                                            ),
                                            { kind: "success" },
                                        ),
                                },
                            )
                        }
                        className="shrink-0 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600 active:opacity-70 disabled:opacity-50"
                    >
                        {t("uac.logoutOne")}
                    </button>
                )
            }
        />
    );
}

/** Every app on every phone: for a lost phone. They can sign in again unless turned off too. */
function Everywhere({ person: p }: { person: Person }) {
    const t = useT();
    const logout = useLogoutPerson(p.id);
    const canEnd = useCanEnd(p);
    const [asking, setAsking] = useState(false);
    if (!canEnd) return null;
    return (
        // Inside the card, under the last row's divider, as App info's Update now.
        <div className="py-3.5">
            <button
                onClick={() => setAsking(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white active:opacity-80"
            >
                <LogOut size={16} strokeWidth={2.5} />
                {t("uac.logoutEverywhere")}
            </button>
            <ConfirmSheet
                open={asking}
                title={t("uac.logoutTitle").replace("{name}", p.name)}
                message={t("uac.logoutBody")}
                label={t("uac.logoutEverywhere")}
                busyLabel={t("uac.saving")}
                tone="orange"
                onConfirm={async () => {
                    await logout.mutateAsync({});
                    setAsking(false);
                    toast(t("uac.loggedOut").replace("{name}", p.name), { kind: "success" });
                }}
                onError={() => setAsking(false)}
                onCancel={() => setAsking(false)}
            />
        </div>
    );
}
