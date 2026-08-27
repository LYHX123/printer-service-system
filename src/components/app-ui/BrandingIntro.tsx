"use client"

import { useEffect, useState } from "react"

const FADE_IN_MS = 280
// Time the logo+slogan stay fully visible *after* the fade-in transition
// completes — not the total intro duration. Total intro ≈ FADE_IN_MS +
// HOLD_MS + FADE_OUT_MS.
const HOLD_MS = 2500
const FADE_OUT_MS = 250

/**
 * App-mode-only branding intro shown once between the native Android splash
 * and the Login page (see LoginPageInner). Never rendered on desktop/mobile
 * browser or PWA — the caller gates this behind `isAppMode`.
 */
export function BrandingIntro({ onFinish }: { onFinish: () => void }) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    const exitTimer = setTimeout(() => setExiting(true), FADE_IN_MS + HOLD_MS)
    const doneTimer = setTimeout(onFinish, FADE_IN_MS + HOLD_MS + FADE_OUT_MS)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(exitTimer)
      clearTimeout(doneTimer)
    }
  }, [onFinish])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-100 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      style={{
        opacity: exiting ? 0 : 1,
        transition: `opacity ${exiting ? FADE_OUT_MS : FADE_IN_MS}ms ease-out`,
      }}
    >
      <div
        className="flex flex-col items-center px-8"
        style={{ transform: "translateY(-6%)" }}
      >
        <img
          src="/branding/enfb-logo-intro.png"
          alt="ENFB"
          width={1624}
          height={1248}
          className="h-auto w-[50vw] max-w-[22rem]"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "scale(1)" : "scale(0.97)",
            transition: `opacity ${FADE_IN_MS}ms ease-out, transform ${FADE_IN_MS}ms ease-out`,
          }}
        />
        <p
          className="mt-6 text-center text-lg font-medium text-slate-700"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "scale(1)" : "scale(0.98)",
            transition: `opacity ${FADE_IN_MS}ms ease-out, transform ${FADE_IN_MS}ms ease-out`,
          }}
        >
          We are one team, we are in one
        </p>
      </div>
    </div>
  )
}
