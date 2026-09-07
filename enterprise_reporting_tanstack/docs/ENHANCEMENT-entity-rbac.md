# Enhancement: Entity Metadata Management and RBAC

## Document Information
- **Title**: Entity Metadata Management and Role-Based Access Control
- **Date**: 2025-02-20
- **Status**: Draft
- **Version**: 2.0

## Executive Summary

This enhancement extends the existing RBAC (Role-Based Access Control) system to provide granular permissions management for database entities (tables and views) imported from datasources. The feature will store entity metadata created during datasource inspection, enable permission control at the entity level, provide a dynamic form interface for managing entity metadata descriptions, and optionally allow CRUD operations on entity data based on admin-defined datasource editability settings.

**Key Features:**
1. **Metadata Registry** - Entities auto-created during datasource inspection with schema metadata
2. **Metadata Management** - Editable entity/field descriptions via TanStack Form
3. **Permission Control** - Two-tier permissions (metadata + data access via `ds_entity_permissions`)
4. **Optional Datasource Editing** - Admin-controlled CRUD interface with server-side pagination
5. **TanStack.js Integration** - TanStack Form, TanStack Table, TanStack Query on TanStack Start

## Current State Analysis

### Existing RBAC Implementation

The system currently has a two-tier RBAC structure:

1. **Application-Level RBAC** - Controls access to application resources:
   - `roles` table with permissions stored as JSON arrays
   - `resource_permissions` table for fine-grained resource permissions
   - Resource types include: `data_source`, `query`, `report`, `chart`, `dashboard`, `dashboard_widget`, `job`, `user`, `role`
   - Permission levels: `admin`, `edit`, `execute`, `view`

2. **Data Source-Level RBAC** - Controls access to database entities:
   - `ds_roles` table for data source-specific roles
   - `ds_user_roles` junction table for user assignments
   - `ds_entity_permissions` table for table/view level permissions
   - Permission levels: `select`, `insert`, `update`, `delete`, `all`

### Existing Schema Introspection

The system already has schema introspection capabilities via:
- `ds_schema_cache` table - stores introspected schema metadata
- Schema introspection functions in `src/lib/sql/schema-introspection.ts`
- Schema store in `src/lib/mastra/schema-store.ts`
- API endpoints for schema retrieval

### Gap Analysis

The current implementation has the following gaps:

1. **No Entity Metadata Registry** - Entities discovered during introspection are cached but not registered as manageable resources
2. **No Field-Level Metadata** - While schema is cached, there's no user-editable metadata for field descriptions
3. **No Metadata-Defined CRUD Interface** - No ability to edit datasource data through the application based on metadata definitions
4. **No Schema-Definer Role** - No designated role for defining which entities/fields are active and visible
5. **No Inline Data Editing** - No interface for editing entity data with proper permission enforcement

## Proposed Solution

### Overview

The solution introduces two new tables to create an **Entity Metadata Registry** that:

1. **Auto-creates** entity metadata during datasource inspection
2. **Links entities** to the application-level RBAC system for metadata management
3. **Provides metadata editing** via TanStack Form (select/update permissions only)
4. **Enables optional CRUD** on entity data based on admin-configured datasource editability
5. **Integrates with existing** `ds_entity_permissions` for data access enforcement

**Workflow:**
1. **Datasource Inspection** → Creates `metadata_entity_header` and `metadata_entity_field` records
2. **Schema Definer Role** → Updates descriptions, marks entities as active/visible using TanStack Forms
3. **Admin Config** → Optionally enables datasource editing for specific datasources
4. **End Users** → Can view/edit entity data based on `ds_entity_permissions` when datasource is editable

### Database Schema Changes

#### 1. Table: `metadata_entity_header`

Stores entity-level metadata for tables and views discovered in datasources.

```sql
CREATE TABLE metadata_entity_header (
  id STRING PRIMARY KEY,
  data_source_id STRING NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  entity_name STRING NOT NULL,              -- Table or view name (read-only)
  entity_schema STRING,                     -- Schema name (for pg, mssql) (read-only)
  entity_type STRING NOT NULL DEFAULT 'table', -- 'table' or 'view' (read-only)
  description TEXT,                         -- User-provided business description (EDITABLE)
  schema_metadata TEXT NOT NULL,            -- Complete schema info as JSON (read-only)
  is_active BOOLEAN DEFAULT FALSE,          -- Entity must be activated by schema definer (EDITABLE)
  is_hidden BOOLEAN DEFAULT TRUE,           -- Hidden by default until schema definer unhides (EDITABLE)
  last_introspected_at TIMESTAMP NOT NULL,
  created_by STRING REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(data_source_id, entity_name, entity_schema)
);
```

**Editable Fields (by Schema Definer Role):**
- `description` - Business description of the entity
- `is_active` - Whether the entity is active/available
- `is_hidden` - Whether the entity is hidden from UI listings

**Read-Only Fields:**
- `entity_name`, `entity_schema`, `entity_type` - Set during inspection
- `schema_metadata` - Auto-populated from introspection
- `last_introspected_at` - Updated on re-introspection

**Default Behavior:**
- Entities start with `is_active = FALSE` and `is_hidden = TRUE`
- Schema definer must explicitly activate and unhide entities
- UI filter allows retrieving hidden/inactive entities for management

**Indexes:**
- `idx_metadata_entity_header_ds` on `(data_source_id)`
- `idx_metadata_entity_header_entity` on `(entity_name)`
- `idx_metadata_entity_header_type` on `(entity_type)`
- `idx_metadata_entity_header_active` on `(is_active, is_hidden)` -- For filtering

**Schema Metadata JSON Structure:**
```json
{
  "tableName": "users",
  "schema": "public",
  "entityType": "table",
  "primaryKey": ["id"],
  "foreignKeys": [
    {
      "columns": ["organization_id"],
      "referencedTable": "organizations",
      "referencedColumns": ["id"]
    }
  ],
  "indexes": [
    {
      "name": "idx_users_email",
      "columns": ["email"],
      "unique": true
    }
  ]
}
```

#### 2. Table: `metadata_entity_field`

Stores field-level metadata for columns within entities.

```sql
CREATE TABLE metadata_entity_field (
  id STRING PRIMARY KEY,
  entity_header_id STRING NOT NULL REFERENCES metadata_entity_header(id) ON DELETE CASCADE,
  field_name STRING NOT NULL,               -- Column name (read-only)
  data_type STRING NOT NULL,                -- e.g., "varchar(255)", "integer" (read-only)
  is_nullable BOOLEAN,                      -- From schema inspection (read-only)
  is_primary_key BOOLEAN DEFAULT FALSE,     -- From schema inspection (read-only)
  is_foreign_key BOOLEAN DEFAULT FALSE,     -- From schema inspection (read-only)
  foreign_key_table STRING,                 -- Referenced table name (read-only)
  foreign_key_column STRING,                -- Referenced column name (read-only)
  default_value TEXT,                       -- From schema inspection (read-only)
  description TEXT,                         -- User-provided business description (EDITABLE)
  is_display_field BOOLEAN DEFAULT FALSE,   -- Mark as display field in lookups (EDITABLE)
  is_searchable BOOLEAN DEFAULT TRUE,       -- Include in search suggestions (EDITABLE)
  display_order INTEGER,                    -- UI ordering (EDITABLE - drag-and-drop)
  section_name STRING,                      -- Group fields into sections (EDITABLE)
  relationship_ui_type STRING,              -- FK UI: 'dropdown', 'popup', 'tab', or NULL (EDITABLE)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(entity_header_id, field_name)
);
```

**Editable Fields (by Schema Definer Role):**
- `description` - Business description of what the field represents
- `is_display_field` - Mark as primary display field in lookups/dropdowns (for referenced entity)
- `is_searchable` - Include in search suggestions and autocomplete
- `display_order` - Order for displaying fields in UI (drag-and-drop reordering in field management UI)
- `section_name` - Group related fields into visual sections with separators (e.g., "Contact Info", "Address", "System Fields"). Fields with same section_name are grouped together with a horizontal separator
- `relationship_ui_type` - How to render foreign key relationships (when `is_foreign_key = TRUE`):
  - `'dropdown'` - Show as dropdown with values from referenced entity using its display field
  - `'popup'` - Show as search button that opens a modal with scrollable table
  - `'tab'` - Show as tabbed master-detail interface (for line items, child records)
  - `NULL` - Auto-select based on row count (dropdown for <100 rows, popup for >=100)

**Read-Only Fields:**
- `field_name`, `data_type`, `is_nullable`, `is_primary_key`, `is_foreign_key`
- `foreign_key_table`, `foreign_key_column`, `default_value`

