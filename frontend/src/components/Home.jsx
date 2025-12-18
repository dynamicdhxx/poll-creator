import { Link } from 'react-router-dom'
import './Home.css'

function Home() {
  return (
    <div className="home">
      <section className="hero animate-fadeIn">
        <div className="hero-badge">
          <span className="badge-icon">✨</span>
          <span>Quick & Beautiful Polls</span>
        </div>
        
        <h1 className="hero-title">
          Create polls in <span className="text-gradient">seconds</span>,<br />
          get insights <span className="text-gradient">instantly</span>
        </h1>
        
        <p className="hero-description">
          The simplest way to gather opinions. Create beautiful, shareable polls 
          with real-time results. No signup required.
        </p>
        
        <div className="hero-actions">
          <Link to="/create" className="btn btn-primary btn-large">
            <span className="btn-icon-left">🚀</span>
            Create Your First Poll
          </Link>
        </div>
      </section>
      
      <section className="features animate-slideUp" style={{ animationDelay: '0.2s' }}>
        <div className="feature-card">
          <div className="feature-icon">⚡</div>
          <h3 className="feature-title">Lightning Fast</h3>
          <p className="feature-description">
            Create a poll in under 30 seconds. No complicated setup or account needed.
          </p>
        </div>
        
        <div className="feature-card">
          <div className="feature-icon">📊</div>
          <h3 className="feature-title">Live Results</h3>
          <p className="feature-description">
            Watch votes come in real-time with beautiful, animated visualizations.
          </p>
        </div>
        
        <div className="feature-card">
          <div className="feature-icon">🔗</div>
          <h3 className="feature-title">Easy Sharing</h3>
          <p className="feature-description">
            Share with a single link. Works everywhere – social media, email, chat.
          </p>
        </div>
        
        <div className="feature-card">
          <div className="feature-icon">🛡️</div>
          <h3 className="feature-title">Fair Voting</h3>
          <p className="feature-description">
            Built-in duplicate vote prevention ensures accurate, trustworthy results.
          </p>
        </div>
      </section>
      
      <section className="how-it-works animate-slideUp" style={{ animationDelay: '0.4s' }}>
        <h2 className="section-title">How it works</h2>
        
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h4>Create your question</h4>
              <p>Write your poll question and add answer options</p>
            </div>
          </div>
          
          <div className="step-arrow">→</div>
          
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h4>Share the link</h4>
              <p>Copy your unique poll link and share it anywhere</p>
            </div>
          </div>
          
          <div className="step-arrow">→</div>
          
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h4>Collect responses</h4>
              <p>Watch the votes roll in and see instant results</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home

