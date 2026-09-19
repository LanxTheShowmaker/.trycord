/* Client state, three scopes:
   - access-point config:  which instance to talk to (this device's pointer)
   - instance state:       token, favorites, recent, mutes, read marks,
                           collapsed categories, last channels — namespaced
   - global state:         appearance + notification prefs, shared across
                           instances on this browser (never tokens/URLs)
   apiBase is access config, NOT a user preference. */
(function () {
  var ACCENTS = {
    teal: { main: '#3ddbb9', ink: '#052925' },
    violet: { main: '#9d8cff', ink: '#1d1440' },
    amber: { main: '#f5b14c', ink: '#3a2200' },
    blue: { main: '#5aa9ff', ink: '#0a2547' },
  };

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ }
  }
  function drop(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }
  function rawGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function instanceSlug() {
    try {
      var id = window.TRYCORD_CONFIG && window.TRYCORD_CONFIG.instanceId;
      if (id && String(id).trim()) {
        return 'cfg-' + String(id).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      }
    } catch (e) { /* ignore */ }
    try {
      var api = window.TrycordApi;
      if (api && api.baseUrl) {
        return 'url-' + new URL(api.baseUrl()).host.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      }
      return 'url-unknown';
    } catch (e) {
      return 'url-unknown';
    }
  }

  var slug = instanceSlug();
  var NS = 'trycord:' + slug + ':';

  // One-time upgrade from the old flat keys into this instance's namespace.
  (function migrateLegacy() {
    if (rawGet(NS + 'token') !== null) return;
    var legacyToken = rawGet('trycord.token');
    if (legacyToken) {
      try { localStorage.setItem(NS + 'token', legacyToken); } catch (e) { /* ignore */ }
      save(NS + 'favorites', load('trycord.favorites', []));
      save(NS + 'recent', load('trycord.recent', []));
      ['trycord.token', 'trycord.favorites', 'trycord.recent'].forEach(drop);
    }
  })();

  // Access config migration: apiBase used to live in settings.
  var access = load('trycord.access', null) || { apiBase: '' };
  if (!access.apiBase) {
    var legacySettings = load('trycord.settings', {});
    if (legacySettings && legacySettings.apiBase) {
      access.apiBase = legacySettings.apiBase;
      delete legacySettings.apiBase;
      save('trycord.settings', legacySettings);
      save('trycord.access', access);
    }
  }

  var State = {
    user: null,
    servers: [],
    perms: {}, // serverId -> { is_owner, permissions[] }
    instanceSlug: slug,
    access,
    favorites: load(NS + 'favorites', []),
    recent: load(NS + 'recent', []),
    mutedServers: load(NS + 'muted', { servers: [], channels: [] }),
    collapsed: load(NS + 'collapsed', {}), // serverId -> [categoryId]
    read: load(NS + 'read', {}),           // channelId -> ISO ts last seen
    lastChannel: load(NS + 'lastChannel', {}), // serverId -> channelId
    tch: {}, // session-only: channelId -> latest known message ts
    ui: Object.assign({ memberPanel: true }, load('trycord.ui', {})),
    // Global preferences, shared across instances on this browser.
    settings: Object.assign(
      {
        theme: 'dark', accent: 'teal', density: 'comfortable', contrast: 'normal',
        motion: 'system', fontScale: 1, notif: { desktop: false },
      },
      load('trycord.settings', {})
    ),

    tokenKey: () => NS + 'token',
    saveAccess() {
      save('trycord.access', State.access);
    },
    saveSettings() {
      save('trycord.settings', State.settings);
      State.applyAppearance();
    },
    saveUi() {
      save('trycord.ui', State.ui);
    },
    applyAppearance() {
      var s = State.settings;
      var root = document.documentElement;
      root.dataset.theme = s.theme === 'light' ? 'light' : 'dark';
      root.dataset.density = s.density === 'compact' ? 'compact' : 'comfortable';
      root.dataset.contrast = s.contrast === 'high' ? 'high' : 'normal';
      root.dataset.motion = s.motion === 'off' ? 'off' : (s.motion === 'on' ? 'on' : 'system');
      var a = ACCENTS[s.accent] || ACCENTS.teal;
      root.style.setProperty('--accent', a.main);
      root.style.setProperty('--accent-ink', a.ink);
      var fs = Number(s.fontScale) || 1;
      fs = Math.min(1.2, Math.max(0.9, fs));
      root.style.setProperty('--fs', fs);
    },

    setServers(list) {
      State.servers = Array.isArray(list) ? list : [];
      var ids = {};
      State.servers.forEach((s) => { ids[s.id] = true; });
      State.favorites = State.favorites.filter((id) => ids[id]);
      State.recent = State.recent.filter((r) => ids[r.id]);
      save(NS + 'favorites', State.favorites);
      save(NS + 'recent', State.recent);
    },
    setPerms(serverId, accessPerms) {
      State.perms[serverId] = accessPerms || { is_owner: false, permissions: [] };
    },
    can(serverId, perm) {
      var a = State.perms[serverId];
      if (!a) return false;
      if (a.is_owner) return true;
      return (a.permissions || []).indexOf(perm) !== -1;
    },
    serverById(id) {
      for (var i = 0; i < State.servers.length; i++) {
        if (State.servers[i].id === id) return State.servers[i];
      }
      return null;
    },

    // Favorites / recents (instance-scoped)
    isFav(id) { return State.favorites.indexOf(id) !== -1; },
    toggleFav(id) {
      var i = State.favorites.indexOf(id);
      if (i === -1) State.favorites.push(id);
      else State.favorites.splice(i, 1);
      save(NS + 'favorites', State.favorites);
      return i === -1;
    },
    touchRecent(id) {
      State.recent = [{ id, ts: Date.now() }].concat(
        State.recent.filter((r) => r.id !== id)
      ).slice(0, 8);
      save(NS + 'recent', State.recent);
    },

    // Mutes (instance-scoped server preferences)
    isMutedServer(id) { return State.mutedServers.servers.indexOf(id) !== -1; },
    isMutedChannel(id) { return State.mutedServers.channels.indexOf(id) !== -1; },
    toggleMuteServer(id) {
      var l = State.mutedServers.servers;
      var i = l.indexOf(id);
      if (i === -1) l.push(id);
      else l.splice(i, 1);
      save(NS + 'muted', State.mutedServers);
      return i === -1;
    },
    toggleMuteChannel(id) {
      var l = State.mutedServers.channels;
      var i = l.indexOf(id);
      if (i === -1) l.push(id);
      else l.splice(i, 1);
      save(NS + 'muted', State.mutedServers);
      return i === -1;
    },

    // Collapsed categories per server (instance-scoped UI pref)
    isCollapsed(serverId, catId) {
      return (State.collapsed[serverId] || []).indexOf(catId) !== -1;
    },
    setCollapsed(serverId, catId, closed) {
      var l = State.collapsed[serverId] || (State.collapsed[serverId] = []);
      var i = l.indexOf(catId);
      if (closed && i === -1) l.push(catId);
      if (!closed && i !== -1) l.splice(i, 1);
      save(NS + 'collapsed', State.collapsed);
    },
    resetCollapsed(serverId) {
      delete State.collapsed[serverId];
      save(NS + 'collapsed', State.collapsed);
    },

    // Read marks (instance-scoped) + session latest timestamps
    lastSeen(channelId) { return State.read[channelId] || null; },
    markRead(channelId, iso) {
      State.read[channelId] = iso || new Date().toISOString();
      // cap growth
      var keys = Object.keys(State.read);
      if (keys.length > 200) {
        keys.slice(0, keys.length - 200).forEach((k) => delete State.read[k]);
      }
      save(NS + 'read', State.read);
    },
    touchChannel(channelId, iso) {
      if (!iso) return;
      if (!State.tch[channelId] || iso > State.tch[channelId]) State.tch[channelId] = iso;
    },
    channelUnread(channelId) {
      if (State.isMutedChannel(channelId)) return false;
      var seen = State.lastSeen(channelId);
      var latest = State.tch[channelId];
      if (!latest) return false;
      return !seen || latest > seen;
    },
    setLastChannel(serverId, channelId) {
      State.lastChannel[serverId] = channelId;
      save(NS + 'lastChannel', State.lastChannel);
    },
    getLastChannel(serverId) { return State.lastChannel[serverId] || null; },

    clearLocal() {
      State.favorites = [];
      State.recent = [];
      State.mutedServers = { servers: [], channels: [] };
      State.read = {};
      State.collapsed = {};
      State.lastChannel = {};
      [NS + 'favorites', NS + 'recent', NS + 'muted', NS + 'read',
        NS + 'collapsed', NS + 'lastChannel'].forEach(drop);
    },
  };

  // Re-read in case migration just populated this instance.
  State.favorites = load(NS + 'favorites', State.favorites);
  State.recent = load(NS + 'recent', State.recent);

  State.applyAppearance();
  window.TrycordState = State;
  window.TrycordAccents = ACCENTS;
})();
