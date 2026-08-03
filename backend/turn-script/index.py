CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

SCRIPT = r'''#!/bin/bash
DOMAIN="turn.novaa.pro"
echo "==== ФИКС: cert/pkey аргументами в systemd ===="

echo "--- Убираю cert/pkey/tls-port из конфига (передадим их аргументами) ---"
sed -i '/^cert=/d;/^pkey=/d;/^tls-listening-port=/d' /etc/turnserver.conf

echo "--- Прописываю рабочую команду запуска в override ---"
mkdir -p /etc/systemd/system/coturn.service.d
cat > /etc/systemd/system/coturn.service.d/override.conf <<OVR
[Service]
ExecStart=
ExecStart=/usr/bin/turnserver -c /etc/turnserver.conf --no-cli --tls-listening-port=5349 --cert=/etc/letsencrypt/live/$DOMAIN/fullchain.pem --pkey=/etc/letsencrypt/live/$DOMAIN/privkey.pem
OVR

echo "--- Перезапуск ---"
systemctl daemon-reload
systemctl restart coturn
sleep 2

echo "============================================"
echo " Порты:"
ss -tulnp | grep -E '3478|5349' || echo "  ничего"
echo "============================================"
echo " Итог по 5349:"
ss -tuln | grep -q ':5349' && echo " >>> УСПЕХ: TLS-порт 5349 слушается!" || echo " >>> 5349 всё ещё не поднялся"
echo "============================================"
'''


def handler(event: dict, context) -> dict:
    """Фикс: передаём cert/pkey/tls-порт аргументами командной строки systemd."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "text/plain; charset=utf-8"},
        "body": SCRIPT,
    }
