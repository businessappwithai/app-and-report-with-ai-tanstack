#!/bin/bash

set -e

# Local database details
LOCAL_DB_HOST="localhost"
LOCAL_DB_USER="postgres"
LOCAL_DB_NAME="hospital_management_system"
LOCAL_DB_PASSWORD=""

# Neon database connection string
NEON_CONNECTION_STRING="postgresql://neondb_owner:npg_Zzp29WIvYOxn@ep-little-dawn-aqcbpctg-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting database cleanup and migration...${NC}"

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: psql not found. Please install PostgreSQL client tools.${NC}"
    exit 1
fi

# Step 1: Connect to local database and identify large tables
echo -e "${YELLOW}Step 1: Identifying large tables...${NC}"

LARGE_TABLES=$(PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -t -c "
SELECT tablename FROM pg_tables
WHERE schemaname='public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
")

echo -e "${GREEN}Top 10 largest tables:${NC}"
echo "$LARGE_TABLES"

# Step 2: Clean up the local database - keep only 1000 records in large tables
echo -e "${YELLOW}Step 2: Cleaning up large tables (keeping 1000 records each)...${NC}"

# Get the IDs to keep (first 1000 records by primary key)
# Focus on bus_patient as the main large table
TABLES_TO_CLEAN=(
    "bus_patient"
    "bus_vital_sign"
    "bus_admission"
    "bus_diagnosis"
    "bus_procedure"
    "bus_lab_result"
    "bus_medication"
)

for TABLE in "${TABLES_TO_CLEAN[@]}"; do
    # Check if table exists
    TABLE_EXISTS=$(PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -t -c "
    SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='$TABLE';
    " | xargs)

    if [ "$TABLE_EXISTS" -gt 0 ]; then
        # Get the count before cleanup
        BEFORE_COUNT=$(PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -t -c "SELECT COUNT(*) FROM $TABLE;" | xargs)

        if [ "$BEFORE_COUNT" -gt 1000 ]; then
            echo -e "${YELLOW}  Cleaning $TABLE (before: $BEFORE_COUNT records)...${NC}"

            # Get the primary key column name
            PK_COLUMN=$(PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -t -c "
            SELECT a.attname FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelname = '${TABLE}_pkey' LIMIT 1;
            " | xargs)

            if [ -z "$PK_COLUMN" ]; then
                # If no explicit primary key, use ctid (internal row id)
                PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c "
                DELETE FROM $TABLE WHERE ctid NOT IN (SELECT ctid FROM $TABLE LIMIT 1000);
                "
            else
                # Delete records keeping only the first 1000 by PK
                PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c "
                DELETE FROM $TABLE WHERE $PK_COLUMN NOT IN (
                    SELECT $PK_COLUMN FROM $TABLE ORDER BY $PK_COLUMN LIMIT 1000
                );
                "
            fi

            AFTER_COUNT=$(PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -t -c "SELECT COUNT(*) FROM $TABLE;" | xargs)
            echo -e "${GREEN}  ✓ $TABLE cleaned (after: $AFTER_COUNT records)${NC}"
        else
            echo -e "${GREEN}  ✓ $TABLE is already small ($BEFORE_COUNT records)${NC}"
        fi
    fi
done

# Step 3: Run VACUUM ANALYZE to optimize the database
echo -e "${YELLOW}Step 3: Optimizing local database (VACUUM ANALYZE)...${NC}"
PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c "VACUUM ANALYZE;"
echo -e "${GREEN}✓ Database optimized${NC}"

# Step 4: Drop existing Neon database content (if any)
echo -e "${YELLOW}Step 4: Clearing Neon database...${NC}"
psql "$NEON_CONNECTION_STRING" -c "
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO PUBLIC;
" 2>/dev/null || true
echo -e "${GREEN}✓ Neon database cleared${NC}"

# Step 5: Dump the cleaned local database
DUMP_FILE="/tmp/hospital_management_system_dump_cleaned.sql"
echo -e "${YELLOW}Step 5: Dumping cleaned local database to $DUMP_FILE...${NC}"

PGPASSWORD="$LOCAL_DB_PASSWORD" pg_dump \
    -h "$LOCAL_DB_HOST" \
    -U "$LOCAL_DB_USER" \
    -d "$LOCAL_DB_NAME" \
    --no-owner \
    --no-acl \
    > "$DUMP_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database dump created successfully${NC}"
    echo -e "${GREEN}  Dump file size: $(du -h $DUMP_FILE | cut -f1)${NC}"
else
    echo -e "${RED}✗ Failed to dump local database${NC}"
    exit 1
fi

# Step 6: Restore to Neon database
echo -e "${YELLOW}Step 6: Restoring cleaned database to Neon...${NC}"

psql "$NEON_CONNECTION_STRING" < "$DUMP_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database restored to Neon successfully${NC}"
else
    echo -e "${RED}✗ Failed to restore database to Neon${NC}"
    rm "$DUMP_FILE"
    exit 1
fi

# Step 7: Verify migration
echo -e "${YELLOW}Step 7: Verifying migration...${NC}"

# Count tables in local database
LOCAL_TABLE_COUNT=$(PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$LOCAL_DB_HOST" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")

# Count tables in Neon database
NEON_TABLE_COUNT=$(psql "$NEON_CONNECTION_STRING" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")

echo -e "${YELLOW}Table counts:${NC}"
echo -e "  Local database: $LOCAL_TABLE_COUNT tables"
echo -e "  Neon database: $NEON_TABLE_COUNT tables"

if [ "$LOCAL_TABLE_COUNT" -eq "$NEON_TABLE_COUNT" ]; then
    echo -e "${GREEN}✓ Table count matches!${NC}"
else
    echo -e "${YELLOW}⚠ Table count mismatch${NC}"
fi

# Show sample data counts
echo -e "${YELLOW}Sample row counts in Neon:${NC}"
for TABLE in "${TABLES_TO_CLEAN[@]}"; do
    COUNT=$(psql "$NEON_CONNECTION_STRING" -t -c "SELECT COUNT(*) FROM $TABLE;" 2>/dev/null | xargs || echo "N/A")
    echo -e "  $TABLE: $COUNT records"
done

# Clean up
echo -e "${YELLOW}Step 8: Cleaning up temporary files...${NC}"
rm "$DUMP_FILE"
echo -e "${GREEN}✓ Temporary dump file removed${NC}"

echo -e "${GREEN}Migration completed successfully!${NC}"
echo -e "${YELLOW}Neon connection string:${NC}"
echo "$NEON_CONNECTION_STRING"
