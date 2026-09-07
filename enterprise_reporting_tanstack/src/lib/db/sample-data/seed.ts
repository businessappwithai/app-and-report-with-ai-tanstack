/**
 * Sample Database Seeder
 * Generates realistic enterprise data for reporting.sqlite
 * Uses bun:sqlite instead of better-sqlite3
 */

import Database from "bun:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const db = new Database(join(__dirname, "reporting.sqlite"));
db.exec("PRAGMA journal_mode = WAL");

// Read and execute schema
const schema = readFileSync(join(__dirname, "schema.sql"), "utf-8");
db.exec(schema);

// Helper to generate random dates
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Helper to pick random item
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

console.log("Starting database seed...");

// 1. Regions (10 records)
console.log("Inserting regions...");
const regions: { id: number; name: string; code: string; country: string }[] = [];
const regionData = [
  { name: "North America", code: "NA", country: "United States" },
  { name: "Europe West", code: "EUW", country: "Germany" },
  { name: "Europe East", code: "EUE", country: "Poland" },
  { name: "Asia Pacific", code: "APAC", country: "Singapore" },
  { name: "Latin America", code: "LATAM", country: "Brazil" },
  { name: "Middle East", code: "ME", country: "UAE" },
  { name: "Africa", code: "AFR", country: "South Africa" },
  { name: "East Asia", code: "EA", country: "Japan" },
  { name: "South Asia", code: "SA", country: "India" },
  { name: "Oceania", code: "OC", country: "Australia" },
];

const insertRegion = db.query("INSERT INTO regions (name, code, country) VALUES (?, ?, ?)");
for (const region of regionData) {
  const info = insertRegion.run(region.name, region.code, region.country);
  regions.push({ id: info.lastInsertRowid, ...region });
}

// 2. Departments (15 records)
console.log("Inserting departments...");
const departments: { id: number; name: string; code: string; description: string; budget: number; manager_id: null }[] = [];
const departmentData = [
  { name: "Sales", code: "SAL", description: "Sales and Business Development", budget: 5000000 },
  { name: "Marketing", code: "MKT", description: "Marketing and Communications", budget: 3000000 },
  { name: "Engineering", code: "ENG", description: "Product Engineering", budget: 8000000 },
  { name: "Operations", code: "OPS", description: "Operations and Logistics", budget: 4000000 },
  { name: "Finance", code: "FIN", description: "Finance and Accounting", budget: 2000000 },
  { name: "Human Resources", code: "HR", description: "Human Resources", budget: 1500000 },
  { name: "Customer Support", code: "CS", description: "Customer Success", budget: 2500000 },
  { name: "Research & Development", code: "RND", description: "R&D", budget: 6000000 },
  { name: "Quality Assurance", code: "QA", description: "QA and Testing", budget: 1800000 },
  { name: "Legal", code: "LEG", description: "Legal Department", budget: 1200000 },
  { name: "IT", code: "IT", description: "Information Technology", budget: 3500000 },
  { name: "Procurement", code: "PUR", description: "Purchasing", budget: 1000000 },
  { name: "Warehousing", code: "WH", description: "Warehouse Management", budget: 2000000 },
  { name: "Logistics", code: "LOG", description: "Shipping and Distribution", budget: 2800000 },
  { name: "Product Management", code: "PM", description: "Product Management", budget: 1500000 },
];

const insertDept = db.query(
  "INSERT INTO departments (name, code, description, budget) VALUES (?, ?, ?, ?)"
);
for (const dept of departmentData) {
  const info = insertDept.run(dept.name, dept.code, dept.description, dept.budget);
  departments.push({ id: info.lastInsertRowid, ...dept, manager_id: null });
}

