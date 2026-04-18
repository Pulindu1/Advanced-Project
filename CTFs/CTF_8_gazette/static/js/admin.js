// PressRoom admin page client-side guard.
//
// DELIBERATELY VULNERABLE (OWASP A01:2021):
// The admin area is protected only in the browser. The server does NOT
// enforce the admin role on /api/admin/* routes. Any authenticated user can
// call the underlying API endpoints directly, for example with curl.

(function () {
  var content = document.getElementById('admin-content');
  if (!content) {
    return;
  }

  function renderAccessDenied() {
    content.innerHTML = ''
      + '<div class="admin-denied">'
      + '<h2>Access denied</h2>'
      + '<p>PressRoom: Access denied. This section requires editorial clearance.</p>'
      + '<p class="muted">Redirecting you back to the dashboard.</p>'
      + '</div>';
    setTimeout(function () {
      window.location = '/dashboard?error=admin_required';
    }, 1800);
  }

  function renderAdmin(user, data) {
    var tools = (data.maintenance_tools || []).map(function (t) {
      return ''
        + '<li class="tool-row">'
        + '<div class="tool-head"><strong>' + t.name + '</strong> '
        + '<span class="tool-meta">' + t.method + ' ' + t.endpoint + '</span></div>'
        + '<pre class="tool-body">' + t.body + '</pre>'
        + '<p class="tool-note">' + t.note + ' (added by <em>' + t.added_by + '</em>)</p>'
        + '</li>';
    }).join('');

    var users = (data.users || []).map(function (u) {
      return '<tr>'
        + '<td>' + u.username + '</td>'
        + '<td>' + u.display_name + '</td>'
        + '<td><span class="pill pill-' + u.role + '">' + u.role + '</span></td>'
        + '<td>' + (u.active ? 'active' : 'disabled') + '</td>'
        + '</tr>';
    }).join('');

    content.innerHTML = ''
      + '<div class="admin-pane">'
      + '<h2>Editor-in-chief dashboard</h2>'
      + '<p>Signed in as <strong>' + user.display_name + '</strong> (' + user.username + ').</p>'
      + '<section class="admin-stats"><h3>Newsroom stats</h3>'
      + '<ul>'
      + '<li>Users total: ' + data.stats.users_total + '</li>'
      + '<li>Articles total: ' + data.stats.articles_total + '</li>'
      + '<li>Drafts in flight: ' + data.stats.drafts_in_flight + '</li>'
      + '<li>Published this week: ' + data.stats.published_this_wk + '</li>'
      + '</ul></section>'
      + '<section class="admin-users"><h3>User directory</h3>'
      + '<table><thead><tr><th>username</th><th>display name</th><th>role</th><th>status</th></tr></thead>'
      + '<tbody>' + users + '</tbody></table></section>'
      + '<section class="admin-tools"><h3>Maintenance tools</h3>'
      + '<ul class="tool-list">' + tools + '</ul></section>'
      + '</div>';
  }

  fetch('/api/me', { credentials: 'same-origin' })
    .then(function (r) { return r.json(); })
    .then(function (user) {
      if (!user || user.role !== 'admin') {
        renderAccessDenied();
        return;
      }
      return fetch('/api/admin/dashboard', { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (data) { renderAdmin(user, data); });
    })
    .catch(function () {
      renderAccessDenied();
    });
}());
