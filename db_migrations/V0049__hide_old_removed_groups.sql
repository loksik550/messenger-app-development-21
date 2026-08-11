UPDATE t_p67547116_messenger_app_develo.groups
SET removed_at = (EXTRACT(epoch FROM now()))::bigint
WHERE name = 'Удалён администратором' AND removed_at IS NULL;
