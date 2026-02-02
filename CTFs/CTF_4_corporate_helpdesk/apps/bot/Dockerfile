FROM mcr.microsoft.com/playwright:v1.40.1-jammy

WORKDIR /app

# Install Node.js dependencies
COPY package*.json ./
RUN npm install --include=dev

# Install Playwright browsers
RUN npx playwright install chromium

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

CMD ["npm", "run", "dev"]
