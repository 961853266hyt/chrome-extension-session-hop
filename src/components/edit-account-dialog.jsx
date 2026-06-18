import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/lib/i18n'
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose,
} from '@/components/ui/dialog'

/**
 * 编辑账号：可改备注名，并以列表形式编辑每个 Cookie 的 value。
 * Cookie 的 key（name）固定为 profile 原有的，不可在此增删或改名。
 */
export function EditAccountDialog({ open, onOpenChange, account, scope, busy, onSubmit }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [values, setValues] = useState([])

  useEffect(() => {
    if (open && account) {
      setName(account.name)
      setValues(account.cookies.map((c) => c.value))
    }
  }, [open, account])

  if (!account) return null

  const submit = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const cookies = account.cookies.map((c, i) => ({ ...c, value: values[i] }))
    onSubmit(trimmed, cookies)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t('dialog.editAccountTitle')}</DialogTitle>
            <DialogDescription className="font-mono text-xs">{scope}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="edit-account-name">{t('dialog.nameLabel')}</Label>
            <Input
              id="edit-account-name"
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-xs text-muted-foreground">
              Cookie（{account.cookies.length}）
            </Label>
            {account.cookies.length === 0 ? (
              <p className="rounded-xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
                {t('dialog.noSavedCookie')}
              </p>
            ) : (
              <div className="-mr-1 max-h-[50vh] space-y-3 overflow-y-auto pr-1">
                {account.cookies.map((c, i) => (
                  <div key={`${c.name}-${i}`} className="grid gap-1.5">
                    <Label
                      className="truncate font-mono text-[11px] text-muted-foreground"
                      title={c.name}
                    >
                      {c.name}
                    </Label>
                    <Input
                      className="h-8 font-mono text-xs"
                      value={values[i] ?? ''}
                      onChange={(e) =>
                        setValues((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">{t('common.cancel')}</Button>
            </DialogClose>
            <Button type="submit" disabled={busy || !name.trim()}>{t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
