import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { A11yModule } from '@angular/cdk/a11y';
import { OverlayModule } from '@angular/cdk/overlay';
import { map } from 'rxjs/operators';
import { AuthService } from '../core/auth/auth.service';
import { MenuGroup, MenuItem } from '../core/models/auth.models';

/** ป้ายกลุ่มเรียงตามลำดับที่ต้องการให้แสดง */
const GROUP_LABELS: { key: MenuGroup; label: string }[] = [
  { key: 'operations', label: 'งานประจำวัน' },
  { key: 'finance', label: 'การเงิน' },
  { key: 'administration', label: 'ผู้ดูแลระบบ' }
];

/**
 * กรอบหน้าจอ เขียนด้วย CDK + Tailwind ไม่ใช้ Angular Material แล้ว
 *
 * CDK ให้เฉพาะพฤติกรรมที่เขียนเองแล้วมักพลาด คือ focus trap ของ drawer
 * ตอนทับเนื้อหา และการจัดตำแหน่ง overlay ของเมนูบัญชี ส่วนหน้าตาเป็น Tailwind ล้วน
 *
 * ไอคอนใช้ฟอนต์ Material Icons ที่โหลดจาก angular.json ผ่าน class .material-icons
 * ใน styles.scss ไม่ได้พึ่ง <mat-icon> จึงไม่ต้องมี @angular/material
 */
@Component({
  selector: 'app-shell',
  imports: [NgTemplateOutlet, RouterOutlet, RouterLink, RouterLinkActive, A11yModule, OverlayModule],
  templateUrl: './shell.component.html',
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

  readonly drawerOpen = signal(false);
  readonly accountOpen = signal(false);

  /** drawer ทับเนื้อหาอยู่จริงเมื่อจอแคบและถูกเปิด */
  readonly overlayDrawer = computed(() => this.isHandset() && this.drawerOpen());

  /**
   * จัดเมนูเป็นกลุ่มตามลำดับใน GROUP_LABELS
   * ข้ามกลุ่มที่ผู้ใช้ไม่มีเมนูเลย เพื่อไม่ให้เห็นหัวข้อว่าง
   */
  readonly menuGroups = computed(() => {
    const menus = this.user()?.menus ?? [];
    return GROUP_LABELS
      .map(({ key, label }) => ({
        label,
        items: menus.filter((item: MenuItem) => item.group === key)
      }))
      .filter((group) => group.items.length > 0);
  });

  toggleDrawer(): void {
    this.drawerOpen.update((open) => !open);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  onNavigate(): void {
    if (this.isHandset()) this.closeDrawer();
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
    this.accountOpen.set(false);
    this.authService.logout();
  }
}
