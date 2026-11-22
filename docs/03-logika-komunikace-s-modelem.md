# Logika komunikace s modelem

`llm/kobold.js` = klient KoboldCpp, `llm/story.js` = logika, zkouska `node demo.js`. Cisty JS bez UI, pozdeji to pouzije frontend.

- **Komunikace** – `/v1/chat/completions` (streamovany chat; sablonu chatu doplni server podle modelu, prompty jsou tak pro vsechny modely stejne), `/api/extra/tokencount` (pocet tokenu podle tokenizeru modelu), `/api/extra/true_max_context_length` (skutecna velikost kontextu).
- **Prompty** – anglicky. System: romanopisec pro dospele + pravidla (sceny ne shrnuti, pomale tempo, zive postavy, rytmus, zadna klise, jen text pribehu); pamet pise druhy system (editor). Pak zanr, namet, osnova, pamet, konec pribehu a ukol. Ukol je posledni, takze plan i text maji stejny zacatek a server ho zpracuje jen jednou (pro text pak uz jen asi 200 tokenu, pokud se pribeh nezkracuje). Samplery: proza temp 0,8 / min_p 0,05 / DRY pres cely kontext, ktere tresta az opakovani aspon 4 tokenu za sebou, plan 0,8 / 0,1, pamet 0,4 / 0,1.
- **Planovani** – jeden krok: model si naplanuje 2–3 udalosti (max 200 tokenu) a pak je napise (~500 slov, max 1 000 tokenu). Prazdny pribeh zacne uvodni scenou bez planu. Text useknuty limitem se zkrati na celou vetu.
- **Pamet** – prubezne shrnuti (postavy, fakta, udalosti, ted) do 400 slov. Jakmile pribude 6 000 znaku, model dostane stare poznamky + ten novy kus textu a vrati nove (max 900 tokenu; useknute napise znovu a kratsi).
- **Kontext** – z pribehu se posila jen konec, max 24 000 znaku (asi 5 300 tokenu), zbytek kryje pamet. Cely pozadavek mel pri mereni nejvys 6 318 tokenu + odpoved (s plnou pameti by to bylo asi 6 800) a vejde se i do 8k; zbytek 16k je rezerva na osnovu, kartoteku a styl. Pozadavek na plan i text se predem spocita tokenizerem; dokud se s odpovedi nevejde do kontextu, ubere se 10 % textu pribehu, a kdyz se nevejde ani bez nej, skonci chybou.

## Overeni

Gemma 4 31B, 22. 11. 2026, kontext 8 192 (16k se ten den vedle jinych programu do VRAM neveslo). Vystupy v `mereni/2026-11-22` mimo repo.

- **Dlouhy pribeh** – 6 kroku, 15 661 → 31 285 znaku. Zacatek uz model nevidi, pamet pokryva 24 000 znaku (307 slov), nejvetsi pozadavek 6 961 z 8 192 tokenu, 30–37 tok/s.
- **Zkracovani** – s osnovou 9 700 znaku se pozadavek nevesel (8 337 tokenu), text pribehu se zkratil z 24 000 na 17 496 znaku (6 911 tokenu) a server dostal nejvys 7 922 z 8 192.
- **DRY** – bez DRY nebylo ve 4 167 slovech zadne slovo mimo slovnik (s DRY byla 4 v 8 115 slovech, pocitam i behy z 18. a 19. 11.), ale kratke fraze se opakovaly casteji (16,5 proti 10 na 1 000 slov). Na miste tri rozbitych slov jsem nechal model pokracovat znovu: jedno zmizelo bez DRY i s mirnejsim DRY (`dry_allowed_length: 4`), dve dela model sam. Nechavam proto mirnejsi DRY; dlouhy beh s nim jeste nemam a ve dvou krocich se jedno rozbite slovo objevilo i tak.
- **Omezeni** – pamet je ztratova (po 30 000 znacich z prvni tretiny drzi jen hlavni linii), tempo je porad rychle (kazdy plan ma 2–3 odhaleni, jina verze promptu planu to nezmenila) a upravu uz shrnuteho textu pamet zatim neresi (vynulovani z dok. 02 prijde s editorem).

Ukazka z dlouheho pribehu, plan jednoho kroku a kus pameti:

```text
[plan]  1. Mara resists the urge to hand over the locket and instead steps onto the ledge of the open hatch, testing the stability of the descent.
[plan]  2. The entity lets out a guttural shriek, causing the station's structural integrity to buckle and revealing a hidden chamber of biological machinery beneath the hatch.
[plan]  3. Tobias reveals that the "blood sacrifice" mentioned in the note is not a metaphor, but a requirement for the ship's air-lock to stabilize.
[pamet] - Mara: Radio operator/captain's descendant; seeks truth/the Solveig; protagonist.
[pamet] - The Locket: Gold conduit that anchors the bridge between station and ship.
[pamet] - Mara refuses the entity and steps onto a biological bridge of chitin and veins.
[pamet] - Status: Mara is on the biological bridge; the Captain is attacking; the station is structurally failing.
```
