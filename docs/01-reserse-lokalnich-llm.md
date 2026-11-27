# Reserse lokalniho behu LLM a vyber modelu

Cil: model co se i s kontextem 16k vejde do 16 GB VRAM. Meril jsem 13. 11. 2026 na RTX 5080 (16 303 MiB), Ryzen 7 9800X3D, KoboldCpp 1.121, KV cache q8_0. Modely: Gemma 4 26B-A4B heretic IQ3_XS (Gemma), Goetia 26B-A4B IQ3_XS, Qwen3.5-27B Derestricted IQ3_XXS (Qwen), WeirdCompound 24B IQ3_M, Hemmingway-1 (Qwen3.8-27B) IQ3_XXS, Gemma 4 31B heretic IQ2_M (Gemma 31B).

## GGUF a kvantizace

GGUF = format modelu pro llama.cpp, ma v sobe i tokenizer a sablonu chatu [1]. Kvantizace ulozi vahy s min bity [2]. Ztrata se meri jako KLD = jak moc se predpovedi lisi od nekvantizovaneho modelu (mensi je lepsi) [3], velikost jako bpw = skutecny prumer bitu na vahu [4]:

| Typ | bpw | KLD |
|---|---|---|
| Q8_0 | 8,50 | 0,0014 |
| Q4_K_M | 4,89 | 0,0282 |
| IQ4_XS | 4,46 | 0,0363 |
| IQ3_M | 3,76 | 0,1025 |
| IQ3_XS | 3,50 | 0,1387 |
| IQ3_XXS | 3,25 | 0,1836 |
| IQ2_M | 2,93 | 0,3260 |
| IQ2_XXS | 2,38 | 0,8120 |

(KLD je z Llama 3 8B [3], bpw z Llama 3.1 8B [4]; Q4_K_M a typy IQ s imatrix) Cislo v nazvu je priblizny pocet bitu na vahu, pripona XXS az L velikost varianty. Typy IQ byvaji lepsi nez stejne velke Q a „i1“ v nazvu souboru znamena kvantizaci s imatrix (matice dulezitosti vah z kalibracniho textu), ktera ztratu zmensuje [4, 5] – Q4_K_M ma bez ni 0,0313 [3]. Pod 3 bity to jde rychle dolu, ale vetsi model v nizsi presnosti porad vetsinou vyhraje [2]. 4 bity (IQ4_XS) by se vedle ostatnich programu nevesly (Gemma 13,92 GB [5]), takze 3 bity, a Gemma 31B se nevejde ani tak [6] – ta jede na IQ2_M. Mensi 12B modely pisou o dost hur [7, 8].

## VRAM

VRAM = vahy + KV cache + buffery [9]. KV cache = mezivysledky za kazdy token v kontextu, aby se nepocitaly znovu; mam ji v 8 bitech (q8_0):

| MiB pri 16k | Gemma | Goetia | Qwen | WeirdC. | Hemm. | Gemma 31B |
|---|---|---|---|---|---|---|
| vahy | 11 082 | 11 082 | 10 137 | 9 875 | 10 137 | 10 396 |
| KV cache | 345 | 345 | 553 | 1 381 | 553 | 1 381 |
| ostatni | 3 625 | 3 704 | 3 522 | 3 128 | 3 670 | 3 549 |
| volno | 1 251 | 1 172 | 2 091 | 1 919 | 1 943 | 977 |
| tok/s 1k/15k | 117/111 | 126/113 | 51/46 | 57/52 | 49/41 | 43/35 |

Ostatni = buffery KoboldCpp (asi 500 MiB) a jine bezici programy (prohlizec, VS Code). Tok/s = rychlost generovani pri 1k a 15k tokenu v kontextu. Vesly se vsechny, Gemma 31B tak tak.

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
| velikost kontextu | `--contextsize` pri startu [19] | vychozi 4k do 24 GiB VRAM, meni se pres `OLLAMA_CONTEXT_LENGTH` [24], v pozadavku pres OpenAI API ne [18] |
| pocitani tokenu predem | ano [17] | ne [25] |
| DRY proti opakovani | ano [17] | ne [26] |

