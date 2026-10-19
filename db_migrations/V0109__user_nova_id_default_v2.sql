CREATE SEQUENCE IF NOT EXISTS t_p67547116_messenger_app_develo.users_nova_seq2 START 100000;

ALTER TABLE t_p67547116_messenger_app_develo.users
  ALTER COLUMN nova_id SET DEFAULT (10000000 + ((nextval('t_p67547116_messenger_app_develo.users_nova_seq2') * 48271 + 1299709) % 89999999))::text;