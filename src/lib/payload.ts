import { getPayload } from 'payload'
import config from '@payload-config'

/** 服务端获取 Payload 实例（App Router 内使用） */
export const getClient = () => getPayload({ config })
