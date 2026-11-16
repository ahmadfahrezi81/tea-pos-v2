import { useNavigate, useRouter } from "@tanstack/react-router";
import { Sheet } from "@tea-pos/ui/Sheet";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { FooterSlot } from "../frame/FooterSlotContext";
import { HeaderTitle } from "../frame/HeaderActions";
import { useSlug } from "../session/tenant";
import { judge, type Verdict } from "../frame/screen/judge";
import { Recorder, type Sample } from "../frame/screen/measure";

/**
 * The Screen lab (task 073): each case run for real on this phone and judged by the same rules
 * on every phone. A page cannot open the keyboard or the photo picker by itself, so each case is
 * the owner's taps; the lab records every frame from Start to Finish and says why it failed.
 * A tool for the owner and Claude, in English only; staging and the dev server, never production.
 */

interface Case {
    id: string;
    title: string;
    steps: string;
    control?: () => ReactNode;
    /** A focus screen: the header may slide away to fit the field (a code at the bottom). */
    focus?: boolean;
}

const field =
    "w-full rounded-xl bg-white px-4 py-3 text-[16px] text-gray-900 outline-none ring-1 ring-slate-200";

const CASES: Case[] = [
    {
        id: "keyboard-top",
        title: "Keyboard: a field at the top",
        steps: "Tap the field, type a little, then tap Finish.",
        control: () => <input className={field} placeholder="Like a search box" />,
    },
    {
        id: "keyboard-middle",
        title: "Keyboard: a field in the middle",
        steps: "Scroll so the field is in the middle of the screen, tap it, then tap Finish.",
        control: () => (
            <div className="pt-[35vh]">
                <input className={field} placeholder="A form's field" />
            </div>
        ),
    },
    {
        id: "keyboard-bottom",
        title: "Keyboard: the box at the bottom (as chat)",
        steps: "Tap the box at the bottom, type a little, then tap Finish.",
        control: () => (
            <FooterSlot>
                <div className="bg-white px-3 py-2">
                    <input className={field} placeholder="Like chat's message box" />
                </div>
            </FooterSlot>
        ),
    },
    {
        id: "keyboard-focus",
        title: "Keyboard: a code at the bottom (focus screen)",
        steps: "Tap the code field at the bottom, then tap Finish. The header may move here; the field must stay above the keyboard.",
        focus: true,
        control: () => (
            <div className="flex min-h-[70vh] flex-col justify-end gap-3">
                <input
                    className={field}
                    inputMode="numeric"
                    placeholder="Like the store's opening code"
                />
                <button
                    type="button"
                    className="w-full rounded-xl bg-brand py-3 font-semibold text-white"
                >
                    Open the store
                </button>
            </div>
        ),
    },
    {
        id: "keyboard-switch",
        title: "Keyboard: one field to the next",
        steps: "Tap the first field, then the second, then tap Finish.",
        control: () => (
            <div className="space-y-3">
                <input className={field} placeholder="First" />
                <input className={field} placeholder="Second" />
            </div>
        ),
    },
    {
        id: "keyboard-close",
        title: "Keyboard: closing it",
        steps: "Tap the field, then close the keyboard (Done, or tap outside, or scroll), then tap Finish.",
        control: () => <input className={field} placeholder="Open, then close" />,
    },
    {
        id: "photo-cancel",
        title: "Photo picker, cancelled",
        steps: "Tap Choose a photo, cancel it, then tap Finish.",
        control: () => <PickButton label="Choose a photo" />,
    },
    {
        id: "photo-chosen",
        title: "Photo picker, a photo chosen",
        steps: "Tap Choose a photo, pick one, then tap Finish.",
        control: () => <PickButton label="Choose a photo" />,
    },
    {
        id: "camera",
        title: "Camera, cancelled",
        steps: "Tap Open the camera, cancel it, then tap Finish.",
        control: () => <PickButton label="Open the camera" camera />,
    },
    {
        id: "sheet",
        title: "Our bottom sheet",
        steps: "Tap Open the sheet, close it, then tap Finish.",
        control: () => <SheetButton />,
    },
    {
        id: "background",
        title: "To the background and back",
        steps: "Go to the home screen, wait a few seconds, come back, then tap Finish.",
    },
    {
        id: "rotate",
        title: "Rotate and back",
        steps: "Turn the phone sideways, then upright again, then tap Finish.",
    },
];

