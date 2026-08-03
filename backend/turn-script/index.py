CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

SCRIPT = r'''#!/bin/bash
echo "==== ГЛУБОКАЯ ДИАГНОСТИКА ЗАПУСКА ===="

echo "--- 1. Как реально запущен процесс turnserver ---"
ps -eo pid,user,cmd | grep -i turnserver | grep -v grep

echo ""
echo "--- 2. Активные юниты/скрипты coturn ---"
systemctl status coturn --no-pager 2>&1 | head -5
echo "ExecStart из юнита:"
systemctl cat coturn 2>&1 | grep -iE 'ExecStart|conf'
echo "init.d есть?:"; ls -l /etc/init.d/coturn 2>&1

echo ""
echo "--- 3. Проверка конфига вручную (запускаю turnserver в тест-режиме) ---"
timeout 3 turnserver -c /etc/turnserver.conf -o -v 2>&1 | grep -iE 'tls|cert|pkey|5349|listener|error|WARNING|relay' | head -20

echo ""
echo "--- 4. Что читает turnserver по умолчанию ---"
turnserver --help 2>&1 | grep -iE 'default.*conf|/etc/turnserver' | head -3
echo "===================================="
'''


def handler(event: dict, context) -> dict:
    """Глубокая диагностика: как реально стартует turnserver и почему нет TLS."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "text/plain; charset=utf-8"},
        "body": SCRIPT,
    }
