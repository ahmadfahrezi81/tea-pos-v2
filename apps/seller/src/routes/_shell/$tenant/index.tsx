import { createFileRoute, redirect } from "@tanstack/react-router";

// The seller opens on its POS tab, as the old app.
export const Route = createFileRoute("/_shell/$tenant/")({
    beforeLoad: ({ params }) => {
        throw redirect({ to: "/$tenant/pos", params, replace: true });
    },
});
