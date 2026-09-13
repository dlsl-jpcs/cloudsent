import { config } from '../config.js';
import { pool, withTransaction } from '../db/pool.js';
import { runMigrations } from '../db/migrate.js';
import { contentHash } from '../moderation.js';

if (config.NODE_ENV === 'production') {
  throw new Error('Demo seeding is disabled when NODE_ENV=production.');
}

const demoPrayers = [
  { key: '7dc8e2e0-4db0-4ee2-9fb7-c5a458945a01', title: 'A gentle beginning', message: 'May I have the courage to take the next small step, and the patience to let it be enough for today.', category: 'Prayer Intention', mood: 'Hopeful', color: 'sky', anonymous: true, displayName: null, hoursAgo: 2 },
  { key: '7dc8e2e0-4db0-4ee2-9fb7-c5a458945a02', title: 'For the people who show up', message: 'Thank you for the friends, neighbors, and quiet helpers who make difficult weeks feel a little lighter.', category: 'Thanksgiving', mood: 'Grateful', color: 'gold', anonymous: false, displayName: 'Mara', hoursAgo: 6 },
  { key: '7dc8e2e0-4db0-4ee2-9fb7-c5a458945a03', title: null, message: 'I am learning that rest is not a reward for finishing everything. It is part of how I keep going.', category: 'Reflection', mood: 'Hopeful', color: 'lavender', anonymous: true, displayName: null, hoursAgo: 11 },
  { key: '7dc8e2e0-4db0-4ee2-9fb7-c5a458945a04', title: 'For a tired heart', message: 'May anyone carrying more than they can say find one kind voice, one safe pause, and enough strength for the morning.', category: 'Encouragement', mood: 'Hopeful', color: 'sage', anonymous: false, displayName: 'A friend', hoursAgo: 18 },
  { key: '7dc8e2e0-4db0-4ee2-9fb7-c5a458945a05', title: 'Remembering Lola', message: 'For the stories that still make us laugh, the hands that taught us care, and the love that stays after goodbye.', category: 'Memorial Prayer', mood: 'Sorrowful', color: 'rose', anonymous: true, displayName: null, hoursAgo: 25 },
  { key: '7dc8e2e0-4db0-4ee2-9fb7-c5a458945a06', title: 'A quiet thank-you', message: 'For a door that opened at the right time and a little peace arriving when I needed it most.', category: 'Thanksgiving', mood: 'Grateful', color: 'cloud', anonymous: true, displayName: null, hoursAgo: 33 },
  { key: '7dc8e2e0-4db0-4ee2-9fb7-c5a458945a07', title: 'Keep us present', message: 'Help us notice the ordinary gifts around us: warm meals, honest conversations, and the chance to begin again.', category: 'Prayer Intention', mood: 'Grateful', color: 'gold', anonymous: false, displayName: 'Jon', hoursAgo: 42 },
  { key: '7dc8e2e0-4db0-4ee2-9fb7-c5a458945a08', title: 'For patience', message: 'May I meet uncertainty with an open hand instead of a clenched one, and remember that becoming takes time.', category: 'Reflection', mood: 'Sorrowful', color: 'lavender', anonymous: true, displayName: null, hoursAgo: 55 },
];

await runMigrations();
let inserted = 0;
await withTransaction(async (client) => {
  const categories = await client.query<{ category_id: string; name: string }>('SELECT category_id, name FROM categories');
  const moods = await client.query<{ mood_id: string; name: string }>('SELECT mood_id, name FROM moods');
  const categoryByName = new Map(categories.rows.map((row) => [row.name, row.category_id]));
  const moodByName = new Map(moods.rows.map((row) => [row.name, row.mood_id]));
  for (const prayer of demoPrayers) {
    const categoryId = categoryByName.get(prayer.category);
    const moodId = moodByName.get(prayer.mood);
    if (!categoryId || !moodId) throw new Error(`Missing taxonomy seed for ${prayer.category}/${prayer.mood}`);
    const createdAt = new Date(Date.now() - prayer.hoursAgo * 60 * 60 * 1000);
    const result = await client.query(
      `INSERT INTO prayers(title, message, category_id, mood_id, color, display_name, is_anonymous, originally_anonymous, status, approved_at, submission_key, duplicate_hash, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7,'approved',$8,$9,$10,$8)
       ON CONFLICT DO NOTHING
       RETURNING prayer_id`,
      [prayer.title, prayer.message, categoryId, moodId, prayer.color, prayer.anonymous ? null : prayer.displayName, prayer.anonymous, createdAt, prayer.key, contentHash(prayer.message)],
    );
    inserted += result.rowCount || 0;
  }
});

console.log(`Demo prayer seed complete: ${inserted} inserted, ${demoPrayers.length - inserted} already present.`);
await pool.end();
