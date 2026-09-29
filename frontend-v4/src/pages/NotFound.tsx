import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export function NotFound() {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div>
        <div className="text-6xl font-semibold tracking-tight text-muted-foreground">404</div>
        <p className="mt-2 text-sm text-muted-foreground">That page isn&apos;t part of the console.</p>
        <Button asChild className="mt-6">
          <Link to="/">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
