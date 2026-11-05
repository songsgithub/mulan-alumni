'use client'

import Image from 'next/image'
import { useRef, useState, useTransition } from 'react'
import { Camera, Pencil } from 'lucide-react'

import { updateCohortProfile } from '@/app/(admin)/(workspace)/actions'
import { ConfirmDialog } from '@/components/console/ConfirmDialog'
import { FormSelect } from '@/components/console/FormSelect'
import { RegionPicker, type RegionValue } from '@/components/console/RegionPicker'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface ProfileTeam {
  viceLeader?: string | null
  resourceLiaison?: string | null
  materials?: string | null
  media?: string | null
}

const TEAM_ROLES: { key: keyof ProfileTeam; label: string }[] = [
  { key: 'viceLeader', label: '副团长' },
  { key: 'resourceLiaison', label: '资源对接员' },
  { key: 'materials', label: '材料整理员' },
  { key: 'media', label: '拍摄宣传员' },
]

const EMPTY_REGION: RegionValue = {
  province: '',
  provinceCode: '',
  city: '',
  cityCode: '',
  district: '',
  districtCode: '',
}

/**
 * 互助团资料的**统一编辑**（2026-11-01 第三十五轮）。
 *
 * 主页图、所在地域、骨干成员原先散在三处、各存各的：
 * 建团时填错地域（只填到省、填错市）是常事，却只能改其中一项，
 * 改起来要来回切。现在合成一个面板、一次提交一起存。
 *
 * 为什么用弹窗而不是就地展开：这三块加起来不短，就地展开会把团详情页撑得很长，
 * 而这张卡下面还有团长信息与活动列表。弹窗里改完就关，页面长度不变。
 *
 * 地域口径与建团一致：**省必填，市 / 区县可以留空**。
 * 换图是可选的——不选文件就不动原图。
 */
