/* Account pages: profile + structured settings (account, appearance,
   notifications, privacy, accessibility, server preferences). */
(function () {
  var Ui = window.TrycordUi;
  var C = window.TrycordComponents;

  function profile(root) {
    var u = TrycordState.user;
    var mine = TrycordState.servers;
    var owned = mine.filter((s) => s.is_owner).length;
    C.setTopbar('Profile', '@' + u.username);
    root.innerHTML =
      '<section class="settings-card"><div class="row wrap">' + Ui.avatarHtml(u.displayName || u.username, 'lg') +
      '<div><h2 style="margin:0">' + Ui.esc(u.displayName || u.username) + '</h2>' +
      '<p class="muted" style="margin:0">@' + Ui.esc(u.username) + ' · member since ' + Ui.fullDate(u.createdAt) + '</p></div>' +
      '</div>' +
      '<p class="hint">Avatars are generated from your name. Bio, status, and banners aren’t supported by Trycord instances yet — what you see here is everything stored about you.</p></section>' +
      '<div class="stats" style="margin-top:1rem">' +
      '<div class="stat"><div class="num">' + mine.length + '</div><div class="lbl">Servers joined</div></div>' +
      '<div class="stat"><div class="num">' + owned + '</div><div class="lbl">Servers owned</div></div>' +
      '<div class="stat"><div class="num">' + TrycordState.favorites.length + '</div><div class="lbl">Favorites</div></div>' +
      '</div>' +
      '<section class="section"><h2>Your servers</h2><div id="prof-servers"></div></section>';

    var box = document.getElementById('prof-servers');
    if (!mine.length) {
      box.innerHTML = Ui.emptyState({
        icon: '▦', title: 'No servers yet',
        hint: 'Join or create a server to get started.',
        actions: '<a class="btn btn-ghost btn-sm" href="#/join">Join server</a>',
      });
    } else {
      box.innerHTML = '<div class="grid-cards">' + mine.map((s) => C.serverCard(s)).join('') + '</div>';
      C.wireCards(box);
    }
  }

  var ACCENT_ORDER = ['teal', 'violet', 'amber', 'blue'];

  function settings(root) {
    var u = TrycordState.user;
    var s = TrycordState.settings;
    C.setTopbar('Settings', 'Account, appearance, and application.');
    root.innerHTML =
      '<div class="settings-grid">' +
      '<section class="settings-card" aria-labelledby="set-account"><h2 id="set-account">Account</h2>' +
      '<p class="hint">Signed in as <b>@' + Ui.esc(u.username) + '</b> on this instance.</p>' +
      '<form id="name-form"><label class="field"><span>Display name</span>' +
      '<input type="text" id="set-display" maxlength="32" value="' + Ui.esc(u.displayName || '') + '" /></label>' +
      '<button class="btn btn-primary btn-sm" type="submit">Save display name</button></form>' +
      '<hr class="divider" />' +
      '<form id="pw-form"><label class="field"><span>Current password</span>' +
      '<input type="password" id="pw-cur" autocomplete="current-password" /></label>' +
      '<label class="field"><span>New password (6+ characters)</span>' +
      '<input type="password" id="pw-new" autocomplete="new-password" /></label>' +
      '<button class="btn btn-sm" type="submit">Change password</button></form></section>' +

      '<section class="settings-card" aria-labelledby="set-appear"><h2 id="set-appear">Appearance</h2>' +
      '<div class="form-row"><label class="small muted" for="set-theme">Theme</label>' +
      '<select id="set-theme"><option value="dark">Dark</option><option value="light">Light</option></select>' +
      '<label class="small muted" for="set-density">Density</label>' +
      '<select id="set-density"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></div>' +
      '<div class="form-row" style="margin-top:0.6rem"><span class="small muted">Accent</span><span class="swatch-row" id="accent-row" role="group" aria-label="Accent color"></span></div>' +
      '<div class="preview-card" aria-label="Appearance preview"><div class="row">' +
      Ui.avatarHtml(u.displayName || u.username, 'sm') +
      '<div><strong>Preview</strong><br><small class="muted">Buttons, badges, and links follow your accent.</small></div>' +
      '<span style="margin-left:auto"></span><button type="button" class="btn btn-primary btn-sm" disabled>Save</button></div></div>' +
      '<div class="form-row" style="margin-top:0.6rem"><button class="btn btn-ghost btn-sm" id="appear-reset" type="button">Reset appearance</button></div>' +
      '<p class="hint">Appearance is shared across instances on this device.</p></section>' +

      '<section class="settings-card" aria-labelledby="set-notif"><h2 id="set-notif">Notifications</h2>' +
      '<label class="switch"><input type="checkbox" id="set-desktop-notif"' + (s.notif && s.notif.desktop ? ' checked' : '') + ' />' +
      '<span class="track" aria-hidden="true"></span>Desktop notifications for new messages</label>' +
      '<p class="hint">Notifies for messages outside your open channel. Muted servers and channels never notify. Uses your browser’s notification permission.</p></section>' +

      '<section class="settings-card" aria-labelledby="set-privacy"><h2 id="set-privacy">Privacy</h2>' +
      '<p class="hint">Your session token is revoked server-side on logout. Favorites, mutes, and read marks stay in this browser, scoped to the current instance.</p>' +
      '<div class="form-row"><button class="btn btn-ghost btn-sm" id="clear-local" type="button">Clear favorites, mutes &amp; recent</button>' +
      '<button class="btn btn-ghost btn-sm" id="logout-btn2" type="button">Log out</button></div></section>' +

      '<section class="settings-card" aria-labelledby="set-a11y"><h2 id="set-a11y">Accessibility</h2>' +
      '<div class="form-row"><label class="small muted" for="set-motion">Motion</label>' +
      '<select id="set-motion"><option value="system">Follow system</option><option value="off">Reduce motion</option></select></div>' +
      '<div class="form-row" style="margin-top:0.6rem"><label class="small muted" for="set-contrast">Contrast</label>' +
      '<select id="set-contrast"><option value="normal">Normal</option><option value="high">High contrast</option></select></div>' +
      '<div class="form-row" style="margin-top:0.6rem"><label class="small muted" for="set-font">Text size</label>' +
      '<select id="set-font"><option value="0.9">Smaller</option><option value="1">Default</option><option value="1.1">Larger</option><option value="1.2">Largest</option></select></div></section>' +

      '<section class="settings-card" aria-labelledby="set-servers"><h2 id="set-servers">Server preferences</h2>' +
      '<div id="srv-prefs"></div></section>' +

      '<section class="settings-card" aria-labelledby="set-app"><h2 id="set-app">Application</h2>' +
      '<form id="api-form"><label class="field"><span>Server URL (blank = auto)</span>' +
      '<input type="url" id="set-api" placeholder="http://localhost:9971" value="' + Ui.esc((TrycordState.access && TrycordState.access.apiBase) || '') + '" /></label>' +
      '<div class="form-row"><button class="btn btn-sm" type="submit">Save &amp; reload</button>' +
      '<button class="btn btn-ghost btn-sm" type="button" id="api-test">Test connection</button>' +
      '<span id="api-status" class="small muted" role="status"></span></div></form>' +
      '<hr class="divider" />' +
      '<div class="form-row"><span class="small muted">Global sync: <b id="global-status">checking…</b></span>' +
      '<button class="btn btn-ghost btn-sm" type="button" id="global-retry">Recheck</button></div>' +
      '<p class="hint">Trycord web client v0.5.0 · instance-aware access point.</p></section>' +
      '</div>';

    // Account
    document.getElementById('name-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      var input = document.getElementById('set-display');
      if (!Ui.fieldError(input, input.value.trim() ? '' : 'Display name cannot be empty.')) return;
      try {
        var updated = await TrycordApi.patchMe({ displayName: input.value.trim() });
        TrycordState.user = updated;
        C.renderAccount();
        Ui.toast('Display name saved.', 'good');
      } catch (err) { Ui.toast(Ui.friendlyError(err), 'bad'); }
    });

    document.getElementById('pw-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      var cur = document.getElementById('pw-cur');
      var neu = document.getElementById('pw-new');
      var ok = Ui.fieldError(cur, cur.value ? '' : 'Enter your current password.');
      ok = Ui.fieldError(neu, neu.value.length >= 6 ? '' : 'New password must be 6+ characters.') && ok;
      if (!ok) return;
      try {
        await TrycordApi.changePassword({ currentPassword: cur.value, newPassword: neu.value });
        cur.value = '';
        neu.value = '';
        Ui.toast('Password changed.', 'good');
      } catch (err) {
        Ui.fieldError(cur, Ui.friendlyError(err));
      }
    });

    // Appearance with live preview
    document.getElementById('set-theme').value = s.theme || 'dark';
    document.getElementById('set-density').value = s.density || 'comfortable';
    var accentRow = document.getElementById('accent-row');
    function paintAccents() {
      accentRow.innerHTML = '';
      ACCENT_ORDER.forEach((name) => {
        var a = window.TrycordAccents[name];
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'swatch';
        b.style.background = a.main;
        b.title = name[0].toUpperCase() + name.slice(1);
        b.setAttribute('aria-label', 'Accent ' + name);
        b.setAttribute('aria-pressed', TrycordState.settings.accent === name ? 'true' : 'false');
        b.onclick = () => {
          TrycordState.settings.accent = name;
          TrycordState.saveSettings();
          paintAccents();
        };
        accentRow.appendChild(b);
      });
    }
    paintAccents();
    document.getElementById('set-theme').addEventListener('change', (e) => {
      TrycordState.settings.theme = e.target.value;
      TrycordState.saveSettings();
    });
    document.getElementById('set-density').addEventListener('change', (e) => {
      TrycordState.settings.density = e.target.value;
      TrycordState.saveSettings();
    });
    document.getElementById('appear-reset').onclick = () => {
      TrycordState.settings.theme = 'dark';
      TrycordState.settings.accent = 'teal';
      TrycordState.settings.density = 'comfortable';
      TrycordState.settings.contrast = 'normal';
      TrycordState.settings.motion = 'system';
      TrycordState.settings.fontScale = 1;
      TrycordState.saveSettings();
      settings(root);
      Ui.toast('Appearance reset.', 'info');
    };

    // Notifications: real Notification API permission flow
    document.getElementById('set-desktop-notif').addEventListener('change', async (e) => {
      if (e.target.checked) {
        if (!('Notification' in window)) {
          e.target.checked = false;
          Ui.toast('This browser does not support desktop notifications.', 'bad');
          return;
        }
        try {
          var perm = await Notification.requestPermission();
          if (perm !== 'granted') {
            e.target.checked = false;
            Ui.toast('Notification permission was not granted.', 'bad');
            return;
          }
        } catch (err) {
          e.target.checked = false;
          Ui.toast('Could not request notification permission.', 'bad');
          return;
        }
      }
      TrycordState.settings.notif = TrycordState.settings.notif || {};
      TrycordState.settings.notif.desktop = e.target.checked;
      TrycordState.saveSettings();
      Ui.toast(e.target.checked ? 'Desktop notifications on.' : 'Desktop notifications off.', 'info');
    });

    // Accessibility
    document.getElementById('set-motion').value = s.motion || 'system';
    document.getElementById('set-contrast').value = s.contrast || 'normal';
    document.getElementById('set-font').value = String(s.fontScale || 1);
    document.getElementById('set-motion').addEventListener('change', (e) => {
      TrycordState.settings.motion = e.target.value;
      TrycordState.saveSettings();
    });
    document.getElementById('set-contrast').addEventListener('change', (e) => {
      TrycordState.settings.contrast = e.target.value;
      TrycordState.saveSettings();
    });
    document.getElementById('set-font').addEventListener('change', (e) => {
      TrycordState.settings.fontScale = Number(e.target.value) || 1;
      TrycordState.saveSettings();
    });

    // Server preferences (per-server, this instance)
    var prefs = document.getElementById('srv-prefs');
    if (!TrycordState.servers.length) {
      prefs.innerHTML = '<p class="muted">Join a server to manage per-server preferences here.</p>';
    } else {
      prefs.innerHTML = '<ul class="member-list">' + TrycordState.servers.map((srv) =>
        '<li class="member-item">' + Ui.avatarHtml(srv.name, 'sm') +
        '<span class="who"><strong>' + Ui.esc(srv.name) + '</strong></span>' +
        '<span class="row">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-pfav="' + Ui.esc(srv.id) + '" aria-pressed="' +
        (TrycordState.isFav(srv.id) ? 'true' : 'false') + '">' +
        (TrycordState.isFav(srv.id) ? '★ Favorited' : '☆ Favorite') + '</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-pmute="' + Ui.esc(srv.id) + '" aria-pressed="' +
        (TrycordState.isMutedServer(srv.id) ? 'true' : 'false') + '">' +
        (TrycordState.isMutedServer(srv.id) ? 'Unmute' : 'Mute') + '</button>' +
        '</span></li>').join('') + '</ul>';
      prefs.querySelectorAll('[data-pfav]').forEach((b) => {
        b.onclick = () => {
          var f = TrycordState.toggleFav(b.dataset.pfav);
          b.textContent = f ? '★ Favorited' : '☆ Favorite';
          b.setAttribute('aria-pressed', f ? 'true' : 'false');
        };
      });
      prefs.querySelectorAll('[data-pmute]').forEach((b) => {
        b.onclick = () => {
          var m = TrycordState.toggleMuteServer(b.dataset.pmute);
          b.textContent = m ? 'Unmute' : 'Mute';
          b.setAttribute('aria-pressed', m ? 'true' : 'false');
          Trycord.paintUnread();
        };
      });
    }

    // Application: backend URL + global status
    document.getElementById('api-form').addEventListener('submit', (e) => {
      e.preventDefault();
      var raw = document.getElementById('set-api').value.trim();
      if (raw && !TrycordApi.normalizeUrl(raw)) {
        Ui.fieldError(document.getElementById('set-api'), 'Use an http(s) URL like http://51.79.44.111:9971');
        return;
      }
      TrycordState.access.apiBase = raw;
      TrycordState.saveAccess();
      location.reload();
    });

    document.getElementById('api-test').onclick = async (e) => {
      var btn = e.currentTarget;
      var status = document.getElementById('api-status');
      Ui.setLoading(btn, true, 'Testing…');
      status.textContent = '';
      var raw = document.getElementById('set-api').value.trim();
      var r = await TrycordApi.testConnection(raw || TrycordApi.baseUrl());
      Ui.setLoading(btn, false);
      if (!r.url) status.textContent = '⚠ ' + r.message;
      else if (r.ok) status.textContent = '✓ Connected to Trycord (' + r.latencyMs + ' ms)';
      else status.textContent = '✕ ' + r.message;
    };

    document.getElementById('clear-local').onclick = async () => {
      var yes = await Ui.confirmDialog({
        title: 'Clear local data?',
        message: 'This removes favorites, mutes, read marks, and recents for this instance on this device.',
        confirmText: 'Clear',
      });
      if (yes) {
        TrycordState.clearLocal();
        Ui.toast('Local data cleared.', 'good');
      }
    };
    document.getElementById('logout-btn2').onclick = () => Trycord.logout();

    var refreshGlobal = async () => {
      var el = document.getElementById('global-status');
      if (!el) return;
      el.textContent = 'checking…';
      var r = await TrycordGlobal.check();
      var g = TrycordGlobal.globalUrl();
      el.textContent = TrycordGlobal.describe(r.status) + (g ? ' (' + g + ')' : '');
    };
    document.getElementById('global-retry').onclick = refreshGlobal;
    refreshGlobal();
  }

  window.TrycordPagesAccount = { profile, settings };
})();
