import { redirect } from "next/navigation"

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/customers/${id}/edit`)
}
