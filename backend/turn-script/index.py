CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

SCRIPT = r'''#!/bin/bash
DOMAIN="turn.novaa.pro"
echo "==== ДИАГНОСТИКА TLS 5349 ===="

echo "--- 1. Права на файлы сертификата ---"
ls -lL /etc/letsencrypt/live/$DOMAIN/fullchain.pem /etc/letsencrypt/live/$DOMAIN/privkey.pem 2>&1
echo "Группы пользователя turn:"; id turn

echo ""
echo "--- 2. Может ли turn прочитать ключ ---"
sudo -u turn cat /etc/letsencrypt/live/$DOMAIN/privkey.pem >/dev/null 2>&1 && echo "OK: turn читает privkey" || echo "НЕТ доступа к privkey"

echo ""
echo "--- 3. Строки TLS в конфиге ---"
grep -E 'tls-listening-port|cert=|pkey=|listening-ip' /etc/turnserver.conf

echo ""
echo "--- 4. Ошибки TLS/cert в логе запуска ---"
journalctl -u coturn --no-pager | grep -iE 'tls|cert|pkey|5349|SSL|listener' | tail -20
echo "===================================="
'''


def handler(event: dict, context) -> dict:
    """Диагностика TLS-порта 5349 на TURN-сервере."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "text/plain; charset=utf-8"},
        "body": SCRIPT,
    }
