import { Component } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar.component';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NgIf, AsyncPipe],
  template: `
    <div class="shell" *ngIf="authService.user$ | async as user">
      <app-sidebar [userName]="user.displayName || user.cid" [menus]="user.menus" />
      <main class="content">
        <header class="topbar">
          <div>
            <h1>MyMOPH Back Office</h1>
            <p>{{ user.roles.join(', ') || 'No role' }} | Scope: {{ user.scopeType === 'ALL' ? 'ALL' : user.hospcodes.join(', ') }}</p>
          </div>
        </header>

        <section class="page">
          <router-outlet />
        </section>
      </main>
    </div>
  `,
  styles: [
    `
    .shell { display: grid; grid-template-columns: clamp(300px, 26vw, 360px) 1fr; min-height: 100vh; }
    .content { padding: 18px 24px; }
    .topbar { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 12px 18px; box-shadow: var(--shadow); }
    .topbar h1 { margin: 0; font-size: 1.2rem; }
    .topbar p { margin: 4px 0 0; color: var(--muted); font-size: 0.9rem; }
    .page { margin-top: 16px; }

    @media (max-width: 900px) {
      .shell { grid-template-columns: 1fr; }
      .content { padding: 12px; }
    }
    `
  ]
})
export class ShellComponent {
  constructor(public readonly authService: AuthService) {}
}
