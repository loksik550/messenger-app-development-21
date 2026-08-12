"""ЮKassa: создание платежа для пополнения кошелька Nova."""
import json
import os
import re
import uuid
import base64
from datetime import datetime
from urllib.request import Request, urlopen

import psycopg2

EMAIL_REGEX = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
MIN_AMOUNT = 1.00
MAX_AMOUNT = 100_000.00

YOOKASSA_API_URL = "https://api.yookassa.ru/v3/payments"

HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
    'Content-Type': 'application/json'
}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def get_schema():
    s = os.environ.get('MAIN_DB_SCHEMA', 'public')
    return f"{s}." if s else ""


def create_yookassa_payment(shop_id, secret_key, amount, description, return_url,
                            customer_email, metadata, method="card"):
    """Создаёт платёж. method="sbp" — оплата по QR-коду СБП, иначе обычная форма."""
    auth = base64.b64encode(f"{shop_id}:{secret_key}".encode()).decode()
    if method == "sbp":
        confirmation = {"type": "qr"}
    else:
        confirmation = {"type": "redirect", "return_url": return_url}
    payload = {
        "amount": {"value": f"{amount:.2f}", "currency": "RUB"},
        "capture": True,
        "confirmation": confirmation,
        "description": description,
        "receipt": {
            "customer": {"email": customer_email},
            "items": [{
                "description": description[:128],
                "quantity": "1.00",
                "amount": {"value": f"{amount:.2f}", "currency": "RUB"},
                "vat_code": 1,
                "payment_subject": "service",
                "payment_mode": "full_payment",
            }],
        },
        "metadata": metadata,
    }
    if method == "sbp":
        payload["payment_method_data"] = {"type": "sbp"}
    req = Request(
        YOOKASSA_API_URL,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Authorization': f'Basic {auth}',
            'Idempotence-Key': str(uuid.uuid4()),
            'Content-Type': 'application/json',
        },
        method='POST',
    )
    with urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode())


