interface MemberRecord {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'disabled' | 'archived';
  folderSlug: string;
  createdAt: string;
  activationToken?: string;
}

interface AdminState {
  organizationName: string;
  cloudRootFolder: string;
  backendUrl: string;
  adminKey: string;
  members: MemberRecord[];
}

declare const chrome: {
  storage: {
    local: {
      get(keys?: string[] | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      clear(): Promise<void>;
    };
  };
};

const STORAGE_KEY = 'buddyAdminState';
const defaultState: AdminState = {
  organizationName: '',
  cloudRootFolder: 'Scrambled Minds',
  backendUrl: '',
  adminKey: '',
  members: []
};
let state: AdminState = structuredClone(defaultState);

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as T;
};

function slugify(value: string): string {
  return value.trim().toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 48) || 'member';
}

function uniqueMemberId(name: string, email: string): string {
  return slugify(name || email.split('@')[0]);
}

function folderPath(member: MemberRecord): string {
  return `${state.cloudRootFolder}/${member.folderSlug}`;
}

function normalizeMemberEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!email) return '';
  return email.includes('@') ? email : `${email}@gmail.com`;
}

function isValidEmail(email: string): boolean {
  return /^[a-z0-9][a-z0-9._%+-]*@gmail\.com$/.test(email);
}

function normalizeBackendUrl(value: string): string {
  return value.trim().replace(/\/macros\/u\/\d+\/s\//, '/macros/s/');
}

async function persist(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

async function adminPost(action: string, payload: Record<string, unknown> = {}): Promise<Record<string, any>> {
  const backendUrl = normalizeBackendUrl(state.backendUrl);
  if (!backendUrl || !state.adminKey) throw new Error('Save the backend URL and admin key first');
  const response = await fetch(backendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, adminKey: state.adminKey, ...payload })
  });
  const result = await response.json() as Record<string, any>;
  if (!response.ok || !result.ok) throw new Error(result.error?.message || 'Backend request failed');
  return result;
}

async function syncMembersFromCloud(): Promise<void> {
  const result = await adminPost('listMembers');
  const cloudMembers = Array.isArray(result.members) ? result.members : [];
  state.members = cloudMembers.map((member: Record<string, any>) => ({
    id: String(member.id),
    name: String(member.name || member.id),
    email: String(member.email || ''),
    status: member.status === 'archived' ? 'archived' : member.status === 'disabled' ? 'disabled' : 'active',
    folderSlug: String(member.id),
    activationToken: member.activationToken,
    createdAt: String(member.createdAt || new Date().toISOString())
  }));
  await persist();
  render();
}

