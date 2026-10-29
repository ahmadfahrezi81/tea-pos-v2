import { createFileRoute, redirect } from "@tanstack/react-router";

// A period is the Pay tab with ?period=, so ‹ › keeps the tab's header; this address (a payslip's
// back) lands there.
export const Route = createFileRoute("/_shell/$tenant/pay/$start/")({
    beforeLoad: ({ params }) => {
        throw redirect({
            to: "/$tenant/pay",
            params: { tenant: params.tenant },
            search: { period: params.start },
            replace: true,
        });
    },
});
