// Vercel Serverless Function: WhatsApp Webhook
// GET: verification challenge
// POST: inbound messages -> optional KV (if configured)

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    } else {
      return res.status(403).send('Forbidden');
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const entries = [].concat(body.entry || []);
      const events = [];
      for (const entry of entries) {
        const changes = [].concat(entry.changes || []);
        for (const ch of changes) {
          const v = ch.value || {};
          const msgs = [].concat((v.messages || []));
          for (const m of msgs) {
            if (!m.from) continue;
            const from = m.from; // customer phone
            const text = m.text?.body || m.button?.text || m.interactive?.text || '';
            const ts = m.timestamp ? new Date(parseInt(m.timestamp, 10) * 1000).toISOString() : new Date().toISOString();
            events.push({ from, body: text, ts });
          }
        }
      }

      // Optional: persist to KV (Upstash via Vercel KV REST)
      const KV_URL = process.env.KV_REST_API_URL;
      const KV_TOKEN = process.env.KV_REST_API_TOKEN;
      if (KV_URL && KV_TOKEN && events.length) {
        // push as a JSON string list for simplicity
        await fetch(`${KV_URL}/lpush/wa:inbound`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(events.map(e => JSON.stringify(e)))
        });
      }

      return res.status(200).json({ received: true, count: events.length });
    } catch (e) {
      console.error('Webhook error', e);
      return res.status(200).json({ received: true }); // Always 200 per Meta docs
    }
  }

  res.setHeader('Allow', 'GET,POST');
  return res.status(405).end('Method Not Allowed');
}
