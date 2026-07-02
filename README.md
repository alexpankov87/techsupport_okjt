# techsupport_okjt

Telegram-бот технической поддержки для ТОО «Окжетпес-Т». Построен на Telegraf, использует MongoDB для хранения заявок и Express + Winston для служебных задач и логирования.

## Стек

- **Node.js / TypeScript**
- **[Telegraf](https://telegraf.js.org/)** — фреймворк для Telegram Bot API
- **Express** — HTTP-слой (служебные эндпоинты / health-check)
- **MongoDB / Mongoose** — хранение данных
- **Winston** — логирование
- **Helmet, CORS** — базовая защита HTTP-слоя
- **Docker / docker-compose** — контейнеризация, раздельные dev/prod сборки

## Возможности

- Приём и обработка обращений пользователей в Telegram
- Хранение заявок и сопутствующих данных в MongoDB
- Структурированное логирование через Winston
- Готовая Docker-сборка для деплоя (multi-stage: dev / production)

## Требования

- Node.js 20+
- MongoDB 7+ (или Docker, чтобы не ставить локально)
- Docker и Docker Compose (для контейнерного запуска)
- Токен Telegram-бота, полученный у [@BotFather](https://t.me/BotFather)

## Установка

```bash
git clone <адрес_репозитория>
cd techsupport_okjt
npm install
```

### Переменные окружения

Создайте файл `.env` в корне проекта:

```env
NODE_ENV=development
BOT_TOKEN=ваш_токен_от_BotFather
MONGODB_URI=mongodb://localhost:27017/techsupport_okjt
```

При запуске через `docker-compose` переменная `MONGODB_URI` уже зашита на адрес контейнера `mongo`, и в `.env` для compose-сценария реально нужен только `BOT_TOKEN`.

## Запуск локально без Docker

### Режим разработки

```bash
npm run dev
```

Запускает `src/app.ts` через `ts-node-dev` с автоперезагрузкой при изменении файлов.

### Продакшен-сборка локально

```bash
npm run build   # компилирует TypeScript в dist/
npm start       # запускает dist/app.js
```

## Docker

Проект использует multi-stage `Dockerfile` с двумя таргетами:

- **`dev`** — полные зависимости, hot reload через `npm run dev`, исходники монтируются с хоста
- **`production`** — только `dist/` и production-зависимости, без TypeScript и dev-инструментов, запуск от непривилегированного пользователя `node`

### Локальная разработка (hot reload)

```bash
docker compose -f docker-compose.dev.yml up --build
```

Остановить:
```bash
docker compose -f docker-compose.dev.yml down
```

Что внутри `docker-compose.dev.yml`:
- контейнер `bot` собирается из таргета `dev`, монтирует текущую папку внутрь контейнера — изменения в коде подхватываются на лету
- контейнер `mongo` с портом `27017`, проброшенным на хост, для удобного локального доступа

### Продакшен-сборка

```bash
docker compose up -d --build
```

Что внутри `docker-compose.yml` (prod):
- `bot` — собирается из таргета `production`, содержит только скомпилированный `dist/` и runtime-зависимости
- `mongo` — контейнер MongoDB 7 с volume `mongo_data` для персистентного хранения данных
- оба сервиса имеют `restart: always` — автоматически поднимаются после перезапуска Docker/сервера

Перед запуском убедитесь, что `BOT_TOKEN` доступен — например, через `.env` рядом с `docker-compose.yml` (Docker Compose подхватывает его автоматически):

```bash
docker compose logs -f bot   # посмотреть логи бота
docker compose ps            # статус контейнеров
docker compose down          # остановить всё
docker compose restart bot   # перезапустить только бота
```

### Через PM2 (без Docker, на сервере)

В репозитории есть `ecosystem.config.js` для PM2 — если процесс нужно держать живым на VPS без контейнеров:

```bash
npm run build
npx pm2 start ecosystem.config.js
```

## Деплой на сервер — краткая инструкция

1. Установить Docker и Docker Compose на сервере:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo apt install docker-compose-plugin -y
   ```
2. Склонировать репозиторий в рабочую директорию:
   ```bash
   git clone <адрес_репозитория> techsupport_okjt
   cd techsupport_okjt
   ```
3. Создать `.env` с боевым токеном бота:
   ```bash
   echo "BOT_TOKEN=ваш_боевой_токен" > .env
   ```
4. Собрать и запустить prod-контейнеры:
   ```bash
   docker compose up -d --build
   ```
5. Проверить логи и статус:
   ```bash
   docker compose logs -f bot
   docker compose ps
   ```

### Обновление бота на сервере (без даунтайма Mongo)

```bash
git pull
docker compose up -d --build bot
```

## Структура проекта

```
techsupport_okjt/
├── src/                     # исходный код приложения
├── dist/                    # скомпилированный JS (генерируется при build)
├── logs/                    # логи приложения
├── Dockerfile               # multi-stage: dev / builder / production
├── docker-compose.yml       # продакшен-сборка
├── docker-compose.dev.yml   # локальная разработка с hot reload
├── .dockerignore
├── ecosystem.config.js      # конфиг для PM2
├── tsconfig.json
└── package.json
```

## Скрипты package.json

| Команда | Назначение |
|---|---|
| `npm run dev` | запуск в режиме разработки с автоперезагрузкой |
| `npm run build` | компиляция TypeScript → `dist/` |
| `npm start` | запуск собранного приложения |
| `npm run type-check` | проверка типов без сборки |

## Лицензия

ISC