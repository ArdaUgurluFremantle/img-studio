// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use server'

import { addNewFirestoreEntry } from '@/app/api/firestore/action'
import { getVideoThumbnailBase64, uploadBase64Image } from '@/app/api/cloud-storage/action'
import { ExportMediaFormFieldsI, ExportMediaFormI } from '@/app/api/export-utils'
import { ImageI } from '@/app/api/generate-image-utils'
import { VideoI } from '@/app/api/generate-video-utils'

/**
 * Auto-save a batch of medias (images/videos) to Firestore metadata collection.
 * For videos, also generates and uploads a thumbnail to TEAM bucket when available.
 */
export async function autoSaveMediaBatch(
  medias: Array<ImageI | VideoI>,
  exportFields: ExportMediaFormFieldsI | undefined
): Promise<void> {
  if (!medias || medias.length === 0 || !exportFields) return

  for (const media of medias) {
    try {
      const baseData: any = media as any

      const formData: ExportMediaFormI = {
        mediaToExport: media,
        upscaleFactor: baseData.upscaleFactor ?? '',
      } as any

      // For videos, try to build/upload thumbnail and attach its GCS URI
      if (baseData.format === 'MP4') {
        try {
          const result = await getVideoThumbnailBase64(baseData.gcsUri, baseData.ratio)
          if (result.thumbnailBase64Data && process.env.NEXT_PUBLIC_TEAM_BUCKET) {
            const upload = await uploadBase64Image(
              result.thumbnailBase64Data,
              process.env.NEXT_PUBLIC_TEAM_BUCKET,
              `${baseData.key}_thumbnail.png`,
              'image/png'
            )
            if (upload.success && upload.fileUrl) (formData as any).videoThumbnailGcsUri = upload.fileUrl
          }
        } catch (e) {
          // Non-blocking
          console.warn('Auto-save thumbnail generation failed:', e)
        }
      }

      await addNewFirestoreEntry(media.key, formData, exportFields)
    } catch (e) {
      // Non-blocking per item
      console.warn('Auto-save failed for media', (media as any)?.key, e)
    }
  }
}