def handler(event, context):
    """Создаёт платёж в ЮKassa для пополнения кошелька Nova и возвращает ссылку на оплату."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': HEADERS, 'body': ''}

    if event.get('httpMethod') != 'POST':
        return {'statusCode': 405, 'headers': HEADERS, 'body': json.dumps({'error': 'Method not allowed'})}

    body = event.get('body', '{}')
    if event.get('isBase64Encoded'):
        body = base64.b64decode(body).decode('utf-8')

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Invalid JSON'})}

    headers = event.get('headers') or {}
    user_id = headers.get('X-User-Id') or headers.get('x-user-id') or data.get('user_id')
    if not user_id:
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Нужен X-User-Id'})}

    # Проверка статуса платежа — нужна при оплате по QR-коду СБП,
    # там пользователь не возвращается на сайт автоматически
    if (data.get('action') or '') == 'check_status':
        shop_id = os.environ.get('YOOKASSA_SHOP_ID', '')
        secret_key = os.environ.get('YOOKASSA_SECRET_KEY', '')
        payment_id = (data.get('payment_id') or '').strip()
        if not shop_id or not secret_key:
            return {'statusCode': 503, 'headers': HEADERS,
                    'body': json.dumps({'error': 'ЮKassa не настроена'})}
        if not payment_id:
            return {'statusCode': 400, 'headers': HEADERS,
                    'body': json.dumps({'error': 'Нужен payment_id'})}
        auth = base64.b64encode(f"{shop_id}:{secret_key}".encode()).decode()
        req = Request(
            f"{YOOKASSA_API_URL}/{payment_id}",
            headers={'Authorization': f'Basic {auth}'},
            method='GET',
        )
        with urlopen(req, timeout=20) as response:
            yk = json.loads(response.read().decode())
        return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({
            'status': yk.get('status'),
            'paid': bool(yk.get('paid')),
        })}
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Bad user_id'})}

    try:
        amount = float(data.get('amount', 0))
    except (TypeError, ValueError):
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Bad amount'})}

    if amount < MIN_AMOUNT or amount > MAX_AMOUNT:
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': f'Сумма от {MIN_AMOUNT} до {MAX_AMOUNT}'})}

    user_email = (data.get('user_email') or '').strip()
    if not user_email or not EMAIL_REGEX.match(user_email):
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Нужен email для чека'})}

    return_url = (data.get('return_url') or '').strip()
    if not return_url.startswith('https://'):
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'return_url должен быть HTTPS'})}

    shop_id = os.environ.get('YOOKASSA_SHOP_ID', '')
    secret_key = os.environ.get('YOOKASSA_SECRET_KEY', '')
    if not shop_id or not secret_key:
        return {'statusCode': 503, 'headers': HEADERS, 'body': json.dumps({'error': 'ЮKassa не настроена. Добавь YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY в секреты проекта.'})}

    purpose = data.get('purpose') or 'wallet_topup'
    pay_method = 'sbp' if (data.get('method') or '') == 'sbp' else 'card'
    related_id = data.get('related_id')
    extra = data.get('extra') or {}
    descriptions = {
        'wallet_topup': 'Пополнение кошелька Nova',
        'pro_month': 'Nova Pro · 1 месяц',
        'pro_year': 'Nova Pro · 1 год',
        'lightning': f'Покупка {extra.get("quantity", "")}⚡ Молний Nova',
        'fundraiser': 'Донат на сбор Nova',
        'sticker_pack': f'Стикерпак: {extra.get("title", "")}',
        'stickers_subscription': 'Подписка на авторские стикеры Nova',
    }
    description = descriptions.get(purpose, 'Оплата Nova')

    S = get_schema()
    conn = get_conn()
    try:
        cur = conn.cursor()
        now = datetime.utcnow().isoformat()
        order_number = f"NOVA-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"

        cur.execute(
            f"""INSERT INTO {S}orders
                (order_number, user_email, amount, status, created_at, updated_at, nova_user_id, purpose, related_id, metadata_json)
                VALUES (%s, %s, %s, 'pending', %s, %s, %s, %s, %s, %s)
                RETURNING id""",
            (order_number, user_email, amount, now, now, user_id, purpose,
             int(related_id) if related_id else None, json.dumps(extra)),
        )
        order_id = cur.fetchone()[0]
        conn.commit()

        metadata = {"order_id": str(order_id), "order_number": order_number, "user_id": str(user_id), "purpose": purpose}
        if related_id:
            metadata["related_id"] = str(related_id)
        if extra.get("quantity"):
            metadata["quantity"] = str(extra["quantity"])
        yk = create_yookassa_payment(
            shop_id=shop_id, secret_key=secret_key, amount=amount,
            description=f"{description} ({order_number})",
            return_url=return_url, customer_email=user_email, metadata=metadata,
            method=pay_method,
        )

        payment_id = yk.get('id')
        conf = yk.get('confirmation') or {}
        # Для СБП ЮKassa отдаёт строку QR-кода вместо ссылки на форму оплаты
        qr_data = conf.get('confirmation_data', '')
        confirmation_url = conf.get('confirmation_url', '') or qr_data

        cur.execute(
            f"UPDATE {S}orders SET yookassa_payment_id=%s, payment_url=%s, updated_at=%s WHERE id=%s",
            (payment_id, confirmation_url, now, order_id),
        )
        conn.commit()

        return {
            'statusCode': 200,
            'headers': HEADERS,
            'body': json.dumps({
                'order_id': order_id,
                'order_number': order_number,
                'payment_id': payment_id,
                'payment_url': confirmation_url,
                'qr_data': qr_data,
                'method': pay_method,
                'amount': amount,
                'status': 'pending',
            }),
        }
    except Exception as e:
        conn.rollback()
        return {'statusCode': 500, 'headers': HEADERS, 'body': json.dumps({'error': str(e)[:200]})}
    finally:
        conn.close()