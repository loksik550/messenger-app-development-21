UPDATE t_p67547116_messenger_app_develo.dev_settings
SET value = '/app-icon-512.png'
WHERE key = 'panel_logo_url' AND (value IS NULL OR value = '');
