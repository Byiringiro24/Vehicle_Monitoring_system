FROM node:20-slim AS builder
WORKDIR /app

# Install OpenSSL — required by Prisma on Debian slim
RUN apt-get update -qq && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-slim
WORKDIR /app

# Runtime OpenSSL — Prisma client needs it at runtime too
RUN apt-get update -qq && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
RUN mkdir -p logs
EXPOSE 4000 1883
CMD ["node", "dist/index.js"]
