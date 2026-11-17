const budgetEntries = (() => {
  const repository = 'ivyjoycedegracia-pixel/taiwan-2027';
  const ownerLogin = repository.split('/')[0];
  const ownerId = 289357925;
  const label = 'dashboard-entry';
  const marker = '<!-- taiwan-budget-entry:v1 -->';
  const dashboardUrl = 'https://ivyjoycedegracia-pixel.github.io/taiwan-2027/taiwan-2027-dashboard.html';
  const adminUrl = dashboardUrl.replace('.html', '-admin.html');
  const groups = new Set(['five', 'regular', 'senior']);

  function textField(value, limit) {
    return value === null || typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
  }

  function amount(value) {
    return typeof value === 'number' && Number.isFinite(value) &&
      value >= 0 && value <= Number.MAX_SAFE_INTEGER / 100;
  }

  function validSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.values) || snapshot.values.length !== 5 ||
        !Array.isArray(snapshot.groups) || snapshot.groups.length === 0 ||
        snapshot.groups.length > groups.size || !snapshot.groups.every(group => groups.has(group))) return false;

    const [item, details, quote, source, perPerson] = snapshot.values;
    return textField(item, 100) && textField(details, 400) && textField(source, 70) &&
      (amount(quote) || textField(quote, 100)) && (perPerson === null || amount(perPerson));
  }

  function valid(change) {
    if (!validSnapshot(change)) return false;
    const [item, details] = change.values;
    if (change.action === 'add') return Boolean(item);
    return change.action === 'edit' && (item || details) &&
      typeof change.target === 'string' && change.target.length <= 550 &&
      (change.before === undefined || validSnapshot(change.before));
  }

  function decode(issue) {
    if (issue.user?.id !== ownerId || !['open', 'closed'].includes(issue.state) || issue.pull_request ||
        !issue.labels?.some(tag => tag.name === label) ||
        !Number.isSafeInteger(issue.number) || typeof issue.body !== 'string') return null;

    const [first, blank, fence, payload, close] = issue.body.split(/\r?\n/, 5);
    if (first !== marker || blank !== '' || fence !== '```json' || close !== '```' || payload.length > 7500) return null;
    try {
      const change = JSON.parse(payload);
      if (!valid(change)) return null;
      return {
        ...change,
        number: issue.number,
        state: issue.state,
        author: issue.user.login || ownerLogin,
        date: issue.created_at,
        url: 'https://github.com/' + repository + '/issues/' + issue.number
      };
    } catch {
      return null;
    }
  }

  async function load({ includeClosed = false } = {}) {
    const endpoint = new URL('https://api.github.com/repos/' + repository + '/issues');
    endpoint.search = new URLSearchParams({
      state: includeClosed ? 'all' : 'open', labels: label, creator: ownerLogin,
      per_page: '100', sort: 'created', direction: 'asc'
    });
    const changes = [];
    const signal = AbortSignal.timeout(12000);
    for (let page = 1; ; page++) {
      endpoint.searchParams.set('page', page);
      const response = await fetch(endpoint, { credentials: 'omit', signal });
      if (!response.ok) throw new Error('Shared entries returned HTTP ' + response.status);
      const issues = await response.json();
      for (const issue of issues) {
        if (!includeClosed && issue.state !== 'open') continue;
        const change = decode(issue);
        if (change) changes.push(change);
      }
      if (!response.headers.get('link')?.includes('rel="next"')) return changes;
    }
  }

  function compose(change, name) {
    const title = 'Budget ' + (change.action === 'add' ? 'entry: ' : 'edit: ') + name;
    const body = [
      marker, '', '```json', JSON.stringify(change), '```', '',
      '[Return to the dashboard admin page](' + adminUrl + ')'
    ].join('\n');
    const url = new URL('https://github.com/' + repository + '/issues/new');
    url.search = new URLSearchParams({ title, body, labels: label });
    return url;
  }

  function project(tables, changes, { history = false } = {}) {
    const directory = new Map();
    const workbook = new Map();
    for (const table of tables) {
      const records = table.rows.map((values, index) => {
        const id = 'workbook:' + JSON.stringify([table.id, ...values.slice(0, 2)]);
        const record = {
          id, values, groups: [table.id], original: values,
          sharedFare: index === table.mergedCostRow + 1
        };
        if (values.some(value => value !== null)) directory.set(id, record);
        return record;
      });
      workbook.set(table.id, records);
    }

    const additions = [];
    const trail = [];
    const seen = new Set();
    for (const change of [...changes].sort((a, b) => a.number - b.number)) {
      if (seen.has(change.number)) continue;
      seen.add(change.number);
      const isAdd = change.action === 'add';
      const id = isAdd ? 'entry:' + change.number : change.target;
      const record = directory.get(id);
      const canEdit = record && (!record.original ||
        change.groups.length === 1 && change.groups[0] === record.groups[0]);
      let status = 'Published';
      if (change.state === 'closed') status = 'Withdrawn';
      else if (!isAdd && !canEdit) status = 'Not applied';

      const values = change.values.slice();
      if (record?.sharedFare) values[4] = null;
      if (history) {
        const earlier = record ? { values: record.values.slice(0, 5), groups: record.groups } : null;
        trail.push({
          id, change, status, before: change.before ?? earlier,
          after: { values, groups: change.groups }
        });
      }

      if (status !== 'Published') continue;
      if (isAdd) {
        const newRecord = { id, values: [...values, null], groups: change.groups };
        additions.push(newRecord);
        directory.set(id, newRecord);
      } else {
        record.values = [...values, record.original?.[5] ?? null];
        if (!record.original) record.groups = change.groups;
      }
    }

    return {
      directory,
      trail,
      tables: tables.map(table => {
        const original = workbook.get(table.id);
        const extra = additions.filter(record => record.groups.includes(table.id));
        const adjustment = original.reduce((sum, row) => sum + (row.values[4] ?? 0) - (row.original[4] ?? 0), 0);
        const additionalCost = extra.reduce((sum, row) => sum + (row.values[4] ?? 0), 0);
        return {
          ...table,
          rows: [...original, ...extra].map(row => row.values),
          total: table.total + adjustment + additionalCost
        };
      })
    };
  }

  return { compose, load, project, valid };
})();
