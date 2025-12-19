import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import './CreatePoll.css'

function CreatePoll() {
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [requireAuth, setRequireAuth] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [showTemplates, setShowTemplates] = useState(true)
  const [creatorNickname, setCreatorNickname] = useState('')

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const response = await axios.get('/api/templates')
      setTemplates(response.data)
    } catch (err) {
      console.error('Failed to fetch templates:', err)
    }
  }

  const selectTemplate = (template) => {
    setSelectedTemplate(template)
    setQuestion(template.question)
    setOptions(template.options)
    setShowTemplates(false)
  }

  const clearTemplate = () => {
    setSelectedTemplate(null)
    setQuestion('')
    setOptions(['', ''])
    setShowTemplates(true)
  }

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, ''])
    }
  }

  const removeOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index))
    }
  }

  const updateOption = (index, value) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!question.trim()) {
      setError('Please enter a question')
      return
    }

    const validOptions = options.filter(opt => opt.trim())
    if (validOptions.length < 2) {
      setError('Please add at least 2 options')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await axios.post('/api/polls', {
        question: question.trim(),
        options: validOptions,
        allowMultiple,
        requireAuth,
        expiresAt: expiresAt || null,
        templateId: selectedTemplate?.id,
        creatorNickname: creatorNickname.trim() || 'Anonymous'
      })

      navigate(`/poll/${response.data.id}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create poll')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="create-poll animate-fadeIn">
      <div className="create-poll-header">
        <span className="create-icon">📊</span>
        <h1>Create a Poll</h1>
        <p className="create-description">
          Ask a question and let people vote on the options
        </p>
      </div>

      {showTemplates && templates.length > 0 && (
        <div className="templates-section">
          <h3 className="templates-title">
            <span>✨</span> Quick Start with Templates
          </h3>
          <div className="templates-grid">
            {templates.map(template => (
              <button
                key={template.id}
                className="template-card"
                onClick={() => selectTemplate(template)}
              >
                <span className="template-icon">{template.icon}</span>
                <span className="template-name">{template.name}</span>
              </button>
            ))}
          </div>
          <div className="templates-divider">
            <span>or create from scratch</span>
          </div>
        </div>
      )}

      {selectedTemplate && (
        <div className="selected-template-badge">
          <span className="template-icon">{selectedTemplate.icon}</span>
          <span>Using "{selectedTemplate.name}" template</span>
          <button className="clear-template" onClick={clearTemplate}>✕</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="poll-form card card-glow">
        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        <div className="input-group">
          <label className="input-label">Your Question</label>
          <input
            type="text"
            className="input input-large"
            placeholder="What's your favorite programming language?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={200}
          />
          <span className="char-count">{question.length}/200</span>
        </div>

        <div className="input-group">
          <label className="input-label">Answer Options</label>
          <div className="options-list">
            {options.map((option, index) => (
              <div key={index} className="option-row animate-fadeIn">
                <span className="option-number">{index + 1}</span>
                <input
                  type="text"
                  className="input"
                  placeholder={`Option ${index + 1}`}
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  maxLength={100}
                />
                <button
                  type="button"
                  className="btn btn-icon btn-ghost remove-btn"
                  onClick={() => removeOption(index)}
                  disabled={options.length <= 2}
                  title="Remove option"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          
          {options.length < 10 && (
            <button
              type="button"
              className="btn btn-secondary add-option-btn"
              onClick={addOption}
            >
              <span className="plus">+</span>
              Add Option
            </button>
          )}
        </div>

        <div className="poll-settings">
          <h4 className="settings-title">Poll Settings</h4>
          
          <div className="setting-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={allowMultiple}
                onChange={(e) => setAllowMultiple(e.target.checked)}
              />
              <span className="checkbox-custom"></span>
              <div className="checkbox-content">
                <span className="checkbox-text">Allow multiple selections</span>
                <span className="checkbox-hint">Voters can select more than one option</span>
              </div>
            </label>
          </div>

          <div className="setting-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={requireAuth}
                onChange={(e) => setRequireAuth(e.target.checked)}
              />
              <span className="checkbox-custom"></span>
              <div className="checkbox-content">
                <span className="checkbox-text">Require identification</span>
                <span className="checkbox-hint">Voters must enter a nickname before voting</span>
              </div>
            </label>
          </div>

          <div className="setting-row">
            <label className="input-label">Your Nickname (optional)</label>
            <input
              type="text"
              className="input"
              placeholder="Anonymous"
              value={creatorNickname}
              onChange={(e) => setCreatorNickname(e.target.value)}
              maxLength={50}
            />
            <span className="input-hint">Shown as poll creator</span>
          </div>

          <div className="setting-row">
            <label className="input-label">Expiration Date (optional)</label>
            <input
              type="date"
              className="input input-date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              placeholder="Select date"
            />
            <span className="input-hint">Tap to select when this poll should close</span>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className="spinner"></span>
              Creating...
            </>
          ) : (
            <>
              <span>🚀</span>
              Create Poll
            </>
          )}
        </button>
      </form>
    </div>
  )
}

export default CreatePoll
