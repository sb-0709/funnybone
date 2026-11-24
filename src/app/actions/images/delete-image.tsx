"use server";

import { createClient } from "@/utils/supabase/server";

export const deleteImageAction = async (imageUrl: string) => {
  const supabase = await createClient();
  const extractId = imageUrl.match(/([0-9a-fA-F\-]{36})(?=\.\w+$)/);

  const imageId = extractId ? extractId[1] : null

  // Older uploads are named after their image id; try that first.
  if (imageId) {
    const { data, error } = await supabase.from('images').delete().eq('id', imageId).select('id')
    if (error) {
      throw error
    }
    if (data && data.length > 0) {
      return
    }
  }

  // Otherwise match the photo's address (row-level security limits this to
  // the signed-in user's own images).
  const { data, error } = await supabase.from('images').delete().eq('url', imageUrl).select('id')
  if (error) {
    throw error
  }
  if (!data || data.length === 0) {
    throw new Error('Image not found or not yours to delete.')
  }

};
