// Vercel Serverless Function: Pull inbound messages from KV and clear the queue
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  if (!KV_URL || !KV_TOKEN) {
    return res.status(200).json({ events: [] });
  }
  try {
    // Read all current items
    const rangeRes = await fetch(`${KV_URL}/lrange/wa:inbound/0/-1`, { headers: { 'Authorization': `Bearer ${KV_TOKEN}` } });
    const data = await rangeRes.json();
    const arr = Array.isArray(data.result) ? data.result : [];
    // Clear the list
    await fetch(`${KV_URL}/del/wa:inbound`, { method: 'POST', headers: { 'Authorization': `Bearer ${KV_TOKEN}` } });
    // Parse events
    const events = arr.map((s) => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
    return res.status(200).json({ events });
  } catch (e) {
    return res.status(200).json({ events: [] });
  }
}
