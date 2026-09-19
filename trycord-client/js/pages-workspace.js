/* Server workspace: server nav, header + tabs (Overview, Chat, Members,
   Roles, Invites, Settings), member panel. Tabs gated by backend perms. */
(function () {
  var Ui = window.TrycordUi;
  var C = window.TrycordComponents;
  var chatSocket = null;
  var renderedIds = {};
  var current = { serverId: null, channelId: null };
  var navData = { detail: null, cats: [], channels: [] };

  function closeChat() {
    if (chatSocket) {
      try { chatSocket.close(); } catch (e) { /* ignore */ }
      chatSocket = null;
    }
    current.channelId = null;
    renderedIds = {};
  }

  function currentChannel() {
    return current.channelId;
  }

  function can(perm) {
    return TrycordState.can(current.serverId, perm);
  }

  async function copyText(text, okMsg) {
    try {
      await navigator.clipboard.writeText(text);
      Ui.toast(okMsg || 'Copied.', 'good');
    } catch (e) {
      Ui.toast(text, 'info');
    }
  }

  async function workspace(root, serverId, tab, deepChannelId) {
    tab = tab || 'overview';
    var detail;
    try {
      detail = await TrycordApi.serverDetail(serverId);
    } catch (e) {
      if (e.code === 'NOT_A_MEMBER') {
        C.setTopbar('Server', 'You are not a member.');
        renderNotMember(root, serverId);
        return;
      }
      root.innerHTML = '<div class="inline-err" role="alert"><h3>Couldn’t load this server</h3>' +
        '<p>' + Ui.esc(Ui.friendlyError(e, 'server')) + '</p>' +
        '<button type="button" class="btn btn-sm" id="ws-retry">Retry</button> ' +
        '<a class="btn btn-sm btn-ghost" href="#/servers">Your servers</a></div>';
      document.getElementById('ws-retry').onclick = () => workspace(root, serverId, tab, deepChannelId);
      return;
    }
    TrycordState.touchRecent(detail.id);
    TrycordState.setPerms(detail.id, { is_owner: detail.is_owner, permissions: detail.permissions || [] });
    current.serverId = detail.id;
    navData.detail = detail;

    var tabs = ['overview', 'chat', 'members'];
    if (can('MANAGE_ROLES')) tabs.push('roles');
    if (can('MANAGE_INVITES')) tabs.push('invites');
    if (can('MANAGE_SERVER')) tabs.push('settings');
    if (tabs.indexOf(tab) === -1) {
      location.hash = '#/server/' + encodeURIComponent(detail.id) + '/overview';
      return;
    }

    C.setTopbar(detail.name, 'Server workspace', '');
    paintServerNav();
    paintMemberPanel(detail);

    var isFav = TrycordState.isFav(detail.id);
    var vis = detail.is_public
      ? (detail.is_discoverable ? Ui.badge('Public', 'pub') : Ui.badge('Unlisted', ''))
      : Ui.badge('Private', 'priv');
    root.innerHTML =
      '<section class="ws-head">' + Ui.avatarHtml(detail.name, 'lg') +
      '<div class="titles"><h2>' + Ui.esc(detail.name) + '</h2>' +
      '<p class="desc">' + Ui.esc(detail.description || 'No description.') + '</p>' +
      '<div class="meta row wrap" style="margin-top:0.4rem">' +
      (detail.is_owner ? Ui.badge('Owner', 'owner') : Ui.badge('Member', '')) + vis +
      Ui.badge(detail.member_count + ' member' + (detail.member_count === 1 ? '' : 's'), '') +
      '</div></div>' +
      '<div class="side">' +
      '<span class="code-chip" title="Legacy join code">⌁ ' + Ui.esc(detail.join_code) +
      ' <button type="button" class="btn btn-ghost btn-sm" id="copy-code">Copy</button></span>' +
      '<button type="button" class="icon-btn fav-btn" data-fav="' + Ui.esc(detail.id) + '" ' +
      'aria-pressed="' + (isFav ? 'true' : 'false') + '" title="Toggle favorite" aria-label="Toggle favorite">' +
      Ui.icon('star') + '</button>' +
      '</div></section>' +
      '<div class="tabs" role="tablist" aria-label="Server sections">' +
      tabs.map((t) =>
        '<button type="button" role="tab" class="tab" data-tab="' + t + '" aria-selected="' + (t === tab ? 'true' : 'false') + '">' +
        t[0].toUpperCase() + t.slice(1) + '</button>').join('') +
      '</div>' +
      '<div id="ws-body"></div>';

    C.wireCards(root);
    document.getElementById('copy-code').onclick = () => copyText(detail.join_code, 'Join code copied.');
    root.querySelectorAll('[data-tab]').forEach((b) => {
      b.onclick = () => {
        location.hash = '#/server/' + encodeURIComponent(detail.id) + '/' + b.dataset.tab;
      };
    });

    var body = document.getElementById('ws-body');
    if (tab === 'overview') await renderOverview(body, detail);
    else if (tab === 'chat') await renderChat(body, detail, deepChannelId);
    else if (tab === 'members') await renderMembers(body, detail);
    else if (tab === 'roles') await renderRoles(body, detail);
    else if (tab === 'invites') await renderInvites(body, detail);
    else if (tab === 'settings') renderSettings(body, detail);
  }

  // --- server navigation column ----------------------------------------------
  async function paintServerNav() {
    var host = document.getElementById('server-nav-body');
    var d = navData.detail;
    if (!host || !d) return;
    var chans = navData.channels;
    if (!chans.length) {
      try {
        var data = await TrycordApi.channels(d.id);
        navData.cats = data.categories || [];
        navData.channels = data.channels || [];
        chans = navData.channels;
        Trycord.noteChannels(d.id, chans);
      } catch (e) { /* show header only */ }
    }
    var cats = navData.cats;
    var html =
      '<div class="srv-head">' + Ui.avatarHtml(d.name) +
      '<div class="titles"><h2>' + Ui.esc(d.name) + '</h2>' +
      '<div class="sub">' + d.member_count + ' members</div></div>' +
      '<button type="button" class="icon-btn srv-menu-btn" id="srv-menu" aria-label="Server menu" aria-haspopup="menu">' + Ui.icon('dots') + '</button></div>';
    if (can('MANAGE_INVITES')) {
      html += '<div class="srv-actions"><button type="button" class="btn btn-sm btn-block" id="srv-invite">' + Ui.icon('mail') + ' Invite</button></div>';
    }
    html += '<div id="srv-channels"></div>';
    host.innerHTML = html;

    document.getElementById('srv-menu').onclick = (e) => C.serverMenu(e.currentTarget, d.id);
    var invBtn = document.getElementById('srv-invite');
    if (invBtn) {
      invBtn.onclick = async () => {
        try {
          var inv = await TrycordApi.createInvite(d.id, { expiresInHours: 24 });
          copyText(inv.code, 'Invite copied (expires in 24h).');
        } catch (e) { Ui.toast(Ui.friendlyError(e), 'bad'); }
      };
    }
    paintChannelList();
  }

  function paintChannelList() {
    var host = document.getElementById('srv-channels');
    if (!host) return;
    var d = navData.detail;
    var cats = navData.cats;
    var chans = navData.channels;
    host.innerHTML = '';
    function row(c) {
      var r = document.createElement('div');
      r.className = 'chan-row';
      var unread = TrycordState.channelUnread(c.id);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chan-btn' + (c.id === current.channelId ? ' active' : '') +
        (TrycordState.isMutedChannel(c.id) ? ' dim' : '');
      b.innerHTML = Ui.icon('hash') + '<span class="lbl"></span>' +
        (unread ? '<span class="chan-unread" aria-hidden="true"></span>' : '');
      b.querySelector('.lbl').textContent = c.name;
      b.title = '#' + c.name + (c.topic ? ' — ' + c.topic : '');
      b.setAttribute('aria-label', 'Open channel ' + c.name + (unread ? ' (unread)' : ''));
      if (c.id === current.channelId) b.setAttribute('aria-current', 'page');
      b.onclick = () => {
        document.body.classList.remove('nav-open');
        location.hash = '#/server/' + encodeURIComponent(d.id) + '/chat/' + encodeURIComponent(c.id);
      };
      b.oncontextmenu = (e) => {
        e.preventDefault();
        C.channelMenu(b, {
          serverId: d.id, channelId: c.id, name: c.name,
          canManage: can('MANAGE_CHANNELS'),
          onChanged: () => { paintChannelList(); Trycord.paintUnread(); },
        });
      };
      r.appendChild(b);
      return r;
    }
    cats.forEach((cat) => {
      var inCat = chans.filter((c) => c.category_id === cat.id);
      if (!inCat.length) return;
      var wrap = document.createElement('div');
      wrap.className = 'cat-block';
      var closed = TrycordState.isCollapsed(d.id, cat.id);
      var head = document.createElement('button');
      head.type = 'button';
      head.className = 'cat-head' + (closed ? ' closed' : '');
      head.setAttribute('aria-expanded', closed ? 'false' : 'true');
      head.innerHTML = Ui.icon('chev') + '<span class="grow"></span>';
      head.querySelector('.grow').textContent = cat.name;
      head.onclick = () => {
        TrycordState.setCollapsed(d.id, cat.id, !TrycordState.isCollapsed(d.id, cat.id));
        paintChannelList();
      };
      head.oncontextmenu = (e) => {
        if (!can('MANAGE_CHANNELS')) return;
        e.preventDefault();
        Ui.menu(head, [
          {
            icon: 'trash', label: 'Delete category', danger: true,
            action: async () => {
              try {
                await TrycordApi.deleteCategory(d.id, cat.id);
                var data = await TrycordApi.channels(d.id);
                navData.cats = data.categories || [];
                navData.channels = data.channels || [];
                paintChannelList();
                Ui.toast('Category deleted (channels kept).', 'good');
              } catch (err) { Ui.toast(Ui.friendlyError(err), 'bad'); }
            },
          },
        ], { label: cat.name });
      };
      wrap.appendChild(head);
      if (!closed) inCat.forEach((c) => wrap.appendChild(row(c)));
      host.appendChild(wrap);
    });
    var uncat = chans.filter((c) => !c.category_id);
    if (uncat.length) {
      if (cats.length) {
        var lbl = document.createElement('div');
        lbl.className = 'cat-block';
        lbl.innerHTML = '<span class="cat-head" aria-hidden="true">No category</span>';
        host.appendChild(lbl);
      }
      uncat.forEach((c) => host.appendChild(row(c)));
    }
    if (!chans.length) host.innerHTML = '<p class="muted small">No channels yet.</p>';
  }

  function paintUnread() {
    paintChannelList();
  }

  // --- member / info panel ------------------------------------------------------
  async function paintMemberPanel(detail, members) {
    var panel = document.getElementById('member-panel');
    var body = document.getElementById('member-panel-body');
    if (!panel || !body) return;
    panel.hidden = !TrycordState.ui.memberPanel;
    document.getElementById('panel-toggle').setAttribute('aria-expanded',
      TrycordState.ui.memberPanel ? 'true' : 'false');
    if (panel.hidden) return;
    if (!members) {
      try {
        members = await TrycordApi.serverMembers(detail.id);
      } catch (e) {
        body.innerHTML = '<h2 class="small muted">Members</h2><p class="muted small">Couldn’t load members.</p>';
        return;
      }
    }
    body.innerHTML =
      '<h2 style="font-size:0.95rem">Members · ' + members.length + '</h2>' +
      '<ul class="member-list">' + members.map((m) =>
        '<li class="member-item">' + Ui.avatarHtml(m.display_name || m.username, 'sm') +
        '<span class="who"><strong>' + Ui.esc(m.display_name || m.username) + '</strong>' +
        '<small>@' + Ui.esc(m.username) + '</small></span>' +
        (m.is_owner ? Ui.badge('Owner', 'owner') : '') + '</li>').join('') + '</ul>' +
      '<hr class="divider" /><h2 style="font-size:0.95rem">About</h2>' +
      '<p class="small muted">' + Ui.esc(detail.description || 'No description.') + '</p>' +
      '<p class="small muted">Created ' + Ui.fullDate(detail.created_at) + '<br>Owner: ' +
      Ui.esc(detail.owner_display || detail.owner_name || '—') + '</p>';
  }

  // --- not a member: join prompt, not a dead end ---------------------------
  async function renderNotMember(root, serverId) {
    root.innerHTML = '<div id="nm-body">' + Ui.skeletons(2) + '</div>';
    var body = document.getElementById('nm-body');
    var preview = null;
    try {
      preview = await TrycordApi.discoverPreview(serverId);
    } catch (e) { /* private or gone */ }
    if (!preview) {
      body.innerHTML = Ui.emptyState({
        icon: '◌', title: 'Server unavailable',
        hint: 'It may be private, unlisted, or deleted. Ask a member for an invite.',
        actions: '<a class="btn btn-ghost btn-sm" href="#/servers">Your servers</a>' +
          '<a class="btn btn-ghost btn-sm" href="#/discover">Discover</a>',
      });
      return;
    }
    body.innerHTML =
      '<div class="state"><div class="glyph" aria-hidden="true">◌</div>' +
      '<h3>You’re not a member of ' + Ui.esc(preview.name) + '</h3>' +
      '<p>' + Ui.esc(preview.description || 'No description.') + '<br>' +
      '<span class="muted">' + preview.member_count + ' members · ' + preview.channel_count + ' channels</span></p>' +
      '<div class="actions"><button type="button" class="btn btn-primary" id="nm-join">Join server</button>' +
      '<a class="btn btn-ghost" href="#/discover/' + Ui.esc(preview.id) + '">Full preview</a></div></div>';
    document.getElementById('nm-join').onclick = async (e) => {
      var btn = e.currentTarget;
      Ui.setLoading(btn, true, 'Joining…');
      try {
        await TrycordApi.joinPublic(preview.id);
        await Trycord.refreshServers();
        Ui.toast('Joined ' + preview.name + '.', 'good');
        location.hash = '#/server/' + encodeURIComponent(preview.id) + '/overview';
        workspace(root, preview.id, 'overview');
      } catch (err) {
        Ui.setLoading(btn, false);
        Ui.toast(Ui.friendlyError(err), 'bad');
      }
    };
  }

  // --- overview -----------------------------------------------------------
  async function renderOverview(body, detail) {
    var canInvite = can('MANAGE_INVITES');
    body.innerHTML =
      '<div class="stats">' +
      '<div class="stat"><div class="num">' + detail.member_count + '</div><div class="lbl">Members</div></div>' +
      '<div class="stat"><div class="num">' + detail.channel_count + '</div><div class="lbl">Channels</div></div>' +
      '<div class="stat"><div class="num">' + detail.message_count + '</div><div class="lbl">Messages</div></div>' +
      '<div class="stat"><div class="num">' + Ui.timeAgo(detail.created_at) + '</div><div class="lbl">Created</div></div>' +
      '</div>' +
      '<div class="toolbar">' +
      '<a class="btn btn-primary btn-sm" href="#/server/' + encodeURIComponent(detail.id) + '/chat">Open chat</a>' +
      (canInvite ? '<button type="button" class="btn btn-ghost btn-sm" id="ov-invite">Copy 24h invite</button>' : '') +
      (can('MANAGE_SERVER')
        ? '<a class="btn btn-ghost btn-sm" href="#/server/' + encodeURIComponent(detail.id) + '/settings">Server settings</a>'
        : '<a class="btn btn-ghost btn-sm" href="#/server/' + encodeURIComponent(detail.id) + '/members">View members</a>') +
      '</div>' +
      '<section class="section"><h2>Recent activity</h2><div id="ws-activity">' + Ui.skeletons(3) + '</div></section>';

    var invBtn = document.getElementById('ov-invite');
    if (invBtn) {
      invBtn.onclick = async () => {
        try {
          var inv = await TrycordApi.createInvite(detail.id, { expiresInHours: 24 });
          copyText(inv.code, 'Invite copied (expires in 24h).');
        } catch (e) { Ui.toast(Ui.friendlyError(e), 'bad'); }
      };
    }

    try {
      var acts = (await TrycordApi.activity(30)).filter((a) => a.server_id === detail.id).slice(0, 5);
      var box = document.getElementById('ws-activity');
      if (!box) return;
      box.innerHTML = acts.length
        ? '<div class="activity-list">' + acts.map(TrycordPagesHome.activityItem).join('') + '</div>'
        : Ui.emptyState({ icon: '◷', title: 'No activity yet', hint: 'Be the first to post in chat.' });
      box.querySelectorAll('[data-goto-server]').forEach((b) => {
        b.onclick = () => {
          location.hash = '#/server/' + encodeURIComponent(b.dataset.gotoServer) +
            '/chat/' + encodeURIComponent(b.dataset.gotoChannel);
        };
      });
    } catch (e) {
      var box2 = document.getElementById('ws-activity');
      if (box2) box2.innerHTML = Ui.errorState(Ui.friendlyError(e, 'messages'));
    }
  }

  // --- chat ---------------------------------------------------------------
  async function renderChat(body, detail, deepChannelId) {
    var manageChannels = can('MANAGE_CHANNELS');
    body.innerHTML =
      '<div class="chat-grid"><div class="chat-pane">' +
      '<div class="chat-topic"><span class="grow" id="ch-topic">Select a channel</span>' +
      '<button type="button" class="icon-btn" id="ch-filter-btn" title="Filter loaded messages" aria-label="Filter loaded messages" aria-expanded="false">' + Ui.icon('search') + '</button>' +
      '<button type="button" class="icon-btn" id="ch-mute-btn" title="Mute channel" aria-label="Mute channel" aria-pressed="false">' + Ui.icon('bell') + '</button></div>' +
      '<div class="msg-filter" id="msg-filter" hidden><input type="text" id="msg-filter-input" placeholder="Filter messages…" aria-label="Filter messages" /></div>' +
      '<ul class="msg-list" id="msg-list" aria-live="polite" aria-label="Messages"></ul>' +
      '<form class="composer" id="composer"><textarea id="msg-input" rows="1" maxlength="2000" placeholder="Message…" aria-label="Message"></textarea>' +
      '<button class="btn btn-primary send" id="send-btn" type="submit" aria-label="Send message" disabled>' + Ui.icon('send') + '</button></form>' +
      '<div class="composer-foot"><span>Enter to send · Shift+Enter for newline</span><span id="char-count">0 / 2000</span></div>' +
      (manageChannels ? '<form id="ch-new" class="toolbar" style="padding:0 1rem 0.8rem;margin:0">' +
        '<input type="text" id="ch-name" class="grow" placeholder="new-channel name" maxlength="32" aria-label="New channel name" />' +
        '<select id="ch-cat" aria-label="Category"></select>' +
        '<button class="btn btn-sm" type="submit">Add</button></form>' : '') +
      '</div></div>';

    var list = [];
    try {
      var data = await TrycordApi.channels(detail.id);
      navData.cats = data.categories || [];
      navData.channels = data.channels || [];
      list = navData.channels;
      Trycord.noteChannels(detail.id, list);
    } catch (e) {
      document.getElementById('msg-list').innerHTML = '<li>' + Ui.errorState(Ui.friendlyError(e, 'messages')) + '</li>';
      return;
    }
    paintServerNav();
    var canModMsg = can('MANAGE_MESSAGES');
    var me = TrycordState.user;
    var filter = '';

    var catSelect = document.getElementById('ch-cat');
    if (catSelect) {
      catSelect.innerHTML = '<option value="">No category</option>' +
        navData.cats.map((c) => '<option value="' + Ui.esc(c.id) + '">' + Ui.esc(c.name) + '</option>').join('');
    }

    var filterBtn = document.getElementById('ch-filter-btn');
    var filterBox = document.getElementById('msg-filter');
    var filterInput = document.getElementById('msg-filter-input');
    filterBtn.onclick = () => {
      var open = filterBox.hidden;
      filterBox.hidden = !open;
      filterBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) filterInput.focus();
      else { filter = ''; filterInput.value = ''; applyFilter(); }
    };
    filterInput.addEventListener('input', () => { filter = filterInput.value.toLowerCase(); applyFilter(); });
    function applyFilter() {
      document.querySelectorAll('#msg-list .msg').forEach((li) => {
        var t = li.querySelector('.text');
        li.style.display = !filter || (t && t.textContent.toLowerCase().includes(filter)) ? '' : 'none';
      });
    }

    var muteBtn = document.getElementById('ch-mute-btn');
    function paintMute() {
      var muted = current.channelId && TrycordState.isMutedChannel(current.channelId);
      muteBtn.innerHTML = Ui.icon(muted ? 'bell-off' : 'bell');
      muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
      muteBtn.title = muted ? 'Unmute channel' : 'Mute channel';
    }
    muteBtn.onclick = () => {
      if (!current.channelId) return;
      TrycordState.toggleMuteChannel(current.channelId);
      paintMute();
      paintServerNav();
    };
    paintMute();

    async function selectChannel(id) {
      var ch = list.find((x) => x.id === id) || list[0];
      if (!ch) {
        document.getElementById('msg-input').disabled = true;
        document.getElementById('send-btn').disabled = true;
        document.getElementById('msg-list').innerHTML = '<li class="muted" style="padding:1rem">No channels yet.' +
          (manageChannels ? ' Create one below.' : '') + '</li>';
        return;
      }
      current.channelId = ch.id;
      TrycordState.setLastChannel(detail.id, ch.id);
      renderedIds = {};
      lastRendered = null;
      paintServerNav();
      paintMute();
      document.getElementById('ch-topic').textContent = '#' + ch.name + (ch.topic ? ' — ' + ch.topic : '');
      var ml = document.getElementById('msg-list');
      ml.innerHTML = Ui.skeletons(3);
      try {
        var msgs = await TrycordApi.messages(ch.id, 50);
        ml.innerHTML = '';
        if (!msgs.length) {
          ml.innerHTML = '<li><div class="state"><div class="glyph" aria-hidden="true">#</div>' +
            '<h3>No messages yet</h3><p>Start the conversation below.</p></div></li>';
        }
        msgs.forEach((m) => {
          TrycordState.touchChannel(ch.id, m.created_at);
          addMsg(m);
        });
        var latest = msgs.length ? msgs[msgs.length - 1].created_at : null;
        TrycordState.markRead(ch.id, latest);
        Trycord.paintUnread();
      } catch (e) {
        ml.innerHTML = '<li>' + Ui.errorState(Ui.friendlyError(e, 'messages')) + '</li>';
      }
      applyFilter();
      if (chatSocket && chatSocket.readyState === WebSocket.OPEN) {
        chatSocket.send(JSON.stringify({ type: 'join', channelId: ch.id }));
      }
      history.replaceState(null, '', '#/server/' + encodeURIComponent(detail.id) + '/chat/' + encodeURIComponent(ch.id));
    }

    function sameGroup(a, b) {
      if (!a || !b || a.author_id !== b.author_id) return false;
      return Math.abs(new Date(a.created_at) - new Date(b.created_at)) < 5 * 60 * 1000;
    }

    function addMsg(m, prev) {
      if (!m || renderedIds[m.id]) return;
      renderedIds[m.id] = true;
      var grouped = sameGroup(prev, m);
      var li = document.createElement('li');
      li.className = 'msg' + (grouped ? ' grouped' : '');
      li.dataset.mid = m.id;
      var day = Ui.dayLabel(m.created_at);
      var prevDay = prev ? Ui.dayLabel(prev.created_at) : null;
      var html = '';
      if (day && day !== prevDay) html += '<div class="day-sep">' + Ui.esc(day) + '</div>';
      li.innerHTML = html +
        '<span class="m-av">' + Ui.avatarHtml(m.user || m.author_name || '?', 'sm') + '</span>' +
        '<div class="body"><div class="meta"><b></b><time></time><span class="time-inline"></span></div>' +
        '<div class="text"></div></div>' +
        '<span class="acts"><button type="button" class="icon-btn" data-act="copy" title="Copy message" aria-label="Copy message">' + Ui.icon('copy') + '</button>' +
        (((me && m.author_id === me.id) || canModMsg)
          ? '<button type="button" class="icon-btn" data-act="del" title="Delete message" aria-label="Delete message">' + Ui.icon('trash') + '</button>'
          : '') + '</span>';
      li.querySelector('b').textContent = m.user || m.author_name || 'user';
      var when = m.created_at ? new Date(m.created_at) : null;
      li.querySelector('time').textContent = when && !isNaN(when) ? when.toLocaleString() : '';
      li.querySelector('.time-inline').textContent = when && !isNaN(when)
        ? when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
      li.querySelector('.text').textContent = m.content || '';
      li.querySelector('[data-act="copy"]').onclick = () => copyText(m.content || '', 'Message copied.');
      var del = li.querySelector('[data-act="del"]');
      if (del) {
        del.onclick = async () => {
          try {
            await TrycordApi.deleteMessage(current.channelId, m.id);
            delete renderedIds[m.id];
            li.remove();
          } catch (err) { Ui.toast(Ui.friendlyError(err), 'bad'); }
        };
      }
      document.getElementById('msg-list').appendChild(li);
      li.scrollIntoView({ block: 'nearest' });
      return m;
    }

    // Grouping needs the previous message: reload path tracks it.
    var lastRendered = null;
    var origAdd = addMsg;
    addMsg = function (m) {
      var out = origAdd(m, lastRendered);
      if (out) lastRendered = out;
      return out;
    };

    var input = document.getElementById('msg-input');
    var sendBtn = document.getElementById('send-btn');
    var count = document.getElementById('char-count');
    function autosize() {
      input.style.height = 'auto';
      input.style.height = Math.min(144, input.scrollHeight) + 'px';
      var empty = !input.value.trim();
      sendBtn.disabled = empty || !current.channelId;
      count.textContent = input.value.length + ' / 2000';
    }
    input.addEventListener('input', autosize);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('composer').requestSubmit();
      }
    });
    autosize();

    var newForm = document.getElementById('ch-new');
    if (newForm) {
      newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        var nameInput = document.getElementById('ch-name');
        var name = nameInput.value.trim();
        if (!name) return;
        try {
          var r = await TrycordApi.createChannel(detail.id, {
            name, categoryId: document.getElementById('ch-cat').value || undefined,
          });
          var data2 = await TrycordApi.channels(detail.id);
          navData.cats = data2.categories || [];
          navData.channels = data2.channels || [];
          list = navData.channels;
          Trycord.noteChannels(detail.id, list);
          nameInput.value = '';
          paintServerNav();
          selectChannel(r.id || r.channelId);
          Ui.toast('Channel created.', 'good');
        } catch (err) { Ui.toast(Ui.friendlyError(err), 'bad'); }
      });
    }

    document.getElementById('composer').addEventListener('submit', async (e) => {
      e.preventDefault();
      var content = input.value.trim();
      if (!content || !current.channelId) return;
      input.value = '';
      autosize();
      try {
        var m = await TrycordApi.postMessage(current.channelId, content);
        TrycordState.touchChannel(current.channelId, m.created_at);
        TrycordState.markRead(current.channelId, m.created_at);
        addMsg(m);
        Trycord.paintUnread();
      } catch (err) { Ui.toast(Ui.friendlyError(err), 'bad'); }
    });

    var start = list.find((x) => x.id === deepChannelId) ? deepChannelId
      : (TrycordState.getLastChannel(detail.id) && list.find((x) => x.id === TrycordState.getLastChannel(detail.id))
        ? TrycordState.getLastChannel(detail.id)
        : (list[0] && list[0].id));
    if (start) {
      selectChannel(start);
      chatSocket = new WebSocket(TrycordApi.wsUrl());
      chatSocket.onopen = () => {
        if (current.channelId) chatSocket.send(JSON.stringify({ type: 'join', channelId: current.channelId }));
      };
      chatSocket.onmessage = (ev) => {
        try {
          var data = JSON.parse(ev.data);
          if (data.type === 'message') {
            TrycordState.touchChannel(data.channel_id, data.created_at);
            if (data.channel_id === current.channelId) {
              addMsg(data);
              TrycordState.markRead(data.channel_id, data.created_at);
            } else {
              Trycord.notifyMessage(data);
            }
            Trycord.paintUnread();
          } else if (data.type === 'message_deleted' && data.channel_id === current.channelId) {
            delete renderedIds[data.id];
            var el = document.querySelector('[data-mid="' + data.id + '"]');
            if (el) el.remove();
          }
        } catch (err) { /* ignore */ }
      };
    } else {
      selectChannel(null);
    }
  }

  // --- members ------------------------------------------------------------
  async function renderMembers(body, detail) {
    var manageRoles = can('MANAGE_ROLES');
    var kickPerm = can('KICK_MEMBERS');
    body.innerHTML = '<div id="mem-list">' + Ui.skeletons(4) + '</div>';
    var box = document.getElementById('mem-list');
    var members;
    try {
      members = await TrycordApi.serverMembers(detail.id);
    } catch (e) {
      box.innerHTML = Ui.errorState(Ui.friendlyError(e));
      var rb = box.querySelector('[data-retry]');
      if (rb) rb.onclick = () => renderMembers(body, detail);
      return;
    }
    paintMemberPanel(detail, members);
    var me = TrycordState.user;
    box.innerHTML = '<p class="muted">' + members.length + ' member' + (members.length === 1 ? '' : 's') + '</p>' +
      '<ul class="member-list">' + members.map((m, i) =>
        '<li class="member-item" data-uid="' + Ui.esc(m.id) + '">' +
        Ui.avatarHtml(m.display_name || m.username) +
        '<span class="who"><strong>' + Ui.esc(m.display_name || m.username) +
        ' <small>@' + Ui.esc(m.username) + '</small></strong>' +
        '<small>Joined ' + Ui.fullDate(m.joined_at) + '</small>' +
        '<span class="row wrap" style="margin-top:0.25rem">' +
        (m.is_owner ? Ui.badge('Owner', 'owner') : '') +
        m.roles.map((r) => Ui.badge(Ui.esc(r.name), '')).join('') + '</span></span>' +
        '<span class="row">' +
        (manageRoles && !m.is_owner ? '<button type="button" class="btn btn-ghost btn-sm" data-roles="' + i + '">Roles</button>' : '') +
        (kickPerm && !m.is_owner && m.id !== me.id ? '<button type="button" class="btn btn-ghost btn-sm" data-kick="' + Ui.esc(m.id) + '" data-kick-name="' + Ui.esc(m.display_name || m.username) + '">Kick</button>' : '') +
        '</span></li>').join('') + '</ul>';

    box.querySelectorAll('[data-kick]').forEach((b) => {
      b.onclick = async () => {
        var yes = await Ui.confirmDialog({
          title: 'Kick ' + b.dataset.kickName + '?',
          message: 'They will leave the server immediately and can rejoin with a new invite.',
          confirmText: 'Kick', danger: true,
        });
        if (!yes) return;
        try {
          await TrycordApi.kickMember(detail.id, b.dataset.kick);
          Ui.toast('Member kicked.', 'good');
          renderMembers(body, detail);
          await Trycord.refreshServers();
        } catch (err) { Ui.toast(Ui.friendlyError(err), 'bad'); }
      };
    });

    if (manageRoles) {
      var allRoles = await TrycordApi.roles(detail.id).catch(() => []);
      box.querySelectorAll('[data-roles]').forEach((b) => {
        b.onclick = () => roleAssignModal(detail, members[Number(b.dataset.roles)], allRoles, () => renderMembers(body, detail));
      });
    }
  }

  function roleAssignModal(detail, member, allRoles, onDone) {
    var wrap = document.createElement('div');
    wrap.innerHTML = '<p class="muted">Roles for <b>' + Ui.esc(member.display_name || member.username) + '</b>:</p>' +
      allRoles.map((r) => {
        var has = member.roles.some((x) => x.id === r.id);
        return '<label class="row" style="margin-bottom:0.4rem"><input type="checkbox" data-role="' + Ui.esc(r.id) + '"' +
          (has ? ' checked' : '') + ' /> ' + Ui.esc(r.name) + '</label>';
      }).join('');
    Ui.openModal({
      title: 'Edit roles',
      body: wrap,
      actions: [
        { id: 'cancel', label: 'Cancel' },
        {
          id: 'save', label: 'Save', primary: true,
          onClick: async (close, btns) => {
            Ui.setLoading(btns.primary, true, 'Saving…');
            var checks = wrap.querySelectorAll('[data-role]');
            try {
              for (var i = 0; i < checks.length; i++) {
                var rid = checks[i].dataset.role;
                var had = member.roles.some((x) => x.id === rid);
                if (checks[i].checked && !had) await TrycordApi.assignRole(detail.id, rid, member.id);
                if (!checks[i].checked && had) await TrycordApi.unassignRole(detail.id, rid, member.id);
              }
              close();
              Ui.toast('Roles updated.', 'good');
              onDone();
            } catch (e) {
              Ui.setLoading(btns.primary, false);
              Ui.toast(Ui.friendlyError(e), 'bad');
            }
          },
        },
      ],
    });
  }

  // --- roles --------------------------------------------------------------
  async function renderRoles(body, detail) {
    body.innerHTML = '<div id="roles-list">' + Ui.skeletons(3) + '</div>';
    var box = document.getElementById('roles-list');
    var roleList;
    try {
      roleList = await TrycordApi.roles(detail.id);
    } catch (e) {
      box.innerHTML = Ui.errorState(Ui.friendlyError(e));
      return;
    }
    var allPerms = {};
    try {
      var p = await TrycordApi.serverPerms(detail.id);
      allPerms = p.all || {};
    } catch (e) { /* keep empty */ }
    var permNames = Object.keys(allPerms);

    box.innerHTML =
      '<form id="role-new" class="toolbar"><input type="text" id="role-name" class="grow" maxlength="32" placeholder="New role name…" aria-label="New role name" />' +
      '<button class="btn btn-sm" type="submit">+ Add role</button></form>' +
      '<div class="stack">' + roleList.map((r) =>
        '<section class="settings-card" data-role-card="' + Ui.esc(r.id) + '">' +
        '<div class="row space"><h2 style="margin:0">' + Ui.esc(r.name) + '</h2>' +
        '<span class="row">' + (r.is_default ? Ui.badge('Default', '') : '') +
        (r.is_default ? '' : '<button type="button" class="btn btn-ghost btn-sm" data-role-del="' + Ui.esc(r.id) + '">Delete</button>') +
        '</span></div>' +
        '<div class="row wrap" style="margin:0.6rem 0">' +
        permNames.map((pn) =>
          '<label class="row small" style="margin-right:0.8rem"><input type="checkbox" data-role-perm="' + Ui.esc(r.id) + ':' + Ui.esc(pn) + '"' +
          (r.permissions.indexOf(pn) !== -1 ? ' checked' : '') + ' title="' + Ui.esc(allPerms[pn] || pn) + '" /> ' +
          Ui.esc(pn.replace(/_/g, ' ').toLowerCase()) + '</label>').join('') +
        '</div>' +
        '<button type="button" class="btn btn-primary btn-sm" data-role-save="' + Ui.esc(r.id) + '">Save permissions</button>' +
        '</section>').join('') + '</div>';

    document.getElementById('role-new').addEventListener('submit', async (e) => {
      e.preventDefault();
      var input = document.getElementById('role-name');
      if (!input.value.trim()) return;
      try {
        await TrycordApi.createRole(detail.id, { name: input.value.trim(), permissions: [] });
        Ui.toast('Role created.', 'good');
        renderRoles(body, detail);
      } catch (err) { Ui.toast(Ui.friendlyError(err), 'bad'); }
    });

    box.querySelectorAll('[data-role-save]').forEach((b) => {
      b.onclick = async () => {
        var rid = b.dataset.roleSave;
        var checked = [];
        box.querySelectorAll('[data-role-perm]').forEach((cb) => {
          var parts = cb.dataset.rolePerm.split(':');
          if (parts[0] === rid && cb.checked) checked.push(parts.slice(1).join(':'));
        });
        Ui.setLoading(b, true, 'Saving…');
        try {
          await TrycordApi.patchRole(detail.id, rid, { permissions: checked });
          Ui.setLoading(b, false);
          Ui.toast('Permissions saved.', 'good');
        } catch (err) {
          Ui.setLoading(b, false);
          Ui.toast(Ui.friendlyError(err), 'bad');
        }
      };
    });

    box.querySelectorAll('[data-role-del]').forEach((b) => {
      b.onclick = async () => {
        var yes = await Ui.confirmDialog({
          title: 'Delete role?', message: 'Members keep their membership but lose this role.',
          confirmText: 'Delete', danger: true,
        });
        if (!yes) return;
        try {
          await TrycordApi.deleteRole(detail.id, b.dataset.roleDel);
          Ui.toast('Role deleted.', 'good');
          renderRoles(body, detail);
        } catch (err) { Ui.toast(Ui.friendlyError(err), 'bad'); }
      };
    });
  }

  // --- invites ------------------------------------------------------------
  async function renderInvites(body, detail) {
    body.innerHTML =
      '<section class="settings-card"><h2>New invite</h2>' +
      '<form id="inv-new" class="toolbar">' +
      '<label class="small muted">Max uses <input type="number" id="inv-max" min="1" max="100" placeholder="∞" style="width:5rem" /></label>' +
      '<label class="small muted">Expires <select id="inv-exp">' +
      '<option value="">Never</option><option value="1">1 hour</option>' +
      '<option value="24" selected>24 hours</option><option value="168">7 days</option></select></label>' +
      '<button class="btn btn-primary btn-sm" type="submit">Create invite</button></form></section>' +
      '<section class="section" style="margin-top:1rem"><h2>Active invites</h2><div id="inv-list">' + Ui.skeletons(3) + '</div></section>';

    async function reload() {
      var box = document.getElementById('inv-list');
      if (!box) return;
      var list;
      try {
        list = await TrycordApi.invites(detail.id);
      } catch (e) {
        box.innerHTML = Ui.errorState(Ui.friendlyError(e));
        return;
      }
      var alive = list.filter((i) => !i.revoked);
      box.innerHTML = alive.length ? '<ul class="member-list">' + alive.map((i) =>
        '<li class="member-item"><span class="who"><strong class="code-chip">⌁ ' + Ui.esc(i.code) + '</strong> ' +
        '<small>by @' + Ui.esc(i.creator_name) + ' · ' + i.uses + (i.max_uses ? '/' + i.max_uses : '') + ' used' +
        (i.expires_at ? ' · expires ' + Ui.fullDate(i.expires_at) : ' · never expires') + '</small></span>' +
        '<span class="row"><button type="button" class="btn btn-ghost btn-sm" data-inv-copy="' + Ui.esc(i.code) + '">Copy</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-inv-revoke="' + Ui.esc(i.id) + '">Revoke</button></span></li>'
      ).join('') + '</ul>'
        : Ui.emptyState({ icon: '✉', title: 'No active invites', hint: 'Create one above to let people join.' });
      box.querySelectorAll('[data-inv-copy]').forEach((b) => {
        b.onclick = () => copyText(b.dataset.invCopy, 'Invite copied.');
      });
      box.querySelectorAll('[data-inv-revoke]').forEach((b) => {
        b.onclick = async () => {
          try {
            await TrycordApi.revokeInvite(detail.id, b.dataset.invRevoke);
            Ui.toast('Invite revoked.', 'good');
            reload();
          } catch (err) { Ui.toast(Ui.friendlyError(err), 'bad'); }
        };
      });
    }

    document.getElementById('inv-new').addEventListener('submit', async (e) => {
      e.preventDefault();
      var maxRaw = document.getElementById('inv-max').value;
      try {
        var inv = await TrycordApi.createInvite(detail.id, {
          maxUses: maxRaw ? Number(maxRaw) : undefined,
          expiresInHours: document.getElementById('inv-exp').value || undefined,
        });
        Ui.toast('Invite created: ' + inv.code, 'good');
        copyText(inv.code, 'Invite copied: ' + inv.code);
        reload();
      } catch (err) { Ui.toast(Ui.friendlyError(err), 'bad'); }
    });
    reload();
  }

  // --- settings (MANAGE_SERVER) --------------------------------------------
  function renderSettings(body, detail) {
    var manageChannels = can('MANAGE_CHANNELS');
    var isOwner = detail.is_owner;
    var vis = !detail.is_public ? 'private' : (detail.is_discoverable ? 'listed' : 'unlisted');
    body.innerHTML =
      '<div class="settings-grid">' +
      '<section class="settings-card"><h2>Server settings</h2>' +
      '<form id="srv-form">' +
      '<label class="field"><span>Name</span><input type="text" id="srv-name" maxlength="64" value="' + Ui.esc(detail.name) + '" /></label>' +
      '<label class="field"><span>Description</span><textarea id="srv-desc" maxlength="500">' + Ui.esc(detail.description || '') + '</textarea></label>' +
      '<label class="field"><span>Visibility</span><select id="srv-vis">' +
      '<option value="listed"' + (vis === 'listed' ? ' selected' : '') + '>Public — listed in Discover</option>' +
      '<option value="unlisted"' + (vis === 'unlisted' ? ' selected' : '') + '>Public — unlisted (join via code/invite)</option>' +
      '<option value="private"' + (vis === 'private' ? ' selected' : '') + '>Private — invite only</option>' +
      '</select></label>' +
      '<div class="form-row" style="margin-top:0.8rem"><button class="btn btn-primary" type="submit" id="srv-save">Save changes</button></div>' +
      '</form></section>' +
      '<section class="settings-card"><h2>Join codes</h2>' +
      '<p class="hint">Legacy permanent code (works even for private servers — share carefully):</p>' +
      '<p><span class="code-chip">⌁ ' + Ui.esc(detail.join_code) + '</span></p>' +
      '<p class="hint">For expiring, limited-use codes, use the <a href="#/server/' + encodeURIComponent(detail.id) + '/invites">Invites</a> tab.</p></section>' +
      '<section class="settings-card"><h2>My preferences for this server</h2>' +
      '<div class="form-row"><button class="btn btn-ghost btn-sm" id="pref-fav" type="button" aria-pressed="' + (TrycordState.isFav(detail.id) ? 'true' : 'false') + '">' +
      (TrycordState.isFav(detail.id) ? '★ Favorited' : '☆ Add to favorites') + '</button>' +
      '<button class="btn btn-ghost btn-sm" id="pref-mute" type="button" aria-pressed="' + (TrycordState.isMutedServer(detail.id) ? 'true' : 'false') + '">' +
      (TrycordState.isMutedServer(detail.id) ? 'Unmute server' : 'Mute server') + '</button>' +
      '<button class="btn btn-ghost btn-sm" id="pref-expand" type="button">Expand all categories</button></div>' +
      '<p class="hint">Favorites, mutes, and collapsed categories are stored on this device, per server.</p></section>' +
      (manageChannels
        ? '<section class="settings-card"><h2>Categories</h2><div id="cat-list"></div>' +
          '<form id="cat-new" class="toolbar" style="margin-top:0.6rem"><input type="text" id="cat-name" class="grow" maxlength="32" placeholder="New category…" aria-label="New category name" />' +
          '<button class="btn btn-sm" type="submit">Add</button></form></section>'
        : '') +
      '<section class="settings-card"><h2>Danger zone</h2>' +
      (!isOwner ? '<p class="hint">You are a member of this server.</p><button class="btn btn-ghost" type="button" id="leave-btn2">Leave server</button>' : '') +
      (isOwner ? '<p class="hint">Deleting a server permanently removes its channels, messages, roles, and invites.</p><button class="btn btn-danger" type="button" id="del-server">Delete server</button>' : '') +
      '</section></div>';

    document.getElementById('srv-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      var nameEl = document.getElementById('srv-name');
      if (!Ui.fieldError(nameEl, nameEl.value.trim() ? '' : 'Name cannot be empty.')) return;
      var v = document.getElementById('srv-vis').value;
      var btn = document.getElementById('srv-save');
      Ui.setLoading(btn, true, 'Saving…');
      try {
        await TrycordApi.patchServer(detail.id, {
          name: nameEl.value.trim(),
          description: document.getElementById('srv-desc').value.trim(),
          isPublic: v !== 'private',
          isDiscoverable: v === 'listed',
        });
        await Trycord.refreshServers();
        Ui.setLoading(btn, false);
        Ui.toast('Server updated.', 'good');
        workspace(document.getElementById('view'), detail.id, 'settings');
      } catch (err) {
        Ui.setLoading(btn, false);
        Ui.toast(Ui.friendlyError(err), 'bad');
      }
    });

    document.getElementById('pref-fav').onclick = (e) => {
      var nowFav = TrycordState.toggleFav(detail.id);
      e.currentTarget.textContent = nowFav ? '★ Favorited' : '☆ Add to favorites';
      e.currentTarget.setAttribute('aria-pressed', nowFav ? 'true' : 'false');
    };
    document.getElementById('pref-mute').onclick = (e) => {
      var muted = TrycordState.toggleMuteServer(detail.id);
      e.currentTarget.textContent = muted ? 'Unmute server' : 'Mute server';
      e.currentTarget.setAttribute('aria-pressed', muted ? 'true' : 'false');
      Trycord.paintUnread();
    };
    document.getElementById('pref-expand').onclick = () => {
      TrycordState.resetCollapsed(detail.id);
      Ui.toast('All categories expanded.', 'info');
    };

    if (manageChannels) loadCategories(body, detail);

    var leaveBtn = document.getElementById('leave-btn2');
    if (leaveBtn) {
      leaveBtn.onclick = () => C.leaveServerFlow(detail.id, detail.name);
    }
    var delBtn = document.getElementById('del-server');
    if (delBtn) {
      delBtn.onclick = async () => {
        var yes = await Ui.confirmDialog({
          title: 'Delete ' + detail.name + '?',
          message: 'This permanently deletes channels, messages, roles, and invites. This cannot be undone.',
          confirmText: 'Delete forever', danger: true,
        });
        if (!yes) return;
        try {
          await TrycordApi.deleteServer(detail.id);
          await Trycord.refreshServers();
          Ui.toast('Server deleted.', 'info');
          location.hash = '#/servers';
        } catch (err) { Ui.toast(Ui.friendlyError(err), 'bad'); }
      };
    }
  }

  async function loadCategories(body, detail) {
    var box = body.querySelector('#cat-list');
    if (!box) return;
    var data;
    try {
      data = await TrycordApi.channels(detail.id);
    } catch (e) {
      box.innerHTML = Ui.errorState(Ui.friendlyError(e));
      return;
    }
    var cats = data.categories || [];
    box.innerHTML = cats.length ? '<ul class="member-list">' + cats.map((c) =>
      '<li class="member-item"><span class="who"><strong>' + Ui.esc(c.name) + '</strong></span>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-cat-del="' + Ui.esc(c.id) + '">Delete</button></li>'
    ).join('') + '</ul>' : '<p class="muted">No categories — channels are ungrouped.</p>';
    box.querySelectorAll('[data-cat-del]').forEach((b) => {
      b.onclick = async () => {
        try {
          await TrycordApi.deleteCategory(detail.id, b.dataset.catDel);
          Ui.toast('Category deleted (channels kept).', 'good');
          loadCategories(body, detail);
          var d2 = await TrycordApi.channels(detail.id);
          navData.cats = d2.categories || [];
          navData.channels = d2.channels || [];
          paintServerNav();
        } catch (err) { Ui.toast(Ui.friendlyError(err), 'bad'); }
      };
    });
    var form = document.getElementById('cat-new');
    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        var input = document.getElementById('cat-name');
        if (!input.value.trim()) return;
        try {
          await TrycordApi.createCategory(detail.id, { name: input.value.trim() });
          Ui.toast('Category created.', 'good');
          loadCategories(body, detail);
        } catch (err) { Ui.toast(Ui.friendlyError(err), 'bad'); }
      });
    }
  }

  window.TrycordPagesWorkspace = { workspace, cleanup: closeChat, paintUnread, currentChannel };
})();
