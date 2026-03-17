import { Component } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  template: `
    <div class="state">
      <h2>403 - Forbidden</h2>
      <p>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      <button (click)="logout()">Logout</button>
    </div>
  `,
  styles: [`
    :host {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 16px;
    }
    .state {
      padding: 22px;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 12px;
      display: grid;
      gap: 12px;
      max-width: 420px;
      text-align: center;
      justify-items: center;
    }
    button {
      border: 0;
      background: var(--brand);
      color: #fff;
      border-radius: 8px;
      padding: 10px 12px;
      cursor: pointer;
      width: 140px;
    }
  `]
})
export class UnauthorizedComponent {
  constructor(private readonly authService: AuthService) {}

  logout(): void {
    this.authService.logout();
  }
}
