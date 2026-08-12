ALTER TABLE t_p67547116_messenger_app_develo.orders
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30),
    ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS refund_reason TEXT,
    ADD COLUMN IF NOT EXISTS refunded_by BIGINT,
    ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_status_created
    ON t_p67547116_messenger_app_develo.orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_nova_user
    ON t_p67547116_messenger_app_develo.orders(nova_user_id);
