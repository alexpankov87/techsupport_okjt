# techsupport_okjt

Telegram-бот технической поддержки для ТОО «Окжетпес-Т». Построен на Telegraf, использует MongoDB для хранения заявок и Express + Winston для служебных задач и логирования.

## Стек

- **Node.js / TypeScript**
- **[Telegraf](https://telegraf.js.org/)** — фреймворк для Telegram Bot API
- **Express** — HTTP-слой (служебные эндпоинты / health-check)
- **MongoDB / Mongoose** — хранение данных
- **Winston** — логирование
- **Helmet, CORS** — базовая защита HTTP-слоя
- **Docker / docker-compose** — контейнеризация и локальный запуск с MongoDB

## Возможности

- Приём и обработка обращений пользователей в Telegram
- Хранение заявок и сопутствующих данных в MongoDB
- Структурированное логирование через Winston
- Готовая Docker-сборка для деплоя


## Требования

- Node.js 20+
- MongoDB 7+ (или Docker, чтобы не ставить локально)
- Токен Telegram-бота, полученный у [@BotFather](https://t.me/BotFather)

## Установка

```bash
git clone https://github.com/alexpankov87/techsupport_okjt.git
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

## Запуск

### Локально, в режиме разработки

```bash
npm run dev
```

Запускает `src/app.ts` через `ts-node-dev` с автоперезагрузкой при изменении файлов.

### Продакшен-сборка локально

```bash
npm run build   # компилирует TypeScript в dist/
npm start       # запускает dist/app.js
```

### Через Docker Compose (рекомендуется)

Поднимает бота вместе с MongoDB одной командой:

```bash
docker compose up -d --build
```

Что внутри:

- `bot` — контейнер с приложением, собирается из `Dockerfile`, читает `BOT_TOKEN` из окружения хоста
- `mongo` — контейнер MongoDB 7 с volume `mongo_data` для персистентного хранения данных
- логи приложения пробрасываются на хост в `./logs`

Перед запуском убедитесь, что `BOT_TOKEN` доступен в окружении (например, в `.env` рядом с `docker-compose.yml` — Docker Compose подхватывает его автоматически):

```bash
docker compose logs -f bot   # посмотреть логи бота
docker compose down          # остановить
```

### Через PM2 (без Docker, на сервере)

В репозитории есть `ecosystem.config.js` для PM2 — если процесс нужно держать живым на VPS без контейнеров:

```bash
npm run build
npx pm2 start ecosystem.config.js
```

## Структура проекта

```
techsupport_okjt/
├── src/                  # исходный код приложения
├── dist/                 # скомпилированный JS (генерируется при build)
├── logs/                 # логи приложения
├── Dockerfile
├── docker-compose.yml
├── ecosystem.config.js   # конфиг для PM2
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

## Известные ограничения / TODO

- В `Dockerfile` зависимости ставятся через `npx npm install` — это работает, но избыточно: `npx` ищет `npm` в `PATH`/локально и просто его запускает, то есть результат идентичен обычному `npm install` (или, для воспроизводимой сборки, `npm ci`). Стоит заменить на `RUN npm ci` — это и быстрее, и детерминированнее (ставит строго по `package-lock.json`).
- В `docker-compose.yml` нет `.dockerignore` — стоит добавить (минимум `node_modules`, `dist`, `logs`), чтобы не тащить лишнее в контекст сборки.
- README будет точнее, если дополнить его реальными сценариями использования бота (команды, роли, структура `src/`).

## Лицензия

ISC