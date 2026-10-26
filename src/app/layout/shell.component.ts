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
   *
   * UI-04: เมนูที่ไม่มี `group` หรือ `group` ที่ไม่รู้จัก ต้องไปรวมกลุ่มท้ายสุด
   * ไม่ใช่หายไปเงียบ ๆ
   *
   * 6 ต.ค. 2569 backend บน production ยังเป็นโค้ดเก่าที่ไม่ส่ง `group` มา
   * ทุกกลุ่มจึงว่างแล้วถูกตัดทิ้ง ผู้ใช้ที่มีสิทธิ์ครบ 14 ตัวถูกล็อกออกจากทุกเมนู
   * และเห็นข้อความว่า "ยังไม่ได้รับสิทธิ์" ซึ่งชี้ผิดทางจนเสียเวลาสืบหลายรอบ
   *
   * เงื่อนไขเดียวกันเกิดได้อีกถ้าวันหน้าเพิ่มกลุ่มใหม่ที่ backend แต่ลืมเพิ่มที่นี่
   */
  readonly menuGroups = computed(() => {
    const menus = this.user()?.menus ?? [];
    const known = new Set<string>(GROUP_LABELS.map(({ key }) => key));

    const groups = GROUP_LABELS.map(({ key, label }) => ({
      label,
      items: menus.filter((item: MenuItem) => item.group === key)
    }));

    const ungrouped = menus.filter((item: MenuItem) => !known.has(String(item.group)));
    if (ungrouped.length) {
      groups.push({ label: 'เมนูอื่น', items: ungrouped });
    }

    return groups.filter((group) => group.items.length > 0);
  });

  /**
   * มีเมนูแต่จัดกลุ่มไม่ได้ — แยกจากกรณีไม่มีเมนูเลย
   *
   * ใช้เตือนผู้ดูแลว่าเป็นเรื่องเวอร์ชันไม่ตรงกัน ไม่ใช่เรื่องสิทธิ์
   * ตัวเมนูยังใช้งานได้ปกติเพราะถูกพาไปไว้กลุ่มท้ายสุดแล้ว
   */
  readonly hasUngroupedMenus = computed(() => {
    const known = new Set<string>(GROUP_LABELS.map(({ key }) => key));
    return (this.user()?.menus ?? []).some((item: MenuItem) => !known.has(String(item.group)));
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
