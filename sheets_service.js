function readLeadNotes(leadNotes) {
  if (!leadNotes) return {};
  if (typeof leadNotes === 'object') return leadNotes;

  try {
    return JSON.parse(leadNotes);
  } catch (_) {
    return {};
  }
}

export function createSheetsService({
  webhookUrl = process.env.SHEETS_WEBHOOK_URL,
  webhookToken = process.env.SHEETS_WEBHOOK_TOKEN,
  fetchImpl = globalThis.fetch
} = {}) {
  return {
    async syncCustomer(customer) {
      if (!webhookUrl) return { synced: false, reason: 'not_configured' };
      if (typeof fetchImpl !== 'function') throw new Error('Fetch is not available for Sheets webhook integration');

      const leadNotes = readLeadNotes(customer?.lead_notes);
      const payload = {
        'Name': leadNotes.name || customer?.name || '',
        'Mobile No': customer?.phone_number || '',
        'City': leadNotes.city_state || customer?.city || '',
        'Current Step': customer?.current_step ?? '',
        'Status': customer?.lead_status || customer?.payment_status || 'New'
      };
      const headers = { 'content-type': 'application/json' };
      if (webhookToken) headers.authorization = `Bearer ${webhookToken}`;

      const response = await fetchImpl(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error(`Sheets webhook returned HTTP ${response.status}`);

      return { synced: true, payload };
    }
  };
}