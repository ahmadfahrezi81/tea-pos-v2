# The nightly backup (Railway cron service "backup") and the restore tool.
# pg_dump refuses a server newer than itself: keep this at Supabase's major version.
FROM postgres:17

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY lib.sh backup.sh restore.sh /usr/local/bin/

USER postgres
WORKDIR /tmp
# Not the image's own entrypoint, which would start a Postgres server.
ENTRYPOINT []
CMD ["backup.sh"]
