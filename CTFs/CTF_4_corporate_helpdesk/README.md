# IntraDesk Knowledge Base CTF

A DOM XSS challenge featuring a corporate knowledge base and helpdesk system.

## Challenge Overview

You are an employee using IntraDesk KB, an internal corporate knowledge base and helpdesk system. The Security team reviews reported KB links.

**Your goal:** Get the moderator to reveal the secret stored in the admin context.

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Queue:** Redis + BullMQ
- **Bot:** Playwright

## Project Structure

```
apps/
  web/      - Frontend React application
  api/      - Backend Express API
  bot/      - Admin bot worker (Playwright)
infra/      - Docker Compose and infrastructure
```

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)

### Quick Start

1. Start all services:
```bash
npm run docker:up
```

2. Access the application:
- Frontend: http://localhost:5174
- API: http://localhost:4001

### Local Development

1. Install dependencies:
```bash
npm install
cd apps/web && npm install
cd apps/api && npm install
cd apps/bot && npm install
```

2. Run services individually:
```bash
npm run dev:api
npm run dev:web
npm run dev:bot
```

## Environment Variables

See `.env.example` for required environment variables.

## Challenge Generation

This CTF uses the challenge-generation system. Each user gets a unique flag assigned automatically.

## License

MIT
