"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SignaturePad } from "@/components/jobs/SignaturePad"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { saveJobSignature, declineSignature } from "@/lib/actions/jobs"

interface SignatureCaptureProps {
  jobId: string
}

export function SignatureCapture({ jobId }: SignatureCaptureProps) {
  const router = useRouter()
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [declineNote, setDeclineNote] = useState("")
  const [showDecline, setShowDecline] = useState(false)

  async function handleSave(dataUrl: string) {
    setSaving(true)
    try {
      const result = await saveJobSignature(jobId, dataUrl)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success("Signature captured")
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleDecline() {
    if (!declineNote.trim()) {
      toast.error("Please provide a reason for declining")
      return
    }
    setDeclining(true)
    try {
      const result = await declineSignature(jobId, declineNote)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success("Decline recorded")
      setShowDecline(false)
      setDeclineNote("")
      router.refresh()
    } finally {
      setDeclining(false)
    }
  }

  return (
    <div className="space-y-4">
      <SignaturePad onSave={handleSave} saving={saving} />

      <div className="border-t border-slate-100 pt-4">
        {!showDecline ? (
          <button
            type="button"
            onClick={() => setShowDecline(true)}
            className="text-xs text-slate-500 hover:text-slate-700 hover:underline"
          >
            Customer declines to sign
          </button>
        ) : (
          <div className="space-y-2">
            <Textarea
              rows={2}
              placeholder="Reason for declining to sign"
              value={declineNote}
              onChange={(e) => setDeclineNote(e.target.value)}
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" loading={declining} onClick={handleDecline}>
                Record Decline
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowDecline(false)} disabled={declining}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
