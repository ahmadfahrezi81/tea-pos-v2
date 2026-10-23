# One image, every program under /app/. Each Railway service picks one by its start command.

FROM golang:1.27.3-alpine AS build
WORKDIR /src

COPY api/go.mod api/go.sum ./
RUN go mod download

COPY api/ ./
ARG RAILWAY_GIT_COMMIT_SHA=unknown
ARG APP_VERSION=dev
RUN CGO_ENABLED=0 go build -trimpath \
    -ldflags="-s -w -X github.com/ahmadfahrezi81/tea-pos-v2/api/internal/version.Version=${APP_VERSION} -X github.com/ahmadfahrezi81/tea-pos-v2/api/internal/version.Commit=${RAILWAY_GIT_COMMIT_SHA}" \
    -o /out/ ./cmd/...

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/ /app/
EXPOSE 8080
CMD ["/app/api"]
