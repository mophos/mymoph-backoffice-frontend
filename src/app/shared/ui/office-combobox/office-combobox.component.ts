import { ChangeDetectionStrategy, Component, ElementRef, inject, input, model, signal, viewChild } from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { Subject, debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HealthOffice, HealthOfficeService } from '../../../core/services/health-office.service';

/**
 * ค้นหาและเลือกหน่วยงานจากทะเบียน 42,991 แห่ง
 *
 * ใช้ CDK overlay จัดตำแหน่งกล่องผลลัพธ์ ส่วนการนำทางด้วยคีย์บอร์ดและ aria
 * เขียนตามรูปแบบ combobox ของ WAI-ARIA คือ input ถือ aria-activedescendant
 * ชี้ไปยัง option ที่ไฮไลต์อยู่ โดย focus ไม่ย้ายออกจาก input
 *
 * ค่าที่คืนเป็นรายการ code5 เพราะข้อมูลในระบบยังเก็บรหัส 5 หลัก
 * ดู work-list/work-clear-bug-repair/11-HCODE-MIGRATION.md
 */
@Component({
  selector: 'app-office-combobox',
  imports: [OverlayModule],
  templateUrl: './office-combobox.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OfficeComboboxComponent {
  private readonly service = inject(HealthOfficeService);

  readonly label = input('หน่วยงานที่รับผิดชอบ');
  readonly selected = model<string[]>([]);

  readonly input = viewChild<ElementRef<HTMLInputElement>>('queryInput');

  readonly options = signal<HealthOffice[]>([]);
  readonly loading = signal(false);
  readonly open = signal(false);
  readonly query = signal('');
  readonly activeIndex = signal(-1);
  /**
   * ข้อมูลของรหัสที่เลือกไว้ เก็บ hcode9 ด้วยเพื่อแสดงรหัสตามมาตรฐานใหม่
   * ส่วนค่าที่บันทึกลงฐานยังเป็น code5 จนกว่า migration จะเสร็จ
   */
  readonly info = signal<Record<string, { name: string; hcode9: string }>>({});

  private readonly query$ = new Subject<string>();

  constructor() {
    this.query$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        tap(() => this.loading.set(true)),
        switchMap((term) => this.service.search(term)),
        takeUntilDestroyed()
      )
      .subscribe({
        next: (rows) => {
          this.options.set(rows);
          this.activeIndex.set(rows.length ? 0 : -1);
          this.loading.set(false);
          this.open.set(true);
        },
        error: () => {
          this.options.set([]);
          this.loading.set(false);
        }
      });
  }

  loadLabelsFor(code5List: string[]): void {
    if (!code5List.length) return;
    this.service.resolve({ code5: code5List }).subscribe((rows) => {
      const map = { ...this.info() };
      rows.forEach((row) => {
        if (row.code5) map[row.code5] = { name: row.name, hcode9: row.hcode9 };
      });
      this.info.set(map);
    });
  }

  onType(value: string): void {
    this.query.set(value);
    if (value.trim()) {
      this.query$.next(value.trim());
    } else {
      this.options.set([]);
      this.open.set(false);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    const count = this.options().length;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (count) { this.open.set(true); this.activeIndex.update((i) => (i + 1) % count); }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (count) { this.open.set(true); this.activeIndex.update((i) => (i - 1 + count) % count); }
        break;
      case 'Enter': {
        const option = this.options()[this.activeIndex()];
        if (this.open() && option) { event.preventDefault(); this.pick(option); }
        break;
      }
      case 'Escape':
        this.close();
        break;
    }
  }

  pick(office: HealthOffice): void {
    // หน่วยงานที่ไม่มีรหัส 5 หลักยังเลือกไม่ได้ จนกว่าระบบจะย้ายไป hcode9
    if (!office.code5) return;

    if (!this.selected().includes(office.code5)) {
      this.selected.update((list) => [...list, office.code5!]);
      this.info.update((map) => ({
        ...map,
        [office.code5!]: { name: office.name, hcode9: office.hcode9 }
      }));
    }

    this.query.set('');
    this.close();
    this.input()?.nativeElement.focus();
  }

  remove(code: string): void {
    this.selected.update((list) => list.filter((item) => item !== code));
  }

  close(): void {
    this.open.set(false);
    this.options.set([]);
    this.activeIndex.set(-1);
  }

  nameFor(code: string): string {
    return this.info()[code]?.name ?? code;
  }

  /** แสดง hcode9 ตามมาตรฐานใหม่ ถ้ายังไม่รู้ให้แสดง code5 ไปก่อน */
  codeFor(code: string): string {
    return this.info()[code]?.hcode9 ?? code;
  }

  optionId(index: number): string {
    return `office-option-${index}`;
  }
}
