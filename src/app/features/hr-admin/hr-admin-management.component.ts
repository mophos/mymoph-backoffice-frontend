import { Component, OnInit } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HrAdminService } from './hr-admin.service';

interface HrAdminRow {
  user_id: string;
  cid: string;
  first_name?: string;
  last_name?: string;
  role_codes: string[];
  hospcodes: string[];
}

@Component({
  selector: 'app-hr-admin-management',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule],
  template: `
    <section class="card">
      <h2>HR Office Admin Management</h2>
      <p class="note">ผู้ใช้ 1 คนกำหนดได้หลาย role พร้อมกำหนด Hospcodes ได้</p>

      <div class="toolbar">
        <input [(ngModel)]="search" placeholder="Search by CID, name, email" />
        <button (click)="load()">Search</button>
      </div>

      <div class="form-grid">
        <input [(ngModel)]="form.cid" placeholder="CID" />

        <div class="role-grid">
          <label *ngFor="let role of roleOptions">
            <input
              type="checkbox"
              [checked]="form.roleCodes.includes(role)"
              (change)="toggleRole(role, $any($event.target).checked)"
            />
            <span>{{ role }}</span>
          </label>
        </div>

        <input [(ngModel)]="scopeInput" placeholder="Hospcodes (comma separated)" />
        <button (click)="save()">{{ editingUserId ? 'Update' : 'Save' }}</button>
      </div>

      <div class="actions-bar" *ngIf="editingUserId">
        <span>Editing user: {{ editingUserId }}</span>
        <button class="ghost" (click)="cancelEdit()">Cancel edit</button>
      </div>

      <p class="error" *ngIf="errorMessage">{{ errorMessage }}</p>

      <table>
        <thead>
          <tr>
            <th>CID</th>
            <th>Name</th>
            <th>Roles</th>
            <th>Scope</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of rows">
            <td>{{ row.cid }}</td>
            <td>{{ (row.first_name || '-') }} {{ (row.last_name || '') }}</td>
            <td>{{ row.role_codes.join(', ') }}</td>
            <td>{{ row.hospcodes.join(', ') }}</td>
            <td class="table-actions">
              <button class="ghost" (click)="startEdit(row)">Edit</button>
              <button class="danger" (click)="deactivate(row.user_id)">Deactivate</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  `,
  styles: [
    `
    .card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 18px; }
    .note { margin: 6px 0 14px; color: var(--muted); font-size: 0.9rem; }
    .error { margin: 6px 0 14px; color: var(--danger); font-size: 0.92rem; }
    .toolbar, .form-grid { display: grid; grid-template-columns: repeat(4, minmax(140px, 1fr)); gap: 8px; margin-bottom: 12px; }
    input, select { padding: 8px; border: 1px solid var(--line); border-radius: 8px; }
    .role-grid {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 8px;
      display: grid;
      grid-template-columns: repeat(2, minmax(120px, 1fr));
      gap: 6px;
      align-content: start;
    }
    .role-grid label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.9rem;
    }
    button { border: 0; background: var(--brand); color: #fff; border-radius: 8px; padding: 8px 10px; cursor: pointer; }
    button.ghost { border: 1px solid var(--line); background: transparent; color: inherit; }
    button.danger { background: var(--danger); }
    .actions-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 12px; }
    .table-actions { display: flex; gap: 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid var(--line); padding: 10px 8px; text-align: left; font-size: 0.9rem; }
    @media (max-width: 1100px) {
      .toolbar, .form-grid { grid-template-columns: 1fr; }
      .actions-bar { flex-direction: column; align-items: flex-start; }
      .table-actions { flex-direction: column; }
      .role-grid { grid-template-columns: 1fr; }
    }
    `
  ]
})
export class HrAdminManagementComponent implements OnInit {
  readonly roleOptions = ['hr', 'admin_affairs', 'it_office', 'super_admin'];

  search = '';
  scopeInput = '';
  editingUserId: string | null = null;
  errorMessage = '';
  rows: HrAdminRow[] = [];

  form: {
    cid: string;
    roleCodes: string[];
  } = {
    cid: '',
    roleCodes: ['hr']
  };

  constructor(private readonly service: HrAdminService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.errorMessage = '';
    this.service.list(this.search).subscribe({
      next: (res: any) => {
        this.rows = this.normalizeRows(res.data?.rows || []);
      },
      error: (error) => {
        this.errorMessage = this.resolveErrorMessage(error, 'โหลดข้อมูลไม่สำเร็จ');
      }
    });
  }

