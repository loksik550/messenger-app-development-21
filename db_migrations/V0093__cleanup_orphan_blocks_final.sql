-- Оставшиеся блокировки ссылаются на удалённых людей и ни на что не влияют.
-- Помечаем их отрицательными значениями, чтобы снять связь с живыми аккаунтами
-- и не нарушить требование уникальности пары.
UPDATE t_p67547116_messenger_app_develo.user_blocks
SET blocked_id = -blocked_id
WHERE id = 3 AND blocked_id > 0;

UPDATE t_p67547116_messenger_app_develo.user_blocks
SET blocked_id = -blocked_id
WHERE id = 4 AND blocked_id > 0;
