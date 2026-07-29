# Звуження фокусу: з Todo-планера на платформу планування навчання

Дата: 2026-07-29
Статус: затверджено до імплементації

## 1. Проблема

Поточний застосунок реалізує ТЗ із `PROJECT_SPEC.md` — управління персональними задачами з двома AI-функціями. За результатом обговорення з керівником дипломної роботи він читається як звичайний Todo/планер: домен не звужений, AI-функції universal-purpose, жодна частина інтерфейсу не вказує на конкретну предметну область.

Ціль зміни — зробити застосунок **платформою планування навчання**, де:

- користувач веде те, що вивчає, а не абстрактні задачі;
- AI пропонує наступні **навчальні** кроки, а не будь-які задачі;
- до кожної пропозиції додається **література** — книги в першу чергу, а також курси й статті.

Обидві наявні AI-функції зберігаються. Додається третя можливість — підбір джерел і їх накопичення в бібліотеці користувача.

## 2. Межі змін

**У межах:**

- копірайт усього інтерфейсу, метадані, README, `package.json`;
- system-промпти обох AI-функцій жорстко фіксують навчальний домен;
- нова сутність `LearningResource` і поле `Task.resources`;
- серверна санітизація посилань проти галюцинацій моделі;
- відмова від не-навчальних цілей у `Plan a goal`;
- третя вкладка `Library`;
- оновлення `PROJECT_SPEC.md` та тестів.

**Поза межами:**

- перейменування типів `Task` / `Category` на `Course` / `Subject` — лишаються як є, змінюються тільки лейбли в UI;
- будь-які нові сутності крім `LearningResource`;
- бекенд, база даних, авторизація — застосунок лишається на `localStorage`;
- зміна ключа `localStorage` (`todo-ai:v1` зберігається, щоб не втратити наявні дані).

## 3. Позиціонування та копірайт

Відображувана назва — **StudyPath**. Це рядок у `app/layout.tsx` і поле `name` в `package.json`; назва каталогу проєкту не змінюється.

Мова всього інтерфейсу — англійська (як і зараз).

| Місце | Було | Стане |
|---|---|---|
| `app/layout.tsx` → `metadata.title` | `Todo AI` | `StudyPath — AI learning planner` |
| `app/layout.tsx` → `metadata.description` | Personal task management with AI suggestions… | `Plan what you learn: turn study goals into steps and get AI-suggested reading.` |
| `app-shell.tsx` → `h1` | `My Tasks` | `My learning plan` |
| `app-shell.tsx` → підзаголовок | Manage your tasks and get structured AI suggestions. | `Track what you are studying and let AI suggest next steps and reading.` |
| Кнопка створення | `Add Task` | `Add study task` |
| Кнопки AI | `AI recommendations`, `Plan a goal` | без змін |
| Вкладки | `Active` / `Done` | `In progress` / `Completed` / `Library` |
| `task-form-dialog` → `TITLES` | New task / Edit task / Proposed task | `New study task` / `Edit study task` / `Suggested study task` |
| `task-form-dialog` → опис `proposed` | Review and edit the details, then add it to your tasks. | `Review the plan and the reading list, then add it to your studies.` |
| Поле title | `Title` / `What needs to be done?` | `Title` / `What do you want to learn?` |
| Поле category | `Category` | `Subject` |
| Поле deadline | `Deadline` | `Target date` |
| Поле subtasks | `Subtasks` | `Study steps` |
| `category-select` | Create new category / No category | `Create new subject` / `No subject` |
| Empty state (active) | You have no active tasks yet. | `Nothing in progress yet.` |
| Empty state (active) опис | Create a task manually or describe your goal so AI can help shape it. | `Add a study task, or describe a learning goal and let AI build the plan.` |
| Empty state (active) кнопка | Create your first task | `Add your first study task` |
| Empty state (done) | Tasks you complete will appear here. | `Study tasks you finish will appear here.` |
| `task-details-dialog` → `SOURCE_LABELS` | Created manually / From AI recommendation / From text prompt | `Added manually` / `From AI recommendation` / `From a learning goal` |
| `ai-recommendations-dialog` опис | Suggestions based on your task history. Review, edit, or dismiss each one. | `Next study steps based on what you are already learning. Review, edit, or dismiss each one.` |
| `ai-recommendations-dialog` → `NOT_ENOUGH_HISTORY_MESSAGE` | Add or complete a few tasks so the system can build personalized recommendations. | `Add or complete a few study tasks so we can suggest what to learn next.` |
| `ai-goal-dialog` заголовок | Generate a task from a goal | `Plan a learning goal` |
| `ai-goal-dialog` опис | Describe what you want to do and AI will turn it into a structured task. | `Describe what you want to learn. AI will break it into steps and suggest reading.` |
| `ai-goal-dialog` label + placeholder | Your goal / Describe your goal or what you want to do… | `Your learning goal` / `e.g. Learn React fundamentals over the next month` |
| `ai-goal-dialog` кнопка | Generate task | `Build the plan` |
| `task-form-dialog` → AI-блок | Why AI suggested this | без змін |
| `README.md` | Next.js boilerplate | опис проєкту, запуск, змінні оточення, тести |
| `package.json` → `name` | `project-next` | `studypath-ai` |