function PickButton({ label, camera = false }: { label: string; camera?: boolean }) {
    return (
        <label className="block w-full rounded-xl bg-white py-3 text-center font-semibold text-gray-900 ring-1 ring-slate-200 active:bg-slate-50">
            {label}
            <input
                type="file"
                accept="image/*"
                capture={camera ? "environment" : undefined}
                className="hidden"
            />
        </label>
    );
}

function SheetButton() {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="w-full rounded-xl bg-white py-3 font-semibold text-gray-900 ring-1 ring-slate-200"
            >
                Open the sheet
            </button>
            <Sheet open={open} onClose={() => setOpen(false)} title="A sheet">
                <p className="pb-6 text-gray-700">Close it by the X, or by dragging it down.</p>
            </Sheet>
        </>
    );
}

interface Result {
    id: string;
    title: string;
    verdict: Verdict;
    samples: number;
    /** Every frame that changed, compact (TIMELINE's columns), for designing the fixes. */
    timeline: number[][];
}

/** The timeline's columns, in the report once. */
const TIMELINE = ["t", "page", "visible", "offset", "scrollY", "headerTop", "fieldBottom"];
/** A run's frames, at most this many (evenly thinned past it). */
const MAX_FRAMES = 80;

function timelineOf(samples: Sample[]): number[][] {
    const step = Math.max(1, Math.ceil(samples.length / MAX_FRAMES));
    return samples
        .filter((_, i) => i % step === 0 || i === samples.length - 1)
        .map((s) => [s.t, s.page, s.visible, s.offset, s.scrollY, s.headerTop, s.fieldBottom]);
}

const installed = () => matchMedia("(display-mode: standalone)").matches;

// The results live outside the screens, so going back and forth keeps them; and in the visit's
// storage, so a reload does too.
const SAVED = "tea-pos:screen-lab";
let results: Result[] = (() => {
    try {
        return JSON.parse(sessionStorage.getItem(SAVED) ?? "[]") as Result[];
    } catch {
        return [];
    }
})();
const watchers = new Set<() => void>();
function setResults(next: Result[]) {
    results = next;
    try {
        sessionStorage.setItem(SAVED, JSON.stringify(next));
    } catch {
        // Kept until the page reloads.
    }
    watchers.forEach((w) => w());
}
const useResults = () =>
    useSyncExternalStore(
        (w) => {
            watchers.add(w);
            return () => void watchers.delete(w);
        },
        () => results,
    );

