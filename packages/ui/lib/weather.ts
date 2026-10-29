import {
    Cloud,
    CloudDrizzle,
    CloudFog,
    CloudLightning,
    CloudMoon,
    CloudMoonRain,
    CloudRain,
    CloudSnow,
    CloudSun,
    Moon,
    Sun,
    Wind,
    type LucideIcon,
} from "lucide-react";

/** Night by the hour, as the old apps: before 6 and from 18. */
export const isNight = (hour: number) => hour < 6 || hour >= 18;

/** Tomorrow.io's weather codes as an icon and a label key (`weather.<key>`), as the old apps. */
export function weatherOf(code: number, night: boolean): { icon: LucideIcon; key: string } {
    if (code === 1000) return { icon: night ? Moon : Sun, key: "clear" };
    if (code === 1100) return { icon: night ? CloudMoon : CloudSun, key: "mostlyClear" };
    if (code === 1101) return { icon: night ? CloudMoon : CloudSun, key: "partlyCloudy" };
    if (code === 1102) return { icon: night ? CloudMoon : Cloud, key: "mostlyCloudy" };
    if (code === 1001) return { icon: Cloud, key: "cloudy" };
    if (code === 2000 || code === 2100) return { icon: CloudFog, key: "foggy" };
    if (code >= 3000 && code <= 3002) return { icon: Wind, key: "windy" };
    if (code === 4000) return { icon: night ? CloudMoonRain : CloudDrizzle, key: "drizzle" };
    if (code === 4001) return { icon: night ? CloudMoonRain : CloudRain, key: "lightRain" };
    if (code === 4200) return { icon: night ? CloudMoonRain : CloudRain, key: "rain" };
    if (code === 4201) return { icon: night ? CloudMoonRain : CloudRain, key: "heavyRain" };
    if (code >= 5000 && code <= 5101) return { icon: CloudSnow, key: "snow" };
    if (code >= 6000 && code <= 6201)
        return { icon: night ? CloudMoonRain : CloudRain, key: "freezingRain" };
    if (code >= 8000) return { icon: CloudLightning, key: "thunderstorm" };
    return { icon: Cloud, key: "unknown" };
}
