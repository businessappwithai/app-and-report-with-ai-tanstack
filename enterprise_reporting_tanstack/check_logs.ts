import { getDb } from './src/lib/db/config';

const db = getDb();
const logs = await db.selectFrom('logs').selectAll().orderBy('timestamp', 'desc').limit(3).execute();

logs.forEach((log, i) => {
  console.log(`\n=== Log ${i + 1} ===`);
  console.log('Message:', log.message);
  console.log('Component:', log.component);
  console.log('Metadata type:', typeof log.metadata);
  console.log('Metadata raw:', log.metadata);
  
  if (typeof log.metadata === 'string') {
    try {
      const parsed = JSON.parse(log.metadata);
      console.log('Parsed metadata:', JSON.stringify(parsed, null, 2).substring(0, 500));
    } catch (e) {
      console.log('Failed to parse:', e.message);
    }
  }
});
