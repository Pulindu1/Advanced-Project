FROM node:18-alpine

WORKDIR /app

# Install dependencies (including devDependencies for TypeScript build)
COPY package*.json ./
RUN npm install --include=dev

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

EXPOSE 4001

# For development, we use dev command; for production use start
CMD ["npm", "run", "dev"]
