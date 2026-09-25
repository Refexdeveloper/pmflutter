/** Welcome card shared by User Hub project and task pages. */
import { memo } from 'react'

function UserHubWelcome({ greeting, firstName, displayRole, email, subtitle, className = '' }) {
  return (
    <section className={`min-w-0 ${className || 'mb-4 sm:mb-5'}`}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1E62F0] text-sm font-bold text-white shadow-sm">
          {(firstName || 'U').charAt(0)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
            {greeting}, {firstName}
          </p>
          <p className="truncate text-xs text-slate-600 sm:text-sm">
            {subtitle || `Logged in as ${displayRole}`}
            {email ? ` · ${email}` : ''}
          </p>
        </div>
      </div>
    </section>
  );
}

export default memo(UserHubWelcome);
