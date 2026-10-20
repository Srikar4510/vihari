import React, { useState } from 'react'
import '../CSS/Navbar.css'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { jwtDecode } from 'jwt-decode'

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/tours', label: 'Tours' },
  { to: '/about', label: 'About' },
]

// Which kind of account the saved token belongs to: 'user', 'agent', 'admin' or null.
const sessionRole = () => {
  const token = localStorage.getItem('token')
  if (!token) return null
  try {
    const payload = jwtDecode(token)
    if (payload.admin) return 'admin'
    if (payload.agent) return 'agent'
    if (payload.user) return 'user'
  } catch { /* not a valid token */ }
  return null
}

const Navbar = () => {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const role = sessionRole()
  const loggedIn = Boolean(role)

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('agentId')
    setOpen(false)
    navigate('/')
  }

  const linkClass = ({ isActive }) => `site-nav-link${isActive ? ' active' : ''}`

  return (
    <div className="site-nav-wrap">
    <nav className="site-nav">
      <div className="site-nav-inner">
        <Link className="site-nav-logo" to="/" onClick={() => setOpen(false)}>
          <span className="site-nav-logo-icon"><i className="fa fa-bus-alt" /></span>
          Vihari
        </Link>

        <button
          type="button"
          className={`site-nav-toggle${open ? ' open' : ''}`}
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <span /><span /><span />
        </button>

        <div className={`site-nav-menu${open ? ' open' : ''}`}>
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass} onClick={() => setOpen(false)}>
              {l.label}
            </NavLink>
          ))}
          {role === 'user' && (
            <NavLink to="/profile" className={linkClass} onClick={() => setOpen(false)}>Profile</NavLink>
          )}
          {role === 'admin' && (
            <NavLink to="/admindb/adminhome" className={linkClass} onClick={() => setOpen(false)}>Admin console</NavLink>
          )}
          {role === 'agent' && (
            <NavLink to="/agent/agentHome" className={linkClass} onClick={() => setOpen(false)}>Partner portal</NavLink>
          )}

          {loggedIn ? (
            <button type="button" className="site-nav-cta site-nav-cta--ghost" onClick={logout}>
              <i className="fa fa-sign-out-alt" /> Logout
            </button>
          ) : (
            <Link to="/login" className="site-nav-cta" onClick={() => setOpen(false)}>
              <i className="fa fa-user" /> Login
            </Link>
          )}
        </div>
      </div>
    </nav>
    </div>
  )
}

export default Navbar
