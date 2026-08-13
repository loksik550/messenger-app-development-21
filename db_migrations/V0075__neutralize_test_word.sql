UPDATE t_p67547116_messenger_app_develo.moderation_rules
SET word = '__test_removed__', action = 'flag'
WHERE word = 'запрещёнка';

UPDATE t_p67547116_messenger_app_develo.moderation_hits
SET word = '__test__', snippet = 'тестовая запись проверки'
WHERE word = 'запрещёнка';