// 3. Employees (10,000 records)
console.log("Inserting 10,000 employees...");
const employees: { id: number; department_id?: number }[] = [];
const firstNames = [
  "James",
  "Mary",
  "John",
  "Patricia",
  "Robert",
  "Jennifer",
  "Michael",
  "Linda",
  "William",
  "Elizabeth",
  "David",
  "Barbara",
  "Richard",
  "Susan",
  "Joseph",
  "Jessica",
  "Thomas",
  "Sarah",
  "Charles",
  "Karen",
  "Christopher",
  "Nancy",
  "Daniel",
  "Lisa",
  "Matthew",
  "Betty",
  "Anthony",
  "Margaret",
  "Mark",
  "Sandra",
  "Donald",
  "Ashley",
  "Steven",
  "Dorothy",
  "Paul",
  "Emily",
  "Andrew",
  "Donna",
  "Joshua",
  "Michelle",
  "Kenneth",
  "Carol",
  "Kevin",
  "Amanda",
  "Brian",
  "Melissa",
  "George",
  "Deborah",
  "Edward",
  "Stephanie",
  "Ronald",
  "Rebecca",
  "Timothy",
  "Sharon",
  "Jason",
  "Laura",
  "Jeffrey",
  "Cynthia",
  "Ryan",
  "Kathleen",
  "Jacob",
  "Amy",
  "Gary",
  "Shirley",
  "Nicholas",
  "Angela",
  "Eric",
  "Helen",
  "Jonathan",
  "Anna",
  "Stephen",
  "Brenda",
  "Larry",
  "Pamela",
  "Justin",
  "Nicole",
  "Scott",
  "Emma",
  "Brandon",
  "Samantha",
  "Benjamin",
  "Katherine",
  "Samuel",
  "Christine",
  "Gregory",
  "Debra",
  "Frank",
  "Rachel",
  "Alexander",
  "Carolyn",
  "Raymond",
  "Janet",
  "Patrick",
  "Catherine",
  "Jack",
  "Maria",
  "Dennis",
  "Heather",
];
const lastNames = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Gonzalez",
  "Wilson",
  "Anderson",
  "Thomas",
  "Taylor",
  "Moore",
  "Jackson",
  "Martin",
  "Lee",
  "Perez",
  "Thompson",
  "White",
  "Harris",
  "Sanchez",
  "Clark",
  "Ramirez",
  "Lewis",
  "Robinson",
  "Walker",
  "Young",
  "Allen",
  "King",
  "Wright",
  "Scott",
  "Torres",
  "Nguyen",
  "Hill",
  "Flores",
  "Green",
  "Adams",
  "Nelson",
  "Baker",
  "Hall",
  "Rivera",
  "Campbell",
  "Mitchell",
  "Carter",
  "Roberts",
  "Gomez",
  "Phillips",
  "Evans",
  "Turner",
  "Diaz",
  "Parker",
  "Cruz",
  "Edwards",
  "Collins",
  "Reyes",
  "Stewart",
  "Morris",
  "Morales",
  "Murphy",
  "Cook",
  "Rogers",
  "Gutierrez",
  "Ortiz",
  "Morgan",
  "Cooper",
  "Peterson",
  "Bailey",
  "Reed",
  "Kelly",
  "Howard",
  "Ramos",
  "Kim",
  "Cox",
  "Ward",
  "Richardson",
  "Watson",
  "Brooks",
  "Chavez",
  "Wood",
  "Bennett",
  "Gray",
  "Mendoza",
  "Ruiz",
  "Hughes",
  "Price",
  "Alvarez",
  "Castillo",
  "Sanders",
  "Patel",
  "Myers",
  "Long",
  "Ross",
  "Foster",
  "Jimenez",
];

