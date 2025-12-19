import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const app = express();
const PORT = process.env.PORT || 3001;
const server = createServer(app);
const wss = new WebSocketServer({ server });
const pollSubscriptions = new Map();

app.use(cors());
app.use(express.json());

const polls = new Map();
const users = new Map();

const pollTemplates = [
  {
    id: 'team-lunch',
    name: 'Team Lunch',
    icon: '🍕',
    question: 'Where should we go for team lunch?',
    options: ['Pizza Place', 'Sushi Restaurant', 'Burger Joint', 'Salad Bar', 'Thai Food'],
    category: 'workplace'
  },
  {
    id: 'meeting-time',
    name: 'Meeting Time',
    icon: '📅',
    question: 'What time works best for our meeting?',
    options: ['9:00 AM', '11:00 AM', '2:00 PM', '4:00 PM'],
    category: 'workplace'
  },
  {
    id: 'movie-night',
    name: 'Movie Night',
    icon: '🎬',
    question: 'What movie should we watch?',
    options: ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi'],
    category: 'entertainment'
  },
  {
    id: 'event-date',
    name: 'Event Date',
    icon: '🎉',
    question: 'Which date works for the event?',
    options: ['This Friday', 'Next Saturday', 'In two weeks', 'Next month'],
    category: 'events'
  },
  {
    id: 'tech-stack',
    name: 'Tech Stack',
    icon: '💻',
    question: 'Which technology should we use?',
    options: ['React', 'Vue', 'Angular', 'Svelte'],
    category: 'tech'
  },
  {
    id: 'feedback',
    name: 'Feedback Rating',
    icon: '⭐',
    question: 'How would you rate this experience?',
    options: ['Excellent', 'Good', 'Average', 'Poor'],
    category: 'feedback'
  },
  {
    id: 'yes-no',
    name: 'Yes or No',
    icon: '✅',
    question: 'Do you agree?',
    options: ['Yes', 'No', 'Maybe'],
    category: 'general'
  },
  {
    id: 'priority',
    name: 'Priority Vote',
    icon: '🎯',
    question: 'What should we prioritize?',
    options: ['Feature A', 'Feature B', 'Bug fixes', 'Performance'],
    category: 'workplace'
  }
];

const generatePollId = () => `poll_${uuidv4().slice(0, 8)}`;
const generateOptionId = () => `opt_${uuidv4().slice(0, 8)}`;
const generateUserId = () => `user_${uuidv4().slice(0, 12)}`;

const getClientIdentifier = (req) => {
  const visitorId = req.headers['x-visitor-id'];
  if (visitorId) {
    return visitorId;
  }
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  return ip;
};

const calculatePercentages = (poll) => {
  return poll.options.map(option => ({
    ...option,
    percentage: poll.totalVotes > 0 
      ? Math.round((option.votes / poll.totalVotes) * 100) 
      : 0
  }));
};

const broadcastPollUpdate = (pollId, poll) => {
  const subscribers = pollSubscriptions.get(pollId);
  if (!subscribers) return;

  const message = JSON.stringify({
    type: 'poll_update',
    poll: {
      ...poll,
      voters: undefined,
      options: calculatePercentages(poll)
    }
  });

  subscribers.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
};

const generateEmbedCode = (pollId, baseUrl) => {
  const iframeCode = `<iframe src="${baseUrl}/embed/${pollId}" width="100%" height="500" frameborder="0" style="border-radius: 12px; max-width: 600px;"></iframe>`;
  const scriptCode = `<div id="poll-${pollId}"></div>\n<script src="${baseUrl}/embed.js" data-poll-id="${pollId}"></script>`;
  return { iframe: iframeCode, script: scriptCode };
};

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'subscribe' && message.pollId) {
        if (!pollSubscriptions.has(message.pollId)) {
          pollSubscriptions.set(message.pollId, new Set());
        }
        pollSubscriptions.get(message.pollId).add(ws);
        ws.pollId = message.pollId;
        
        const poll = polls.get(message.pollId);
        if (poll) {
          ws.send(JSON.stringify({
            type: 'poll_update',
            poll: {
              ...poll,
              voters: undefined,
              options: calculatePercentages(poll)
            }
          }));
        }
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    if (ws.pollId) {
      const subscribers = pollSubscriptions.get(ws.pollId);
      if (subscribers) {
        subscribers.delete(ws);
        if (subscribers.size === 0) {
          pollSubscriptions.delete(ws.pollId);
        }
      }
    }
  });
});

