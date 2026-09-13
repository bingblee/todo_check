FROM node:24-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
ARG APP_BASE_PATH=
ENV APP_BASE_PATH=$APP_BASE_PATH
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ARG APP_BASE_PATH=
ENV NODE_ENV=production
ENV APP_BASE_PATH=$APP_BASE_PATH
ENV DATABASE_PATH=/data/todo.sqlite
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN apk add --no-cache libstdc++ && addgroup -S nextjs && adduser -S nextjs -G nextjs && mkdir -p /data && chown nextjs:nextjs /data
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nextjs /app/scripts ./scripts
USER nextjs
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
