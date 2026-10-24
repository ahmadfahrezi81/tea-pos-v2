-- Weather per area (tea-pos v2's worker, task 017). Stores within one cell of about
-- 5 × 5 km (coordinates rounded to 0.05°) share one fetch; a store elsewhere makes a
-- new cell by itself. The old app keeps reading weather_hourly (one location) until it
-- retires; the worker writes both until then.
CREATE TABLE public.weather_hours (
    -- The cell's centre, "lat,lng" rounded to 0.05° (e.g. "-6.60,106.75").
    cell text NOT NULL,
    date date NOT NULL,
    hour smallint NOT NULL CHECK (hour BETWEEN 0 AND 23),
    temperature numeric NOT NULL,
    precipitation_probability numeric NOT NULL,
    weather_code integer NOT NULL,
    -- The hour as it is now (Tomorrow.io's current weather), rather than forecast.
    observed boolean NOT NULL DEFAULT false,
    fetched_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (cell, date, hour)
);

-- Only Go's connection (which skips row-level security) reads it.
ALTER TABLE public.weather_hours ENABLE ROW LEVEL SECURITY;
