FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npx npm install

COPY . .

RUN npx tsc

RUN mkdir -p logs

CMD ["node", "dist/app.js"]