Тексти, пов'язані з новим функціоналом, наведені в розділах 6–8.

## 4. Модель даних

### 4.1. Нові типи (`types/index.ts`)

```ts
export type ResourceKind = "book" | "article" | "course";

export interface LearningResource {
  id: string;
  kind: ResourceKind;
  title: string;
  author?: string;
  year?: number;
  url?: string;
  note: string;
  read: boolean;
}

export interface AiResourceDTO {
  kind: ResourceKind;
  title: string;
  author: string | null;
  year: number | null;
  url: string | null;
  note: string;
}
```

`note` — одне речення про те, чим саме це джерело корисне для конкретної теми. Поле обов'язкове: воно перетворює список назв на обґрунтовану добірку.

### 4.2. Зміни в наявних типах

- `Task` отримує `resources: LearningResource[]` (завжди масив, може бути порожнім).
- `TaskInput` (`components/tasks-provider.tsx`) отримує `resources?: LearningResource[]`.
- `TaskPatch` (`lib/tasks-reducer.ts`) розширюється на `"resources"`.
- `ActiveTab` стає `"active" | "done" | "library"`.
- `AiRecommendationsResponse` стає `{ recommendations: AiRecommendationDTO[]; resources: AiResourceDTO[] }`.
- `AiParseResponse` стає `{ recommendation: AiRecommendationDTO; resources: AiResourceDTO[] }`.
- `AiRecommendationDTO` **не змінюється** — джерела не належать окремій рекомендації, вони спільні для відповіді.

### 4.3. Міграція збережених даних

`lib/storage.ts`:

- `normalizeTasks` додає `resources: normalizeResources(t.resources)`, де `normalizeResources` повертає `[]` для не-масиву й відфільтровує елементи без рядкового `title` або без валідного `kind`. Кожен елемент отримує `id` (наявний або згенерований із назви) і `read: Boolean(s.read)`.
- `loadState` для `activeTab` починає приймати три значення: `parsed.activeTab === "done" || parsed.activeTab === "library" ? parsed.activeTab : "active"`.

Старі записи в `localStorage` лишаються валідними — нові поля добудовуються при читанні. Ключ не змінюється.

## 5. Санітизація джерел (`lib/ai/resources.ts`)

Новий модуль, який виконується **на сервері** над відповіддю моделі до того, як вона потрапить у роут. Головна мета — не показати користувачу неіснуюче посилання.

### 5.1. Allowlist доменів

```ts
const ALLOWED_HOSTS = [
  "coursera.org", "edx.org", "udacity.com", "khanacademy.org",
  "ocw.mit.edu", "mit.edu", "stanford.edu", "harvard.edu",
  "cs50.harvard.edu", "openstax.org",
  "developer.mozilla.org", "w3.org", "docs.python.org",
  "react.dev", "nextjs.org", "typescriptlang.org",
  "arxiv.org", "acm.org", "ieee.org", "nature.com",
  "freecodecamp.org", "github.com", "wikipedia.org",
  "oreilly.com", "manning.com", "pragprog.com",
];
```

### 5.2. Правила

1. `kind === "book"` → `url` завжди відкидається. Книга ідентифікується автором, назвою і роком; посилання на книгу — найчастіше джерело галюцинацій.
2. Для решти: `url` має розбиратись через `new URL()`, мати протокол `https:`, і його `hostname` має дорівнювати запису з allowlist або закінчуватись на `"." + host`. Інакше `url` стає `undefined`, **а саме джерело лишається** — користувач бачить назву й може знайти її сам.
3. `title` порожній → джерело відкидається повністю.
4. `note` порожній → підставляється `""`, джерело лишається (UI просто не рендерить блок).
5. `year` приймається лише як ціле число в діапазоні 1900…поточний рік + 1.
6. Дедуплікація за `title.trim().toLowerCase()`.
7. Сортування: спершу `book`, потім `course`, потім `article`.
8. Обрізання до `MAX_RESOURCES = 5`.

