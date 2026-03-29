# Stage 1: build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# VITE_API_URL must point to the host-exposed backend port so the browser can reach it
ARG VITE_API_URL=http://localhost:8004
ENV VITE_API_URL=$VITE_API_URL

RUN npx vite build

# Stage 2: serve via Nginx
FROM nginx:stable-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /app/src /usr/share/nginx/html/src
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
