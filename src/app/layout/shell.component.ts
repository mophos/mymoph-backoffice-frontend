import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map } from 'rxjs/operators';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatSidenavModule, MatToolbarModule, MatListModule,
    MatIconModule, MatButtonModule, MatMenuModule, MatDividerModule
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShellComponent {
  private readonly authService = inject(AuthService);
  private readonly breakpoints = inject(BreakpointObserver);

  readonly user = toSignal(this.authService.user$, { initialValue: null });

  /**
   * จอแคบให้ drawer ทับเนื้อหาและปิดเองเมื่อเลือกเมนู
   * จอกว้างให้ drawer อยู่ถาวรข้างเนื้อหา
   */
  readonly isHandset = toSignal(
    this.breakpoints.observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
      .pipe(map((result) => result.matches)),
    { initialValue: false }
  );

  readonly drawerOpen = signal(true);

  toggleDrawer(): void {
    this.drawerOpen.update((open) => !open);
  }

  onNavigate(): void {
    if (this.isHandset()) {
      this.drawerOpen.set(false);
    }
  }

  scopeLabel(): string {
    const user = this.user();
    if (!user) return '';
    if (user.scopeType === 'ALL') return 'ทุกหน่วยงาน';
    return user.hospcodes.length
      ? `${user.hospcodes.length} หน่วยงาน`
      : 'ยังไม่ได้รับมอบหมายหน่วยงาน';
  }

  logout(): void {
    this.authService.logout();
  }
}
