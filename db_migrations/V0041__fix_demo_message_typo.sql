-- Убираем случайный посторонний символ в демо-сообщении.
UPDATE t_p67547116_messenger_app_develo.group_messages
SET text = 'Давайте в субботу в парке'
WHERE text = '预 давайте в субботу в парке';

UPDATE t_p67547116_messenger_app_develo.groups g
SET last_message = lm.text, last_message_at = lm.created_at
FROM (
  SELECT DISTINCT ON (group_id) group_id, text, created_at
  FROM t_p67547116_messenger_app_develo.group_messages
  ORDER BY group_id, created_at DESC
) lm
WHERE g.id = lm.group_id;
