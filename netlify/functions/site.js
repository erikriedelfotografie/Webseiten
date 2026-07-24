// Netlify Function: liest/schreibt die Website-Datei auf GitHub.
// Der GitHub-Token liegt nur als Umgebungsvariable auf dem Server (nie im Browser).
// Zugriff nur mit gültigem Netlify-Identity-Login (siehe context.clientContext.user).

exports.handler = async (event, context) => {
  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Nicht eingeloggt. Bitte zuerst über Netlify Identity anmelden.' })
    };
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_REPO = process.env.GITHUB_REPO;       // Format: "owner/repo"
  const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
  const GITHUB_PATH = process.env.GITHUB_PATH || 'index.html';

  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server ist nicht korrekt konfiguriert (GITHUB_TOKEN oder GITHUB_REPO fehlt als Umgebungsvariable).' })
    };
  }

  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_PATH}`;
  const ghHeaders = {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json'
  };

  // ---------- Datei lesen ----------
  if (event.httpMethod === 'GET') {
    try {
      const res = await fetch(`${apiUrl}?ref=${encodeURIComponent(GITHUB_BRANCH)}&_=${Date.now()}`, {
        headers: ghHeaders,
        cache: 'no-store'
      });
      if (!res.ok) {
        const t = await res.text();
        return { statusCode: res.status, body: JSON.stringify({ error: `GitHub-Fehler beim Lesen: ${t}` }) };
      }
      const data = await res.json();
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return {
        statusCode: 200,
        body: JSON.stringify({ content, sha: data.sha })
      };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  // ---------- Datei schreiben ----------
  if (event.httpMethod === 'POST') {
    try {
      const { content, sha } = JSON.parse(event.body || '{}');
      if (typeof content !== 'string' || !content.length) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Kein Inhalt übermittelt.' }) };
      }

      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: { ...ghHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Website-Update über Admin-Panel (${user.email}) — ${new Date().toISOString()}`,
          content: Buffer.from(content, 'utf-8').toString('base64'),
          branch: GITHUB_BRANCH,
          ...(sha ? { sha } : {})
        })
      });

      if (!putRes.ok) {
        const t = await putRes.text();
        if (putRes.status === 409) {
          return { statusCode: 409, body: JSON.stringify({ error: 'Die Datei wurde zwischenzeitlich geändert. Bitte neu laden und erneut versuchen.' }) };
        }
        return { statusCode: putRes.status, body: JSON.stringify({ error: `GitHub-Fehler beim Schreiben: ${t}` }) };
      }

      const result = await putRes.json();
      return { statusCode: 200, body: JSON.stringify({ ok: true, sha: result.content.sha }) };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, body: JSON.stringify({ error: 'Methode nicht erlaubt.' }) };
};
