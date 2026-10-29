import { useT } from "@tea-pos/i18n/react";
import { rowIcon, SettingsRow } from "@tea-pos/shell/Settings";
import { useTenant } from "@tea-pos/shell/tenant";
import { Cloud, MapPin } from "lucide-react";
import { useState } from "react";

import { WeatherSheet } from "./WeatherSheet";

/** The backoffice's own More rows, as the old app: Weather (a sheet) and Location Feedback. */
export function MoreRows() {
    const t = useT();
    const slug = useTenant()?.tenant.slug ?? "";
    const [weather, setWeather] = useState(false);
    return (
        <>
            <SettingsRow
                icon={<Cloud {...rowIcon} />}
                label={t("moreRows.weather")}
                onClick={() => setWeather(true)}
            />
            <SettingsRow
                to={`/${slug}/more/map`}
                icon={<MapPin {...rowIcon} />}
                label={t("moreRows.feedback")}
            />
            <WeatherSheet open={weather} onClose={() => setWeather(false)} />
        </>
    );
}
