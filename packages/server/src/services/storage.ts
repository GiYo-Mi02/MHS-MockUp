import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'
import { v2 as cloudinary } from 'cloudinary'

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || ''
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || ''
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || ''
const CLOUDINARY_FOLDER = process.env.CLOUDINARY_FOLDER || 'makati-report/evidence'
const PORT = Number(process.env.PORT || 4000)
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`

let cloudinaryConfigured = false

if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET
  })
  cloudinaryConfigured = true
}

const uploadsRoot = path.join(process.cwd(), 'uploads', 'evidence')

export type EvidenceUploadFile = {
  buffer: Buffer
  mimetype: string
  originalname?: string
}

export type UploadResult = {
  url: string
  provider: 'cloudinary' | 'local'
  contentType: string
}

export function isCloudinaryConfigured(): boolean {
  return cloudinaryConfigured
}

function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function resolvePublicUrl(filename: string): string {
  const base = (PUBLIC_BASE_URL || '').replace(/\/$/, '')
  if (!base) {
    return `/uploads/evidence/${filename}`
  }
  return `${base}/uploads/evidence/${filename}`
}

export async function uploadEvidenceImage(file: EvidenceUploadFile): Promise<UploadResult> {
  if (!file || !file.buffer) {
    throw new Error('No file buffer provided for upload')
  }

  if (!file.mimetype || !file.mimetype.startsWith('image/')) {
    throw new Error('Only image evidence is supported at this time')
  }

  if (cloudinaryConfigured) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: CLOUDINARY_FOLDER,
          resource_type: 'image',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }]
        },
        (error, result) => {
          if (error || !result) {
            reject(error || new Error('Cloudinary upload failed'))
            return
          }
          resolve({
            url: result.secure_url,
            provider: 'cloudinary',
            contentType: file.mimetype
          })
        }
      )

      uploadStream.end(file.buffer)
    })
  }

  await fs.promises.mkdir(uploadsRoot, { recursive: true })
  const extension = path.extname(file.originalname || '') || '.jpg'
  const safeBase = sanitizeFileName(path.basename(file.originalname || 'evidence', extension)) || 'evidence'
  const uniqueSuffix = randomBytes(6).toString('hex')
  const filename = `${safeBase}-${uniqueSuffix}${extension}`
  const filePath = path.join(uploadsRoot, filename)
  await fs.promises.writeFile(filePath, file.buffer)

  return {
    url: resolvePublicUrl(filename),
    provider: 'local',
    contentType: file.mimetype
  }
}

export function getUploadDiagnostics() {
  return {
    cloudinaryConfigured,
    folder: CLOUDINARY_FOLDER,
    publicBaseUrl: PUBLIC_BASE_URL || null
  }
}
