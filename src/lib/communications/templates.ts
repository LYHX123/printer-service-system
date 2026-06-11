import type { CommunicationMessageType } from "@/types"

/** Variables available for substitution in message templates. */
export interface TemplateVariables {
  customer?: string
  jobNumber?: string
  quotationNumber?: string
  equipment?: string
  amount?: string
  companyName?: string
  companyPhone?: string
}

export interface MessageTemplate {
  label: string
  /** Used as the email subject line. */
  subject: string
  /** Body text, shared between WhatsApp and email. */
  body: string
}

export const MESSAGE_TEMPLATES: Record<CommunicationMessageType, MessageTemplate> = {
  JOB_RECEIVED: {
    label: "Job Received",
    subject: "We've received your equipment - {{jobNumber}}",
    body:
      "Hi {{customer}}, this is {{companyName}}. We've received your {{equipment}} " +
      "and logged it under job {{jobNumber}}. We'll update you on the progress shortly. " +
      "Contact us on {{companyPhone}} if you have any questions.",
  },
  JOB_IN_PROGRESS: {
    label: "Job In Progress",
    subject: "Your repair is in progress - {{jobNumber}}",
    body:
      "Hi {{customer}}, an update on job {{jobNumber}}: our technicians are now working on your " +
      "{{equipment}}. We'll notify you as soon as it's ready. - {{companyName}}",
  },
  AWAITING_CUSTOMER_APPROVAL: {
    label: "Awaiting Customer Approval",
    subject: "Approval needed for job {{jobNumber}}",
    body:
      "Hi {{customer}}, job {{jobNumber}} for your {{equipment}} is awaiting your approval before " +
      "we proceed. Please get in touch at {{companyPhone}} to confirm. - {{companyName}}",
  },
  QUOTATION_SENT: {
    label: "Quotation Sent",
    subject: "Quotation {{quotationNumber}} from {{companyName}}",
    body:
      "Hi {{customer}}, please find attached our quotation {{quotationNumber}} for your {{equipment}} " +
      "amounting to {{amount}}. Let us know if you'd like to proceed. - {{companyName}} ({{companyPhone}})",
  },
  QUOTATION_APPROVED: {
    label: "Quotation Approved",
    subject: "Quotation {{quotationNumber}} approved - thank you",
    body:
      "Hi {{customer}}, thank you for approving quotation {{quotationNumber}}. We'll begin work on your " +
      "{{equipment}} shortly and keep you updated. - {{companyName}}",
  },
  JOB_COMPLETED: {
    label: "Job Completed",
    subject: "Job {{jobNumber}} completed",
    body:
      "Hi {{customer}}, good news! Job {{jobNumber}} for your {{equipment}} has been completed. " +
      "Total cost: {{amount}}. - {{companyName}} ({{companyPhone}})",
  },
  READY_FOR_COLLECTION: {
    label: "Ready For Collection",
    subject: "Your {{equipment}} is ready for collection - {{jobNumber}}",
    body:
      "Hi {{customer}}, your {{equipment}} (job {{jobNumber}}) is ready for collection. " +
      "Please visit us at your convenience or contact {{companyPhone}} to arrange delivery. - {{companyName}}",
  },
  PAYMENT_REMINDER: {
    label: "Payment Reminder",
    subject: "Payment reminder - quotation {{quotationNumber}}",
    body:
      "Hi {{customer}}, this is a friendly reminder that payment of {{amount}} for quotation " +
      "{{quotationNumber}} is outstanding. Please contact {{companyPhone}} to arrange settlement. - {{companyName}}",
  },
  GENERAL: {
    label: "General Message",
    subject: "Message from {{companyName}}",
    body: "Hi {{customer}}, this is {{companyName}} ({{companyPhone}}). ",
  },
}

/** Replaces `{{variable}}` placeholders in a template string with the supplied values. */
export function renderTemplate(template: string, variables: TemplateVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = variables[key as keyof TemplateVariables]
    return value ?? match
  })
}
