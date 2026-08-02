// Tauscht den Adobe-OAuth "code" (aus der Redirect-URL) gegen Access-/Refresh-Token.
// Client Secret bleibt hier auf dem Server, wird nie an den Browser geschickt.

exports.handler = async (event) => {
  const code = event.queryStringParameters && event.queryStringParameters.code;
  if (!code) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Kein "code" Parameter erhalten.' }) };
  }

  const CLIENT_ID = process.env.LIGHTROOM_CLIENT_ID;
  const CLIENT_SECRET = process.env.LIGHTROOM_CLIENT_SECRET;
  const REDIRECT_URI = process.env.LIGHTROOM_REDIRECT_URI; // muss exakt der in Adobe hinterlegten URI entsprechen

  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server nicht konfiguriert (LIGHTROOM_CLIENT_ID / LIGHTROOM_CLIENT_SECRET / LIGHTROOM_REDIRECT_URI fehlt).' }) };
  }

  try {
    const res = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: 'Token-Austausch fehlgeschlagen', details: data }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
