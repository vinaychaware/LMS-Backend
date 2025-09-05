// routes/uploads.js
import express from 'express';
import path from 'path';
import fs from 'fs';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const UPLOAD_DIR = path.resolve('uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

function parseDataUrl(dataUrl) {
  // Example: data:image/png;base64,iVBORw0KGgo...
  const match = /^data:(.+);base64,(.+)$/.exec(dataUrl || '');
  if (!match) return null;
  return { mime: match[1], base64: match[2] };
}

function extFromMime(mime) {
  const map = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
  };
  return map[mime] || '';
}

router.post('/uploads/base64', protect, async (req, res) => {
  try {
    const { dataUrl, maxMB = 5 } = req.body || {};
    if (!dataUrl) return res.status(400).json({ error: 'dataUrl required' });

    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return res.status(400).json({ error: 'Invalid data URL' });

    const { mime, base64 } = parsed;
    const ext = extFromMime(mime);
    if (!ext) return res.status(400).json({ error: `Unsupported MIME type: ${mime}` });

    const buffer = Buffer.from(base64, 'base64');
    const maxBytes = Number(maxMB) * 1024 * 1024;
    if (buffer.length > maxBytes) {
      return res.status(413).json({ error: `Image exceeds ${maxMB}MB` });
    }

    const filename = `img_${Date.now()}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    await fs.promises.writeFile(filepath, buffer);

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
    res.json({ url: fileUrl, filename, mime, size: buffer.length });
  } catch (e) {
    console.error('POST /uploads/base64 error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;