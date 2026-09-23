import { useRef, useState } from 'react'
import { Crop, ImagePlus, Loader2, Trash2, Upload } from 'lucide-react'
import { authStore } from '@/store/auth'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/shared/Toast'
import { logoErrorMessage, removeCompanyLogo, uploadCompanyLogo, useCompanyLogo } from '@/lib/companyLogo'
import LogoEditorDialog from './LogoEditorDialog'

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] // what the API accepts
const MAX_SOURCE_BYTES = 15 * 1024 * 1024 // the editor shrinks it; only the edited PNG is uploaded (API limit 8 MB)

// The company logo slot on the home screen. An Admin clicks it to browse for a
// picture, tidies it up in the editor, and Apply — from then on the logo is on
// every print document, the header/sidebar and the scheduled-report PDFs (see
// lib/companyLogo.ts). Everyone else just sees the logo, if there is one.
export default function CompanyLogoSlot() {
  const user = authStore.getUser()
  const companyId = user?.company?.id
  const canEdit = user?.role === 'ADMIN' // the API enforces the same rule
  const { url, status } = useCompanyLogo(companyId)
  const { toast } = useToast()

  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  if (!companyId) return null
  // Read-only viewers with no logo get nothing — an empty box would just look broken.
  if (!canEdit) {
    return status === 'ready' && url ? (
      <div className="flex h-[104px] w-[200px] items-center justify-center rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <img src={url} alt="Company logo" className="max-h-full max-w-full object-contain" />
      </div>
    ) : null
  }

  const accept = (f: File | undefined) => {
    if (!f) return
    if (!ACCEPTED_TYPES.includes(f.type)) return toast({ title: 'That file type isn’t supported', description: 'Please use a PNG, JPG or WEBP image.', variant: 'error' })
    if (f.size > MAX_SOURCE_BYTES) return toast({ title: 'That image is too large', description: 'Please choose one under 15 MB.', variant: 'error' })
    setFile(f)
  }

  const browse = () => inputRef.current?.click()

  // Re-open the logo that's already saved in the editor.
  const editCurrent = async () => {
    if (!url) return
    setBusy(true)
    try {
      const blob = await (await fetch(url)).blob()
      setFile(new File([blob], 'company-logo.png', { type: blob.type || 'image/png' }))
    } catch {
      toast({ title: 'Couldn’t open the current logo', description: 'Please try again, or upload the file again.', variant: 'error' })
    } finally { setBusy(false) }
  }

  const remove = async () => {
    if (!window.confirm('Remove the company logo? Your documents will go back to the default CretOS mark.')) return
    setBusy(true)
    try {
      await removeCompanyLogo(companyId)
      toast({ title: 'Logo removed', variant: 'success' })
    } catch (e) {
      toast({ title: 'Couldn’t remove the logo', description: logoErrorMessage(e), variant: 'error' })
    } finally { setBusy(false) }
  }

  const apply = async (png: Blob) => {
    try {
      await uploadCompanyLogo(companyId, png)
    } catch (e) {
      throw new Error(logoErrorMessage(e)) // shown inside the editor, which stays open
    }
    setFile(null)
    toast({ title: 'Logo updated', description: 'It will now appear on your challans, invoices, quotations, reports and other documents.', variant: 'success' })
  }

  const iconButton = 'flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 text-gray-700 shadow-sm transition-colors hover:bg-white hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

  return (
    <div className="flex flex-col items-center">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={e => { accept(e.target.files?.[0]); e.target.value = '' }}
      />

      <div className="group relative h-[104px] w-[200px]">
        {status === 'loading' && <div className="h-full w-full animate-pulse rounded-xl bg-gray-200 dark:bg-slate-800" />}

        {status === 'none' && (
          <button
            type="button"
            onClick={browse}
            aria-label="Upload company logo"
            className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 bg-white/60 px-3 text-center text-slate-500 outline-none transition-colors duration-200 ease-out hover:border-accent/60 hover:text-accent focus-visible:ring-2 focus-visible:ring-accent dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400"
          >
            <ImagePlus size={24} strokeWidth={1.75} />
            <span className="text-sm font-semibold">Company logo</span>
            <span className="text-[11px] leading-tight opacity-80">Click to upload an image</span>
          </button>
        )}

        {status === 'ready' && url && (
          <>
            {/* White card even in dark mode — logos are usually drawn for a light background. */}
            <div className="flex h-full w-full items-center justify-center rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition-colors duration-200 ease-out dark:border-slate-700">
              <img src={url} alt="Company logo" className="max-h-full max-w-full object-contain" />
            </div>
            <div
              className={cn(
                'absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-slate-900/60 transition-opacity duration-200 ease-out',
                busy ? 'opacity-100' : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
              )}
            >
              {busy ? <Loader2 size={20} className="animate-spin text-white" /> : (
                <>
                  <button type="button" onClick={editCurrent} className={iconButton} aria-label="Edit logo" title="Edit logo"><Crop size={15} /></button>
                  <button type="button" onClick={browse} className={iconButton} aria-label="Replace logo" title="Replace logo"><Upload size={15} /></button>
                  <button type="button" onClick={remove} className={cn(iconButton, 'hover:text-red-600')} aria-label="Remove logo" title="Remove logo"><Trash2 size={15} /></button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {status === 'ready' && <p className="mt-1.5 text-center text-[11px] text-slate-400">Shown on all your documents</p>}

      {file && <LogoEditorDialog file={file} onClose={() => setFile(null)} onApply={apply} />}
    </div>
  )
}
