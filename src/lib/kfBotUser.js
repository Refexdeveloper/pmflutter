/**
 * Kissflow bot used when the selected assignee is not in the Kissflow directory.
 * Open-step Assigned_To must be a Kissflow User (`_id` + Name + Email + Kind).
 */

import { isKissflowUserId, toKissflowUserType } from './kfUserField.js'
import {
  lookupKissflowUserByEmail,
  lookupKissflowUserByEmailOnLive,
  lookupKissflowUserById,
  lookupKissflowUserByName,
} from './kfUserLookup.js'

function envBot() {
  const _id = String(import.meta.env.VITE_KF_BOT_USER_ID || '').trim()
  const Name = String(import.meta.env.VITE_KF_BOT_USER_NAME || 'PM Bot').trim() || 'PM Bot'
  const Email = String(import.meta.env.VITE_KF_BOT_USER_EMAIL || '').trim()
  return { _id, Name, Email }
}

let memo = undefined

export function configuredPmBotUser() {
  const bot = envBot()
  if (!isKissflowUserId(bot._id)) return null
  return toKissflowUserType({
    _id: bot._id,
    Name: bot.Name,
    Email: bot.Email,
    Kind: 'User',
  })
}

export async function resolvePmBotUser(kfInstance) {
  if (memo !== undefined) return memo
  const configured = configuredPmBotUser()
  if (configured) {
    memo = configured
    return memo
  }

  const { Email, Name } = envBot()
  const tryUser = (row) => {
    const typed = toKissflowUserType(row)
    if (typed) {
      memo = typed
      return typed
    }
    return null
  }

  if (Email) {
    const byEmail =
      (await lookupKissflowUserByEmail(kfInstance, Email, { allowWhenPaused: true, retries: 0 }).catch(() => null)) ||
      (await lookupKissflowUserByEmailOnLive(Email).catch(() => null))
    const hit = tryUser(byEmail)
    if (hit) return hit
  }

  for (const name of [Name, 'support', 'PM Bot', 'ITSM Bot', 'Bot']) {
    const byName = await lookupKissflowUserByName(kfInstance, name, {
      allowWhenPaused: true,
      retries: 0,
    }).catch(() => null)
    const hit = tryUser(byName)
    if (hit) return hit
  }

  memo = null
  return null
}

export async function lookupBotById(kfInstance, id) {
  if (!isKissflowUserId(id)) return null
  const row = await lookupKissflowUserById(kfInstance, id, { allowWhenPaused: true, retries: 0 }).catch(
    () => null,
  )
  return toKissflowUserType(row)
}
