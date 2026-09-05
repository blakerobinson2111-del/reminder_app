// Quiet Reminders — a small, calm reminder app on Cloudflare Workers.
//
// Storage: Workers KV (a single JSON list under the key "reminders").
// Email: sent via the Resend API (https://resend.com) — Workers have no
// built-in way to send email, so this calls out to a transactional email
// provider. See README.md for setup.

const HTML_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Quiet Reminders</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap');

  :root {
    --paper: #F0F2ED;
    --surface: #FFFFFF;
    --ink: #1F2A24;
    --ink-soft: #5B6A61;
    --line: #DCE1D9;
    --moss: #3D5A45;
    --moss-dark: #2B4232;
    --sienna: #B0522D;
    --sienna-soft: #F4E6DE;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .wrap {
    max-width: 640px;
    margin: 0 auto;
    padding: 56px 24px 96px;
  }

  header {
    margin-bottom: 40px;
  }

  h1 {
    font-family: 'Fraunces', serif;
    font-weight: 500;
    font-size: 40px;
    line-height: 1.1;
    margin: 0 0 8px;
    letter-spacing: -0.01em;
  }

  .sub {
    color: var(--ink-soft);
    font-size: 15px;
    margin: 0;
    max-width: 46ch;
  }

  form.new-reminder {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 20px;
    margin-bottom: 48px;
  }

  .field {
    margin-bottom: 14px;
  }

  .field label {
    display: block;
    font-size: 13px;
    color: var(--ink-soft);
    margin-bottom: 6px;
  }

  .field input, .field textarea {
    width: 100%;
    font-family: inherit;
    font-size: 15px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--paper);
    color: var(--ink);
  }

  .field input:focus, .field textarea:focus {
    outline: 2px solid var(--moss);
    outline-offset: 1px;
  }

  .row {
    display: flex;
    gap: 12px;
  }

  .row .field { flex: 1; }

  textarea {
    resize: vertical;
    min-height: 44px;
  }

  button.submit {
    background: var(--moss);
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 11px 18px;
    font-family: inherit;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
  }

  button.submit:hover { background: var(--moss-dark); }

  .day-group {
    margin-bottom: 32px;
  }

  .day-label {
    font-family: 'Fraunces', serif;
    font-size: 18px;
    font-weight: 500;
    margin: 0 0 12px;
    color: var(--ink);
  }

  .reminder {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 14px 0;
    border-bottom: 1px solid var(--line);
  }

  .reminder:last-child { border-bottom: none; }

  .reminder .time {
    font-variant-numeric: tabular-nums;
    font-size: 14px;
    color: var(--ink-soft);
    width: 64px;
    flex-shrink: 0;
    padding-top: 2px;
  }

  .reminder.overdue .time { color: var(--sienna); }

  .reminder-body { flex: 1; min-width: 0; }

  .reminder-title {
    font-size: 15px;
    font-weight: 500;
    margin: 0 0 2px;
    word-wrap: break-word;
  }

  .reminder-notes {
    font-size: 14px;
    color: var(--ink-soft);
    margin: 0;
    word-wrap: break-word;
  }

  .reminder-email {
    font-size: 13px;
    color: var(--ink-soft);
    margin: 4px 0 0;
    word-wrap: break-word;
  }

  .reminder.sent .reminder-title,
  .reminder.sent .reminder-notes {
    color: var(--ink-soft);
    text-decoration: line-through;
    text-decoration-color: var(--line);
  }

  .tag {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 100px;
    background: var(--sienna-soft);
    color: var(--sienna);
    flex-shrink: 0;
  }

  button.delete {
    background: none;
    border: none;
    color: var(--ink-soft);
    cursor: pointer;
    font-size: 13px;
    padding: 4px 6px;
    flex-shrink: 0;
  }

  button.delete:hover { color: var(--sienna); }

  .empty {
    color: var(--ink-soft);
    font-size: 15px;
    padding: 24px 0;
    text-align: left;
  }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>Quiet reminders</h1>
      <p class="sub">Add something below and it'll land in your inbox at the right time. Nothing to check, nothing to open — just a nudge when it matters.</p>
    </header>

    <form class="new-reminder" id="form">
      <div class="field">
        <label for="title">Remind me to</label>
        <input id="title" name="title" type="text" placeholder="Call the dentist" required />
      </div>
      <div class="row">
        <div class="field">
          <label for="date">Date</label>
          <input id="date" name="date" type="date" required />
        </div>
        <div class="field">
          <label for="time">Time</label>
          <input id="time" name="time" type="time" required />
        </div>
      </div>
      <div class="field">
        <label for="email">Send to</label>
        <input id="email" name="email" type="email" placeholder="you@example.com" required />
      </div>
      <div class="field">
        <label for="notes">Notes (optional)</label>
        <textarea id="notes" name="notes" placeholder="Anything worth remembering alongside this"></textarea>
      </div>
      <button class="submit" type="submit">Add reminder</button>
    </form>

    <div id="list"></div>
  </div>

  <script>
    const listEl = document.getElementById('list');
    const form = document.getElementById('form');

    function dayLabel(dateStr) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const d = new Date(dateStr + 'T00:00:00');
      const diffDays = Math.round((d - today) / 86400000);
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Tomorrow';
      if (diffDays === -1) return 'Yesterday';
      return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    }

    function formatTime(dt) {
      return new Date(dt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }

    async function loadReminders() {
      const res = await fetch('/api/reminders');
      const reminders = await res.json();
      render(reminders);
    }

    function render(reminders) {
      listEl.innerHTML = '';
      if (reminders.length === 0) {
        listEl.innerHTML = '<p class="empty">Nothing on the list yet. Add your first reminder above.</p>';
        return;
      }

      reminders.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

      const groups = {};
      for (const r of reminders) {
        const dateOnly = r.datetime.slice(0, 10);
        if (!groups[dateOnly]) groups[dateOnly] = [];
        groups[dateOnly].push(r);
      }

      const now = new Date();

      for (const dateOnly of Object.keys(groups).sort()) {
        const groupEl = document.createElement('div');
        groupEl.className = 'day-group';
        const label = document.createElement('p');
        label.className = 'day-label';
        label.textContent = dayLabel(dateOnly);
        groupEl.appendChild(label);

        for (const r of groups[dateOnly]) {
          const isOverdue = !r.sent && new Date(r.datetime) < now;
          const item = document.createElement('div');
          item.className = 'reminder' + (r.sent ? ' sent' : '') + (isOverdue ? ' overdue' : '');

          const time = document.createElement('div');
          time.className = 'time';
          time.textContent = formatTime(r.datetime);
          item.appendChild(time);

          const body = document.createElement('div');
          body.className = 'reminder-body';
          const title = document.createElement('p');
          title.className = 'reminder-title';
          title.textContent = r.title;
          body.appendChild(title);
          if (r.notes) {
            const notes = document.createElement('p');
            notes.className = 'reminder-notes';
            notes.textContent = r.notes;
            body.appendChild(notes);
          }
          const emailLine = document.createElement('p');
          emailLine.className = 'reminder-email';
          emailLine.textContent = 'To: ' + r.email;
          body.appendChild(emailLine);
          item.appendChild(body);

          if (r.sent) {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.textContent = 'Sent';
            tag.style.background = '#E4E9E0';
            tag.style.color = 'var(--ink-soft)';
            item.appendChild(tag);
          } else if (isOverdue) {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.textContent = 'Sending soon';
            item.appendChild(tag);
          }

          const del = document.createElement('button');
          del.className = 'delete';
          del.textContent = 'Remove';
          del.onclick = async () => {
            await fetch('/api/reminders/' + r.id, { method: 'DELETE' });
            loadReminders();
          };
          item.appendChild(del);

          groupEl.appendChild(item);
        }
        listEl.appendChild(groupEl);
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('title').value.trim();
      const date = document.getElementById('date').value;
      const time = document.getElementById('time').value;
      const email = document.getElementById('email').value.trim();
      const notes = document.getElementById('notes').value.trim();
      if (!title || !date || !time || !email) return;

      const datetime = new Date(date + 'T' + time + ':00').toISOString();

      await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, notes, datetime, email })
      });

      form.reset();
      loadReminders();
    });

    loadReminders();
  </script>