Публічний API модуля:

```ts
export function sanitizeResourceUrl(url: string | null, kind: ResourceKind): string | undefined;
export function sanitizeResources(raw: unknown): AiResourceDTO[];
```

`sanitizeResources` приймає `unknown`, бо працює над непровіреним виводом моделі, і завжди повертає валідний масив (у гіршому випадку порожній).

### 5.3. Тести (`lib/ai/resources.test.ts`)

- книга з посиланням → посилання видалено, джерело збережене;
- курс з `https://coursera.org/…` → посилання збережене;
- курс з `https://www.coursera.org/…` (піддомен) → посилання збережене;
- курс з `https://coursera.org.evil.com/…` → посилання видалене;
- `http://` замість `https://` → посилання видалене;
- нерозбірний рядок замість URL → посилання видалене, без винятку;
- джерело без назви → відкинуте;
- дублікати за назвою в різному регістрі → лишається один;
- 8 джерел на вході → 5 на виході;
- `raw` не масив (`null`, `"text"`, `{}`) → `[]`;
- порядок: книга перед курсом перед статтею;
- `year: "1999"` або `year: 3200` → `undefined`.

## 6. AI-функція №1 — рекомендації з літературою

### 6.1. Промпт (`lib/ai/openai.ts` → `generateRecommendations`)

System-промпт переписується. Ключові вимоги:

- роль — асистент з планування **навчання**, не загальний планувальник задач;
- кожна пропозиція має бути навчальною дією: вивчити тему, відпрацювати навичку, прочитати матеріал, зробити навчальний проєкт, підготуватись до іспиту чи співбесіди;
- не-навчальні записи в історії користувача ігноруються, або переосмислюються через навчальний кут, якщо це природно;
- 3–5 пропозицій, кожна з `subtasks` як послідовністю навчальних кроків;
- окремо — 3–5 джерел по спільній темі історії користувача;
- пріоритет джерел: книги, потім курси, потім статті;
- посилання дозволені лише на широковідомі сталі ресурси; якщо модель не впевнена в URL — вона повертає `null`, а не вигадує;
- поле `note` пояснює, чим джерело корисне саме для цієї теми.

### 6.2. JSON-схема

`RESOURCE_ITEM_SCHEMA` з полями `kind` (`enum: ["book", "article", "course"]`), `title`, `author`, `year`, `url`, `note`. Усі поля в `required`, nullable — через `type: ["string", "null"]` / `["integer", "null"]`, як того вимагає `strict: true`.

`RECOMMENDATIONS_SCHEMA` отримує другу властивість `resources: { type: "array", items: RESOURCE_ITEM_SCHEMA }` і додає `"resources"` у `required`.

### 6.3. Роут

`app/api/ai/recommendations/route.ts` повертає `{ recommendations, resources }`, де `resources` пропущені через `sanitizeResources`. Наявна перевірка `isRecommendationList` зберігається; для джерел додаткова валідація не потрібна, бо `sanitizeResources` гарантує коректну форму.

### 6.4. UI

`components/ai-recommendations-dialog.tsx` під списком карток отримує секцію:

```
Recommended reading
Books and courses for what you are studying. Checked items go with the task you add.
```

Рендериться через новий `components/resource-list.tsx` із чекбоксами вибору. Перетворення `AiResourceDTO[]` → `LearningResource[]` (присвоєння `id` через `newId()` і `read: false`) виконується один раз у `lib/ai/client.ts` при отриманні відповіді, а не в компоненті — так `id` гарантовано стабільні й компоненти скрізь працюють з одним типом. Стан діалогу оперує цими `id`:

- `selectedIds: Set<string>` — за замовчуванням усі;
- `savedIds: Set<string>` — джерела, вже додані до якоїсь задачі.

Поведінка:

- клік «View & edit» на рекомендації → у префіл форми потрапляють джерела, чиї `id` є в `selectedIds` і відсутні в `savedIds`;
- після успішного додавання задачі ці `id` переходять у `savedIds`, знімаються з `selectedIds` і рендеряться приглушено з бейджем `Saved`;
- якщо джерел немає — секція не рендериться;
- у станах `loading` / `insufficient` / `error` секція не рендериться.

Секція не має власного стану «додати без задачі»: джерела завжди належать задачі. Це тримає модель даних простою і робить вкладку `Library` похідною, а не окремим сховищем.

