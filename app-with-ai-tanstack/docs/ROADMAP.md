# APPWITHAI Roadmap

## Version 6.0 - Complete Multi-Stack Generation with Application Dictionary

**Status**: In Planning
**Target**: Q2 2026

### Overview

This enhancement transforms APPWITHAI into a complete application generator that produces enterprise-grade applications following the Compiere Application Dictionary pattern. Every generated project will include:

- **System Tables (sys_ prefix)**: Application Dictionary metadata tables
- **Business Tables (bus_ prefix)**: User-defined business entities from ERD
- **Runtime UI Configuration**: Administrators modify field order, visibility, layout at runtime
- **Two Full-Stack Options**: Modern Web Stack or Enterprise SAP-Style Stack

### Two Full-Stack Generation Options

| Option | Frontend | Backend | Use Case |
|--------|----------|---------|----------|
| **Option 1: Modern Web Stack** | Next.js + Shadcn UI + TanStack | NestJS + Fastify + Knex.js | Modern web applications |
| **Option 2: Enterprise SAP-Style Stack** | OpenUI5 FCL | OData V4 Server (jaystack) | SAP-style enterprise apps |

### Key Features

#### Application Dictionary (sys_ prefix)

**System Tables:**
- `sys_table` - Defines all tables (system and business)
- `sys_column` - Defines columns/fields for each table
- `sys_window` - Defines application windows/screens
- `sys_tab` - Defines tabs within windows
- `sys_field` - **Key table for runtime UI configuration**
- `sys_reference` - Defines field types and display controls
- `sys_val_rule` - Defines validation rules
- `sys_user`, `sys_role`, `sys_access`, `sys_field_access` - Authentication and authorization

#### Business Entities (bus_ prefix)

All business entities from the ERD will be generated with `bus_` prefix:

| ERD Entity | Database Table | Display Name |
|------------|----------------|--------------|
| Customer | bus_customer | Customer |
| Order | bus_order | Order |
| Product | bus_product | Product |
| OrderLine | bus_order_line | Order Line |

#### Runtime UI Layout Modification

**How It Works:**
1. At generation time, creates sys_field entries with **random seq_no values**
2. Frontend reads these entries to render forms/tables
3. Administrators can reorder fields by changing seq_no
4. Changes take effect immediately (no code regeneration needed)

### Implementation Phases

#### Phase 1: Core Infrastructure
- Enhance type definitions with complete sys_ types
- Create table naming utilities (sys_/bus_)
- Create common migration templates
- Add 30+ new Handlebars helpers

#### Phase 2: Option 1 - Modern Web Stack
- **NestJS Backend (Fastify + Knex.js)**
  - Create NestJS main.ts with Fastify adapter
  - Database module and service (Knex.js)
  - sys_ module with controllers and services
  - bus_ module with dynamic entity controllers
  - Auth module templates

- **Next.js Frontend (Shadcn + TanStack)**
  - TanStack Query provider integration
  - Shadcn UI components
  - TanStack Query hooks
  - TanStack Table dynamic-table component
  - TanStack Form dynamic-form component
  - Entity list, detail, and new pages
  - Admin interface templates
  - Field layout editor (drag-drop reordering)

#### Phase 3: Option 2 - Enterprise SAP-Style Stack
- **OData V4 Backend (jaystack/odata-v4-server)**
  - OData server entry point
  - Base OData controller with CRUD operations
  - sys_ controllers for Application Dictionary
  - bus_ controllers for dynamic business entities
  - $metadata (EDMX) generator
  - OData annotations for UI5 hints

- **OpenUI5 FCL Frontend**
  - manifest.json with OData V4 model
  - FCL layout with 3 columns
  - Entity menu from $metadata
  - Growing table for list view
  - Object page with CRUD
  - Create/Edit/Delete dialogs
  - Admin interface

#### Phase 4: Integration & Testing
- Create unified generator orchestrator
- Integration testing for both options
- Test runtime UI modification
- Performance optimization

### Success Criteria

**Core Requirements:**
- All generated applications include sys_ tables with proper migrations
- All business tables use bus_ prefix
- sys_field.seq_no controls UI field ordering
- Admin interface allows modifying field order at runtime
- Changes to sys_field reflected immediately in UI
- All code generated from templates (no hardcoded generation)

**Option 1: Modern Web Stack:**
- NestJS backend with Fastify adapter
- Next.js frontend with TanStack Query integration
- Shadcn UI components render correctly
- TanStack Table displays dynamic columns from sys_field
- TanStack Form handles dynamic form fields
- Full CRUD operations work end-to-end

**Option 2: Enterprise SAP-Style Stack:**
- OData V4 server with $metadata endpoint
- All OData operations work ($filter, $orderby, $expand, etc.)
- OpenUI5 FCL layout renders with 3 columns
- Entity menu populates from $metadata
- Growing table loads entity records
- Object page displays entity details
- Full CRUD operations work end-to-end

