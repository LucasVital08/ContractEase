# Email Templates "Emerald Dark" - ContractEase

Estes templates são a tradução exata da UI do sistema: Fundo #0A0A0A, acentos em Emerald (#10B981) e tipografia Bricolage.

## 1. Confirm Signup (Confirmação de Cadastro)
**Assunto:** Ative sua conta no ContractEase

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700&family=Inter:wght@400;500&display=swap');
    
    body { font-family: 'Inter', sans-serif; background-color: #000000; margin: 0; padding: 48px 20px; color: #ffffff; }
    .email-wrapper { max-width: 500px; margin: 0 auto; }
    .card { background: #0a0a0a; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 24px; padding: 48px; text-align: center; }
    
    .logo { font-family: 'Bricolage Grotesque', sans-serif; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -1px; margin-bottom: 48px; }
    
    h1 { font-family: 'Bricolage Grotesque', sans-serif; color: #ffffff; font-size: 28px; font-weight: 700; line-height: 1.2; margin-bottom: 20px; letter-spacing: -0.5px; }
    p { color: #a3a3a3; font-size: 16px; line-height: 1.6; margin-bottom: 32px; }
    
    .btn-emerald { 
      display: inline-block; 
      background-color: #10b981; 
      color: #000000 !important; 
      padding: 14px 32px; 
      border-radius: 12px; 
      text-decoration: none; 
      font-weight: 700; 
      font-size: 15px;
      box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.2);
    }
    
    .footer { text-align: center; margin-top: 40px; color: #525252; font-size: 12px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="card">
      <div class="logo">ContractEase</div>
      <h1>Sua jornada começa aqui</h1>
      <p>Estamos prontos para levar seus contratos para a segurança da blockchain. Clique no botão abaixo para validar seu e-mail e acessar o painel:</p>
      
      <a href="{{ .ConfirmationURL }}" class="btn-emerald">Verificar minha conta</a>
      
      <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid rgba(255, 255, 255, 0.05);">
        <p style="font-size: 13px; color: #525252; margin-bottom: 0;">Tecnologia Stellar &bull; AbacatePay Secured</p>
      </div>
    </div>
    <div class="footer">
      &copy; 2026 ContractEase &bull; São Paulo, BR
    </div>
  </div>
</body>
</html>
```

## 2. Reset Password (Recuperação de Senha)
**Assunto:** Redefinir sua senha

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@700&family=Inter:wght@400;500&display=swap');
    body { font-family: 'Inter', sans-serif; background-color: #000000; margin: 0; padding: 48px 20px; color: #ffffff; }
    .card { background: #0a0a0a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 28px; padding: 48px; max-width: 460px; margin: 0 auto; text-align: center; }
    .logo { font-family: 'Bricolage Grotesque'; font-size: 20px; color: #10b981; margin-bottom: 32px; font-weight: 700; }
    h2 { font-family: 'Bricolage Grotesque'; color: #ffffff; font-size: 24px; margin-bottom: 16px; }
    .btn { background: #ffffff; color: #000000 !important; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700; display: inline-block; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">ContractEase</div>
    <h2>Nova credencial</h2>
    <p style="color: #a3a3a3; font-size: 15px;">Para sua segurança, clique no botão abaixo para redefinir a senha da sua conta:</p>
    <div style="margin: 32px 0;">
      <a href="{{ .ConfirmationURL }}" class="btn">Alterar Senha</a>
    </div>
    <p style="font-size: 12px; color: #525252;">O link de segurança expirará em breve.</p>
  </div>
</body>
</html>
```
