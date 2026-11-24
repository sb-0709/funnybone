import { NextResponse } from 'next/server'

import { getJobForUser } from '@/lib/caption-pipeline/jobs'
import { UUID_PATTERN, getPipelineContext, jsonError } from '@/lib/caption-pipeline/server'

/** GET → { jobId, status, progress, captionIds } for the signed-in owner. */
export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const context = await getPipelineContext(request)
  if (context instanceof NextResponse) return context
  const { admin, userId } = context

  const { jobId } = await params
  if (!UUID_PATTERN.test(jobId)) return jsonError(404, 'not_found', 'Caption job not found.')

  const job = await getJobForUser(admin, jobId, userId)
  if (!job) return jsonError(404, 'not_found', 'Caption job not found.')
  return NextResponse.json(job, { headers: { 'Cache-Control': 'no-store' } })
}
