import { Component, Input } from '@angular/core';
import { NgFor } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { MenuItem } from '../core/models/auth.models';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [NgFor, RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar">
      <div class="brand">
        <div class="logo">MY</div>
        <div>
          <div class="title">MyMOPH Back Office</div>
          <div class="subtitle">{{ userName }}</div>
        </div>
      </div>

      <nav>
        <a
          *ngFor="let menu of menus"
          [routerLink]="menu.path"
          routerLinkActive="active"
          class="menu-item"
        >
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path [attr.d]="iconPath(menu.icon)" fill="currentColor"></path>
          </svg>
          <span>{{ menu.label }}</span>
        </a>
      </nav>

      <button class="logout" (click)="logout()">Logout</button>
    </aside>
  `,
  styles: [
    `
    .sidebar {
      background: linear-gradient(160deg, #0b4f4a, #136a63 45%, #1b8b80 100%);
      color: #ffffff;
      padding: 24px 18px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      min-height: 100vh;
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .logo {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.18);
      display: grid;
      place-items: center;
      font-weight: 700;
    }
    .title { font-size: 1rem; font-weight: 700; }
    .subtitle { font-size: 0.85rem; opacity: 0.95; }
    nav { display: flex; flex-direction: column; gap: 8px; }
    .menu-item {
      color: inherit;
      text-decoration: none;
      display: grid;
      grid-template-columns: 32px minmax(0, 1fr);
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      transition: background 0.18s ease;
      font-weight: 600;
      line-height: 1.2;
    }
    .menu-item:hover,
    .menu-item.active {
      background: rgba(255, 255, 255, 0.14);
    }
    .icon {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.95);
      padding: 6px;
    }
    .menu-item > span:last-child {
      display: block;
      min-width: 0;
      flex: 1 1 auto;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .logout {
      margin-top: auto;
      border: 1px solid rgba(255, 255, 255, 0.35);
      background: transparent;
      color: inherit;
      padding: 10px 12px;
      border-radius: 10px;
      cursor: pointer;
    }
    `
  ]
})
export class SidebarComponent {
  private readonly iconMap: Record<string, string> = {
    schedule: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 11h5v-2h-3V7h-2Z',
    manage_accounts: 'M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-3.33 0-10 1.67-10 5v3h12v-3c0-1.53.68-2.8 1.8-3.88A17.35 17.35 0 0 0 12 14Zm10.71 2.29-1.42-1.42-1.06 1.06 1.42 1.42-1.42 1.42 1.06 1.06 1.42-1.42 1.42 1.42 1.06-1.06-1.42-1.42 1.42-1.42-1.06-1.06Z',
    group: 'M16 11c1.66 0 2.99-1.57 2.99-3.5S17.66 4 16 4s-3 1.57-3 3.5S14.34 11 16 11Zm-8 0c1.66 0 2.99-1.57 2.99-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.95 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z',
    payments: 'M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4H4V6h16Zm0 10H4v-6h16Z',
    settings: 'M19.14 12.94a7.93 7.93 0 0 0 .06-.94 7.93 7.93 0 0 0-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.28 7.28 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.88 2h-3.76a.5.5 0 0 0-.49.42l-.36 2.54a7.28 7.28 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.61.22L2.72 8.48a.5.5 0 0 0 .12.64l2.03 1.58a7.93 7.93 0 0 0-.06.94 7.93 7.93 0 0 0 .06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .61.22l2.39-.96a7.28 7.28 0 0 0 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.76a.5.5 0 0 0 .49-.42l.36-2.54a7.28 7.28 0 0 0 1.63-.94l2.39.96a.5.5 0 0 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64ZM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5Z'
  };

  @Input() userName = '';
  @Input() menus: MenuItem[] = [];

  constructor(private readonly authService: AuthService) {}

  logout(): void {
    this.authService.logout();
  }

  iconPath(name: string): string {
    return this.iconMap[name] ?? this.iconMap['settings'];
  }
}
