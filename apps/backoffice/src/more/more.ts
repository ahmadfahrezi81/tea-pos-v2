import { $api } from "@tea-pos/api-client";
import { STALE } from "@tea-pos/api-client/query";
import { useSlug } from "@tea-pos/shell/tenant";

export function useWeather(enabled: boolean) {
    const tenant = useSlug();
    return $api.useQuery(
        "get",
        "/tenants/{tenant}/weather",
        { params: { path: { tenant } } },
        { enabled: !!tenant && enabled, staleTime: STALE.WARM },
    );
}
