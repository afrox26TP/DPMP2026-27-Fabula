# Reserse lokalniho behu LLM a vyber modelu

Cil: model co se i s kontextem 16k vejde do 16 GB VRAM. Meril jsem 13. 11. 2026 na RTX 5080 (16 303 MiB), Ryzen 7 9800X3D, KoboldCpp 1.121, KV cache q8_0. Modely: Gemma 4 26B-A4B heretic IQ3_XS (Gemma), Goetia 26B-A4B IQ3_XS, Qwen3.5-27B Derestricted IQ3_XXS (Qwen), WeirdCompound 24B IQ3_M, Hemmingway-1 (Qwen3.8-27B) IQ3_XXS, Gemma 4 31B heretic IQ2_M (Gemma 31B).

## GGUF a kvantizace

GGUF = format modelu pro llama.cpp, ma v sobe i tokenizer a sablonu chatu [1]. Kvantizace ulozi vahy s min bity [2], ztrata se meri KLD [3]:

| Typ | bpw | KLD |
|---|---|---|
| Q8_0 | 8,50 | 0,0014 |
| IQ4_XS | 4,46 | 0,0363 |
| IQ3_M | 3,76 | 0,1025 |
| IQ3_XS | 3,50 | 0,1387 |
| IQ3_XXS | 3,25 | 0,1836 |
| IQ2_XXS | 2,38 | 0,8120 |

(Llama 3 8B [3, 4]) Pod 3 bity to jde rychle dolu, ale vetsi model v nizsi presnosti porad vetsinou vyhraje [2]. 4 bity by se nevesly (Gemma 13,92 GB [5]), takze 3 bity, a Gemma 31B se nevejde ani tak [6] – ta jede na IQ2_M. Mensi 12B modely pisou o dost hur [7, 8].

## VRAM

VRAM = vahy + KV cache + buffery [9]:

| MiB pri 16k | Gemma | Goetia | Qwen | WeirdC. | Hemm. | Gemma 31B |
|---|---|---|---|---|---|---|
| vahy | 11 082 | 11 082 | 10 137 | 9 875 | 10 137 | 10 396 |
| KV cache | 345 | 345 | 553 | 1 381 | 553 | 1 381 |
| volno | 1 251 | 1 172 | 2 091 | 1 919 | 1 943 | 977 |
| tok/s 1k/15k | 117/111 | 126/113 | 51/46 | 57/52 | 49/41 | 43/35 |

Vesly se vsechny, Gemma 31B tak tak.

## Kontextove okno

Kontextove okno = kolik tokenu model najednou vidi, prompt i odpoved dohromady. Token je kus slova: v mem testu na Gemme 31B vyslo 500 slov prozy na asi 650 tokenu (4,5 znaku na token). Natrenovany kontext maji modely 131k (WeirdCompound) nebo 262k tokenu (ostatni, hodnota je v GGUF [1]). Jedu na 16k, protoze:

- **pamet** – KV cache roste s kontextem linearne [10]. Pri 32k mi vysla u Qwenu a Hemmingwaye 1 097 MiB misto 553, u Gemmy a Goetie jen 515 misto 345 (25 z 30 vrstev u nich vidi jen okno 1 024 tokenu [11]). WeirdCompound a Gemmu 31B jsem na 32k nezkousel, uz pri 16k maji 1 381 MiB a Gemme 31B zbyva 977 MiB.
- **rychlost** – plny 32k kontext zpomalil Gemmu ze 111 na 80 tok/s a Qwen ze 46 na 39.
- **kvalita** – dlouhy kontext modely neumi poradne vyuzit. V RULER udrzela pri 32k vykon jen pulka modelu, ktere 32k a vic slibuji [12], v NoLiMa spadlo pri 32k 11 ze 13 modelu pod polovinu vykonu z kratkeho kontextu [13]. Jehlu v kupce sena pri 15k dali vsichni moji kandidati, to je ale jen lehky test [12].

Kdyz se prompt s odpovedi nevejde, KoboldCpp nehlasi chybu a prompt usekne od zacatku [14] – zmizel by systemovy prompt a namet. Aplikace si proto pozadavek predem spocita tokenizerem serveru a starsi text nahrazuje pamet pribehu (dok. 03).

## KoboldCpp vs Ollama

Inferencni server = program, ktery drzi model v pameti a pres HTTP API z nej generuje text. Oba stoji na llama.cpp [15, 16], pousteji GGUF a maji API kompatibilni s OpenAI [17, 18]:

