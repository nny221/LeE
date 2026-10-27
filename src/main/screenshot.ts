import { dialog, shell } from 'electron'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readClipboardNativeImage } from './import/image-store'
import type { ImportImageStore } from './import/image-store'
import type { WindowManager } from './windows/window-manager'

export const SCREENSHOT_SHORTCUT = 'CommandOrControl+Alt+L'

const CLIPBOARD_POLL_INTERVAL_MS = 300
const CLIPBOARD_WAIT_TIMEOUT_MS = 60_000

interface ScreenshotCommand {
  command: string
  args: string[]
}

export function createScreenshotHandler(
  imageStore: ImportImageStore,
  windowManager: WindowManager
): () => void {
  let captureVersion = 0

  return (): void => {
    const version = ++captureVersion
    void captureScreenshot(
      imageStore,
      windowManager,
      () => version === captureVersion
    )
  }
}

async function captureScreenshot(
  imageStore: ImportImageStore,
  windowManager: WindowManager,
  isCurrent: () => boolean
): Promise<void> {
  try {
    const previousImage = await clipboardImageFingerprint()
    if (!isCurrent()) {
      return
    }

    await launchScreenshotTool()
    const captured = await waitForNewClipboardImage(previousImage, isCurrent)
    if (!captured || !isCurrent()) {
      return
    }

    const attachment = await imageStore.readClipboard()
    if (attachment && isCurrent()) {
      await windowManager.openImportWithImage(attachment)
    }
  } catch (error: unknown) {
    if (!isCurrent()) {
      return
    }

    const message =
      error instanceof Error ? error.message : '系统截屏工具启动失败。'
    dialog.showErrorBox('无法唤起截屏', message)
  }
}

async function launchScreenshotTool(): Promise<void> {
  if (process.platform === 'win32') {
    await shell.openExternal('ms-screenclip:')
    return
  }

  const screenshotCommand = resolveScreenshotCommand()
  if (!screenshotCommand) {
    throw new Error('当前系统没有找到可用的截屏工具。')
  }

  await spawnDetached(screenshotCommand.command, screenshotCommand.args)
}

function resolveScreenshotCommand(): ScreenshotCommand | null {
  if (process.platform === 'darwin') {
    return {
      command: '/usr/sbin/screencapture',
      args: ['-i', '-c']
    }
  }

  if (process.platform !== 'linux') {
    return null
  }

  const desktop = (process.env.XDG_CURRENT_DESKTOP ?? '').toLowerCase()
  if (
    (desktop.includes('dde') || desktop.includes('deepin')) &&
    existsSync('/usr/bin/dbus-send')
  ) {
    return {
      command: '/usr/bin/dbus-send',
      args: [
        '--print-reply',
        '--dest=com.deepin.Screenshot',
        '/com/deepin/Screenshot',
        'com.deepin.Screenshot.StartScreenshot'
      ]
    }
  }

  const candidates: ScreenshotCommand[] = [
    {
      command: '/usr/bin/gnome-screenshot',
      args: ['-a', '-c']
    },
    {
      command: '/usr/bin/spectacle',
      args: ['-r', '-b', '-c']
    },
    {
      command: '/usr/bin/flameshot',
      args: ['gui', '--clipboard']
    }
  ]

  return candidates.find(({ command }) => existsSync(command)) ?? null
}

function spawnDetached(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore'
    })

    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

async function waitForNewClipboardImage(
  previousFingerprint: string | null,
  isCurrent: () => boolean
): Promise<boolean> {
  const deadline = Date.now() + CLIPBOARD_WAIT_TIMEOUT_MS

  while (Date.now() < deadline) {
    if (!isCurrent()) {
      return false
    }

    await delay(CLIPBOARD_POLL_INTERVAL_MS)
    const fingerprint = await clipboardImageFingerprint()
    if (fingerprint && fingerprint !== previousFingerprint) {
      return true
    }
  }

  return false
}

async function clipboardImageFingerprint(): Promise<string | null> {
  const image = await readClipboardNativeImage()
  if (image.isEmpty()) {
    return null
  }

  return createHash('sha1').update(image.toPNG()).digest('hex')
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