function render(): void {
  byId<HTMLInputElement>('organization-name').value = state.organizationName;
  byId<HTMLInputElement>('cloud-root-folder').value = state.cloudRootFolder;
  byId<HTMLInputElement>('backend-url').value = state.backendUrl;
  byId<HTMLInputElement>('admin-key').value = state.adminKey;
  byId<HTMLElement>('member-count').textContent = String(state.members.length);
  const signalMembers = document.getElementById('signal-members');
  if (signalMembers) signalMembers.textContent = String(state.members.length).padStart(2, '0');
  const empty = byId<HTMLElement>('empty-members');
  const list = byId<HTMLElement>('members');
  empty.hidden = state.members.length > 0;
  list.replaceChildren();

  for (const member of state.members) {
    const item = document.createElement('article');
    item.className = `member${member.status === 'disabled' ? ' disabled' : ''}`;
    const details = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = `${member.name} · ${member.status}`;
    const email = document.createElement('p');
    email.textContent = member.email;
    const meta = document.createElement('p');
    meta.className = 'member-meta';
    meta.textContent = `${member.id} → ${folderPath(member)}`;
    details.append(title, email, meta);

    const actions = document.createElement('div');
    actions.className = 'member-actions';
    const accessButton = document.createElement('button');
    accessButton.className = 'secondary icon-button';
    accessButton.type = 'button';
    accessButton.textContent = member.status === 'active' ? '⏻' : '↩';
    accessButton.title = member.status === 'active' ? 'Disable access (keeps cloud chats)' : 'Restore access';
    accessButton.setAttribute('aria-label', accessButton.title);
    accessButton.addEventListener('click', () => {
      const status = member.status === 'active' ? 'disabled' : 'active';
      void adminPost('setMemberStatus', { memberId: member.id, status }).then(result => {
        member.status = result.member.status;
        return persist();
      }).then(render).catch(error => { window.alert(error instanceof Error ? error.message : 'Could not update member access'); });
    });
    const permanentDelete = document.createElement('button');
    permanentDelete.className = 'danger icon-button';
    permanentDelete.type = 'button';
    permanentDelete.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
    permanentDelete.title = 'Delete member';
    permanentDelete.setAttribute('aria-label', permanentDelete.title);
    permanentDelete.addEventListener('click', () => {
      if (!window.confirm(`Delete ${member.name} from Scrambled Minds? The Drive folder and chats will be kept.`)) return;
      void adminPost('removeMember', { memberId: member.id }).then(() => {
        state.members = state.members.filter(item => item.id !== member.id);
        return persist();
      }).then(render).catch(error => { window.alert(error instanceof Error ? error.message : 'Could not delete member'); });
    });
    const refreshInvite = document.createElement('button');
    refreshInvite.className = 'secondary icon-button';
    refreshInvite.type = 'button';
    refreshInvite.textContent = '↻';
    refreshInvite.title = 'Refresh activation invite';
    refreshInvite.setAttribute('aria-label', refreshInvite.title);
    refreshInvite.addEventListener('click', () => {
      void adminPost('issueMemberToken', { memberId: member.id }).then(result => {
        member.activationToken = result.activationToken;
        return persist();
      }).then(() => { window.alert('Activation token refreshed. Export the invite again.'); render(); }).catch(error => { window.alert(error instanceof Error ? error.message : 'Could not refresh invite'); });
    });
    const invite = document.createElement('button');
    invite.className = 'secondary icon-button';
    invite.type = 'button';
    invite.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 20h14"/></svg>';
    invite.title = 'Export member invite';
    invite.setAttribute('aria-label', invite.title);
    invite.addEventListener('click', () => exportInvite(member));
    actions.append(accessButton, refreshInvite, permanentDelete, invite);
    item.append(details, actions);
    list.append(item);
  }
}

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportInvite(member: MemberRecord): void {
  downloadJson(`${member.id}-scrambled-minds-invite.json`, {
    organizationName: state.organizationName,
    memberId: member.id,
    memberName: member.name,
    email: member.email,
    folder: folderPath(member),
    backendUrl: state.backendUrl,
    activationToken: member.activationToken,
    issuedAt: new Date().toISOString(),
    note: 'This invitation contains no password or permanent cloud token.'
  });
}

byId<HTMLFormElement>('settings-form').addEventListener('submit', event => {
  event.preventDefault();
  state.organizationName = byId<HTMLInputElement>('organization-name').value.trim();
  state.cloudRootFolder = byId<HTMLInputElement>('cloud-root-folder').value.trim() || defaultState.cloudRootFolder;
  state.backendUrl = normalizeBackendUrl(byId<HTMLInputElement>('backend-url').value);
  state.adminKey = byId<HTMLInputElement>('admin-key').value.trim();
  void persist().then(async () => {
    const status = byId<HTMLElement>('settings-status');
    status.textContent = 'Saved locally; loading cloud members...';
    try {
      await syncMembersFromCloud();
      status.textContent = 'Saved and cloud members loaded';
    } catch {
      status.textContent = 'Saved locally';
    }
    window.setTimeout(() => { status.textContent = ''; }, 2200);
  });
});

byId<HTMLButtonElement>('refresh-members').addEventListener('click', async event => {
  const button = event.currentTarget as HTMLButtonElement;
  const status = byId<HTMLElement>('settings-status');
  if (button.disabled) return;
  button.disabled = true;
  button.classList.add('is-refreshing');
  button.textContent = 'Refreshing...';
  status.textContent = 'Refreshing cloud members...';
  try {
    await syncMembersFromCloud();
    status.textContent = 'Cloud members loaded';
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Could not load cloud members';
  } finally {
    button.disabled = false;
    button.classList.remove('is-refreshing');
    button.textContent = 'Refresh from cloud';
  }
});

byId<HTMLButtonElement>('test-connection').addEventListener('click', async () => {
  const status = byId<HTMLElement>('settings-status');
  const backendUrl = normalizeBackendUrl(byId<HTMLInputElement>('backend-url').value);
  if (!backendUrl) { status.textContent = 'Enter the backend URL first'; return; }
  status.textContent = 'Testing...';
  try {
    const response = await fetch(backendUrl, { method: 'GET' });
    const result = await response.json() as { ok?: boolean };
    status.textContent = response.ok && result.ok ? 'Backend is reachable' : 'Backend returned an error';
  } catch {
    status.textContent = 'Could not reach backend';
  }
});

byId<HTMLInputElement>('member-email').addEventListener('blur', event => {
  const input = event.currentTarget as HTMLInputElement;
  input.value = normalizeMemberEmail(input.value);
});

