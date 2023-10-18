import { execSync } from 'child_process'
import { input } from '../input'


export function createOrUpdatePage(
  name: string,
  projectName: string,
  path: string,
  apiUrl: string
) {
  execSync(`PUBLIC_ECAIR_API_URL=${apiUrl} ${input.cloudflareBuildPath}`)
  return execSync(
    `wrangler pages deploy ${path} --project-name ${projectName} --branch ${name}`
  )
}

class HttpError extends Error {
  response?: Response
}

function jsonOrThrowIfNotOk(response: Response) {
  if (!response.ok) {
    let err = new HttpError('HTTP status code: ' + response.status)
    err.response = response
    throw err
  } else {
    return response.json()
  }
}

function listDeployments(accountId: string, project: string, page: string) {
  const params = page && new URLSearchParams({ page: String(page) })
  const url =
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${project}/deployments` +
    (params ? `?${params}` : '')

  console.log(`fetching ${url}`)
  return fetch(url, {
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` }
  }).then(jsonOrThrowIfNotOk)
}

function deleteDeployment(accountId: string, project: string, deploymentId: string) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${project}/deployments/${deploymentId}?force=true`

  console.log(`deleting ${url}`)
  return fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${input.cloudflareApiToken}` }
  }).then(r => {
    if (![200, 404].includes(r.status)) {
      r.text().then(t => {
        throw new Error(`${r.status} ${t}`)
      })
    }
    console.log(`deleting ${url}: ${r.status}`)
  })
}

async function allDeployments(accountId, project) {
  const init = await listDeployments(accountId, project, 0)
  const total_page = init?.result_info?.total_pages
  if (!total_page)
    throw new Error(`unexpected response format, ${init.result_info}`)

  const deployments = Array.from(init.result)
  for (let i = 1; i < total_page; i++) {
    const depls = await listDeployments(accountId, project, i)
    deployments.push(...depls.result)
  }

  return deployments
}

async function main() {
  const branchName = process.argv[2]
  if (!branchName) throw new Error('call as node filepath.js {branchName}')
  console.log(`will destroy all deployments attached to ${branchName}`)

  const depls = await allDeployments(process.env.CLOUDFLARE_ACCOUNT_ID, 'ecair')

  console.log(`collected ${depls.length} deployments`)

  const branchDepls = depls.filter(
    it =>
      it.deployment_trigger?.metadata?.branch === branchName &&
      it.environment === 'preview'
  )

  console.log(
    `will delete ${branchDepls.length} deployments from branch "${branchName}"`
  )
  for (const depl of branchDepls) {
    await deleteDeployment(process.env.CLOUDFLARE_ACCOUNT_ID, 'ecair', depl.id)
  }

  const expirationDays = 15
  const isTooOld = s => (Date.now() - new Date(s)) / 86_400_000 > expirationDays
  const weekOldDepls = depls.filter(
    it => isTooOld(it.created_on) && it.environment === 'preview'
  )
  console.log(
    `will delete ${weekOldDepls.length} deployments because they're ${expirationDays} days old`
  )
  for (const depl of weekOldDepls) {
    await deleteDeployment(process.env.CLOUDFLARE_ACCOUNT_ID, 'ecair', depl.id)
  }
}
