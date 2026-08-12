UPDATE t_p67547116_messenger_app_develo.dev_admins
SET disabled = true
WHERE email IN ('qa4@nova.test', 'qa6@nova.test', 'qa7@nova.test');

UPDATE t_p67547116_messenger_app_develo.dev_sessions
SET expires_at = 0
WHERE admin_id IN (
    SELECT id FROM t_p67547116_messenger_app_develo.dev_admins
    WHERE email IN ('qa4@nova.test', 'qa6@nova.test', 'qa7@nova.test')
);

UPDATE t_p67547116_messenger_app_develo.support_tickets
SET status = 'closed'
WHERE subject = 'Проверка';

UPDATE t_p67547116_messenger_app_develo.verification_requests
SET status = 'rejected', reviewer_note = 'Тестовая заявка'
WHERE full_name = 'Тест' AND status = 'pending';
