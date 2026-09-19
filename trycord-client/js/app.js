/* Boot: shell wiring, session restore, connection status, unread engine, routing. */
(function () {
  var C = window.TrycordComponents;
  var Ui = window.TrycordUi;

  var Trycord = {
    async refreshServers() {
      try {
        TrycordState.setServers(await TrycordApi.myServers());
      } catch (e) {
        TrycordState.setServers([]);
      }
      await Trycord.refreshUnread();
      var r = window.TrycordRouter && TrycordRouter.parse ? TrycordRouter.parse() : { name: '' };
      var active = r.name === 'workspace' ? '#/servers' : '#/' + (r.name || '').split('/')[0];
      C.renderRail(active, r.name === 'workspace' ? r.id : null, Trycord.unreadServers());
      C.renderMobilebar(active);
    },

    rerender() {
      if (window.TrycordRouter) TrycordRouter.route();
    },

    async logout() {
      try { await TrycordApi.logout(); } catch (e) { /* token may already be dead */ }
      TrycordApi.token = null;
      TrycordState.user = null;
      if (window.TrycordPagesWorkspace) TrycordPagesWorkspace.cleanup();
      location.hash = '#/login';
      Ui.toast('Logged out.', 'info');
    },

    setOnline(online) {
      var pill = document.getElementById('conn-pill');
      var text = document.getElementById('conn-text');
      var dot = pill.querySelector('.dot');
      dot.className = 'dot' + (online ? '' : ' dot-bad');
      text.textContent = online ? 'Online' : 'Offline';
      document.getElementById('offline-banner').hidden = online;
      var bannerText = document.getElementById('offline-text');
      if (bannerText) {
        bannerText.textContent = 'Server unreachable — ' +
          Ui.friendlyError({ code: 'OFFLINE' }) + ' ';
      }
      C.renderAccount(online);
    },

    // Unread engine: latest timestamps from the activity feed vs read marks.
    // Muted servers/channels never produce unread. No counts — dots only.
    async refreshUnread() {
      if (!TrycordState.user) return;
      try {
        var acts = await TrycordApi.activity(50);
        acts.forEach((a) => TrycordState.touchChannel(a.channel_id, a.created_at));
      } catch (e) { /* offline: keep previous marks */ }
      paintUnread();
    },

    unreadServers() {
      var out = {};
      Object.keys(TrycordState.tch).forEach((chId) => {
        if (!TrycordState.channelUnread(chId)) return;
        var srv = Trycord.channelServer(chId);
        if (srv && !TrycordState.isMutedServer(srv)) out[srv] = true;
      });
      return out;
    },

    // serverId owning a channel, from cached channel lists (best effort).
    channelServer(channelId) {
      var map = Trycord._chanServer || {};
      return map[channelId] || null;
    },
    noteChannels(serverId, channels) {
      Trycord._chanServer = Trycord._chanServer || {};
      (channels || []).forEach((c) => { Trycord._chanServer[c.id] = serverId; });
    },

    notifyMessage(msg) {
      // Desktop notification for messages outside the open channel.
      // Muted content never notifies; failures are silent by design.
      try {
        var prefs = TrycordState.settings.notif || {};
        if (!prefs.desktop) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        if (TrycordState.user && msg.author_id === TrycordState.user.id) return;
        if (!msg.channel_id || TrycordState.isMutedChannel(msg.channel_id)) return;
        if (msg.server_id && TrycordState.isMutedServer(msg.server_id)) return;
        if (!document.hidden && msg.channel_id === Trycord.openChannelId()) return;
        new Notification(msg.user || 'Trycord', { body: String(msg.content || '').slice(0, 140) });
      } catch (e) { /* ignore */ }
    },

    openChannelId() {
      return (window.TrycordPagesWorkspace && TrycordPagesWorkspace.currentChannel) ?
        TrycordPagesWorkspace.currentChannel() : null;
    },
  };
  window.Trycord = Trycord;

  function paintUnread() {
    var r = window.TrycordRouter && TrycordRouter.parse ? TrycordRouter.parse() : { name: '' };
    var active = r.name === 'workspace' ? '#/servers' : '#/' + (r.name || '').split('/')[0];
    C.renderRail(active, r.name === 'workspace' ? r.id : null, Trycord.unreadServers());
    C.renderMobilebar(active);
    if (r.name === 'workspace' && window.TrycordPagesWorkspace && TrycordPagesWorkspace.paintUnread) {
      TrycordPagesWorkspace.paintUnread();
    }
  }
  Trycord.paintUnread = paintUnread;

  function wireChrome() {
    document.getElementById('retry-link').onclick = () => location.reload();

    var toggle = document.getElementById('nav-toggle');
    toggle.innerHTML = Ui.icon('menu');
    toggle.onclick = () => {
      var open = !document.body.classList.contains('nav-open');
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    var back = document.getElementById('back-btn');
    back.innerHTML = Ui.icon('back');
    back.onclick = () => history.back();

    var palBtn = document.getElementById('palette-btn');
    palBtn.innerHTML = Ui.icon('search');
    palBtn.onclick = () => C.openPalette();

    var panelBtn = document.getElementById('panel-toggle');
    panelBtn.innerHTML = Ui.icon('users');
    panelBtn.onclick = () => {
      var open = document.body.classList.toggle('panel-open');
      var hidden = document.getElementById('member-panel').hidden;
      if (hidden && open) document.getElementById('member-panel').hidden = false;
      panelBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    var railAccount = document.getElementById('rail-account');
    railAccount.onclick = (e) => C.accountMenu(e.currentTarget);
    document.getElementById('avatar-btn').onclick = (e) => C.accountMenu(e.currentTarget);
    document.getElementById('account-settings').innerHTML = Ui.icon('cog');
    document.getElementById('account-settings').onclick = () => { location.hash = '#/settings'; };
    var themeBtn = document.getElementById('account-theme');
    themeBtn.innerHTML = Ui.icon('eye');
    themeBtn.onclick = () => {
      TrycordState.settings.theme = TrycordState.settings.theme === 'light' ? 'dark' : 'light';
      TrycordState.saveSettings();
      Ui.toast('Theme: ' + TrycordState.settings.theme, 'info');
    };

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#menu-root .menu') &&
          !e.target.closest('#palette-root .palette') &&
          !e.target.closest('[aria-haspopup="menu"]') &&
          !e.target.closest('#palette-btn')) {
        Ui.closeMenu();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') Ui.closeMenu();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (TrycordState.user) C.openPalette();
      }
    });
  }

  async function probe() {
    try {
      await TrycordApi.health();
      Trycord.setOnline(true);
    } catch (e) {
      Trycord.setOnline(false);
    }
  }

  async function boot() {
    wireChrome();
    await probe();
    setInterval(probe, 60000);
    if (TrycordApi.token) {
      try {
        TrycordState.user = await TrycordApi.me();
        await Trycord.refreshServers();
      } catch (e) {
        TrycordApi.token = null;
        TrycordState.user = null;
      }
    }
    window.addEventListener('hashchange', () => window.TrycordRouter.route());
    if (!location.hash) location.hash = '#/';
    await window.TrycordRouter.route();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
