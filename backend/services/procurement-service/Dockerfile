
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY backend/shared/types/package.json ./backend/shared/types/
COPY backend/shared/common/package.json ./backend/shared/common/
COPY backend/shared/middleware/package.json ./backend/shared/middleware/
COPY backend/shared/utils/package.json ./backend/shared/utils/
COPY backend/services/procurement-service/package.json ./backend/services/procurement-service/
RUN npm install

COPY backend/shared ./backend/shared
COPY backend/services/procurement-service ./backend/services/procurement-service
RUN npm run build -w @procurement/types  && npm run build -w @procurement/common  && npm run build -w @procurement/utils  && npm run build -w @procurement/middleware  && npm run build -w @procurement/procurement-service

RUN npm prune --omit=dev

FROM node:20-alpine

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/backend/shared ./backend/shared
COPY --from=builder /app/backend/services/procurement-service ./backend/services/procurement-service

ENV NODE_ENV=production
ENV PORT=5003
EXPOSE 5003
RUN mkdir -p logs && chown -R app:app /app
USER app

CMD ["node", "backend/services/procurement-service/dist/server.js"]
