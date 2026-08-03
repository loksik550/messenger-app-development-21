CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

SCRIPT = r'''#!/bin/bash
DOMAIN="turn.novaa.pro"
echo "==== ПРАВДА О ЗАПУСКЕ + ПРЯМОЙ СТАРТ ===="

echo "--- 1. Реальная команда запущенного процесса ---"
ps -eo pid,cmd | grep turnserver | grep -v grep

echo ""
echo "--- 2. Полный ExecStart, который применяет systemd ---"
systemctl show coturn -p ExecStart | tr ';' '\n' | grep -iE 'path|argv'

echo ""
echo "--- 3. Останавливаю службу и слушаю ПОЛНЫЙ лог прямого старта TLS ---"
systemctl stop coturn
sleep 1
timeout 4 turnserver -c /etc/turnserver.conf --no-cli \
  --tls-listening-port=5349 \
  --cert=/etc/letsencrypt/live/$DOMAIN/fullchain.pem \
  --pkey=/etc/letsencrypt/live/$DOMAIN/privkey.pem 2>&1 | grep -iE '5349|tls listener|https|DTLS listener|error|denied|bind' | head -20

echo ""
echo "--- 4. Проверка: слушался ли 5349 во время прямого старта (в фоне) ---"
timeout 4 turnserver -c /etc/turnserver.conf --no-cli \
  --tls-listening-port=5349 \
  --cert=/etc/letsencrypt/live/$DOMAIN/fullchain.pem \
  --pkey=/etc/letsencrypt/live/$DOMAIN/privkey.pem >/dev/null 2>&1 &
BGPID=$!
sleep 2
ss -tuln | grep ':5349' && echo " >>> при ПРЯМОМ старте 5349 РАБОТАЕТ" || echo " >>> даже при прямом старте 5349 НЕТ"
kill $BGPID 2>/dev/null

echo ""
echo "--- 5. Возвращаю службу ---"
systemctl start coturn
sleep 1
ss -tuln | grep -E ':3478|:5349'
echo "===================================="
'''


def handler(event: dict, context) -> dict:
    """Показывает реальную команду запуска и тестирует прямой старт TLS 5349."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "text/plain; charset=utf-8"},
        "body": SCRIPT,
    }
