import { useT } from "@tea-pos/i18n/react";
import { rowIcon, SettingsRow } from "@tea-pos/shell/Settings";
import { Cloud } from "lucide-react";
import { useState } from "react";

import { WeatherSheet } from "./WeatherSheet";

/** The backoffice's own More rows, as the old app: Weather (a sheet). */
export function MoreRows() {
    const t = useT();
    const [weather, setWeather] = useState(false);
    return (
        <>
            <SettingsRow
                icon={<Cloud {...rowIcon} />}
                label={t("moreRows.weather")}
                onClick={() => setWeather(true)}
            />
            <WeatherSheet open={weather} onClose={() => setWeather(false)} />
        </>
    );
}
