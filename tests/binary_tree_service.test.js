import test from 'node:test';
import assert from 'node:assert/strict';
import { createBinaryTreeService } from '../binary_tree_service.js';

function makeSupabase({ members = [], users = [], errors = {} } = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      const query = {
        select(fields) { calls.push([table, 'select', fields]); return query; },
        eq(field, value) { calls.push([table, 'eq', field, value]); return query; },
        in(field, value) { calls.push([table, 'in', field, value]); return query; },
        limit(value) { calls.push([table, 'limit', value]); query.rowLimit = value; return query; },
        then(resolve, reject) {
          const tableRows = table === 'members' ? members : users;
          let rows = tableRows;
          const sponsorFilter = calls.findLast(call => call[0] === table && call[1] === 'in');
          if (sponsorFilter) rows = rows.filter(row => sponsorFilter[3].includes(row.sponsor_phone));
          const phoneFilter = calls.findLast(call => call[0] === table && call[1] === 'eq');
          if (phoneFilter) rows = rows.filter(row => row[phoneFilter[2]] === phoneFilter[3]);
          const response = {
            data: rows.slice(0, query.rowLimit || rows.length),
            error: errors[table] || null
          };
          return Promise.resolve(response).then(resolve, reject);
        }
      };
      return query;
    }
  };
}

test('reads member profile and bounded descendants without exposing phone numbers', async () => {
  const client = makeSupabase({
    members: [{
      phone: '90000',
      name: 'Asha',
      sponsor_id: 'ROOT001',
      status: 'Active',
      member_id: 'ASHA001',
      password: 'member-secret'
    }],
    users: [
      { phone_number: '90001', sponsor_phone: '90000', name: 'Ravi', leg_position: 'Left', is_active: true },
      { phone_number: '90002', sponsor_phone: '90000', name: 'Mina', leg_position: 'Right', payment_status: 'TOKEN_PAID' },
      { phone_number: '90003', sponsor_phone: '90001', name: 'Dev', leg_position: 'Right', payment_status: 'ACTIVE_GREEN' }
    ]
  });
  const service = createBinaryTreeService({
    client,
    portalUrl: 'https://crm.example.com/tree',
    maxDepth: 3
  });

  const result = await service.getMemberNetwork({
    phoneNumber: '90000',
    user: { left_count: null, right_count: null }
  });

  assert.equal(result.memberFound, true);
  assert.equal(result.portalUrl, 'https://crm.example.com/tree');
  assert.deepEqual(result.memberships, [{ name: 'Asha', status: 'Active' }]);
  assert.ok(client.calls.some(call =>
    call[0] === 'members' &&
    call[1] === 'select' &&
    call[2] === 'phone,name,status'
  ));
  assert.deepEqual(
    [result.downline.leftActiveCount, result.downline.rightActiveCount, result.downline.matchedPairs],
    [2, 0, 0]
  );
  assert.deepEqual(result.downline.tree.map(node => [node.name, node.side, node.depth]), [
    ['Ravi', 'Left', 1],
    ['Mina', 'Right', 1],
    ['Dev', 'Left', 2]
  ]);
  assert.equal(JSON.stringify(result).includes('90001'), false);
  assert.equal(JSON.stringify(result).includes('member-secret'), false);
  assert.equal(JSON.stringify(result).includes('ASHA001'), false);
});

test('does not retrieve or expose credentials from matched CRM rows', async () => {
  const client = makeSupabase({
    members: [
      { phone: '92000', name: 'Asha', status: 'Active', member_id: 'ASHA001', password: 'secret-1' },
      { phone: '92000', name: 'Asha', status: 'Active', member_id: 'ASHA002', password: 'secret-2' }
    ]
  });
  const service = createBinaryTreeService({ client });
  const result = await service.getMemberNetwork({ phoneNumber: '92000' });

  assert.equal(result.memberFound, true);
  assert.equal(Object.hasOwn(result, 'credentials'), false);
  assert.equal(JSON.stringify(result).includes('ASHA001'), false);
  assert.equal(JSON.stringify(result).includes('secret-1'), false);
});

