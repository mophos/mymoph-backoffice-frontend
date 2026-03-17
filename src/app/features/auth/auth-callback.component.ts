import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: `
    <section class="callback">
      <p>กำลังยืนยันตัวตน...</p>
    </section>
  `,
  styles: ['.callback { min-height: 100vh; display: grid; place-items: center; }']
})
export class AuthCallbackComponent {
  constructor(private readonly authService: AuthService, private readonly router: Router) {
    this.authService.handleCallback().subscribe((ok) => {
      this.router.navigate([ok ? '/attendance' : '/login']);
    });
  }
}
