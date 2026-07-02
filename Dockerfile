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
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
RUN mkdir -p logs
USER node
CMD ["node", "dist/app.js"]