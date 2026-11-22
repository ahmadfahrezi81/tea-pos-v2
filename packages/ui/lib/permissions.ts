import { useSyncExternalStore } from "react";

// The phone's permissions, one way for every app (task 077): check before using, ask with a
// time limit, and when the phone says no (or never asks), the help sheet says what to do. The
// sheet is mounted once by the shell (PermissionHelpHost), as the toast is.

export type PermissionKind = "notifications" | "camera";
export type PermissionState = "granted" | "prompt" | "denied" | "unsupported";
/** blocked: the phone said no; notAsked: it never showed the question; failed: anything else. */
export type PermissionProblem = "blocked" | "notAsked" | "failed";

/** An iPhone or iPad (which calls itself a Mac, but has a touch screen). */
export const isIPhone = () =>
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
/** Installed from Samsung Internet: its own menus, and no Chrome to send them to. */
export const isSamsungInternet = () => /SamsungBrowser/.test(navigator.userAgent);
/** Opened from the home screen as an app (no address bar), not in a browser tab. */
export const isInstalled = () =>
    matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Where the phone stands, without asking; "prompt" also when the browser cannot tell. */
export async function permissionState(kind: PermissionKind): Promise<PermissionState> {
    if (kind === "notifications") {
        if (!("Notification" in window)) return "unsupported";
        const p = Notification.permission;
        return p === "default" ? "prompt" : p;
    }
    if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
    try {
        return (await navigator.permissions.query({ name: "camera" as PermissionName })).state;
    } catch {
        return "prompt"; // Safari and older Chromes cannot say: the camera asks by itself
    }
}

const ASK_TIMEOUT_MS = 15_000;

/** Asks for the camera with the phone's own question; false when it did not say yes in time. */
export async function askCamera(): Promise<boolean> {
    try {
        const stream = await Promise.race([
            navigator.mediaDevices.getUserMedia({ video: true }),
            new Promise<null>((done) => setTimeout(() => done(null), ASK_TIMEOUT_MS)),
        ]);
        stream?.getTracks().forEach((t) => t.stop());
        return !!stream;
    } catch {
        return false;
    }
}

/**
 * Opens a camera picker (`<input capture>`) safely: a blocked camera shows the sheet instead of
 * nothing (as v1's task 030). The click stays in the tap's own turn where it must (iPhone).
 */
export function openCamera(input: HTMLInputElement | null) {
    if (!input) return;
    if (isIPhone() || !navigator.permissions) return input.click();
    void permissionState("camera").then((state) => {
        if (state === "denied") showPermissionHelp("camera", "blocked");
        else input.click();
    });
}

/** After a camera pick came back empty: quiet if they just cancelled, the sheet if it is blocked. */
export function cameraCameBackEmpty() {
    void permissionState("camera").then((state) => {
        if (state === "denied") showPermissionHelp("camera", "blocked");
    });
}

// The help sheet's state, shown from anywhere.
type Help = { kind: PermissionKind; problem: PermissionProblem };
let current: Help | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export function showPermissionHelp(kind: PermissionKind, problem: PermissionProblem) {
    current = { kind, problem };
    emit();
}

export function closePermissionHelp() {
    current = null;
    emit();
}

export function usePermissionHelp(): Help | null {
    return useSyncExternalStore(
        (fn) => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        () => current,
    );
}
