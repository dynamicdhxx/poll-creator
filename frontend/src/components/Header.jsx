import { Link, useLocation } from 'react-router-dom'
import './Header.css'

function Header() {
  const location = useLocation()
  
  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          <span className="logo-icon">📊</span>
          <span className="logo-text">Poll<span className="text-gradient">Creator</span></span>
        </Link>
        
        <nav className="nav">
          {location.pathname !== '/' && (
            <Link to="/" className="nav-link">
              Home
            </Link>
          )}
          <Link 
            to="/create" 
            className={`nav-link nav-link-cta ${location.pathname === '/create' ? 'active' : ''}`}
          >
            Create Poll
          </Link>
        </nav>
      </div>
    </header>
  )
}

export default Header

