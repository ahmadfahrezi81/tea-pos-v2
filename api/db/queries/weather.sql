-- name: ListStoreHours :many
-- Every active store with a place: the worker groups them into weather cells.
SELECT latitude::float8 AS lat, longitude::float8 AS lng, open_time, close_time
FROM public.stores
WHERE status = 'active' AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- name: UpsertWeatherHour :exec
-- A forecast never replaces an hour already observed.
INSERT INTO public.weather_hours (cell, date, hour, temperature, precipitation_probability, weather_code, observed, fetched_at)
VALUES (@cell, @date, @hour, @temperature::float8, @precipitation_probability::float8, @weather_code, @observed, now())
ON CONFLICT (cell, date, hour) DO UPDATE SET
    temperature = EXCLUDED.temperature,
    precipitation_probability = EXCLUDED.precipitation_probability,
    weather_code = EXCLUDED.weather_code,
    observed = EXCLUDED.observed,
    fetched_at = EXCLUDED.fetched_at
WHERE NOT public.weather_hours.observed OR EXCLUDED.observed;

-- name: UpsertWeatherHourlyV1 :exec
-- The old app's one-location table, until it retires (Step 40 drops this).
INSERT INTO public.weather_hourly (date, hour, temperature, precipitation_probability, weather_code, lat, lng, city, region, fetched_at)
VALUES (@date, @hour, @temperature::float8, @precipitation_probability::float8, @weather_code, @lat::float8, @lng::float8, @city, @region, now())
ON CONFLICT (date, hour) DO UPDATE SET
    temperature = EXCLUDED.temperature,
    precipitation_probability = EXCLUDED.precipitation_probability,
    weather_code = EXCLUDED.weather_code,
    fetched_at = EXCLUDED.fetched_at;
