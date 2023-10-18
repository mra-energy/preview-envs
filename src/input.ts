import z from 'zod'
import dotenv from 'dotenv'
import * as core from '@actions/core'

const inputSchema = z.object({
  // fly
  flyAppId: z.string().min(1),
  flyToken: z.string().min(1),
  flyOrgName: z.string().min(1),
  flyRegion: z.string().min(1),
  flyTemplateConfig: z.string().min(1),
  flySecrets: z.object({ key: z.string(), value: z.string() }).array(),
  containerImgUrl: z.string().url(),
  suffix: z.string().optional(),

  // cloudflare
  cloudflareToken: z.string().min(1),
  cloudflareAccountId: z.string().min(1),
  cloudflareProjectName: z.string().min(1),
  cloudflareBuildPath: z.string().min(1),

  // neon
  neonApiToken: z.string().min(1),
  neonProjectId: z.string().min(1),
  neonUser: z.string().min(1),
  neonPassword: z.string().min(1),
  neonDbName: z.string().min(1),
  neonDbConnectionOptions: z.string().startsWith('?').optional(),

  // action
  event: z.union([z.literal('open-todo'), z.literal('close-todo')]),
  refName: z.string().min(1)
})

const secrets = core.getMultilineInput('flySecrets').join('\n')
const secretsObj = dotenv.parse(secrets)

export const input = inputSchema.parse({
  flyAppId: core.getInput('flyAppId'),
  flyToken: core.getInput('flyToken'),
  flyOrgName: core.getInput('flyOrgName'),
  flyRegion: core.getInput('flyRegion'),
  flyTemplateConfig: core.getInput('flyTemplateConfig'),
  flySecrets: Object.entries(secretsObj).map(([key, value]) => ({
    key,
    value
  })),
  containerImgUrl: core.getInput('containerImgUrl'),
  cloudflareToken: core.getInput('cloudflareToken'),
  cloudflareAccountId: core.getInput('cloudflareAccountId'),
  neonApiToken: core.getInput('neonApiToken'),
  event: core.getInput('event'),
  refName: core.getInput('refName')
})
