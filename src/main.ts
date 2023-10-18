import * as core from '@actions/core'
import * as gh from '@actions/github'
import { readFileSync } from 'fs'
import * as toml from 'toml'

import { input } from './input'
import { wait } from './wait'
import { fly } from './fly'
import { neon } from './neon'
import { EndpointType, Provisioner } from '@neondatabase/api-client'
import type { CreateAppInput } from './fly/sdk'

export async function run(): Promise<void> {
  const name = `${input.refName}-${gh.context.payload.pull_request?.number}`
  const apiName = `${name}-${input.suffix}`

  switch (input.event) {
    case 'close-todo':
      await destroyFlyApp(apiName)
      await destroyNeonBranch(apiName)
      await destroyCloudflarePage(apiName)
      break

    case 'open-todo':
      const host = await getOrCreateNeonPgBranch(name)
      if (!host) throw new Error('failed to get host for neon branch')

      await createOrUpdateFlyApp(
        apiName,
        `postgresql://${input.neonUser}:${input.neonPassword}@${host}/${neonDbName}`
      )

      await createOrUpdateCloudflarePage(name, `https://${apiName}.fly.dev`)
      break
  }

  const orgRes = await fly.OrgId({ name: input.flyOrgName })
  const orgId = orgRes.data.organization?.id
  if (!orgId) throw new Error('did not find a fly organisation for the name')

  const existingApps = await fly.Apps({ orgId: orgId })
  const appForPullRequest = existingApps.data.apps.nodes?.find(
    it => it?.name === apiName
  )
  if (!appForPullRequest) {
    core.debug(`app '${name}' not found, creating it for ${input.flyRegion}`)
    await fly.CreateApp({ name, orgId, region: input.flyRegion })
  }

  const configContent = readFileSync(input.flyTemplateConfig, 'utf-8')
  const defaultConfig = toml.parse(configContent)
  await fly.DeployImage({
    appId: input.flyAppId,
    img: input.containerImgUrl,
    definition: { app: name, ...defaultConfig }
  })

  const ms = core.getInput('milliseconds')
  // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
  core.debug(`Waiting ${ms} milliseconds ...`)

  // Log the current timestamp, wait, then log the new timestamp
  core.debug(new Date().toTimeString())
  await wait(parseInt(ms, 10))
  core.debug(new Date().toTimeString())

  // Set outputs for other workflow steps to use
  core.setOutput('flyAppName', apiName)
}

async function destroyCloudflarePage(name: string) {
  return fly.CreateApp({})
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
  return fly.DeployImage({})
}

async function getOrCreateNeonPgBranch(
  name: string
): Promise<string | undefined> {
  const branches = await neon.listProjectBranches(input.neonProjectId)
  const branch = branches.data.branches.find(it => it.name === name)

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

    return newBranch.data.endpoints[0]?.host
  } else {
    const endpoints = await neon.listProjectBranchEndpoints(
      input.neonProjectId,
      branch.id
    )

    return endpoints.data.endpoints[0]?.host
  }
}

async function destroyNeonBranch(name: string) {
  const branches = await neon.listProjectBranches(input.neonProjectId)
  const branch = branches.data.branches.find(it => it.name === name)
  if (branch) return neon.deleteProjectBranch(input.neonProjectId, branch.id)
  return
}

async function createOrUpdateCloudflarePage(name: string, apiUrl: string) {
  return fly.CreateApp({})
}