- **KoboldCpp** – jeden .exe bez instalace [15]. Model je soubor GGUF zadany pri startu, kontext a KV cache se nastavuji parametry [19].
- **Ollama** – po instalaci bezi na pozadi [20]. Modely stahuje prikazem `ollama pull` [21], vlastni GGUF se importuje pres Modelfile [22], do pameti je nacita sama a po 5 minutach uvolni [23].

| | KoboldCpp 1.121 | Ollama 0.40.16 |
|---|---|---|
| prepnuti modelu za behu | jen v admin rezimu [17] | samo podle pozadavku [23] |
| velikost kontextu | `--contextsize` pri startu [19] | do 24 GiB VRAM 4k [24], pres OpenAI API zmenit nejde [18] |
| pocitani tokenu | ano [17] | ne [25] |
| DRY proti opakovani | ano [17] | ne [26] |

Ollama je pohodlnejsi na spravu modelu. Pro bod 3 ale potrebuju predem spocitat tokeny a DRY, a to pres jeji API nejde. Beru **KoboldCpp**.

## Vyber modelu

Kriteria: ochota (nic nezjemni), selsky rozum, proza, souvislost, vejde se. Kandidati podle UGI [7] a EQ-Bench Longform [8]. Kazdy model napsal 3 pribehy (uvod 600 + pokracovani 1 800 tokenu) a kratke testy, hodnotil naslepo cloudovy LLM (ne lide). Data v `mereni/2026-11-13` mimo repo. 1. kolo: Qwen se zacyklil, Goetia porusovala fakta. Dal Gemma a WeirdCompound. 2. kolo:

| | Gemma 31B | Hemm. | Gemma | WeirdC. |
|---|---|---|---|---|
| realie presnost | **96 %** | 67 % | 89 % | 78 % |
| emoce (z 10) | **9** | 8 | 6 | 8 |
| pribehy poradi | 2,0 | **1,3** | 4,3 | 2,8 |
| plneni planu | **8,2** | 8,0 | 6,2 | 6,8 |
| rozbita slova | 10 | **2** | 16 | 4 |

