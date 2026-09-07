import { getDb } from "../src/lib/db/config";

const db = getDb();
const users = await db.selectFrom("users").selectAll().execute();
console.log("Users in database:");
if (users.length === 0) {
  console.log("No users found!");
} else {
  users.forEach((user) => {
    console.log(`ID: ${user.id}, Email: ${user.email}, Name: ${user.name}`);
  });
}

process.exit(0);
