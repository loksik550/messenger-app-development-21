CREATE TABLE IF NOT EXISTS t_p67547116_messenger_app_develo.reports (
    id SERIAL PRIMARY KEY,
    reporter_id INTEGER NOT NULL,
    reported_user_id INTEGER NOT NULL,
    chat_id INTEGER,
    reason VARCHAR(40) NOT NULL,
    comment VARCHAR(1000),
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON t_p67547116_messenger_app_develo.reports (status);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON t_p67547116_messenger_app_develo.reports (reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created ON t_p67547116_messenger_app_develo.reports (created_at);