CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

SCRIPT = r'''#!/bin/bash
echo "==== ФИКС TLS 5349 ===="

echo "--- 1. Включаю coturn в /etc/default/coturn ---"
if [ -f /etc/default/coturn ]; then
  sed -i 's/^#*TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn
  grep -q TURNSERVER_ENABLED /etc/default/coturn || echo "TURNSERVER_ENABLED=1" >> /etc/default/coturn
else
  echo "TURNSERVER_ENABLED=1" > /etc/default/coturn
fi
grep TURNSERVER_ENABLED /etc/default/coturn

echo ""
echo "--- 2. Заставляю systemd-юнит использовать /etc/turnserver.conf ---"
mkdir -p /etc/systemd/system/coturn.service.d
cat > /etc/systemd/system/coturn.service.d/override.conf <<OVR
[Service]
ExecStart=
ExecStart=/usr/bin/turnserver -c /etc/turnserver.conf --no-cli
OVR

echo ""
echo "--- 3. Перезапуск ---"
systemctl daemon-reload
systemctl restart coturn
sleep 2

echo ""
echo "============================================"
echo " Слушающиеся порты:"
ss -tulnp | grep -E '3478|5349' || echo "  ничего не слушается"
echo "============================================"
echo " Свежий лог (TLS listener):"
journalctl -u coturn --no-pager --since "30 seconds ago" | grep -iE 'tls|cert|pkey|5349|listener|relay addr|error|WARNING' | tail -20
echo "============================================"
'''


def handler(event: dict, context) -> dict:
    """Фикс: coturn читает /etc/turnserver.conf и поднимает TLS-порт 5349."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "text/plain; charset=utf-8"},
        "body": SCRIPT,
    }
