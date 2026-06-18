export function appError(code, params) {
  const error = new Error(code)
  error.code = code
  error.params = params
  return error
}

export function getErrorMessage(error, t) {
  const code = error?.code
  if (code) return t(`error.${code}`, error.params)
  return error?.message ?? t('common.operationFailed')
}