test('does not fetch credential columns for ordinary tree lookups', async () => {
  const client = makeSupabase({
    members: [{ phone: '93000', name: 'Asha', status: 'Active', member_id: 'ASHA001', password: 'secret' }]
  });
  const service = createBinaryTreeService({ client });
  const result = await service.getMemberNetwork({ phoneNumber: '93000' });

  assert.equal(Object.hasOwn(result, 'credentials'), false);
  assert.ok(client.calls.some(call =>
    call[0] === 'members' &&
    call[1] === 'select' &&
    call[2] === 'phone,name,status'
  ));
});

test('matches a supplied name only against the supplied WhatsApp phone record', async () => {
  const client = makeSupabase({
    members: [
      { phone: '94000', name: 'Asha Devi', status: 'Active', member_id: 'PRIVATE001', password: 'private' },
      { phone: '95000', name: 'Other User', status: 'Active', member_id: 'PRIVATE002', password: 'private-2' }
    ]
  });
  const service = createBinaryTreeService({ client });

  assert.equal(await service.matchesMemberIdentity({ phoneNumber: '94000', name: ' asha   devi ' }), true);
  assert.equal(await service.matchesMemberIdentity({ phoneNumber: '94000', name: 'Other User' }), false);
  assert.equal(await service.matchesMemberIdentity({ phoneNumber: '95000', name: 'Asha Devi' }), false);
  assert.ok(client.calls.every(call =>
    call[1] !== 'select' || call[2] === 'phone,name,status'
  ));
});

test('matches names case-insensitively, with omitted middle names and minor typos', async () => {
  const client = makeSupabase({
    members: [
      { phone: '96000', name: 'Rahul Kumar Dewangan', status: 'Active' },
      { phone: '97000', name: 'Priyanka Sharma', status: 'Active' }
    ]
  });
  const service = createBinaryTreeService({ client });

  assert.equal(await service.matchesMemberIdentity({ phoneNumber: '96000', name: 'rahul dewangan' }), true);
  assert.equal(await service.matchesMemberIdentity({ phoneNumber: '96000', name: 'RAHUL KUMAR DEWANGAN' }), true);
  assert.equal(await service.matchesMemberIdentity({ phoneNumber: '96000', name: 'Rahul Dewangann' }), true);
  assert.equal(await service.matchesMemberIdentity({ phoneNumber: '97000', name: 'priyanka sharma' }), true);
  assert.equal(await service.matchesMemberIdentity({ phoneNumber: '97000', name: 'Priyanka Sharmaj' }), true);
  assert.equal(await service.matchesMemberIdentity({ phoneNumber: '97000', name: 'Rahul Kumar' }), false);
});

test('prefers stored root leg totals and flags a capped tree', async () => {
  const client = makeSupabase({
    users: [
      { phone_number: '91001', sponsor_phone: '91000', leg_position: 'Left', is_active: true },
      { phone_number: '91002', sponsor_phone: '91000', leg_position: 'Right', is_active: true },
      { phone_number: '91003', sponsor_phone: '91000', leg_position: 'Right', is_active: true }
    ]
  });
  const service = createBinaryTreeService({ client, maxNodes: 2 });
  const result = await service.getMemberNetwork({
    phoneNumber: '91000',
    user: { left_count: 12, right_count: 8 }
  });

  assert.equal(result.downline.leftActiveCount, 12);
  assert.equal(result.downline.rightActiveCount, 8);
  assert.equal(result.downline.truncated, true);
  assert.equal(result.downline.tree.length, 2);
});

test('surfaces Supabase read errors and rejects unsafe portal URLs', async () => {
  const client = makeSupabase({ errors: { members: new Error('members read failed') } });
  const service = createBinaryTreeService({ client });
  await assert.rejects(
    () => service.getMemberNetwork({ phoneNumber: '90000' }),
    /members read failed/
  );
  assert.throws(
    () => createBinaryTreeService({ client, portalUrl: 'javascript:alert(1)' }),
    /valid http\(s\) URL/
  );
});
