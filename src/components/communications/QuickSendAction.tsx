import { type ReactNode } from "react"
import { SendMessageButton } from "./SendMessageButton"
import type { TemplateVariables } from "@/lib/communications/templates"
import type { CommunicationMessageType } from "@/types"

interface QuickSendActionProps {
  label: ReactNode
  messageType: CommunicationMessageType
  customerId: string
  jobId?: string
  quotationId?: string
  phone?: string | null
  email?: string | null
  variables: TemplateVariables
}

/**
 * One-click action: shows a label with WhatsApp / Email send buttons that
 * generate the templated message for `messageType` and log the communication.
 */
export function QuickSendAction({
  label,
  messageType,
  customerId,
  jobId,
  quotationId,
  phone,
  email,
  variables,
}: QuickSendActionProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-slate-600">{label}</span>
      <div className="flex gap-2">
        <SendMessageButton
          channel="WHATSAPP"
          messageType={messageType}
          label="WhatsApp"
          customerId={customerId}
          jobId={jobId}
          quotationId={quotationId}
          recipient={phone}
          variables={variables}
        />
        <SendMessageButton
          channel="EMAIL"
          messageType={messageType}
          label="Email"
          customerId={customerId}
          jobId={jobId}
          quotationId={quotationId}
          recipient={email}
          variables={variables}
        />
      </div>
    </div>
  )
}