## 7. AI-функція №2 — навчальна ціль і відмова від сторонніх

### 7.1. Промпт (`lib/ai/openai.ts` → `parseIntent`)

- Роль: перетворити навчальну ціль користувача на одну структуровану задачу зі списком кроків і добіркою літератури.
- Модель спершу визначає, чи є ціль навчальною. Навчальна = вивчення теми, опанування навички чи мови, підготовка до іспиту/співбесіди/сертифікації, читання за темою, навчальний проєкт заради практики.
- Якщо ціль не навчальна (побутова справа, покупка, робоче доручення без навчальної складової) — `offTopic: true`, решта полів заповнюються заглушками.
- Якщо навчальна — `offTopic: false`, повний набір полів плюс 3–5 джерел за тими самими правилами, що в 6.1.

### 7.2. Схема

`RECOMMENDATION_ITEM_SCHEMA` використовується у двох місцях, тому для `parseIntent` вводиться окрема `PARSE_INTENT_SCHEMA`:

```
{ offTopic: boolean, recommendation: RECOMMENDATION_ITEM_SCHEMA, resources: [RESOURCE_ITEM_SCHEMA] }
```

Схема рекомендацій із розділу 6 лишається незачепленою.

### 7.3. Роут

`app/api/ai/parse-intent/route.ts`:

1. валідація вводу — без змін;
2. якщо провайдер повернув `offTopic: true` → `422 { error: "off_topic" }`;
3. інакше — наявна перевірка `isRecommendationDTO`, і у відповідь `{ recommendation, resources }` із санітизованими джерелами.

Порядок важливий: перевірка `offTopic` йде **до** валідації DTO, бо при відмові поля рекомендації свідомо порожні.

### 7.4. Клієнт

`lib/ai/client.ts`:

- `AiErrorCode` розширюється на `"off_topic"`;
- `AI_ERROR_MESSAGES.off_topic` = `This planner is for learning goals. Try something like "Learn SQL basics" or "Prepare for the IELTS exam".`;
- `postJson` мапить `422` на `new AiError("off_topic")`;
- `requestParseIntent` повертає `{ recommendation, resources }`.

### 7.5. UI

`components/ai-goal-dialog.tsx`:

- `off_topic` показується **інлайн** під полем вводу (як `error`), не тостом — користувач має бачити приклад і одразу переписати ціль;
- решта помилок лишаються тостами;
- текст очищується від помилки при редагуванні поля;
- при успіху діалог передає нагору і рекомендацію, і джерела.

`components/app-shell.tsx` → `handlePromptResult` кладе джерела в `prefill.resources`.

## 8. Reading list у формі й деталях задачі

### 8.1. Форма задачі

`components/task-form-dialog.tsx` отримує секцію `Reading list` під `Study steps`:

- рендериться через `ResourceList` у режимі з видаленням;
- секція показується тільки якщо `resources.length > 0` (у режимі `create` вручну джерела не додаються — вони приходять лише від AI);
- `TaskFormPrefill` отримує `resources?: LearningResource[]`;
- у режимі `edit` секція показує наявні `task.resources` і дозволяє видаляти зайве;
- `handleSubmit` передає `resources` у `TaskInput`.

### 8.2. Деталі задачі

`components/task-details-dialog.tsx` після блоку `Subtasks` отримує блок `Reading list` із лічильником `2/4 read` і чекбоксами `read`, що ведуть у `onToggleResourceRead(taskId, resourceId)`.

### 8.3. Компонент `components/resource-list.tsx`

Один презентаційний компонент на чотири місця вжитку. Замість енуму режимів набір керуючих елементів визначається тим, які колбеки передані — так один рядок може одночасно мати і чекбокс `read`, і кнопку видалення (потрібно у вкладці `Library`).

```ts
interface ResourceListProps {
  resources: LearningResource[];
  selectedIds?: Set<string>;
  savedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleRead?: (id: string) => void;
  onRemove?: (id: string) => void;
  renderSource?: (id: string) => ReactNode;
}
```

Місця вжитку:

| Місце | Передані колбеки |
|---|---|
| Діалог рекомендацій | `selectedIds`, `savedIds`, `onToggleSelect` |
| Форма задачі | `onRemove` |
| Деталі задачі | `onToggleRead` |
| Вкладка Library | `onToggleRead`, `onRemove`, `renderSource` |

