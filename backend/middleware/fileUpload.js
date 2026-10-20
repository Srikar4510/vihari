const multer = require('multer');
const { v1: uuidv1 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const cloudinary = require('cloudinary').v2;

// Uploads go to Cloudinary when CLOUDINARY_URL is set (production: hosting disks are wiped on
// every deploy), otherwise to backend/uploads/images (local development).
//   Photos    -> stored as their public https URL.
//   Documents -> stored privately as "cloudinary:<public_id>" and only served through the
//                admin API with a short-lived signed link.
const useCloud = () => Boolean(process.env.CLOUDINARY_URL);
const FOLDER = process.env.CLOUDINARY_FOLDER || 'vihari';

const UPLOAD_ROOT = path.join(__dirname, '..');
const UPLOAD_DIR = path.join(UPLOAD_ROOT, 'uploads', 'images');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB, matches the forms

const fileUpload = multer({
  limits: { fileSize: MAX_BYTES },
  storage: useCloud()
    ? multer.memoryStorage()
    : multer.diskStorage({
      destination: (req, file, cb) => cb(null, UPLOAD_DIR),
      filename: (req, file, cb) => cb(null, uuidv1() + path.extname(file.originalname)),
    }),
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) return cb(null, true);
    const error = new Error('Invalid file type! Only image and PDF files are allowed.');
    error.status = 400;
    return cb(error);
  },
});

const streamToCloud = (buffer, options) => new Promise((resolve, reject) => {
  const upload = cloudinary.uploader.upload_stream(options, (err, result) => (err ? reject(err) : resolve(result)));
  Readable.from(buffer).pipe(upload);
});

// Runs after multer: in cloud mode, sends the file to Cloudinary and remembers where it went.
// kind: 'image' (public photo) or 'document' (private partner document).
const persistUpload = (kind = 'image') => async (req, res, next) => {
  if (!req.file || !useCloud()) return next();
  try {
    const result = kind === 'document'
      ? await streamToCloud(req.file.buffer, { folder: `${FOLDER}/documents`, resource_type: 'raw', type: 'authenticated', public_id: uuidv1() + path.extname(req.file.originalname) })
      : await streamToCloud(req.file.buffer, { folder: `${FOLDER}/images`, resource_type: 'image' });
    req.file.stored = kind === 'document' ? `cloudinary:${result.public_id}` : result.secure_url;
    req.file.cloudId = { publicId: result.public_id, resourceType: result.resource_type, type: result.type };
    return next();
  } catch (error) {
    console.log('Cloud upload failed:', error.message);
    return res.status(502).json({ success: false, error: 'Could not store the file. Please try again.' });
  }
};

// Value to save in the database for an uploaded file.
const uploadedPath = (file) => {
  if (!file) return null;
  if (file.stored) return file.stored;
  return file.filename ? `uploads/images/${file.filename}` : null;
};

// Public id of a photo from its Cloudinary URL (".../upload/v123/vihari/images/abc.jpg" -> "vihari/images/abc").
const publicIdFromUrl = (url) => {
  const m = /\/upload\/(?:v\d+\/)?(.+?)(\.[a-z0-9]+)?$/i.exec(url);
  return m ? m[1] : null;
};

// Deletes a file that is no longer needed: one just uploaded for a rejected request...
const removeUpload = (file) => {
  if (!file) return;
  if (file.cloudId) {
    cloudinary.uploader.destroy(file.cloudId.publicId, { resource_type: file.cloudId.resourceType, type: file.cloudId.type }).catch(() => {});
  } else if (file.path) {
    fs.unlink(file.path, () => {});
  }
};

// ...or one referenced from the database (a replaced photo, a deleted bus, a rejected partner).
const removeStored = (stored) => {
  if (!stored) return;
  if (stored.startsWith('cloudinary:')) {
    cloudinary.uploader.destroy(stored.slice(11), { resource_type: 'raw', type: 'authenticated' }).catch(() => {});
  } else if (stored.includes('res.cloudinary.com')) {
    const id = publicIdFromUrl(stored);
    if (id) cloudinary.uploader.destroy(id).catch(() => {});
  } else if (stored.startsWith('uploads/')) {
    fs.unlink(path.join(UPLOAD_ROOT, stored), () => {});
  }
};

// Sends a stored private document to the response (admin only). Returns false if it is missing.
const sendStored = async (stored, res) => {
  if (!stored) return false;
  if (stored.startsWith('cloudinary:')) {
    const url = cloudinary.utils.private_download_url(stored.slice(11), '', {
      resource_type: 'raw', type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 60,
    });
    const file = await fetch(url);
    if (!file.ok) return false;
    res.setHeader('Content-Type', /\.pdf$/i.test(stored) ? 'application/pdf' : file.headers.get('content-type') || 'application/octet-stream');
    res.send(Buffer.from(await file.arrayBuffer()));
    return true;
  }
  if (stored.startsWith('uploads/')) {
    const file = path.join(UPLOAD_ROOT, stored);
    if (!fs.existsSync(file)) return false;
    res.sendFile(file);
    return true;
  }
  return false;
};

module.exports = fileUpload;
module.exports.uploadedPath = uploadedPath;
module.exports.persistUpload = persistUpload;
module.exports.removeUpload = removeUpload;
module.exports.removeStored = removeStored;
module.exports.sendStored = sendStored;
module.exports.useCloud = useCloud;
