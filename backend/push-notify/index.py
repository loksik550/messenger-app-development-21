import os
import json
import time
import threading
import psycopg2
from pywebpush import webpush, WebPushException

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p67547116_messenger_app_develo")

# Иконка уведомлений — иконка приложения Nova, лежит в public и публикуется
# на боевом домене. FCM требует абсолютный публичный URL.
NOTIF_ICON = os.environ.get("NOTIF_ICON_URL", "https://novaa.pro/app-icon-512.png")


def _clean_key(raw: str) -> str:
    """Очищает VAPID-ключ от лишних кавычек, запятых и пробелов.
    Нужно на случай, если ключ скопировали из вывода web-push с обёрткой."""
    if not raw:
        return ""
    return raw.strip().strip('",').strip().strip('"').strip()


def _vapid_public() -> str:
    return _clean_key(os.environ.get("VAPID_PUBLIC_KEY", ""))


def _vapid_private() -> str:
    return _clean_key(os.environ.get("VAPID_PRIVATE_KEY", ""))

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
}


def get_conn():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    return conn


def ok(data):
    return {"statusCode": 200, "headers": CORS, "body": json.dumps(data, ensure_ascii=False)}


def err(msg, code=400):
    return {"statusCode": code, "headers": CORS, "body": json.dumps({"error": msg}, ensure_ascii=False)}