byId<HTMLFormElement>('member-form').addEventListener('submit', async event => {
  event.preventDefault();
  const name = byId<HTMLInputElement>('member-name').value.trim();
  const emailInput = byId<HTMLInputElement>('member-email');
  const email = normalizeMemberEmail(emailInput.value);
  emailInput.value = email;
  const status = byId<HTMLElement>('member-status');
  if (!name || !isValidEmail(email)) { status.textContent = 'Enter a valid name and email'; return; }
  if (state.members.some(member => member.email === email)) { status.textContent = 'That email is already registered'; return; }
  const id = uniqueMemberId(name, email);
  const backendUrl = normalizeBackendUrl(state.backendUrl);
  if (!backendUrl || !state.adminKey) { status.textContent = 'Save the backend URL and admin key first'; return; }
  status.textContent = 'Checking whether this name already exists...';
  try {
    let reuseExisting = false;
    const cloudList = await adminPost('listMembers');
    const cloudMembers = Array.isArray(cloudList.members) ? cloudList.members : [];
    const existingCloudMember = cloudMembers.find((member: Record<string, any>) => String(member.id || '').toLowerCase() === id.toLowerCase());
    let existingFolder = false;
    if (!existingCloudMember) {
      try {
        const folderCheck = await adminPost('checkMemberFolder', { memberId: id });
        existingFolder = Boolean(folderCheck.exists);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (!message.toLowerCase().includes('unsupported action')) throw error;
      }
    }
    if (existingCloudMember || existingFolder) {
      reuseExisting = window.confirm(`A user with the name "${name}" already exists.\n\nAdd this user to the existing folder?\n\nChoose Cancel to use a different name.`);
      if (!reuseExisting) { status.textContent = `A user with the name "${name}" already exists. Use a different name.`; return; }
    }
    status.textContent = reuseExisting ? 'Adding to the existing folder...' : 'Creating cloud folders...';
    const create = async (reuseFolder = false): Promise<{ ok?: boolean; member?: { activationToken?: string }; error?: { code?: string; message?: string } }> => {
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'addMember', adminKey: state.adminKey, memberId: id, name, email, reuseExisting: reuseFolder })
      });
      const result = await response.json() as { ok?: boolean; member?: { activationToken?: string }; error?: { code?: string; message?: string } };
      if (!response.ok || !result.ok) throw Object.assign(new Error(result.error?.message || 'Cloud provisioning failed'), { code: result.error?.code });
      return result;
    };
    let result: { ok?: boolean; member?: { activationToken?: string }; error?: { code?: string; message?: string } };
    try {
      result = await create(reuseExisting);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== 'MEMBER_FOLDER_EXISTS' && code !== 'MEMBER_ID_IN_USE') throw error;
      const reuse = window.confirm(`A user with the name "${name}" already exists.\n\nAdd this user to the existing folder?\n\nChoose Cancel to use a different name.`);
      if (!reuse) { status.textContent = `A user with the name "${name}" already exists. Use a different name.`; return; }
      result = await create(true);
    }
    await syncMembersFromCloud();
    byId<HTMLFormElement>('member-form').reset();
    status.textContent = `Added ${id}; cloud folders created`;
    render();
    window.setTimeout(() => { status.textContent = ''; }, 2600);
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Cloud provisioning failed';
  }
});

byId<HTMLButtonElement>('export-button').addEventListener('click', () => {
  const { adminKey: _privateKey, ...safeState } = state;
  void _privateKey;
  downloadJson('scrambled-minds-admin-registry.json', safeState);
});
byId<HTMLButtonElement>('clear-button').addEventListener('click', () => {
  if (!window.confirm('Clear only this browser\'s local admin cache? Cloud members, Drive folders, chats, and access permissions will not be deleted.')) return;
  if (window.prompt('To confirm, type CLEAR LOCAL CACHE') !== 'CLEAR LOCAL CACHE') return;
  const preserved = { backendUrl: state.backendUrl, adminKey: state.adminKey, organizationName: state.organizationName, cloudRootFolder: state.cloudRootFolder };
  state = { ...structuredClone(defaultState), ...preserved, members: [] };
  void chrome.storage.local.set({ [STORAGE_KEY]: state }).then(render);
});

void chrome.storage.local.get([STORAGE_KEY]).then(result => {
  const saved = result[STORAGE_KEY];
  if (saved && typeof saved === 'object') {
    const candidate = saved as Partial<AdminState>;
    state = { ...defaultState, ...candidate, members: Array.isArray(candidate.members) ? candidate.members : [] };
  }
  render();
});

export { defaultState, folderPath, isValidEmail, slugify, uniqueMemberId };