**Indexes:**
- `idx_metadata_entity_field_header` on `(entity_header_id)`
- `idx_metadata_entity_field_name` on `(field_name)`
- `idx_metadata_entity_field_display` on `(is_display_field)`
- `idx_metadata_entity_field_searchable` on `(is_searchable)`
- `idx_metadata_entity_field_fk` on `(is_foreign_key, foreign_key_table)`
- `idx_metadata_entity_field_section` on `(entity_header_id, section_name, display_order)` -- For section grouping

#### Foreign Key Relationship UI Configuration

When a field is a foreign key (`is_foreign_key = TRUE`), the dynamically generated form will render a relationship picker based on `relationship_ui_type`:

**Option 1: Dropdown (`'dropdown'`)**
- Displays a `<select>` dropdown with all rows from the referenced entity
- Uses the display field(s) from the referenced entity (fields marked with `is_display_field = TRUE`)
- Best for: Small to medium reference tables (< 100 rows)
- Example: Country selection, Status types, Categories

**Option 2: Popup Modal (`'popup'`)**
- Displays a button that opens a modal/popup
- Modal contains:
  - Search bar for filtering records
  - **Scrollable table with server-side pagination** using TanStack Table
  - Click to select functionality
- Uses display field(s) from referenced entity for table columns
- Best for: Large reference tables (100+ rows)
- Example: Users, Products, Customers

**Option 3: Tabbed Master-Detail Interface (`'tab'`)**
- **NEW:** Displays the foreign key relationship as a tab in the form
- Creates a master-detail form pattern where the main entity (e.g., Invoice Header) is the primary form
- The tab contains a list/grid of related child records (e.g., Invoice Line Items)
- **Behavior and Workflow:**
  - Tab starts **disabled** until the main entity is saved as draft
  - Once main entity is submitted (default status: draft), the tab becomes enabled
  - **Fetches ALL related records at once** (no server-side pagination - complete dataset)
  - Displays records ordered by **most recently modified first** (`ORDER BY modified_at DESC`)
  - Displays records in a scrollable list/table using TanStack Table
  - Clicking a record opens its edit form
  - CRUD operations (Create, Read, Update, Delete) happen within the tab
  - Changes are immediately reflected in the list
  - When the main entity is finalized/submitted, all child records are saved
- **Technical Details:**
  - Uses client-side data fetching with TanStack Query
  - All records fetched in single query: `SELECT * FROM child_table WHERE foreign_key = ? ORDER BY modified_at DESC`
  - No pagination - relies on assumption that line items are manageable in count (< 500 records typical)
  - Optimistic updates for immediate UI feedback
- **Use Cases:**
  - Invoice → Invoice Line Items
  - Order → Order Items
  - Quote → Quote Line Items
  - Shipment → Shipment Items
  - Purchase Order → PO Line Items
- **Best for:** Master-detail relationships where child records belong to a single parent
  - Typically 1-500 child records per parent
  - Child records are edited in context of parent (not standalone)

**Important:**
- The `'tab'` option is the **only** relationship_ui_type that bypasses the server-side pagination requirement
- This is because line items are managed within the context of a single parent entity
- All other options (`dropdown`, `popup`) **must** use server-side pagination

#### Field Organization: Drag-and-Drop Reordering and Section Grouping

Fields within an entity can be organized visually using two mechanisms:

**1. Drag-and-Drop Reordering**

The `display_order` field determines the sequence in which fields appear in dynamically generated forms. Instead of manually entering numbers, the field management UI provides an intuitive drag-and-drop interface:

```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

function FieldMetadataList({ entityId }: { entityId: string }) {
  const queryClient = useQueryClient()

  const { data: fields, isLoading } = useQuery({
    queryKey: ['metadata-entity-fields', entityId],
    queryFn: async () => {
      const res = await fetch(`/api/metadata/entities/${entityId}/fields`)
      return res.json()
    },
  })

  const reorderMutation = useMutation({
    mutationFn: async ({ sourceIndex, destinationIndex }: { sourceIndex: number; destinationIndex: number }) => {
      const newFields = [...fields]
      const [movedField] = newFields.splice(sourceIndex, 1)
      newFields.splice(destinationIndex, 0, movedField)

      // Update display_order based on new position
      const updates = newFields.map((field, index) => ({
        id: field.id,
        display_order: index,
      }))

      const res = await fetch(`/api/metadata/entities/${entityId}/fields/batch`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metadata-entity-fields', entityId] })
    },
  })

  const onDragEnd = (result: any) => {
    if (!result.destination) return

    reorderMutation.mutate({
      sourceIndex: result.source.index,
      destinationIndex: result.destination.index,
    })
  }

  if (isLoading) return <div>Loading...</div>

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="fields">
        {(provided) => (
          <div {...provided.droppableProps} ref={provided.innerRef}>
            {fields?.map((field, index) => (
              <Draggable key={field.id} draggableId={field.id} index={index}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className="field-item border p-3 mb-2 bg-white rounded hover:shadow-md cursor-move"
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="h-5 w-5 text-gray-400" />
                      <div className="flex-1">
                        <div className="font-medium">{field.field_name}</div>
                        <div className="text-sm text-gray-500">{field.data_type}</div>
                      </div>
                      <div className="text-sm text-gray-400">Order: {field.display_order}</div>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  )
}
```

**2. Section Grouping with Visual Separators**

The `section_name` field allows grouping related fields into logical sections with visual separators. Fields with the same `section_name` are rendered together with a horizontal line and section header:

```typescript
// Example: Section groupings for a "users" entity
[
  { field_name: 'email', section_name: 'Contact Info', display_order: 0 },
  { field_name: 'phone', section_name: 'Contact Info', display_order: 1 },
  { field_name: 'street_address', section_name: 'Address', display_order: 2 },
  { field_name: 'city', section_name: 'Address', display_order: 3 },
  { field_name: 'state', section_name: 'Address', display_order: 4 },
  { field_name: 'zip', section_name: 'Address', display_order: 5 },
  { field_name: 'created_at', section_name: 'System Fields', display_order: 6 },
  { field_name: 'updated_at', section_name: 'System Fields', display_order: 7 },
]
```

**Visual Layout in Forms:**

```
┌─────────────────────────────────────────────────────┐
│ Contact Info                                        │
├─────────────────────────────────────────────────────┤
│ Email:        [_______________________________]     │
│ Phone:        [_______________________________]     │
│                                                      │
│ Address                                             │
├─────────────────────────────────────────────────────┤
│ Street:      [_______________________________]     │
│ City:        [_______________________________]     │
│ State:       [_______________________________]     │
│ ZIP:         [_______________________________]     │
│                                                      │
│ System Fields                                       │
├─────────────────────────────────────────────────────┤
│ Created At:  [2025-02-20 10:30:00          ] (R)  │
│ Updated At:  [2025-02-21 14:45:00          ] (R)  │
└─────────────────────────────────────────────────────┘
```

**Section Grouping Component:**

```typescript
'use client'

import { useMemo } from 'react'

interface FieldGroup {
  section_name: string | null
  fields: MetadataEntityField[]
}

function GroupedFieldForm({ fields, onSubmit }: { fields: MetadataEntityField[], onSubmit: any }) {
  // Group fields by section_name
  const groupedFields = useMemo(() => {
    const groups: Record<string, MetadataEntityField[]> = {}

    fields.forEach(field => {
      const section = field.section_name || 'General'
      if (!groups[section]) {
        groups[section] = []
      }
      groups[section].push(field)
    })

    // Convert to array and sort by display_order within each section
    return Object.entries(groups)
      .map(([section_name, fields]) => ({
        section_name,
        fields: fields.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
      }))
      .sort((a, b) => {
        // Sort sections by minimum display_order of fields in section
        const aMin = Math.min(...a.fields.map(f => f.display_order ?? 0))
        const bMin = Math.min(...b.fields.map(f => f.display_order ?? 0))
        return aMin - bMin
      })
  }, [fields])

  return (
    <form onSubmit={onSubmit}>
      {groupedFields.map((group, groupIndex) => (
        <div key={groupIndex} className="mb-6">
          {/* Section Header */}
          <div className="flex items-center gap-4 mb-3">
            <h3 className="text-lg font-semibold text-foreground">
              {group.section_name}
            </h3>
            <div className="flex-1 h-px bg-border"></div>
          </div>

          {/* Fields in this section */}
          <div className="space-y-4 ml-4">
            {group.fields.map((field) => (
              <FormField key={field.id} field={field} />
            ))}
          </div>
        </div>
      ))}
    </form>
  )
}
```

