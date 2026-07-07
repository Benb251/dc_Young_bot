@echo off
:: Di chuyển đến thư mục Gemini-web2api và chạy ngầm
cd /d "C:\Frog\Tool\Gemini-web2api"
start "" /b python gemini_web2api.py

:: Di chuyển đến thư mục Discord bot và chạy ngầm
cd /d "C:\Frog\Tool\dc_Young_bot\Discord_bot"
start "" /b node bot_gateway.js
