-- Записи от аккаунтов, удалённых до исправления функции очистки.
-- Блокировки просто снимаем: людей, которых они касались, уже нет.
UPDATE t_p67547116_messenger_app_develo.login_events
SET user_id = 0, ip_addr = NULL, device_name = 'аккаунт удалён'
WHERE user_id NOT IN (SELECT id FROM t_p67547116_messenger_app_develo.users);

UPDATE t_p67547116_messenger_app_develo.user_blocks
SET blocker_id = 0, blocked_id = 0
WHERE (blocker_id NOT IN (SELECT id FROM t_p67547116_messenger_app_develo.users)
    OR blocked_id NOT IN (SELECT id FROM t_p67547116_messenger_app_develo.users))
  AND id = (
    SELECT MIN(id) FROM t_p67547116_messenger_app_develo.user_blocks b2
    WHERE b2.blocker_id NOT IN (SELECT id FROM t_p67547116_messenger_app_develo.users)
       OR b2.blocked_id NOT IN (SELECT id FROM t_p67547116_messenger_app_develo.users)
  );
