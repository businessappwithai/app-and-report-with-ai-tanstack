# Connection String Support - Data Sources

Users can now use connection strings instead of individual host/port/database fields when creating or editing data sources.

## Feature Overview

When creating or editing a data source, users can toggle between two modes:

1. **Individual Fields** (Default)
   - Traditional form with separate host, port, database, username, password fields
   - Recommended for simple setups

2. **Connection String**
   - Paste a full connection string URL
   - Supports PostgreSQL, MySQL, SQL Server, Oracle
   - Better for cloud databases (Neon, AWS RDS, Azure SQL, etc.)

## Usage

### Creating a Data Source with Connection String

1. Navigate to **Data Sources** page
2. Click **Add Data Source**
3. Enter data source name
4. Select database type (PostgreSQL, MySQL, etc.)
5. Click **Connection String** button
6. Paste your connection string:

**Examples:**

```
# PostgreSQL (Neon, self-hosted, AWS RDS)
postgresql://user:password@host:5432/database
postgresql://user:password@host.neon.tech/database?sslmode=require
postgresql://user:password@mydb.postgres.rds.amazonaws.com:5432/database?ssl=require

# MySQL (AWS RDS, Azure)
mysql://user:password@host:3306/database
mysql://user:password@mydb.mysql.database.azure.com:3306/database

# SQL Server (Azure SQL)
mssql://user:password@host:1433/database
mssql://user:password@myserver.database.windows.net:1433/database

# Oracle
oracle://user:password@host:1521/database
```

7. Click **Test Connection** to verify
8. If successful, click **Create Data Source**

### Editing a Data Source

If a data source was created with a connection string, the form will automatically:
- Switch to **Connection String** mode
- Display the original connection string (if still available)
- Allow editing or switching to Individual Fields mode

## Technical Details

### Backend Support

The backend (`src/lib/services/data-source.service.ts`) already supported connection strings:

```typescript
// Connection config can be either:
{ 
  connectionString: "postgresql://user:pass@host/db?ssl=require" 
}

// Or individual fields:
{
  host: "localhost",
  port: 5432,
  database: "mydb",
  user: "dbuser",
  password: "dbpass"
}
```

### Frontend Implementation

The `ConnectionFormState` interface now includes:

```typescript
interface ConnectionFormState {
  // ... existing fields ...
  connectionString?: string;      // Full connection URL
  useConnectionString?: boolean;  // Toggle between modes
}
```

**Files Modified:**
- `src/components/data-sources/connection-form-fields.tsx` - UI component with toggle
- `src/routes/_authed/data-sources/index.tsx` - Form handling logic

### Form Validation

Smart validation checks:
- **Connection String mode**: Requires non-empty connection string
- **Individual Fields mode**: Requires host, database, and username
- **SQLite mode**: Requires uploaded database file
- **Test Connection**: Works with both modes

## Database Support

| Database | Connection String Format | Example |
|----------|--------------------------|---------|
| PostgreSQL | `postgresql://user:pass@host:port/db` | `postgresql://admin:secret@localhost:5432/mydb` |
| MySQL | `mysql://user:pass@host:port/db` | `mysql://root:secret@localhost:3306/mydb` |
| SQL Server | `mssql://user:pass@host:port/db` | `mssql://sa:secret@localhost:1433/mydb` |
| Oracle | `oracle://user:pass@host:port/db` | `oracle://admin:secret@localhost:1521/mydb` |

## Cloud Database Examples

### Neon PostgreSQL
```
postgresql://user:password@ep-xxxxx.us-east-1.neon.tech/database?sslmode=require
```

### AWS RDS PostgreSQL
```
postgresql://admin:password@mydb.xxxxx.us-east-1.rds.amazonaws.com:5432/mydb?ssl=require
```

### AWS RDS MySQL
```
mysql://admin:password@mydb.xxxxx.us-east-1.rds.amazonaws.com:3306/mydb
```

### Azure SQL Database
```
mssql://adminuser:password@myserver.database.windows.net:1433/mydb
```

### Google Cloud SQL
```
postgresql://user:password@10.20.30.40:5432/mydb
mysql://user:password@10.20.30.40:3306/mydb
```

## Security Considerations

1. **Connection strings are encrypted** - Stored using AES-256-GCM encryption
2. **SSL/TLS Support** - Connection strings can include `?ssl=require` or `?sslmode=require`
3. **No logging** - Connection strings are not logged in cleartext
4. **Per-user access** - Data sources are subject to role-based access control

## Limitations

- Connection strings must be valid for the selected database type
- SQLite mode does not support connection strings (file upload only)
- Password in connection string must match the format supported by the driver
- Special characters in passwords should be URL-encoded in connection strings

## Troubleshooting

### Connection Test Fails with Valid Connection String

1. **Verify database is accessible** from this server
2. **Check SSL requirements** - Some cloud databases require SSL
3. **Verify credentials** - Test with database client tools first
4. **Check network** - Ensure firewall/security groups allow connection
5. **Try with Individual Fields** - If parsing issue, enter fields separately

### Connection String Not Being Saved

1. Click **Connection String** button (should be highlighted)
2. Ensure string is not empty
3. Check database type matches the connection string format
4. Test connection first before saving

### Mixed Fields/Connection String

If editing a data source with individual fields and switching to connection string mode:
- Individual fields are cleared to avoid confusion
- Only the connection string is sent to backend
- Can always switch back to individual fields mode

## Examples

### Create PostgreSQL Data Source with Neon

```
1. Name: "Neon Production"
2. Description: "Neon hosted PostgreSQL database"
3. Database Type: PostgreSQL
4. Click "Connection String"
5. Paste: postgresql://user:password@ep-xxxxx.us-east-1.neon.tech/mydb?sslmode=require
6. Click "Test Connection"
7. Click "Create Data Source"
```

### Create MySQL Data Source with AWS RDS

```
1. Name: "AWS RDS MySQL"
2. Description: "Production MySQL on AWS RDS"
3. Database Type: MySQL
4. Click "Connection String"
5. Paste: mysql://admin:mypassword@mydb.xxxxx.us-east-1.rds.amazonaws.com:3306/mydb
6. Click "Test Connection"
7. Click "Create Data Source"
```

### Switch Existing Data Source to Connection String

```
1. Go to Data Sources
2. Click Edit on existing data source
3. Click "Connection String" button
4. Form switches mode, showing individual fields as blanks
5. Paste your new connection string
6. Click "Test Connection"
7. Click "Update Data Source"
```

## API Details

### Create Data Source with Connection String

**POST** `/api/data-sources`

```json
{
  "name": "My Database",
  "description": "Production database",
  "clientType": "pg",
  "connectionConfig": {
    "connectionString": "postgresql://user:pass@host:5432/db?ssl=require"
  }
}
```

### Update Data Source with Connection String

**PATCH** `/api/data-sources/:id`

```json
{
  "connectionConfig": {
    "connectionString": "postgresql://user:pass@newhost:5432/db"
  }
}
```

### Test Connection with Connection String

**POST** `/api/data-sources/test`

```json
{
  "clientType": "pg",
  "connectionConfig": {
    "connectionString": "postgresql://user:pass@host:5432/db?ssl=require"
  }
}
```

## Future Enhancements

Potential improvements:
- Connection string parser with UI help/validation
- Connection string templates for common providers
- OAuth/SSO connection string support
- Encrypted connection string sharing
- Connection history/recent connections
- Connection pooling configuration