**Section Management UI:**

```typescript
// Field editor with section assignment
function FieldEditor({ field, allSections, onSectionChange }: FieldEditorProps) {
  return (
    <div className="flex items-center gap-3 p-3 border rounded bg-white">
      <GripVertical className="h-5 w-5 text-gray-400 cursor-move" />

      <div className="flex-1">
        <div className="font-medium">{field.field_name}</div>
        <div className="text-sm text-gray-500">{field.data_type}</div>
      </div>

      {/* Section dropdown */}
      <select
        value={field.section_name || ''}
        onChange={(e) => onSectionChange(field.id, e.target.value || null)}
        className="border rounded px-3 py-1 text-sm"
      >
        <option value="">(No Section)</option>
        {allSections.map(section => (
          <option key={section} value={section}>{section}</option>
        ))}
        <option value="__new__">+ New Section...</option>
      </select>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={field.is_display_field}
          onChange={(e) => onDisplayFieldChange(field.id, e.target.checked)}
        />
        Display
      </label>
    </div>
  )
}
```

**Key Benefits:**

1. **Drag-and-Drop Reordering:**
   - Intuitive visual interface for field ordering
   - Automatic `display_order` updates on drop
   - Optimistic UI updates with rollback on error
   - Batch update API for efficient reordering

2. **Section Grouping:**
   - Organize related fields into logical groups
   - Visual separators with section headers
   - Improves form usability for entities with many fields
   - Optional: fields without `section_name` appear in "General" section

3. **Combined Workflow:**
   - Drag fields within or between sections
   - Drag entire sections to reorder them
   - Sections ordered by minimum `display_order` of contained fields

**Dependencies for Drag-and-Drop:**

```json
{
  "dependencies": {
    "@hello-pangea/dnd": "^16.6.0"  // Drag-and-drop library
  }
}
```

**NPM Package:**

`@hello-pangea/dnd` is a maintained fork of the popular `react-beautiful-dnd` library, providing:
- Smooth drag-and-drop animations
- TypeScript support
- Accessibility features
- Mobile touch support

### ResourceType Extension

Add new resource type to the existing `ResourceType` enum:

```typescript
export type ResourceType =
  | 'data_source'
  | 'query'
  | 'report'
  | 'chart'
  | 'filter'
  | 'dashboard'
  | 'dashboard_widget'
  | 'job'
  | 'queue'
  | 'user'
  | 'role'
  | 'ds_role'
  | 'ds_entity_permission'
  | 'nl_query'
  | 'metadata_entity';  // NEW
```

### Permission Model

#### Application-Level Metadata Permissions

For managing the metadata tables themselves, the `metadata_entity` resource type uses:

- **`view`** (select) - Can view entity/field metadata
- **`edit`** (update) - Can update entity/field descriptions and configuration
- **`admin`** - Full control including hiding/showing entities and managing permissions

**Note:** Metadata is **created** during datasource inspection. No `create` or `delete` permissions are needed for metadata records.

#### Data Access Permissions (Existing `ds_entity_permissions`)

Actual CRUD operations on entity data are controlled through the existing `ds_entity_permissions` table:

- **`select`** - Read entity data
- **`insert`** - Create new records in entity
- **`update`** - Modify existing records in entity
- **`delete`** - Delete records from entity
- **`all`** - Full CRUD access

#### Two-Tier Permission Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Request                                │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                ┌─────────────────┴─────────────────┐
                │                                     │
                ▼                                     ▼
    ┌───────────────────────┐           ┌───────────────────────┐
    │ Metadata Access       │           │ Data Access           │
    │ (resource_permissions)│           │ (ds_entity_permissions)│
    └───────────────────────┘           └───────────────────────┘
                │                                     │
                ├─► resource_type='metadata_entity'  ├─► entity_name='users'
                │   ├─► view  - See metadata         │   ├─► select - Read data
                │   ├─► edit  - Update metadata     │   ├─► insert - Create records
                │   └─► admin - Manage permissions  │   ├─► update - Edit records
                │                                     │   ├─► delete - Delete records
                │                                     │   └─► all    - Full CRUD
                │                                     │
                ▼                                     ▼
    ┌───────────────────────┐           ┌───────────────────────┐
    │ Can edit descriptions?│           │ Can edit entity data? │
    │ via TanStack Form     │           │ via CRUD Interface    │
    └───────────────────────┘           └───────────────────────┘
```

### Schema-Definer Role

A designated role ("Schema Definer" or similar) will have `edit` permissions on `metadata_entity` resources. This role is responsible for:

1. Reviewing entities discovered during inspection
2. Activating entities by setting `is_active = TRUE`
3. Unhiding entities by setting `is_hidden = FALSE`
4. Writing business descriptions for entities and fields
5. Configuring display fields and searchability
6. Setting field display order

### Optional Datasource Editing

Administrators can configure datasources as **editable**, enabling a CRUD interface for entity data:

**Configuration:**
- New column on `data_sources` table: `is_editable BOOLEAN DEFAULT FALSE`
- Only admins can modify this setting
- When enabled, entities from that datasource become editable through the UI

**CRUD Interface Features:**
1. **Entity Browser** - Searchable list of active, non-hidden entities
2. **Record List** - Server-side paginated list of entity records using TanStack Table
3. **Record Editor** - TanStack Form for editing individual records
4. **Permission Enforcement** - Respects `ds_entity_permissions` for each user
5. **Validation** - Uses metadata field definitions for validation

**Tech Stack:**
- **TanStack Table** - Server-side paginated data grids
- **TanStack Form** - Record editing with validation
- **TanStack Query** - Data fetching and caching
- **TanStack Start** - API routes and server components

### API Endpoints

#### Entity Metadata CRUD

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/metadata/entities` | List all entities user has access to (with filters) |
| GET | `/api/metadata/entities?includeHidden=true` | Include hidden/inactive entities |
| GET | `/api/metadata/entities/[id]` | Get single entity with fields |
| PUT | `/api/metadata/entities/[id]` | Update entity metadata (description, is_active, is_hidden) |
| GET | `/api/metadata/entities/[id]/fields` | List fields for an entity |
| PUT | `/api/metadata/entities/[id]/fields/[fieldId]` | Update field metadata |
| POST | `/api/metadata/entities/sync` | Trigger entity sync from datasource inspection |

#### Batch Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/api/metadata/entities/[id]/fields/batch` | Batch update field metadata |
| GET | `/api/metadata/entities/[id]/permissions` | Get permissions for entity |
| PUT | `/api/metadata/entities/[id]/permissions` | Update permissions for entity |

#### Datasource Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/data-sources/[id]/config` | Get datasource configuration |
| PUT | `/api/data-sources/[id]/config` | Update datasource (is_editable flag) |

#### Entity Data CRUD (When Datasource is Editable)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/data-sources/[dsId]/entities` | List active, non-hidden entities (searchable) |
| GET | `/api/data-sources/[dsId]/entities/[entityId]/records` | List entity records (paginated) |
| GET | `/api/data-sources/[dsId]/entities/[entityId]/records/[recordId]` | Get single record |
| POST | `/api/data-sources/[dsId]/entities/[entityId]/records` | Create new record |
| PUT | `/api/data-sources/[dsId]/entities/[entityId]/records/[recordId]` | Update record |
| DELETE | `/api/data-sources/[dsId]/entities/[entityId]/records/[recordId]` | Delete record |

### Dynamic Form Interface

