import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/lib/i18n'
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose,
} from '@/components/ui/dialog'

/**
 * 手动添加账号：备注名 + 按作用域 Cookie 组逐个填值。
 * Cookie 的 key 固定来自 Cookie 组，不能在此增删或改名。
 * onSubmit(name, pairs)，pairs = [{ name, value }]。
 */
export function AddAccountDialog({ open, onOpenChange, scope, cookieNames, busy, onSubmit }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [values, setValues] = useState({})

  useEffect(() => {
    if (open) {
      setName('')
      setValues({})
    }
  }, [open])

  const noCookieGroup = !cookieNames || cookieNames.length === 0

  const submit = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || noCookieGroup) return
    onSubmit(trimmed, cookieNames.map((n) => ({ name: n, value: values[n] ?? '' })))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t('dialog.addAccountTitle')}</DialogTitle>
            <DialogDescription className="font-mono text-xs">{scope}</DialogDescription>
          </DialogHeader>

          {noCookieGroup ? (
            <p className="rounded-xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
              {t('dialog.noCookieGroup')}
              <br />
              {t('dialog.noCookieGroupSecond')}
            </p>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="add-account-name">{t('dialog.nameLabel')}</Label>
                <Input
                  id="add-account-name"
                  value={name}
                  maxLength={30}
                  autoFocus
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label className="text-xs text-muted-foreground">{t('dialog.cookieValues')}</Label>
                <div className="-mr-1 max-h-[50vh] space-y-3 overflow-y-auto pr-1">
                  {cookieNames.map((n) => (
                    <div key={n} className="grid gap-1.5">
                      <Label className="truncate font-mono text-[11px] text-muted-foreground" title={n}>
                        {n}
                      </Label>
                      <Input
                        className="h-8 font-mono text-xs"
                        value={values[n] ?? ''}
                        onChange={(e) => setValues((prev) => ({ ...prev, [n]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">{t('common.cancel')}</Button>
            </DialogClose>
            <Button type="submit" disabled={busy || noCookieGroup || !name.trim()}>{t('common.add')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
