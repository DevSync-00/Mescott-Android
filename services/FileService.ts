import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { supabase } from '../lib/supabase'

export interface FileUploadResult {
  success: boolean
  url?: string
  filename?: string
  size?: number
  type?: string
  error?: string
}

export class FileService {
  // Pick a document/file
  static async pickDocument(options?: {
    type?: string[]
    copyToCacheDirectory?: boolean
  }): Promise<DocumentPicker.DocumentPickerResult> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: options?.type || ['*/*'],
        copyToCacheDirectory: options?.copyToCacheDirectory ?? true,
      })
      return result
    } catch (error) {
      console.error('Error picking document:', error)
      throw error
    }
  }

  // Get file info
  static async getFileInfo(fileUri: string): Promise<{ type: string; size: number; name: string }> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri)
      if (!fileInfo.exists) {
        throw new Error('File does not exist')
      }

      // Get file extension to determine MIME type
      const extension = fileUri.split('.').pop()?.toLowerCase() || ''
      const mimeTypes: Record<string, string> = {
        pdf: 'application/pdf',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ppt: 'application/vnd.ms-powerpoint',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        txt: 'text/plain',
        zip: 'application/zip',
        rar: 'application/x-rar-compressed',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        mp4: 'video/mp4',
        mov: 'video/quicktime',
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
      }

      return {
        type: mimeTypes[extension] || 'application/octet-stream',
        size: fileInfo.size || 0,
        name: fileUri.split('/').pop() || 'file',
      }
    } catch (error) {
      console.error('Error getting file info:', error)
      return {
        type: 'application/octet-stream',
        size: 0,
        name: 'file',
      }
    }
  }

  // Upload file to Supabase Storage
  static async uploadFile(
    fileUri: string,
    folder: string = 'chat-attachments',
    maxRetries: number = 3,
  ): Promise<FileUploadResult> {
    let lastError: any = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 File upload attempt ${attempt}/${maxRetries} for ${fileUri}`)

        // Get file info
        const fileInfo = await this.getFileInfo(fileUri)

        // Create a unique filename
        const timestamp = Date.now()
        const randomId = Math.random().toString(36).substring(2, 15)
        const fileExtension = fileUri.split('.').pop() || 'bin'
        const fileName = `${timestamp}_${randomId}.${fileExtension}`
        const filePath = `${folder}/${fileName}`

        // Use FormData for React Native compatibility (same approach as ImageService)
        const formData = new FormData()
        formData.append('file', {
          uri: fileUri,
          type: fileInfo.type,
          name: fileName,
        } as any)

        // Upload to Supabase Storage
        const uploadPromise = supabase.storage.from('tasker-documents').upload(filePath, formData, {
          contentType: fileInfo.type,
          upsert: false,
        })

        // Add timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Upload timeout after 30 seconds')), 30000)
        })

        const { data, error } = (await Promise.race([uploadPromise, timeoutPromise])) as any

        if (error) {
          throw error
        }

        // Get public URL
        const { data: urlData } = supabase.storage.from('tasker-documents').getPublicUrl(filePath)

        console.log(`✅ File upload successful on attempt ${attempt}`)
        return {
          success: true,
          url: urlData.publicUrl,
          filename: fileInfo.name,
          size: fileInfo.size,
          type: fileInfo.type,
        }
      } catch (error) {
        lastError = error
        console.error(`❌ File upload attempt ${attempt} failed:`, error)

        const err = error as { message?: string; code?: string }
        if (
          attempt < maxRetries &&
          (err?.message?.includes('timeout') ||
            err?.message?.includes('Network request timed out') ||
            err?.code === 'StorageUnknownError')
        ) {
          const waitTime = Math.pow(2, attempt) * 1000 // Exponential backoff
          console.log(`⏳ Waiting ${waitTime}ms before retry...`)
          await new Promise((resolve) => setTimeout(resolve, waitTime))
        }
      }
    }

    console.error('❌ All file upload attempts failed')
    return {
      success: false,
      error: lastError instanceof Error ? lastError.message : 'Failed to upload file after multiple attempts',
    }
  }

  // Format file size for display
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // Get file icon name based on file type
  static getFileIcon(fileType: string): string {
    if (fileType.startsWith('image/')) return 'image'
    if (fileType.startsWith('video/')) return 'videocam'
    if (fileType.startsWith('audio/')) return 'musical-notes'
    if (fileType === 'application/pdf') return 'document-text'
    if (
      fileType.includes('word') ||
      fileType.includes('document') ||
      fileType.includes('text')
    )
      return 'document-text'
    if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'document'
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return 'document'
    if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('archive'))
      return 'archive'
    return 'document'
  }
}

