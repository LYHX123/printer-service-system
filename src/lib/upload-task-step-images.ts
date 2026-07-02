import type { StagedImage } from "@/components/tasks/TaskStepImageStaging"

/** Uploads staged images to an already-created task step. Returns the count that failed. */
export async function uploadStagedTaskStepImages(stepId: string, images: StagedImage[]): Promise<number> {
  let failures = 0
  for (const img of images) {
    const formData = new FormData()
    formData.append("file", img.file)
    const res = await fetch(`/api/tasks/steps/${stepId}/images`, { method: "POST", body: formData })
    if (!res.ok) failures++
  }
  return failures
}
