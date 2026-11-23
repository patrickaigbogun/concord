package ui

const ProfileTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Concord ID — Account Management</title>
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
      --accent: #8b5cf6;
      --accent-glow: rgba(139, 92, 246, 0.15);
      --danger-bg: rgba(239, 68, 68, 0.1);
      --danger-border: rgba(239, 68, 68, 0.25);
      --danger-text: #fca5a5;
      --success-bg: rgba(34, 197, 94, 0.1);
      --success-border: rgba(34, 197, 94, 0.25);
      --success-text: #86efac;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg);
      background-image: 
        radial-gradient(at 50% 0%, rgba(139, 92, 246, 0.08) 0%, transparent 60%),
        radial-gradient(at 100% 100%, rgba(59, 130, 246, 0.04) 0%, transparent 50%);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2.5rem 1rem;
      -webkit-font-smoothing: antialiased;
    }

    .container {
      width: 100%;
      max-width: 620px;
    }

    .nav-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 2rem;
      width: 100%;
    }

    .logo-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
      color: var(--text);
    }

    .logo-badge {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: #18181c;
      border: 1px solid var(--card-border);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }

    .logo-badge svg {
      width: 22px;
      height: 22px;
    }

    .brand-name {
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .sign-out-btn {
      background: transparent;
      border: 1px solid var(--card-border);
      color: var(--text-muted);
      padding: 0.45rem 0.95rem;
      border-radius: 9px;
      font-size: 0.8rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.15s ease;
      cursor: pointer;
    }

    .sign-out-btn:hover {
      background: #18181c;
      color: var(--text);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 2rem;
      box-shadow: 
        0 0 0 1px rgba(255, 255, 255, 0.02),
        0 20px 40px -15px rgba(0, 0, 0, 0.7);
      margin-bottom: 1.5rem;
    }

    .banner {
      padding: 0.75rem 1rem;
      border-radius: 11px;
      font-size: 0.85rem;
      font-weight: 500;
      margin-bottom: 1.5rem;
      text-align: center;
    }
    .banner.error {
      background: var(--danger-bg);
      border: 1px solid var(--danger-border);
      color: var(--danger-text);
    }
    .banner.success {
      background: var(--success-bg);
      border: 1px solid var(--success-border);
      color: var(--success-text);
    }

    /* User Profile Hero */
    .profile-hero {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      padding-bottom: 1.75rem;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 1.75rem;
    }

    .avatar-wrapper {
      position: relative;
    }

    .avatar {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1.8rem;
      color: #fff;
      overflow: hidden;
      border: 2px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 4px 16px rgba(139, 92, 246, 0.25);
    }

    .avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .hero-meta {
      flex: 1;
      min-width: 0;
    }

    .display-name {
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--text);
      letter-spacing: -0.02em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .handle-line {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.25rem;
    }

    .handle {
      font-size: 0.875rem;
      color: var(--accent);
      font-weight: 600;
    }

    .email-badge {
      font-size: 0.75rem;
      color: var(--text-muted);
      background: rgba(255, 255, 255, 0.05);
      padding: 0.15rem 0.5rem;
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .section-title {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .section-desc {
      font-size: 0.825rem;
      color: var(--text-muted);
      margin-top: -0.5rem;
      margin-bottom: 1.25rem;
      line-height: 1.5;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }

    .form-group {
      margin-bottom: 1.15rem;
    }

    .form-group.full-width {
      grid-column: 1 / -1;
    }

    label {
      display: block;
      font-size: 0.775rem;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 0.4rem;
    }

    input, textarea {
      width: 100%;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: 11px;
      padding: 0.75rem 0.95rem;
      font-size: 0.875rem;
      color: var(--text);
      outline: none;
      font-family: inherit;
      transition: all 0.15s ease;
    }

    input:focus, textarea:focus {
      border-color: var(--input-focus);
      background: #1c1c22;
      box-shadow: 0 0 0 1px var(--input-focus);
    }

    textarea {
      resize: vertical;
      min-height: 70px;
    }

    .btn-primary {
      background: var(--primary);
      color: var(--primary-text);
      font-family: inherit;
      font-size: 0.85rem;
      font-weight: 600;
      border: none;
      border-radius: 10px;
      padding: 0.75rem 1.25rem;
      cursor: pointer;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    .btn-primary:hover {
      background: var(--primary-hover);
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text);
      border: 1px solid var(--card-border);
      font-family: inherit;
      font-size: 0.85rem;
      font-weight: 600;
      border-radius: 10px;
      padding: 0.75rem 1.25rem;
      cursor: pointer;
      transition: all 0.15s ease;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.15);
    }

    /* Cross-Device / Laptop Connect Box */
    .cross-device-box {
      background: #15151a;
      border: 1px solid rgba(139, 92, 246, 0.25);
      border-radius: 14px;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
    }

    .cross-device-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 0.35rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .cross-device-desc {
      font-size: 0.825rem;
      color: var(--text-muted);
      line-height: 1.45;
      margin-bottom: 1rem;
    }

    .link-copy-group {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }

    .link-input {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.8rem;
      color: var(--accent);
      background: #0d0d10;
      padding: 0.65rem 0.85rem;
      border-radius: 9px;
      border: 1px solid var(--card-border);
      flex: 1;
    }

    .copy-btn {
      background: #27272a;
      color: var(--text);
      border: 1px solid var(--card-border);
      border-radius: 9px;
      padding: 0.65rem 1rem;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .copy-btn:hover {
      background: #3f3f46;
    }

    .info-list {
      list-style: none;
      font-size: 0.825rem;
      color: var(--text-muted);
      line-height: 1.8;
      margin-bottom: 1.25rem;
    }

    .info-list b {
      color: var(--text);
      font-weight: 600;
    }

    .footer {
      text-align: center;
      font-size: 0.75rem;
      color: var(--text-dim);
      margin-top: 1rem;
      letter-spacing: 0.02em;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="nav-bar">
      <a href="/profile" class="logo-group">
        <div class="logo-badge">
          <svg viewBox="0 0 100 100" fill="none">
            <path d="M 68 22 A 38 38 0 1 0 68 78" stroke="#8b5cf6" stroke-width="12" stroke-linecap="round"/>
            <circle cx="50" cy="50" r="16" stroke="#8b5cf6" stroke-width="10"/>
          </svg>
        </div>
        <span class="brand-name">Concord ID</span>
      </a>

      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <a href="/docs" class="sign-out-btn" style="border: none;">Docs</a>
        <a href="/logout" class="sign-out-btn">Sign Out</a>
      </div>
    </div>

    {{if .Error}}
    <div class="banner error">{{.Error}}</div>
    {{end}}
    {{if .Success}}
    <div class="banner success">{{.Success}}</div>
    {{end}}

    <!-- Card 1: User Profile -->
    <div class="card">
      <div class="profile-hero">
        <div class="avatar-wrapper">
          <div class="avatar">
            {{if .User.AvatarURL}}
            <img src="{{.User.AvatarURL}}" alt="{{.User.DisplayName}}">
            {{else}}
            {{printf "%.1s" .User.DisplayName}}
            {{end}}
          </div>
        </div>
        <div class="hero-meta">
          <div class="display-name">{{.User.DisplayName}}</div>
          <div class="handle-line">
            <span class="handle">@{{.User.Username}}</span>
            <span class="email-badge">{{.User.Email}}</span>
          </div>
        </div>
      </div>

      <div class="section-title">Edit Profile</div>
      <div class="section-desc">Update how your identity appears across Concord services.</div>

      <form method="POST" action="/profile" enctype="multipart/form-data">
        <input type="hidden" name="action" value="update_profile">
        
        <div class="form-grid">
          <div class="form-group">
            <label for="display_name">Display Name</label>
            <input type="text" id="display_name" name="display_name" value="{{.User.DisplayName}}" required>
          </div>
          <div class="form-group">
            <label for="username">Username (Permanent)</label>
            <input type="text" id="username" value="{{.User.Username}}" disabled style="opacity: 0.6; cursor: not-allowed;">
          </div>
        </div>

        <div class="form-group">
          <label for="avatar_file">Profile Picture (Upload Image or Paste URL)</label>
          <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
            <label for="avatar_file" class="btn-secondary" style="margin: 0; cursor: pointer; white-space: nowrap;">
              Choose Photo
            </label>
            <input type="file" id="avatar_file" name="avatar_file" accept="image/png,image/jpeg,image/webp,image/gif" style="display: none;" onchange="previewAvatarFile(this)">
            <input type="url" id="avatar_url" name="avatar_url" value="{{.User.AvatarURL}}" placeholder="Or paste image URL (https://...)" style="flex: 1; min-width: 200px;">
          </div>
          <div id="avatar_file_name" style="font-size: 0.75rem; color: var(--accent); margin-top: 0.35rem; display: none;"></div>
        </div>

        <div class="form-group">
          <label for="bio">Bio</label>
          <textarea id="bio" name="bio" placeholder="Tell us a bit about yourself...">{{.User.Bio}}</textarea>
        </div>

        <button type="submit" class="btn-primary">Save Changes</button>
      </form>
    </div>

    <!-- Card 2: Cross-Device / Laptop Sign-In -->
    <div class="card">
      <div class="section-title">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent);"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
        Sign in on your Laptop or another Device
      </div>
      <div class="section-desc">
        Access this same Concord account on your laptop without needing to re-enter your password.
      </div>

      <div class="cross-device-box">
        <div class="cross-device-title">Email 1-Click Login Link</div>
        <div class="cross-device-desc">
          Click below to send a secure, one-time instant login link to <b>{{.User.Email}}</b>. Open your inbox on your laptop and click the link to log straight in.
        </div>
        <form method="POST" action="/send-magic-link">
          <button type="submit" class="btn-primary" style="background: #8b5cf6; color: #fff;">
            Send Login Link to {{.User.Email}}
          </button>
        </form>

        {{if .MagicLink}}
        <div style="margin-top: 1.25rem; border-top: 1px solid var(--card-border); padding-top: 1rem;">
          <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0.35rem;">Or open / paste this link directly into your laptop browser:</div>
          <div class="link-copy-group">
            <input type="text" readonly value="{{.MagicLink}}" class="link-input" id="magicLinkInput">
            <button type="button" class="copy-btn" onclick="copyMagicLink()">Copy</button>
          </div>
        </div>
        {{end}}
      </div>
    </div>

    <!-- Card 3: Security & Password -->
    <div class="card">
      <div class="section-title">Security & Password</div>
      <div class="section-desc">Change your password or manage active sign-in sessions.</div>

      <form method="POST" action="/profile">
        <input type="hidden" name="action" value="change_password">

        <div class="form-group">
          <label for="current_password">Current Password</label>
          <input type="password" id="current_password" name="current_password" required placeholder="••••••••">
        </div>

        <div class="form-grid">
          <div class="form-group">
            <label for="new_password">New Password</label>
            <input type="password" id="new_password" name="new_password" required placeholder="At least 8 characters">
          </div>
          <div class="form-group">
            <label for="confirm_password">Confirm New Password</label>
            <input type="password" id="confirm_password" name="confirm_password" required placeholder="Repeat new password">
          </div>
        </div>

        <button type="submit" class="btn-primary">Update Password</button>
      </form>

      <div style="margin-top: 1.75rem; border-top: 1px solid var(--card-border); padding-top: 1.5rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="font-size: 0.875rem; font-weight: 600; color: var(--text);">Active Sessions</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">Currently signed in on <b>{{.ActiveSessionsCount}}</b> device(s).</div>
          </div>
          <form method="POST" action="/logout">
            <input type="hidden" name="all" value="true">
            <button type="submit" class="btn-secondary" style="color: var(--danger-text); border-color: var(--danger-border);">Sign Out Everywhere</button>
          </form>
        </div>
      </div>
    </div>

    <div class="footer">
      Concord ID &bull; OpenID Connect 2.1 Provider
    </div>
  </div>

  <script>
    function copyMagicLink() {
      const input = document.getElementById('magicLinkInput');
      if (input) {
        input.select();
        navigator.clipboard.writeText(input.value);
        const btn = event.target;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
      }
    }

    function previewAvatarFile(input) {
      const label = document.getElementById('avatar_file_name');
      if (input.files && input.files[0]) {
        const file = input.files[0];
        if (label) {
          label.textContent = 'Selected: ' + file.name + ' (click Save Changes to upload)';
          label.style.display = 'block';
        }
        const reader = new FileReader();
        reader.onload = function(e) {
          const avatarBox = document.querySelector('.avatar');
          if (avatarBox) {
            avatarBox.innerHTML = '<img src="' + e.target.result + '" alt="Preview">';
          }
        };
        reader.readAsDataURL(file);
      }
    }
  </script>
</body>
</html>
`

const ForgotPasswordTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password — Concord ID</title>
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
      --accent: #8b5cf6;
      --danger-bg: rgba(239, 68, 68, 0.1);
      --danger-border: rgba(239, 68, 68, 0.25);
      --danger-text: #fca5a5;
      --success-bg: rgba(34, 197, 94, 0.1);
      --success-border: rgba(34, 197, 94, 0.25);
      --success-text: #86efac;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg);
      background-image: radial-gradient(at 50% 0%, rgba(139, 92, 246, 0.08) 0%, transparent 60%);
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
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7);
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
    }

    .logo-badge svg {
      width: 26px;
      height: 26px;
    }

    .title {
      font-size: 1.35rem;
      font-weight: 700;
      letter-spacing: -0.025em;
    }

    .subtitle {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 0.35rem;
      line-height: 1.4;
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
      margin-top: 0.5rem;
      transition: all 0.15s ease;
    }

    .submit-btn:hover {
      background: var(--primary-hover);
      transform: translateY(-1px);
    }

    .back-link {
      display: block;
      text-align: center;
      font-size: 0.825rem;
      color: var(--text-muted);
      text-decoration: none;
      margin-top: 1.25rem;
      transition: color 0.15s ease;
    }

    .back-link:hover {
      color: var(--text);
    }

    .banner {
      padding: 0.65rem 0.85rem;
      border-radius: 10px;
      font-size: 0.8rem;
      font-weight: 500;
      margin-bottom: 1.25rem;
      text-align: center;
    }
    .banner.error {
      background: var(--danger-bg);
      border: 1px solid var(--danger-border);
      color: var(--danger-text);
    }
    .banner.success {
      background: var(--success-bg);
      border: 1px solid var(--success-border);
      color: var(--success-text);
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
        <div class="title">Reset Password</div>
        <div class="subtitle">Enter your username or email and we will send you a link to reset your password.</div>
      </div>

      {{if .Error}}
      <div class="banner error">{{.Error}}</div>
      {{end}}
      {{if .Success}}
      <div class="banner success">{{.Success}}</div>
      {{end}}

      <form method="POST" action="/forgot-password">
        <div class="form-group">
          <label for="identifier">Username or Email</label>
          <input type="text" id="identifier" name="identifier" required autofocus placeholder="alex or alex@example.com">
        </div>

        <button type="submit" class="submit-btn">Send Reset Link</button>
      </form>

      <a href="/profile" class="back-link">Return to Sign In</a>
    </div>
  </div>
</body>
</html>
`

const ResetPasswordTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Set New Password — Concord ID</title>
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
      background-image: radial-gradient(at 50% 0%, rgba(139, 92, 246, 0.08) 0%, transparent 60%);
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
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.7);
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
    }

    .logo-badge svg {
      width: 26px;
      height: 26px;
    }

    .title {
      font-size: 1.35rem;
      font-weight: 700;
      letter-spacing: -0.025em;
    }

    .subtitle {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 0.35rem;
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
      margin-top: 0.5rem;
      transition: all 0.15s ease;
    }

    .submit-btn:hover {
      background: var(--primary-hover);
      transform: translateY(-1px);
    }

    .banner.error {
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
        <div class="title">Create New Password</div>
        <div class="subtitle">Please enter your new password below.</div>
      </div>

      {{if .Error}}
      <div class="banner error">{{.Error}}</div>
      {{end}}

      <form method="POST" action="/reset-password">
        <input type="hidden" name="token" value="{{.Token}}">

        <div class="form-group">
          <label for="password">New Password</label>
          <input type="password" id="password" name="password" required autofocus placeholder="At least 8 characters">
        </div>

        <div class="form-group">
          <label for="confirm_password">Confirm New Password</label>
          <input type="password" id="confirm_password" name="confirm_password" required placeholder="Repeat new password">
        </div>

        <button type="submit" class="submit-btn">Update Password & Sign In</button>
      </form>
    </div>
  </div>
</body>
</html>
`
