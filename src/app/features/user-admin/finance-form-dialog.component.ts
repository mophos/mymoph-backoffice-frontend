import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { OfficeComboboxComponent } from '../../shared/ui/office-combobox/office-combobox.component';

export interface FinanceFormData {
  /** null = แต่งตั้งใหม่ */
  editing: {
    user_id: string;
    cid: string;
    displayName: string;
    hospcodes: string[];
  } | null;
}

export interface FinanceFormResult {
  cid: string;
  hospcodes: string[];
  /** หน่วยงานที่จะถูกถอดออก ใช้ให้หน้าแม่ยืนยันก่อนส่ง */
  removedHospcodes: string[];
}

/**
 * ฟอร์มหน้านี้ไม่ให้เลือกบทบาท ต่างจาก /user-admin เพราะ backend
 * ตรึงบทบาทไว้ที่ admin_affairs อย่างเดียว การมีช่องให้เลือกจะทำให้เข้าใจผิด
 */
@Component({
  selector: 'app-finance-form-dialog',
  imports: [OfficeComboboxComponent],
  templateUrl: './finance-form-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FinanceFormDialogComponent {
  readonly data = inject<FinanceFormData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<FinanceFormResult>>(DialogRef);

  private readonly combobox = viewChild(OfficeComboboxComponent);

  readonly cid = signal(this.data.editing?.cid ?? '');
  readonly hospcodes = signal<string[]>([...(this.data.editing?.hospcodes ?? [])]);

  readonly isEdit = computed(() => !!this.data.editing);

  readonly removedHospcodes = computed(() => {
    const before = this.data.editing?.hospcodes ?? [];
    return before.filter((code) => !this.hospcodes().includes(code));
  });

  readonly valid = computed(() =>
    /^\d{13}$/.test(this.cid().trim()) && this.hospcodes().length > 0
  );

  constructor() {
    // ให้ chip แสดงชื่อหน่วยงานและ hcode9 ไม่ใช่รหัสเปล่า ตอนเปิดฟอร์มแก้ไข
    effect(() => {
      const codes = this.data.editing?.hospcodes ?? [];
      if (codes.length) this.combobox()?.loadLabelsFor(codes);
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  submit(): void {
    if (!this.valid()) return;
    this.dialogRef.close({
      cid: this.cid().trim(),
      hospcodes: this.hospcodes(),
      removedHospcodes: this.removedHospcodes()
    });
  }
}
