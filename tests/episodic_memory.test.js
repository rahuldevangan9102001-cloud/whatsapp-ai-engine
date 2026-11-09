import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchRelevantEpisodes,
  formatEpisodes,
  formatMemoryTime,
  getMentionedDay,
  getMemorySearchTerms,
  isFinancialProblemMessage
} from '../conversation/episodic_memory.js';

function createClient(rows, failure = null) {
  return {
    from(table) {
      assert.equal(table, 'conversation_logs');
      let filtered = rows.slice();
      const query = {
        select() { return query; },
        eq(field, value) { filtered = filtered.filter(row => row[field] === value); return query; },
        gte(field, value) { filtered = filtered.filter(row => row[field] >= value); return query; },
        lt(field, value) { filtered = filtered.filter(row => row[field] < value); return query; },
        ilike(field, value) {
          const term = value.slice(1, -1).toLowerCase();
          filtered = filtered.filter(row => row[field].toLowerCase().includes(term));
          return query;
        },
        order(field) {
          filtered.sort((a, b) => b[field].localeCompare(a[field]));
          return query;
        },
        async limit(count) {
          return { data: filtered.slice(0, count), error: failure };
        }
      };
      return query;
    }
  };
}

test('date ranges use India time and only infer ambiguous relative dates in past context', () => {
  const now = new Date('2026-11-06T19:00:00Z');
  assert.deepEqual(getMentionedDay('parso link bheja tha', now), {
    start: '2026-11-04T18:30:00.000Z', end: '2026-11-05T18:30:00.000Z'
  });
  assert.deepEqual(getMentionedDay('day before yesterday', now), getMentionedDay('parso link bheja tha', now));
  assert.equal(getMentionedDay('kal bhejna', now), null);
  assert.deepEqual(getMentionedDay('06/11/2026'), {
    start: '2026-11-05T18:30:00.000Z', end: '2026-11-06T18:30:00.000Z'
  });
  assert.equal(getMentionedDay('31/02/2026'), null);
  assert.deepEqual(getMentionedDay('last friday bheja tha', now), {
    start: '2026-11-05T18:30:00.000Z', end: '2026-11-06T18:30:00.000Z'
  });
});

test('older relevant messages are scoped to one user, deduplicated and time ordered', async () => {
  const rows = [
    { user_id: 'a', role: 'assistant', message_text: 'Ye lo https://example.com', created_at: '2026-11-04T11:00:00.000Z' },
    { user_id: 'a', role: 'user', message_text: 'Laptop chahiye', created_at: '2026-11-04T10:00:00.000Z' },
    { user_id: 'b', role: 'assistant', message_text: 'https://private.example', created_at: '2026-11-04T12:00:00.000Z' }
  ];
  const episodes = await fetchRelevantEpisodes(createClient(rows), 'a', 'parso link bheja tha', new Date('2026-11-06T10:00:00Z'));
  assert.deepEqual(episodes, rows.slice(0, 2).reverse());
  assert.match(formatEpisodes(episodes), /Wednesday, 4 November 2026.*IST.*Assistant: Ye lo https:\/\/example\.com/);
  assert.doesNotMatch(formatEpisodes(episodes), /private/);
  assert.equal(getMemorySearchTerms('link, please %_!')[0], 'http');
});

test('memory queries are bounded and propagate database errors', async () => {
  const rows = Array.from({ length: 15 }, (_, index) => ({
    user_id: 'a', role: 'assistant', message_text: `https://example.com/${index}`,
    created_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString()
  }));
  assert.equal((await fetchRelevantEpisodes(createClient(rows), 'a', 'link')).length, 8);
  await assert.rejects(fetchRelevantEpisodes(createClient(rows, { message: 'database unavailable' }), 'a', 'link'), /database unavailable/);
  await assert.rejects(fetchRelevantEpisodes(createClient(rows), '', 'link'), /userId is required/);
  assert.equal(formatMemoryTime(null), 'time unknown');
});

test('financial needs do not get confused with account income requests', () => {
  assert.equal(isFinancialProblemMessage('Mujhe paise ki jarurat hai'), true);
  assert.equal(isFinancialProblemMessage('मुझे पैसे की जरूरत है'), true);
  assert.equal(isFinancialProblemMessage('I need income'), true);
  assert.equal(isFinancialProblemMessage('Payment nahi kar pa raha'), true);
  assert.equal(isFinancialProblemMessage('Payment done'), false);
  assert.equal(isFinancialProblemMessage('Mere account ki income kitni hai'), false);
  assert.equal(isFinancialProblemMessage('Mera paisa kitna bana'), false);
  assert.equal(isFinancialProblemMessage('Mujhe product chahiye'), false);
});
