import { Router, Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth';
import { query } from '../db/pool';
import { auditLog } from '../middleware/audit';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();

// ── Multer config ───────────────────────────────────────────────
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dest = path.resolve(config.uploads.dir);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  if (ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP and PDF files are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.uploads.maxSizeMB * 1024 * 1024 },
});

// ── POST /api/complaints/:id/attachments ────────────────────────
router.post(
  '/:id/attachments',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        res.status(400).json({ success: false, message: err.message });
        return;
      } else if (err) {
        res.status(400).json({ success: false, message: (err as Error).message });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    const complaintId = Number(req.params['id']);
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    try {
      // Verify complaint exists
      const checkRes = await query<{ id: number }>(
        'SELECT id FROM complaints WHERE id = $1',
        [complaintId]
      );
      if (checkRes.length === 0) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        res.status(404).json({ success: false, message: 'Complaint not found' });
        return;
      }

      const result = await query<{
        id: number;
        original_name: string;
        stored_name: string;
        size_bytes: number;
        mime_type: string;
        uploaded_by: number;
        created_at: Date;
      }>(
        `INSERT INTO attachments (complaint_id, original_name, stored_name, mime_type, size_bytes, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, original_name, stored_name, size_bytes, mime_type, uploaded_by, created_at`,
        [
          complaintId,
          req.file.originalname,
          path.basename(req.file.path),  // stored filename only
          req.file.mimetype,
          req.file.size,
          req.user!.userId,
        ]
      );

      await auditLog(
        req.user!.userId,
        'ATTACHMENT_UPLOAD',
        'complaint',
        String(complaintId),
        req,
        { fileName: req.file.originalname, size: req.file.size }
      );

      logger.info('Attachment uploaded', {
        complaintId,
        fileName: req.file.originalname,
        uploadedBy: req.user!.userId,
      });

      res.status(201).json({ success: true, data: result[0] });
    } catch (err) {
      // Clean up file on DB error
      try { fs.unlinkSync(req.file!.path); } catch { /* ignore */ }
      logger.error('Attachment upload DB error', { err });
      res.status(500).json({ success: false, message: 'Failed to save attachment' });
    }
  }
);

// ── DELETE /api/complaints/:id/attachments/:attachmentId ────────
router.delete(
  '/:id/attachments/:attachmentId',
  authenticate,
  async (req: Request, res: Response) => {
    const complaintId = Number(req.params['id']);
    const attachmentId = Number(req.params['attachmentId']);

    try {
      const result = await query<{ id: number; stored_name: string; uploaded_by: number }>(
        'SELECT id, stored_name, uploaded_by FROM attachments WHERE id = $1 AND complaint_id = $2',
        [attachmentId, complaintId]
      );

      if (result.length === 0) {
        res.status(404).json({ success: false, message: 'Attachment not found' });
        return;
      }

      const attachment = result[0]!;

      // Only allow uploader or admin to delete
      const role = req.user!.role;
      if (
        attachment.uploaded_by !== req.user!.userId &&
        role !== 'phed_admin'
      ) {
        res.status(403).json({ success: false, message: 'Not authorised to delete this attachment' });
        return;
      }

      // Remove DB record
      await query('DELETE FROM attachments WHERE id = $1', [attachmentId]);

      // Remove file from disk (best-effort)
      try {
        const filePath = path.join(path.resolve(config.uploads.dir), attachment.stored_name);
        fs.unlinkSync(filePath);
      } catch (fsErr) {
        logger.warn('Could not delete attachment file from disk', {
          storedName: attachment.stored_name,
          err: (fsErr as Error).message,
        });
      }

      await auditLog(
        req.user!.userId,
        'ATTACHMENT_DELETE',
        'complaint',
        String(complaintId),
        req,
        { attachmentId }
      );

      res.json({ success: true, message: 'Attachment deleted' });
    } catch (err) {
      logger.error('Attachment delete error', { err });
      res.status(500).json({ success: false, message: 'Failed to delete attachment' });
    }
  }
);

// ── GET /api/complaints/:id/attachments ─────────────────────────
router.get(
  '/:id/attachments',
  authenticate,
  async (req: Request, res: Response) => {
    const complaintId = Number(req.params['id']);
    try {
      const result = await query<{
        id: number;
        original_name: string;
        stored_name: string;
        size_bytes: number;
        mime_type: string;
        uploaded_by_name: string;
        created_at: Date;
      }>(
        `SELECT a.id, a.original_name, a.stored_name, a.size_bytes, a.mime_type, a.created_at,
                u.full_name AS uploaded_by_name
         FROM attachments a
         JOIN users u ON u.id = a.uploaded_by
         WHERE a.complaint_id = $1
         ORDER BY a.created_at DESC`,
        [complaintId]
      );
      res.json({ success: true, data: result });
    } catch (err) {
      logger.error('Fetch attachments error', { err });
      res.status(500).json({ success: false, message: 'Failed to fetch attachments' });
    }
  }
);

export default router;
