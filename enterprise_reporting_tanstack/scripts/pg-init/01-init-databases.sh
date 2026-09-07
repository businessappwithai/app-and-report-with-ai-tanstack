#!/bin/bash
# Runs once on first container start (docker-entrypoint-initdb.d)
# Creates the knowledge graph database alongside the default enterprise_config DB.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  -- Knowledge graph database for Apache AGE
  SELECT 'CREATE DATABASE ers_knowledge OWNER $POSTGRES_USER'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ers_knowledge')\gexec

  -- Load AGE extension into the default config DB as well (optional — used for graph queries on same connection)
  CREATE EXTENSION IF NOT EXISTS age;
EOSQL

# Load AGE into the knowledge graph database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "ers_knowledge" <<-EOSQL
  CREATE EXTENSION IF NOT EXISTS age;
  CREATE EXTENSION IF NOT EXISTS vector;
  SELECT create_graph('knowledge_graph');
EOSQL
