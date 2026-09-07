#!/usr/bin/env node

/**
 * Direct Filter SQL Generation Test
 * Tests that filter conditions generate correct SQL WHERE clauses
 */

// Helper functions
function escapeIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function escapeLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function conditionToSQL(condition) {
  const field = escapeIdentifier(condition.field);

  switch (condition.operator) {
    case 'equals':
      return `${field} = ${escapeLiteral(condition.value)}`;
    case 'not_equals':
      return `${field} != ${escapeLiteral(condition.value)}`;
    case 'contains':
      return `${field} LIKE ${escapeLiteral(`%${condition.value}%`)}`;
    case 'not_contains':
      return `${field} NOT LIKE ${escapeLiteral(`%${condition.value}%`)}`;
    case 'starts_with':
      return `${field} LIKE ${escapeLiteral(`${condition.value}%`)}`;
    case 'ends_with':
      return `${field} LIKE ${escapeLiteral(`%${condition.value}`)}`;
    case 'greater_than':
      return `${field} > ${escapeLiteral(condition.value)}`;
    case 'less_than':
      return `${field} < ${escapeLiteral(condition.value)}`;
    case 'between':
      return `${field} BETWEEN ${escapeLiteral(condition.value)} AND ${escapeLiteral(condition.value2)}`;
    case 'is_null':
      return `${field} IS NULL`;
    case 'is_not_null':
      return `${field} IS NOT NULL`;
    case 'in':
      const inValues = Array.isArray(condition.value) ? condition.value : String(condition.value).split(',').map(v => v.trim());
      return `${field} IN (${inValues.map(v => escapeLiteral(v)).join(',')})`;
    case 'not_in':
      const notInValues = Array.isArray(condition.value) ? condition.value : String(condition.value).split(',').map(v => v.trim());
      return `${field} NOT IN (${notInValues.map(v => escapeLiteral(v)).join(',')})`;
    case 'is_true':
      return `(${field} = 1 OR ${field} = '1' OR ${field} = 'true')`;
    case 'is_false':
      return `(${field} = 0 OR ${field} = '0' OR ${field} = 'false' OR ${field} IS NULL)`;
    default:
      return '1=1';
  }
}

function filterGroupToSQL(group) {
  const conditionSQLs = group.conditions.map(c => `(${conditionToSQL(c)})`);
  const groupSQLs = (group.groups || []).map(g => `(${filterGroupToSQL(g)})`);
  const allSQLs = [...conditionSQLs, ...groupSQLs];

  if (allSQLs.length === 0) return '1=1';
  return allSQLs.join(` ${group.logic} `);
}

function buildSQLWithFilters(baseSQL, filterConfig) {
  let cleanSQL = baseSQL
    .replace(/\bWHERE\s+.*?(?=\bLIMIT\b|\bGROUP BY\b|\bORDER BY\b|\bHAVING\b|$)/i, '')
    .replace(/\bLIMIT\s+\d+/i, '')
    .replace(/\bOFFSET\s+\d+/i, '')
    .replace(/;$/, '');
  cleanSQL = cleanSQL.trim();

  if (!filterConfig || filterConfig.conditions.length === 0) {
    return cleanSQL;
  }

  const whereSQL = filterGroupToSQL(filterConfig);
  return `${cleanSQL} WHERE ${whereSQL}`;
}

