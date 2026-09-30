import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild, effect } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { OfficeComboboxComponent } from '../../shared/ui/office-combobox/office-combobox.component';
import { ROLE_OPTIONS, RoleOption, roleLabels } from './role-options';

export interface UserFormData {
  /** null = เพิ่มใหม่ */
  editing: {
    user_id: string;
    cid: string;
    displayName: string;
    role_codes: string[];
    hospcodes: string[];
  } | null;
  canAssignSuperAdmin: boolean;
}

export interface UserFormResult {
  cid: string;
  roleCodes: string[];
  hospcodes: string[];
  /** บทบาทที่จะถูกถอดออก ใช้ให้หน้าแม่ยืนยันก่อนส่ง */
  removedRoles: string[];
}

@Component({
  selector: 'app-user-form-dialog',
  imports: [OfficeComboboxComponent],
  templateUrl: './user-form-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserFormDialogComponent {
  readonly data = inject<UserFormData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<UserFormResult>>(DialogRef);

  private readonly combobox = viewChild(OfficeComboboxComponent);

  readonly roleOptions = ROLE_OPTIONS;

  readonly cid = signal(this.data.editing?.cid ?? '');
  readonly roles = signal<string[]>([...(this.data.editing?.role_codes ?? [])]);
  readonly hospcodes = signal<string[]>([...(this.data.editing?.hospcodes ?? [])]);

  readonly isEdit = computed(() => !!this.data.editing);

  readonly removedRoles = computed(() => {
    const before = this.data.editing?.role_codes ?? [];
    return before.filter((code) => !this.roles().includes(code));
  });

  readonly removedLabel = computed(() => roleLabels(this.removedRoles()));

  readonly valid = computed(() =>
    /^\d{13}$/.test(this.cid().trim()) && this.roles().length > 0 && this.hospcodes().length > 0
  );

  constructor() {
    // ให้ chip แสดงชื่อหน่วยงาน ไม่ใช่รหัสเปล่า ตอนเปิดฟอร์มแก้ไข
    effect(() => {
      const codes = this.data.editing?.hospcodes ?? [];
      if (codes.length) this.combobox()?.loadLabelsFor(codes);
    });
  }

  isSelected(code: string): boolean {
    return this.roles().includes(code);
  }

  isDisabled(option: RoleOption): boolean {
    return !!option.restricted && !this.data.canAssignSuperAdmin;
  }

  toggle(option: RoleOption): void {
    if (this.isDisabled(option)) return;
    this.roles.update((list) =>
      list.includes(option.code) ? list.filter((c) => c !== option.code) : [...list, option.code]
    );
  }

  cancel(): void {
    this.dialogRef.close();
  }

  submit(): void {
    if (!this.valid()) return;
    this.dialogRef.close({
      cid: this.cid().trim(),
      roleCodes: this.roles(),
      hospcodes: this.hospcodes(),
      removedRoles: this.removedRoles()
    });
  }
}
