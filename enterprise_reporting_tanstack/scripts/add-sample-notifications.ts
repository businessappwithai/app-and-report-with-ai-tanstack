import path from 'path';
import { fileURLToPath } from 'url';

// Set DATABASE_PATH before importing getDb
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.env.DATABASE_PATH = path.join(__dirname, '../src/lib/db/data/config.sqlite');

import { getDb } from '../src/lib/db/config';
import { v4 as uuidv4 } from 'uuid';

async function addSampleNotifications() {
  const db = getDb();

  const adminUser = await db.selectFrom('users').selectAll().where('email', '=', 'admin@admin.com').executeTakeFirst();

  if (!adminUser) {
    console.log('Admin user not found. Please run seed first.');
    return;
  }

  const now = new Date().toISOString();
  const notifications = [
    {
      id: uuidv4(),
      user_id: adminUser.id,
      type: 'info',
      title: 'Welcome to the Reporting System',
      message: 'You have access to dashboards, reports, and data sources. Start by connecting a data source.',
      metadata: JSON.stringify({ action: 'connect_datasource' }),
      is_read: false,
      created_at: now,
    },
    {
      id: uuidv4(),
      user_id: adminUser.id,
      type: 'success',
      title: 'System Ready',
      message: 'All services are running correctly. Redis connection established.',
      is_read: true,
      created_at: now,
    },
    {
      id: uuidv4(),
      user_id: adminUser.id,
      type: 'warning',
      title: 'Scheduled Job Report',
      message: 'Your daily sales report is scheduled to run at 8:00 AM.',
      is_read: false,
      created_at: now,
    },
  ];

  // biome-ignore lint/suspicious/noExplicitAny: notifications table not in main schema
  await (db as any).insertInto('notifications').values(notifications).execute();

  console.log('Sample notifications created successfully!');
  console.log(`Created ${notifications.length} notifications for user: ${adminUser.email}`);
}

addSampleNotifications()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