Ollama je pohodlnejsi na spravu modelu. Pro bod 3 ale potrebuju predem spocitat tokeny a DRY, a to pres jeji API nejde. Beru **KoboldCpp**.

## Vyber modelu

Kriteria: ochota (nic nezjemni), selsky rozum, proza, souvislost, vejde se. Kandidati podle UGI [7] a EQ-Bench Longform [8], soubory GGUF jsou od mradermachera [5, 6, 27, 28, 29, 30]. Vsechno anglicky: kazdy model napsal 3 pribehy (uvod 600 + pokracovani 1 800 tokenu) a kratke testy (mimo jine ochota, realie, emoce), hodnotil naslepo cloudovy LLM Claude Opus 5.5 (ne lide), pribehy a emoce dvakrat. Data v `mereni/2026-11-13` mimo repo. 1. kolo: Qwen se zacyklil, Goetia porusovala fakta. Dal Gemma a WeirdCompound. 2. kolo, pribyly Gemma 31B a Hemmingway:

| | Gemma 31B | Hemm. | Gemma | WeirdC. |
|---|---|---|---|---|
| realie presnost | **96 %** | 67 % | 89 % | 78 % |
| emoce (z 10) | **9** | 8 | 6 | 8 |
| pribehy poradi | 2,0 | **1,3** | 4,3 | 2,8 |
| plneni planu | **8,2** | 8,0 | 6,2 | 6,8 |
| rozbita slova | 10 | **2** | 16 | 4 |

Realie = podil spravnych z overenych udaju o svete (24–39 na model). Emoce = v kolika z 10 hodnoceni byla z textu poznat. Poradi = prumer z 6 hodnoceni, 1–5 (paty text byla Gemma s jinym nastavenim). Plneni planu = body od soudce, vic je lip. U poradi a rozbitych slov (soucet z 6 hodnoceni) je mensi lepsi.

Vybral jsem **Gemma 4 31B** – nejlepsi rozum a emoce, nic neodmitla. Hemmingway pise lepsi pribehy, ale nejvic si vymysli (realie 67 %, 13 poruseni faktu nametu proti 8). Pomer vykonu a narocnosti: vsech sest modelu se vejde na stejnou kartu, plati se jen rychlosti a rezervou VRAM. Gemma 31B je 3× pomalejsi nez nejrychlejsi a nechava nejmin VRAM, ale 35 tok/s je 500 slov za 19 s (cely krok i s planem a doplnovanim pameti prumerne 28 s, dok. 03), to mi staci. Rychla alternativa **Gemma 4 26B-A4B** (111 tok/s, realie 89 %) – v ostatnich radcich tabulky je ale posledni, takze jen kdyz jde hlavne o rychlost.

Omezeni: kazdy pribeh jen jednou a kratky, soudce je LLM (stejny text ohodnotil dvakrat jinak). Rozbita slova u Gemmy nespravila zmena KV cache ani zkraceni dosahu DRY; u Gemmy 31B jich cast opravdu dela DRY (dok. 03). Dal resit: poznamky „(Wait…“ v textu, smycky, tempo.

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
27. MRADERMACHER. *Qwen3.5-27B-Derestricted-i1-GGUF*. Online. [b. r.]. Dostupne z: https://huggingface.co/mradermacher/Qwen3.5-27B-Derestricted-i1-GGUF. [cit. 2026-11-26].
28. MRADERMACHER. *Goetia-26B-A4B-v1.3-Absolute-Heretic-ARA-i1-GGUF*. Online. [b. r.]. Dostupne z: https://huggingface.co/mradermacher/Goetia-26B-A4B-v1.3-Absolute-Heretic-ARA-i1-GGUF. [cit. 2026-11-26].
29. MRADERMACHER. *WeirdCompound-v1.7-24b-i1-GGUF*. Online. [b. r.]. Dostupne z: https://huggingface.co/mradermacher/WeirdCompound-v1.7-24b-i1-GGUF. [cit. 2026-11-26].
30. MRADERMACHER. *Hemmingway-1-Uncensored-Heretic-i1-GGUF*. Online. [b. r.]. Dostupne z: https://huggingface.co/mradermacher/Hemmingway-1-Uncensored-Heretic-i1-GGUF. [cit. 2026-11-26].
