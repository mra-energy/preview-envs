import * as core from '@actions/core'
import * as gh from '@actions/github'
import { readFileSync } from 'fs'
import * as toml from 'toml'

import { EndpointType, Provisioner } from '@neondatabase/api-client'
import { fly } from './fly'
import * as cloudflare from './cloudflare'
import { input } from './input'
import { neon } from './neon'

export async function run(): Promise<void> {
  const name = `${input.refName}-${gh.context.payload.pull_request?.number}`
  const apiName = `${name}-${input.suffix}`

  switch (input.event) {
    case 'open-todo':
      core.debug(`${new Date().toISOString()} neon get or create branch`)
      const dbUrl = await getOrCreateNeonPgBranch(name)

      core.debug(`${new Date().toISOString()} fly deploy app`)
      await createOrUpdateFlyApp(apiName, dbUrl)

      core.debug(`${new Date().toISOString()} cloudflare deploy page`)
      await createOrUpdateCloudflarePage(name, `https://${apiName}.fly.dev`)
      break

    case 'close-todo':
      core.debug(`${new Date().toISOString()} destroying cloudflare asset`)
      await destroyCloudflarePage(apiName)

      core.debug(`${new Date().toISOString()} destroying fly app`)
      await destroyFlyApp(apiName)

      core.debug(`${new Date().toISOString()} destroying neon branch`)
      await destroyNeonBranch(apiName)
      break
  }

  core.setOutput('flyAppName', apiName)
}

async function createOrUpdateFlyApp(apiName: string, dbUrl: string) {
  const org = await fly.GetOrganizationByName({ name: input.flyOrgName })
  if (!org.data.organization)
    throw new Error('no known organisation for this name')

  const apps = await fly.ListAppsForOrganization({
    orgId: org.data.organization.id
  })
  const app = apps.data.apps.nodes?.find(it => it?.name === apiName)
  if (!app)
    await fly
      .CreateApp({
        input: {
          organizationId: org.data.organization.id,
          name: apiName,
          preferredRegion: input.flyRegion
        }
      })
      .then(res => res.data.createApp?.app)

  const configContent = readFileSync(input.flyTemplateConfig, 'utf-8')
  const defaultConfig = toml.parse(configContent)
  await fly.SetSecrets({
    appId: apiName,
    secrets: [{ key: 'DATABASE_URL', value: dbUrl }, ...input.flySecrets]
  })
  await fly.DeployImage({
    appId: apiName,
    img: input.containerImgUrl,
    definition: { app: apiName, ...defaultConfig }
  })

  return app
}

async function destroyFlyApp(name: string) {
  return fly.DeleteApp({ appID: name })
}

async function getOrCreateNeonPgBranch(name: string) {
  const branches = await neon.listProjectBranches(input.neonProjectId)
  const branch = branches.data.branches.find(it => it.name === name)

  let host
  if (!branch) {
    const newBranch = await neon.createProjectBranch(input.neonProjectId, {
      branch: { name },
      endpoints: [
        {
          type: EndpointType.ReadWrite,
          autoscaling_limit_min_cu: 0,
          provisioner: Provisioner.K8SNeonvm
        }
      ]
    })

    host = newBranch.data.endpoints[0]?.host
  } else {
    const endpoints = await neon.listProjectBranchEndpoints(
      input.neonProjectId,
      branch.id
    )

    host = endpoints.data.endpoints[0]?.host
  }

  if (!host)
    throw new Error('could not find or create an endpoint for the neon branch')

  return `postgresql://${input.neonUser}:${input.neonPassword}@${host}/${input.neonDbName}${input.neonDbConnectionOptions}`
}

async function destroyNeonBranch(name: string) {
  const branches = await neon.listProjectBranches(input.neonProjectId)
  const branch = branches.data.branches.find(it => it.name === name)
  if (branch) return neon.deleteProjectBranch(input.neonProjectId, branch.id)
  return
}

async function createOrUpdateCloudflarePage(name: string, apiUrl: string) {
  return cloudflare.createOrUpdatePage(name, input.cloudflareProjectName, input.cloudflareBuildPath, apiUrl)
}

async function destroyCloudflarePage(name: string) {
  return
}