app.get('/api/templates', (req, res) => {
  const { category } = req.query;
  let templates = pollTemplates;
  
  if (category && category !== 'all') {
    templates = pollTemplates.filter(t => t.category === category);
  }
  
  res.json(templates);
});

app.post('/api/users', (req, res) => {
  const { nickname } = req.body;
  
  if (!nickname || !nickname.trim()) {
    return res.status(400).json({ error: 'Nickname is required' });
  }
  
  const userId = generateUserId();
  const user = {
    id: userId,
    nickname: nickname.trim(),
    createdAt: new Date().toISOString()
  };
  
  users.set(userId, user);
  res.status(201).json(user);
});

app.get('/api/users/:id', (req, res) => {
  const user = users.get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

app.post('/api/polls', (req, res) => {
  try {
    const { 
      question, 
      options, 
      allowMultiple = false, 
      expiresAt,
      requireAuth = false,
      templateId,
      creatorId,
      creatorNickname
    } = req.body;

    let pollQuestion = question;
    let pollOptions = options;

    if (templateId) {
      const template = pollTemplates.find(t => t.id === templateId);
      if (template) {
        pollQuestion = pollQuestion || template.question;
        pollOptions = pollOptions || template.options;
      }
    }

    if (!pollQuestion || !pollQuestion.trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (!pollOptions || !Array.isArray(pollOptions) || pollOptions.length < 2) {
      return res.status(400).json({ error: 'At least 2 options are required' });
    }

    const pollId = generatePollId();
    const createdAt = new Date().toISOString();
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const poll = {
      id: pollId,
      question: pollQuestion.trim(),
      options: pollOptions.map(text => ({
        id: generateOptionId(),
        text: typeof text === 'string' ? text.trim() : text,
        votes: 0
      })),
      allowMultiple: Boolean(allowMultiple),
      requireAuth: Boolean(requireAuth),
      totalVotes: 0,
      voters: new Map(),
      status: 'active',
      createdAt,
      expiresAt: expiresAt || null,
      shareUrl: `/poll/${pollId}`,
      embedCode: generateEmbedCode(pollId, baseUrl),
      creatorId: creatorId || null,
      creatorNickname: creatorNickname || 'Anonymous'
    };

    polls.set(pollId, poll);

    const response = {
      ...poll,
      voters: undefined,
      voterCount: 0,
      options: poll.options.map(opt => ({ ...opt }))
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating poll:', error);
    res.status(500).json({ error: 'Failed to create poll' });
  }
});

app.get('/api/polls/:id', (req, res) => {
  try {
    const { id } = req.params;
    const poll = polls.get(id);

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (poll.expiresAt && new Date(poll.expiresAt) < new Date()) {
      poll.status = 'closed';
    }

    const clientId = getClientIdentifier(req);
    const voterInfo = poll.voters.get(clientId);
    const hasVoted = Boolean(voterInfo);

    const recentVoters = Array.from(poll.voters.values())
      .filter(v => !v.anonymous && v.nickname)
      .slice(-5)
      .map(v => v.nickname);

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const response = {
      ...poll,
      voters: undefined,
      voterCount: poll.voters.size,
      recentVoters,
      hasVoted,
      myVote: voterInfo ? voterInfo.optionIds : null,
      options: calculatePercentages(poll),
      embedCode: generateEmbedCode(poll.id, baseUrl)
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting poll:', error);
    res.status(500).json({ error: 'Failed to get poll' });
  }
});

app.post('/api/polls/:id/vote', (req, res) => {
  try {
    const { id } = req.params;
    const { optionId, optionIds, anonymous = true, nickname, userId } = req.body;
    
    const poll = polls.get(id);

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    if (poll.status === 'closed') {
      return res.status(400).json({ error: 'Poll is closed' });
    }

    if (poll.expiresAt && new Date(poll.expiresAt) < new Date()) {
      poll.status = 'closed';
      return res.status(400).json({ error: 'Poll has expired' });
    }

    if (poll.requireAuth && !userId && !nickname) {
      return res.status(400).json({ error: 'This poll requires identification. Please provide a nickname.' });
    }

    const clientId = getClientIdentifier(req);
    if (poll.voters.has(clientId)) {
      return res.status(400).json({ error: 'You have already voted on this poll' });
    }

    const selectedOptions = poll.allowMultiple && optionIds 
      ? optionIds 
      : [optionId];

    if (!selectedOptions || selectedOptions.length === 0) {
      return res.status(400).json({ error: 'At least one option must be selected' });
    }

    for (const selectedId of selectedOptions) {
      const option = poll.options.find(opt => opt.id === selectedId);
      if (!option) {
        return res.status(400).json({ error: `Invalid option ID: ${selectedId}` });
      }
      option.votes += 1;
    }

    poll.totalVotes += 1;
    
    poll.voters.set(clientId, {
      anonymous: Boolean(anonymous),
      nickname: anonymous ? null : (nickname || 'Anonymous'),
      userId: userId || null,
      optionIds: selectedOptions,
      votedAt: new Date().toISOString()
    });

    const recentVoters = Array.from(poll.voters.values())
      .filter(v => !v.anonymous && v.nickname)
      .slice(-5)
      .map(v => v.nickname);

    const updatedPoll = {
      ...poll,
      voters: undefined,
      voterCount: poll.voters.size,
      recentVoters,
      hasVoted: true,
      myVote: selectedOptions,
      options: calculatePercentages(poll)
    };

    broadcastPollUpdate(id, poll);

    const response = {
      success: true,
      poll: updatedPoll
    };

    res.json(response);
  } catch (error) {
    console.error('Error submitting vote:', error);
    res.status(500).json({ error: 'Failed to submit vote' });
  }
});

app.post('/api/polls/:id/close', (req, res) => {
  try {
    const { id } = req.params;
    const poll = polls.get(id);

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    poll.status = 'closed';

    broadcastPollUpdate(id, poll);

    const response = {
      success: true,
      poll: {
        ...poll,
        voters: undefined,
        voterCount: poll.voters.size,
        options: calculatePercentages(poll)
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error closing poll:', error);
    res.status(500).json({ error: 'Failed to close poll' });
  }
});

app.get('/api/polls', (req, res) => {
  try {
    const allPolls = Array.from(polls.values()).map(poll => ({
      id: poll.id,
      question: poll.question,
      totalVotes: poll.totalVotes,
      voterCount: poll.voters.size,
      status: poll.status,
      requireAuth: poll.requireAuth,
      createdAt: poll.createdAt,
      expiresAt: poll.expiresAt,
      creatorNickname: poll.creatorNickname
    }));

    res.json(allPolls);
  } catch (error) {
    console.error('Error getting polls:', error);
    res.status(500).json({ error: 'Failed to get polls' });
  }
});

app.get('/embed/:id', (req, res) => {
  const { id } = req.params;
  const poll = polls.get(id);

  if (!poll) {
    return res.status(404).send('Poll not found');
  }

  const optionsWithPercentage = calculatePercentages(poll);
  const optionsHtml = optionsWithPercentage.map(opt => 
    `<div class="option" data-id="${opt.id}"><div class="option-text"><span>${opt.text}</span></div></div>`
  ).join('');

  const safeData = JSON.stringify({
    ...poll,
    voters: undefined,
    options: optionsWithPercentage
  }).replace(/<\/script>/gi, '<\\/script>');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${poll.question.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0a0a0f; color: #f5f5f7; padding: 20px; }
    .poll-container { max-width: 500px; margin: 0 auto; background: #15151f; border-radius: 16px; padding: 24px; border: 1px solid rgba(255,255,255,0.06); }
    .question { font-size: 1.25rem; font-weight: 600; margin-bottom: 8px; }
    .vote-count { color: #a0a0b0; font-size: 0.875rem; margin-bottom: 20px; }
    .option { background: #12121a; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 16px; margin-bottom: 10px; cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden; }
    .option:hover { border-color: rgba(99,102,241,0.3); }
    .option.selected { border-color: #6366f1; background: rgba(99,102,241,0.08); }
    .option-text { position: relative; z-index: 1; display: flex; justify-content: space-between; }
    .progress { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(99,102,241,0.15); transition: width 0.5s; }
    .percentage { color: #818cf8; font-weight: 600; }
    .btn { width: 100%; padding: 14px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%); border: none; border-radius: 10px; color: white; font-size: 1rem; font-weight: 500; cursor: pointer; margin-top: 16px; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .voted-message { text-align: center; color: #10b981; margin-top: 16px; display: none; }
    .powered-by { text-align: center; margin-top: 20px; font-size: 0.75rem; color: #6b6b7b; }
    .powered-by a { color: #818cf8; text-decoration: none; }
  </style>
</head>
<body>
  <div class="poll-container">
    <div class="question">${poll.question.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    <div class="vote-count"><span id="vote-count">${poll.totalVotes}</span> votes</div>
    <div id="options">${optionsHtml}</div>
    <button class="btn" id="vote-btn">Submit Vote</button>
    <div class="voted-message" id="voted-message">✓ Thanks for voting!</div>
    <div class="powered-by">Powered by <a href="/" target="_blank">PollCreator</a></div>
  </div>
  <script type="text/javascript">
    (function() {
      var pollId = "${id}";
      var selectedOption = null;
      var hasVoted = false;
      var pollData = ${safeData};

      function renderOptions(showResults) {
        var container = document.getElementById("options");
        var html = "";
        for (var i = 0; i < pollData.options.length; i++) {
          var opt = pollData.options[i];
          var cls = "option" + (selectedOption === opt.id ? " selected" : "");
          var prog = showResults ? "<div class='progress' style='width:" + opt.percentage + "%'></div>" : "";
          var pct = showResults ? "<span class='percentage'>" + opt.percentage + "%</span>" : "";
          html += "<div class='" + cls + "' data-id='" + opt.id + "'>" + prog + "<div class='option-text'><span>" + opt.text + "</span>" + pct + "</div></div>";
        }
        container.innerHTML = html;
        var opts = container.querySelectorAll(".option");
        for (var j = 0; j < opts.length; j++) {
          opts[j].onclick = function() { selectOption(this.getAttribute("data-id")); };
        }
      }

      function selectOption(optId) {
        if (hasVoted) return;
        selectedOption = optId;
        renderOptions(false);
      }

      document.getElementById("vote-btn").onclick = function() {
        if (!selectedOption || hasVoted) return;
        fetch("/api/polls/" + pollId + "/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ optionId: selectedOption })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.success) {
            hasVoted = true;
            pollData = data.poll;
            document.getElementById("vote-btn").style.display = "none";
            document.getElementById("voted-message").style.display = "block";
            document.getElementById("vote-count").textContent = pollData.totalVotes;
            renderOptions(true);
          } else {
            alert(data.error || "Failed to vote");
          }
        })
        .catch(function() { alert("Failed to submit vote"); });
      };

      try {
        var ws = new WebSocket("ws://" + location.host);
        ws.onopen = function() { ws.send(JSON.stringify({ type: "subscribe", pollId: pollId })); };
        ws.onmessage = function(e) {
          var msg = JSON.parse(e.data);
          if (msg.type === "poll_update") {
            pollData = msg.poll;
            document.getElementById("vote-count").textContent = pollData.totalVotes;
            if (hasVoted) renderOptions(true);
          }
        };
      } catch(e) {}

      renderOptions(false);
    })();
  </script>
</body>
</html>`;

  res.send(html);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Poll Creator API running on http://0.0.0.0:${PORT}`);
  console.log(`📡 WebSocket server ready for real-time updates`);
});
