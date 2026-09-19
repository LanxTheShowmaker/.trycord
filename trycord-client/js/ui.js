/* UI primitives: escaping, toasts, modal/dialog, states, avatar, time. */
(function () {
  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  function toast(message, type) {
    var root = document.getElementById('toasts');
    var el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    el.setAttribute('role', 'status');
    var span = document.createElement('span');
    span.textContent = message;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-btn';
    btn.setAttribute('aria-label', 'Dismiss');
    btn.textContent = '✕';
    btn.onclick = () => el.remove();
    el.append(span, btn);
    root.appendChild(el);
    setTimeout(() => { if (el.isConnected) el.remove(); }, 5000);
  }

  function openModal(opts) {
    var root = document.getElementById('modal-root');
    root.innerHTML = '';
    var scrim = document.createElement('div');
    scrim.className = 'modal-scrim';
    var box = document.createElement('div');
    box.className = 'modal';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', opts.title || 'Dialog');
    var head = document.createElement('div');
    head.className = 'modal-head';
    var h2 = document.createElement('h2');
    h2.textContent = opts.title || '';
    head.appendChild(h2);
    var body = document.createElement('div');
    body.className = 'modal-body';
    if (typeof opts.body === 'string') body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);
    var foot = document.createElement('div');
    foot.className = 'modal-foot';
    function close() {
      root.innerHTML = '';
      document.removeEventListener('keydown', onKey);
      if (opts.onClose) opts.onClose();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    (opts.actions || [{ id: 'ok', label: 'OK', primary: true }]).forEach((a) => {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn' + (a.primary ? ' btn-primary' : '') + (a.danger ? ' btn-danger' : '');
      if (a.id) b.dataset.action = a.id;
      b.textContent = a.label;
      b.onclick = () => {
        if (a.onClick) a.onClick(close, { primary: foot.querySelector('.btn-primary'), all: foot });
        else close();
      };
      foot.appendChild(b);
      if (a.primary) setTimeout(() => b.focus(), 0);
    });
    scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(); });
    document.addEventListener('keydown', onKey);
    box.append(head, body, foot);
    scrim.appendChild(box);
    root.appendChild(scrim);
    return close;
  }

  function confirmDialog(opts) {
    return new Promise((resolve) => {
      var msg = document.createElement('p');
      msg.textContent = opts.message || 'Are you sure?';
      openModal({
        title: opts.title || 'Confirm',
        body: msg,
        onClose: () => resolve(false),
        actions: [
          { id: 'cancel', label: opts.cancelText || 'Cancel' },
          {
            id: 'ok', label: opts.confirmText || 'Confirm', primary: !opts.danger, danger: !!opts.danger,
            onClick: (close) => { close(); resolve(true); },
          },
        ],
      });
    });
  }

  function skeletons(n, cls) {
    var html = '';
    for (var i = 0; i < (n || 3); i++) html += '<div class="skeleton"></div>';
    return '<div class="' + (cls || 'stack') + '" aria-busy="true" aria-label="Loading">' + html + '</div>';
  }

  function emptyState(o) {
    return (
      '<div class="state" role="status">' +
      '<div class="glyph" aria-hidden="true">' + (o.icon || '○') + '</div>' +
      '<h3>' + esc(o.title || 'Nothing here yet') + '</h3>' +
      '<p>' + esc(o.hint || '') + '</p>' +
      '<div class="actions">' + (o.actions || '') + '</div></div>'
    );
  }

  function errorState(message, retryLabel) {
    return (
      '<div class="state" role="alert">' +
      '<div class="glyph" aria-hidden="true">⚠</div><h3>Something went wrong</h3>' +
      '<p>' + esc(message || 'Request failed.') + '</p>' +
      '<div class="actions"><button type="button" class="btn btn-primary" data-retry>' +
      esc(retryLabel || 'Retry') + '</button></div></div>'
    );
  }

  function avatarHtml(name, size) {
    var n = String(name || '?').trim() || '?';
    var hue = 0;
    for (var i = 0; i < n.length; i++) hue = (hue * 31 + n.charCodeAt(i)) % 360;
    return '<span class="avatar ' + (size || '') + '" aria-hidden="true" style="background:hsl(' +
      hue + ',45%,42%)">' + esc(n[0].toUpperCase()) + '</span>';
  }

  function badge(text, kind) {
    return '<span class="badge ' + (kind || '') + '">' + esc(text) + '</span>';
  }

  function timeAgo(iso) {
    if (!iso) return 'never';
    var t = new Date(iso).getTime();
    if (isNaN(t)) return 'never';
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 86400 * 7) return Math.floor(s / 86400) + 'd ago';
    return new Date(t).toLocaleDateString();
  }

  function fullDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return isNaN(d) ? '—' : d.toLocaleString();
  }

  function fieldError(input, msg) {
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    var err = input.parentElement.querySelector('.field-err');
    if (!err) {
      err = document.createElement('div');
      err.className = 'field-err';
      input.after(err);
    }
    err.textContent = msg || '';
    return !msg;
  }

  function setLoading(btn, loading, label) {
    if (!btn) return;
    if (loading) {
      btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = esc(label || 'Working…');
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    }
  }

  function icon(name, cls) {
    return '<svg class="icon ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  // Context / dropdown menu. items: [{icon, label, hint?, danger?, disabled?, action?}]
  // Returns a close fn. Esc + outside click close; first item autofocused.
  function menu(anchor, items, opts) {
    opts = opts || {};
    closeMenu();
    var m = document.createElement('div');
    m.className = 'menu';
    m.setAttribute('role', 'menu');
    if (opts.label) {
      var head = document.createElement('div');
      head.className = 'menu-head';
      head.textContent = opts.label;
      m.appendChild(head);
    }
    var visible = items.filter((i) => !i.hidden);
    visible.forEach((item, idx) => {
      if (item.sep) {
        var sep = document.createElement('div');
        sep.className = 'menu-sep';
        m.appendChild(sep);
        return;
      }
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      if (item.danger) b.className = 'danger';
      if (item.disabled) b.disabled = true;
      b.innerHTML = (item.icon ? icon(item.icon) : '') + '<span></span>';
      b.querySelector('span').textContent = item.label;
      if (item.hint) {
        var hint = document.createElement('small');
        hint.className = 'muted';
        hint.style.marginLeft = 'auto';
        hint.textContent = item.hint;
        b.appendChild(hint);
      }
      b.onclick = () => {
        closeMenu();
        if (item.action) item.action();
      };
      m.appendChild(b);
      if (idx === 0) setTimeout(() => b.focus(), 0);
    });
    document.getElementById('menu-root').appendChild(m);
    var r = anchor.getBoundingClientRect();
    m.style.top = Math.min(window.innerHeight - m.offsetHeight - 8, r.bottom + 6) + 'px';
    m.style.left = Math.max(8, Math.min(window.innerWidth - m.offsetWidth - 8, r.left)) + 'px';
    function onKey(e) {
      if (e.key === 'Escape') closeMenu();
    }
    function onDoc(e) {
      if (!m.contains(e.target)) closeMenu();
    }
    document.addEventListener('keydown', onKey);
    setTimeout(() => document.addEventListener('mousedown', onDoc), 0);
    function closeMenu() {
      if (m.isConnected) m.remove();
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
    }
    m._close = closeMenu;
    return closeMenu;
  }

  function closeMenu() {
    document.querySelectorAll('#menu-root .menu').forEach((m) => {
      if (m._close) m._close();
      else m.remove();
    });
  }

  // Backend/network errors -> contextual human copy. Never leaks internals.
  function friendlyError(e, context) {
    var code = (e && e.code) || '';
    switch (code) {
      case 'OFFLINE': return 'The Trycord server didn’t respond. Check that it’s running and reachable.';
      case 'SESSION_REVOKED':
      case 'AUTH_REQUIRED': return 'Your session expired. Please log in again.';
      case 'NOT_A_MEMBER': return 'You’re not a member of this server.';
      case 'PERMISSION_DENIED': return 'You don’t have permission to do that here.';
      case 'SERVER_PRIVATE': return 'This server is private — you need an invite.';
      case 'SERVER_NOT_FOUND': return 'That server doesn’t exist (or is private).';
      case 'INVITE_INVALID': return 'Invite not found. Check the code and try again.';
      case 'INVITE_EXPIRED': return 'That invite has expired.';
      case 'INVITE_EXHAUSTED': return 'That invite has no uses left.';
      case 'INVITE_REVOKED': return 'That invite was revoked.';
      case 'ALREADY_MEMBER': return 'You’re already a member.';
      case 'VALIDATION_ERROR': return (e && e.message) || 'Please check your input and try again.';
      default:
        if (context === 'server') return 'Couldn’t load this server. The Trycord server didn’t respond.';
        if (context === 'messages') return 'Couldn’t load messages. Try again in a moment.';
        return (e && e.message) || 'Something went wrong. Please retry.';
    }
  }

  function dayLabel(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var today = new Date();
    var yesterday = new Date(Date.now() - 86400000);
    var sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(d, today)) return 'Today';
    if (sameDay(d, yesterday)) return 'Yesterday';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  window.TrycordUi = {
    esc, toast, openModal, confirmDialog, skeletons,
    emptyState, errorState, avatarHtml, badge, timeAgo, fullDate,
    fieldError, setLoading, icon, menu, closeMenu, friendlyError, dayLabel,
  };
})();
