-- Обезличиваем жалобу от аккаунта, удалённого до исправления функции.
-- Сама жалоба остаётся в истории модерации, но без привязки к человеку.
UPDATE t_p67547116_messenger_app_develo.reports
SET reporter_id = 0,
    comment = COALESCE(comment, '') || ' [автор удалил аккаунт]'
WHERE reporter_id NOT IN (
    SELECT id FROM t_p67547116_messenger_app_develo.users
);
