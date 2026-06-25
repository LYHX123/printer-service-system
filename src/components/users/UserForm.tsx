"use client"

import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { CreateUserSchema, type CreateUserInput } from "@/lib/schemas"
import { createUser } from "@/lib/actions/users"
import { FormField, Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { ROLE_LABELS } from "@/types"
import { ALL_MODULES } from "@/lib/permissions"
import { PermissionsEditor } from "@/components/users/PermissionsEditor"
import type { Role } from "@/types"

const ROLES: Role[] = ["ADMIN", "MANAGER", "ENGINEER", "RECEPTIONIST"]

export function UserForm() {
  const toast = useToast()
  const { t } = useLanguage()
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(CreateUserSchema) as Resolver<CreateUserInput>,
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "RECEPTIONIST",
      modulePermissions: [...ALL_MODULES],
    },
  })

  const role = useWatch({ control, name: "role", defaultValue: "RECEPTIONIST" }) as Role
  const modulePermissions = useWatch({ control, name: "modulePermissions", defaultValue: [...ALL_MODULES] })

  async function onSubmit(data: CreateUserInput) {
    const result = await createUser(data)
    if (result?.error) {
      toast.error(result.error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label={t("fullName")} htmlFor="name" required error={errors.name?.message}>
            <Input id="name" placeholder="e.g. Jane Doe" {...register("name")} error={errors.name?.message} />
          </FormField>
          <FormField label={t("emailAddress")} htmlFor="email" required error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              placeholder="e.g. user@gmail.com"
              {...register("email")}
              error={errors.email?.message}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label={t("password")} htmlFor="password" required error={errors.password?.message} hint={t("minimum8Characters")}>
            <Input id="password" type="password" placeholder="••••••••" {...register("password")} error={errors.password?.message} />
          </FormField>
          <FormField label={t("role")} htmlFor="role" required error={errors.role?.message}>
            <Select id="role" {...register("role")}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-700 mb-3">
            {t("moduleAccess")} <span className="text-slate-400 font-normal">/ 模块权限</span>
          </p>
          <PermissionsEditor
            permissions={modulePermissions ?? [...ALL_MODULES]}
            userRole={role}
            isSelf={false}
            onChange={(perms) => setValue("modulePermissions", perms)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-4">
        <Button type="button" variant="outline" onClick={() => history.back()}>
          {t("cancel")}
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {t("createUser")}
        </Button>
      </div>
    </form>
  )
}
