"""Проверка имени пользователя на мат и оскорбления (русский, латиница, транслит)."""
import re

_LOOKALIKE = str.maketrans({
    "a": "а", "e": "е", "o": "о", "p": "р", "c": "с", "x": "х", "y": "у",
    "k": "к", "m": "м", "t": "т", "h": "н", "b": "в", "ё": "е",
})

_RU_ANY = [
    r"х[уy][йеияюё]", r"п[иеё]зд", r"зал[уy]п", r"г[ао]нд[оа]н", r"п[иеё]д[ао]р", r"пидр",
    r"педик", r"пидик", r"шлюх", r"шалав", r"ублюд", r"мудак", r"мудил", r"мудо[зх]",
    r"дерьм", r"говн", r"проститут", r"педераст", r"долбо[её]б", r"[её]бан", r"[её]бат",
    r"[её]бл[аои]", r"[её]бну", r"уеб[аи]", r"заеб", r"наеб", r"выеб", r"отъеб", r"въеб",
    r"съеб", r"разъеб", r"[её]бырь", r"ниггер", r"нигер", r"сучар",
]

_RU_WORD = [
    r"^бл[яь]", r"^бляд", r"^сук[аиеоу]?$", r"^сучк[аи]$", r"^сучь", r"^манд(а|ы|е|у|ой|ой|ец|ёж|еж|авошк[аи])?$", r"^ж[оа]п[аеуы]?$",
    r"^жоп", r"^дебил", r"^идиот", r"^урод(ы|ина|ец)?$", r"^тупиц", r"^даун$", r"^кретин",
    r"^дур(а|ак|ачок|еха|очка)$", r"^чмо", r"^чмыр", r"^лох$", r"^лошар", r"^мраз", r"^твар[ьи]",
    r"^выродок", r"^скотин[аы]?$", r"^коз[её]л$", r"^жид$", r"^жидяр", r"^жидовк", r"^хач$", r"^чурк[аи]$", r"^чуреки?$", r"^петух$", r"^гнид[аы]?$",
    r"^падл", r"^сволоч", r"^ебл", r"^еб[аеуи]", r"^ссык", r"^ссан", r"^срань", r"^сра[тл]",
    r"^пох[уy]", r"^нах[уy]", r"^дрочи", r"^онанист", r"^членосос", r"^хер$", r"^херня",
]

_EN_ANY = [
    r"fuck", r"fuk", r"shit", r"bitch", r"nigg", r"cunt", r"asshole", r"pussy", r"whore",
    r"slut", r"faggot", r"retard", r"bastard", r"motherf", r"blyat", r"blyad",
    r"pizd", r"zalup", r"gandon", r"gondon", r"pidor", r"pidar", r"pidr", r"mudak", r"huy",
    r"khuy", r"xuy", r"ebat", r"eblan", r"yeban", r"shlyuh", r"shluh", r"debil", r"idiot",
]

_EN_WORD = [r"^suka$", r"^suki$", r"^blya", r"^bljad", r"^dura$", r"^durak$", r"^loh$", r"^chmo", r"^ass$", r"^fag$"]


def _collapse(s: str) -> str:
    return re.sub(r"(.)\1+", r"\1", s)


def _variants(word: str):
    w = word.lower().replace("ё", "е")
    out = {w, _collapse(w)}
    if re.search(r"[а-я]", w):
        m = w.translate(_LOOKALIKE)
        out |= {m, _collapse(m)}
    return out


def is_offensive(name: str) -> bool:
    words = [w for w in (name or "").split() if w]
    if not words:
        return False
    joined = "".join(words)
    for w in words + [joined]:
        for v in _variants(w):
            if any(re.search(p, v) for p in _RU_ANY + _EN_ANY):
                return True
    for w in words:
        for v in _variants(w):
            if any(re.search(p, v) for p in _RU_WORD + _EN_WORD):
                return True
    return False


_VOWELS = set("аеёиоуыэюяaeiouy")


def gibberish_error(name: str):
    """Возвращает текст ошибки, если имя похоже на бессмысленный набор букв."""
    for word in (name or "").split():
        w = word.lower()
        if len(w) > 15:
            return "Слово в имени слишком длинное — не больше 15 букв"
        if re.search(r"(.)\1\1", w):
            return "Имя не должно состоять из повторяющихся букв"
        if re.search(r"(..+?)\1\1", w):
            return "Имя не должно состоять из повторяющихся слогов"
        if len(w) >= 4 and not any(c in _VOWELS for c in w):
            return "Похоже на случайный набор букв. Укажите настоящее имя"
        if len(w) >= 6 and len(set(w)) <= 2:
            return "Похоже на случайный набор букв. Укажите настоящее имя"
    return None
