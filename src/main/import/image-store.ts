import {
  clipboard,
  dialog,
  nativeImage,
  type BrowserWindow,
  type NativeImage
} from 'electron'
import { randomUUID } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type { ImportImageAttachment } from '../../shared/contracts'

export interface StoredImage {
  name: string
  dataUrl: string
}

export interface ImportImageProvider {
  get(imageId: string): StoredImage
  discard(imageId: string): void
}

const MAX_SOURCE_BYTES = 15 * 1024 * 1024
const MAX_IMAGE_EDGE = 2048

export class ImportImageStore implements ImportImageProvider {
  private readonly images = new Map<string, StoredImage>()

  async chooseFile(
    parent: BrowserWindow | null
  ): Promise<ImportImageAttachment | null> {
    const options: Electron.OpenDialogOptions = {
      title: '选择包含英文内容的图片',
      properties: ['openFile'],
      filters: [
        {
          name: '图片',
          extensions: ['png', 'jpg', 'jpeg', 'webp']
        }
      ]
    }
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const filePath = result.filePaths[0]
    const fileStat = await stat(filePath)
    if (fileStat.size > MAX_SOURCE_BYTES) {
      throw new Error('图片不能超过 15 MB。')
    }

    const image = nativeImage.createFromPath(filePath)
    if (image.isEmpty()) {
      throw new Error('无法读取这张图片。')
    }

    return this.store(image, basename(filePath))
  }

  async readClipboard(): Promise<ImportImageAttachment | null> {
    const items = await clipboard.read()
    let image = nativeImage.createEmpty()

    for (const item of items) {
      const imageType = item.types.find((type) => type.startsWith('image/'))
      if (!imageType) {
        continue
      }
      const blob = await item.getType(imageType)
      if (blob instanceof Blob) {
        image = nativeImage.createFromBuffer(
          Buffer.from(await blob.arrayBuffer())
        )
        break
      }
    }

    if (image.isEmpty()) {
      throw new Error('剪贴板里没有图片。请先使用系统截图工具复制截图。')
    }
    return this.store(image, 'clipboard.png')
  }

  get(imageId: string): StoredImage {
    const image = this.images.get(imageId)
    if (!image) {
      throw new Error('图片已失效，请重新选择或截图。')
    }
    return image
  }

  discard(imageId: string): void {
    this.images.delete(imageId)
  }

  private store(image: NativeImage, name: string): ImportImageAttachment {
    const resized = resizeIfNeeded(image)
    const buffer = resized.toPNG()
    if (buffer.length > 12 * 1024 * 1024) {
      throw new Error('处理后的图片仍然过大，请裁剪后再试。')
    }

    const imageId = randomUUID()
    this.images.set(imageId, {
      name,
      dataUrl: `data:image/png;base64,${buffer.toString('base64')}`
    })

    const previewBuffer = resized.resize({ width: 760 }).toJPEG(76)
    return {
      imageId,
      name,
      previewDataUrl: `data:image/jpeg;base64,${previewBuffer.toString('base64')}`
    }
  }
}

function resizeIfNeeded(image: NativeImage): NativeImage {
  const size = image.getSize()
  if (size.width <= MAX_IMAGE_EDGE && size.height <= MAX_IMAGE_EDGE) {
    return image
  }

  return size.width >= size.height
    ? image.resize({ width: MAX_IMAGE_EDGE })
    : image.resize({ height: MAX_IMAGE_EDGE })
}
