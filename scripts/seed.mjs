#!/usr/bin/env node
// Usage: npm run seed
// Requires the app to be running on localhost:3000

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';

async function main() {
  console.log(`Triggering rebuild at ${BASE_URL}/api/admin/rebuild ...`);
  const res = await fetch(`${BASE_URL}/api/admin/rebuild`, { method: 'POST' });
  const body = await res.json();
  if (body.ok) {
    console.log('Done:', body.message);
  } else {
    console.error('Failed:', body.error);
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
