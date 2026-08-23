# Airflow Mobile UI v2

> 🇷🇺 **Русский** · [GB English version](README.en.md)

Неофициальный мобильный веб-интерфейс для **Apache Airflow 2.10.5**.

> **Почему «v2»?** Проект вдохновлен и не продолжает [astronomer/airflow-ui](https://github.com/astronomer/airflow-ui) — proof-of-concept React-интерфейса, заархивированный владельцем 15 мая 2026 года. v2 - это самостоятельная реализация, написанная с нуля под мобильные устройства; суффикс «v2» лишь отличает репозиторий от того архивного проекта.

## О проекте

Быстрый доступ к Airflow со смартфона или планшета: мониторинг DAGs и запусков, смена их статусов, логи и XCom.

Отдельный инстанс поверх **REST API v1**; там, где REST-мутации в целевой инсталляции не работают — внутренние веб-формы Airflow с CSRF-токеном. Авторизация — через проксирование формы логина Airflow.

![Авторизация](docs/screenshots/login.png)

> Разработано и проверено строго под **Apache Airflow 2.10.5**. Гарантий работы с другими версиями нет.

## Технологии

| Технология | Версия | Зачем |
|---|---|---|
| React + TypeScript | 19.x, 6.0 strict | компонентный UI, типизация |
| Vite | 8.x | сборка и dev-прокси к Airflow |
| Chakra UI | 3.x | адаптивные компоненты |
| TanStack Query | 5.x | кэш, инвалидации, keepPreviousData |
| React Router | 7.x | маршруты |
| axios, date-fns, react-hook-form + zod, ESLint | — | HTTP, даты, формы/валидация, стиль |

## Функционал

**Список DAG** — карточки: имя, schedule, owner, tags, pause, статистика, точка последнего запуска. Поиск, фильтры All/Active/Paused/Running/Failed, пагинация. Последний запуск одним `POST /last_dagruns`.

![Список DAG](docs/screenshots/dags_list.png)

![Фильтры и пагинация](docs/screenshots/dags_filters.png)

![Фильтры и пагинация - 2](docs/screenshots/dags_filters_2.png)

**Детали DAG** — описание, meta, Trigger DAG (JSON), список Runs (Clear run, Mark state as, Apply to run).

![Детали DAG](docs/screenshots/dag_detail.png)

**Mark state as...** — выбор задач (task): смежные одной цепочкой `downstream=true`, разорванные своими POST; блок «Whole run» меняет статус всего запуска.

![Модалка Mark state](docs/screenshots/mark_state.png)

**Task Instances** — в flow-порядке, группы-сабдаги, Clear, Logs (выбор попытки), XCom.

![Логи таски](docs/screenshots/task_logs.png)

![XCom](docs/screenshots/xcom.png)

## Запуск

Минимальное окружение: **Node.js 20.19+** (рекомендуется 22 LTS), **npm 10+**, доступный **Apache Airflow 2.10.5** с учётной записью.

```bash
npm install
cp .env.example .env     # заполнить VITE_AIRFLOW_API_URL
npm run dev              # http://localhost:5173
```

Проверки: `npm run build`, `npm run lint`.

`.env` (см. `.env.example`): `VITE_AIRFLOW_API_URL` — URL инстанса; `VITE_AIRFLOW_API_PREFIX` — префикс API (по умолчанию `/api/v1`).

Production: статика из `dist/` за reverse proxy (nginx); проксирует `/api`, `/clear`, `/success`, `/failed`, `/confirm`, `/dagrun_*`, `/last_dagruns`, `/object`, `/static`, `/login`, `/logout` на Airflow.

## Нестабильные web-эндпоинты

Действия идут через внутренние эндпоинты (не REST v1): `POST /clear|/success|/failed` (CSRF формой), `GET /confirm` (preview), `POST /dagrun_success|/dagrun_failed`, `POST /last_dagruns` (заголовок `X-CSRFToken`), `GET /object/graph_data`, `GET /dags/{id}/grid` (CSRF). Они **не стабильны** между версиями Airflow — перед обновлением перепроверить.

## Лицензия

[GNU AGPL-3.0-only](LICENSE) — см. также [NOTICE](NOTICE). Модификации и сетевое использование (§13 AGPL) требуют публикации исходников под той же лицензией.

Проект — неофициальный клиент для Apache Airflow™, не аффилирован с Apache Software Foundation. Airflow™ и его логотип — товарные знаки ASF.