/** The list: each case's mark, the totals, Copy the report and Reset. */
export function ScreenLabScreen() {
    const all = useResults();
    const slug = useSlug();
    const navigate = useNavigate();
    const [copied, setCopied] = useState(false);
    const copy = () => {
        const report = {
            phone: navigator.userAgent,
            installed: installed(),
            screen: `${screen.width}x${screen.height} @${devicePixelRatio}`,
            at: new Date().toISOString(),
            timelineColumns: TIMELINE,
            results: all.map((r) => ({ case: r.id, ...r.verdict, timeline: r.timeline })),
        };
        void navigator.clipboard
            ?.writeText(JSON.stringify(report, null, 1))
            .then(() => setCopied(true));
    };

    const passed = all.filter((r) => r.verdict.pass).length;
    return (
        <div className="space-y-4 pb-8">
            <div className="rounded-2xl bg-white p-4 text-sm text-gray-700">
                <p className="font-bold text-gray-900">Screen lab</p>
                <p className="mt-1">
                    One case at a time: tap Start, do only what it says, tap Finish. Back leaves a
                    case without a result. When you are done, copy the report.{" "}
                    {installed()
                        ? "Installed app."
                        : "In a browser tab: install the app for the real test."}
                </p>
                {all.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                        <span className="font-semibold text-gray-900">
                            {all.length} of {CASES.length} done · {passed} passed
                        </span>
                        <button
                            type="button"
                            onClick={copy}
                            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                            {copied ? "Copied" : "Copy the report"}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setResults([]);
                                setCopied(false);
                            }}
                            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-gray-900"
                        >
                            Reset
                        </button>
                    </div>
                )}
            </div>
            {CASES.map((c) => {
                const r = all.find((x) => x.id === c.id);
                return (
                    <div key={c.id} className="rounded-2xl bg-white p-4">
                        <div className="flex items-start gap-3">
                            <span
                                aria-hidden
                                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white ${!r ? "ring-2 ring-slate-300" : r.verdict.pass ? "bg-green-600" : "bg-red-600"}`}
                            >
                                {r ? (r.verdict.pass ? "✓" : "✕") : ""}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-gray-900">{c.title}</p>
                                {r && <Outcome r={r} />}
                            </div>
                            <button
                                type="button"
                                onClick={() => void navigate({ to: `/${slug}/screen-lab/${c.id}` })}
                                className="shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-gray-900"
                            >
                                {r ? "Again" : "Start"}
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/** One case, its own screen under the lab: it records from opening until Finish; back cancels. */
export function ScreenLabCaseScreen({ caseId }: { caseId: string }) {
    const router = useRouter();
    const c = CASES.find((x) => x.id === caseId);
    const [busy, setBusy] = useState(false);
    const recorder = useRef<Recorder | null>(null);
    useEffect(() => {
        const r = new Recorder();
        r.start();
        recorder.current = r;
        return () => void r.stop();
    }, []);
    if (!c) return <p className="p-4 text-gray-700">No such case.</p>;

    const finish = async () => {
        const r = recorder.current;
        if (!r) return;
        setBusy(true);
        (document.activeElement as HTMLElement | null)?.blur?.();
        await r.settled();
        const samples = r.stop();
        const verdict = judge(samples, { headerStill: !c.focus, fills: installed() });
        setResults([
            {
                id: c.id,
                title: c.title,
                verdict,
                samples: samples.length,
                timeline: timelineOf(samples),
            },
            ...results.filter((x) => x.id !== c.id),
        ]);
        router.history.back();
    };

    return (
        <div className="space-y-4">
            <HeaderTitle>{c.title}</HeaderTitle>
            <div className="rounded-2xl bg-white p-4">
                <p className="text-sm text-gray-700">{c.steps}</p>
                <p className="mt-2 text-xs font-semibold text-red-600">● Recording every frame</p>
            </div>
            {c.control?.()}
            <button
                type="button"
                disabled={busy}
                onClick={() => void finish()}
                className="w-full rounded-xl bg-gray-900 py-3 font-semibold text-white disabled:opacity-50"
            >
                {busy ? "Waiting for the screen to settle…" : "Finish"}
            </button>
            <div className="h-[60vh]" aria-hidden />
        </div>
    );
}

function Outcome({ r }: { r: Result }) {
    const f = r.verdict.facts;
    return (
        <div className="mt-1 text-sm">
            <p
                className={
                    r.verdict.pass ? "font-semibold text-green-700" : "font-semibold text-red-700"
                }
            >
                {r.verdict.pass ? "Passed" : "Failed"}
            </p>
            {r.verdict.problems.map((p) => (
                <p key={p} className="text-gray-700">
                    · {p}
                </p>
            ))}
            <p className="mt-1 text-xs text-gray-600">
                keyboard {f.keyboard}
                {f.keyboardHeight ? ` ${f.keyboardHeight}px` : ""} · header moved {f.headerMovedBy}
                px · settled in {f.settleMs} ms · {r.samples} frames
            </p>
        </div>
    );
}
