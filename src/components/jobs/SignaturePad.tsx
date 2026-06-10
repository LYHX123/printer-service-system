"use client"

import { useRef, useState } from "react"
import SignatureCanvas from "react-signature-canvas"
import { Eraser, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SignaturePadProps {
  onSave: (dataUrl: string) => Promise<void> | void
  saving?: boolean
}

export function SignaturePad({ onSave, saving }: SignaturePadProps) {
  const padRef = useRef<SignatureCanvas>(null)
  const [empty, setEmpty] = useState(true)

  function handleClear() {
    padRef.current?.clear()
    setEmpty(true)
  }

  function handleUndo() {
    const pad = padRef.current
    if (!pad) return
    const data = pad.toData()
    if (!data || data.length === 0) return
    data.pop()
    pad.fromData(data)
    setEmpty(data.length === 0)
  }

  async function handleSave() {
    if (!padRef.current || padRef.current.isEmpty()) return
    const dataUrl = padRef.current.getTrimmedCanvas().toDataURL("image/png")
    await onSave(dataUrl)
  }

  return (
    <div>
      <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
        <SignatureCanvas
          ref={padRef}
          penColor="#1e293b"
          canvasProps={{ className: "w-full h-48 rounded-xl" }}
          onEnd={() => setEmpty(false)}
        />
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="button" variant="outline" size="sm" icon={<Undo2 className="h-3.5 w-3.5" />} onClick={handleUndo} disabled={saving || empty}>
          Undo
        </Button>
        <Button type="button" variant="outline" size="sm" icon={<Eraser className="h-3.5 w-3.5" />} onClick={handleClear} disabled={saving}>
          Clear
        </Button>
        <Button type="button" size="sm" onClick={handleSave} loading={saving} disabled={empty}>
          Save Signature
        </Button>
      </div>
    </div>
  )
}
