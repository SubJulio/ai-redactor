# Теневой AI-редактор (Shadow AI Editor)

Chrome Extension, который помогает писать лучше — прямо там, где ты работаешь.

## Что это делает

Два режима работы:

### 🎯 Инлайн-режим (Inline)
Работает прямо в Notion, Google Docs, LinkedIn, WordPress — я вижу, что ты пишешь, и подсказываю улучшения.
- Автоматический анализ текста в textarea и contenteditable полях
- Умные предложения по улучшению стиля тона
- Контекстно-зависимые рекомендации

### 📋 Popup-режим
Для нативных приложений (Outlook desktop, Slack desktop): копируешь текст → открываешь popup → получаешь улучшенную версию.
- Вставка текста для анализа
- Настройка тона: дружелюбный, деловой, убедительный, краткий
- История анализов

## Стек технологий

**Frontend (Chrome Extension):**
- TypeScript
- React (для popup)
- CSS Modules
- Vite

**Backend (API — будет на VPS):**
- Node.js + TypeScript
- Express
- PostgreSQL
- Prisma ORM

**AI:**
- Cloud.ru GLM-4.7

## Установка

### Требования

- Node.js 18+
- npm или yarn

### Локальная разработка

```bash
# Клонирование репозитория
git clone https://github.com/SubJulio/ai-redactor.git
cd ai-redactor

# Установка зависимостей
npm install

# Сборка
npm run build

# Сборка в watch-режиме
npm run dev
```

### Установка в Chrome

1. Открой Chrome → `chrome://extensions/`
2. Включи **Developer mode** (右上角)
3. Нажми **Load unpacked**
4. Выбери папку `dist/` проекта

## Использование

### Инлайн-режим

1. Перейди на страницу с текстовым полем (Notion, Google Docs, LinkedIn)
2. Начни писать — автоматический анализ включается автоматически
3. Открой popup → настрой API ключ Cloud.ru (если нужно)
4. Рекомендации появятся во всплывающих подсказках

### Popup-режим

1. Нажми на иконку расширения в браузере
2. Вставь текст из любого приложения
3. Выбери стиль поиска
4. Получай улучшенную версию

## Структура проекта

```
src/
├── content/
│   └── index.ts          # Content script для инлайн-режима
├── background/
│   └── index.ts          # Background service
├── popup/
│   ├── App.tsx           # React компонент popup
│   ├── index.tsx         # Entry point
│   └── index.module.css  # Стили
└── types/
    └── index.ts          # TypeScript типы
```

## Разработка

### Скрипты

```bash
npm run dev          # Development (watch mode)
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # TypeScript check
```

### Доступные команды

- `npm test` — запустить тесты (когда будут добавлены)
- `npm run lint:fix` — исправить ESLint ошибки

## Конфигурация

### API ключи

Открой popup → Settings → введи API ключ Cloud.ru GLM-4.7

Настройки сохраняются локально в `chrome.storage.local`.

## Roadmap

- [ ] Интеграция с backend на VPS
- [ ] Пользовательские аккаунты и биллинг
- [ ] Метрики эффективности
- [ ] DIY настройки стиля
- [ ] Командная версия

## Лицензия

MIT

## Контрибьюшн

Pull requests приветствуются!

---

**Created by:** Ouroboros AI Agent 🐍