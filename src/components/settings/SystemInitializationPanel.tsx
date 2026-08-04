"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldAlert, AlertTriangle } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { previewSystemInitialization, initializeSystem, type InitializeResult } from "@/lib/actions/systemInit"
import { INITIALIZATION_MODULES, MODULE_INFO, type InitializationModule, type InitializationPlan } from "@/lib/systemInit"

const CONFIRMATION_TEXT = "INITIALIZE"

interface SystemInitializationPanelProps {
  isProduction: boolean
}

type Step = "select" | "preview" | "result"

export function SystemInitializationPanel({ isProduction }: SystemInitializationPanelProps) {
  const router = useRouter()
  const toast = useToast()
  const { t, language } = useLanguage()

  const [modalOpen, setModalOpen] = useState(false)
  const [step, setStep] = useState<Step>("select")
  const [selected, setSelected] = useState<Set<InitializationModule>>(new Set())
  const [resetNumbering, setResetNumbering] = useState(false)

  const [plan, setPlan] = useState<InitializationPlan | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState(false)

  const [confirmText, setConfirmText] = useState("")
  const [productionAck, setProductionAck] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<InitializeResult | null>(null)

  function openModal() {
    setStep("select")
    setSelected(new Set())
    setResetNumbering(false)
    setPlan(null)
    setPreviewError(false)
    setConfirmText("")
    setProductionAck(false)
    setResult(null)
    setModalOpen(true)
  }

  function closeModal() {
    if (executing) return
    setModalOpen(false)
  }

  function toggleModule(m: InitializationModule) {
    const next = new Set(selected)
    if (next.has(m)) next.delete(m)
    else next.add(m)
    setSelected(next)
  }

  const allSelected = INITIALIZATION_MODULES.every((m) => selected.has(m))
  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(INITIALIZATION_MODULES))
  }

  async function goToPreview() {
    if (selected.size === 0) return
    setStep("preview")
    setPreviewLoading(true)
    setPreviewError(false)
    setPlan(null)
    try {
      const res = await previewSystemInitialization(Array.from(selected), resetNumbering)
      if ("error" in res) {
        setPreviewError(true)
        toast.error(res.error)
        return
      }
      setPlan(res.plan)
    } catch {
      setPreviewError(true)
    } finally {
      setPreviewLoading(false)
    }
  }

  const canConfirm = confirmText === CONFIRMATION_TEXT && (!isProduction || productionAck) && !!plan

  async function handleInitialize() {
    if (!canConfirm) return
    setExecuting(true)
    try {
      const res = await initializeSystem(Array.from(selected), resetNumbering, confirmText, productionAck)
      if ("error" in res) {
        toast.error(res.error)
        setExecuting(false)
        return
      }
      setResult(res)
      setStep("result")
      router.refresh()
    } catch {
      toast.error(t("systemInitPreviewFailed"))
    } finally {
      setExecuting(false)
    }
  }

  const modalTitle =
    step === "select" ? t("systemInitSelectModulesTitle") : step === "preview" ? t("systemInitPreviewTitle") : t("systemInitCompleted")

  return (
    <div className="rounded-xl border-2 border-red-200 bg-red-50/40 p-5">
      <div className="mb-3 flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-red-600" />
        <h2 className="text-sm font-semibold text-red-800">{t("systemInitializationDangerZone")}</h2>
      </div>
      <p className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-white p-3 text-sm text-red-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        {t("systemInitializationDangerZoneWarning")}
      </p>
      <Button variant="destructive" icon={<ShieldAlert className="h-4 w-4" />} onClick={openModal}>
        {t("systemInitializationButton")}
      </Button>

      <Modal isOpen={modalOpen} onClose={closeModal} title={modalTitle} size="lg">
        {step === "select" && (
          <div className="space-y-4">
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-800">
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="h-4 w-4 rounded border-slate-300" />
              {t("systemInitSelectAll")}
            </label>

            <div className="space-y-2">
              {INITIALIZATION_MODULES.map((m) => {
                const info = MODULE_INFO[m]
                return (
                  <label key={m} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selected.has(m)}
                      onChange={() => toggleModule(m)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
                    />
                    <span>
                      <span className="block font-medium text-slate-900">{language === "zh" ? info.labelZh : info.labelEn}</span>
                      <span className="block text-xs text-slate-500">{language === "zh" ? info.descriptionZh : info.descriptionEn}</span>
                    </span>
                  </label>
                )
              })}
            </div>

            <label className="flex items-start gap-2 border-t border-slate-100 pt-4 text-sm">
              <input
                type="checkbox"
                checked={resetNumbering}
                onChange={(e) => setResetNumbering(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                <span className="block font-medium text-slate-800">{t("systemInitResetNumbering")}</span>
                <span className="block text-xs text-slate-500">{t("systemInitResetNumberingHint")}</span>
              </span>
            </label>

            {selected.size === 0 && <p className="text-xs text-amber-700">{t("systemInitNoModuleSelected")}</p>}

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <Button variant="outline" onClick={closeModal}>
                {t("cancel")}
              </Button>
              <Button variant="destructive" disabled={selected.size === 0} onClick={goToPreview}>
                {t("systemInitContinue")}
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            {previewLoading && <p className="text-sm text-slate-500">{t("systemInitPreviewLoading")}</p>}
            {previewError && <p className="text-sm text-red-600">{t("systemInitPreviewFailed")}</p>}

            {plan && (
              <>
                {isProduction && (
                  <p className="rounded-lg border-2 border-red-300 bg-red-100 px-3 py-2 text-center text-sm font-bold text-red-800">
                    {t("systemInitProductionBanner")}
                  </p>
                )}

                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("systemInitSelectedModules")}</h4>
                  <p className="text-sm text-slate-700">
                    {plan.selectedModules.map((m) => (language === "zh" ? MODULE_INFO[m].labelZh : MODULE_INFO[m].labelEn)).join(", ")}
                  </p>
                </div>

                {plan.requiredModules.length > 0 && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-600">{t("systemInitAutomaticallyRequired")}</h4>
                    <ul className="space-y-1 text-sm text-amber-800">
                      {plan.requiredReasons.map((r) => (
                        <li key={r.module} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                          {language === "zh" ? r.reasonZh : r.reasonEn}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("systemInitEstimatedRecords")}</h4>
                  <dl className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                    {Object.entries(plan.recordCounts).map(([table, count]) => (
                      <div key={table} className="flex items-center justify-between px-3 py-1.5 text-sm">
                        <dt className="text-slate-600">{table}</dt>
                        <dd className="font-medium text-slate-900">
                          {count} {t("systemInitRecordsSuffix")}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>

                {plan.resetNumbering && <p className="text-xs text-slate-500">{plan.numberingNote}</p>}

                <p className="text-sm font-medium text-amber-800">{t("systemInitDropboxNotice")}</p>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  {t("systemInitConfirmationWarning")}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">{t("systemInitTypeToConfirm")}</label>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={CONFIRMATION_TEXT}
                    disabled={executing}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                {isProduction && (
                  <label className="flex items-start gap-2 text-sm text-red-800">
                    <input
                      type="checkbox"
                      checked={productionAck}
                      onChange={(e) => setProductionAck(e.target.checked)}
                      disabled={executing}
                      className="mt-0.5 h-4 w-4 rounded border-red-300"
                    />
                    {t("systemInitProductionAck")}
                  </label>
                )}

                <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                  <Button variant="outline" onClick={() => setStep("select")} disabled={executing}>
                    {t("systemInitBack")}
                  </Button>
                  <Button variant="destructive" loading={executing} disabled={!canConfirm} onClick={handleInitialize}>
                    {executing ? t("systemInitExecuting") : t("systemInitConfirmButton")}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4">
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              {t("systemInitCompleted")}
            </p>

            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("systemInitDeletedLabel")}</h4>
              <dl className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {Object.entries(result.deletedCounts).map(([table, count]) => (
                  <div key={table} className="flex items-center justify-between px-3 py-1.5 text-sm">
                    <dt className="text-slate-600">{table}</dt>
                    <dd className="font-medium text-slate-900">
                      {count} {t("systemInitRecordsSuffix")}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("systemInitPreservedLabel")}</h4>
              <p className="text-sm text-slate-700">{t("systemInitPreservedList")}</p>
            </div>

            <p className="text-sm font-medium text-amber-800">{t("systemInitDropboxNotice")}</p>

            <div className="flex justify-end border-t border-slate-100 pt-4">
              <Button onClick={closeModal}>{t("systemInitClose")}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
