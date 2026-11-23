package email

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

type Mailer struct {
	APIKey     string
	Sender     string
	LogoURL    string
	HTTPClient *http.Client
}

func loadDotEnvValue(key string) string {
	data, err := os.ReadFile(".env")
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, key+"=") {
			return strings.Trim(strings.TrimPrefix(line, key+"="), `"'`)
		}
	}
	return ""
}

func NewMailer(issuer string) *Mailer {
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		apiKey = loadDotEnvValue("RESEND_API_KEY")
	}
	sender := os.Getenv("EMAIL_FROM")
	if sender == "" {
		sender = loadDotEnvValue("EMAIL_FROM")
	}
	if sender == "" {
		sender = "Concord ID <id@dexx.systems>"
	}

	return &Mailer{
		APIKey:  apiKey,
		Sender:  sender,
		LogoURL: issuer + "/logo.png",
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

type resendPayload struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
	Text    string   `json:"text"`
}

func (m *Mailer) send(toEmail, subject, htmlContent, textContent string) error {
	payload := resendPayload{
		From:    m.Sender,
		To:      []string{toEmail},
		Subject: subject,
		HTML:    htmlContent,
		Text:    textContent,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.resend.com/emails", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "Bearer "+m.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Concord-ID/1.0")

	resp, err := m.HTTPClient.Do(req)
	if err != nil {
		log.Printf("⚠️ [Mailer] Failed to send email to %s: %v", toEmail, err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		log.Printf("⚠️ [Mailer] Resend API responded with status %d for %s: %s", resp.StatusCode, toEmail, string(respBody))
		return fmt.Errorf("resend api status: %d", resp.StatusCode)
	}

	log.Printf("✓ [Mailer] Successfully sent '%s' to %s", subject, toEmail)
	return nil
}

func (m *Mailer) renderEmailCard(title, bodyHTML, ctaLabel, ctaURL, footnoteHTML string) string {
	ctaSection := ""
	if ctaLabel != "" && ctaURL != "" {
		ctaSection = fmt.Sprintf(`
              <div style="text-align: center; margin: 24px 0;">
                <a href="%s" style="display: inline-block; background-color: #8b5cf6; color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 14px; padding: 13px 28px; border-radius: 10px; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);">%s</a>
              </div>`, ctaURL, ctaLabel)
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark light">
  <title>%s</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #f4f4f5; margin: 0; padding: 32px 16px; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="background-color: #09090b; width: 100%%;">
    <tr>
      <td align="center" style="padding: 16px 8px;">
        <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="max-width: 500px; width: 100%%; background-color: #121215; border: 1px solid #27272a; border-radius: 16px; padding: 32px;">
          <tr>
            <td style="text-align: center; padding-bottom: 24px;">
              <img src="%s" alt="Concord ID" width="48" height="48" style="display: block; margin: 0 auto 16px auto; width: 48px; height: 48px; border-radius: 12px; border: 0;">
              <h1 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0; letter-spacing: -0.02em;">%s</h1>
            </td>
          </tr>
          <tr>
            <td style="font-size: 14px; line-height: 1.6; color: #a1a1aa;">
              %s
              %s
              %s
            </td>
          </tr>
          <tr>
            <td style="font-size: 12px; color: #71717a; padding-top: 24px; margin-top: 24px; border-top: 1px solid #222227; text-align: center;">
              Concord ID &bull; Unified Identity &amp; Single Sign-On
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, html.EscapeString(title), m.LogoURL, html.EscapeString(title), bodyHTML, ctaSection, footnoteHTML)
}

func (m *Mailer) SendWelcomeEmail(toEmail, displayName, username, profileURL string) error {
	if displayName == "" {
		displayName = username
	}
	safeName := html.EscapeString(displayName)
	safeUser := html.EscapeString(username)

	subject := "Welcome to Concord ID"
	bodyHTML := fmt.Sprintf(`
              <p style="margin: 0 0 16px 0; color: #a1a1aa;">Hi <strong style="color: #fafafa;">%s</strong>,</p>
              <p style="margin: 0 0 16px 0; color: #a1a1aa;">Your Concord ID (<strong style="color: #fafafa;">@%s</strong>) is active. You can now use your account to sign in with 1 click across all Concord ecosystem apps, including CouchPotato and Concord Chat.</p>
              <p style="margin: 0 0 8px 0; color: #a1a1aa;">Manage your profile, avatar, and connected devices anytime:</p>`, safeName, safeUser)

	footnoteHTML := fmt.Sprintf(`
              <p style="font-size: 12px; color: #71717a; margin: 16px 0 0 0;">Direct link:<br><a href="%s" style="color: #8b5cf6; word-break: break-all;">%s</a></p>`, profileURL, profileURL)

	htmlContent := m.renderEmailCard("Welcome to Concord ID", bodyHTML, "Manage Your Profile", profileURL, footnoteHTML)
	textContent := fmt.Sprintf("Welcome to Concord ID!\n\nHi %s,\n\nYour Concord ID (@%s) is active. You can now use your account to sign in across all Concord ecosystem apps.\n\nManage your profile: %s\n", displayName, username, profileURL)

	return m.send(toEmail, subject, htmlContent, textContent)
}

func (m *Mailer) SendPasswordResetEmail(toEmail, displayName, resetURL string) error {
	safeName := html.EscapeString(displayName)
	subject := "Reset your Concord ID password"

	bodyHTML := fmt.Sprintf(`
              <p style="margin: 0 0 16px 0; color: #a1a1aa;">Hi <strong style="color: #fafafa;">%s</strong>,</p>
              <p style="margin: 0 0 16px 0; color: #a1a1aa;">We received a request to reset your Concord ID password. Click the button below to choose a new password. This link is valid for 1 hour.</p>`, safeName)

	footnoteHTML := fmt.Sprintf(`
              <p style="font-size: 12px; color: #71717a; margin: 0 0 12px 0;">If you did not request a password reset, you can safely ignore this email.</p>
              <p style="font-size: 12px; color: #71717a; margin: 0;">Direct link:<br><a href="%s" style="color: #8b5cf6; word-break: break-all;">%s</a></p>`, resetURL, resetURL)

	htmlContent := m.renderEmailCard("Reset Your Password", bodyHTML, "Reset Password", resetURL, footnoteHTML)
	textContent := fmt.Sprintf("Reset Your Concord ID Password\n\nHi %s,\n\nWe received a request to reset your Concord ID password. Open the link below to choose a new password (valid for 1 hour):\n\n%s\n\nIf you did not request this, you can safely ignore this email.\n", displayName, resetURL)

	return m.send(toEmail, subject, htmlContent, textContent)
}

func (m *Mailer) SendMagicLoginEmail(toEmail, displayName, magicURL string) error {
	safeName := html.EscapeString(displayName)
	subject := "Sign in to Concord ID on your new device"

	bodyHTML := fmt.Sprintf(`
              <p style="margin: 0 0 16px 0; color: #a1a1aa;">Hi <strong style="color: #fafafa;">%s</strong>,</p>
              <p style="margin: 0 0 16px 0; color: #a1a1aa;">Open this email on your laptop or other device and tap the button below to sign in immediately without typing your password:</p>`, safeName)

	footnoteHTML := fmt.Sprintf(`
              <p style="font-size: 12px; color: #71717a; margin: 0 0 12px 0;">This one-time link is valid for 20 minutes.</p>
              <p style="font-size: 12px; color: #71717a; margin: 0;">Direct link:<br><a href="%s" style="color: #8b5cf6; word-break: break-all;">%s</a></p>`, magicURL, magicURL)

	htmlContent := m.renderEmailCard("1-Click Device Sign In", bodyHTML, "Sign In to Concord ID", magicURL, footnoteHTML)
	textContent := fmt.Sprintf("1-Click Device Sign In — Concord ID\n\nHi %s,\n\nOpen this link on your laptop or new device to sign in immediately (valid for 20 minutes, single use):\n\n%s\n", displayName, magicURL)

	return m.send(toEmail, subject, htmlContent, textContent)
}

func (m *Mailer) SendPasswordChangedEmail(toEmail, displayName, profileURL string) error {
	safeName := html.EscapeString(displayName)
	subject := "Your Concord ID password was updated"

	bodyHTML := fmt.Sprintf(`
              <p style="margin: 0 0 16px 0; color: #a1a1aa;">Hi <strong style="color: #fafafa;">%s</strong>,</p>
              <p style="margin: 0 0 16px 0; color: #a1a1aa;">This is a confirmation that the password for your Concord ID account was just updated.</p>`, safeName)

	footnoteHTML := `
              <p style="font-size: 12px; color: #71717a; margin: 0;">If you made this change, no further action is needed. If you did not authorize this change, please reset your password immediately.</p>`

	htmlContent := m.renderEmailCard("Password Updated", bodyHTML, "Review Account Security", profileURL, footnoteHTML)
	textContent := fmt.Sprintf("Your Concord ID password was updated\n\nHi %s,\n\nThis is a confirmation that the password for your Concord ID account was just updated.\n\nReview your account security: %s\n", displayName, profileURL)

	return m.send(toEmail, subject, htmlContent, textContent)
}