The dynamic forms will be built using **TanStack Form** (https://tanstack.com/form/latest), providing:
- Type-safe form state management
- Built-in validation and error handling
- Field arrays for dynamic line-item patterns
- Framework-agnostic core with React bindings
- Optimized re-renders and minimal bundle size
- Functional field API for maximum control

The form interface will use a **line/line-item** pattern with TanStack Form's `useFieldArray` for managing dynamic field lists.

#### Entity Metadata Form

```
┌─────────────────────────────────────────────────────────┐
│ Entity Metadata: users                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Data Source: [PostgreSQL - Production DB   ] (read-only)│
│ Entity Name:   [users                       ] (read-only)│
│ Entity Type:   [Table                       ] (read-only)│
│ Schema:        [public                      ] (read-only)│
│                                                         │
│ Business Description: (EDITABLE)                        │
│ ┌─────────────────────────────────────────────────────┐│
│ │ Stores user account information including           ││
│ │ authentication and profile data.                    ││
│ │                                                     ││
│ │                                                     ││
│ └─────────────────────────────────────────────────────┘│
│                                                         │
│ Display Settings: (EDITABLE)                            │
│ [x] Active     - Entity is available for use           │
│ [ ] Hidden      - Hide from entity browser             │
│                                                         │
│ Last Introspected: 2025-02-20 10:30:15                 │
│                                                         │
│ [Cancel]                             [Save Changes]    │
└─────────────────────────────────────────────────────────┘
```

#### Field Metadata Form (Line Item Pattern)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Field Metadata: users                                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ Fields (3) - EDITABLE METADATA                                      │
│ ┌───────────────────────────────────────────────────────────────┐  │
│ │ id (integer, NOT NULL, PRIMARY KEY)                           │  │
│ │   Description: [Primary key identifier                  ]      │  │
│ │   Display:    [ ] Display field    Search: [x] Searchable     │  │
│ │   Order:      [0]                                            │  │
│ ├───────────────────────────────────────────────────────────────┤  │
│ │ email (varchar(255), NOT NULL)                                │  │
│ │   Description: [User's email address for login and   ]        │  │
│ │                [notifications. Must be unique.        ]        │  │
│ │   Display:    [x] Display field    Search: [x] Searchable     │  │
│ │   Order:      [1]                                            │  │
│ ├───────────────────────────────────────────────────────────────┤  │
│ │ display_name (varchar(100), NOT NULL)                          │  │
│ │   Description: [User's full name for display in UI    ]       │  │
│ │   Display:    [x] Display field    Search: [x] Searchable     │  │
│ │   Order:      [2]                                            │  │
│ └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│ [Save Changes]                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Editable Field Metadata:**
- **description** - Business meaning of the field
- **is_display_field** - Mark as display field for foreign key lookups
- **is_searchable** - Include in search/autocomplete
- **display_order** - Order for UI display

#### TanStack Form Implementation Details

**Entity Metadata Form Component:**

```typescript
import { useForm } from '@tanstack/react-form'

function EntityMetadataForm({ entity, onSubmit, onCancel }) {
  const form = useForm({
    defaultValues: {
      description: entity.description || '',
      is_active: entity.is_active ?? false,  // Default false
      is_hidden: entity.is_hidden ?? true,   // Default true
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })

  return (
    <form>
      <form.Field
        name="description"
        validators={{
          onChange: ({ value }) =>
            value.length > 5000 ? 'Description too long' : undefined,
        }}
      >
        {(field) => (
          <div>
            <label>Business Description</label>
            <textarea
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="Enter business description..."
              rows={6}
            />
            {field.state.meta.errors?.map(err => (
              <span className="error">{err}</span>
            ))}
          </div>
        )}
      </form.Field>

      <form.Field name="is_active">
        {(field) => (
          <label>
            <input
              type="checkbox"
              checked={field.state.value}
              onChange={(e) => field.handleChange(e.target.checked)}
            />
            Active - Entity is available for use
          </label>
        )}
      </form.Field>

      <form.Field name="is_hidden">
        {(field) => (
          <label>
            <input
              type="checkbox"
              checked={field.state.value}
              onChange={(e) => field.handleChange(e.target.checked)}
            />
            Hidden - Hide from entity browser
          </label>
        )}
      </form.Field>
    </form>
  )
}
```

**Field Metadata Form with Field Arrays:**

```typescript
import { useForm, useFieldArray } from '@tanstack/react-form'

function FieldMetadataForm({ entity, fields, onSubmit, onCancel }) {
  const form = useForm({
    defaultValues: {
      fields: fields.map((field, index) => ({
        id: field.id,
        field_name: field.field_name,     // Read-only display
        data_type: field.data_type,        // Read-only display
        is_nullable: field.is_nullable,    // Read-only display
        description: field.description || '',
        is_display_field: field.is_display_field || false,
        is_searchable: field.is_searchable !== false, // default true
        display_order: field.display_order ?? index,
        section_name: field.section_name || null,
      })),
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value)
    },
  })

  return (
    <form>
      <form.FieldArray name="fields">
        {(fieldArray) => (
          <div>
            {fieldArray.state.map((field, index) => (
              <FieldItem
                key={field.id}
                field={field}
                index={index}
              />
            ))}
          </div>
        )}
      </form.FieldArray>
    </form>
  )
}

function FieldItem({ field, index }) {
  return (
    <div key={field.id} className="field-item">
      {/* Read-only schema info header */}
      <div className="field-schema-info">
        <strong>{field.field_name}</strong>
        {' '}
        <span className="data-type">({field.data_type})</span>
        {field.is_nullable === false && <span className="required"> NOT NULL</span>}
      </div>

      {/* Editable: Description */}
      <form.Field
        name={`fields[${index}].description`}
        validators={{
          onChange: ({ value }) =>
            value.length > 1000 ? 'Description too long' : undefined,
        }}
      >
        {(field) => (
          <div>
            <label>Description</label>
            <textarea
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="Describe what this field represents..."
              rows={2}
            />
          </div>
        )}
      </form.Field>

      {/* Editable: Section, Boolean flags, and order */}
      <div className="field-settings">
        <form.Field name={`fields[${index}].section_name`}>
          {(field) => (
            <div>
              <label>Section Group</label>
              <select
                value={field.state.value ?? ''}
                onChange={(e) => field.handleChange(e.target.value || null)}
              >
                <option value="">(No Section - General)</option>
                <option value="Contact Info">Contact Info</option>
                <option value="Address">Address</option>
                <option value="System Fields">System Fields</option>
                <option value="Custom">+ Custom Section...</option>
              </select>
              <small>Group related fields into visual sections</small>
            </div>
          )}
        </form.Field>

        <form.Field name={`fields[${index}].is_display_field`}>
          {(field) => (
            <label>
              <input
                type="checkbox"
                checked={field.state.value}
                onChange={(e) => field.handleChange(e.target.checked)}
              />
              Display field
            </label>
          )}
        </form.Field>

        <form.Field name={`fields[${index}].is_searchable`}>
          {(field) => (
            <label>
              <input
                type="checkbox"
                checked={field.state.value}
                onChange={(e) => field.handleChange(e.target.checked)}
              />
              Searchable
            </label>
          )}
        </form.Field>

        <form.Field name={`fields[${index}].display_order`}>
          {(field) => (
            <div>
              <label>Display Order</label>
              <input
                type="number"
                value={field.state.value}
                onChange={(e) => field.handleChange(parseInt(e.target.value) || 0)}
                min={0}
              />
              <small>Use drag-and-drop in list view to reorder</small>
            </div>
          )}
        </form.Field>
      </div>
    </div>
  )
}
```

**Batch Update with TanStack Form:**

```typescript
// For bulk operations, TanStack Form handles nested arrays efficiently
async function handleBatchUpdate({ value }) {
  const updates = value.fields.filter(f => f.modified)

  await fetch(`/api/metadata/entities/${entityId}/fields/batch`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  })
}
```

**Form Validation Strategy:**

```typescript
// Field-level validation
<form.Field
  name="description"
  validators={{
    onChange: ({ value }) => {
      if (!value) return 'Description is required'
      if (value.length > 5000) return 'Description too long (max 5000)'
    },
  }}
>

// Form-level validation
const form = useForm({
  onSubmit: async ({ value }) => {
    // At least one field must be marked as display field
    const hasDisplayField = value.fields.some(f => f.is_display_field)
    if (!hasDisplayField) {
      throw new Error('At least one field must be marked as display field')
    }
  },
})
```

**TanStack Form Features Utilized:**

| Feature | Usage |
|---------|-------|
| `useForm` | Root form state management |
| `useFieldArray` | Dynamic field list management |
| Functional field API | Type-safe field access |
| Validators | Field and form-level validation |
| `onChange` validation | Real-time feedback |
| Dirty tracking | Only send modified fields |
| Type inference | Full TypeScript support |

**TanStack Form + Zod Integration (Optional):**

For enhanced validation, Zod schemas can be integrated with TanStack Form:

```typescript
import { z } from 'zod'
import { useForm } from '@tanstack/react-form'
import { zodValidator } from '@tanstack/zod-form-adapter'

// Define Zod schema
const entityMetadataSchema = z.object({
  description: z.string().max(5000).optional(),
  is_hidden: z.boolean().default(false),
})

const fieldMetadataSchema = z.object({
  description: z.string().max(1000).optional(),
  is_display_field: z.boolean(),
  is_searchable: z.boolean(),
  display_order: z.number().int().min(0),
})

// Use with TanStack Form
const form = useForm({
  defaultValues: { ... },
  validatorAdapter: zodValidator(), // Enable Zod integration
  onSubmit: async ({ value }) => { ... },
})
```

### CRUD Interface for Entity Data (Optional Feature)

When a datasource is configured as editable (`is_editable = TRUE`), users with appropriate `ds_entity_permissions` can create, read, update, and delete entity records through a web interface.

**Tech Stack:**
- **TanStack Table** (`@tanstack/react-table`) - Server-side paginated data grid
- **TanStack Query** (`@tanstack/react-query`) - Data fetching, caching, synchronization
- **TanStack Form** (`@tanstack/react-form`) - Record editing
- **TanStack Start** - App Router, Server Components, API Routes

#### 1. Entity Browser Component

Searchable list of active, non-hidden entities:

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'

function EntityBrowser({ dataSourceId }: { dataSourceId: string }) {
  const { data: entities, isLoading } = useQuery({
    queryKey: ['datasources', dataSourceId, 'entities'],
    queryFn: () => fetch(`/api/data-sources/${dataSourceId}/entities`)
      .then(res => res.json())
  })

  const [search, setSearch] = useState('')

  const filteredEntities = entities?.filter(e =>
    e.is_active && !e.is_hidden &&
    (e.entity_name.toLowerCase().includes(search.toLowerCase()) ||
     e.description?.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div>
      <input
        type="search"
        placeholder="Search entities..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ul>
        {filteredEntities?.map(entity => (
          <li key={entity.id}>
            <Link href={`/data-sources/${dataSourceId}/entities/${entity.id}`}>
              {entity.entity_name} - {entity.description}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

#### 2. Record List with TanStack Table (Server-Side Pagination)

```typescript
'use client'

import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  createColumnHelper,
} from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'

function RecordList({
  dataSourceId,
  entityId,
  metadata,
}: {
  dataSourceId: string
  entityId: string
  metadata: MetadataEntityWithFields
}) {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 })
  const [sorting, setSorting] = useState([])

  // Fetch paginated data
  const { data, isLoading } = useQuery({
    queryKey: ['records', dataSourceId, entityId, pagination, sorting],
    queryFn: () => fetch(
      `/api/data-sources/${dataSourceId}/entities/${entityId}/records?` +
      `page=${pagination.pageIndex + 1}&limit=${pagination.pageSize}&` +
      `sort=${sorting[0]?.id}&order=${sorting[0]?.desc ? 'desc' : 'asc'}`
    ).then(res => res.json()),
  })

  // Define columns from metadata
  const columnHelper = createColumnHelper<Record<string, unknown>>()
  const columns = metadata.fields
    .filter(f => f.display_order !== undefined)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map(field =>
      columnHelper.accessor(field.field_name, {
        id: field.field_name,
        header: field.field_name,
        cell: info => info.getValue() ?? 'NULL',
        meta: {
          description: field.description,
          dataType: field.data_type,
        },
      })
    )

  // Add actions column
  columns.push(
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Link href={`/data-sources/${dataSourceId}/entities/${entityId}/records/${row.original.id}`}>
          Edit
        </Link>
      ),
    })
  )

  const table = useReactTable({
    data: data?.records ?? [],
    columns,
    pageCount: data?.pageCount ?? 0,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div>
      <table>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th key={header.id}>
                  <button
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? ''}
                  </button>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr
              key={row.id}
              onClick={() => window.location.href = `/data-sources/${dataSourceId}/entities/${entityId}/records/${row.original.id}`}
              style={{ cursor: 'pointer' }}
            >
              {row.getVisibleCells().map(cell => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pagination">
        <button onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
          {'<<'}
        </button>
        <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          {'<'}
        </button>
        <span>
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          {'>'}
        </button>
        <button onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
          {'>>'}
        </button>
      </div>
    </div>
  )
}
```

#### 3. Record Editor with TanStack Form

```typescript
'use client'

import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery } from '@tanstack/react-query'

function RecordEditor({
  dataSourceId,
  entityId,
  recordId,
  metadata,
}: {
  dataSourceId: string
  entityId: string
  recordId?: string
  metadata: MetadataEntityWithFields
}) {
  // Fetch existing record for editing
  const { data: record } = useQuery({
    queryKey: ['record', dataSourceId, entityId, recordId],
    queryFn: () => recordId
      ? fetch(`/api/data-sources/${dataSourceId}/entities/${entityId}/records/${recordId}`)
          .then(res => res.json())
      : Promise.resolve({}),
    enabled: !!recordId,
  })

  const form = useForm({
    defaultValues: metadata.fields.reduce((acc, field) => {
      acc[field.field_name] = record?.[field.field_name] ?? null
      return acc
    }, {} as Record<string, unknown>),
    onSubmit: async ({ value }) => {
      if (recordId) {
        await updateMutation.mutateAsync(value)
      } else {
        await createMutation.mutateAsync(value)
      }
    },
  })

  const createMutation = useMutation({
    mutationFn: (data) => fetch(
      `/api/data-sources/${dataSourceId}/entities/${entityId}/records`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries(['records', dataSourceId, entityId])
      // Navigate back to list
      router.push(`/data-sources/${dataSourceId}/entities/${entityId}`)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data) => fetch(
      `/api/data-sources/${dataSourceId}/entities/${entityId}/records/${recordId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    ),
    onSuccess: () => {
      queryClient.invalidateQueries(['record', dataSourceId, entityId, recordId])
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <h2>{recordId ? 'Edit Record' : 'New Record'}</h2>

      {metadata.fields
        .filter(f => f.display_order !== undefined)
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map(field => (
          <form.Field
            key={field.id}
            name={field.field_name}
            validators={{
              onChange: ({ value }) => {
                if (!field.is_nullable && value === null) {
                  return `${field.field_name} is required`
                }
                // Add type-specific validation based on field.data_type
              },
            }}
          >
            {(field) => (
              <div>
                <label>
                  {field.field_name}
                  {field.is_nullable === false && <span className="required">*</span>}
                  {field.description && <span className="help"> - {field.description}</span>}
                </label>

                {/* Render input based on data type */}
                {field.is_foreign_key ? (
                  <RelationshipPicker
                    field={field}
                    dataSourceId={dataSourceId}
                    value={field.state.value}
                    onChange={field.handleChange}
                  />
                ) : field.data_type.includes('text') || field.data_type.includes('varchar') ? (
                  <input
                    type="text"
                    value={field.state.value as string ?? ''}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                ) : field.data_type.includes('int') || field.data_type.includes('number') ? (
                  <input
                    type="number"
                    value={field.state.value as number ?? ''}
                    onChange={(e) => field.handleChange(parseFloat(e.target.value))}
                  />
                ) : field.data_type.includes('bool') ? (
                  <input
                    type="checkbox"
                    checked={field.state.value as boolean ?? false}
                    onChange={(e) => field.handleChange(e.target.checked)}
                  />
                ) : (
                  <textarea
                    value={String(field.state.value ?? '')}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}

                {field.state.meta.errors?.map(err => (
                  <span className="error">{err}</span>
                ))}
              </div>
            )}
          </form.Field>
        ))}

      <button type="submit">
        {createMutation.isPending || updateMutation.isPending
          ? 'Saving...'
          : recordId ? 'Update' : 'Create'}
      </button>
      <button type="button" onClick={() => router.back()}>
        Cancel
      </button>

      {recordId && (
        <DeleteButton
          dataSourceId={dataSourceId}
          entityId={entityId}
          recordId={recordId}
        />
      )}
    </form>
  )
}
```

#### 4. Relationship Picker Component (Foreign Key Selection)

The `RelationshipPicker` component renders either a dropdown or popup modal based on `relationship_ui_type`:

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  createColumnHelper,
} from '@tanstack/react-table'

interface RelationshipPickerProps {
  field: {
    is_foreign_key: boolean
    foreign_key_table?: string
    foreign_key_column?: string
    relationship_ui_type?: 'dropdown' | 'popup' | null
  }
  dataSourceId: string
  value: unknown
  onChange: (value: unknown) => void
}

function RelationshipPicker({
  field,
  dataSourceId,
  value,
  onChange,
}: RelationshipPickerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 })

  // Fetch metadata for referenced entity to get display fields
  const { data: refEntity } = useQuery({
    queryKey: ['metadata-entity', dataSourceId, field.foreign_key_table],
    queryFn: () => fetch(
      `/api/metadata/entities/by-name?dataSourceId=${dataSourceId}&entityName=${field.foreign_key_table}`
    ).then(res => res.json()),
    enabled: !!field.foreign_key_table,
  })

  // Fetch records from referenced entity with SERVER-SIDE pagination
  const { data: refRecords, isLoading } = useQuery({
    queryKey: ['records', dataSourceId, field.foreign_key_table, searchQuery, pagination],
    queryFn: () => fetch(
      `/api/data-sources/${dataSourceId}/entities/${refEntity?.id}/records?` +
      `search=${encodeURIComponent(searchQuery)}&` +
      `page=${pagination.pageIndex + 1}&limit=${pagination.pageSize}`
    ).then(res => res.json()),
    enabled: !!refEntity && isModalOpen,
  })

  // Determine display fields (fields marked with is_display_field = TRUE)
  const displayFields = refEntity?.fields?.filter((f: MetadataEntityField) => f.is_display_field) ?? []

  // Get display text for a record
  const getDisplayText = (record: Record<string, unknown>) => {
    if (displayFields.length === 0) return String(record[field.foreign_key_column!] ?? '')
    return displayFields
      .map((f: MetadataEntityField) => String(record[f.field_name] ?? ''))
      .join(' - ')
  }

  // Auto-detect UI type if not specified
  const uiType = field.relationship_ui_type ??
    (refRecords?.totalRecords ?? 0) >= 100 ? 'popup' : 'dropdown'

  // Dropdown implementation (with server-side fetch, client-side pagination)
  if (uiType === 'dropdown') {
    return (
      <select
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
      >
        <option value="">-- Select --</option>
        {refRecords?.records?.map((record: Record<string, unknown>) => (
          <option
            key={String(record.id)}
            value={String(record[field.foreign_key_column!])}
          >
            {getDisplayText(record)}
          </option>
        ))}
      </select>
    )
  }

  // Popup implementation with SERVER-SIDE pagination using TanStack Table
  const columnHelper = createColumnHelper<Record<string, unknown>>()
  const columns = displayFields.map(df =>
    columnHelper.accessor(df.field_name, {
      id: df.field_name,
      header: df.field_name,
      cell: info => String(info.getValue() ?? ''),
    })
  )

  const table = useReactTable({
    data: refRecords?.records ?? [],
    columns,
    pageCount: refRecords?.pageCount ?? 0,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div className="relationship-picker-popup">
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="select-relationship-button"
      >
        {value ? 'Selected' : 'Select'} {field.foreign_key_table}
      </button>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select {field.foreign_key_table}</h3>
              <button onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            {/* Search bar */}
            <div className="search-bar">
              <input
                type="search"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPagination({ pageIndex: 0, pageSize: 20 })
                }}
                autoFocus
              />
            </div>

            {/* Results table with SERVER-SIDE pagination */}
            <div className="modal-body">
              {isLoading ? (
                <div>Loading...</div>
              ) : (
                <>
                  <table className="relationship-table">
                    <thead>
                      {table.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map(header => (
                            <th key={header.id}>
                              {header.column.columnDef.header?.toString()}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {table.getRowModel().rows.map(row => (
                        <tr
                          key={row.id}
                          onClick={() => {
                            onChange(row.original[field.foreign_key_column!])
                            setIsModalOpen(false)
                          }}
                          className={String(value) === String(row.original[field.foreign_key_column!]) ? 'selected' : ''}
                        >
                          {row.getVisibleCells().map(cell => (
                            <td key={cell.id}>
                              {String(cell.getValue() ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Server-side pagination controls */}
                  {table.getPageCount() > 1 && (
                    <div className="pagination">
                      <button
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                      >
                        {'<<'}
                      </button>
                      <button
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                      >
                        {'<'}
                      </button>
                      <span>
                        Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                      </span>
                      <button
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                      >
                        {'>'}
                      </button>
                      <button
                        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                        disabled={!table.getCanNextPage()}
                      >
                        {'>>'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer">
              <button onClick={() => setIsModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Display current selection */}
      {value && (
        <div className="current-selection">
          {value && refRecords?.records && (
            <div className="current-selection">
              Selected: {getDisplayText(
                refRecords.records.find((r: Record<string, unknown>) =>
                  String(r[field.foreign_key_column!]) === String(value)
                ) ?? {}
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

**Styling for Relationship Picker Modal:**

```css
/* Relationship Picker Styles */
.relationship-picker-popup {
  position: relative;
}

.select-relationship-button {
  padding: 8px 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  min-width: 200px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #eee;
}

.modal-body {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.search-bar {
  padding: 16px;
  border-bottom: 1px solid #eee;
}

.search-bar input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.relationship-table {
  width: 100%;
  border-collapse: collapse;
}

.relationship-table th,
.relationship-table td {
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.relationship-table tbody tr {
  cursor: pointer;
}

.relationship-table tbody tr:hover {
  background: #f5f5f5;
}

.relationship-table tbody tr.selected {
  background: #e3f2fd;
}

.modal-footer {
  padding: 16px;
  border-top: 1px solid #eee;
  text-align: right;
}

.current-selection {
  margin-top: 8px;
  font-size: 0.9em;
  color: #666;
}
```

**Field Metadata Form Updates (for relationship_ui_type):**

```typescript
// In FieldMetadataForm - add relationship_ui_type field
function FieldItem({ field, index }) {
  return (
    <div key={field.id} className="field-item">
      {/* Read-only schema info header */}
      <div className="field-schema-info">
        <strong>{field.field_name}</strong>
        {' '}
        <span className="data-type">({field.data_type})</span>
        {field.is_nullable === false && <span className="required"> NOT NULL</span>}
        {field.is_foreign_key && <span className="fk-indicator"> → {field.foreign_key_table}</span>}
      </div>

      {/* Editable: Description */}
      <form.Field
        name={`fields[${index}].description`}
        validators={{
          onChange: ({ value }) =>
            value.length > 1000 ? 'Description too long' : undefined,
        }}
      >
        {(field) => (
          <div>
            <label>Description</label>
            <textarea
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="Describe what this field represents..."
              rows={2}
            />
          </div>
        )}
      </form.Field>

      {/* Foreign Key UI Type (only for FK fields) */}
      {field.is_foreign_key && (
        <form.Field name={`fields[${index}].relationship_ui_type`}>
          {(field) => (
            <div>
              <label>Relationship UI Type</label>
              <select
                value={field.state.value ?? ''}
                onChange={(e) => field.handleChange(e.target.value || null)}
              >
                <option value="">Auto-detect (based on row count)</option>
                <option value="dropdown">Dropdown</option>
                <option value="popup">Popup Modal</option>
                <option value="tab">Tab (Master-Detail)</option>
              </select>
              <small>
                Dropdown for small lists, Popup for large tables (100+ rows), Tab for line items/master-detail forms
              </small>
            </div>
          )}
        </form.Field>
      )}

      {/* Editable: Section, Boolean flags, and order */}
      <div className="field-settings">
        <form.Field name={`fields[${index}].section_name`}>
          {(field) => (
            <div>
              <label>Section Group</label>
              <select
                value={field.state.value ?? ''}
                onChange={(e) => field.handleChange(e.target.value || null)}
              >
                <option value="">(No Section - General)</option>
                <option value="Contact Info">Contact Info</option>
                <option value="Address">Address</option>
                <option value="System Fields">System Fields</option>
                <option value="Custom">+ Custom Section...</option>
              </select>
              <small>Group related fields into visual sections</small>
            </div>
          )}
        </form.Field>

        <form.Field name={`fields[${index}].is_display_field`}>
          {(field) => (
            <label>
              <input
                type="checkbox"
                checked={field.state.value}
                onChange={(e) => field.handleChange(e.target.checked)}
              />
              Display field
            </label>
          )}
        </form.Field>

        <form.Field name={`fields[${index}].is_searchable`}>
          {(field) => (
            <label>
              <input
                type="checkbox"
                checked={field.state.value}
                onChange={(e) => field.handleChange(e.target.checked)}
              />
              Searchable
            </label>
          )}
        </form.Field>

        <form.Field name={`fields[${index}].display_order`}>
          {(field) => (
            <div>
              <label>Display Order</label>
              <input
                type="number"
                value={field.state.value}
                onChange={(e) => field.handleChange(parseInt(e.target.value) || 0)}
                min={0}
              />
              <small>Use drag-and-drop in list view to reorder</small>
            </div>
          )}
        </form.Field>
      </div>
    </div>
  )
}
```

#### Tabbed Master-Detail Interface Component (`'tab'`)

When `relationship_ui_type = 'tab'`, the form renders a tabbed master-detail interface for managing line items and child records:

```typescript
'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
} from '@tanstack/react-table'
import { Plus, Edit, Trash2, Save } from 'lucide-react'

interface TabbedDetailProps {
  parentEntityId: string
  childEntityName: string  // e.g., 'invoice_lines'
  parentField: string      // e.g., 'invoice_id'
  childFields: MetadataEntityField[]
  isTabEnabled: boolean    // Enabled only after parent is saved as draft
}

export function TabbedDetailInterface({
  parentEntityId,
  childEntityName,
  parentField,
  childFields,
  isTabEnabled,
}: TabbedDetailProps) {
  const queryClient = useQueryClient()
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  // Fetch ALL line items in one query (no pagination)
  const { data: lineItems, isLoading } = useQuery({
    queryKey: ['line-items', parentEntityId, childEntityName],
    queryFn: async () => {
      const res = await fetch(
        `/api/data-sources/[dsId]/entities/${childEntityName}/records?${parentField}=${parentEntityId}`
      )
      if (!res.ok) throw new Error('Failed to fetch line items')
      const data = await res.json()
      return data.records || []
    },
    enabled: isTabEnabled && !!parentEntityId,
    // No pagination - fetch all records at once
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (lineItemId: string) => {
      const res = await fetch(
        `/api/data-sources/[dsId]/entities/${childEntityName}/records/${lineItemId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error('Failed to delete line item')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['line-items', parentEntityId, childEntityName] })
    },
  })

  // Define columns from child entity metadata
  const columnHelper = createColumnHelper<any>()
  const columns = childFields
    .filter(f => f.display_order !== undefined)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map(field =>
      columnHelper.accessor(field.field_name, {
        id: field.field_name,
        header: field.field_name,
        cell: info => info.getValue()?.toString() ?? '',
      })
    )

  // Add actions column
  columns.push(
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedLineId(row.original.id)}
            className="text-blue-600 hover:underline"
          >
            Edit
          </button>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete this item?')) {
                deleteMutation.mutate(row.original.id)
              }
            }}
            className="text-red-600 hover:underline"
            disabled={deleteMutation.isPending}
          >
            Delete
          </button>
        </div>
      ),
    })
  )

  const table = useReactTable({
    data: lineItems ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 50, // Client-side pagination (all data already loaded)
      },
    },
  })

  // If creating new line item
  if (isCreating) {
    return (
      <div className="p-4 border rounded-lg">
        <LineItemForm
          fields={childFields}
          parentId={parentEntityId}
          parentField={parentField}
          onSave={(data) => {
            // Create new line item
            fetch(`/api/data-sources/[dsId]/entities/${childEntityName}/records`, {
              method: 'POST',
              body: JSON.stringify({ ...data, [parentField]: parentEntityId }),
            }).then(() => {
              queryClient.invalidateQueries({ queryKey: ['line-items', parentEntityId, childEntityName] })
              setIsCreating(false)
            })
          }}
          onCancel={() => setIsCreating(false)}
        />
      </div>
    )
  }

  // If editing existing line item
  if (selectedLineId) {
    const selectedItem = lineItems?.find(item => item.id === selectedLineId)
    return (
      <div className="p-4 border rounded-lg">
        <LineItemForm
          fields={childFields}
          lineItem={selectedItem}
          onSave={(data) => {
            // Update line item
            fetch(`/api/data-sources/[dsId]/entities/${childEntityName}/records/${selectedLineId}`, {
              method: 'PUT',
              body: JSON.stringify(data),
            }).then(() => {
              queryClient.invalidateQueries({ queryKey: ['line-items', parentEntityId, childEntityName] })
              setSelectedLineId(null)
            })
          }}
          onCancel={() => setSelectedLineId(null)}
        />
      </div>
    )
  }

  return (
    <div className="p-4">
      {!isTabEnabled ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
          <p className="font-medium">Tab Disabled</p>
          <p className="text-sm mt-1">
            Save the main entity as draft first to enable line item management.
          </p>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              {childEntityName} ({lineItems?.length ?? 0} items)
            </h3>
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Add Line Item
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
              <p className="mt-2 text-sm text-muted-foreground">Loading line items...</p>
            </div>
          ) : lineItems && lineItems.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th key={header.id} className="px-4 py-2 text-left text-sm font-medium">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map(row => (
                    <tr
                      key={row.id}
                      className="border-t hover:bg-muted/50 cursor-pointer"
                      onClick={() => setSelectedLineId(row.original.id)}
                    >
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-4 py-2 text-sm">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Client-side pagination controls (if needed for long lists) */}
              {table.getPageCount() > 1 && (
                <div className="flex justify-center gap-2 p-4 border-t">
                  <button
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                  >
                    {'<<'}
                  </button>
                  <button
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    {'<'}
                  </button>
                  <span>
                    Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                  </span>
                  <button
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    {'>'}
                  </button>
                  <button
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                  >
                    {'>>'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 border rounded-lg bg-muted/20">
              <p className="text-muted-foreground">No line items yet. Click "Add Line Item" to create one.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

**Key Features of the Tabbed Interface:**

1. **Disabled Until Parent Saved** - Tab is inactive until main entity (e.g., Invoice) is submitted as draft
2. **No Server-Side Pagination** - All child records fetched in single query (`WHERE parent_id = ?`)
3. **Client-Side CRUD** - Create, Update, Delete operations happen immediately with optimistic updates
4. **Inline Editing** - Click any row to edit it in place within the tab
5. **Real-time Updates** - Changes immediately reflected in the list
6. **Parent Context** - Child records are always associated with their parent entity

**Usage Example (Invoice with Line Items):**

```typescript
// In the main Invoice form component
import { TabbedDetailInterface } from '@/components/metadata/crud/TabbedDetailInterface'

function InvoiceForm({ invoice }: { invoice?: Invoice }) {
  const [isDraft, setIsDraft] = useState(invoice?.status === 'draft')
  const [invoiceId, setInvoiceId] = useState(invoice?.id)

  const handleSubmit = async (data) => {
    const savedInvoice = await saveInvoice(data)
    setInvoiceId(savedInvoice.id)
    setIsDraft(true) // This enables the line items tab
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Invoice header fields */}
      <InvoiceHeaderFields invoice={invoice} />

      {/* Line Items Tab - only enabled when draft */}
      <TabbedDetailInterface
        parentEntityId={invoiceId}
        childEntityName="invoice_lines"
        parentField="invoice_id"
        childFields={lineItemFields}
        isTabEnabled={isDraft}
      />

      <button type="submit">Save as Draft</button>
    </form>
  )
}
```

### Integration with Datasource Inspection

The datasource inspection process will be enhanced to:

1. **On Initial Introspection:**
   - Create or update `metadata_entity_header` records for discovered entities
   - Create or update `metadata_entity_field` records for discovered columns
   - Store complete schema metadata in `schema_metadata` JSON field
   - Set `last_introspected_at` timestamp

2. **On Re-introspection:**
   - Update `schema_metadata` with latest schema
   - Add new fields to `metadata_entity_field`
   - Mark removed fields as inactive (soft delete)
   - Preserve user-provided descriptions
   - Update `last_introspected_at` timestamp

3. **Schema Change Detection:**
   - Compare schema metadata with previous version
   - Flag changes for review (added/removed columns, type changes)
   - Maintain audit trail of schema evolution

### Permission Enforcement Flow

```
User Request
     │
     ├─> Check Application Permission (resource_permissions)
     │   └─> resource_type='metadata_entity', resource_id=entity_id
     │       ├─> 'view'  - Can view entity metadata
     │       ├─> 'edit'  - Can update descriptions
     │       └─> 'admin' - Can manage permissions
     │
     └─> Check Data Source Permission (ds_entity_permissions)
         └─> entity_name, entity_schema
             └─> 'select' permission required for data access
```

### TypeScript Types

```typescript
// Metadata Entity Header
export interface MetadataEntityHeader {
  id: string;
  data_source_id: string;
  entity_name: string;
  entity_schema?: string;
  entity_type: 'table' | 'view';
  description?: string;
  schema_metadata: string; // JSON
  is_active: boolean;
  is_hidden: boolean;
  last_introspected_at: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Metadata Entity Field
export interface MetadataEntityField {
  id: string;
  entity_header_id: string;
  field_name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  foreign_key_table?: string;
  foreign_key_column?: string;
  default_value?: string;
  description?: string;
  is_display_field: boolean;
  is_searchable: boolean;
  display_order?: number;
  section_name?: string | null;  // NEW - Group fields into visual sections
  relationship_ui_type?: 'dropdown' | 'popup' | 'tab' | null;  // FK UI configuration
  created_at: string;
  updated_at: string;
}

// Entity with Fields (API response)
export interface MetadataEntityWithFields extends MetadataEntityHeader {
  fields: MetadataEntityField[];
  data_source_name?: string;
  permissions?: ResourcePermission[];
}

// Schema metadata structure
export interface EntitySchemaMetadata {
  tableName: string;
  schema?: string;
  entityType: 'table' | 'view';
  primaryKey?: string[];
  foreignKeys?: Array<{
    columns: string[];
    referencedTable: string;
    referencedColumns: string[];
  }>;
  indexes?: Array<{
    name: string;
    columns: string[];
    unique: boolean;
  }>;
}
```

## Implementation Plan

### Phase 1: Database Migration
1. Create migration file for new tables
2. Add indexes for performance
3. Add foreign key constraints

### Phase 2: Backend Implementation
1. Update TypeScript types in `src/types/database.ts`
2. Create metadata service functions in `src/lib/metadata/`
3. Implement API route handlers
4. Integrate with schema introspection
5. Add permission checking

### Phase 3: Frontend Implementation
1. Install and configure TanStack packages (`@tanstack/react-form`, `@tanstack/react-table`, `@tanstack/react-query`)
2. Create entity metadata pages
3. Build TanStack Form components with field arrays
4. Implement field list with line-item pattern using `useFieldArray`
5. Add validation using TanStack Form validators
6. Add permission management UI
7. Build CRUD interface components (EntityBrowser, RecordList, RecordEditor)
8. Integrate with existing navigation

### Phase 4: CRUD Interface Implementation (Optional)
1. Add `is_editable` column to `data_sources` table
2. Create entity browser with search
3. Build record list with TanStack Table (server-side pagination)
4. Implement record editor with TanStack Form
5. Add delete functionality with confirmation
6. Integrate permission enforcement

### Phase 5: Integration & Testing
1. Test datasource inspection sync
2. Test permission enforcement
3. Test metadata CRUD operations
4. Test CRUD operations on entity data (if enabled)
5. Test concurrent updates
6. Performance testing with large schemas

## File Structure

```
src/
├── types/
│   └── database.ts                          # Updated with new types
├── lib/
│   └── metadata/
│       ├── entity-service.ts                # Entity CRUD operations
│       ├── field-service.ts                 # Field CRUD operations
│       ├── sync-service.ts                  # Datasource sync integration
│       ├── data-service.ts                  # Entity data CRUD service
│       └── permissions.ts                   # Permission helpers
├── app/
│   ├── api/
│   │   └── metadata/
│   │       ├── entities/
│   │       │   ├── route.ts                 # List entities
│   │       │   └── [id]/
│   │       │       ├── route.ts             # Get/Update entity
│   │       │       ├── fields/
│   │       │       │   ├── route.ts         # List fields
│   │       │       │   └── [fieldId]/
│   │       │       │       └── route.ts     # Update field
│   │       │       │   └── batch/
│   │       │       │       └── route.ts     # Batch update
│   │       │       ├── permissions/
│   │       │       │   └── route.ts         # Manage permissions
│   │       │       └── sync/
│   │       │           └── route.ts         # Trigger sync
│   │       └── data-sources/
│   │           └── [dsId]/
│   │               ├── config/
│   │               │   └── route.ts         # Get/Update datasource config
│   │               ├── entities/
│   │               │   └── route.ts         # List entities (for CRUD)
│   │               └── entities/
│   │                   └── [entityId]/
│   │                       └── records/
│   │                           ├── route.ts     # List records (paginated)
│   │                           └── [recordId]/
│   │                               └── route.ts # CRUD single record
│   └── data-sources/
│       └── [dsId]/
│           └── entities/
│             ├── page.tsx                    # Entity browser
│             └── [entityId]/
│                 ├── page.tsx                # Record list
│                 └── records/
│                   ├── new/page.tsx          # Create new record
│                   └── [recordId]/
│                       └── page.tsx          # Edit record
└── components/
    └── metadata/
        ├── entity-list.tsx                  # List of entities
        ├── entity-detail.tsx                # Entity metadata form
        ├── field-list.tsx                   # Fields with line-item UI
        ├── field-editor.tsx                 # Individual field editor
        ├── forms/
        │   ├── EntityMetadataForm.tsx      # TanStack Form for entity
        │   ├── FieldMetadataForm.tsx       # TanStack Form with field arrays
        │   ├── RelationshipPicker.tsx      # FK dropdown/popup selector
        │   └── validation.ts               # Form validation schemas
        ├── crud/
        │   ├── EntityBrowser.tsx           # Searchable entity list
        │   ├── RecordList.tsx              # TanStack Table with pagination
        │   └── RecordEditor.tsx            # TanStack Form for record CRUD
        └── permission-manager.tsx           # Permission management
```

## Security Considerations

1. **Permission Checks:** All API endpoints must verify user permissions (both metadata and data access)
2. **Audit Logging:** All metadata changes and data CRUD operations logged to `audit_log` table
3. **Input Validation:** Strict validation on schema metadata JSON and user input
4. **SQL Injection:** Use parameterized queries for all database operations
5. **Data Isolation:** Users can only view/update entities and records they have permissions for
6. **CRUD Safety:** Datasource editing is opt-in (`is_editable = FALSE` by default)
7. **Permission Enforcement:** Entity data CRUD respects `ds_entity_permissions`

## Migration Strategy

1. **Initial Data Migration:** Run sync for all existing datasources
2. **Backward Compatibility:** Existing features continue to work
3. **Gradual Rollout:** Feature can be enabled per datasource
4. **Rollback Plan:** Migration includes down() function

## Success Criteria

**Metadata Management:**
- [ ] Entities from datasources automatically synced to metadata tables during inspection
- [ ] Entities start with `is_active = FALSE` and `is_hidden = TRUE` by default
- [ ] Schema definer role can update entity/field descriptions via TanStack Form
- [ ] Form validation provides real-time feedback
- [ ] Field arrays handle 100+ fields efficiently
- [ ] Permission enforcement prevents unauthorized metadata access
- [ ] Schema changes detected and synced on re-introspection
- [ ] Audit trail maintained for all metadata changes
- [ ] TanStack Form dirty tracking optimizes batch updates
- [ ] Performance acceptable for large schemas (1000+ fields)

**CRUD Interface (Optional):**
- [ ] Admin can configure datasources as editable
- [ ] Entity browser shows active, non-hidden entities with search
- [ ] Record list uses TanStack Table with server-side pagination
- [ ] Record editor uses TanStack Form with validation
- [ ] CRUD operations respect `ds_entity_permissions`
- [ ] Delete operations require confirmation
- [ ] Foreign key lookups use display field from metadata

**Foreign Key Relationship UI:**
- [ ] Foreign key fields detect relationship during schema inspection
- [ ] Schema definer can configure `relationship_ui_type` (dropdown/popup/tab/auto)
- [ ] Dropdown uses display fields from referenced entity
- [ ] Popup shows searchable table with scrollable results
- [ ] Tab interface displays master-detail forms with line items
- [ ] Display fields are configurable via `is_display_field` flag
- [ ] Auto-detect mode switches based on row count (100 threshold)

**Field Organization:**
- [ ] Fields can be reordered using drag-and-drop interface
- [ ] Drag-and-drop updates `display_order` automatically via batch API
- [ ] Fields can be grouped into sections using `section_name` field
- [ ] Section groups render with visual separators in forms
- [ ] Fields without sections appear in "General" section
- [ ] Section dropdown includes common section names + custom option
- [ ] Sections ordered by minimum `display_order` of contained fields

## Open Questions

1. Should we support entity versioning for schema change history?
2. Should descriptions support markdown formatting?
3. Should we support custom tags/categories on entities?
4. Should there be bulk import/export of descriptions?
5. How should we handle deleted entities (soft delete vs hard delete)?

## Dependencies

- Existing datasource inspection system
- Existing RBAC system
- Existing audit logging
- **TanStack.js Ecosystem:**
  - `@tanstack/react-form` - Form state management and validation
  - `@tanstack/react-table` - Headless UI for building tables
  - `@tanstack/react-query` - Data fetching and state management

### New NPM Packages Required

```json
{
  "dependencies": {
    "@tanstack/react-form": "^latest",
    "@tanstack/react-table": "^latest",
    "@tanstack/react-query": "^latest",
    "@hello-pangea/dnd": "^16.6.0"  // Drag-and-drop for field reordering
  },
  "devDependencies": {
    "@tanstack/zod-form-adapter": "^latest"  // Optional, for Zod integration
  }
}
```

### Related Packages (Already in Use)

- React - UI framework
- TanStack Start - App router and API routes
- Kysely - Database query builder
- Zod - Schema validation (can be integrated with TanStack Form validators)
