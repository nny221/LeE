import { Menu, nativeImage, Tray } from 'electron'
import { SCREENSHOT_SHORTCUT } from './screenshot'
import type { WindowManager } from './windows/window-manager'

function createTrayIcon(): Electron.NativeImage {
  const size = 32
  const pixels = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - 16
      const dy = y - 17
      const inFace = dx * dx + dy * dy <= 13 * 13
      const inEye = (x - 11) ** 2 + (y - 14) ** 2 <= 2 ** 2 || (x - 21) ** 2 + (y - 14) ** 2 <= 2 ** 2
      const inSmile =
        y >= 21 &&
        y <= 24 &&
        Math.abs(x - 16) <= 5 &&
        Math.abs((x - 16) ** 2 / 4 - (y - 21)) < 1.2

      if (!inFace) {
        continue
      }

      const index = (y * size + x) * 4
      const isDark = inEye || inSmile
      pixels[index] = isDark ? 44 : 74
      pixels[index + 1] = isDark ? 39 : 156
      pixels[index + 2] = isDark ? 35 : 238
      pixels[index + 3] = 255
    }
  }

  return nativeImage.createFromBitmap(pixels, {
    width: size,
    height: size,
    scaleFactor: 1
  })
}

export function createApplicationTray(
  windowManager: WindowManager,
  onScreenshot: () => void
): Tray {
  const tray = new Tray(createTrayIcon())
  tray.setToolTip('LeE · 英语生词桌宠')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '开始复习',
        accelerator: 'CmdOrCtrl+Shift+E',
        click: () => {
          void windowManager.openReview()
        }
      },
      {
        label: '添加单词',
        click: () => {
          void windowManager.openEditor()
        }
      },
      {
        label: '从文字或截图导入',
        click: () => {
          void windowManager.openImport()
        }
      },
      {
        label: '截图并导入',
        accelerator: SCREENSHOT_SHORTCUT,
        click: () => onScreenshot()
      },
      { type: 'separator' },
      {
        label: '显示桌宠',
        click: () => windowManager.showPet()
      },
      { type: 'separator' },
      {
        label: '退出 LeE',
        role: 'quit'
      }
    ])
  )

  tray.on('click', () => windowManager.showPet())
  return tray
}
