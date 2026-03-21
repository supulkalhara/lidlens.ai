import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const ENV_PATH = join(process.cwd(), '.env')

export const updateEnvVar = async (key: string, value: string) => {
  let content = ''
  try {
    content = await readFile(ENV_PATH, 'utf-8')
  } catch {
    content = ''
  }

  const lines = content.split(/\r?\n/)
  const prefix = `${key}=`
  let found = false
  const updated = lines.map((line) => {
    if (line.startsWith(prefix)) {
      found = true
      return `${prefix}${value}`
    }
    return line
  })

  if (!found) {
    updated.push(`${prefix}${value}`)
  }

  await writeFile(ENV_PATH, updated.filter((line, idx, arr) => idx < arr.length - 1 || line !== '').join('\n') + '\n')
}
