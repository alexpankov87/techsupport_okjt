FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS dev
RUN npm ci
COPY . .
CMD ["npm", "run", "dev"]

FROM base AS builder
RUN npm ci
COPY . .
RUN npx tsc

FROM base AS production
# Alpine ttf-dejavu → /usr/share/fonts/dejavu/DejaVuSans.ttf (used by PDF reports)
RUN apk add --no-cache ttf-dejavu \
  && npm ci --omit=dev
COPY --from=builder /app/dist ./dist
RUN mkdir -p logs
USER node
CMD ["node", "dist/app.js"]
