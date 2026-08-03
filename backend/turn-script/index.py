CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

SCRIPT = r'''#!/bin/bash
DOMAIN="turn.novaa.pro"
echo "==> Проверка прав на сертификат"
usermod -aG ssl-cert turn 2>/dev/null || true
chmod 750 /etc/letsencrypt/live /etc/letsencrypt/archive 2>/dev/null || true
chgrp -R ssl-cert /etc/letsencrypt/live /etc/letsencrypt/archive 2>/dev/null || true

echo "==> Открытие TLS-порта 5349 в фаерволе"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 5349/tcp
  ufw allow 5349/udp
fi

echo "==> Перезапуск coturn"
systemctl restart coturn
sleep 2

echo ""
echo "============================================"
echo " Слушающиеся порты TURN:"
ss -tulnp | grep -E '3478|5349' || echo "  ничего не слушается"
echo "============================================"
echo " Если 5349 не появился — последние ошибки лога:"
journalctl -u coturn -n 15 --no-pager | grep -iE 'tls|cert|5349|error|fail' || echo "  ошибок по TLS не найдено"
echo "============================================"
'''


def handler(event: dict, context) -> dict:
    """Отдаёт bash-скрипт: открывает TLS-порт 5349 и перезапускает coturn."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "text/plain; charset=utf-8"},
        "body": SCRIPT,
    }
