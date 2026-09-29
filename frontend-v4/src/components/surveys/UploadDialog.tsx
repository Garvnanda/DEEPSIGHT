import { FileUp, Loader2, UploadCloud } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { ApiError, uploadImages, uploadSurvey } from '@/lib/api'
import { fileSize } from '@/lib/format'
import { cn } from '@/lib/utils'

type Mode = 'xtf' | 'image'

interface Props {
  mode: Mode
  open: boolean
  onOpenChange: (v: boolean) => void
  onDone: (surveyId: string) => void
}

const COPY: Record<Mode, { title: string; desc: string; accept: string; multiple: boolean }> = {
  xtf: {
    title: 'Upload XTF survey',
    desc: 'eXtended Triton Format side-scan sonar. The file is parsed and detection runs automatically.',
    accept: '.xtf,.XTF',
    multiple: false,
  },
  image: {
    title: 'Upload side-scan images',
    desc: 'PNG or JPG tiles are stacked into a pseudo-survey with synthetic navigation. Coordinates are not real.',
    accept: 'image/png,image/jpeg',
    multiple: true,
  },
}

export function UploadDialog({ mode, open, onOpenChange, onDone }: Props) {
  const c = COPY[mode]
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)

  const reset = () => {
    setFiles([])
    setProgress(null)
    setError(null)
    setDrag(false)
  }

  const pick = (list: FileList | null) => {
    if (!list?.length) return
    setError(null)
    setFiles(c.multiple ? Array.from(list) : [list[0]])
  }

  const submit = useCallback(async () => {
    if (!files.length) return
    setProgress(0)
    setError(null)
    try {
      const res =
        mode === 'xtf'
          ? await uploadSurvey(files[0], setProgress)
          : await uploadImages(files, setProgress)
      reset()
      onOpenChange(false)
      onDone(res.survey_id)
    } catch (e) {
      setProgress(null)
      setError(e instanceof ApiError ? e.message : 'Upload failed.')
    }
  }, [files, mode, onDone, onOpenChange])

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{c.title}</DialogTitle>
          <DialogDescription>{c.desc}</DialogDescription>
        </DialogHeader>

        {progress === null ? (
          <>
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDrag(true)
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDrag(false)
                pick(e.dataTransfer.files)
              }}
              className={cn(
                'grid cursor-pointer place-items-center rounded-lg border border-dashed px-6 py-10 text-center transition-colors',
                drag ? 'border-accent bg-accent/10' : 'hover:bg-muted',
              )}
            >
              <UploadCloud className="mb-2 size-7 text-muted-foreground" />
              <p className="text-sm font-medium">
                Drop {c.multiple ? 'files' : 'a file'} here, or click to browse
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{c.accept}</p>
              <input
                ref={inputRef}
                type="file"
                accept={c.accept}
                multiple={c.multiple}
                hidden
                onChange={(e) => pick(e.target.files)}
              />
            </div>

            {files.length > 0 && (
              <ul className="space-y-1 text-sm">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-md bg-muted px-2 py-1.5">
                    <FileUp className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <span className="tnum text-xs text-muted-foreground">{fileSize(f.size)}</span>
                  </li>
                ))}
              </ul>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={!files.length}>
                Upload {files.length > 1 ? `${files.length} files` : ''}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Uploading… {progress}%
            </div>
            <Progress value={progress} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