// Test cases
const tests = [
  {
    name: 'equals',
    baseSQL: 'SELECT * FROM customer',
    filter: {
      id: 'root',
      logic: 'AND',
      conditions: [{ id: '1', field: 'first_name', operator: 'equals', value: 'Mike' }]
    },
    expected: /WHERE \("first_name" = 'Mike'\)/
  },
  {
    name: 'contains',
    baseSQL: 'SELECT * FROM customer',
    filter: {
      id: 'root',
      logic: 'AND',
      conditions: [{ id: '1', field: 'first_name', operator: 'contains', value: 'a' }]
    },
    expected: /WHERE \("first_name" LIKE '%a%'\)/
  },
  {
    name: 'starts_with',
    baseSQL: 'SELECT * FROM customer',
    filter: {
      id: 'root',
      logic: 'AND',
      conditions: [{ id: '1', field: 'first_name', operator: 'starts_with', value: 'M' }]
    },
    expected: /WHERE \("first_name" LIKE 'M%'\)/
  },
  {
    name: 'greater_than',
    baseSQL: 'SELECT * FROM customer',
    filter: {
      id: 'root',
      logic: 'AND',
      conditions: [{ id: '1', field: 'customer_id', operator: 'greater_than', value: 100 }]
    },
    expected: /WHERE \("customer_id" > 100\)/
  },
  {
    name: 'between',
    baseSQL: 'SELECT * FROM customer',
    filter: {
      id: 'root',
      logic: 'AND',
      conditions: [{ id: '1', field: 'customer_id', operator: 'between', value: 10, value2: 100 }]
    },
    expected: /WHERE \("customer_id" BETWEEN 10 AND 100\)/
  },
  {
    name: 'is_null',
    baseSQL: 'SELECT * FROM customer',
    filter: {
      id: 'root',
      logic: 'AND',
      conditions: [{ id: '1', field: 'email', operator: 'is_null' }]
    },
    expected: /WHERE \("email" IS NULL\)/
  },
  {
    name: 'is_true',
    baseSQL: 'SELECT * FROM customer',
    filter: {
      id: 'root',
      logic: 'AND',
      conditions: [{ id: '1', field: 'active', operator: 'is_true' }]
    },
    expected: /WHERE \(\("active" = 1 OR "active" = '1' OR "active" = 'true'\)\)/
  },
  {
    name: 'is_false',
    baseSQL: 'SELECT * FROM customer',
    filter: {
      id: 'root',
      logic: 'AND',
      conditions: [{ id: '1', field: 'active', operator: 'is_false' }]
    },
    expected: /WHERE \(\("active" = 0 OR "active" = '0' OR "active" = 'false' OR "active" IS NULL\)\)/
  },
  {
    name: 'in',
    baseSQL: 'SELECT * FROM customer',
    filter: {
      id: 'root',
      logic: 'AND',
      conditions: [{ id: '1', field: 'first_name', operator: 'in', value: 'Mike,John,Sarah' }]
    },
    expected: /WHERE \("first_name" IN \('Mike','John','Sarah'\)\)/
  },
  {
    name: 'AND logic with multiple conditions',
    baseSQL: 'SELECT * FROM customer',
    filter: {
      id: 'root',
      logic: 'AND',
      conditions: [
        { id: '1', field: 'active', operator: 'is_true' },
        { id: '2', field: 'customer_id', operator: 'greater_than', value: 100 }
      ]
    },
    expected: /WHERE \(\("active" = 1 OR "active" = '1' OR "active" = 'true'\)\) AND \("customer_id" > 100\)/
  },
  {
    name: 'OR logic with multiple conditions',
    baseSQL: 'SELECT * FROM customer',
    filter: {
      id: 'root',
      logic: 'OR',
      conditions: [
        { id: '1', field: 'first_name', operator: 'equals', value: 'Mike' },
        { id: '2', field: 'first_name', operator: 'equals', value: 'John' }
      ]
    },
    expected: /WHERE \("first_name" = 'Mike'\) OR \("first_name" = 'John'\)/
  },
  {
    name: 'nested groups',
    baseSQL: 'SELECT * FROM customer',
    filter: {
      id: 'root',
      logic: 'AND',
      conditions: [
        { id: '1', field: 'active', operator: 'is_true' }
      ],
      groups: [
        {
          id: 'group1',
          logic: 'OR',
          conditions: [
            { id: '2', field: 'first_name', operator: 'starts_with', value: 'A' },
            { id: '3', field: 'first_name', operator: 'starts_with', value: 'B' }
          ]
        }
      ]
    },
    expected: /WHERE \(\("active" = 1 OR "active" = '1' OR "active" = 'true'\)\) AND \(\("first_name" LIKE 'A%'\) OR \("first_name" LIKE 'B%'\)\)/
  },
  {
    name: 'SQL injection attempt - single quote',
    baseSQL: 'SELECT * FROM customer',
    filter: {
      id: 'root',
      logic: 'AND',
      conditions: [{ id: '1', field: 'first_name', operator: 'equals', value: "'; DROP TABLE customer; --" }]
    },
    expected: /WHERE \("first_name" = ''''; DROP TABLE customer; --''\)/
  },
  {
    name: 'special characters in value',
    baseSQL: 'SELECT * FROM customer',
    filter: {
      id: 'root',
      logic: 'AND',
      conditions: [{ id: '1', field: 'first_name', operator: 'contains', value: "O'Brien" }]
    },
    expected: /WHERE \("first_name" LIKE '%O''Brien%'\)/
  }
];

console.log('='.repeat(80));
console.log('FILTER SQL GENERATION TEST SUITE');
console.log('='.repeat(80));
console.log('');

let passed = 0;
let failed = 0;

tests.forEach(test => {
  const result = buildSQLWithFilters(test.baseSQL, test.filter);

  console.log(`Test: ${test.name}`);
  console.log(`Base SQL: ${test.baseSQL}`);
  console.log(`Filter:   ${JSON.stringify(test.filter, null, 2)}`);
  console.log(`Result:   ${result}`);

  if (test.expected.test(result)) {
    console.log('✅ PASS');
    passed++;
  } else {
    console.log('❌ FAIL');
    console.log(`Expected pattern: ${test.expected}`);
    failed++;
  }
  console.log('-'.repeat(80));
  console.log('');
});

console.log('='.repeat(80));
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${tests.length} tests`);
console.log('='.repeat(80));

if (failed > 0) {
  process.exit(1);
}
