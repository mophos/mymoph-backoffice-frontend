import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { OfficeComboboxComponent } from '../../shared/ui/office-combobox/office-combobox.component';

export interface PersonnelFormData {
  /** null = เพิ่มใหม่ */
  editing: { id: string; cid: string; firstName: string; lastName: string; hospcode: string } | null;
  /** ถ้าผู้ใช้ดูแลหน่วยงานเดียว ล็อกไว้เลยไม่ต้องให้เลือก */
  lockedHospcode: string | null;
}

export interface PersonnelFormResult {
  cid: string;
  firstName: string;
  lastName: string;
  hospcode: string;
}

@Component({
  selector: 'app-personnel-form-dialog',
  imports: [OfficeComboboxComponent],
  templateUrl: './personnel-form-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PersonnelFormDialogComponent {
  readonly data = inject<PersonnelFormData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<PersonnelFormResult>>(DialogRef);

  private readonly combobox = viewChild(OfficeComboboxComponent);

  readonly cid = signal(this.data.editing?.cid ?? '');
  readonly firstName = signal(this.data.editing?.firstName ?? '');
  readonly lastName = signal(this.data.editing?.lastName ?? '');

  /** combobox คืนเป็นรายการ จึงเก็บเป็น array แล้วหยิบตัวแรก */
  readonly hospcodes = signal<string[]>(
    this.data.editing?.hospcode
      ? [this.data.editing.hospcode]
      : this.data.lockedHospcode
        ? [this.data.lockedHospcode]
        : []
  );

  readonly isEdit = computed(() => !!this.data.editing);
  readonly locked = computed(() => !!this.data.lockedHospcode);

  readonly cidValid = computed(() => /^\d{13}$/.test(this.cid().trim()));
  readonly valid = computed(() =>
    this.cidValid() && !!this.firstName().trim() && !!this.lastName().trim() && this.hospcodes().length === 1
  );

  readonly showCidHint = computed(() => this.cid().length > 0 && !this.cidValid());

  constructor() {
    // ให้ chip แสดงชื่อหน่วยงานและ hcode9 ไม่ใช่รหัสเปล่า
    effect(() => {
      const codes = this.hospcodes();
      if (codes.length) this.combobox()?.loadLabelsFor(codes);
    });
  }

  /** เลือกได้ทีละหน่วยงาน ถ้าเลือกใหม่ให้แทนที่ตัวเดิม */
  onOfficeChange(codes: string[]): void {
    this.hospcodes.set(codes.length ? [codes[codes.length - 1]] : []);
  }

  cancel(): void {
    this.dialogRef.close();
  }

  submit(): void {
    if (!this.valid()) return;
    this.dialogRef.close({
      cid: this.cid().trim(),
      firstName: this.firstName().trim(),
      lastName: this.lastName().trim(),
      hospcode: this.hospcodes()[0]
    });
  }
}
