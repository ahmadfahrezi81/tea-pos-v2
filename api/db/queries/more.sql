-- name: ListWeatherHourly :many
-- The old app's one-location forecast (the cron website fills it until Step 45), yesterday to tomorrow.
SELECT date, hour, temperature::float8 AS temperature, precipitation_probability::float8 AS precipitation_probability,
    weather_code, city, region, fetched_at
FROM weather_hourly
WHERE date BETWEEN @from_date::date AND @to_date::date
ORDER BY date, hour;