  toggleRole(roleCode: string, checked: boolean): void {
    const current = new Set(this.form.roleCodes);
    if (checked) {
      current.add(roleCode);
    } else {
      current.delete(roleCode);
    }
    this.form.roleCodes = [...current];
  }

  save(): void {
    this.errorMessage = '';

    const selectedRoles = [...new Set(this.form.roleCodes)];
    if (!selectedRoles.length) {
      this.errorMessage = 'กรุณาเลือกอย่างน้อย 1 role';
      return;
    }

    const payload = {
      cid: this.form.cid,
      roleCodes: selectedRoles,
      hospcodes: this.scopeInput
        .split(',')
        .map((code) => code.trim())
        .filter(Boolean)
    };

    if (this.editingUserId) {
      this.service.update(this.editingUserId, payload).subscribe({
        next: () => {
          this.cancelEdit();
          this.load();
        },
        error: (error) => {
          this.errorMessage = this.resolveErrorMessage(error, 'แก้ไขข้อมูลไม่สำเร็จ');
        }
      });
      return;
    }

    this.service.create(payload).subscribe({
      next: () => {
        this.resetForm();
        this.load();
      },
      error: (error) => {
        this.errorMessage = this.resolveErrorMessage(error, 'บันทึกข้อมูลไม่สำเร็จ');
      }
    });
  }

  startEdit(row: HrAdminRow): void {
    this.errorMessage = '';
    this.editingUserId = row.user_id;
    this.form = {
      cid: row.cid,
      roleCodes: [...row.role_codes]
    };
    this.scopeInput = row.hospcodes.join(', ');
  }

  cancelEdit(): void {
    this.editingUserId = null;
    this.resetForm();
  }

  deactivate(userId: string): void {
    this.service.deactivate(userId).subscribe({
      next: () => this.load(),
      error: (error) => {
        this.errorMessage = this.resolveErrorMessage(error, 'ปิดการใช้งานไม่สำเร็จ');
      }
    });
  }

  private resetForm(): void {
    this.form = {
      cid: '',
      roleCodes: ['hr']
    };
    this.scopeInput = '';
  }

  private normalizeRows(inputRows: any[]): HrAdminRow[] {
    const grouped = new Map<string, HrAdminRow>();

    for (const row of inputRows) {
      const key = String(row.user_id);
      const current: HrAdminRow = grouped.get(key) ?? {
        user_id: key,
        cid: String(row.cid ?? ''),
        first_name: row.first_name ?? undefined,
        last_name: row.last_name ?? undefined,
        role_codes: [],
        hospcodes: []
      };

      if (row.role_code && !current.role_codes.includes(row.role_code)) {
        current.role_codes.push(String(row.role_code));
      }

      const hospcodes = Array.isArray(row.hospcodes) ? row.hospcodes : [];
      for (const hospcode of hospcodes) {
        const value = String(hospcode);
        if (value && !current.hospcodes.includes(value)) {
          current.hospcodes.push(value);
        }
      }

      grouped.set(key, current);
    }

    return [...grouped.values()];
  }

  private resolveErrorMessage(error: any, fallbackMessage: string): string {
    const code = error?.error?.error;
    const missingHospcodes = error?.error?.missingHospcodes;
    const missingRoleCodes = error?.error?.missingRoleCodes;

    if (code === 'INVALID_HOSPCODE' && Array.isArray(missingHospcodes) && missingHospcodes.length) {
      return `Hospcode ไม่ถูกต้อง/ไม่มีในระบบ: ${missingHospcodes.join(', ')}`;
    }

    if (code === 'ROLE_NOT_FOUND' && Array.isArray(missingRoleCodes) && missingRoleCodes.length) {
      return `Role ไม่ถูกต้อง/ไม่มีในระบบ: ${missingRoleCodes.join(', ')}`;
    }

    if (code === 'TARGET_SCOPE_OUT_OF_BOUND' && Array.isArray(error?.error?.deniedHospcodes)) {
      return `Hospcode อยู่นอก scope ของผู้ใช้งาน: ${error.error.deniedHospcodes.join(', ')}`;
    }

    if (typeof code === 'string' && code.length) {
      return `Error: ${code}`;
    }

    return fallbackMessage;
  }
}
