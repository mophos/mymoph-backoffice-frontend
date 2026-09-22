import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../auth/auth.service';
import { PermissionCode } from '../models/auth.models';

/**
 * ซ่อน/แสดง element ตาม permission ของ session ปัจจุบัน
 *
 *   <button *hasPermission="'personnel.manage'">เพิ่มข้อมูล</button>
 *   <button *hasPermission="['payroll.read', 'payroll.export']">...</button>   ต้องมีครบทุกตัว
 *   <button *hasPermission="['a','b']; mode: 'any'">...</button>               มีตัวใดตัวหนึ่งก็พอ
 *
 * รวมเงื่อนไขซ่อนปุ่มไว้ที่เดียว แทนการเรียก hasPermission() กระจายใน template
 *
 * ข้อควรทราบ: นี่คือการซ่อน UI ไม่ใช่การบังคับสิทธิ์
 * backend ตรวจซ้ำเสมอและเป็นชั้นบังคับจริง
 */
@Directive({ selector: '[hasPermission]' })
export class HasPermissionDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly authService = inject(AuthService);

  private readonly user = toSignal(this.authService.user$, { initialValue: null });
  private rendered = false;

  readonly hasPermission = input.required<PermissionCode | PermissionCode[]>();
  readonly hasPermissionMode = input<'all' | 'any'>('all');

  constructor() {
    effect(() => {
      const user = this.user();
      const required = this.hasPermission();
      const mode = this.hasPermissionMode();

      const codes = Array.isArray(required) ? required : [required];
      const granted = user?.permissions ?? [];
      const allowed = codes.length === 0
        ? true
        : mode === 'any'
          ? codes.some((code) => granted.includes(code))
          : codes.every((code) => granted.includes(code));

      if (allowed && !this.rendered) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.rendered = true;
      } else if (!allowed && this.rendered) {
        this.viewContainer.clear();
        this.rendered = false;
      }
    });
  }
}
