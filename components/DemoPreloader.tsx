"use client"

import { useEffect } from "react"
import { preWarmDemo } from "@/lib/api"

const STORAGE_KEY = "vitalytics_prewarm"
const MAX_AGE_MS = 8 * 60 * 1000

export default function DemoPreloader() {
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Date.now() - parsed.timestamp < MAX_AGE_MS) return
      }
    } catch {
      // sessionStorage unavailable — skip
      return
    }

    preWarmDemo().then((result) => {
      if (!result) return
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            sessionId: result.sessionId,
            metadata: result.metadata,
            timestamp: Date.now(),
          })
        )
      } catch {}
    })
  }, [])

  return null
}
