import { useLocation } from 'react-router-dom'

export default function NotFound() {
  const location = useLocation()

  return (
    <div className="relative flex h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="pointer-events-none absolute bottom-0 z-0 select-none text-9xl font-black text-gray-50 md:text-[12rem]">
        404
      </h1>
      <div className="relative z-10">
        <h1 className="mt-6 text-xl font-semibold md:text-2xl">This page has not been generated</h1>
        <p className="mt-2 font-mono text-base text-gray-400">{location.pathname}</p>
        <p className="mt-4 text-lg text-gray-500 md:text-xl">Tell me more about this page, so I can generate it</p>
      </div>
    </div>
  )
}

