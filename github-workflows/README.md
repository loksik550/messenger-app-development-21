# Автосборка Nova в облаке GitHub

## ВАЖНО: куда положить файл

GitHub Actions ищет workflow в строго определённой папке: **`.github/workflows/`**.

Скопируй файл `github-workflows/android-build.yml` в `.github/workflows/android-build.yml`
в своём GitHub-репозитории (точка перед `github` обязательна).

```
.github/
└── workflows/
    └── android-build.yml
```

После пуша в `main` GitHub автоматически запустит сборку.

---

## 3 режима сборки

| Режим | Что собирает | Когда запускается | Куда годится |
|-------|--------------|-------------------|--------------|
| **debug** | `app-debug.apk` | Автоматически при каждом push | Тест на телефоне, APK Editor Studio |
| **release** | `app-release.aab` без подписи | Только вручную | Подписать локально и в Google Play |
| **release-signed** | `app-release.apk` + `app-release.aab` подписанные | Только вручную (нужны Secrets) | Сразу в Google Play |

---

## Как запустить вручную

1. На GitHub: репозиторий → вкладка **Actions**
2. Слева: **Build Android APK**
3. Справа: кнопка **Run workflow**
4. Выбери режим (debug / release / release-signed)
5. **Run workflow** → жди 5-10 минут

Готовый файл → **Actions → твой run → блок Artifacts** (внизу страницы).

---

## Настройка автоподписи (для режима release-signed)

### Шаг 1. Создай ключ подписи (один раз, на твоём компьютере)

Нужен JDK (скачай Temurin 17 с adoptium.net). Открой терминал:

```bash
keytool -genkey -v -keystore nova-release.keystore -alias nova \
  -keyalg RSA -keysize 2048 -validity 10000
```

Ответь на вопросы (имя, организация, страна) и придумай **2 пароля**:
- от хранилища (keystore password)
- от ключа (key password) — можно сделать таким же

⚠️ **СОХРАНИ файл `nova-release.keystore` и оба пароля в надёжном месте.**
Если потеряешь — обновлять приложение в Google Play больше не сможешь, придётся
выпускать новое приложение с нуля.

### Шаг 2. Закодируй keystore в base64

**Linux / macOS:**
```bash
base64 nova-release.keystore | tr -d '\n' > keystore.b64.txt
cat keystore.b64.txt   # скопируй всё содержимое
```

**Windows (PowerShell):**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("nova-release.keystore")) | Out-File keystore.b64.txt
notepad keystore.b64.txt
```

### Шаг 3. Добавь 4 Secrets на GitHub

Репозиторий → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

Создай 4 секрета:

| Имя | Значение |
|-----|----------|
| `ANDROID_KEYSTORE_BASE64` | Всё содержимое файла `keystore.b64.txt` (длинная строка букв и цифр) |
| `ANDROID_KEYSTORE_PASSWORD` | Пароль от keystore (из Шага 1) |
| `ANDROID_KEY_ALIAS` | `nova` (тот, что указал в `-alias`) |
| `ANDROID_KEY_PASSWORD` | Пароль от ключа (из Шага 1) |

### Шаг 4. Запусти подписанную сборку

Actions → Build Android APK → **Run workflow** → выбери **release-signed** → запусти.

Через 5-10 минут в Artifacts:
- `nova-release-apk-signed` → готовый APK, можно сразу ставить на любой телефон
- `nova-release-aab-signed` → готовый AAB, можно сразу загружать в Google Play Console

---

## Как скачать готовый APK (любой режим)

1. GitHub → **Actions**
2. Кликни на сборку с ✅ зелёной галочкой
3. Прокрути вниз — блок **Artifacts**
4. Кликни на нужный артефакт — скачается zip
5. Распакуй → внутри `.apk` или `.aab`

---

## Как установить APK на телефон

1. Скинь `app-debug.apk` (или подписанный `app-release.apk`) на телефон
2. Открой файл → разреши установку из неизвестных источников
3. Установить → Готово

---

## Безопасность Secrets

GitHub Secrets шифрованы и **никогда не выводятся в логах** — даже если ты случайно
сделаешь `echo $ANDROID_KEYSTORE_PASSWORD`, в логе будет `***`. Ключ скачивается
в раннер, используется один раз и автоматически удаляется в шаге Cleanup keystore.

---

## Что делать если сборка падает

1. Открой красную сборку на вкладке Actions
2. Кликни на упавший шаг — раскрой лог
3. Найди строку с `error` или `FAILURE`
4. Скинь мне — починим

Самые частые проблемы:
- **`No matching variant`** → проблема с версиями плагинов в `node_modules`. Решение: удали `bun.lock` и `node_modules` локально, запушь свежий коммит.
- **`Keystore was tampered with`** → неверный пароль или неверный base64 в Secrets.
- **`Could not find @capacitor/...`** → `bun install` не отработал, чекни шаг Install dependencies.

---

## Лимиты бесплатного GitHub

- **Публичные репозитории** — неограниченно минут
- **Приватные** — 2000 минут/месяц (одна сборка ≈ 5 минут → 400 сборок)
- **Artifacts** — debug хранятся 30 дней, подписанные release — 90 дней