def handler(event: dict, context) -> dict:
    """
    Push-уведомления для Nova.
    subscribe   — сохранить подписку браузера
    unsubscribe — удалить подписку
    send        — отправить уведомление получателю (личка, вызывается из chat-api)
    send_group  — отправить уведомление всем участникам группы (кроме отправителя)
    vapid_key   — получить публичный VAPID ключ для браузера
    """
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    body = json.loads(event.get("body") or "{}")
    params = event.get("queryStringParameters") or {}
    action = body.get("action") or params.get("action", "")
    user_id = event.get("headers", {}).get("X-User-Id") or params.get("user_id")

    # ── vapid_key — публичный ключ для фронтенда ──────────────────────────────
    if action == "vapid_key":
        return ok({"public_key": _vapid_public()})


    conn = get_conn()
    cur = conn.cursor()

    # ── subscribe — сохранить подписку ────────────────────────────────────────
    if action == "subscribe":
        if not user_id:
            conn.close()
            return err("Нужен X-User-Id")
        endpoint = body.get("endpoint", "")
        p256dh = body.get("p256dh", "")
        auth = body.get("auth", "")
        if not endpoint or not p256dh or not auth:
            conn.close()
            return err("Нужны endpoint, p256dh, auth")

        cur.execute(
            f"""INSERT INTO {SCHEMA}.push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth""",
            (int(user_id), endpoint, p256dh, auth, int(time.time()))
        )
        conn.close()
        return ok({"ok": True})

    # ── send — отправить push уведомление пользователю ────────────────────────
    if action == "send":
        recipient_id = body.get("recipient_id")
        title = body.get("title", "Nova")
        message = body.get("message", "Новое сообщение")
        sender_name = body.get("sender_name", "")
        chat_id = body.get("chat_id")

        if not recipient_id:
            conn.close()
            return err("Нужен recipient_id")

        is_call = body.get("is_call", False)
        # Для звонков mute не учитываем — звонок важнее.
        # Для обычных сообщений: учитываем chat_settings.muted и users.notify_messages
        if is_call:
            cur.execute(
                f"SELECT endpoint, p256dh, auth FROM {SCHEMA}.push_subscriptions WHERE user_id = %s",
                (int(recipient_id),)
            )
        else:
            cur.execute(
                f"""SELECT ps.endpoint, ps.p256dh, ps.auth
                    FROM {SCHEMA}.push_subscriptions ps
                    JOIN {SCHEMA}.users u ON u.id = ps.user_id
                    LEFT JOIN {SCHEMA}.chat_settings cs
                        ON cs.user_id = ps.user_id AND cs.chat_id = %s
                    WHERE ps.user_id = %s
                      AND COALESCE(u.notify_messages, TRUE) = TRUE
                      AND COALESCE(cs.muted, FALSE) = FALSE""",
                (int(chat_id) if chat_id else 0, int(recipient_id))
            )
        subs = cur.fetchall()

        if not subs:
            conn.close()
            return ok({"ok": True, "sent": 0})

        vapid_private = _vapid_private()
        vapid_public = _vapid_public()
        if not vapid_private or not vapid_public:
            conn.close()
            return err("VAPID ключи не настроены", 500)

        call_id = body.get("call_id")
        payload = json.dumps({
            "title": f"📞 {sender_name}" if is_call else (sender_name or title),
            "body": "Входящий звонок" if is_call else message,
            "chat_id": chat_id,
            "call_id": call_id,
            "is_call": is_call,
            "icon": NOTIF_ICON,
            "badge": NOTIF_ICON,
            "tag": f"call_{call_id}" if is_call else f"msg_{chat_id}",
            "requireInteraction": is_call,
        })

        sent = 0
        stale = []
        for endpoint, p256dh, auth_key in subs:
            try:
                webpush(
                    subscription_info={
                        "endpoint": endpoint,
                        "keys": {"p256dh": p256dh, "auth": auth_key},
                    },
                    data=payload,
                    vapid_private_key=vapid_private,
                    vapid_claims={"sub": "mailto:nova@poehali.dev"},
                )
                sent += 1
            except WebPushException as e:
                # Подписка недействительна:
                #  404/410 — браузер отписался;
                #  403/401 — подпись не проходит (создана под старый VAPID-ключ).
                # Все эти случаи безвозвратны — удаляем подписку.
                code = getattr(getattr(e, "response", None), "status_code", None)
                if code in (401, 403, 404, 410):
                    stale.append(endpoint)
            except Exception:
                pass

        # Чистим мёртвые подписки, чтобы они не копились
        if stale:
            try:
                cur.execute(
                    f"DELETE FROM {SCHEMA}.push_subscriptions WHERE endpoint = ANY(%s)",
                    (stale,)
                )
            except Exception:
                pass
        conn.close()

        return ok({"ok": True, "sent": sent})

    # ── send_group — push всем участникам группы (кроме отправителя) ──────────
    if action == "send_group":
        group_id = body.get("group_id")
        sender_id = body.get("sender_id")
        group_name = body.get("group_name", "Группа")
        message = body.get("message", "Новое сообщение")
        message_id = body.get("message_id")
        is_channel = body.get("is_channel", False)

        if not group_id:
            conn.close()
            return err("Нужен group_id")

        # Одним запросом: все подписки участников группы, кроме отправителя
        # и тех, кто замьютил эту группу (group_mute) или отключил групповые
        # уведомления глобально (users.notify_groups = false).
        now_ts = int(time.time())
        cur.execute(
            f"""SELECT ps.endpoint, ps.p256dh, ps.auth, gm.user_id
                FROM {SCHEMA}.group_members gm
                JOIN {SCHEMA}.push_subscriptions ps ON ps.user_id = gm.user_id
                JOIN {SCHEMA}.users u ON u.id = gm.user_id
                LEFT JOIN {SCHEMA}.group_mute gmu
                    ON gmu.user_id = gm.user_id AND gmu.group_id = gm.group_id
                WHERE gm.group_id = %s
                  AND gm.user_id <> %s
                  AND COALESCE(u.notify_groups, TRUE) = TRUE
                  AND (gmu.user_id IS NULL OR (gmu.muted_until <> 0 AND gmu.muted_until <= %s))""",
            (int(group_id), int(sender_id) if sender_id else 0, now_ts)
        )
        subs = cur.fetchall()
        conn.close()

        if not subs:
            return ok({"ok": True, "sent": 0})

        vapid_private = _vapid_private()
        vapid_public = _vapid_public()
        if not vapid_private or not vapid_public:
            return err("VAPID ключи не настроены", 500)

        icon = "📢" if is_channel else "👥"
        payload = json.dumps({
            "title": f"{icon} {group_name}",
            "body": message,
            "group_id": int(group_id),
            "message_id": message_id,
            "icon": NOTIF_ICON,
            "badge": NOTIF_ICON,
            "tag": f"group_{group_id}",
        })

        # Отправляем все push'и параллельно через потоки — не ждём ответа
        def _push_one(endpoint, p256dh_key, auth_key):
            try:
                webpush(
                    subscription_info={
                        "endpoint": endpoint,
                        "keys": {"p256dh": p256dh_key, "auth": auth_key},
                    },
                    data=payload,
                    vapid_private_key=vapid_private,
                    vapid_claims={"sub": "mailto:nova@poehali.dev"},
                )
            except WebPushException:
                pass
            except Exception:
                pass

        threads = []
        for endpoint, p256dh, auth_key, _uid in subs:
            t = threading.Thread(target=_push_one, args=(endpoint, p256dh, auth_key), daemon=True)
            t.start()
            threads.append(t)
        # Ждём всех с общим лимитом, чтобы не подвесить функцию
        for t in threads:
            t.join(timeout=5)

        return ok({"ok": True, "queued": len(subs)})

    # ── broadcast — push всем пользователям (массовая рассылка от админа) ──────
    if action == "broadcast":
        message = body.get("message", "Сообщение от Nova")
        sender_name = body.get("sender_name", "Nova")

        # Берём подписки только тех, кто не отключил уведомления о сообщениях
        cur.execute(
            f"""SELECT ps.endpoint, ps.p256dh, ps.auth
                FROM {SCHEMA}.push_subscriptions ps
                JOIN {SCHEMA}.users u ON u.id = ps.user_id
                WHERE COALESCE(u.notify_messages, TRUE) = TRUE"""
        )
        subs = cur.fetchall()
        conn.close()

        if not subs:
            return ok({"ok": True, "queued": 0})

        vapid_private = _vapid_private()
        vapid_public = _vapid_public()
        if not vapid_private or not vapid_public:
            return err("VAPID ключи не настроены", 500)

        payload = json.dumps({
            "title": f"📣 {sender_name}",
            "body": message,
            "url": "/",
            "icon": NOTIF_ICON,
            "badge": NOTIF_ICON,
            "tag": "broadcast",
        })

        def _push_one(endpoint, p256dh_key, auth_key):
            try:
                webpush(
                    subscription_info={
                        "endpoint": endpoint,
                        "keys": {"p256dh": p256dh_key, "auth": auth_key},
                    },
                    data=payload,
                    vapid_private_key=vapid_private,
                    vapid_claims={"sub": "mailto:nova@poehali.dev"},
                )
            except WebPushException:
                pass
            except Exception:
                pass

        threads = []
        for endpoint, p256dh, auth_key in subs:
            t = threading.Thread(target=_push_one, args=(endpoint, p256dh, auth_key), daemon=True)
            t.start()
            threads.append(t)
        for t in threads:
            t.join(timeout=8)

        return ok({"ok": True, "queued": len(subs)})

    conn.close()
    return err("Неизвестный action")