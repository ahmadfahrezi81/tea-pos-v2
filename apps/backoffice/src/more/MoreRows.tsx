import { useT } from "@tea-pos/i18n/react";
import { rowIcon, SettingsRow } from "@tea-pos/shell/Settings";
import { useAccess, useSlug } from "@tea-pos/shell/tenant";
import { Cloud, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { WeatherSheet } from "./WeatherSheet";

/** The backoffice's own More rows, as the old app: Weather (a sheet); then Advanced, for admins. */
export function MoreRows() {
    const t = useT();
    const slug = useSlug();
    const { canWrite } = useAccess();
    const [weather, setWeather] = useState(false);
    return (
        <>
            <SettingsRow
                icon={<Cloud {...rowIcon} />}
                label={t("moreRows.weather")}
                onClick={() => setWeather(true)}
            />
            {canWrite && (
                <SettingsRow
                    to={`/${slug}/advanced`}
                    icon={<SlidersHorizontal {...rowIcon} />}
                    label={t("moreRows.advanced")}
                />
            )}
            <WeatherSheet open={weather} onClose={() => setWeather(false)} />
        </>
    );
}
