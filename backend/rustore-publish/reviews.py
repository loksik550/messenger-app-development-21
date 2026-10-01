from rustore import PACKAGE, rs, page_items, RuStoreError

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
            if cid is None or f.get("status") == "DELETED":
                continue
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
    res = []
    for c in items:
        cid = c.get("commentId")
        rep = replies.get(cid)
        dev = c.get("devResponses") or []
        reply = None
        if rep:
            reply = {
                "id": rep.get("id"),
                "text": rep.get("text") or "",
                "status": rep.get("status"),
                "status_ru": REPLY_STATUS_RU.get(rep.get("status"), rep.get("status") or ""),
                "date": rep.get("date"),
            }
        elif dev:
            last = dev[-1] or {}
            reply = {"id": None, "text": last.get("text") or "", "status": "PUBLISHED",
                     "status_ru": "Опубликован", "date": last.get("createdAt")}
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
    return (d.get("body") or {}).get("id")


def edit_reply(tok, feedback_id, text):
    text = _check_text(text)
    d = rs("POST", f"/public/v1/application/{PACKAGE}/feedback/{int(feedback_id)}", tok,
           json={"message": text})
    return (d.get("body") or {}).get("id")


def delete_reply(tok, feedback_id):
    rs("DELETE", f"/public/v1/application/{PACKAGE}/feedback/{int(feedback_id)}", tok)
