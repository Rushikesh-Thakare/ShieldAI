import React from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from './Header'

export const Layout: React.FC = () => {
  return (
    <div className="shield-app-shell">
      <Header />
      <main className="shield-main-content">
        <Outlet />
      </main>
    </div>
  )
}
