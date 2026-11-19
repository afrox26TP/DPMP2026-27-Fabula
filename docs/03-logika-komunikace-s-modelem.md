# Logika komunikace s modelem

`llm/kobold.js` = klient KoboldCpp, `llm/story.js` = logika, zkouska `node demo.js`. Cisty JS bez UI, pozdeji to pouzije frontend.

- **Komunikace** – `/v1/chat/completions` (streamovany chat), `/api/extra/tokencount` (pocet tokenu podle tokenizeru modelu), `/api/extra/true_max_context_length` (skutecna velikost kontextu).
- **Prompty** – anglicky. System: romanopisec pro dospele + pravidla (sceny ne shrnuti, pomale tempo, zive postavy, rytmus, zadna klise, jen text pribehu). Pak zanr, namet, osnova, pamet, konec pribehu a ukol. Samplery: proza temp 0,8 / min_p 0,05 / DRY pres cely kontext, plan 0,8 / 0,1, pamet 0,4 / 0,1.
- **Planovani** – jeden krok: model si naplanuje 2–3 udalosti (max 200 tokenu) a pak je napise (~500 slov, max 1 000 tokenu). Prazdny pribeh zacne uvodni scenou bez planu. Text useknuty limitem se zkrati na celou vetu.
- **Pamet** – prubezne shrnuti (postavy, fakta, udalosti, ted). Jakmile pribude 6 000 znaku, model dostane stare poznamky + ten novy kus textu a vrati nove.
- **Kontext** – z pribehu se posila jen konec, max 24 000 znaku (asi 5 300 tokenu), zbytek kryje pamet. Pozadavek na plan i text se predem spocita tokenizerem; dokud se s odpovedi nevejde do kontextu, ubere se 10 % textu.
