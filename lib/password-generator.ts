const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const formatDob = (dob: string) => {
  const date = new Date(dob)
  if (Number.isNaN(date.getTime())) return ''
  const day = String(date.getDate()).padStart(2, '0')
  const month = MONTHS[date.getMonth()]
  const year = date.getFullYear()
  return `${day}${month}${year}`
}

const digitsOnly = (value: string) => value.replace(/\D/g, '')

export type PasswordMethod = 'last_8_digits' | 'last_6_digits' | 'last_4_dob' | 'dob_last_6'

export const generatePDFPassword = ({
  method,
  cardNumber,
  dob,
}: {
  method?: PasswordMethod
  cardNumber?: string
  dob?: string
}) => {
  if (!method || !cardNumber) return null
  const digits = digitsOnly(cardNumber)
  const dobFormatted = dob ? formatDob(dob) : ''

  switch (method) {
    case 'last_8_digits':
      return digits.slice(-8) || null
    case 'last_6_digits':
      return digits.slice(-6) || null
    case 'last_4_dob':
      return digits.slice(-4) && dobFormatted ? `${digits.slice(-4)}${dobFormatted}` : null
    case 'dob_last_6':
      return digits.slice(-6) && dobFormatted ? `${dobFormatted}${digits.slice(-6)}` : null
    default:
      return null
  }
}
