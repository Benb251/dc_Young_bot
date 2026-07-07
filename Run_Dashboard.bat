@echo off
title Quan Hem Bot Dashboard
echo ===================================================
echo   Dang khoi dong Bang dieu khien Quan Hem Bot...
echo   Vui long khong tat cua so nay trong luc su dung!
echo ===================================================

:: Di chuyển đến thư mục chứa code
cd /d "%~dp0dashboard"

:: Tự động mở trình duyệt web
start http://localhost:5173

:: Chạy server (lệnh này sẽ chặn và chạy liên tục)
npm run dev
