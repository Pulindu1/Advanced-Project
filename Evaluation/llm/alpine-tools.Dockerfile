# Scratch container for the shell tool.
# Build: docker build -f alpine-tools.Dockerfile -t llm-trial-shell:latest .
FROM alpine:3.20

RUN apk add --no-cache \
      bash \
      curl \
      jq \
      openssl \
      python3 \
      py3-pip \
      nodejs \
      npm \
      sqlite \
      busybox-extras \
      ca-certificates

WORKDIR /scratch
CMD ["sh"]
