CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

SCRIPT = r'''#!/bin/bash
DOMAIN="turn.novaa.pro"
echo "==== ФИНАЛЬНЫЙ ФИКС TLS ===="

echo "--- 1. Текущий конфиг (весь) ---"
cat -A /etc/turnserver.conf | grep -iE 'cert|pkey|tls|listening-ip'

echo ""
echo "--- 2. Тест: запуск с явными cert/pkey в командной строке ---"
timeout 3 turnserver -n --listening-ip=159.194.235.102 \
  --tls-listening-port=5349 \
  --cert=/etc/letsencrypt/live/$DOMAIN/fullchain.pem \
  --pkey=/etc/letsencrypt/live/$DOMAIN/privkey.pem \
  --realm=$DOMAIN --no-cli 2>&1 | grep -iE 'tls|cert|pkey|5349|listener|error|WARNING' | head -15

echo ""
echo "--- 3. Пересобираю конфиг начисто (корректный порядок) ---"
cp /etc/turnserver.conf /etc/turnserver.conf.bak2
cat > /etc/turnserver.conf <<CONF
listening-port=3478
tls-listening-port=5349
listening-ip=159.194.235.102
external-ip=159.194.235.102
relay-ip=159.194.235.102
min-port=49152
max-port=65535
realm=$DOMAIN
server-name=$DOMAIN
fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=NovaTurn2026secret
cert=/etc/letsencrypt/live/$DOMAIN/fullchain.pem
pkey=/etc/letsencrypt/live/$DOMAIN/privkey.pem
no-tlsv1
no-tlsv1_1
no-cli
CONF

echo "--- 4. Перезапуск ---"
systemctl restart coturn
sleep 2

echo "============================================"
echo " Порты:"
ss -tulnp | grep -E '3478|5349' || echo "  ничего"
echo "============================================"
echo " Лог TLS:"
journalctl -u coturn --no-pager --since "20 seconds ago" | grep -iE 'tls|cert|pkey|5349|listener|error|WARNING' | tail -15
echo "============================================"
'''


def handler(event: dict, context) -> dict:
    """Финальный фикс TLS: тест cert через CLI + чистый конфиг + перезапуск."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "text/plain; charset=utf-8"},
        "body": SCRIPT,
    }
