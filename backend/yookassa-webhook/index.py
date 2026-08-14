"""ЮKassa webhook: подтверждает оплату и пополняет кошелёк Nova."""
import json
import os
import time
import base64
from datetime import datetime
from urllib.request import Request, urlopen
from urllib.error import HTTPError

import psycopg2

HEADERS = {'Content-Type': 'application/json'}
YOOKASSA_API_URL = "https://api.yookassa.ru/v3/payments"


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def get_schema():
    s = os.environ.get('MAIN_DB_SCHEMA', 'public')
    return f"{s}." if s else ""


def verify_payment(payment_id, shop_id, secret_key):
    auth = base64.b64encode(f"{shop_id}:{secret_key}".encode()).decode()
    req = Request(
        f"{YOOKASSA_API_URL}/{payment_id}",
        headers={'Authorization': f'Basic {auth}', 'Content-Type': 'application/json'},
        method='GET',
    )
    try:
        with urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode())
    except (HTTPError, Exception):
        return None


def handler(event, context):
    """Обрабатывает уведомления от ЮKassa: верифицирует через API и зачисляет средства на кошелёк."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': HEADERS, 'body': ''}
    if event.get('httpMethod') != 'POST':
        return {'statusCode': 405, 'headers': HEADERS, 'body': json.dumps({'error': 'Method not allowed'})}

    body = event.get('body', '{}')
    if event.get('isBase64Encoded'):
        body = base64.b64decode(body).decode('utf-8')

    try:
        data = json.loads(body)
    except (json.JSONDecodeError, TypeError, ValueError):
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Invalid JSON'})}

    if not isinstance(data, dict):
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Body must be JSON object'})}

    payment_object = data.get('object') or {}
    payment_id = payment_object.get('id', '')
    metadata = payment_object.get('metadata') or {}
    if not payment_id:
        return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'No payment id'})}

    shop_id = os.environ.get('YOOKASSA_SHOP_ID', '')
    secret_key = os.environ.get('YOOKASSA_SECRET_KEY', '')

    if shop_id and secret_key:
        verified = verify_payment(payment_id, shop_id, secret_key)
        if not verified:
            return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Verify failed'})}
        status = verified.get('status', '')
        amount = float((verified.get('amount') or {}).get('value', 0))
        method_obj = verified.get('payment_method') or {}
        payment_method = method_obj.get('type', '')
    else:
        status = payment_object.get('status', '')
        amount = float((payment_object.get('amount') or {}).get('value', 0))
        payment_method = ((payment_object.get('payment_method') or {}).get('type', ''))

    S = get_schema()
    conn = get_conn()
    try:
        cur = conn.cursor()
        now_ts = int(time.time())
        now_iso = datetime.utcnow().isoformat()

        cur.execute(f"SELECT id, status, amount, nova_user_id, purpose, related_id, metadata_json FROM {S}orders WHERE yookassa_payment_id = %s", (payment_id,))
        row = cur.fetchone()
        if not row:
            order_meta_id = metadata.get('order_id')
            if order_meta_id:
                cur.execute(f"SELECT id, status, amount, nova_user_id, purpose, related_id, metadata_json FROM {S}orders WHERE id = %s", (int(order_meta_id),))
                row = cur.fetchone()
        if not row:
            return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'status': 'order_not_found'})}

        order_id, current_status, order_amount, nova_user_id, purpose, related_id, meta_json = row
        try:
            meta = json.loads(meta_json) if meta_json else {}
        except Exception:
            meta = {}

        if status == 'succeeded':
            if current_status != 'paid':
                cur.execute(
                    f"UPDATE {S}orders SET status='paid', paid_at=%s, updated_at=%s, "
                    f"payment_method=%s WHERE id=%s",
                    (now_iso, now_iso, payment_method or 'card', order_id),
                )
                amt = float(order_amount)
                uid = int(nova_user_id) if nova_user_id else None

                # Уведомление владельцу в Telegram, если включено в панели
                try:
                    cur.execute(
                        f"SELECT key, value FROM {S}dev_settings "
                        f"WHERE key IN ('tg_enabled','tg_bot_token','tg_chat_id','tg_events')"
                    )
                    _st = {r[0]: r[1] for r in cur.fetchall()}
                    if (_st.get("tg_enabled") == "1"
                            and "pay" in (_st.get("tg_events") or "").split(",")
                            and _st.get("tg_bot_token") and _st.get("tg_chat_id")):
                        _name = ""
                        if uid:
                            cur.execute(f"SELECT name FROM {S}users WHERE id = %s", (uid,))
                            _r = cur.fetchone()
                            _name = _r[0] if _r else ""
                        from urllib.parse import urlencode as _ue
                        from urllib.request import Request as _Rq, urlopen as _uo
                        _txt = f"Оплата {amt:.0f} ₽\n\nОт: {_name or 'гость'}\nЗаказ №{order_id}"
                        _uo(_Rq(
                            f"https://api.telegram.org/bot{_st['tg_bot_token']}/sendMessage",
                            data=_ue({"chat_id": _st["tg_chat_id"], "text": _txt}).encode(),
                        ), timeout=4)
                except Exception:
                    pass

                if uid and (purpose in (None, '', 'wallet_topup')):
                    cur.execute(
                        f"UPDATE {S}users SET wallet_balance = COALESCE(wallet_balance,0) + %s WHERE id = %s RETURNING wallet_balance",
                        (amt, uid),
                    )
                    nb = float(cur.fetchone()[0])
                    cur.execute(
                        f"""INSERT INTO {S}wallet_transactions (user_id, amount, kind, description, balance_after, created_at)
                            VALUES (%s,%s,'topup',%s,%s,%s)""",
                        (uid, amt, f"Пополнение через ЮKassa ({payment_method or 'card'})", nb, now_ts),
                    )

                elif uid and purpose.startswith('pro_'):
                    plan_name = purpose[4:] or 'month'
                    # Срок берём из тарифов, настроенных в Dev-панели
                    cur.execute(
                        f"SELECT duration_days FROM {S}premium_plans WHERE code = %s",
                        (plan_name,),
                    )
                    prow = cur.fetchone()
                    if prow and prow[0]:
                        duration = int(prow[0]) * 86400
                    else:
                        duration = 365 * 86400 if plan_name == 'year' else 30 * 86400
                    cur.execute(f"SELECT COALESCE(pro_until,0) FROM {S}users WHERE id=%s", (uid,))
                    cur_until = int((cur.fetchone() or [0])[0] or 0)
                    new_until = max(cur_until, now_ts) + duration
                    cur.execute(f"UPDATE {S}users SET pro_until=%s WHERE id=%s", (new_until, uid))
                    cur.execute(
                        f"""INSERT INTO {S}pro_subscriptions (user_id, plan, amount, source, yookassa_payment_id, starts_at, ends_at, is_trial, created_at)
                            VALUES (%s,%s,%s,'yookassa',%s,%s,%s,FALSE,%s)""",
                        (uid, plan_name, amt, payment_id, now_ts, new_until, now_ts),
                    )
                    cur.execute(
                        f"""INSERT INTO {S}user_notifications (user_id, kind, title, body)
                            VALUES (%s, 'premium', %s, %s)""",
                        (uid, 'Premium активирован',
                         f'Оплата прошла успешно. Подписка действует до '
                         f'{datetime.utcfromtimestamp(new_until).strftime("%d.%m.%Y")}.'),
                    )

                elif uid and purpose == 'lightning':
                    qty = int(meta.get('quantity') or (amt / 3))
                    cur.execute(
                        f"UPDATE {S}users SET lightning_balance = COALESCE(lightning_balance,0) + %s WHERE id=%s RETURNING lightning_balance",
                        (qty, uid),
                    )
                    nlb = int(cur.fetchone()[0])
                    cur.execute(
                        f"""INSERT INTO {S}lightning_transactions (user_id, amount, kind, description, balance_after, created_at)
                            VALUES (%s,%s,'purchase','Покупка через ЮKassa',%s,%s)""",
                        (uid, qty, nlb, now_ts),
                    )

                elif purpose == 'fundraiser' and related_id:
                    fid = int(related_id)
                    cur.execute(f"SELECT owner_id FROM {S}fundraisers WHERE id=%s", (fid,))
                    fr = cur.fetchone()
                    if fr:
                        owner_id = int(fr[0])
                        donor_name = meta.get('donor_name') or 'Гость'
                        donor_msg = meta.get('message') or ''
                        is_anon = bool(meta.get('is_anonymous'))
                        cur.execute(
                            f"UPDATE {S}users SET wallet_balance = COALESCE(wallet_balance,0) + %s WHERE id=%s RETURNING wallet_balance",
                            (amt, owner_id),
                        )
                        ob = float(cur.fetchone()[0])
                        cur.execute(
                            f"""INSERT INTO {S}wallet_transactions (user_id, amount, kind, description, balance_after, created_at)
                                VALUES (%s,%s,'fundraiser_income',%s,%s,%s)""",
                            (owner_id, amt, f"Донат на сбор #{fid}", ob, now_ts),
                        )
                        cur.execute(
                            f"""INSERT INTO {S}fundraiser_payments (fundraiser_id, donor_id, donor_name, amount, message, is_anonymous, source, yookassa_payment_id, status, created_at, paid_at)
                                VALUES (%s,%s,%s,%s,%s,%s,'yookassa',%s,'paid',%s,%s)""",
                            (fid, uid, donor_name, amt, donor_msg, is_anon, payment_id, now_ts, now_ts),
                        )
                        cur.execute(f"UPDATE {S}fundraisers SET collected_amount = COALESCE(collected_amount,0) + %s WHERE id=%s", (amt, fid))

                elif uid and purpose == 'sticker_pack' and related_id:
                    pid = int(related_id)
                    cur.execute(f"SELECT 1 FROM {S}user_sticker_packs WHERE user_id=%s AND pack_id=%s", (uid, pid))
                    if not cur.fetchone():
                        cur.execute(
                            f"""INSERT INTO {S}user_sticker_packs (user_id, pack_id, acquired_at, acquired_via)
                                VALUES (%s,%s,%s,'yookassa')""",
                            (uid, pid, now_ts),
                        )
                        cur.execute(f"UPDATE {S}sticker_packs SET total_sales = total_sales + 1 WHERE id=%s", (pid,))
                        cur.execute(f"SELECT author_id, title FROM {S}sticker_packs WHERE id=%s", (pid,))
                        sp = cur.fetchone()
                        if sp and sp[0]:
                            author_id = int(sp[0]); title = sp[1] or "пак"
                            share = round(amt * 0.6, 2)
                            cur.execute(
                                f"UPDATE {S}users SET wallet_balance = COALESCE(wallet_balance,0) + %s WHERE id=%s RETURNING wallet_balance",
                                (share, author_id),
                            )
                            ab_row = cur.fetchone()
                            if ab_row:
                                ab = float(ab_row[0])
                                cur.execute(
                                    f"""INSERT INTO {S}wallet_transactions (user_id, amount, kind, description, balance_after, created_at)
                                        VALUES (%s,%s,'sticker_royalty',%s,%s,%s)""",
                                    (author_id, share, f"Роялти за пак: {title}", ab, now_ts),
                                )

                elif uid and purpose == 'stickers_subscription':
                    cur.execute(f"SELECT COALESCE(stickers_subscription_until,0) FROM {S}users WHERE id=%s", (uid,))
                    cu = int((cur.fetchone() or [0])[0] or 0)
                    new_su = max(cu, now_ts) + 30 * 86400
                    cur.execute(f"UPDATE {S}users SET stickers_subscription_until=%s WHERE id=%s", (new_su, uid))

                conn.commit()

        elif status == 'canceled':
            if current_status not in ('paid', 'canceled'):
                cancel_reason = ((payment_object.get('cancellation_details') or {}).get('reason') or '')
                cur.execute(
                    f"UPDATE {S}orders SET status='canceled', updated_at=%s, cancel_reason=%s WHERE id=%s",
                    (now_iso, cancel_reason, order_id),
                )
                conn.commit()

        return {'statusCode': 200, 'headers': HEADERS, 'body': json.dumps({'status': 'ok'})}
    except Exception:
        conn.rollback()
        return {'statusCode': 500, 'headers': HEADERS, 'body': json.dumps({'error': 'internal'})}
    finally:
        conn.close()