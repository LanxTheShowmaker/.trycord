/* Shared components: contextbar, server cards, rail, menus, palette, modals. */
(function () {
  var Ui = window.TrycordUi;

  // --- contextbar (kept contract: title, subtitle, actions) -----------------
  function setTopbar(title, subtitle, actionsHtml) {
    document.getElementById('page-title').textContent = title || '';
    document.getElementById('page-sub').textContent = subtitle || '';
    var right = document.querySelector('.topbar-right');
    var old = document.getElementById('topbar-actions');
    if (old) old.remove();
    if (actionsHtml) {
      var wrap = document.createElement('div');
      wrap.id = 'topbar-actions';
      wrap.className = 'row';
      wrap.innerHTML = actionsHtml;
      right.insertBefore(wrap, right.firstChild);
    }
  }

  // --- server cards (contract: data-server, data-open, data-fav) ------------
  function favStar(serverId, isFav) {
    return '<button type="button" class="icon-btn fav-btn" data-fav="' + Ui.esc(serverId) + '" ' +
      'title="' + (isFav ? 'Remove from favorites' : 'Add to favorites') + '" ' +
      'aria-pressed="' + (isFav ? 'true' : 'false') + '" aria-label="Toggle favorite">' +
      Ui.icon('star') + '</button>';
  }

  function serverCard(s, opts) {
    opts = opts || {};
    var isFav = TrycordState.isFav(s.id);
    var desc = s.description || 'No description.';
    return (
      '<article class="server-card" data-server="' + Ui.esc(s.id) + '">' +
      '<div class="head">' + Ui.avatarHtml(s.name) +
      '<div class="titles"><h3>' + Ui.esc(s.name) + '</h3>' +
      '<div class="meta"><span>' + (s.member_count || 0) + ' member' + ((s.member_count || 0) === 1 ? '' : 's') + '</span>' +
      '<span aria-hidden="true">·</span><span>' + (s.channel_count !== undefined ? s.channel_count : '?') + ' channels</span></div>' +
      '</div>' + favStar(s.id, isFav) + '</div>' +
      '<p class="desc">' + Ui.esc(desc) + '</p>' +
      '<div class="meta">' +
      (s.is_owner ? Ui.badge('Owner', 'owner') : Ui.badge('Member', '')) +
      (s.is_public !== undefined ? (s.is_public ? Ui.badge('Public', 'pub') : Ui.badge('Private', 'priv')) : '') +
      (opts.extra || '') +
      '</div>' +
      '<div class="foot"><span class="muted small">Active ' + Ui.timeAgo(s.last_activity_at) + '</span>' +
      '<span class="grow"></span>' +
      '<button type="button" class="btn btn-sm" data-open="' + Ui.esc(s.id) + '">Open →</button></div>' +
      '</article>'
    );
  }

  function wireCards(root, onFavChange) {
    root.querySelectorAll('[data-open]').forEach((b) => {
      b.onclick = () => { location.hash = '#/server/' + encodeURIComponent(b.dataset.open); };
    });
    root.querySelectorAll('[data-fav]').forEach((b) => {
      b.onclick = (e) => {
        e.stopPropagation();
        var nowFav = TrycordState.toggleFav(b.dataset.fav);
        b.setAttribute('aria-pressed', nowFav ? 'true' : 'false');
        b.title = nowFav ? 'Remove from favorites' : 'Add to favorites';
        if (onFavChange) onFavChange(b.dataset.fav, nowFav);
      };
    });
  }

  // --- global rail -----------------------------------------------------------
  var RAIL_NAV = [
    { hash: '#/home', label: 'Home', icon: 'home' },
    { hash: '#/discover', label: 'Discover', icon: 'compass' },
    { hash: '#/servers', label: 'Your Servers', icon: 'grid' },
    { hash: '#/activity', label: 'Recent Activity', icon: 'clock' },
    { hash: '#/favorites', label: 'Favorites', icon: 'star' },
  ];

  function renderRail(active, activeServerId, unreadServers) {
    unreadServers = unreadServers || {};
    var nav = document.getElementById('rail-nav');
    nav.innerHTML = RAIL_NAV.map((item) => {
      var isActive = active === item.hash;
      return '<button type="button" class="rail-btn' + (isActive ? ' active' : '') + '" data-rail="' + item.hash + '"' +
        ' title="' + Ui.esc(item.label) + '" aria-label="' + Ui.esc(item.label) + '"' +
        (isActive ? ' aria-current="page"' : '') + '>' + Ui.icon(item.icon) + '</button>';
    }).join('');
    nav.querySelectorAll('[data-rail]').forEach((b) => {
      b.onclick = () => { location.hash = b.dataset.rail; };
    });

    var wrap = document.getElementById('rail-servers');
    wrap.innerHTML = '';
    TrycordState.servers.forEach((s) => {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rail-srv' + (s.id === activeServerId ? ' active' : '') +
        (TrycordState.isMutedServer(s.id) ? ' dim' : '');
      b.title = s.name;
      b.setAttribute('aria-label', 'Open server ' + s.name);
      if (s.id === activeServerId) b.setAttribute('aria-current', 'page');
      b.innerHTML = Ui.avatarHtml(s.name) + (unreadServers[s.id] ? '<span class="rail-dot" aria-hidden="true"></span>' : '');
      b.onclick = () => { location.hash = '#/server/' + encodeURIComponent(s.id); };
      b.oncontextmenu = (e) => {
        e.preventDefault();
        serverMenu(b, s.id);
      };
      wrap.appendChild(b);
    });

    var add = document.getElementById('rail-add');
    add.innerHTML = Ui.icon('plus');
    add.onclick = () => createServerModal();
  }

  function renderMobilebar(active) {
    var bar = document.getElementById('mobilebar');
    var items = [
      { hash: '#/home', label: 'Home', icon: 'home' },
      { hash: '#/servers', label: 'Servers', icon: 'grid' },
      { hash: '#/discover', label: 'Discover', icon: 'compass' },
      { hash: '#/activity', label: 'Activity', icon: 'clock' },
    ];
    bar.innerHTML = items.map((item) =>
      '<button type="button" class="mnav' + (active === item.hash ? ' active' : '') + '" data-m="' + item.hash + '"' +
      (active === item.hash ? ' aria-current="page"' : '') + '>' +
      Ui.icon(item.icon) + '<span>' + Ui.esc(item.label) + '</span></button>').join('') +
      '<button type="button" class="mnav" data-m="#/favorites">' + Ui.icon('star') + '<span>More</span></button>';
    bar.querySelectorAll('[data-m]').forEach((b) => {
      b.onclick = () => { location.hash = b.dataset.m; };
    });
  }

  // --- account surfaces -------------------------------------------------------
  function renderAccount(online) {
    var u = TrycordState.user;
    var name = u ? (u.displayName || u.username) : '–';
    var sub = u ? '@' + u.username : '–';
    var av = Ui.avatarHtml(name, 'sm round');
    var chip = document.getElementById('rail-avatar-img');
    if (chip) chip.innerHTML = av;
    var st = document.getElementById('rail-status');
    if (st) st.className = 'status-dot' + (online === false ? ' off' : '');
    var ab = document.getElementById('avatar-btn');
    if (ab) {
      ab.innerHTML = av;
      ab.setAttribute('aria-label', 'Account menu for ' + name);
    }
    var aa = document.getElementById('account-avatar');
    if (aa) aa.innerHTML = Ui.avatarHtml(name, 'sm round');
    var an = document.getElementById('account-name');
    if (an) an.textContent = name;
    var as = document.getElementById('account-sub');
    if (as) as.textContent = sub;
  }

  function renderUser() {
    renderAccount(true);
  }

  function accountMenu(anchor) {
    Ui.menu(anchor, [
      { icon: 'users', label: 'Profile', action: () => { location.hash = '#/profile'; } },
      { icon: 'cog', label: 'Settings', action: () => { location.hash = '#/settings'; } },
      {
        icon: 'eye', label: 'Appearance', hint: TrycordState.settings.theme === 'light' ? 'Light' : 'Dark',
        action: () => { location.hash = '#/settings'; },
      },
      { sep: true },
      { icon: 'out', label: 'Log out', danger: true, action: () => Trycord.logout() },
    ], { label: (TrycordState.user && (TrycordState.user.displayName || TrycordState.user.username)) || 'Account' });
  }

  function closeMenus() {
    Ui.closeMenu();
  }

  function toggleMenu(anchor) {
    accountMenu(anchor);
  }

  // --- server context menu ------------------------------------------------------
  function serverMenu(anchor, serverId) {
    var s = TrycordState.serverById(serverId);
    if (!s) return;
    var isFav = TrycordState.isFav(serverId);
    var muted = TrycordState.isMutedServer(serverId);
    Ui.menu(anchor, [
      { icon: 'grid', label: 'Open server', action: () => { location.hash = '#/server/' + encodeURIComponent(serverId); } },
      { icon: 'star', label: isFav ? 'Remove favorite' : 'Add favorite', action: () => { TrycordState.toggleFav(serverId); Trycord.rerender(); } },
      { icon: muted ? 'bell' : 'bell-off', label: muted ? 'Unmute server' : 'Mute server', action: () => { TrycordState.toggleMuteServer(serverId); Trycord.rerender(); } },
      { sep: true },
      { icon: 'link', label: 'Copy invite code', action: () => copyInviteCode(serverId) },
      { icon: 'cog', label: 'Server settings', hidden: !TrycordState.can(serverId, 'MANAGE_SERVER'), action: () => { location.hash = '#/server/' + encodeURIComponent(serverId) + '/settings'; } },
      { sep: true },
      { icon: 'out', label: 'Leave server', danger: true, hidden: !!s.is_owner, action: () => leaveServerFlow(serverId, s.name) },
    ], { label: s.name });
  }

  async function copyInviteCode(serverId) {
    try {
      var d = await TrycordApi.serverDetail(serverId);
      try {
        await navigator.clipboard.writeText(d.join_code);
        Ui.toast('Invite code copied.', 'good');
      } catch (e) { Ui.toast('Invite code: ' + d.join_code, 'info'); }
    } catch (e) { Ui.toast(Ui.friendlyError(e), 'bad'); }
  }

  async function leaveServerFlow(serverId, name) {
    var yes = await Ui.confirmDialog({
      title: 'Leave ' + (name || 'server') + '?',
      message: 'You can rejoin later with a new invite.',
      confirmText: 'Leave',
    });
    if (!yes) return;
    try {
      await TrycordApi.leaveServer(serverId);
      await Trycord.refreshServers();
      Ui.toast('Left server.', 'info');
      if ((location.hash || '').indexOf(encodeURIComponent(serverId)) !== -1) location.hash = '#/servers';
      else Trycord.rerender();
    } catch (e) { Ui.toast(Ui.friendlyError(e), 'bad'); }
  }

  // --- channel context menu -------------------------------------------------------
  function channelMenu(anchor, opts) {
    // opts: { serverId, channelId, name, canManage, onChanged }
    var muted = TrycordState.isMutedChannel(opts.channelId);
    Ui.menu(anchor, [
      { icon: 'hash', label: 'Open channel', action: () => { location.hash = '#/server/' + encodeURIComponent(opts.serverId) + '/chat/' + encodeURIComponent(opts.channelId); } },
      { icon: 'check', label: 'Mark as read', action: () => { TrycordState.markRead(opts.channelId); if (opts.onChanged) opts.onChanged(); } },
      { icon: muted ? 'bell' : 'bell-off', label: muted ? 'Unmute channel' : 'Mute channel', action: () => { TrycordState.toggleMuteChannel(opts.channelId); if (opts.onChanged) opts.onChanged(); } },
      {
        icon: 'link', label: 'Copy link', action: () => {
          var url = location.origin + location.pathname + '#/server/' + encodeURIComponent(opts.serverId) + '/chat/' + encodeURIComponent(opts.channelId);
          if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => Ui.toast('Channel link copied.', 'good'), () => Ui.toast(url, 'info'));
          else Ui.toast(url, 'info');
        },
      },
      { sep: true },
      { icon: 'cog', label: 'Channel settings', hidden: !opts.canManage, action: () => { location.hash = '#/server/' + encodeURIComponent(opts.serverId) + '/settings'; } },
    ], { label: '#' + opts.name });
  }

  // --- command palette (Ctrl+K): servers, channels, actions -------------------------
  var chanCache = {}; // serverId -> { categories, channels }

  async function ensureChannels(serverId) {
    if (chanCache[serverId]) return chanCache[serverId];
    try {
      var data = await TrycordApi.channels(serverId);
      chanCache[serverId] = data;
    } catch (e) {
      chanCache[serverId] = { categories: [], channels: [] };
    }
    return chanCache[serverId];
  }

  function openPalette() {
    Ui.closeMenu();
    var root = document.getElementById('palette-root');
    root.innerHTML = '';
    var scrim = document.createElement('div');
    scrim.className = 'palette-scrim';
    var box = document.createElement('div');
    box.className = 'palette';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Quick switcher');
    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Jump to a server or channel…';
    input.setAttribute('aria-label', 'Jump to a server or channel');
    var list = document.createElement('div');
    list.className = 'palette-list';
    list.setAttribute('role', 'listbox');
    box.append(input, list);
    scrim.appendChild(box);
    root.appendChild(scrim);

    var items = [];
    var sel = 0;
    function close() {
      root.innerHTML = '';
      document.removeEventListener('keydown', onKey, true);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); paint(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
      if (e.key === 'Enter' && items[sel]) { close(); items[sel].go(); }
    }
    function paint() {
      list.innerHTML = '';
      if (!items.length) {
        list.innerHTML = '<div class="state" style="border:0"><p class="muted">No matches. Try a server or channel name.</p></div>';
        return;
      }
      items.forEach((it, i) => {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'palette-item' + (i === sel ? ' sel' : '');
        b.setAttribute('role', 'option');
        b.setAttribute('aria-selected', i === sel ? 'true' : 'false');
        b.innerHTML = Ui.icon(it.icon) + '<span></span><span class="sub"></span>';
        b.querySelector('span').textContent = it.label;
        b.querySelector('.sub').textContent = it.sub || '';
        b.onmouseenter = () => { sel = i; paint(); };
        b.onclick = () => { close(); it.go(); };
        list.appendChild(b);
      });
    }
    async function rebuild() {
      var term = input.value.trim().toLowerCase();
      items = [];
      TrycordState.servers.forEach((s) => {
        if (!term || s.name.toLowerCase().includes(term)) {
          items.push({
            icon: 'grid', label: s.name, sub: 'Server',
            go: () => { location.hash = '#/server/' + encodeURIComponent(s.id); },
          });
        }
      });
      if (term) {
        var all = await Promise.all(TrycordState.servers.map((s) => ensureChannels(s.id).then((d) => ({ s, d }))));
        all.forEach(({ s, d }) => {
          (d.channels || []).forEach((c) => {
            if (c.name.toLowerCase().includes(term)) {
              items.push({
                icon: 'hash', label: '# ' + c.name, sub: s.name,
                go: () => { location.hash = '#/server/' + encodeURIComponent(s.id) + '/chat/' + encodeURIComponent(c.id); },
              });
            }
          });
        });
      }
      items.push(
        { icon: 'plus', label: 'Create a server', sub: 'Action', go: () => createServerModal() },
        { icon: 'link', label: 'Join with invite code', sub: 'Action', go: () => { location.hash = '#/join'; } },
        { icon: 'compass', label: 'Browse Discover', sub: 'Action', go: () => { location.hash = '#/discover'; } }
      );
      sel = 0;
      paint();
    }
    var t = null;
    input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(rebuild, 120); });
    scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(); });
    document.addEventListener('keydown', onKey, true);
    rebuild();
    setTimeout(() => input.focus(), 0);
  }

  // --- create server: identity -> review ----------------------------------------------
  function createServerModal(onCreated) {
    var step = 1;
    var data = { name: '', description: '', isPublic: false };
    var body = document.createElement('div');
    function paint() {
      body.innerHTML =
        '<div class="steps" aria-hidden="true"><span class="' + (step >= 1 ? 'done' : '') + '"></span><span class="' + (step >= 2 ? 'done' : '') + '"></span></div>' +
        (step === 1
          ? '<label class="field"><span>Server name</span><input type="text" id="cs-name" maxlength="64" placeholder="e.g. Study Group" value="' + Ui.esc(data.name) + '" /></label>' +
            '<label class="field"><span>Description (optional)</span><textarea id="cs-desc" maxlength="500" placeholder="What is this server about?">' + Ui.esc(data.description) + '</textarea></label>' +
            '<label class="switch"><input type="checkbox" id="cs-public"' + (data.isPublic ? ' checked' : '') + ' /><span class="track" aria-hidden="true"></span>List publicly in Discover</label>'
          : '<p class="muted">Review your new server:</p>' +
            '<div class="preview-card"><div class="row">' + Ui.avatarHtml(data.name || '?') +
            '<div><strong>' + Ui.esc(data.name) + '</strong><br><small class="muted">' +
            Ui.esc(data.description || 'No description.') + '</small></div></div>' +
            '<p class="small muted" style="margin:0.6rem 0 0">' +
            (data.isPublic ? 'Public — listed in Discover.' : 'Private — invite only.') +
            ' A #general channel and default roles are created automatically.</p></div>');
      if (step === 1) {
        var n = body.querySelector('#cs-name');
        n.addEventListener('input', () => { data.name = n.value; });
        var d = body.querySelector('#cs-desc');
        d.addEventListener('input', () => { data.description = d.value; });
        var p = body.querySelector('#cs-public');
        p.addEventListener('change', () => { data.isPublic = p.checked; });
        setTimeout(() => n.focus(), 0);
      }
    }
    function openStep() {
      paint();
      var actions = step === 1
        ? [
          { id: 'cancel', label: 'Cancel' },
          {
            id: 'next', label: 'Continue', primary: true,
            onClick: (close) => {
              if (!data.name.trim()) {
                Ui.fieldError(body.querySelector('#cs-name'), 'Give your server a name.');
                body.querySelector('#cs-name').focus();
                return;
              }
              step = 2;
              close();
              openStep();
            },
          },
        ]
        : [
          { id: 'back', label: 'Back', onClick: (close) => { step = 1; close(); openStep(); } },
          { id: 'cancel', label: 'Cancel' },
          {
            id: 'create', label: 'Create server', primary: true,
            onClick: async (close, btns) => {
              Ui.setLoading(btns.primary, true, 'Creating…');
              try {
                var r = await TrycordApi.createServer({
                  name: data.name.trim(),
                  description: data.description.trim(),
                  isPublic: data.isPublic,
                });
                await Trycord.refreshServers();
                close();
                Ui.toast('Server created.', 'good');
                if (onCreated) onCreated(r.serverId);
                else location.hash = '#/server/' + encodeURIComponent(r.serverId);
              } catch (e) {
                Ui.setLoading(btns.primary, false);
                Ui.toast(Ui.friendlyError(e), 'bad');
              }
            },
          },
        ];
      Ui.openModal({ title: 'Create a server', body, actions });
    }
    openStep();
  }

  // --- pre-login server switcher ---------------------------------------------------------
  function serverHost() {
    try {
      return new URL(TrycordApi.baseUrl()).host;
    } catch (e) {
      return TrycordApi.baseUrl();
    }
  }

  function serverSwitcher() {
    return '<p class="auth-alt small muted">Server: <b data-srv-host></b> ' +
      '<button type="button" class="link" data-change-server>Change</button></p>';
  }

  function wireServerSwitcher(root) {
    root.querySelectorAll('[data-srv-host]').forEach((el) => {
      el.textContent = serverHost();
    });
    root.querySelectorAll('[data-change-server]').forEach((b) => {
      b.onclick = () => openServerConfigModal();
    });
  }

  function openServerConfigModal() {
    var current = TrycordApi.baseUrl();
    var source = TrycordApi.baseSource();
    var body = document.createElement('div');
    body.innerHTML =
      '<p class="muted small">Currently using <code data-cur></code> (from <span data-src></span>).</p>' +
      '<label class="field"><span>Backend URL</span>' +
      '<input type="url" id="cfg-url" spellcheck="false" autocomplete="off" /></label>' +
      '<div class="form-row"><button type="button" class="btn btn-ghost btn-sm" id="cfg-test">Test connection</button>' +
      '<span id="cfg-status" class="small muted" role="status"></span></div>';
    body.querySelector('[data-cur]').textContent = current;
    body.querySelector('[data-src]').textContent = source;
    var input = body.querySelector('#cfg-url');
    input.value = current;
    var status = body.querySelector('#cfg-status');

    body.querySelector('#cfg-test').onclick = async (e) => {
      var btn = e.currentTarget;
      Ui.setLoading(btn, true, 'Testing…');
      status.textContent = '';
      var r = await TrycordApi.testConnection(input.value);
      Ui.setLoading(btn, false);
      if (!r.url) status.innerHTML = '⚠ <span>' + Ui.esc(r.message) + '</span>';
      else if (r.ok) status.innerHTML = '✓ <span>Connected to Trycord (' + r.latencyMs + ' ms)</span>';
      else status.innerHTML = '✕ <span>' + Ui.esc(r.message) + '</span>';
    };

    Ui.openModal({
      title: 'Trycord server',
      body,
      actions: [
        { id: 'cancel', label: 'Cancel' },
        {
          id: 'save', label: 'Save', primary: true,
          onClick: (close) => {
            var url = TrycordApi.normalizeUrl(input.value);
            if (!url) {
              Ui.fieldError(input, 'Use an http(s) URL like http://51.79.44.111:9971');
              input.focus();
              return;
            }
            TrycordState.access.apiBase = url;
            TrycordState.saveAccess();
            close();
            Ui.toast('Backend saved. Reloading…', 'good');
            setTimeout(() => location.reload(), 400);
          },
        },
      ],
    });
    setTimeout(() => input.focus(), 0);
  }

  window.TrycordComponents = {
    setTopbar, serverCard, wireCards, favStar, createServerModal,
    renderRail, renderMobilebar, renderAccount, renderUser,
    accountMenu, closeMenus, toggleMenu, serverMenu, channelMenu,
    openPalette, serverSwitcher, wireServerSwitcher, openServerConfigModal,
    leaveServerFlow, copyInviteCode,
  };
})();