---

## Visual ERD Designer - Feature Added ✅

**Version**: 5.1
**Status**: ✅ Implemented

### New Features Added

#### 1. Visual ERD Designer Page (`/designer`)
- **Route**: http://localhost:3000/designer
- **Features**:
  - ✅ ERD Editor with Mermaid syntax support
  - ✅ Live code editing with line count
  - ✅ Tab-based interface (Editor, Preview, Code Generation)
  - ✅ Save/Load functionality (localStorage)
  - ✅ Import/Export ERD files
  - ✅ Code generation preview (Knex.js & SQL DDL)

#### 2. Updated Homepage
- ✅ Added "Visual ERD Designer" card with link
- ✅ Added "Database Connection" feature card
- ✅ Improved dark mode support
- ✅ Hover effects on designer card

### Features Implemented

**ERD Editor Tab:**
- Textarea-based editor for Mermaid ERD syntax
- Sample ERD code included (User & Post entities)
- Line count display in footer
- Auto-save to localStorage

**Preview Tab:**
- Placeholder for Mermaid diagram rendering
- Ready for future Mermaid.js integration
- Clean UI with icon and message

**Code Generation Tab:**
- Knex.js migration code preview
- SQL DDL statements preview
- Organized in separate panels
- Syntax-highlighted code blocks

### Current Limitations

1. **Preview Tab**: Mermaid diagram rendering not yet implemented (placeholder shown)
2. **Code Generation**: Shows static examples, not yet parsing actual ERD
3. **Database Connection**: Not integrated into designer yet

### How to Use

1. **Access the Designer**:
   - Go to http://localhost:3000
   - Click on "Visual ERD Designer" card
   - Or navigate directly to http://localhost:3000/designer

2. **Edit ERD**:
   - Type or paste Mermaid ERD syntax in the editor
   - Use the sample code as a template
   - Click "Save" to store locally

3. **Generate Code**:
   - Click "Generate Code" button or "Code Generation" tab
   - View Knex.js migrations and SQL DDL

---

## Workflow Enhancement Requirements

**Status**: Proposed
**Priority**: High

### Overview

Enhance the existing workflow functionality to allow users to define business logic hooks for entity services using Mermaid flowchart syntax, with ANTLR4-based translation to TypeScript code.

### Key Requirements

#### 1. Fix Live Preview Visualization
- Update Mermaid configuration to use proper theme colors
- Add explicit arrow styling in Mermaid config
- Ensure arrows visible on both light and dark backgrounds

#### 2. Change to Mermaid Flowchart Format
- **Current**: Mermaid sequence diagrams
- **Required**: Mermaid flowchart format
- **Reasoning**: Flowcharts better represent business logic flow

#### 3. Service Selection Workflow
- User navigates to `/projects/[id]/enhance`
- Page displays list of available services from generated code
- User selects a service to define hooks for
- Selection opens dedicated workflow editor page

#### 4. Dedicated Workflow Editor Page

**URL**: `/projects/[id]/enhance/[serviceName]`

**Layout:**
- Available Hooks (select to add): beforeCreate, afterCreate, beforeUpdate, afterUpdate, etc.
- Active Hooks for selected service
- Mermaid Flowchart Preview

#### 5. Hook Definition Syntax

```
%%hook <hookType> <hookName> on <EntityName>
```

**Examples:**
```
%%hook beforeCreate hashPassword on User
%%hook afterCreate sendWelcomeEmail on User
%%hook beforeCreate generateSlug on Post
```

#### 6. Draft Mode vs Full Save

**Draft Save:**
- Auto-save every 30 seconds or on blur
- Storage: localStorage
- No validation - allows incomplete work

**Full Save:**
- Manual "Save & Apply" button
- Full Mermaid syntax validation
- Storage: SQLite database
- Sets workflow status to "active"

#### 7. Mermaid to TypeScript Translation via ANTLR4

**Architecture:**
```
Mermaid Flowchart → ANTLR4 Lexer → ANTLR4 Parser → AST → TypeScript Code
```

**Components:**
- ANTLR4 grammar (hook_syntax.g4)
- Visitor pattern implementation
- TypeScript code generator

### Implementation Phases

#### Phase 1: UI & Navigation (High Priority)
1. Fix Mermaid arrow visibility issue
2. Add service selection to enhance page
3. Create new `/[serviceName]` page structure
4. Implement hook selection UI
5. Add draft save indicator

#### Phase 2: Hook Syntax & Storage (High Priority)
1. Define hook comment syntax parser
2. Update database schema
3. Implement draft vs full save logic
4. Create hook workflow DB service

