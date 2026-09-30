import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

export interface DeleteReasonData {
  displayName: string;
  cidMasked: string;
  email: string;
}

/**
 * ยืนยันการลบบัญชีแอป MyMOPH พร้อมเหตุผล
 *
 * แยกจาก ConfirmDialogComponent เพราะที่นี่ต้องกรอกข้อความ ไม่ใช่แค่กดยืนยัน
 * backend บังคับเหตุผลอย่างน้อย 5 ตัวอักษรและเก็บลง collection ที่จัดเก็บประวัติ
 */
@Component({
  selector: 'app-delete-reason-dialog',
  templateUrl: './delete-reason-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DeleteReasonDialogComponent {
  readonly data = inject<DeleteReasonData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<string>>(DialogRef);

  readonly reason = signal('');

  readonly trimmed = computed(() => this.reason().trim());
  readonly valid = computed(() => this.trimmed().length >= 5 && this.trimmed().length <= 500);

  /** แสดงเฉพาะเมื่อผู้ใช้เริ่มพิมพ์แล้ว จะได้ไม่ขึ้นเตือนตั้งแต่เปิดกล่อง */
  readonly showTooShort = computed(() => this.reason().length > 0 && this.trimmed().length < 5);

  cancel(): void {
    this.dialogRef.close();
  }

  submit(): void {
    if (!this.valid()) return;
    this.dialogRef.close(this.trimmed());
  }
}
