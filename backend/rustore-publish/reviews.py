import os
import json
import time
import psycopg2
from rustore import PACKAGE, rs, page_items, RuStoreError

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p67547116_messenger_app_develo")
LOCAL_KEY = "rustore_sent_replies"


def _local_load():
    try:
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        cur = conn.cursor()
        cur.execute(f"SELECT value FROM {SCHEMA}.dev_settings WHERE key = %s", (LOCAL_KEY,))
        r = cur.fetchone()
        conn.close()
        return json.loads(r[0]) if r and r[0] else {}
    except Exception as e:
        print(f"[reviews] local load: {e}")
        return {}


def _local_save(data):
    try:
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(
            f"INSERT INTO {SCHEMA}.dev_settings (key, value, updated_at) VALUES (%s, %s, %s) "
            f"ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at",
            (LOCAL_KEY, json.dumps(data, ensure_ascii=False), int(time.time())),
        )
        conn.close()
    except Exception as e:
        print(f"[reviews] local save: {e}")


def _remember(comment_id, reply_id, text):
    data = _local_load()
    cutoff = time.time() - 14 * 86400
    data = {k: v for k, v in data.items() if v.get("at", 0) > cutoff}
    data[str(comment_id)] = {"id": reply_id, "text": text, "at": int(time.time())}
    _local_save(data)


def _forget(comment_id=None, reply_id=None):
    data = _local_load()
    keys = [k for k, v in data.items() if k == str(comment_id) or (reply_id and str(v.get("id")) == str(reply_id))]
    if keys:
        for k in keys:
            data.pop(k, None)
        _local_save(data)

REPLY_STATUS_RU = {
    "PUBLISHED": "Опубликован",
    "MODERATION": "На модерации",
    "REJECTED": "Отклонён модератором",
    "DELETED": "Удалён",
}


def rating(tok):
    d = rs("GET", f"/public/v1/application/{PACKAGE}/comment/statistic", tok)
    b = d.get("body") or {}
    r = b.get("ratings") or {}
    return {
        "average": round(float(b.get("averageUserRating") or 0), 2),
        "total": int(b.get("totalRatings") or 0),
        "without_reply": int(b.get("totalResponses") or 0),
        "no_comment": int(b.get("ratingsNoComments") or 0),
        "stars": {
            "5": int(r.get("amountFive") or 0),
            "4": int(r.get("amountFour") or 0),
            "3": int(r.get("amountThree") or 0),
            "2": int(r.get("amountTwo") or 0),
            "1": int(r.get("amountOne") or 0),
        },
    }


def _replies(tok):
    """Ответы разработчика: commentId -> последний живой ответ (id, текст, статус)."""
    out = {}
    for page in range(5):
        d = rs("GET", f"/public/v1/application/{PACKAGE}/feedback?page={page}&size=100", tok)
        items = page_items(d.get("body"))
        for f in items:
            cid = f.get("commentId")
            if cid is None or f.get("status") in ("DELETED", "WAS_ACTIVE"):
                continue
            cid = str(cid)
            prev = out.get(cid)
            if not prev or str(f.get("date") or "") >= str(prev.get("date") or ""):
                out[cid] = f
        if len(items) < 100:
            break
    return out


def list_reviews(tok, page=0, size=50):
    size = max(1, min(int(size or 50), 100))
    page = max(0, int(page or 0))
    d = rs("GET", f"/public/v1/application/{PACKAGE}/comment?page={page}&size={size}", tok)
    items = page_items(d.get("body"))
    try:
        replies = _replies(tok)
    except RuStoreError as e:
        print(f"[reviews] replies: {e}")
        replies = {}
    local = _local_load()
    res = []
    for c in items:
        cid = c.get("commentId")
        rep = replies.get(str(cid))
        dev = c.get("devResponses") or []
        reply = None
        if rep:
            rid = rep.get("id")
            reply = {
                "id": int(rid) if str(rid or "").isdigit() else rid,
                "text": rep.get("text") or "",
                "status": rep.get("status"),
                "status_ru": REPLY_STATUS_RU.get(rep.get("status"), rep.get("status") or ""),
                "date": rep.get("date"),
            }
        elif dev:
            last = dev[-1] or {}
            reply = {"id": None, "text": last.get("text") or "", "status": "PUBLISHED",
                     "status_ru": "Опубликован", "date": last.get("createdAt")}
        elif local.get(str(cid)):
            lr = local[str(cid)]
            reply = {"id": lr.get("id"), "text": lr.get("text") or "", "status": "MODERATION",
                     "status_ru": "На модерации", "date": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(lr.get("at", 0)))}
        info = c.get("deviceInfo") or {}
        res.append({
            "id": cid,
            "user": c.get("userName") or "Пользователь",
            "rating": int(c.get("appRating") or 0),
            "text": c.get("commentText") or "",
            "date": c.get("commentDateIso") or c.get("commentDate"),
            "version": c.get("appVersionName"),
            "edited": bool(c.get("edited")),
            "likes": int(c.get("likeCounter") or 0),
            "dislikes": int(c.get("dislikeCounter") or 0),
            "device": " ".join(x for x in [info.get("device"), info.get("model")] if x) or None,
            "os": info.get("osVersion"),
            "reply": reply,
        })
    return {"items": res, "page": page, "has_more": len(items) >= size}


def _check_text(text):
    text = (text or "").strip()
    if not text:
        raise RuStoreError("Напишите текст ответа")
    if len(text) > 500:
        raise RuStoreError("Ответ длиннее 500 символов — RuStore такой не примет")
    return text


def reply(tok, comment_id, text):
    text = _check_text(text)
    d = rs("POST", f"/public/v1/application/{PACKAGE}/feedback?commentId={int(comment_id)}", tok,
           json={"message": text})
    body = d.get("body") or {}
    rid = body.get("id") if isinstance(body, dict) else None
    print(f"[reviews] reply {comment_id}: code={d.get('code')} id={rid}")
    if d.get("code") and str(d.get("code")).upper() != "OK":
        raise RuStoreError(d.get("message") or "RuStore не принял ответ")
    rid = int(rid) if str(rid or "").isdigit() else rid
    _remember(comment_id, rid, text)
    return rid


def edit_reply(tok, feedback_id, text):
    text = _check_text(text)
    d = rs("POST", f"/public/v1/application/{PACKAGE}/feedback/{int(feedback_id)}", tok,
           json={"message": text})
    return (d.get("body") or {}).get("id")


def delete_reply(tok, feedback_id):
    rs("DELETE", f"/public/v1/application/{PACKAGE}/feedback/{int(feedback_id)}", tok)
    _forget(reply_id=feedback_id)
