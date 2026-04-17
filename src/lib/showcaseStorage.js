'use client'
/**
 * showcaseStorage.js — Загрузка фото/видео для витрины
 *
 * Использует Supabase Storage bucket "showcase"
 *
 * НАСТРОЙКА (один раз в Supabase Dashboard):
 *   1. Storage > Create bucket > Имя: "showcase" > Public: ON
 *   2. Policies: allow insert for anon (или через API)
 *
 * Файлы загружаются в: showcase/{wallet}/{timestamp}-{filename}
 * URL: https://YOUR_PROJECT.supabase.co/storage/v1/object/public/showcase/...
 *
 * ИЗМЕНЕНИЯ (17 апр 2026):
 *   + compressPreview — специальное сжатие для OG-превью в мессенджерах:
 *     1200x630, качество 0.65, center crop. Итог ~100-180KB — WhatsApp
 *     на мобильном подхватывает надёжно. Используется только для
 *     превью-картинки, не для основных photos[] витрины.
 */
import supabase from './supabase'

const BUCKET = 'showcase'
const MAX_FILE_SIZE = 10 * 1024 * 1024  // 10 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm']

/**
 * Загрузить файл (фото или видео) в Supabase Storage
 * @param {File} file — файл из <input type="file">
 * @param {string} wallet — кошелёк владельца
 * @returns {{ ok: boolean, url?: string, error?: string }}
 */
export async function uploadShowcaseFile(file, wallet) {
  if (!supabase) return { ok: false, error: 'Supabase не подключён' }
  if (!file) return { ok: false, error: 'Нет файла' }
  if (!wallet) return { ok: false, error: 'Нет кошелька' }

  // Проверка размера
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: `Файл слишком большой (макс ${MAX_FILE_SIZE / 1024 / 1024} МБ)` }
  }

  // Проверка типа
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type)
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type)
  if (!isImage && !isVideo) {
    return { ok: false, error: 'Только фото (JPG, PNG, WebP) или видео (MP4, WebM)' }
  }

  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const timestamp = Date.now()
    const path = `${wallet.toLowerCase()}/${timestamp}.${ext}`

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      })

    if (error) {
      console.error('Upload error:', error)
      return { ok: false, error: error.message || 'Ошибка загрузки' }
    }

    // Получить публичный URL
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(data.path)

    return {
      ok: true,
      url: urlData.publicUrl,
      path: data.path,
      type: isImage ? 'image' : 'video',
    }
  } catch (e) {
    return { ok: false, error: e.message || 'Ошибка загрузки' }
  }
}

/**
 * Загрузить несколько файлов
 */
export async function uploadMultipleFiles(files, wallet) {
  const urls = []
  const errors = []

  for (const file of files) {
    const result = await uploadShowcaseFile(file, wallet)
    if (result.ok) {
      urls.push(result.url)
    } else {
      errors.push(`${file.name}: ${result.error}`)
    }
  }

  return { ok: errors.length === 0, urls, errors }
}

/**
 * Удалить файл из Storage
 */
export async function deleteShowcaseFile(path) {
  if (!supabase) return { ok: false, error: 'Supabase не подключён' }

  try {
    const { error } = await supabase.storage
      .from(BUCKET)
      .remove([path])

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

/**
 * Сжать изображение перед загрузкой (для витрины, галереи)
 * @param {File} file
 * @param {number} maxWidth — максимальная ширина (default 1200)
 * @param {number} quality — качество JPEG 0-1 (default 0.8)
 * @returns {Promise<File>}
 */
export function compressImage(file, maxWidth = 1200, quality = 0.8) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(file) // Видео не сжимаем
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        // Если уже меньше — не сжимаем
        if (img.width <= maxWidth) {
          resolve(file)
          return
        }

        const canvas = document.createElement('canvas')
        const ratio = maxWidth / img.width
        canvas.width = maxWidth
        canvas.height = Math.round(img.height * ratio)

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        canvas.toBlob((blob) => {
          const compressed = new File([blob], file.name, { type: 'image/jpeg' })
          resolve(compressed)
        }, 'image/jpeg', quality)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

/**
 * НОВАЯ (17 апр 2026):
 * Сжать фотографию специально для OG-превью в мессенджерах.
 *
 * Принцип:
 *   - Жёсткий размер 1200×630 (стандарт OG images).
 *   - Center crop (cover): картинка заполняет всю рамку, лишнее по краям
 *     обрезается по центру. Так не остаётся белых полос.
 *   - Качество 0.65 — на глаз почти неотличимо от 0.8, но вес файла
 *     получается в пределах 100-180KB, что WhatsApp мобильный точно примет.
 *
 * @param {File} file — исходное фото любого размера
 * @returns {Promise<File>} — сжатая картинка 1200×630 JPEG
 */
export function compressPreview(file) {
  const TARGET_W = 1200
  const TARGET_H = 630
  const QUALITY = 0.65

  return new Promise((resolve) => {
    if (!file || !file.type?.startsWith('image/')) {
      resolve(file)
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = TARGET_W
        canvas.height = TARGET_H
        const ctx = canvas.getContext('2d')

        // Center crop (cover) — заполняем всю рамку, лишнее обрезаем
        const sRatio = img.width / img.height
        const tRatio = TARGET_W / TARGET_H

        let sx, sy, sw, sh
        if (sRatio > tRatio) {
          // Source шире целевой — режем по бокам
          sh = img.height
          sw = img.height * tRatio
          sx = (img.width - sw) / 2
          sy = 0
        } else {
          // Source выше целевой — режем сверху и снизу
          sw = img.width
          sh = img.width / tRatio
          sx = 0
          sy = (img.height - sh) / 2
        }

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, TARGET_W, TARGET_H)

        canvas.toBlob((blob) => {
          const name = 'preview-' + (file.name || 'image.jpg').replace(/\.[^.]+$/, '.jpg')
          const preview = new File([blob], name, { type: 'image/jpeg' })
          resolve(preview)
        }, 'image/jpeg', QUALITY)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}
