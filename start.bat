@echo off
cd /d "%~dp0"
koboldcpp\koboldcpp.exe --model models\gemma-4-31B-it-heretic.i1-IQ2_M.gguf --usecuda --contextsize 16384 --quantkv q8_0 --host 127.0.0.1 --port 5001 --singleinstance
pause
