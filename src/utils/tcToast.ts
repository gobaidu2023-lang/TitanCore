// src/utils/tcToast.ts - TC unified toast, single exit point.
// Thin wrapper over Swal.fire: styled strictly to TC themes
// (Industrial Cyberdeck / Anime / Cyber HUD Minimal)
import Swal from 'sweetalert2'

export type TcToastType = 'success' | 'error' | 'warning' | 'info'

// literal class strings (Tailwind scanner must see them verbatim, do not build dynamically)
const POPUP_CLASS: Record<TcToastType, string> = {
  success: 'border border-[#00f3ff]/30 shadow-[0_0_20px_rgba(0,243,255,0.2)] rounded-lg backdrop-blur-md',
  error:   'border border-[#ff4444]/30 shadow-[0_0_20px_rgba(255,68,68,0.2)] rounded-lg backdrop-blur-md',
  warning: 'border border-[#eab308]/30 shadow-[0_0_20px_rgba(234,179,8,0.2)] rounded-lg backdrop-blur-md',
  info:    'border border-[#38bdf8]/30 shadow-[0_0_20px_rgba(56,189,248,0.2)] rounded-lg backdrop-blur-md',
}

// text color per semantic type (legacy palette: cyan / red / yellow / blue)
const TEXT_COLOR: Record<TcToastType, string> = {
  success: '#00f3ff',
  error:   '#ff4444',
  warning: '#eab308',
  info:    '#38bdf8',
}

const MAX_TOASTS = 3

export function tcToast(title: string, text?: string, type: TcToastType = 'success'): void {
  // stacking cap: evict oldest top-end toast containers beyond MAX_TOASTS
  const boxes = Array.from(document.querySelectorAll('.swal2-container.swal2-top-end'))
  const excess = boxes.length - (MAX_TOASTS - 1)
  for (let i = 0; i < excess; i++) boxes[i].remove()

  const currentTheme = document.documentElement.getAttribute('data-theme')
  const isAnime = currentTheme === 'anime'
  const isMinimal = currentTheme === 'minimal'

  Swal.fire({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: type === 'error' ? 4200 : 2600,
    timerProgressBar: true,
    title,
    text,
    icon: type,
    background: isAnime 
      ? '#ffffff' 
      : (isMinimal ? 'rgba(16, 22, 35, 0.95)' : '#0a0a0f'),
    color: isAnime 
      ? '#1e293b' 
      : (isMinimal ? '#FFFFFF' : TEXT_COLOR[type]),
    customClass: {
      popup: isAnime 
        ? 'border border-pink-200/90 shadow-[0_8px_25px_rgba(244,114,182,0.25)] rounded-2xl backdrop-blur-md' 
        : (isMinimal 
          ? 'border border-[#00f2ff]/35 shadow-[0_0_25px_rgba(0,242,255,0.2)] rounded-xl backdrop-blur-md' 
          : POPUP_CLASS[type])
    }
  })
}

tcToast.success = (title: string, text?: string) => tcToast(title, text, 'success')
tcToast.info = (title: string, text?: string) => tcToast(title, text, 'info')
tcToast.warning = (title: string, text?: string) => tcToast(title, text, 'warning')
tcToast.error = (title: string, text?: string) => tcToast(title, text, 'error')

export default tcToast