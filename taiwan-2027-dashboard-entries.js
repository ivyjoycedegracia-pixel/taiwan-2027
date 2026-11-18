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

  const fieldChecks = [
    value => textField(value, 100),
    value => textField(value, 400),
    value => amount(value) || textField(value, 100),
    value => textField(value, 70),
    value => value === null || amount(value)
  ];

  function validSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.values) || snapshot.values.length !== 5 ||
        !Array.isArray(snapshot.groups) || snapshot.groups.length === 0 ||
        snapshot.groups.length > groups.size || !snapshot.groups.every(group => groups.has(group))) return false;

    return snapshot.values.every((value, index) => fieldChecks[index](value));
  }

  function validBatch(change) {
    const { columns, values, targets, name, membership } = change;
    if (!Array.isArray(columns) || (!columns.length && !membership) || new Set(columns).size !== columns.length ||
        !columns.every(index => Number.isInteger(index) && index >= 0 && index < fieldChecks.length)) return false;

    const validFields = fields => Array.isArray(fields) && fields.length === columns.length &&
      fields.every((value, index) => fieldChecks[columns[index]](value));
    if (!validFields(values) || typeof name !== 'string' || !textField(name, 400) ||
        !Array.isArray(targets) || !targets.length ||
        !targets.every(target => target && groups.has(target.group) &&
          typeof target.id === 'string' && target.id.length <= 550 && validFields(target.before))) return false;

    const scope = targets.map(target => target.group);
    if (!validGroups(scope)) return false;
    if (change.action === 'edit-all') return scope.length === groups.size && membership === undefined;
    if (membership === undefined) return true;
    return membership && validGroups(membership.before) && validGroups(membership.after) &&
      sameGroups(scope, membership.before) && !sameGroups(membership.before, membership.after);
  }

  function validGroups(values) {
    return Array.isArray(values) && values.length > 0 && new Set(values).size === values.length &&
      values.every(group => groups.has(group));
  }

  function sameGroups(a, b) {
    return a.length === b.length && a.every(group => b.includes(group));
  }

  function valid(change) {
    if (change?.action === 'edit-all' || change?.action === 'edit-scope') return validBatch(change);
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
    const count = change.targets?.length ?? 0;
    const suffix = count > 1 ? ' (' + count + ' tabs)' : '';
    const title = 'Budget ' + (change.action === 'add' ? 'entry: ' : 'edit: ') + name + suffix;
    const body = [
      marker, '', '```json', JSON.stringify(change), '```', '',
      '[Return to the dashboard admin page](' + adminUrl + ')'
    ].join('\n');
    const url = new URL('https://github.com/' + repository + '/issues/new');
    url.search = new URLSearchParams({ title, body, labels: label });
    return url;
  }

  function workbookId(group, values) {
    return 'workbook:' + JSON.stringify([group, ...values.slice(0, 2)]);
  }

  function matchingWorkbookRows(directory, record) {
    if (!record?.original) return [];
    const [item] = record.original;
    if (item) {
      const sameItem = [...directory.values()].filter(row => row.original?.[0] === item);
      const byGroup = [...groups].map(group => sameItem.filter(row => row.groups[0] === group));
      if (byGroup.every(rows => rows.length <= 1)) return byGroup.flat();
    }
    return [...groups].map(group => directory.get(workbookId(group, record.original))).filter(Boolean);
  }

  function groupValues(record, group) {
    return record.groupValues?.get(group) ?? record.values;
  }

  function entryScopes(directory, record) {
    if (!record) return [];
    if (record.original) {
      return matchingWorkbookRows(directory, record).map(row => ({
        id: row.id, group: row.groups[0], record: row, values: row.values
      }));
    }
    return [...groups].filter(group => record.groups.includes(group)).map(group => ({
      id: record.id, group, record, values: groupValues(record, group)
    }));
  }

  function applyBatch(change, directory, trail) {
    const first = directory.get(change.targets[0].id);
    const scopes = new Map(entryScopes(directory, first).map(scope => [scope.group, scope.id]));
    const { membership } = change;
    const rows = change.targets.map(target => {
      const record = directory.get(target.id);
      const after = record ? groupValues(record, target.group).slice(0, 5) : Array(5).fill(null);
      const before = after.slice();
      change.columns.forEach((column, index) => {
        before[column] = target.before[index];
        after[column] = change.values[index];
      });
      return { target, record, before, after };
    });
    const canApply = (change.action !== 'edit-all' || first?.original) &&
      (!membership || first && !first.original && sameGroups(first.groups, membership.before)) &&
      rows.every(({ target, record, after }) => scopes.get(target.group) === target.id &&
      (after[0] || after[1]) && !(record.sharedFare && change.columns.includes(4)));

    let status = 'Not applied';
    if (change.state === 'closed') status = 'Withdrawn';
    else if (canApply) status = 'Published';
    for (const { target, record, before, after } of rows) {
      if (trail && change.columns.length) {
        const rowGroups = [target.group];
        trail.push({
          id: target.id, name: after[0] || after[1] || change.name, change, status,
          before: { values: before, groups: rowGroups },
          after: { values: after, groups: rowGroups }
        });
      }
      if (status === 'Published') {
        if (record.original) record.values = [...after, record.original[5]];
        else record.groupValues.set(target.group, [...after, null]);
      }
    }
    if (membership) {
      const values = rows[0].after;
      if (trail) trail.push({
        id: change.targets[0].id, name: values[0] || values[1] || change.name, change, status,
        before: { values, groups: membership.before },
        after: { values, groups: membership.after }
      });
      if (status === 'Published') {
        for (const group of membership.after) {
          if (!first.groups.includes(group)) first.groupValues.set(group, [...values, null]);
        }
        for (const group of first.groups) {
          if (!membership.after.includes(group)) first.groupValues.delete(group);
        }
        first.groups = membership.after;
      }
    }
  }

  function project(tables, changes, { history = false } = {}) {
    const directory = new Map();
    const workbook = new Map();
    for (const table of tables) {
      const records = table.rows.map((values, index) => {
        const id = workbookId(table.id, values);
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
      if (change.action === 'edit-all' || change.action === 'edit-scope') {
        applyBatch(change, directory, history ? trail : null);
        continue;
      }
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
        const newRecord = { id, values: [...values, null], groups: change.groups, groupValues: new Map() };
        additions.push(newRecord);
        directory.set(id, newRecord);
      } else {
        record.values = [...values, record.original?.[5] ?? null];
        if (!record.original) {
          record.groups = change.groups;
          record.groupValues.clear();
        }
      }
    }

    return {
      directory,
      trail,
      tables: tables.map(table => {
        const original = workbook.get(table.id);
        const extra = additions.filter(record => record.groups.includes(table.id))
          .map(record => groupValues(record, table.id));
        const adjustment = original.reduce((sum, row) => sum + (row.values[4] ?? 0) - (row.original[4] ?? 0), 0);
        const additionalCost = extra.reduce((sum, values) => sum + (values[4] ?? 0), 0);
        return {
          ...table,
          rows: [...original.map(row => row.values), ...extra],
          total: table.total + adjustment + additionalCost
        };
      })
    };
  }

  return { compose, entryScopes, load, project, valid };
})();
