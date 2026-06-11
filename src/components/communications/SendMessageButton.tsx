"use client"

import { useState } from "react"
import { MessageCircle, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { logCommunication } from "@/lib/actions/communications"
import { buildWhatsAppUrl } from "@/lib/communications/phone"
import { buildMailtoUrl } from "@/lib/communications/email"
import { MESSAGE_TEMPLATES, renderTemplate } from "@/lib/communications/templates"
import type { TemplateVariables } from "@/lib/communications/templates"
import type { CommunicationChannel, CommunicationMessageType } from "@/types"

interface SendMessageButtonProps {
  channel: CommunicationChannel
  messageType: CommunicationMessageType
  label: string
  customerId: string
  jobId?: string
  quotationId?: string
  /** Phone number (WhatsApp) or email address (Email). If empty, the button is not rendered. */
  recipient: string | null | undefined
  variables: TemplateVariables
  variant?: "primary" | "secondary" | "outline" | "ghost"
  size?: "sm" | "md" | "lg"
}

export function SendMessageButton({
  channel,
  messageType,
  label,
  customerId,
  jobId,
  quotationId,
  recipient,
  variables,
  variant = "outline",
  size = "sm",
}: SendMessageButtonProps) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  if (!recipient) return null

  async function handleClick() {
    setLoading(true)
    try {
      const template = MESSAGE_TEMPLATES[messageType]
      const body = renderTemplate(template.body, variables)
      const subject = renderTemplate(template.subject, variables)

      const url =
        channel === "WHATSAPP"
          ? buildWhatsAppUrl(recipient as string, body)
          : buildMailtoUrl(recipient as string, subject, body)

      const result = await logCommunication({
        customerId,
        jobId,
        quotationId,
        channel,
        messageType,
        recipient: recipient as string,
        messageContent: body,
      })

      if (result?.error) {
        toast.error(result.error)
        return
      }

      if (channel === "WHATSAPP") {
        window.open(url, "_blank", "noopener,noreferrer")
      } else {
        window.location.href = url
      }
    } finally {
      setLoading(false)
    }
  }

  const Icon = channel === "WHATSAPP" ? MessageCircle : Mail

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      icon={<Icon className="h-3.5 w-3.5" />}
      loading={loading}
      onClick={handleClick}
    >
      {label}
    </Button>
  )
}
