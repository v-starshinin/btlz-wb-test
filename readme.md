# Как получить GOOGLE_SA_CREDENTIALS (base64)

1. Перейдите в Google Cloud Console (https://console.cloud.google.com/) и выберите или создайте нужный проект.
2. Включите Google Sheets API для проекта:
	- APIs & Services > Library
	- Найдите Google Sheets API
	- Нажмите Enable
3. Создайте сервисный аккаунт:
	- APIs & Services > Credentials
	- Create Credentials > Service Account
	- Заполните имя и описание, нажмите Create
4. На вкладке Service Accounts найдите нужную строку, откройте, вкладка "Keys"
5. Add Key > Create new key > выберите в формате JSON, скачайте файл
6. Преобразуйте скачанный credentials.json в base64:
```bash
base64 -w 0 path/to/credentials.json > credentials.base64
cat credentials.base64
```
	- Или без файла: `base64 -w 0 path/to/credentials.json`
7. Полученную длинную строку base64 вставьте в переменную GOOGLE_SA_CREDENTIALS в .env
8. Сервисный аккаунт (email из json) должен иметь права на редактирование нужных Google Sheets (поделитесь доступом в самом Google Sheets и добавьте этот email как редактора)

# Шаблон для выполнения тестового задания

## Описание
Шаблон подготовлен для того, чтобы попробовать сократить трудоемкость выполнения тестового задания.

В шаблоне настоены контейнеры для `postgres` и приложения на `nodejs`.  
Для взаимодействия с БД используется `knex.js`.  
В контейнере `app` используется `build` для приложения на `ts`, но можно использовать и `js`.

Шаблон не является обязательным!\
Можно использовать как есть или изменять на свой вкус.

Все настройки можно найти в файлах:
- compose.yaml
- dockerfile
- package.json
- tsconfig.json
- src/config/env/env.ts
- src/config/knex/knexfile.ts

## Команды:

Запуск базы данных:
```bash
docker compose up -d --build postgres
```

Для выполнения миграций и сидов не из контейнера:
```bash
npm run knex:dev migrate latest
```

```bash
npm run knex:dev seed run
```
Также можно использовать и остальные команды (`migrate make <name>`,`migrate up`, `migrate down` и т.д.)

Для запуска приложения в режиме разработки:
```bash
npm run dev
```

Запуск проверки самого приложения:
```bash
docker compose up -d --build app
```

Для финальной проверки рекомендую:
```bash
docker compose down --rmi local --volumes
docker compose up --build
```

PS: С наилучшими пожеланиями!