Vybral jsem **Gemma 4 31B** – nejlepsi rozum a emoce, nic neodmitla. Je ale 3× pomalejsi a malo VRAM nechava. Rychla alternativa **Gemma 4 26B-A4B**. Omezeni: kazdy pribeh jen jednou a kratky, soudce je LLM (stejny text ohodnotil dvakrat jinak). Rozbita slova u Gemmy nespravila ani zmena KV cache ani DRY. Dal resit: poznamky „(Wait…“ v textu, smycky, tempo.

## Zdroje

1. GGML-ORG. *GGUF – specifikace formatu (ggml, docs/gguf.md, revize cd6d2b7)*. Online. 2026. Dostupne z: https://github.com/ggml-org/ggml/blob/cd6d2b75f5d3e4b2f3fe8e8fbc6c8b84ac80e74a/docs/gguf.md. [cit. 2026-11-13].
2. GGML-ORG. *llama.cpp: k-quants (pull request #1684)*. Online. 2023. Dostupne z: https://github.com/ggml-org/llama.cpp/pull/1684. [cit. 2026-11-13].
3. GGML-ORG. *llama.cpp: tools/perplexity/README.md (revize 2a4daf0)*. Online. 2026. Dostupne z: https://github.com/ggml-org/llama.cpp/blob/2a4daf0e08d6a9b6993ee0d4a9a3cfc35a6f405c/tools/perplexity/README.md. [cit. 2026-11-13].
4. GGML-ORG. *llama.cpp: tools/quantize/README.md (revize 2a4daf0)*. Online. 2026. Dostupne z: https://github.com/ggml-org/llama.cpp/blob/2a4daf0e08d6a9b6993ee0d4a9a3cfc35a6f405c/tools/quantize/README.md. [cit. 2026-11-13].
5. MRADERMACHER. *gemma-4-26B-A4B-it-uncensored-heretic-i1-GGUF*. Online. [b. r.]. Dostupne z: https://huggingface.co/mradermacher/gemma-4-26B-A4B-it-uncensored-heretic-i1-GGUF. [cit. 2026-11-13].
6. MRADERMACHER. *gemma-4-31B-it-heretic-i1-GGUF – seznam souboru*. Online. [b. r.]. Dostupne z: https://huggingface.co/api/models/mradermacher/gemma-4-31B-it-heretic-i1-GGUF/tree/main. [cit. 2026-11-13].
7. DONTPLANTOEND. *UGI Leaderboard – data zebricku (ugi-leaderboard-data.csv)*. Online. [b. r.]. Dostupne z: https://huggingface.co/spaces/DontPlanToEnd/UGI-Leaderboard/resolve/main/ugi-leaderboard-data.csv. [cit. 2026-11-13].
8. EQ-BENCH. *Creative Writing Longform – data zebricku*. Online. [b. r.]. Dostupne z: https://eqbench.com/creative_writing_longform.js. [cit. 2026-11-13].
9. GGML-ORG. *Can someone explain to me, in detail, on what llama.cpp allocates memory? (diskuse #9936, odpoved spravce slaren)*. Online. 2024. Dostupne z: https://github.com/ggml-org/llama.cpp/discussions/9936. [cit. 2026-11-13].
10. VERMA, S. a VAIDYA, N. *Mastering LLM Techniques: Inference Optimization*. Online. 2023. Dostupne z: https://developer.nvidia.com/blog/mastering-llm-techniques-inference-optimization/. [cit. 2026-11-13].
11. GOOGLE. *gemma-4-26B-A4B-it – config.json*. Online. [b. r.]. Dostupne z: https://huggingface.co/google/gemma-4-26B-A4B-it/raw/main/config.json. [cit. 2026-11-13].
12. HSIEH, C.-P. et al. *RULER: What's the Real Context Size of Your Long-Context Language Models?* Online. 2024. Dostupne z: https://arxiv.org/abs/2404.06654. [cit. 2026-11-13].
13. MODARRESSI, A. et al. *NoLiMa: Long-Context Evaluation Beyond Literal Matching*. Online. 2025. Dostupne z: https://arxiv.org/abs/2502.05167. [cit. 2026-11-13].
14. LOSTRUINS. *KoboldCpp 1.121 – gpttype_adapter.cpp*. Online. 2026. Dostupne z: https://github.com/LostRuins/koboldcpp/blob/v1.121/gpttype_adapter.cpp. [cit. 2026-11-13].
15. LOSTRUINS. *KoboldCpp – README*. Online. [b. r.]. Dostupne z: https://github.com/LostRuins/koboldcpp/blob/concedo/README.md. [cit. 2026-11-13].
16. OLLAMA. *Ollama v0.40.16 – llm/llama_server.go*. Online. 2026. Dostupne z: https://raw.githubusercontent.com/ollama/ollama/v0.40.16/llm/llama_server.go. [cit. 2026-11-13].
17. LOSTRUINS. *KoboldCpp 1.121 – dokumentace API (kcpp_docs.embd)*. Online. 2026. Dostupne z: https://raw.githubusercontent.com/LostRuins/koboldcpp/v1.121/embd_res/kcpp_docs.embd. [cit. 2026-11-13].
18. OLLAMA. *OpenAI compatibility*. Online. [b. r.]. Dostupne z: https://docs.ollama.com/api/openai-compatibility. [cit. 2026-11-13].
19. LOSTRUINS. *KoboldCpp 1.121 – koboldcpp.py*. Online. 2026. Dostupne z: https://github.com/LostRuins/koboldcpp/blob/v1.121/koboldcpp.py. [cit. 2026-11-13].
20. OLLAMA. *Windows*. Online. [b. r.]. Dostupne z: https://docs.ollama.com/windows. [cit. 2026-11-19].
21. OLLAMA. *CLI Reference*. Online. [b. r.]. Dostupne z: https://docs.ollama.com/cli. [cit. 2026-11-19].
22. OLLAMA. *Importing a Model*. Online. [b. r.]. Dostupne z: https://docs.ollama.com/import. [cit. 2026-11-13].
23. OLLAMA. *FAQ*. Online. [b. r.]. Dostupne z: https://docs.ollama.com/faq. [cit. 2026-11-13].
24. OLLAMA. *Context length*. Online. [b. r.]. Dostupne z: https://docs.ollama.com/context-length. [cit. 2026-11-13].
25. OLLAMA. *Pull request #12030 (endpointy tokenize a detokenize)*. Online. 2025. Dostupne z: https://github.com/ollama/ollama/pull/12030. [cit. 2026-11-13].
26. OLLAMA. *Ollama v0.40.16 – api/types.go*. Online. 2026. Dostupne z: https://raw.githubusercontent.com/ollama/ollama/v0.40.16/api/types.go. [cit. 2026-11-13].
