const MEMBER_FIELDS = 'phone,name,status';
const USER_FIELDS = 'phone_number,name,sponsor_phone,leg_position,payment_status,is_active,is_locked,left_count,right_count';
const ACTIVE_PAYMENT_STATUSES = new Set(['FULL_PAID', 'ACTIVE_GREEN']);
const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_MAX_NODES = 100;

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function editDistanceWithin(left, right, maxDistance) {
  if (Math.abs(left.length - right.length) > maxDistance) return false;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    let rowMinimum = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      const distance = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + substitutionCost
      );
      current.push(distance);
      rowMinimum = Math.min(rowMinimum, distance);
    }
    if (rowMinimum > maxDistance) return false;
    previous = current;
  }

  return previous[right.length] <= maxDistance;
}

function nameTokenMatches(candidate, stored) {
  if (candidate === stored) return true;

  const shorter = candidate.length <= stored.length ? candidate : stored;
  const longer = candidate.length > stored.length ? candidate : stored;
  if (shorter.length >= 5 && longer.startsWith(shorter)) return true;

  const allowedDistance = shorter.length >= 9 ? 2 : shorter.length >= 5 ? 1 : 0;
  return allowedDistance > 0 && editDistanceWithin(candidate, stored, allowedDistance);
}

function matchesName(candidateName, storedName) {
  const candidate = normalizeName(candidateName);
  const stored = normalizeName(storedName);
  if (!candidate || !stored) return false;
  if (candidate === stored || stored.includes(candidate) || candidate.includes(stored)) return true;

  const candidateTokens = [...new Set(candidate.split(' '))];
  const storedTokens = [...new Set(stored.split(' '))];
  const matchedTokenCount = candidateTokens.filter(candidateToken =>
    storedTokens.some(storedToken => nameTokenMatches(candidateToken, storedToken))
  ).length;

  if (candidateTokens.length === 1) return matchedTokenCount === 1 && candidateTokens[0].length >= 4;
  return matchedTokenCount >= 2 &&
    matchedTokenCount / candidateTokens.length >= 0.6;
}

function normalizePortalUrl(value) {
  const url = String(value || '').trim();
  if (!url) return null;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new TypeError('BINARY_TREE_URL must be a valid http(s) URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new TypeError('BINARY_TREE_URL must be a valid http(s) URL without credentials');
  }

  return parsed.toString();
}

function countOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : null;
}

function displayText(value) {
  const text = String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return text || null;
}

function isActive(user) {
  return user?.is_active === true || ACTIVE_PAYMENT_STATUSES.has(user?.payment_status);
}

function getMemberStatus(user) {
  if (isActive(user)) return 'Active';
  if (user?.is_locked === true || user?.payment_status === 'TOKEN_PAID') return 'Token paid';
  return displayText(user?.payment_status) || 'Pending';
}

function validateClient(client) {
  if (!client || typeof client.from !== 'function') {
    throw new TypeError('a Supabase-like read client is required');
  }
}

function createBinaryTreeService({
  client,
  portalUrl = '',
  maxDepth = DEFAULT_MAX_DEPTH,
  maxNodes = DEFAULT_MAX_NODES
} = {}) {
  validateClient(client);
  if (!Number.isInteger(maxDepth) || maxDepth < 1) {
    throw new TypeError('maxDepth must be a positive integer');
  }
  if (!Number.isInteger(maxNodes) || maxNodes < 1) {
    throw new TypeError('maxNodes must be a positive integer');
  }

  const normalizedPortalUrl = normalizePortalUrl(portalUrl);

  return Object.freeze({
    portalUrl: normalizedPortalUrl,
    async matchesMemberIdentity({ phoneNumber, name } = {}) {
      const normalizedPhone = normalizePhone(phoneNumber);
      const normalizedMemberName = normalizeName(name);
      if (!normalizedPhone || !normalizedMemberName) {
        throw new TypeError('phoneNumber and name are required');
      }

      const { data: memberRows, error } = await client
        .from('members')
        .select(MEMBER_FIELDS)
        .eq('phone', normalizedPhone)
        .limit(10);
      if (error) throw error;

      return (Array.isArray(memberRows) ? memberRows : []).some(member =>
        matchesName(normalizedMemberName, member.name)
      );
    },
    async getMemberNetwork({ phoneNumber, user } = {}) {
      const normalizedPhone = normalizePhone(phoneNumber);
      if (!normalizedPhone) throw new TypeError('phoneNumber is required');

      const rootUser = user || null;
      const { data: memberRows, error: memberError } = await client
        .from('members')
        .select(MEMBER_FIELDS)
        .eq('phone', normalizedPhone)
        .limit(10);
      if (memberError) throw memberError;

      const memberProfiles = (Array.isArray(memberRows) ? memberRows : [])
        .map(member => ({
          name: displayText(member.name),
          status: displayText(member.status) || 'Unknown'
        }));
      const rootCounts = {
        left: countOrNull(rootUser?.left_count),
        right: countOrNull(rootUser?.right_count)
      };

      const descendants = [];
      const visitedPhones = new Set([normalizedPhone]);
      let frontier = [{ phone: normalizedPhone, side: null, depth: 0 }];
      let truncated = false;

      for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth += 1) {
        const parentPhones = [...new Set(frontier.map(node => node.phone).filter(Boolean))];
        if (parentPhones.length === 0) break;

        const { data: rows, error } = await client
          .from('users')
          .select(USER_FIELDS)
          .in('sponsor_phone', parentPhones)
          .limit(maxNodes - descendants.length + 1);
        if (error) throw error;

        const parentByPhone = new Map(frontier.map(node => [node.phone, node]));
        const nextFrontier = [];
        for (const row of Array.isArray(rows) ? rows : []) {
          const childPhone = normalizePhone(row.phone_number);
          if (!childPhone || visitedPhones.has(childPhone)) continue;
          visitedPhones.add(childPhone);

          if (descendants.length >= maxNodes) {
            truncated = true;
            break;
          }

          const parent = parentByPhone.get(normalizePhone(row.sponsor_phone));
          const legPosition = /left/i.test(row.leg_position || '')
            ? 'Left'
            : /right/i.test(row.leg_position || '')
              ? 'Right'
              : 'Unknown';
          const side = parent?.side || legPosition;
          descendants.push({
            phone: childPhone,
            name: displayText(row.name),
            side,
            legPosition,
            depth,
            isActive: isActive(row),
            status: getMemberStatus(row)
          });
          nextFrontier.push({ phone: childPhone, side, depth });
        }

        frontier = nextFrontier;
      }

      if (
        frontier.length > 0 &&
        (descendants.length >= maxNodes || descendants.some(node => node.depth === maxDepth))
      ) {
        truncated = true;
      }

      const calculatedCounts = {
        left: descendants.filter(node => node.side === 'Left' && node.isActive).length,
        right: descendants.filter(node => node.side === 'Right' && node.isActive).length
      };
      const leftCount = rootCounts.left ?? calculatedCounts.left;
      const rightCount = rootCounts.right ?? calculatedCounts.right;

      return {
        portalUrl: normalizedPortalUrl,
        memberships: memberProfiles,
        memberFound: memberProfiles.length > 0,
        downline: {
          leftActiveCount: leftCount,
          rightActiveCount: rightCount,
          totalActiveCount: leftCount + rightCount,
          matchedPairs: Math.min(leftCount, rightCount),
          tree: descendants.map(({ phone, ...node }) => node),
          truncated,
          depthLimit: maxDepth,
          nodeLimit: maxNodes
        }
      };
    }
  });
}

export {
  createBinaryTreeService,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_NODES
};
