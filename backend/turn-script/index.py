CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

SCRIPT = r'''#!/bin/bash
set -e
DOMAIN="turn.novaa.pro"
IP="159.194.235.102"
SECRET="NovaTurn2026secret"
EMAIL="admin@novaa.pro"

echo "==> [1/6] Установка certbot и выпуск SSL для $DOMAIN"
apt update -y
apt install -y certbot coturn
systemctl stop coturn 2>/dev/null || true

if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  certbot certonly --standalone -d "$DOMAIN" --agree-tos -m "$EMAIL" --non-interactive
fi

echo "==> [2/6] Доступ coturn к сертификату"
usermod -aG ssl-cert turn 2>/dev/null || true
chmod 750 /etc/letsencrypt/live /etc/letsencrypt/archive 2>/dev/null || true
chgrp -R ssl-cert /etc/letsencrypt/live /etc/letsencrypt/archive 2>/dev/null || true

echo "==> [3/6] Запись /etc/turnserver.conf"
[ -f /etc/turnserver.conf ] && cp /etc/turnserver.conf /etc/turnserver.conf.bak
cat > /etc/turnserver.conf <<CONF
listening-port=3478
tls-listening-port=5349
listening-ip=$IP
external-ip=$IP
realm=$DOMAIN
server-name=$DOMAIN
fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=$SECRET
cert=/etc/letsencrypt/live/$DOMAIN/fullchain.pem
pkey=/etc/letsencrypt/live/$DOMAIN/privkey.pem
min-port=49152
max-port=65535
no-cli
no-tlsv1
no-tlsv1_1
CONF

echo "==> [4/6] Включение демона coturn"
sed -i 's/#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn 2>/dev/null || true

echo "==> [5/6] Открытие портов (ufw)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 3478/tcp; ufw allow 3478/udp
  ufw allow 5349/tcp; ufw allow 5349/udp
  ufw allow 49152:65535/udp
fi

echo "==> [6/6] Автообновление сертификата (перезапуск coturn после renew)"
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/coturn.sh <<'HOOK'
#!/bin/bash
systemctl restart coturn
HOOK
chmod +x /etc/letsencrypt/renewal-hooks/deploy/coturn.sh

systemctl enable coturn
systemctl restart coturn
sleep 2
echo ""
echo "============================================"
echo " Готово. Статус coturn:"
systemctl status coturn --no-pager | head -n 6
echo "============================================"
echo " Проверка портов:"
ss -tulnp | grep -E '3478|5349' || echo "  порты не слушаются — смотрите journalctl -u coturn"
echo "============================================"
'''


def handler(event: dict, context) -> dict:
    """Отдаёт bash-скрипт настройки TURN-сервера как plain text для запуска через curl."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "text/plain; charset=utf-8"},
        "body": SCRIPT,
    }