export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { initializeDatabase } = await import('./lib/db-init');
      await initializeDatabase();
      console.log('[db] initialized');
    } catch (err) {
      console.error('[db] init failed:', err);
    }
  }
}
