CREATE SEQUENCE IF NOT EXISTS t_p67547116_messenger_app_develo.users_nova_id_seq START 1;

ALTER TABLE t_p67547116_messenger_app_develo.users
  ALTER COLUMN nova_id SET DEFAULT (10000000 + ((nextval('t_p67547116_messenger_app_develo.users_nova_id_seq') * 48271 + 7368787) % 89999999))::text;