/**
 * 域名判断的唯一来源（三域，见 docs/设计规范.md §7.1）。
 *
 * 公众域：裸域（localhost / www.mulan.org），不配置。
 * 工作台域：`WORKSPACE_HOST`（本地 connect.localhost）。
 * CMS 域：`CMS_HOST`（本地 admin.localhost）。
 */

const DEFAULT_WORKSPACE_HOSTS = ['connect.localhost', 'connect.mulan.org']
const DEFAULT_CMS_HOSTS = ['admin.localhost', 'admin.mulan.org']

const hostList = (value: string): string[] =>
  value
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)

/** 工作台域 */
export const workspaceHosts = (): string[] => {
  const configured = hostList(process.env.WORKSPACE_HOST ?? '')
  return configured.length ? configured : DEFAULT_WORKSPACE_HOSTS
}

/** CMS 域 */
export const cmsHosts = (): string[] => {
  const configured = hostList(process.env.CMS_HOST ?? '')
  return configured.length ? configured : DEFAULT_CMS_HOSTS
}

/** 从 Host 头里取出主机名（去端口） */
export const hostnameOf = (host: string | null | undefined): string =>
  (host ?? '').split(':')[0].trim().toLowerCase()

export const isWorkspaceHost = (host: string | null | undefined): boolean =>
  workspaceHosts().includes(hostnameOf(host))

export const isCmsHost = (host: string | null | undefined): boolean =>
  cmsHosts().includes(hostnameOf(host))