export function CohortProfileEditor({
  cohortId,
  name,
  coverUrl,
  location,
  team,
  canEdit,
  status,
  canChangeStatus,
}: {
  cohortId: string
  name: string
  coverUrl?: string | null
  location: Partial<RegionValue>
  team: ProfileTeam
  canEdit: boolean
  /** 团当前状态（运行中 / 解散）；项目组才看得到设置 */
  status?: string
  /** 只有项目组能改状态（团长改不了自己团的状态） */
  canChangeStatus?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [region, setRegion] = useState<RegionValue>({
    province: location.province ?? '',
    provinceCode: location.provinceCode ?? '',
    city: location.city ?? '',
    cityCode: location.cityCode ?? '',
    district: location.district ?? '',
    districtCode: location.districtCode ?? '',
  })
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // 状态：默认跟团当前的状态一致；解散要走二次确认（下面那个确认框）
  const [nextStatus, setNextStatus] = useState(status ?? 'active')
  const [dissolving, setDissolving] = useState(false)
  // 待确认的表单（解散确认通过后再提交）
  const [pendingData, setPendingData] = useState<FormData | null>(null)

  if (!canEdit) return null

  const submit = (formData: FormData) => {
    startTransition(async () => {
      const result = await updateCohortProfile(formData)
      if (result.ok) {
        setMessage({ ok: true, text: result.message ?? '已保存' })
        setOpen(false)
        setPreview(null)
        setPendingData(null)
        if (fileRef.current) fileRef.current.value = ''
      } else {
        setMessage({ ok: false, text: result.message ?? '保存失败' })
      }
    })
  }

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    data.append('cohortId', cohortId)
    data.append('province', region.province)
    data.append('provinceCode', region.provinceCode)
    data.append('city', region.city)
    data.append('cityCode', region.cityCode)
    data.append('district', region.district)
    data.append('districtCode', region.districtCode)

    if (canChangeStatus) {
      data.set('status', nextStatus)
      // 解散要让团长停下工作：先确认，确认过再提交
      if (nextStatus === 'closed' && status !== 'closed') {
        setPendingData(data)
        setDissolving(true)
        return
      }
    }
    submit(data)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setMessage(null)
          setPreview(null)
          if (fileRef.current) fileRef.current.value = ''
        }
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" variant="outline">
            <Pencil aria-hidden className="size-4" />
            编辑资料
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>编辑互助团资料</DialogTitle>
          <DialogDescription>
            主页图、所在地域与骨干成员一起改。建团时填错地域，可以在这里改回来。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6">
          <input type="hidden" name="cohortId" value={cohortId} />

          {/* 主页大图：与公开站团主页 banner 是同一张 */}
          <div className="space-y-2">
            <p className="text-small text-faint">主页大图</p>
            <div className="relative h-40 w-full overflow-hidden rounded-card bg-brand sm:h-44">
              {preview ?? coverUrl ? (
                <Image
                  src={preview ?? (coverUrl as string)}
                  alt={`${name} 主页大图`}
                  fill
                  className="object-cover"
                  sizes="640px"
                  unoptimized={Boolean(preview)}
                />
              ) : null}
              <label className="absolute right-3 bottom-3 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-white/95 px-3 text-label font-medium text-fg shadow-soft transition-colors hover:bg-white">
                <Camera aria-hidden className="size-4" />
                {pending ? '上传中…' : '更换图片'}
                <input
                  ref={fileRef}
                  type="file"
                  name="cover"
                  accept="image/*"
                  className="hidden"
                  disabled={pending}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    // 选完先本地预览，保存失败时用户还能看见自己选了哪张
                    setPreview(file ? URL.createObjectURL(file) : null)
                  }}
                />
              </label>
            </div>
            <p className="text-small text-muted">不选图片就保持原样。</p>
          </div>

          {/* 所在地域：省必填，市 / 区县可留空 */}
          <div className="space-y-2">
            <p className="text-small text-faint">
              所在地域
              <span className="ml-1 text-danger">*</span>
            </p>
            <RegionPicker value={region} onChange={setRegion} partial />
            <p className="text-small text-muted">
              省必填；市、区县可以留空——填到哪一级，这个团就落在哪一级。
            </p>
          </div>

          {/* 骨干成员：只填名字 */}
          <div className="space-y-2">
            <p className="text-small text-faint">骨干成员</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TEAM_ROLES.map((role) => (
                <label key={role.key} className="space-y-1.5">
                  <span className="text-small text-muted">{role.label}</span>
                  <Input
                    name={role.key}
                    defaultValue={team[role.key] ?? ''}
                    maxLength={20}
                    placeholder="姓名"
                    aria-label={role.label}
                    className="w-full"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* 运行状态：只有项目组能改（团长改不了自己团的状态）。
              放在「编辑资料」里，是因为它和主页图、地域、分工一样，都是这个团的资料；
              详情页上只显示状态文字，不摆控件。 */}
          {canChangeStatus ? (
            <div className="space-y-2">
              <p className="text-small text-faint">运行状态</p>
              <FormSelect
                name="status"
                value={nextStatus}
                onValueChange={setNextStatus}
                options={[
                  { value: 'active', label: '运行中' },
                  { value: 'closed', label: '解散' },
                ]}
                className="w-full"
              />
              <p className="text-small text-muted">
                {nextStatus === 'closed'
                  ? '解散后团长不能再发起新的活动；已有的活动与记录都会保留。之后可以随时切回「运行中」。'
                  : '运行中的团，团长可以发起活动，团长与项目组都能在列表里看到它。'}
              </p>
            </div>
          ) : null}

          {message && !message.ok ? (
            <Alert variant="destructive">
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={pending}>
                  取消
                </Button>
              }
            />
            <Button type="submit" disabled={pending}>
              {pending ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* 解散是会让团长停下工作的操作：点「保存」后先问一句，确认过才真存 */}
      <ConfirmDialog
        open={dissolving}
        onOpenChange={(next) => {
          if (!next) {
            setDissolving(false)
            setPendingData(null)
          }
        }}
        tone="danger"
        title="解散这个互助团？"
        description="解散后，团长不能再发起新的活动；已有的活动与记录都会保留。之后可以随时切回「运行中」。"
        confirmLabel="确认解散"
        pending={pending}
        onConfirm={() => {
          if (pendingData) submit(pendingData)
        }}
      />
    </Dialog>
  )
}
