import { Component } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <section class="login-page">
      <div class="card">
        <h1>MyMOPH Back Office</h1>
        <p>เข้าสู่ระบบด้วย MyMOPH OAuth2 เท่านั้น</p>
        <button (click)="login()">Login with MyMOPH</button>
      </div>
    </section>
  `,
  styles: [
    `
    .login-page { min-height: 100vh; display: grid; place-items: center; padding: 20px; }
    .card {
      width: min(420px, 92vw);
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 16px;
      box-shadow: var(--shadow);
      padding: 28px;
      text-align: center;
    }
    h1 { margin: 0 0 6px; color: var(--brand-strong); }
    p { margin: 0 0 18px; color: var(--muted); }
    button {
      background: var(--brand);
      color: white;
      border: 0;
      border-radius: 10px;
      padding: 10px 14px;
      cursor: pointer;
      width: 100%;
      font-weight: 700;
    }
    `
  ]
})
export class LoginComponent {
  constructor(private readonly authService: AuthService) {}

  login(): void {
    this.authService.loginWithMyMoph();
  }
}
