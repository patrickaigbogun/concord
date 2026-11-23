package ui

import _ "embed"

//go:embed logo.png
var LogoPNG []byte

const LoginTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Concord ID — Single Sign-On</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #09090b;
      --card-bg: #121215;
      --card-border: rgba(255, 255, 255, 0.08);
      --input-bg: #18181c;
      --input-border: rgba(255, 255, 255, 0.1);
      --input-focus: #e4e4e7;
      --text: #fafafa;
      --text-muted: #a1a1aa;
      --text-dim: #71717a;
      --primary: #ffffff;
      --primary-text: #09090b;
      --primary-hover: #e4e4e7;
      --danger-bg: rgba(239, 68, 68, 0.1);
      --danger-border: rgba(239, 68, 68, 0.25);
      --danger-text: #fca5a5;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg);
      background-image: 
        radial-gradient(at 50% 0%, rgba(120, 119, 198, 0.08) 0%, transparent 60%),
        radial-gradient(at 100% 100%, rgba(59, 130, 246, 0.04) 0%, transparent 50%);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      width: 100%;
      max-width: 400px;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 2.25rem 2rem;
      box-shadow: 
        0 0 0 1px rgba(255, 255, 255, 0.02),
        0 20px 40px -15px rgba(0, 0, 0, 0.7);
    }

    .header {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      margin-bottom: 1.75rem;
    }

    .logo-badge {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: #18181c;
      border: 1px solid var(--card-border);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }

    .logo-badge svg {
      width: 26px;
      height: 26px;
    }

    .title {
      font-size: 1.35rem;
      font-weight: 700;
      letter-spacing: -0.025em;
      color: var(--text);
    }

    .subtitle {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 0.35rem;
      line-height: 1.4;
    }

    .app-prompt {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 0.75rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--card-border);
      padding: 0.4rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .app-prompt b {
      color: var(--text);
      font-weight: 600;
    }

    /* 1-Click SSO User Profile Card */
    .user-profile-box {
      background: #18181c;
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 1rem;
      display: flex;
      align-items: center;
      gap: 0.85rem;
      margin-bottom: 1.5rem;
    }

    .user-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1.1rem;
      color: #fff;
      overflow: hidden;
      flex-shrink: 0;
    }

    .user-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .user-info {
      flex: 1;
      min-width: 0;
    }

    .user-name {
      font-weight: 600;
      font-size: 0.95rem;
      color: var(--text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-handle {
      font-size: 0.775rem;
      color: var(--text-muted);
    }

    /* Tabs */
    .tab-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      background: var(--input-bg);
      border: 1px solid var(--card-border);
      padding: 3px;
      border-radius: 12px;
      margin-bottom: 1.5rem;
    }

    .tab-btn {
      background: transparent;
      border: none;
      color: var(--text-dim);
      font-family: inherit;
      font-size: 0.825rem;
      font-weight: 600;
      padding: 0.5rem;
      border-radius: 9px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .tab-btn.active {
      background: #27272a;
      color: var(--text);
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }

    /* Form */
    .form-pane {
      display: none;
    }
    .form-pane.active {
      display: block;
    }

    .form-group {
      margin-bottom: 1.15rem;
    }

    label {
      display: block;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 0.4rem;
    }

    input {
      width: 100%;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: 11px;
      padding: 0.75rem 0.95rem;
      font-size: 0.9rem;
      color: var(--text);
      outline: none;
      font-family: inherit;
      transition: all 0.15s ease;
    }

    input::placeholder {
      color: var(--text-dim);
    }

    input:focus {
      border-color: var(--input-focus);
      background: #1c1c22;
      box-shadow: 0 0 0 1px var(--input-focus);
    }

    .submit-btn {
      width: 100%;
      background: var(--primary);
      color: var(--primary-text);
      font-family: inherit;
      font-size: 0.9rem;
      font-weight: 600;
      border: none;
      border-radius: 11px;
      padding: 0.85rem;
      cursor: pointer;
      transition: all 0.15s ease;
      margin-top: 0.5rem;
    }

    .submit-btn:hover {
      background: var(--primary-hover);
      transform: translateY(-1px);
    }

    .submit-btn:active {
      transform: translateY(0);
    }

    .switch-btn {
      display: block;
      width: 100%;
      background: transparent;
      border: none;
      color: var(--text-dim);
      font-family: inherit;
      font-size: 0.8rem;
      font-weight: 500;
      margin-top: 1rem;
      cursor: pointer;
      text-decoration: underline;
      transition: color 0.15s ease;
    }

    .switch-btn:hover {
      color: var(--text-muted);
    }

    .error-banner {
      background: var(--danger-bg);
      border: 1px solid var(--danger-border);
      color: var(--danger-text);
      padding: 0.65rem 0.85rem;
      border-radius: 10px;
      font-size: 0.8rem;
      font-weight: 500;
      margin-bottom: 1.25rem;
      text-align: center;
    }

    .footer {
      margin-top: 1.75rem;
      text-align: center;
      font-size: 0.725rem;
      color: var(--text-dim);
      letter-spacing: 0.02em;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo-badge">
          <svg viewBox="0 0 100 100" fill="none">
            <path d="M 68 22 A 38 38 0 1 0 68 78" stroke="#8b5cf6" stroke-width="12" stroke-linecap="round"/>
            <circle cx="50" cy="50" r="16" stroke="#8b5cf6" stroke-width="10"/>
          </svg>
        </div>
        <div class="title">Concord ID</div>
        {{if .ClientName}}
        <div class="app-prompt">
          Connecting to <b>{{.ClientName}}</b>
        </div>
        {{else}}
        <div class="subtitle">Single Sign-On for the Concord ecosystem</div>
        {{end}}
      </div>

      {{if .Error}}
      <div class="error-banner">{{.Error}}</div>
      {{end}}

      {{if .IsActiveSession}}
      <!-- 1-Click Instant SSO Consent View -->
      <div id="pane-sso">
        <div class="user-profile-box">
          <div class="user-avatar">
            {{if .ActiveUser.AvatarURL}}
            <img src="{{.ActiveUser.AvatarURL}}" alt="{{.ActiveUser.DisplayName}}">
            {{else}}
            {{printf "%.1s" .ActiveUser.DisplayName}}
            {{end}}
          </div>
          <div class="user-info">
            <div class="user-name">{{.ActiveUser.DisplayName}}</div>
            <div class="user-handle">@{{.ActiveUser.Username}} &bull; {{.ActiveUser.Email}}</div>
          </div>
        </div>

        <form method="POST" action="/oauth/authorize">
          <input type="hidden" name="action" value="consent">
          <input type="hidden" name="client_id" value="{{.ClientID}}">
          <input type="hidden" name="redirect_uri" value="{{.RedirectURI}}">
          <input type="hidden" name="response_type" value="{{.ResponseType}}">
          <input type="hidden" name="state" value="{{.State}}">
          <input type="hidden" name="code_challenge" value="{{.CodeChallenge}}">
          <input type="hidden" name="code_challenge_method" value="{{.CodeChallengeMethod}}">

          <button type="submit" class="submit-btn">Continue as {{.ActiveUser.DisplayName}}</button>
        </form>

        <button type="button" class="switch-btn" onclick="showAuthForms()">Use a different account</button>
      </div>

      <div id="forms-wrapper" style="display: none;">
      {{end}}

      <!-- Tab Switcher -->
      <div class="tab-group">
        <button type="button" class="tab-btn active" id="tab-login" onclick="switchTab('login')">Sign In</button>
        <button type="button" class="tab-btn" id="tab-register" onclick="switchTab('register')">Create Account</button>
      </div>

      <!-- Sign In Form -->
      <form method="POST" action="/oauth/authorize" class="form-pane active" id="pane-login">
        <input type="hidden" name="action" value="login">
        <input type="hidden" name="client_id" value="{{.ClientID}}">
        <input type="hidden" name="redirect_uri" value="{{.RedirectURI}}">
        <input type="hidden" name="response_type" value="{{.ResponseType}}">
        <input type="hidden" name="state" value="{{.State}}">
        <input type="hidden" name="code_challenge" value="{{.CodeChallenge}}">
        <input type="hidden" name="code_challenge_method" value="{{.CodeChallengeMethod}}">

        <div class="form-group">
          <label for="login">Username or Email</label>
          <input type="text" id="login" name="login" required autofocus placeholder="alex or alex@example.com">
        </div>

        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
            <label for="password" style="margin-bottom: 0;">Password</label>
            <a href="/forgot-password" style="font-size: 0.775rem; color: #a1a1aa; text-decoration: none;">Forgot password?</a>
          </div>
          <input type="password" id="password" name="password" required placeholder="••••••••">
        </div>

        <button type="submit" class="submit-btn">Authorize & Sign In</button>
      </form>

      <!-- Create Account Form -->
      <form method="POST" action="/oauth/authorize" class="form-pane" id="pane-register">
        <input type="hidden" name="action" value="register">
        <input type="hidden" name="client_id" value="{{.ClientID}}">
        <input type="hidden" name="redirect_uri" value="{{.RedirectURI}}">
        <input type="hidden" name="response_type" value="{{.ResponseType}}">
        <input type="hidden" name="state" value="{{.State}}">
        <input type="hidden" name="code_challenge" value="{{.CodeChallenge}}">
        <input type="hidden" name="code_challenge_method" value="{{.CodeChallengeMethod}}">

        <div class="form-group">
          <label for="reg_username">Username</label>
          <input type="text" id="reg_username" name="username" required placeholder="alex">
        </div>

        <div class="form-group">
          <label for="reg_display_name">Display Name</label>
          <input type="text" id="reg_display_name" name="display_name" placeholder="Alex">
        </div>

        <div class="form-group">
          <label for="reg_email">Email</label>
          <input type="email" id="reg_email" name="email" required placeholder="alex@example.com">
        </div>

        <div class="form-group">
          <label for="reg_password">Password</label>
          <input type="password" id="reg_password" name="password" required placeholder="At least 8 characters">
        </div>

        <button type="submit" class="submit-btn">Create Account & Authorize</button>
      </form>

      {{if .IsActiveSession}}
      </div>
      {{end}}

      <div class="footer">
        Concord OpenID Connect & OAuth 2.1
      </div>
    </div>
  </div>

  <script>
    function showAuthForms() {
      const ssoPane = document.getElementById('pane-sso');
      const formsWrapper = document.getElementById('forms-wrapper');
      if (ssoPane && formsWrapper) {
        ssoPane.style.display = 'none';
        formsWrapper.style.display = 'block';
      }
    }

    function switchTab(tab) {
      const loginTab = document.getElementById('tab-login');
      const regTab = document.getElementById('tab-register');
      const loginPane = document.getElementById('pane-login');
      const regPane = document.getElementById('pane-register');

      if (tab === 'register') {
        loginTab.classList.remove('active');
        regTab.classList.add('active');
        loginPane.classList.remove('active');
        regPane.classList.add('active');
      } else {
        regTab.classList.remove('active');
        loginTab.classList.add('active');
        regPane.classList.remove('active');
        loginPane.classList.add('active');
      }
    }
  </script>
</body>
</html>
`
