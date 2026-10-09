# WatchFlow

## Локальная база данных PostgreSQL

Локальная БД запускается через Docker Compose. Требуются установленный Docker Desktop с включённым Docker Compose и Node.js.

1. Скопировать `.env.example` в `.env`.
2. В `.env` задать случайный `JWT_SECRET` длиной не менее 32 байт и уникальные `SEED_*_PASSWORD` длиной не менее 12 символов. Сгенерировать секрет можно через `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
3. Запустить контейнер БД: `docker compose up -d postgres`.
4. Установить зависимости: `npm install`.
5. Сгенерировать Prisma Client: `npm run prisma:generate`.
6. Применить текущую Prisma-схему к пустой локальной БД: `npm run prisma:push`.
7. Загрузить начальные данные: `npm run db:seed`.
8. Запустить приложение: `npm run dev`.

`.env` содержит секреты и не должен попадать в Git. `.env.example` содержит только локальные значения для разработки; не использовать их в production.

Seed создаёт тестовые учётные записи сотрудников; уникальные пароли задаются через `SEED_*_PASSWORD` в локальном `.env`.

### Файлы макетов дизайна

Локально JPG, PNG и PDF макеты хранятся вне публичной папки в `var/design-files/` и выдаются через авторизованный API. Максимальный размер файла — 10 МБ. Папка исключена из Git. Для production задайте `DESIGN_UPLOAD_DIR` на постоянное защищённое хранилище/том; локальную файловую систему контейнера нельзя считать долговременным хранилищем.

### Уведомления

Персональные уведомления сохраняются в PostgreSQL. Пользователь видит собственные уведомления, может отметить одно или все прочитанными; события назначения дизайна, загрузки макета, возврата на правки, передачи в производство и готовности заказа к отправке создают уведомления для соответствующих сотрудников.

### История и аудит

Администратору доступен `/audit`: фильтры по объекту, действию и периоду показывают, кто и когда изменил данные, включая старые и новые значения для заказов, лидов и сотрудников. Записи аудита хранятся в `ActivityLog` в той же транзакции, что и изменение данных.

### Поиск и фильтры

Глобальный поиск `/search` ищет доступные текущему сотруднику заказы, лиды и клиентов, номера отправлений/трек-номера и складские позиции по SKU. В списке заказов доступны фильтры по статусу, менеджеру, городу, дате создания и просроченному сроку дизайна; область видимости заказов сохраняется по роли.

### Настройка доступа

Администратор на странице `/admin/access` может настраивать права ролей по разделам и операциям. Изменения применяются к следующему запросу пользователя и записываются в журнал аудита; права роли `admin` фиксированы и не редактируются. Серверные страницы и API используют актуальные права роли из PostgreSQL. Начальные права seed назначаются при создании ролей и повторный запуск seed не сбрасывает настройки доступа.

### Безопасность аутентификации

Вход доступен только для активных пользователей PostgreSQL; demo-учётки и общий секрет по умолчанию отключены. `JWT_SECRET` обязателен и должен быть случайным значением длиной не менее 32 байт. Пароли начальных пользователей seed задаются отдельными переменными `SEED_*_PASSWORD`, не хранятся в исходниках и сохраняются в базе в виде bcrypt-хеша. Для уже заполненной базы задайте эти пароли и повторно запустите seed, чтобы заменить ранее использовавшиеся начальные пароли. Пароли должны содержать не менее 12 символов; существующим сотрудникам с более коротким паролем потребуется сброс пароля администратором. Вход ограничен по учётной записи и, если reverse proxy передаёт доверенный `X-Real-IP`, по IP: 10 попыток за 15 минут. Изменяющие API-запросы отклоняются без same-origin `Origin` или `Referer`.

### Важно о прежней SQLite-базе

Ранее использовавшаяся `prisma/dev.db` не удаляется и автоматически не переносится. Переключение на PostgreSQL создаёт отдельную базу; данные из SQLite нужно импортировать отдельно после проверки их состава. Для первоначального локального запуска используйте `prisma db push`, а не применение старой SQLite-миграции к PostgreSQL.

## Оригинальная инструкция Next.js

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
