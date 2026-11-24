import { NextResponse } from 'next/server'

import { SUPPORTED_IMAGE_TYPES, UPLOAD_BUCKET } from '@/lib/caption-pipeline/config'
import { getPipelineContext, jsonError } from '@/lib/caption-pipeline/server'

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

/**
 * POST { contentType } → { presignedUrl, cdnUrl }
 * A one-time link the browser uploads the photo to (HTTP PUT), and the public
 * address the photo will have afterwards.
 */
export async function POST(request: Request) {
  const context = await getPipelineContext(request)
  if (context instanceof NextResponse) return context
  const { admin, userId } = context

  const body = (await request.json().catch(() => null)) as { contentType?: unknown } | null
  const raw = typeof body?.contentType === 'string' ? body.contentType.toLowerCase() : ''
  const contentType = raw === 'image/jpg' ? 'image/jpeg' : raw
  if (!(SUPPORTED_IMAGE_TYPES as readonly string[]).includes(contentType)) {
    return jsonError(400, 'unsupported_type', 'Please upload a JPG, PNG, WEBP or HEIC photo.')
  }

  // Name the file after the image id it will get, like the original service did:
  // the app's Delete button reads the image id from the file name.
  const path = `${userId}/${crypto.randomUUID()}.${EXTENSIONS[contentType]}`
  const storage = admin.storage.from(UPLOAD_BUCKET)
  const { data, error } = await storage.createSignedUploadUrl(path)
  if (error || !data?.signedUrl) {
    console.error('Could not create upload link:', error)
    return jsonError(500, 'upload_link_failed', 'Could not prepare the upload. Try again.')
  }
  const { data: publicUrl } = storage.getPublicUrl(path)

  return NextResponse.json({ presignedUrl: data.signedUrl, cdnUrl: publicUrl.publicUrl })
}
