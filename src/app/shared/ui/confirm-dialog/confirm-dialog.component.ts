import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  /** ประโยคหลักบอกว่ากำลังจะทำอะไรกับใคร */
  message: string;
  /**
   * รายการผลกระทบที่จะเกิดขึ้นจริง
   * จุดประสงค์คือให้ผู้ใช้เห็นผลข้างเคียงที่ระบบทำเบื้องหลัง
   * เช่น การถอดบทบาทหนึ่งไปล้างขอบเขตหน่วยงานของบทบาทอื่นด้วย
   */
  consequences?: string[];
  /** ข้อความเตือนเพิ่มสำหรับการกระทำที่ย้อนกลับไม่ได้ */
  warning?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** true = ปุ่มยืนยันเป็นสีอันตราย ใช้กับการลบหรือถอนสิทธิ์ */
  danger?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent, boolean>);

  cancel(): void {
    this.dialogRef.close(false);
  }

  confirm(): void {
    this.dialogRef.close(true);
  }
}
