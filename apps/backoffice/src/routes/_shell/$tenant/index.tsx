import { createFileRoute, redirect } from "@tanstack/react-router";

// The backoffice opens on its Store tab.
export const Route = createFileRoute("/_shell/$tenant/")({
    beforeLoad: ({ params }) => {
        throw redirect({ to: "/$tenant/store", params, replace: true });
    },
});
