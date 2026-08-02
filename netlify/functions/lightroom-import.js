// Holt die Fotos eines gewählten Lightroom-Albums (als Renditions) und liefert sie
// als fertige base64 data-URLs zurück, damit sie direkt in eine Sammlung/Kategorie
// eingebaut werden können.

function stripXssiPrefix(text) {
  return text.replace(/^while \(1\) \{\}\n?/, '');
}

exports.handler = async (event) => {
  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Kein Authorization-Header (Access Token) mitgeschickt.' }) };
  }

  const { catalogId, albumId, limit } = event.queryStringParameters || {};
  if (!catalogId || !albumId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'catalogId und albumId sind erforderlich.' }) };
  }
  const maxAssets = Math.min(parseInt(limit || '8', 10) || 8, 20);

  const CLIENT_ID = process.env.LIGHTROOM_CLIENT_ID;
  const headers = { Authorization: auth, 'X-API-Key': CLIENT_ID };

  try {
    // 1. Assets des Albums auflisten
    const assetsRes = await fetch(
      `https://lr.adobe.io/v2/catalogs/${catalogId}/albums/${albumId}/assets?limit=${maxAssets}&embed=asset`,
      { headers }
    );
    const assetsText = await assetsRes.text();
    if (!assetsRes.ok) {
      return { statusCode: assetsRes.status, body: JSON.stringify({ error: 'Asset-Liste fehlgeschlagen', details: assetsText }) };
    }
    const assetsData = JSON.parse(stripXssiPrefix(assetsText));
    const resources = assetsData.resources || [];
    const assetIds = resources.map(r => (r.asset && r.asset.id) || r.id).filter(Boolean);

    // 2. Für jedes Asset eine Rendition (mittlere Auflösung) laden und als base64 zurückgeben
    const photos = [];
    for (const assetId of assetIds) {
      try {
        const renRes = await fetch(
          `https://lr.adobe.io/v2/catalogs/${catalogId}/assets/${assetId}/renditions/1280`,
          { headers }
        );
        if (!renRes.ok) continue;
        const contentType = renRes.headers.get('content-type') || 'image/jpeg';
        const buf = Buffer.from(await renRes.arrayBuffer());
        photos.push(`data:${contentType};base64,${buf.toString('base64')}`);
      } catch (e) {
        // einzelnes Bild überspringen, Rest trotzdem liefern
        continue;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ count: photos.length, photos }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
