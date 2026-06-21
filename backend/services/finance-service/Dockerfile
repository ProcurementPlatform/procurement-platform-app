FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY backend/shared/types/package.json ./backend/shared/types/
COPY backend/shared/common/package.json ./backend/shared/common/
COPY backend/shared/middleware/package.json ./backend/shared/middleware/
COPY backend/shared/utils/package.json ./backend/shared/utils/
COPY backend/services/finance-service/package.json ./backend/services/finance-service/
RUN npm install

COPY backend/shared ./backend/shared
COPY backend/services/finance-service ./backend/services/finance-service
RUN npm run build -w @procurement/types  && npm run build -w @procurement/common  && npm run build -w @procurement/utils  && npm run build -w @procurement/middleware  && npm run build -w @procurement/finance-service

FROM node:20-alpine AS prod-deps
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY backend/shared/types/package.json ./backend/shared/types/
COPY backend/shared/common/package.json ./backend/shared/common/
COPY backend/shared/middleware/package.json ./backend/shared/middleware/
COPY backend/shared/utils/package.json ./backend/shared/utils/
COPY backend/services/finance-service/package.json ./backend/services/finance-service/
RUN npm ci --omit=dev

FROM node:20-alpine

RUN apk update && apk upgrade --no-cache
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/backend/shared ./backend/shared
COPY --from=builder /app/backend/services/finance-service ./backend/services/finance-service

ENV NODE_ENV=production
ENV PORT=5002
EXPOSE 5002
RUN mkdir -p logs && chown -R app:app /app
USER app

CMD ["node", "backend/services/finance-service/dist/server.js"]