Ліворуч у рядку рендериться рівно один чекбокс: `onToggleSelect` має пріоритет над `onToggleRead` (у діалозі рекомендацій відмітка «прочитано» не має сенсу). Кнопка видалення, якщо є `onRemove`, рендериться праворуч і не конфліктує з чекбоксом.

Рядок джерела:

- іконка за `kind` (`BookOpen` / `GraduationCap` / `FileText` з `lucide-react`);
- назва; якщо є валідний `url` — назва є посиланням із `target="_blank"` і `rel="noreferrer"`;
- рядок `author · year` приглушено, якщо є;
- `note` дрібним приглушеним текстом;
- бейдж `kind` (`Book` / `Course` / `Article`);
- керуючий елемент за режимом: чекбокс вибору, чекбокс `read`, або кнопка видалення.

Перетворення `AiResourceDTO[]` → `LearningResource[]` (присвоєння `id` через `newId()` і `read: false`) виконується один раз у `lib/ai/client.ts` при отриманні відповіді (див. 6.4), а не в компоненті діалогу. Усі місця вжитку, включно з діалогом рекомендацій, отримують уже готові `LearningResource` з стабільними `id` і далі працюють лише з цим типом, а не з DTO. Це дозволяє `ResourceList` мати один тип на вході.

## 9. Вкладка Library

### 9.1. Навігація

Панель вкладок у `app-shell.tsx` стає `grid-cols-3`: `In progress (n)` / `Completed (n)` / `Library (n)`, де `n` для Library — загальна кількість збережених джерел.

### 9.2. Вміст (`components/library-tab.tsx`)

- Джерела збираються з `tasks.flatMap(t => t.resources.map(r => ({ resource: r, task: t })))`.
- Групування за `kind` у порядку `Books` → `Courses` → `Articles`; порожні групи не рендеряться.
- Заголовок секції з лічильником прочитаного: `Books · 2/5 read`.
- Кожна група рендериться через `ResourceList` з `onToggleRead`, `onRemove` і `renderSource`; `renderSource` віддає кнопку-підпис `From: {task.title}`, клік по якій відкриває деталі задачі-джерела.
- Видалення джерела з бібліотеки видаляє його з задачі-джерела (одна дія `REMOVE_RESOURCE`, іншого сховища немає).
- Порожній стан: іконка `Library`, заголовок `Your reading list is empty.`, опис `Reading that AI suggests for your study goals will collect here.`

### 9.3. Reducer і провайдер

`lib/tasks-reducer.ts` отримує дві дії:

```ts
| { type: "TOGGLE_RESOURCE_READ"; taskId: string; resourceId: string }
| { type: "REMOVE_RESOURCE"; taskId: string; resourceId: string }
```

Обидві працюють за зразком наявного `TOGGLE_SUBTASK`: мапа по `tasks`, всередині мапа/фільтр по `resources`. `updatedAt` і `edited` при цьому **не** змінюються — відмітка про прочитане не є редагуванням задачі.

`components/tasks-provider.tsx` експонує `toggleResourceRead(taskId, resourceId)` і `removeResource(taskId, resourceId)` через контекст.

## 10. Mock-провайдер

`lib/ai/mock.ts` має лишитись повноцінним, щоб демонстрація працювала без `OPENAI_API_KEY`.

- `CATEGORY_KEYWORDS` звужується до навчальних напрямів: `Programming`, `Languages`, `Mathematics`, `Design`, `Business`.
- Шаблони рекомендацій переписуються на навчальні (`Review what you learned in "…"`, `Practice … with a small project`, `Prepare for the next milestone in …`).
- Додається `LEARNING_KEYWORDS` (`learn`, `study`, `master`, `course`, `exam`, `read`, `practice`, `prepare`, `understand`, `tutorial`, `skill`, `language`, `certification`, `revise`, `basics`, `fundamentals`) і функція `isLearningGoal(text)`.
- `parseIntent` повертає `{ offTopic: true }`-еквівалент, якщо жодного ключового слова немає.
- Додається невелика статична добірка джерел за напрямом (2–3 реальні класичні книги на кожен із напрямів, без посилань) — `mockResources(category)`.

`lib/ai/provider.ts` оновлює сигнатури: `getRecommendations` повертає `{ recommendations, resources }`, `getParsedIntent` повертає `{ offTopic, recommendation, resources }`.

## 11. Оновлення ТЗ (`PROJECT_SPEC.md`)

