FROM golang:1.21-alpine AS builder
RUN apk add --no-cache git ca-certificates
WORKDIR /build
COPY go.mod ./
COPY cmd ./cmd
COPY internal ./internal
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/pressroom ./cmd/server

FROM alpine:3.19
RUN apk add --no-cache iputils ca-certificates tini
WORKDIR /app
COPY --from=builder /out/pressroom /app/pressroom
COPY templates /app/templates
COPY static /app/static
COPY src/data /app/src/data
RUN mkdir -p /app/flags
EXPOSE 3002
ENV PORT=3002 \
    DATA_DIR=/app/src/data \
    TEMPLATES_DIR=/app/templates \
    STATIC_DIR=/app/static \
    FLAGS_DIR=/app/flags \
    GIN_MODE=release
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/app/pressroom"]
