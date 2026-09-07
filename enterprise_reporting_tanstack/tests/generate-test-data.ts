/**
 * Test Data Generation Script
 * Generates 300,000+ records for load testing
 */

import Database from 'bun:sqlite';

const TEST_DB_PATH = './database/test_large_dataset.db';
const db = new Database(TEST_DB_PATH);
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA journal_mode = WAL');

console.log('Creating test schema and data...');

// Create schema
db.exec(`
  CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    country TEXT NOT NULL,
    segment TEXT NOT NULL,
    tier TEXT NOT NULL
  );

  CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    brand TEXT,
    price REAL NOT NULL,
    cost REAL NOT NULL
  );

  CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT UNIQUE NOT NULL,
    customer_id TEXT NOT NULL,
    order_date TEXT NOT NULL,
    status TEXT NOT NULL,
    total_amount REAL NOT NULL
  );

  CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    line_total REAL NOT NULL
  );
`);

// Generate 100,000 customers
console.log('Generating 100,000 customers...');
const customerInsert = db.query('INSERT INTO customers (customer_id, name, email, country, segment, tier) VALUES (?, ?, ?, ?, ?, ?)');
for (let i = 1; i <= 100000; i++) {
  customerInsert.run(`CUST-${String(i).padStart(6, '0')}`, `Customer ${i}`, `customer${i}@example.com`, ['USA', 'UK', 'Germany', 'France', 'Japan'][i % 5], ['Enterprise', 'Mid-Market', 'Small'][i % 3], ['Platinum', 'Gold', 'Silver'][i % 3]);
  if (i % 10000 === 0) console.log(`  ${i} customers generated`);
}

// Generate 50,000 products
console.log('Generating 50,000 products...');
const productInsert = db.query('INSERT INTO products (product_id, name, category, brand, price, cost) VALUES (?, ?, ?, ?, ?, ?)');
for (let i = 1; i <= 50000; i++) {
  productInsert.run(`PROD-${String(i).padStart(6, '0')}`, `Product ${i}`, ['Electronics', 'Clothing', 'Home', 'Sports'][i % 4], `Brand${i % 10}`, 50 + (i % 500), 25 + (i % 250));
  if (i % 5000 === 0) console.log(`  ${i} products generated`);
}

// Generate 300,000 orders
console.log('Generating 300,000 orders...');
const orderInsert = db.query('INSERT INTO orders (order_id, customer_id, order_date, status, total_amount) VALUES (?, ?, ?, ?, ?)');
for (let i = 1; i <= 300000; i++) {
  orderInsert.run(`ORD-${String(i).padStart(6, '0')}`, `CUST-${String((i % 100000) + 1).padStart(6, '0')}`, `2024-${String(((i % 12) + 1)).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`, ['Pending', 'Processing', 'Shipped', 'Delivered'][i % 4], 100 + (i * 10));
  if (i % 30000 === 0) console.log(`  ${i} orders generated`);
}

// Generate 1,200,000 order items
console.log('Generating 1,200,000 order items...');
const orderItemInsert = db.query('INSERT INTO order_items (order_id, product_id, quantity, line_total) VALUES (?, ?, ?, ?)');
for (let i = 1; i <= 1200000; i++) {
  orderItemInsert.run(`ORD-${String((i % 300000) + 1).padStart(6, '0')}`, `PROD-${String((i % 50000) + 1).padStart(6, '0')}`, 1 + (i % 5), 50 + (i % 500));
  if (i % 100000 === 0) console.log(`  ${i} order items generated`);
}

// Create indexes
db.exec(`
  CREATE INDEX idx_orders_customer ON orders(customer_id);
  CREATE INDEX idx_orders_date ON orders(order_date);
  CREATE INDEX idx_orders_status ON orders(status);
  CREATE INDEX idx_order_items_order ON order_items(order_id);
  CREATE INDEX idx_order_items_product ON order_items(product_id);
`);

console.log('Test data generation complete!');
console.log('Database: ' + TEST_DB_PATH);
console.log('Records: customers=100,000, products=50,000, orders=300,000, order_items=1,200,000');

db.close();
