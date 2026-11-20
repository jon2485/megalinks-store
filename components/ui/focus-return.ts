"use client"

import * as React from "react"

// Radix dialogs put focus back on their Trigger when they close. Most dialogs here are opened from state (a button that
// calls setModal), so there is no Trigger and focus fell to the start of the page (WCAG 2.4.3, accessibility audit
// 20.11.2026). Remember what had focus when the dialog opened and return focus there; if that element is gone (for example
// a menu item), fall back to the start of the main content instead of the top of the page.
export function useFocusReturn(
  onOpenAutoFocus?: (event: Event) => void,
  onCloseAutoFocus?: (event: Event) => void
) {
  const opener = React.useRef<HTMLElement | null>(null)
  return {
    onOpenAutoFocus: (event: Event) => {
      const active = document.activeElement
      opener.current = active instanceof HTMLElement && active !== document.body ? active : null
      onOpenAutoFocus?.(event)
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event)
      if (event.defaultPrevented) return
      const target = opener.current?.isConnected ? opener.current : document.getElementById("main-content")
      if (!target) return
      event.preventDefault()
      target.focus({ preventScroll: false })
    },
  }
}
