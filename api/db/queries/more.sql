-- name: ListFeedbacks :many
-- Where customers asked for a store, newest first, with who wrote it down.
SELECT f.id, f.location_name, f.location_display, f.latitude::float8 AS latitude, f.longitude::float8 AS longitude,
    f.notes, f.created_at, u.full_name AS user_name
FROM tenant_customer_feedbacks f
LEFT JOIN users u ON u.id = f.user_id
WHERE f.tenant_id = @tenant_id
ORDER BY f.created_at DESC
LIMIT @row_limit;

-- name: ListWeatherHourly :many
-- The old app's one-location forecast (the cron website fills it until Step 45), yesterday to tomorrow.
SELECT date, hour, temperature::float8 AS temperature, precipitation_probability::float8 AS precipitation_probability,
    weather_code, city, region, fetched_at
FROM weather_hourly
WHERE date BETWEEN @from_date::date AND @to_date::date
ORDER BY date, hour;
