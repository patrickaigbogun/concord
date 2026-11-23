package ui

const DocsTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Concord ID — Developer Documentation & API Reference</title>
  <meta name="description" content="Official developer documentation for Concord ID, OpenID Connect & OAuth 2.1 authentication platform.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090a0f;
      --card-bg: #11131c;
      --card-border: rgba(255, 255, 255, 0.08);
      --accent: #6366f1;
      --accent-hover: #4f46e5;
      --accent-light: rgba(99, 102, 241, 0.12);
      --text: #f4f4f6;
      --text-muted: #9ca3af;
      --code-bg: #07080b;
      --method-get: #10b981;
      --method-post: #6366f1;
      --sidebar-w: 280px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.65;
      display: flex;
      min-height: 100vh;
    }

    /* Sidebar */
    aside {
      width: var(--sidebar-w);
      background: rgba(13, 15, 23, 0.95);
      border-right: 1px solid var(--card-border);
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      overflow-y: auto;
      padding: 2rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
      z-index: 50;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
      color: var(--text);
    }
    .brand-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: #18181c;
      border: 1px solid var(--card-border);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }
    .brand-icon svg {
      width: 22px;
      height: 22px;
    }
    .brand-text {
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .nav-group {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    .nav-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #6b7280;
      font-weight: 700;
      margin-bottom: 0.375rem;
    }
    .nav-link {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.875rem;
      padding: 0.45rem 0.65rem;
      border-radius: 0.5rem;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .nav-link:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.04);
    }

    /* Main Content */
    main {
      margin-left: var(--sidebar-w);
      flex: 1;
      padding: 3rem 4rem;
      max-width: 1020px;
    }
    header {
      margin-bottom: 3.5rem;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 2.5rem;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      background: var(--accent-light);
      color: #a5b4fc;
      border: 1px solid rgba(99, 102, 241, 0.25);
      margin-bottom: 1rem;
    }
    .badge::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
    }
    h1 {
      font-size: 2.5rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.2;
      margin-bottom: 0.75rem;
    }
    .subtitle {
      font-size: 1.125rem;
      color: var(--text-muted);
      max-width: 720px;
    }

    /* Section Styling */
    section {
      margin-bottom: 4rem;
    }
    h2 {
      font-size: 1.65rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    p {
      color: #d1d5db;
      font-size: 0.975rem;
      margin-bottom: 1.25rem;
    }
    ul, ol {
      margin-bottom: 1.25rem;
      padding-left: 1.5rem;
      color: #d1d5db;
      font-size: 0.95rem;
    }
    li { margin-bottom: 0.35rem; }

    /* Endpoint Badge */
    .endpoint {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.75rem;
      padding: 0.75rem 1rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }
    .method {
      font-weight: 700;
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      border-radius: 0.375rem;
      text-transform: uppercase;
    }
    .method.get { background: rgba(16, 185, 129, 0.15); color: var(--method-get); }
    .method.post { background: rgba(99, 102, 241, 0.15); color: var(--method-post); }
    .endpoint-path { color: #f3f4f6; }

    /* Code Blocks */
    pre {
      background: var(--code-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.875rem;
      padding: 1.25rem;
      overflow-x: auto;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      color: #e5e7eb;
      line-height: 1.6;
      margin-bottom: 1.5rem;
      position: relative;
    }
    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85em;
      color: #c7d2fe;
      background: rgba(99, 102, 241, 0.08);
      padding: 0.15rem 0.35rem;
      border-radius: 0.3rem;
    }
    pre code {
      background: none;
      padding: 0;
      color: inherit;
    }

    /* Cards */
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 1rem;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .card h3 {
      font-size: 1.1rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    /* Table */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1.5rem;
      font-size: 0.9rem;
    }
    th, td {
      text-align: left;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--card-border);
    }
    th {
      color: var(--text-muted);
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    td code { color: #818cf8; }

    @media (max-width: 860px) {
      aside { display: none; }
      main { margin-left: 0; padding: 2rem 1.25rem; }
      h1 { font-size: 2rem; }
    }
  </style>
</head>
<body>

  <!-- Sidebar -->
  <aside>
    <a href="/docs" class="brand">
      <div class="brand-icon">
        <svg viewBox="0 0 100 100" fill="none">
          <path d="M 68 22 A 38 38 0 1 0 68 78" stroke="#8b5cf6" stroke-width="12" stroke-linecap="round"/>
          <circle cx="50" cy="50" r="16" stroke="#8b5cf6" stroke-width="10"/>
        </svg>
      </div>
      <div class="brand-text">Concord ID</div>
    </a>

    <div class="nav-group">
      <div class="nav-label">Getting Started</div>
      <a href="#overview" class="nav-link">Overview</a>
      <a href="#discovery" class="nav-link">OIDC Discovery</a>
      <a href="#jwks" class="nav-link">JWKS Public Keys</a>
    </div>

    <div class="nav-group">
      <div class="nav-label">Integration</div>
      <a href="#registration" class="nav-link">Client Registration</a>
      <a href="#pkce" class="nav-link">OAuth 2.1 + PKCE Flow</a>
      <a href="#token" class="nav-link">Token Exchange</a>
      <a href="#verification" class="nav-link">Token Verification</a>
      <a href="#userinfo" class="nav-link">User Information</a>
    </div>

    <div class="nav-group">
      <div class="nav-label">Direct APIs</div>
      <a href="#direct-auth" class="nav-link">First-Party Auth</a>
      <a href="#health" class="nav-link">Health Check</a>
    </div>
  </aside>

  <!-- Main Content -->
  <main>
    <header>
      <div class="badge">OpenID Connect & OAuth 2.1 Provider</div>
      <h1>Concord ID Documentation</h1>
      <p class="subtitle">Official specification and developer reference for integrating client applications and resource servers with Concord Identity.</p>
    </header>

    <!-- Overview -->
    <section id="overview">
      <h2>1. Overview & Architecture</h2>
      <p><b>Concord ID</b> is a contract-first, high-throughput Identity Provider (IdP) built to power authentication and single sign-on across the Concord ecosystem, client applications, and autonomous agents.</p>
      
      <div class="card">
        <h3>Core Specifications</h3>
        <ul>
          <li><b>Standard:</b> OpenID Connect Core 1.0 & OAuth 2.1 (RFC 6749, RFC 7636).</li>
          <li><b>Security:</b> Strict PKCE (Proof Key for Code Exchange) with SHA-256 challenges (<code>S256</code>). Client secrets are optional for public/native clients.</li>
          <li><b>Token Format:</b> Cryptographically signed JSON Web Tokens (JWT) using <b>RS256</b> (RSA 2048-bit keypairs).</li>
          <li><b>Zero-Lookup Verification:</b> Resource servers verify tokens locally via the public JWKS without contacting the database.</li>
          <li><b>Base Issuer:</b> <code>{{.Issuer}}</code></li>
        </ul>
      </div>
    </section>

    <!-- Discovery -->
    <section id="discovery">
      <h2>2. OpenID Connect Discovery</h2>
      <p>Standard OIDC discovery document listing supported endpoints, signing algorithms, and claim scopes.</p>
      
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="endpoint-path">{{.Issuer}}/.well-known/openid-configuration</span>
      </div>

      <pre><code>curl -s {{.Issuer}}/.well-known/openid-configuration</code></pre>

      <p><b>Example Response:</b></p>
      <pre><code>{
  "issuer": "{{.Issuer}}",
  "authorization_endpoint": "{{.Issuer}}/oauth/authorize",
  "token_endpoint": "{{.Issuer}}/oauth/token",
  "userinfo_endpoint": "{{.Issuer}}/oauth/userinfo",
  "jwks_uri": "{{.Issuer}}/.well-known/jwks.json",
  "registration_endpoint": "{{.Issuer}}/oauth/register",
  "response_types_supported": ["code"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "scopes_supported": ["openid", "profile", "email"],
  "code_challenge_methods_supported": ["S256", "plain"]
}</code></pre>
    </section>

    <!-- JWKS -->
    <section id="jwks">
      <h2>3. JSON Web Key Set (JWKS)</h2>
      <p>Public cryptographic keys used by resource servers (Chat, Storage, CouchPotato, third-party backends) to verify JWT access tokens locally with zero network roundtrips.</p>

      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="endpoint-path">{{.Issuer}}/.well-known/jwks.json</span>
      </div>

      <pre><code>curl -s {{.Issuer}}/.well-known/jwks.json</code></pre>
    </section>

    <!-- Client Registration -->
    <section id="registration">
      <h2>4. Dynamic Client Registration (RFC 7591)</h2>
      <p>Applications, autonomous agents, and third-party services dynamically register an OAuth 2.1 client to obtain a <code>client_id</code>.</p>

      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="endpoint-path">{{.Issuer}}/oauth/register</span>
      </div>

      <pre><code>curl -X POST {{.Issuer}}/oauth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Client App",
    "redirect_uris": "https://example.com/callback,http://localhost:3000/callback",
    "is_public": true
  }'</code></pre>

      <p><b>Registration Response:</b></p>
      <pre><code>{
  "client_id": "concord_80bb78c2-830",
  "name": "My Client App",
  "redirect_uris": "https://example.com/callback,http://localhost:3000/callback",
  "is_public": true,
  "created_at": "2026-11-09T21:08:23Z"
}</code></pre>
    </section>

    <!-- PKCE Flow -->
    <section id="pkce">
      <h2>5. OAuth 2.1 Authorization Code + PKCE Flow</h2>
      <p>The recommended, secure flow for SPAs, mobile applications, and web clients.</p>

      <div class="card">
        <h3>Step 1: Generate PKCE Pair</h3>
        <p>Generate a high-entropy cryptographic random string (<code>code_verifier</code>), then compute its SHA-256 base64url hash (<code>code_challenge</code>):</p>
        <pre><code>// Example JavaScript / TypeScript
const verifier = generateRandomString(64);
const challenge = base64Url(sha256(verifier));</code></pre>
      </div>

      <div class="card">
        <h3>Step 2: Redirect User to Authorize</h3>
        <div class="endpoint">
          <span class="method get">GET</span>
          <span class="endpoint-path">{{.Issuer}}/oauth/authorize</span>
        </div>
        <p>Redirect the user's browser to Concord ID:</p>
        <pre><code>{{.Issuer}}/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_CALLBACK_URL&response_type=code&code_challenge=CODE_CHALLENGE&code_challenge_method=S256&state=RANDOM_STATE</code></pre>
      </div>
    </section>

    <!-- Token Exchange -->
    <section id="token">
      <h2>6. Token Exchange</h2>
      <p>After the user approves access, Concord ID redirects back to your <code>redirect_uri</code> with <code>?code=...&state=...</code>. Your client exchanges the code for tokens:</p>

      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="endpoint-path">{{.Issuer}}/oauth/token</span>
      </div>

      <pre><code>curl -X POST {{.Issuer}}/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "code=AUTHORIZATION_CODE" \
  -d "code_verifier=ORIGINAL_CODE_VERIFIER"</code></pre>

      <p><b>Token Response:</b></p>
      <pre><code>{
  "access_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "refresh_token": "rt_94bf01...",
  "scope": "openid profile email",
  "user": {
    "id": "c13840e2-...",
    "username": "alex",
    "display_name": "Alex",
    "email": "alex@example.com"
  }
}</code></pre>
    </section>

    <!-- Token Verification -->
    <section id="verification">
      <h2>7. Verifying Tokens on Resource Servers</h2>
      <p>Downstream API servers (Chat, Storage, Microservices) accept <code>Authorization: Bearer &lt;token&gt;</code> and verify the cryptographic signature locally against Concord ID's public JWKS key.</p>

      <div class="card">
        <h3>Verification Rules</h3>
        <ul>
          <li>Algorithm must match <code>RS256</code>.</li>
          <li>Key ID (<code>kid</code>) in header must match the active key from <code>{{.Issuer}}/.well-known/jwks.json</code>.</li>
          <li>Issuer (<code>iss</code>) must equal <code>{{.Issuer}}</code>.</li>
          <li>Expiry (<code>exp</code>) must be in the future.</li>
        </ul>
      </div>
    </section>

    <!-- User Information -->
    <section id="userinfo">
      <h2>8. User Information (Claims)</h2>
      <p>Retrieve the authenticated user's profile claims using their Bearer token.</p>

      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="endpoint-path">{{.Issuer}}/oauth/userinfo</span>
      </div>

      <pre><code>curl -s {{.Issuer}}/oauth/userinfo \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"</code></pre>

      <p><b>Claims Response:</b></p>
      <pre><code>{
  "sub": "c13840e2-7634-4bc9-a51b-71512dbb5059",
  "preferred_username": "alex",
  "name": "Alex",
  "email": "alex@example.com",
  "picture": "https://..."
}</code></pre>
    </section>

    <!-- Direct APIs -->
    <section id="direct-auth">
      <h2>9. First-Party Direct Auth APIs</h2>
      <p>For native mobile or first-party Concord applications that authenticate directly without browser redirects.</p>

      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><span class="method post">POST</span></td>
            <td><code>/api/v1/auth/register</code></td>
            <td>Direct user signup (username, email, password)</td>
          </tr>
          <tr>
            <td><span class="method post">POST</span></td>
            <td><code>/api/v1/auth/login</code></td>
            <td>Direct user login (credentials to JWT)</td>
          </tr>
          <tr>
            <td><span class="method get">GET</span></td>
            <td><code>/api/v1/auth/me</code></td>
            <td>Current authenticated user profile</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- Health -->
    <section id="health">
      <h2>10. Service Health</h2>
      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="endpoint-path">{{.Issuer}}/health</span>
      </div>
      <pre><code>curl -s {{.Issuer}}/health</code></pre>
    </section>
  </main>
</body>
</html>
`
