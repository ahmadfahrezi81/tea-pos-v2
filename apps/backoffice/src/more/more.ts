import { $api } from "@tea-pos/api-client";
import { STALE } from "@tea-pos/api-client/query";
import { useTenant } from "@tea-pos/shell/tenant";

const useSlug = () => useTenant()?.tenant.slug ?? "";

export function useWeather(enabled: boolean) {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/weather",
        { params: { path: { tenant } } },
        { enabled: !!tenant && enabled, staleTime: STALE.WARM },
    );
}

export function useFeedbacks() {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/feedbacks",
        { params: { path: { tenant }, query: { limit: 100 } } },
        { enabled: !!tenant, staleTime: STALE.COOL },
    );
}
