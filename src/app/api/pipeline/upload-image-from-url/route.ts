import { NextResponse } from 'next/server'
import { UPLOAD_BUCKET } from '@/lib/caption-pipeline/config'
import { getPipelineContext, jsonError } from '@/lib/caption-pipeline/server'

/**
 * POST { imageUrl, isCommonUse } → { imageId }
 * Saves an uploaded (or pasted) photo as an image owned by the user.
 * The photo is public so it can show next to captions the user chooses to Post;
 * the captions themselves start private.
 */
export async function POST(request: Request) {
  const context = await getPipelineContext(request)
  if (context instanceof NextResponse) return context
  const { admin, config, userId } = context

  const body = (await request.json().catch(() => null)) as { imageUrl?: unknown } | null
  const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : ''
  let parsed: URL
  try {
    parsed = new URL(imageUrl)
  } catch {
    return jsonError(400, 'invalid_url', 'Please use a valid image link.')
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || imageUrl.length > 2000) {
    return jsonError(400, 'invalid_url', 'Please use a valid image link.')
  }

  // Photos uploaded through our signed link are named "<userId>/<id>.<ext>".
  // Reuse that id for the image row, so the file name matches the image id.
  const uploadPrefix = `${config.supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${UPLOAD_BUCKET}/${userId}/`
  const fileId = parsed.toString().startsWith(uploadPrefix)
    ? parsed.pathname.match(/\/([0-9a-f-]{36})\.[a-z]+$/i)?.[1]
    : undefined

  const { data, error } = await admin
    .from('images')
    .insert({
      ...(fileId ? { id: fileId } : {}),
      url: parsed.toString(),
      profile_id: userId,
      is_public: true,
      // Only staff curate the shared library, so user uploads never join it.
      is_common_use: false,
      created_by_user_id: userId,
      modified_by_user_id: userId,
    })
    .select('id')
    .single()
  if (error || !data) {
    console.error('Could not save image:', error)
    return jsonError(500, 'image_save_failed', 'Could not save your photo. Try again.')
  }

  return NextResponse.json({ imageId: data.id })
}
