import { Routes, Route } from 'react-router-dom'
import Home from './components/Home'
import CreatePoll from './components/CreatePoll'
import ViewPoll from './components/ViewPoll'
import Header from './components/Header'

function App() {
  return (
    <div className="app">
      <Header />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreatePoll />} />
          <Route path="/poll/:id" element={<ViewPoll />} />
        </Routes>
      </main>
      <footer className="footer">
        Built for <span className="footer-highlight">Ayrin Digital</span> by <span className="footer-name">Dhruv Bharuka</span>
      </footer>
    </div>
  )
}

export default App