- Заголовок і розділ 1 переформульовуються під платформу планування навчання.
- Розділ 2 доповнюється підрозділом «2.4. Джерело для навчання» з описом полів і правилом про посилання.
- Розділи 10 і 13 доповнюються вимогою повертати літературу; розділ 13 — вимогою відхиляти не-навчальні цілі.
- Додається розділ «16. Бібліотека джерел» з описом вкладки.
- Розділ 15 доповнюється тим, що джерела зберігаються разом із задачею.

## 12. Тести

### 12.1. Юніт (`vitest`)

- `lib/ai/resources.test.ts` — новий, повний перелік у 5.3.
- `lib/tasks-reducer.test.ts` — додаються кейси на `TOGGLE_RESOURCE_READ` і `REMOVE_RESOURCE`, включно з тим, що `updatedAt` і `edited` не змінюються.
- `lib/ai/validate.test.ts` — без структурних змін, перевіряється сумісність.

### 12.2. E2E (`playwright`)

Наявні тести використовують лейбли, які змінюються, тому потребують оновлення:

- `e2e/tasks.spec.ts` — `Add Task` → `Add study task`, `Create task`, вкладки `Active`/`Done` → `In progress`/`Completed`, `Category` → `Subject`, `Deadline` → `Target date`, `Subtasks` → `Study steps`, порожні стани.
- `e2e/ai.spec.ts` — `Proposed task` → `Suggested study task`, `Generate task` → `Build the plan`, повідомлення про недостатню історію.
- `e2e/iteration2.spec.ts` — лейбли підзадач.

Нові сценарії:

1. `Plan a goal` з навчальною ціллю → форма містить секцію `Reading list` з непорожнім списком.
2. `Plan a goal` з побутовою ціллю → інлайн-повідомлення про навчальний фокус, форма не відкривається.
3. Прийняття рекомендації з відміченими джерелами → задача створена, у деталях видно `Reading list`.
4. Вкладка `Library` показує джерело доданої задачі; чекбокс `read` перемикає лічильник; видалення прибирає джерело і з бібліотеки, і з деталей задачі.
5. Перезавантаження сторінки → джерела й відмітки `read` збереглися.

## 13. Порядок реалізації

1. Типи, `storage`, `reducer`, провайдер — фундамент, без UI.
2. `lib/ai/resources.ts` + тести — ізольовано, покривається до інтеграції.
3. Промпти й схеми в `openai.ts`, `mock.ts`, роути, `client.ts`.
4. `resource-list.tsx`, потім його вживання у формі й деталях.
5. Секція reading list у діалозі рекомендацій, off-topic у діалозі цілі.
6. Вкладка `Library`.
7. Копірайт по всьому UI, `layout.tsx`, `README.md`, `package.json`.
8. Оновлення `PROJECT_SPEC.md`.
9. Оновлення e2e, прогін `npm run test`, `npm run test:e2e`, `npm run lint`, `npm run build`.

Кроки 1–3 не мають видимого ефекту в UI; перша візуальна перевірка можлива після кроку 5.

## 14. Ризики

| Ризик | Пом'якшення |
|---|---|
| Модель вигадує посилання | Allowlist доменів + заборона URL для книг + збереження джерела без посилання (розділ 5) |
| Модель вигадує назви книг | Промпт вимагає широковідомі видання; `note` змушує обґрунтувати вибір, що знижує кількість вигадок. Повністю не усувається — згадується в обмеженнях роботи |
| `strict: true` не приймає розширену схему | Усі нові поля додаються в `required`, nullable через `type: [..., "null"]`; перевіряється вручну на реальному ключі перед завершенням |
| Зростання відповіді моделі збільшує затримку | Обмеження 5 джерел; `gpt-4o-mini` лишається типовою моделлю |
| Оновлення лейблів ламає e2e | Лейбли й тести правляться в одному кроці (крок 9), повний прогін перед завершенням |
| Втрата даних у `localStorage` | Ключ не змінюється, нові поля добудовуються при читанні (розділ 4.3) |

## 15. Критерії готовності

- `npm run lint`, `npm run test`, `npm run test:e2e`, `npm run build` проходять.
- Жодна назва, опис чи порожній стан у UI не описує застосунок як загальний планувальник задач.
- `AI recommendations` на навчальній історії повертає навчальні пропозиції і непорожній `Recommended reading`.
- `Plan a goal` на «Learn SQL basics» дає задачу з кроками і літературою; на «vacuum the flat» — інлайн-відмову.
- Жодне посилання в UI не веде на домен поза allowlist; жодна книга не має посилання.
- Вкладка `Library` агрегує джерела всіх задач, відмітки `read` переживають перезавантаження.
- `PROJECT_SPEC.md` відповідає реалізації.
