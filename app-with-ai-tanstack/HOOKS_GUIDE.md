# UserService Hooks Guide

This guide shows you how to configure business logic rules for the UserService using the hook system.

## Quick Overview

**Hooks** are custom code blocks that run at specific points in the data lifecycle. Use them to:
- Validate data before saving
- Transform data
- Run side effects (emails, logging, notifications)
- Control access and permissions
- Enrich data with additional information

---

## Hook Categories

### 🔨 CREATE Operations
Triggered when creating a new User record.

#### Before Create
Run **before** the user is saved. Perfect for validation and transformation.

**Example: Validate email format**
```typescript
// Validate email format and convert to lowercase
if (!email || !email.includes('@')) {
  throw new Error('Invalid email address');
}
return {
  ...data,
  email: email.toLowerCase(),
};
```

#### After Create
Run **after** the user is saved. Perfect for side effects.

**Example: Send welcome email**
```typescript
// Send welcome email to new user
await sendEmail({
  to: user.email,
  subject: 'Welcome to our platform',
  body: `Hello ${user.name}, welcome!`
});

// Log the event
console.log(`New user created: ${user.id}`);
```

---

### ✏️ UPDATE Operations
Triggered when updating an existing User record.

#### Before Update
Run **before** changes are saved.

**Example: Validate updates**
```typescript
// Prevent changing email without verification
if (data.email && data.email !== existingUser.email) {
  throw new Error('Email changes require verification');
}

// Allow other fields to update
return data;
```

#### After Update
Run **after** changes are saved.

**Example: Audit trail**
```typescript
// Log what changed
console.log(`User ${userId} updated:`, changes);

// Send notification to admin
await notifyAdmin({
  action: 'user_updated',
  userId: userId,
  changes: changes,
});
```

---

### 🗑️ DELETE Operations
Triggered when deleting a User record.

#### Before Delete
Run **before** deletion. Use to prevent/allow deletion.

**Example: Soft delete instead of permanent**
```typescript
// Mark as deleted instead of removing
return {
  ...data,
  deleted: true,
  deletedAt: new Date(),
};
```

#### After Delete
Run **after** deletion.

**Example: Cleanup**
```typescript
// Delete related data
await deleteUserPreferences(userId);
await deleteUserSessions(userId);

// Log deletion
console.log(`User ${userId} deleted`);
```

---

### 📖 READ Operations

#### Before Query
Run **before** searching for users. Use to filter or add permissions.

**Example: Admins see all, users see only themselves**
```typescript
// If not admin, only return own user
if (currentUser.role !== 'admin') {
  return {
    ...query,
    where: { id: currentUser.id }
  };
}

// Admins see all
return query;
```

#### Before List
Run **before** loading a list of users.

**Example: Only active users**
```typescript
// Always exclude deleted users
return {
  ...query,
  where: {
    ...query.where,
    deleted: false,
  }
};
```

#### After List
Run **after** users are loaded. Use to transform results.

**Example: Add computed fields**
```typescript
// Add derived data to each user
return users.map(user => ({
  ...user,
  isAdmin: user.role === 'admin',
  accountAge: new Date() - user.createdAt,
}));
```

---

### ✅ VALIDATION
Custom validation rules.

**Example: Business logic validation**
```typescript
// Validate business rules
if (data.age && data.age < 18) {
  throw new Error('Users must be 18 or older');
}

// Check for duplicate emails
const existing = await findByEmail(data.email);
if (existing && existing.id !== userId) {
  throw new Error('Email already in use');
}

return data;
```

---

## Common Patterns

### Pattern 1: Email Validation
```typescript
// Before Create
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  throw new Error('Invalid email format');
}
return data;
```

### Pattern 2: Permission Checks
```typescript
// Before Query
if (!currentUser.isAdmin && currentUser.id !== userId) {
  throw new Error('Not authorized to view this user');
}
return query;
```

### Pattern 3: Audit Logging
```typescript
// After Update
console.log({
  action: 'user_updated',
  userId: userId,
  timestamp: new Date(),
  changes: changedFields,
});
```

### Pattern 4: Data Transformation
```typescript
// Before Create
return {
  ...data,
  email: data.email.toLowerCase().trim(),
  phone: data.phone?.replace(/\D/g, ''), // Remove non-digits
  status: 'active',
  createdAt: new Date(),
};
```

---

## How to Use

1. **Select a hook** from the left panel (e.g., "Before Create")
2. **Enter hook code** in the textarea
3. **Click Save** to save the configuration
4. **Click Validate** to check for errors
5. **Click Generate** to create the code files

## Testing Your Hooks

After generating code, the hooks will run automatically when:
- Creating a new user
- Updating a user
- Deleting a user
- Querying users
- Listing users

## Debugging

- **Check the console** for errors
- **Use console.log()** to debug values
- **Throw errors** to reject invalid operations
- **Return data** to allow operations to proceed

---

## Quick Start: Complete Example

Here's a complete setup with 3 hooks:

### Hook 1: Before Create (Validate)
```typescript
if (!email || !email.includes('@')) {
  throw new Error('Valid email required');
}
return {
  ...data,
  email: data.email.toLowerCase(),
  status: 'active',
};
```

### Hook 2: After Create (Notify)
```typescript
await sendWelcomeEmail(user.email, user.name);
console.log(`Welcome email sent to ${user.email}`);
```

### Hook 3: Custom Validation
```typescript
if (data.age && data.age < 18) {
  throw new Error('Must be 18+');
}
if (data.password && data.password.length < 8) {
  throw new Error('Password must be 8+ characters');
}
```

---

## Tips

✅ **DO** use hooks for business logic  
✅ **DO** validate user input  
✅ **DO** log important actions  
✅ **DO** throw errors to reject bad data  

❌ **DON'T** access the database directly (use provided services)  
❌ **DON'T** block for long operations  
❌ **DON'T** leave debugging code in production  

---

Questions? Check the descriptions in the hook panel!
