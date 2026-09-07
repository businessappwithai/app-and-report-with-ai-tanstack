#!/bin/bash
# Runs once, on the first start of the demo profile's single PostgreSQL.
#
# Three databases in one instance, which is what "different schema" means here:
# the reporting platform's own configuration never shares a database with the
# application it reports on, so a regeneration that drops and recreates the
# application's tables cannot take the reports with it.
#
#   $APP_DB            the generated application  (created by POSTGRES_DB)
#   enterprise_config  the reporting platform's own configuration
#   ers_knowledge      the reporting platform's Apache AGE knowledge graph
#
# The production profile splits these across two servers instead — see
# docker-compose.yml — because the two want different images: the generated
# application asks for pgvector on PostgreSQL 18, the reporting platform for
# Apache AGE on 16.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  SELECT 'CREATE DATABASE enterprise_config OWNER $POSTGRES_USER'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'enterprise_config')\gexec
  SELECT 'CREATE DATABASE ers_knowledge OWNER $POSTGRES_USER'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ers_knowledge')\gexec
EOSQL

# pgvector in the application's database: the generated app's model-context
# assistant creates an index over it and fails to start without the extension.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE EXTENSION IF NOT EXISTS vector;
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "ers_knowledge" <<-EOSQL
  CREATE EXTENSION IF NOT EXISTS age;
  CREATE EXTENSION IF NOT EXISTS vector;
  SELECT create_graph('knowledge_graph');
EOSQL

echo "[pg-init] $POSTGRES_DB, enterprise_config and ers_knowledge ready"
