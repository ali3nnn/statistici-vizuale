const sql = require('./db');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { imageBase64, message, scheduledTime } = req.body;

    const pageId = process.env.FACEBOOK_PAGE_ID;
    const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

    if (!pageId || !accessToken) {
        return res.status(500).json({ error: 'Facebook credentials not configured' });
    }

    if (!imageBase64) {
        return res.status(400).json({ error: 'imageBase64 required' });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const imageBlob = new Blob([imageBuffer], { type: 'image/jpeg' });

    const formData = new FormData();
    formData.append('access_token', accessToken);
    formData.append('message', message || '');
    formData.append('source', imageBlob, 'map.jpg');

    if (scheduledTime) {
        const ts = Math.floor(new Date(scheduledTime).getTime() / 1000);
        formData.append('published', 'false');
        formData.append('scheduled_publish_time', String(ts));
    }

    const fbRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
        method: 'POST',
        body: formData,
    });

    const data = await fbRes.json();

    if (data.error) {
        return res.status(400).json({ error: data.error.message });
    }

    return res.status(200).json({ success: true, postId: data.id || data.post_id });
};
