# Navrh architektury, REST API a datoveho modelu

## Architektura

```mermaid
flowchart LR
    UI["Prohlizec<br/>React + Vite, logika modelu llm/"]
    API["Backend :5002<br/>Python, FastAPI"]
    DB[("SQLite")]
    KC["KoboldCpp :5001"]
    GPU[("model GGUF ve VRAM")]
    UI -- "REST /api, JSON, cookie" --> API
    API -- "sqlite3" --> DB
    API -- "/api/llm, stream" --> KC
    KC --> GPU
```

| Cast | Technologie | Co dela |
|---|---|---|
| frontend | React + Vite | editor, projekty, kartoteka, ucet; bezi v nem i logika modelu z bodu 3 (`llm/`) |
| backend | Python, FastAPI | REST API, ucty a prihlaseni, jako jediny pracuje s databazi; pres `/api/llm` preposila pozadavky na KoboldCpp |
| databaze | SQLite | jeden soubor, pristup pres `sqlite3` bez ORM |
| LLM server | KoboldCpp | drzi model ve VRAM a generuje text (dok. 01) |

Vse bezi lokalne na `127.0.0.1`, backend servuje i sestaveny frontend, takze prohlizeci staci jedna adresa. Logika modelu je v JS uz z bodu 3, proto zustava ve frontendu a backend k modelu jen preposila.

Pokracovani pribehu: frontend si pres REST API nacte projekt a kapitoly → `llm/story.js` slozi prompt a posle ho na `/api/llm` → backend overi prihlaseni a streamuje odpoved z KoboldCpp → frontend novy text a pamet ulozi pres `PUT`.

Hesla Argon2id, prihlaseni = nahodny token v cookie `HttpOnly`, `SameSite=Strict` a v tabulce `sessions`.

## Datovy model

```mermaid
erDiagram
    users ||--o{ sessions : "ma"
    users ||--o{ projects : "vlastni"
    users ||--o{ styles : "vlastni"
    styles |o..o{ projects : "je pouzit v"
    projects ||--o{ chapters : "obsahuje"
    projects ||--o{ codex : "ma kartoteku"

    users {
        INTEGER id PK
        TEXT username UK
        TEXT password_hash "Argon2id"
    }
    sessions {
        TEXT token PK "nahodny, je i v cookie"
        INTEGER user_id FK
    }
    projects {
        INTEGER id PK
        INTEGER user_id FK
        INTEGER style_id FK "muze byt NULL"
        TEXT name
        TEXT genre
        TEXT premise
        TEXT outline
        TEXT memory "pamet pribehu z bodu 3"
        INTEGER memory_up_to "kolik znaku textu pamet pokryva"
    }
    chapters {
        INTEGER id PK
        INTEGER project_id FK
        INTEGER position "poradi v rukopisu"
        TEXT title
        TEXT text
    }
    styles {
        INTEGER id PK
        INTEGER user_id FK
        TEXT name
        TEXT description
        TEXT samples "ukazky textu"
    }
    codex {
        INTEGER id PK
        INTEGER project_id FK
        TEXT kind "character, place nebo item"
        TEXT name
        TEXT description
    }
```

Rukopis = kapitoly za sebou podle `position`, pamet patri projektu. Smazani uzivatele nebo projektu smaze i jeho data (`ON DELETE CASCADE`), smazani stylu jen vynuluje `projects.style_id`.

## REST API

JSON, bez prihlaseni `401`, cizi data `404`.

| Cesta | Metody |
|---|---|
| `/api/auth/register`, `/login`, `/logout` | POST |
| `/api/auth/me` | GET |
| `/api/projects`, `/api/styles`, `/api/projects/{id}/chapters`, `/api/projects/{id}/codex` | GET, POST |
| `/api/projects/{id}`, `/api/styles/{id}`, `/api/chapters/{id}`, `/api/codex/{id}` | GET, PUT, DELETE |
| `/api/llm/…` | brana na KoboldCpp |
