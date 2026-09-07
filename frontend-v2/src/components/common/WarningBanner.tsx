import { AnimatePresence, motion } from 'framer-motion'
import { TriangleAlert } from 'lucide-react'

export function WarningBanner({ warnings }: { warnings: string[] }) {
  return (
    <AnimatePresence>
      {warnings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="flex gap-2.5 rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <ul className="space-y-0.5">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
