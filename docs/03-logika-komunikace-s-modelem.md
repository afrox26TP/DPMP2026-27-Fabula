# Logika komunikace s modelem

`llm/kobold.js` = klient KoboldCpp, `llm/story.js` = logika, zkouska `node demo.js`. Cisty JS bez UI, pozdeji to pouzije frontend.

- **Komunikace** – `/v1/chat/completions` (streamovany chat; sablonu chatu doplni server podle modelu, prompty jsou tak pro vsechny modely stejne), `/api/extra/tokencount` (pocet tokenu podle tokenizeru modelu), `/api/extra/true_max_context_length` (skutecna velikost kontextu) [1].
- **Prompty** – anglicky. System: romanopisec pro dospele + pravidla (sceny ne shrnuti, pomale tempo, zive postavy, rytmus, zadna klise, jen text pribehu); pamet pise druhy system (editor). Pak zanr, namet, osnova, pamet, konec pribehu a ukol. Ukol je posledni, takze plan i text maji stejny zacatek a server ho zpracuje jen jednou (pro text pak uz jen asi 200 tokenu, pokud se pribeh nezkracuje). Samplery: proza temp 0,8 / min_p 0,05 [2] / DRY [3] pres cely kontext, ktere tresta az opakovani delsi nez 4 tokeny za sebou, plan 0,8 / 0,1, pamet 0,4 / 0,1. Co neposilam, nechava KoboldCpp na vychozich hodnotach (top_p 0,9, top_k 100) [4].
- **Planovani** – jeden krok: model si naplanuje 2–3 udalosti (max 200 tokenu) a pak je napise (~500 slov, max 1 000 tokenu). Prazdny pribeh zacne uvodni scenou bez planu. Text useknuty limitem se zkrati na celou vetu, useknuty plan o nedopsany posledni radek; prazdny plan nebo text skonci chybou.
- **Pamet** – prubezne shrnuti (postavy, fakta, udalosti, ted) do 400 slov. Jakmile pribude 6 000 znaku, model dostane stare poznamky + ten novy kus textu a vrati nove (max 900 tokenu; useknute napise znovu a kratsi).
- **Kontext** – z pribehu se posila jen konec, max 24 000 znaku (asi 5 300 tokenu), zbytek kryje pamet. Prompt (vse, co se modelu posila) mel v dlouhem pribehu nejvys 6 318 tokenu (s plnou pameti by to bylo asi 6 800) a i s odpovedi do 1 000 tokenu se vejde do 8k; zbytek 16k je rezerva na osnovu, kartoteku a styl. Prompt planu i textu se predem spocita tokenizerem; dokud se s odpovedi nevejde do kontextu, ubere se 10 % textu pribehu. Text, ktery pamet jeste nepokryva, se neubira: kdyz se nevejde ani tak, skonci to chybou.

## Overeni

Gemma 4 31B. Nastaveni ze `start.bat` (kontext 16 384) bezelo naposled 27. 11. 2026: vsech 61 vrstev na GPU, VRAM 15 229 z 16 303 MiB (asi 2,4 GB z toho jine programy), 2 kroky (906 slov) za 48 s, 38–45 tok/s. Behy nize jsou z 22. 11. s kontextem 8 192 (16k se ten den vedle jinych programu do VRAM neveslo), jinak stejne nastaveni. Useknuty nebo prazdny plan, prazdny text a pribeh, ktery se nevejde, v zadnem behu nenastaly; ty jsem zkousel jen bez modelu proti falesnemu serveru. Vystupy a ten test jsou v `mereni/` mimo repo.

- **Dlouhy pribeh** – 6 kroku za 170 s (28 s na krok i s planem a doplnovanim pameti), 15 661 → 31 285 znaku. Zacatek uz model nevidi, pamet pokryva 24 000 znaku (307 slov), v kontextu bylo nejvys 6 961 z 8 192 tokenu (prompt 6 308 + odpoved 653; nejvetsi prompt 6 318 mel odpoved 598), 30–37 tok/s.
- **Zkracovani** – s osnovou 9 700 znaku napocital tokenizer 8 305 (plan) a 8 337 tokenu (text) a prompt se nevesel. Text pribehu se zkratil z 24 000 na 21 600 znaku pro plan a na 17 496 pro text (pak 6 911 tokenu, server k tomu prida 17 tokenu sablony chatu), v kontextu bylo nejvys 7 922 z 8 192 (prompt planu 7 784 + odpoved 138).
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

## Zdroje

1. LOSTRUINS. *KoboldCpp 1.121 – dokumentace API (kcpp_docs.embd)*. Online. 2026. Dostupne z: https://raw.githubusercontent.com/LostRuins/koboldcpp/v1.121/embd_res/kcpp_docs.embd. [cit. 2026-11-26].
2. NGUYEN, M. N. et al. *Turning Up the Heat: Min-p Sampling for Creative and Coherent LLM Outputs*. Online. 2024. Dostupne z: https://arxiv.org/abs/2407.01082. [cit. 2026-11-26].
3. OOBABOOGA. *textgen: DRY: A modern repetition penalty that reliably prevents looping (pull request #5677, autor p-e-w)*. Online. 2024. Dostupne z: https://github.com/oobabooga/textgen/pull/5677. [cit. 2026-11-26].
4. LOSTRUINS. *KoboldCpp 1.121 – koboldcpp.py*. Online. 2026. Dostupne z: https://github.com/LostRuins/koboldcpp/blob/v1.121/koboldcpp.py. [cit. 2026-11-26].
