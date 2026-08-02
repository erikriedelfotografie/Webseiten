// Listet die Alben aus dem Lightroom-Cloud-Katalog des eingeloggten Nutzers.
// Adobe hängt Antworten defensiv "while (1) {}" voran (XSSI-Schutz) — muss vor JSON.parse entfernt werden.

function stripXssiPrefix(text) {
  return text.replace(/^while \(1\) \{\}\n?/, '');
}

exports.handler = async (event) => {
  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Kein Authorization-Header (Access Token) mitgeschickt.' }) };
  }

  const CLIENT_ID = process.env.LIGHTROOM_CLIENT_ID;
  const headers = { Authorization: auth, 'X-API-Key': CLIENT_ID };

  try {
    // 1. Katalog des Nutzers ermitteln
    const catRes = await fetch('https://lr.adobe.io/v2/catalog', { headers });
    const catText = await catRes.text();
    if (!catRes.ok) {
      return { statusCode: catRes.status, body: JSON.stringify({ error: 'Katalog-Abruf fehlgeschlagen', details: catText }) };
    }
    const catalog = JSON.parse(stripXssiPrefix(catText));
    const catalogId = catalog.id;

    // 2. Alben dieses Katalogs abrufen
    const albumsRes = await fetch(`https://lr.adobe.io/v2/catalogs/${catalogId}/albums?limit=100`, { headers });
    const albumsText = await albumsRes.text();
    if (!albumsRes.ok) {
      return { statusCode: albumsRes.status, body: JSON.stringify({ error: 'Alben-Abruf fehlgeschlagen', details: albumsText }) };
    }
    const albumsData = JSON.parse(stripXssiPrefix(albumsText));
    const resources = albumsData.resources || [];

    const albums = resources.map(a => ({
      id: a.id,
      name: (a.payload && a.payload.name) || '(ohne Namen)',
      assetCount: a.asset_count || 0,
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ catalogId, albums }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
