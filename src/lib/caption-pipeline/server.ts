import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import type { Database } from '@/types/supabase'
import { getPipelineConfig, type PipelineConfig } from './config'

export type AdminClient = SupabaseClient<Database>

/** Service-role client: bypasses RLS, so every route checks ownership itself. */
export function createAdminClient(config: PipelineConfig): AdminClient {
  return createClient<Database>(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function jsonError(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status })
}

export const unavailable = () =>
  jsonError(503, 'caption_service_unavailable', "Caption generation isn't set up yet.")

type PipelineContext = {
  config: PipelineConfig
  admin: AdminClient
  userId: string
}

/**
 * Checks the service is configured and the request carries a signed-in,
 * non-anonymous user's token (the same token the app already sends).
 */
export async function getPipelineContext(
  request: Request
): Promise<PipelineContext | NextResponse> {
  const config = getPipelineConfig()
  if (!config) return unavailable()

  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return jsonError(401, 'unauthorized', 'Please sign in again.')

  const admin = createAdminClient(config)
  const { data, error } = await admin.auth.getUser(token)
  const user = data?.user
  if (error || !user) return jsonError(401, 'unauthorized', 'Please sign in again.')
  if (user.is_anonymous || user.app_metadata?.provider === 'anonymous') {
    return jsonError(403, 'forbidden', 'Please create an account to make captions.')
  }
  return { config, admin, userId: user.id }
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