</body>
</html>`;

async function getReminders(env) {
  const raw = await env.REMINDERS.get('reminders');
  return raw ? JSON.parse(raw) : [];
}

async function saveReminders(env, reminders) {
  await env.REMINDERS.put('reminders', JSON.stringify(reminders));
}

async function sendReminderEmail(env, reminder) {
  const subject = 'Reminder: ' + reminder.title;
  const bodyLines = [
    reminder.title,
    '',
    reminder.notes || '',
    '',
    'Scheduled for: ' + new Date(reminder.datetime).toLocaleString()
  ];

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + env.RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: [reminder.email],
      subject,
      text: bodyLines.join('\n')
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error('Resend API error (' + res.status + '): ' + errText);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(HTML_PAGE, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    if (url.pathname === '/api/reminders' && request.method === 'GET') {
      const reminders = await getReminders(env);
      return Response.json(reminders);
    }

    if (url.pathname === '/api/reminders' && request.method === 'POST') {
      const body = await request.json();
      if (!body.title || !body.datetime || !body.email) {
        return new Response('Missing title, datetime, or email', { status: 400 });
      }
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(body.email)) {
        return new Response('Invalid email address', { status: 400 });
      }
      const reminders = await getReminders(env);
      const reminder = {
        id: crypto.randomUUID(),
        title: body.title,
        notes: body.notes || '',
        datetime: body.datetime,
        email: body.email,
        sent: false
      };
      reminders.push(reminder);
      await saveReminders(env, reminders);
      return Response.json(reminder, { status: 201 });
    }

    const deleteMatch = url.pathname.match(/^\/api\/reminders\/([^/]+)$/);
    if (deleteMatch && request.method === 'DELETE') {
      const id = deleteMatch[1];
      let reminders = await getReminders(env);
      reminders = reminders.filter(r => r.id !== id);
      await saveReminders(env, reminders);
      return new Response(null, { status: 204 });
    }

    return new Response('Not found', { status: 404 });
  },

  // Runs on the cron schedule set in wrangler.toml. Checks for reminders
  // whose time has passed and haven't been emailed yet, sends the email,
  // then marks them as sent.
  async scheduled(event, env, ctx) {
    const reminders = await getReminders(env);
    const now = new Date();
    let changed = false;

    for (const reminder of reminders) {
      if (reminder.sent) continue;
      if (new Date(reminder.datetime) > now) continue;

      try {
        await sendReminderEmail(env, reminder);
        reminder.sent = true;
        changed = true;
      } catch (err) {
        console.error('Failed to send reminder ' + reminder.id + ':', err.message);
      }
    }

    if (changed) {
      await saveReminders(env, reminders);
    }
  }
};
