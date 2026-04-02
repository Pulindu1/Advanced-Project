FROM rust:latest AS builder

WORKDIR /build

COPY Cargo.toml Cargo.lock* ./
# Create a dummy main to cache dependency compilation
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release 2>/dev/null || true

# Copy actual source and rebuild
COPY src/ src/
RUN touch src/main.rs && cargo build --release

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /build/target/release/veridian-portal /app/veridian-portal
COPY templates/ /app/templates/
COPY static/ /app/static/

RUN mkdir -p /app/data

ENV BIND_ADDR=0.0.0.0:8080
ENV TEMPLATE_DIR=/app/templates/**/*
ENV STATIC_DIR=/app/static
ENV DATABASE_PATH=/app/data/veridian.db
ENV FLAGS_PATH=/app/flags.json
ENV CREDS_PATH=/app/credentials.json
ENV RUST_LOG=info

EXPOSE 8080

CMD ["/app/veridian-portal"]
