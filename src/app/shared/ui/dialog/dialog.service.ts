import { Injectable, inject } from '@angular/core';
import { Dialog, DialogConfig, DialogRef } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/portal';
import { Observable, map } from 'rxjs';
import { ConfirmDialogComponent, ConfirmDialogData } from './confirm-dialog.component';

/**
 * เปิด dialog ด้วย CDK Dialog ซึ่งให้ focus trap การคืน focus เมื่อปิด
 * การปิดด้วย Escape และ aria ที่ถูกต้องมาให้ โดยไม่บังคับหน้าตา
 *
 * หน้าตาทั้งหมดมาจาก Tailwind ในแต่ละ component
 */
@Injectable({ providedIn: 'root' })
export class AppDialogService {
  private readonly dialog = inject(Dialog);

  open<T, D = unknown, R = unknown>(
    component: ComponentType<T>,
    config?: DialogConfig<D, DialogRef<R, T>>
  ): Observable<R | undefined> {
    return this.dialog.open<R, D, T>(component, {
      // กล่องเป็นแค่ที่วาง component ส่วนกรอบและเงาอยู่ใน component เอง
      panelClass: ['w-full', 'max-w-lg', 'px-4'],
      backdropClass: ['bg-black/40'],
      hasBackdrop: true,
      ...config
    }).closed;
  }

  /** ปิดด้วย Escape หรือคลิกนอกกล่อง ถือว่าไม่ยืนยัน */
  confirm(data: ConfirmDialogData): Observable<boolean> {
    return this.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      { data }
    ).pipe(map((result) => result === true));
  }
}
