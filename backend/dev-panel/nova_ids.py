"""Красивые короткие ID Nova: правила, цены, проверка, присвоение."""
import json
import time

MIN_LEN = 3
MAX_LEN = 7
RESERVE_SEC = 20 * 60

DEFAULT_PRICES = {
    3: {"lightning": 5000, "rub": 4990},
    4: {"lightning": 2000, "rub": 1990},
    5: {"lightning": 800, "rub": 790},
    6: {"lightning": 300, "rub": 290},
    7: {"lightning": 150, "rub": 149},
}


def normalize(raw) -> str:
    s = str(raw or "").strip().lower()
    for ch in ("id", "#", " ", "-"):
        s = s.replace(ch, "")
    return s


def validate(nid: str):
    if not nid.isdigit():
        return "ID может состоять только из цифр"
    if len(nid) < MIN_LEN or len(nid) > MAX_LEN:
        return f"Длина ID — от {MIN_LEN} до {MAX_LEN} цифр"
    if nid[0] == "0":
        return "ID не может начинаться с нуля"
    return None


def is_beautiful(nid: str) -> bool:
    """Все цифры одинаковые, зеркальный, подряд по возрастанию/убыванию или круглый (100, 7000)."""
    if len(set(nid)) == 1:
        return True
    if nid == nid[::-1]:
        return True
    digits = [int(c) for c in nid]
    steps = {digits[i + 1] - digits[i] for i in range(len(digits) - 1)}
    if steps in ({1}, {-1}):
        return True
    if nid[1:] == "0" * (len(nid) - 1):
        return True
    return False


def load_config(cur, schema: str) -> dict:
    cur.execute(
        f"SELECT key, value FROM {schema}.dev_settings "
        f"WHERE key LIKE 'nova_id_%%'"
    )
    raw = {k: v for k, v in cur.fetchall()}
    prices = {}
    for ln, d in DEFAULT_PRICES.items():
        try:
            v = json.loads(raw.get(f"nova_id_price_{ln}") or "")
            prices[ln] = {"lightning": max(0, int(v.get("lightning", d["lightning"]))),
                          "rub": max(0.0, float(v.get("rub", d["rub"])))}
        except Exception:
            prices[ln] = dict(d)
    try:
        mult = max(1.0, float(raw.get("nova_id_beauty_mult") or 2))
    except ValueError:
        mult = 2.0
    reserved = {x.strip() for x in (raw.get("nova_id_reserved") or "").replace("\n", ",").split(",") if x.strip()}
    enabled = (raw.get("nova_id_enabled") or "1") != "0"
    return {"prices": prices, "beauty_mult": mult, "reserved": reserved, "enabled": enabled}


def price_for(nid: str, cfg: dict) -> dict:
    base = cfg["prices"].get(len(nid)) or {"lightning": 0, "rub": 0}
    mult = cfg["beauty_mult"] if is_beautiful(nid) else 1.0
    return {
        "lightning": int(round(base["lightning"] * mult)),
        "rub": round(float(base["rub"]) * mult, 2),
        "beautiful": mult > 1.0,
    }


def check(cur, schema: str, nid: str, user_id: int, cfg: dict) -> dict:
    """Свободен ли ID для user_id. Возвращает {available, reason?, price?}."""
    bad = validate(nid)
    if bad:
        return {"available": False, "reason": bad}
    if nid in cfg["reserved"]:
        return {"available": False, "reason": "Этот ID зарезервирован"}
    cur.execute(f"SELECT id FROM {schema}.users WHERE nova_id = %s", (nid,))
    r = cur.fetchone()
    if r:
        if int(r[0]) == int(user_id):
            return {"available": False, "reason": "Это уже ваш ID", "mine": True}
        return {"available": False, "reason": "Этот ID уже занят"}
    cur.execute(
        f"SELECT user_id FROM {schema}.nova_id_reservations WHERE nova_id = %s AND expires_at > %s",
        (nid, int(time.time())),
    )
    r = cur.fetchone()
    if r and int(r[0]) != int(user_id):
        return {"available": False, "reason": "Этот ID сейчас покупает другой человек — попробуйте через 20 минут"}
    return {"available": True, "price": price_for(nid, cfg)}


def suggest(cur, schema: str, base: str, user_id: int, cfg: dict, limit: int = 6) -> list:
    """Похожие свободные варианты."""
    cands = []
    if base and base.isdigit():
        for d in "0123456789":
            cands.append(base + d)
        for d in "123456789":
            cands.append(d + base)
        if len(base) > MIN_LEN:
            cands.append(base[:-1])
    for p in ("777", "888", "999", "1111", "2222", "7777", "12345", "54321"):
        cands.append(p)
    seen, out = set(), []
    for c in cands:
        if c in seen or validate(c):
            continue
        seen.add(c)
        res = check(cur, schema, c, user_id, cfg)
        if res.get("available"):
            out.append({"nova_id": c, "price": res["price"]})
            if len(out) >= limit:
                break
    return out


def assign(cur, schema: str, user_id: int, nid: str, method: str,
           price_lightning: int = 0, price_rub: float = 0, admin_id=None, note: str = "") -> str:
    """Присваивает ID, пишет историю. Возвращает старый ID."""
    cur.execute(f"SELECT nova_id FROM {schema}.users WHERE id = %s", (int(user_id),))
    r = cur.fetchone()
    old = r[0] if r else None
    cur.execute(f"UPDATE {schema}.users SET nova_id = %s WHERE id = %s", (nid, int(user_id)))
    cur.execute(
        f"INSERT INTO {schema}.nova_id_purchases "
        f"(user_id, nova_id, old_nova_id, method, price_lightning, price_rub, admin_id, note, created_at) "
        f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (int(user_id), nid, old, method, int(price_lightning), float(price_rub), admin_id, note[:300], int(time.time())),
    )
    cur.execute(f"DELETE FROM {schema}.nova_id_reservations WHERE nova_id = %s", (nid,))
    return old
