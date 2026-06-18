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
  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_KEY = env.SUPABASE_KEY;

  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const table = 'feedback';
      const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}?select=*&order=ts.desc`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      });
      if (res.ok) {
        const dbRows = await res.json();
        // Remap snake_case keys back to camelCase for the frontend
        const mapped = dbRows.map(row => ({
          id: row.id,
          path: row.path,
          generic: row.generic,
          pageSpecific: row.page_specific,
          userAgent: row.user_agent,
          ts: row.ts,
          incorporated: row.incorporated || false,
          comment: row.comment || '',
          deleted: row.deleted || false
        }));
        return new Response(JSON.stringify(mapped), { headers: { 'Content-Type': 'application/json' } });
      } else {
        console.error('Supabase GET failed with status:', res.status);
      }
    } catch (e) {
      console.error('Failed to fetch from Supabase, falling back to local store', e);
    }
  }

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

export async function PATCH({ request }) {
  try {
    const payload = await request.json();
    const { id, incorporated, comment, deleted } = payload;

    // Update locally first
    const list = await readStore();
    const idx = list.findIndex(item => item.id === id || String(item.id) === String(id));
    if (idx !== -1) {
      if (incorporated !== undefined) list[idx].incorporated = incorporated;
      if (comment !== undefined) list[idx].comment = comment;
      if (deleted !== undefined) list[idx].deleted = deleted;
      await writeStore(list);
    }

    // If Supabase is configured, patch it there
    const SUPABASE_URL = env.SUPABASE_URL;
    const SUPABASE_KEY = env.SUPABASE_KEY;
    if (SUPABASE_URL && SUPABASE_KEY) {
      try {
        const table = 'feedback';
        const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}?id=eq.${id}`;
        
        const updateFields = {};
        if (incorporated !== undefined) updateFields.incorporated = incorporated;
        if (comment !== undefined) updateFields.comment = comment;
        if (deleted !== undefined) updateFields.deleted = deleted;

        await fetch(url, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            Prefer: 'return=representation'
          },
          body: JSON.stringify(updateFields)
        });
      } catch (e) {
        console.error('supabase patch failed', e);
      }
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('feedback PATCH error', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