#### Phase 3: Flowchart Visualization (Medium Priority)
1. Convert sequence diagram format to flowchart
2. Implement flowchart-to-hooks visualization
3. Add hook nodes to flowchart
4. Style hooks differently from regular nodes

#### Phase 4: ANTLR4 Implementation (Medium Priority)
1. Create hook syntax grammar (g4)
2. Generate ANTLR4 lexer/parser
3. Implement visitor pattern
4. Create AST node types

#### Phase 5: Code Generation (Medium Priority)
1. Implement TypeScript code generator
2. Generate hook files for each service
3. Integrate with existing code generator
4. Add generated files to output

#### Phase 6: Integration & Testing (Low Priority)
1. Test generated hooks in actual services
2. Add error handling for invalid hook definitions
3. Implement hook execution order validation
4. Add testing utilities for hooks

### Success Criteria

- [ ] Connection arrows visible in Mermaid flowchart preview
- [ ] Service selection page displays all entity services
- [ ] Hook editor page accessible via `/projects/[id]/enhance/[serviceName]`
- [ ] Hooks can be defined using `%%hook <type> <name> on <entity>` syntax
- [ ] Draft auto-save every 30 seconds
- [ ] Full save validates and persists to database
- [ ] ANTLR4 grammar correctly parses hook definitions
- [ ] TypeScript code generates for each hook
- [ ] Generated hooks integrate with service code
- [ ] Flowchart accurately visualizes hook execution order

---

## Bun.js Migration - Complete ✅

**Version**: 5.1
**Status**: ✅ Completed

### Overview

Successfully migrated the entire APPWITHAI project from npm/yarn to Bun.js runtime.

### Key Changes

1. **Runtime**: Bun.js 1.1+ (Node.js 20+ compatible)
2. **Package Manager**: All scripts use `bun` instead of `npm`/`yarn`
3. **Build System**: Optimized Bun builds for all packages
4. **Performance**: Faster install and build times

### Benefits

- Faster package installation
- Faster build times
- Native TypeScript support
- Built-in test runner
- Reduced dependencies

---

## Completed Iterations

### Iteration 1: E2E Testing Foundation ✅

**Date**: January 24, 2026
**Status**: ✅ Completed

**Accomplishments:**
1. ✅ Identified all supported framework types (Option 1 & Option 2)
2. ✅ Created comprehensive E2E test suite (1,500+ lines)
3. ✅ Fixed all build errors (15+ fixes)
4. ✅ Tests successfully executed (90.48% pass rate)
5. ✅ Created test infrastructure and utilities

**Metrics:**
- Duration: ~1 hour
- Files Created: 7 test/utility files
- Files Modified: 10+ files for fixes
- Lines of Code Added: 1,500+
- Tests Passing: 19/21 (90.48%)
- Build Errors Fixed: 15+

### Iteration 2: Test Improvements (Planned)

**Status**: Pending

**High Priority:**
1. Fix the 2 failing form validation tests
2. Run generator E2E tests
3. Increase test coverage to 100%

**Medium Priority:**
4. Add visual regression testing
5. Add performance testing
6. Test with complex ERD diagrams

**Low Priority:**
7. Cross-browser testing (Firefox, Safari, Edge)
8. Mobile device testing
9. Accessibility testing
10. Security testing

### Iteration 3: (Planned)

**Status**: TBD

---

## Open Questions

1. **Hook Execution Order**: How to handle multiple hooks of the same type?
   - *Proposal*: Execute in order defined in flowchart

2. **Hook Parameters**: How to pass data between hooks?
   - *Proposal*: Use context object passed through hook chain

3. **Error Handling**: How to handle hook failures?
   - *Proposal*: Try-catch each hook, log errors, continue or abort based on configuration

4. **Hook Testing**: How to test hook logic?
   - *Proposal*: Generate test files alongside hook files

5. **Hook Versioning**: How to track changes to hook definitions?
   - *Proposal*: Add version column to workflow table, store history

---

## Technical Considerations

1. **ANTLR4 Runtime**: Need to install `antlr4ng2` for TypeScript
2. **Mermaid Configuration**: Custom theme for better arrow visibility
3. **Code Generation Location**: Hooks in `src/hooks/[entity]/[hookType].[hookName].ts`
4. **Service Integration**: Generated services need to import and call hooks
5. **Draft Persistence**: Use localStorage for drafts before full save
6. **Flowchart Size**: May need pagination for complex workflows

---

## Dependencies

```json
{
  "antlr4ng2": "^3.0.0",
  "mermaid": "^11.0.0",
  "@prisma/client": "^5.0.0",
  "zustand": "^4.0.0"
}
```

---

**Document Version**: 1.0
**Last Updated**: February 2026
**Status**: Active Planning
