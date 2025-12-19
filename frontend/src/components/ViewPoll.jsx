import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import './ViewPoll.css'

const getVisitorId = () => {
  let visitorId = localStorage.getItem('poll_visitor_id')
  if (!visitorId) {
    visitorId = 'v_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
    localStorage.setItem('poll_visitor_id', visitorId)
  }
  return visitorId
}

const hasVotedLocally = (pollId) => {
  const votedPolls = JSON.parse(localStorage.getItem('voted_polls') || '{}')
  return !!votedPolls[pollId]
}

const markVotedLocally = (pollId) => {
  const votedPolls = JSON.parse(localStorage.getItem('voted_polls') || '{}')
  votedPolls[pollId] = Date.now()
  localStorage.setItem('voted_polls', JSON.stringify(votedPolls))
}

function ViewPoll() {
  const { id } = useParams()
  const [poll, setPoll] = useState(null)
  const [selectedOptions, setSelectedOptions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isVoting, setIsVoting] = useState(false)
  const [error, setError] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedEmbed, setCopiedEmbed] = useState(false)
  const [showEmbedModal, setShowEmbedModal] = useState(false)
  const [embedType, setEmbedType] = useState('iframe')
  const [nickname, setNickname] = useState('')
  const [voteAnonymously, setVoteAnonymously] = useState(true)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const wsRef = useRef(null)

  useEffect(() => {
    fetchPoll()
    setupWebSocket()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [id])

  const setupWebSocket = () => {
    const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('192.168') && !window.location.hostname.includes('10.')
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = isProduction 
      ? 'wss://poll-creator-api.onrender.com'
      : `${protocol}//${window.location.hostname}:3001`
    
    try {
      wsRef.current = new WebSocket(wsUrl)
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected')
        wsRef.current.send(JSON.stringify({ type: 'subscribe', pollId: id }))
      }
      
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'poll_update') {
          setPoll(prev => ({
            ...prev,
            ...data.poll,
            hasVoted: prev?.hasVoted || data.poll.hasVoted
          }))
        }
      }
      
      wsRef.current.onerror = (error) => {
        console.log('WebSocket error:', error)
      }
      
      wsRef.current.onclose = () => {
        console.log('WebSocket closed')
      }
    } catch (err) {
      console.log('WebSocket not available')
    }
  }

  const fetchPoll = async () => {
    try {
      const visitorId = getVisitorId()
      const response = await axios.get(`/api/polls/${id}?visitorId=${visitorId}`)
      const localVoted = hasVotedLocally(id)
      setPoll({
        ...response.data,
        hasVoted: response.data.hasVoted || localVoted
      })
      if (response.data.hasVoted || localVoted || response.data.status === 'closed') {
        setShowResults(true)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Poll not found')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOptionSelect = (optionId) => {
    if (poll.allowMultiple) {
      setSelectedOptions(prev =>
        prev.includes(optionId)
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      )
    } else {
      setSelectedOptions([optionId])
    }
  }

  const handleVoteClick = () => {
    if (selectedOptions.length === 0) {
      setError('Please select an option')
      return
    }

    if (poll.requireAuth && !nickname.trim()) {
      setShowAuthModal(true)
      return
    }

    submitVote()
  }

  const submitVote = async () => {
    setIsVoting(true)
    setError('')
    setShowAuthModal(false)

    try {
      const shouldSendNickname = poll.requireAuth || !voteAnonymously
      const visitorId = getVisitorId()
      
      const response = await axios.post(`/api/polls/${id}/vote`, {
        optionId: selectedOptions[0],
        optionIds: poll.allowMultiple ? selectedOptions : undefined,
        anonymous: poll.requireAuth ? false : voteAnonymously,
        nickname: shouldSendNickname ? nickname.trim() : undefined,
        visitorId
      })

      markVotedLocally(id)
      setPoll({ ...response.data.poll, hasVoted: true })
      setShowResults(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit vote')
    } finally {
      setIsVoting(false)
    }
  }

  const handleClosePoll = async () => {
    try {
      const response = await axios.post(`/api/polls/${id}/close`)
      setPoll(response.data.poll)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to close poll')
    }
  }

  const copyShareLink = () => {
    const shareUrl = `${window.location.origin}/poll/${id}`
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyEmbedCode = () => {
    const code = embedType === 'iframe' 
      ? poll.embedCode?.iframe 
      : poll.embedCode?.script
    navigator.clipboard.writeText(code)
    setCopiedEmbed(true)
    setTimeout(() => setCopiedEmbed(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="poll-loading">
        <div className="loading-spinner"></div>
        <p>Loading poll...</p>
      </div>
    )
  }

  if (error && !poll) {
    return (
      <div className="poll-error">
        <span className="error-emoji">😕</span>
        <h2>Poll Not Found</h2>
        <p>{error}</p>
        <Link to="/create" className="btn btn-primary">
          Create a New Poll
        </Link>
      </div>
    )
  }

  return (
    <div className="view-poll animate-fadeIn">
      <div className="poll-card card card-glow">
        <div className="status-badges">
          {poll.status === 'closed' && (
            <div className="status-badge status-closed">
              <span>🔒</span> Poll Closed
            </div>
          )}
          
          {poll.expiresAt && poll.status === 'active' && (
            <div className="status-badge status-expires">
              <span>⏰</span> Expires {new Date(poll.expiresAt).toLocaleDateString()}
            </div>
          )}

          {poll.requireAuth && (
            <div className="status-badge status-auth">
              <span>🔐</span> ID Required
            </div>
          )}
        </div>

        <h1 className="poll-question">{poll.question}</h1>

        <div className="poll-meta">
          <div className="vote-count">
            <span className="vote-number">{poll.totalVotes}</span>
            <span className="vote-label">{poll.totalVotes === 1 ? 'vote' : 'votes'}</span>
          </div>
          {poll.creatorNickname && (
            <div className="creator-info">
              by <span className="creator-name">{poll.creatorNickname}</span>
            </div>
          )}
        </div>

        {poll.recentVoters && poll.recentVoters.length > 0 && (
          <div className="recent-voters">
            <span className="voters-label">Recent voters:</span>
            {poll.recentVoters.map((name, i) => (
              <span key={i} className="voter-name">{name}</span>
            ))}
          </div>
        )}

        {error && (
          <div className="error-message">
            <span>⚠️</span> {error}
          </div>
        )}

        <div className="options-container">
          {poll.options.map((option, index) => (
            <div
              key={option.id}
              className={`option ${showResults ? 'option-result' : 'option-vote'} ${
                selectedOptions.includes(option.id) ? 'selected' : ''
              } ${poll.myVote?.includes(option.id) ? 'my-vote' : ''}`}
              onClick={() => !showResults && poll.status === 'active' && handleOptionSelect(option.id)}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {!showResults && poll.status === 'active' && (
                <div className={`option-radio ${poll.allowMultiple ? 'checkbox' : ''}`}>
                  {selectedOptions.includes(option.id) && (
                    <span className="checkmark">✓</span>
                  )}
                </div>
              )}

              <div className="option-content">
                <span className="option-text">
                  {option.text}
                  {poll.myVote?.includes(option.id) && (
                    <span className="your-vote-badge">Your vote</span>
                  )}
                </span>
                
                {showResults && (
                  <div className="option-stats">
                    <span className="option-votes">{option.votes}</span>
                    <span className="option-percentage">{option.percentage}%</span>
                  </div>
                )}
              </div>

              {showResults && (
                <div className="progress-bar-container">
                  <div
                    className={`progress-bar ${poll.myVote?.includes(option.id) ? 'my-vote-bar' : ''}`}
                    style={{
                      width: `${option.percentage}%`,
                      animationDelay: `${index * 0.1}s`
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {!showResults && poll.status === 'active' && (
          <button
            className="btn btn-primary btn-vote"
            onClick={handleVoteClick}
            disabled={isVoting || selectedOptions.length === 0}
          >
            {isVoting ? (
              <>
                <span className="spinner"></span>
                Submitting...
              </>
            ) : (
              <>
                <span>🗳️</span>
                Submit Vote
              </>
            )}
          </button>
        )}

        {!poll.hasVoted && poll.status === 'active' && !poll.requireAuth && (
          <div className="anonymous-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={!voteAnonymously}
                onChange={(e) => setVoteAnonymously(!e.target.checked)}
              />
              <span className="toggle-switch"></span>
              <span className="toggle-text">Show my name on this poll</span>
            </label>
            {!voteAnonymously && (
              <input
                type="text"
                className="nickname-input"
                placeholder="Enter your nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={30}
              />
            )}
          </div>
        )}

        {!poll.hasVoted && poll.status === 'active' && (
          <button
            className="btn btn-ghost btn-toggle-results"
            onClick={() => setShowResults(!showResults)}
          >
            {showResults ? '← Back to voting' : 'View results →'}
          </button>
        )}

        <div className="share-section">
          <div className="share-label">Share this poll</div>
          <div className="share-row">
            <input
              type="text"
              className="share-input"
              value={`${window.location.origin}/poll/${id}`}
              readOnly
            />
            <button
              className={`btn btn-secondary btn-copy ${copied ? 'copied' : ''}`}
              onClick={copyShareLink}
            >
              {copied ? (
                <>
                  <span>✓</span>
                  Copied!
                </>
              ) : (
                <>
                  <span>📋</span>
                  Copy
                </>
              )}
            </button>
          </div>
          
          <button
            className="btn btn-ghost btn-embed"
            onClick={() => setShowEmbedModal(true)}
          >
            <span>{'</>'}</span>
            Get Embed Code
          </button>
        </div>

        {poll.status === 'active' && (
          <div className="admin-actions">
            <button
              className="btn btn-ghost btn-close-poll"
              onClick={handleClosePoll}
            >
              🔒 Close Poll
            </button>
          </div>
        )}
      </div>

      <div className="create-cta animate-slideUp" style={{ animationDelay: '0.2s' }}>
        <Link to="/create" className="btn btn-secondary">
          <span>+</span>
          Create Your Own Poll
        </Link>
      </div>

      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Enter Your Name</h3>
            <p>This poll requires identification to vote.</p>
            <input
              type="text"
              className="input"
              placeholder="Your nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowAuthModal(false)}>
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={submitVote}
                disabled={!nickname.trim()}
              >
                Submit Vote
              </button>
            </div>
          </div>
        </div>
      )}

      {showEmbedModal && (
        <div className="modal-overlay" onClick={() => setShowEmbedModal(false)}>
          <div className="modal modal-embed" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Embed This Poll</h3>
              <button className="modal-close" onClick={() => setShowEmbedModal(false)}>✕</button>
            </div>
            
            <div className="embed-tabs">
              <button 
                className={`embed-tab ${embedType === 'iframe' ? 'active' : ''}`}
                onClick={() => setEmbedType('iframe')}
              >
                iFrame
              </button>
              <button 
                className={`embed-tab ${embedType === 'script' ? 'active' : ''}`}
                onClick={() => setEmbedType('script')}
              >
                JavaScript
              </button>
            </div>
            
            <div className="embed-code-container">
              <pre className="embed-code">
                {embedType === 'iframe' ? poll.embedCode?.iframe : poll.embedCode?.script}
              </pre>
            </div>
            
            <button 
              className={`btn btn-primary ${copiedEmbed ? 'copied' : ''}`}
              onClick={copyEmbedCode}
            >
              {copiedEmbed ? '✓ Copied!' : '📋 Copy Code'}
            </button>
            
            <p className="embed-hint">
              {embedType === 'iframe' 
                ? 'Paste this code anywhere on your website to embed the poll.'
                : 'Add this script to your page for a more customizable embed.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default ViewPoll
