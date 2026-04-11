#!/bin/bash
set -e

echo "=== PostgreSQL Install ==="
sudo apt update
sudo apt install -y postgresql postgresql-contrib

echo "=== Create User & Database ==="
sudo -u postgres psql -c "CREATE USER keiba_user WITH PASSWORD 'Kdb2026GceFree!';"
sudo -u postgres psql -c "CREATE DATABASE keiba_db OWNER keiba_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE keiba_db TO keiba_user;"

echo "=== Configure Remote Access ==="
sudo bash -c 'echo "host all all 0.0.0.0/0 scram-sha-256" >> /etc/postgresql/15/main/pg_hba.conf'
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/15/main/postgresql.conf
sudo sed -i "s/shared_buffers = 128MB/shared_buffers = 256MB/" /etc/postgresql/15/main/postgresql.conf
sudo sed -i "s/max_connections = 100/max_connections = 50/" /etc/postgresql/15/main/postgresql.conf

echo "=== Restart PostgreSQL ==="
sudo systemctl restart postgresql
sudo systemctl enable postgresql

echo "=== PostgreSQL setup complete! ==="
