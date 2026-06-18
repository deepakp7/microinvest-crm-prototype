import fs from 'fs/promises';
import path from 'path';
import { env } from '$env/dynamic/private';

const STORE = path.resolve('feedback_store.json');

async function readStore() {
  try {
    const raw = await fs.readFile(STORE, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}

async function writeStore(list) {
  try {
    await fs.writeFile(STORE, JSON.stringify(list, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Failed to write feedback store', e);
    return false;
  }
}

export async function GET() {
  const list = await readStore();
  return new Response(JSON.stringify(list), { headers: { 'Content-Type': 'application/json' } });
}

export async function POST({ request }) {
  try {
    const payload = await request.json();
    const list = await readStore();
    list.push(payload);
    await writeStore(list);

    // If Supabase is configured, forward the feedback there as well.
    const SUPABASE_URL = env.SUPABASE_URL;
    const SUPABASE_KEY = env.SUPABASE_KEY;
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        // Supabase REST expects POST to /rest/v1/<table>
        const table = 'feedback';
        const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}`;
        // Remap camelCase payload keys to snake_case database columns
        const dbRow = {
          id: payload.id,
          path: payload.path,
          generic: payload.generic || null,
          page_specific: payload.pageSpecific || null,
          user_agent: payload.userAgent || null,
          ts: payload.ts
        };
        // make a best-effort insert; payload shape should match the table columns
        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            Prefer: 'return=representation'
          },
          body: JSON.stringify(dbRow)
        });
      } catch (e) {
        console.error('supabase forward failed', e);
      }
    }
    return new Response(JSON.stringify({ ok: true }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('feedback POST error', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
