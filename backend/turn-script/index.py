CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

SCRIPT = r'''#!/bin/bash
DOMAIN="turn.novaa.pro"
echo "==== ФИКС: права юнита ===="

echo "--- 1. Под каким юзером работает служба ---"
systemctl show coturn -p User -p Group -p AmbientCapabilities

echo ""
echo "--- 2. Даю сертификату доступ на чтение всем (только .pem, безопасно для fullchain; privkey оставляем через группу) ---"
CERTUSER=$(systemctl show coturn -p User --value)
[ -z "$CERTUSER" ] && CERTUSER=root
echo "Юзер службы: '$CERTUSER'"

# гарантируем чтение цепочки и ключа для процесса
chmod 755 /etc/letsencrypt/live /etc/letsencrypt/archive 2>/dev/null
chmod 644 /etc/letsencrypt/archive/$DOMAIN/fullchain*.pem 2>/dev/null
chmod 640 /etc/letsencrypt/archive/$DOMAIN/privkey*.pem 2>/dev/null
if id "$CERTUSER" >/dev/null 2>&1; then
  # положим ключ в группу юзера службы
  chgrp -R "$CERTUSER" /etc/letsencrypt/archive/$DOMAIN 2>/dev/null || true
fi

echo ""
echo "--- 3. Заставляю службу стартовать под root (гарантированный доступ) ---"
mkdir -p /etc/systemd/system/coturn.service.d
cat > /etc/systemd/system/coturn.service.d/override.conf <<OVR
[Service]
User=
Group=
User=root
Group=root
AmbientCapabilities=
ExecStart=
ExecStart=/usr/bin/turnserver -c /etc/turnserver.conf --no-cli --tls-listening-port=5349 --cert=/etc/letsencrypt/live/$DOMAIN/fullchain.pem --pkey=/etc/letsencrypt/live/$DOMAIN/privkey.pem
OVR

echo "--- 4. Перезапуск ---"
systemctl daemon-reload
systemctl restart coturn
sleep 2

echo "============================================"
ss -tuln | grep -E ':3478|:5349'
echo "--------------------------------------------"
ss -tuln | grep -q ':5349' && echo " >>> УСПЕХ: 5349 слушается под службой!" || echo " >>> всё ещё нет — смотрим лог ниже"
ss -tuln | grep -q ':5349' || journalctl -u coturn --no-pager --since "15 seconds ago" | tail -15
echo "============================================"
'''


def handler(event: dict, context) -> dict:
    """Фикс прав юнита: запуск coturn под root, доступ к сертификату, TLS 5349."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "text/plain; charset=utf-8"},
        "body": SCRIPT,
    }
