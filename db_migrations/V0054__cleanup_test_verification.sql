UPDATE t_p67547116_messenger_app_develo.dev_admins
SET disabled = true
WHERE email = 'qa4@nova.test';

UPDATE t_p67547116_messenger_app_develo.dev_sessions
SET expires_at = 0
WHERE admin_id IN (
    SELECT id FROM t_p67547116_messenger_app_develo.dev_admins WHERE email = 'qa4@nova.test'
);

UPDATE t_p67547116_messenger_app_develo.verification_requests
SET status = 'rejected', reviewer_note = 'Тестовая заявка, снята автоматически'
WHERE id = 1;

UPDATE t_p67547116_messenger_app_develo.users
SET verified = false, verified_at = NULL, verified_kind = ''
WHERE id = 45;
