# Fabula

Psani s AI, ktera bezi jen na tvym PC pres [KoboldCpp](https://github.com/LostRuins/koboldcpp). Generuje anglicky. Zatim reserse a navrh (`docs/`) a logika modelu (`llm/`).

```
curl -L --create-dirs -o koboldcpp/koboldcpp.exe https://github.com/LostRuins/koboldcpp/releases/download/v1.121/koboldcpp.exe
curl -L --create-dirs -o models/gemma-4-31B-it-heretic.i1-IQ2_M.gguf https://huggingface.co/mradermacher/gemma-4-31B-it-heretic-i1-GGUF/resolve/main/gemma-4-31B-it-heretic.i1-IQ2_M.gguf
start.bat
node demo.js [soubor.json] [kroku]
```

Windows, 16 GB NVIDIA, Node 20+. `start.bat` nech bezet ve vlastnim okne. `demo.js` pripise kroky (kazdy ~500 slov) do souboru pribehu (vychozi `stories/demo.json`), kde si muzes prepsat zanr, namet a osnovu.