const insertEmp = db.query(
  "INSERT INTO employees (first_name, last_name, email, phone, hire_date, salary, department_id, manager_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
);
for (let i = 0; i < 10000; i++) {
  const firstName = pickRandom(firstNames);
  const lastName = pickRandom(lastNames);
  const dept = pickRandom(departments);
  const hireDate = randomDate(new Date(2015, 0, 1), new Date(2024, 11, 31));
  const salary = 45000 + Math.floor(Math.random() * 150000);

  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@company.com`;
  const phone = `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`;

  const info = insertEmp.run(
    firstName,
    lastName,
    email,
    phone,
    formatDate(hireDate),
    salary,
    dept.id,
    null,
    1
  );
  employees.push({
    id: info.lastInsertRowid,
    firstName,
    lastName,
    email,
    department_id: dept.id,
    manager_id: null,
  });
}

// Assign managers (first 100 employees as managers)
console.log("Assigning managers...");
const updateManager = db.query("UPDATE employees SET manager_id = ? WHERE id = ?");
const managers = employees.slice(0, 100);
for (let i = 100; i < employees.length; i++) {
  const manager = pickRandom(managers);
  updateManager.run(manager.id, employees[i].id);
}

// Update department managers
for (const dept of departments) {
  const deptEmployees = employees.filter((e) => e.department_id === dept.id);
  if (deptEmployees.length > 0) {
    const manager = deptEmployees[Math.floor(Math.random() * Math.min(10, deptEmployees.length))];
    db.query("UPDATE departments SET manager_id = ? WHERE id = ?").run(manager.id, dept.id);
  }
}

// 4. Warehouses (20 records)
console.log("Inserting warehouses...");
const warehouses: { id: number; code: string }[] = [];
const cities = [
  "New York",
  "Los Angeles",
  "Chicago",
  "Houston",
  "Phoenix",
  "Philadelphia",
  "San Antonio",
  "San Diego",
  "Dallas",
  "San Jose",
  "Austin",
  "Jacksonville",
  "Fort Worth",
  "Columbus",
  "Charlotte",
  "San Francisco",
  "Indianapolis",
  "Seattle",
  "Denver",
  "Washington",
];
const insertWh = db.query(
  "INSERT INTO warehouses (name, code, address, city, region_id, manager_id, capacity) VALUES (?, ?, ?, ?, ?, ?, ?)"
);
for (let i = 0; i < 20; i++) {
  const region = pickRandom(regions);
  const warehousingDept = departments.find((d) => d.name === "Warehousing");
  const deptEmployees = employees.filter((e) => e.department_id === warehousingDept?.id);
  const manager = deptEmployees.length > 0 ? pickRandom(deptEmployees) : null;
  const code = `WH${String(i + 1).padStart(3, "0")}`;
  const info = insertWh.run(
    `Warehouse ${i + 1}`,
    code,
    `${String(Math.floor(Math.random() * 9999))} ${cities[i]} St`,
    cities[i],
    region.id,
    manager ? manager.id : null,
    50000 + Math.floor(Math.random() * 100000)
  );
  warehouses.push({ id: info.lastInsertRowid, code });
}

// 5. Categories (30 records)
console.log("Inserting categories...");
const categories: { id: number; name: string; code: string }[] = [];
const categoryData = [
  { name: "Electronics", code: "ELEC", parent: null },
  { name: "Computers", code: "COMP", parent: "Electronics" },
  { name: "Laptops", code: "LAPT", parent: "Computers" },
  { name: "Desktops", code: "DESK", parent: "Computers" },
  { name: "Tablets", code: "TABL", parent: "Computers" },
  { name: "Phones", code: "PHON", parent: "Electronics" },
  { name: "Smartphones", code: "SMAR", parent: "Phones" },
  { name: "Accessories", code: "ACCE", parent: "Electronics" },
  { name: "Furniture", code: "FURN", parent: null },
  { name: "Office Furniture", code: "OFFI", parent: "Furniture" },
  { name: "Chairs", code: "CHAI", parent: "Office Furniture" },
  { name: "Desks", code: "DESK2", parent: "Office Furniture" },
  { name: "Storage", code: "STOR", parent: "Furniture" },
  { name: "Supplies", code: "SUPP", parent: null },
  { name: "Paper", code: "PAPER", parent: "Supplies" },
  { name: "Writing Instruments", code: "WRIT", parent: "Supplies" },
  { name: "Office Supplies", code: "OFFS", parent: "Supplies" },
  { name: "Industrial", code: "INDU", parent: null },
  { name: "Tools", code: "TOOL", parent: "Industrial" },
  { name: "Safety Equipment", code: "SAFE", parent: "Industrial" },
  { name: "Materials", code: "MATE", parent: "Industrial" },
  { name: "Technology", code: "TECH", parent: null },
  { name: "Software", code: "SOFT", parent: "Technology" },
  { name: "Hardware", code: "HARD", parent: "Technology" },
  { name: "Networking", code: "NETW", parent: "Technology" },
  { name: "Appliances", code: "APPL", parent: null },
  { name: "Kitchen", code: "KITC", parent: "Appliances" },
  { name: "Laundry", code: "LAUN", parent: "Appliances" },
  { name: "Cleaning", code: "CLEA", parent: "Supplies" },
];

const insertCat = db.query(
  "INSERT INTO categories (name, code, description, parent_id) VALUES (?, ?, ?, ?)"
);
for (const cat of categoryData) {
  const parent = cat.parent ? categories.find((c) => c.name === cat.parent) : null;
  const info = insertCat.run(
    cat.name,
    cat.code,
    `${cat.name} and related products`,
    parent ? parent.id : null
  );
  categories.push({ id: info.lastInsertRowid, name: cat.name, code: cat.code });
}

// Simplified seeding - continue with remaining tables...
console.log("Sample data seeding complete!");
db.close();
