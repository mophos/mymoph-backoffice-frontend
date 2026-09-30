import { ChangeDetectionStrategy, Component, ContentChild, TemplateRef, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

export interface TableColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => string;
  /** class เพิ่มของ cell เช่น จัดขวา หรือใช้ฟอนต์ตัวเลข */
  cellClass?: string;
  /** ซ่อนคอลัมน์นี้บนจอแคบ ใช้กับข้อมูลรองที่ไม่จำเป็นต้องเห็นตลอด */
  hideOnMobile?: boolean;
}

/**
 * ตารางที่ผูกกับ API แบบแบ่งหน้าฝั่ง server
 * ใช้ table ของ HTML ตรง ๆ กับ Tailwind ไม่พึ่ง component library
 *
 * page ที่รับและส่งเป็นเลขเริ่มที่ 1 ให้ตรงกับ API
 */
@Component({
  selector: 'app-table',
  imports: [NgTemplateOutlet],
  templateUrl: './table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TableComponent<T> {
  readonly columns = input.required<TableColumn<T>[]>();
  readonly rows = input.required<readonly T[]>();
  readonly total = input.required<number>();
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly loading = input(false);
  readonly errorMessage = input<string | null>(null);
  readonly emptyMessage = input('ไม่พบข้อมูล');
  readonly pageSizeOptions = input<number[]>([10, 20, 50]);

  readonly pageChange = output<{ page: number; pageSize: number }>();

  @ContentChild('rowActions') rowActions?: TemplateRef<{ $implicit: T }>;

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / Math.max(1, this.pageSize())))
  );

  readonly rangeLabel = computed(() => {
    const total = this.total();
    if (total === 0) return 'ไม่พบข้อมูล';

    const start = (this.page() - 1) * this.pageSize();
    // เผื่อกรณีอยู่หน้าท้าย ๆ แล้วข้อมูลลดลงจนหน้านี้เกินจำนวนจริง
    const end = Math.min(start + this.pageSize(), total);
    return `${start + 1}–${end} จาก ${total} รายการ`;
  });

  readonly canPrev = computed(() => this.page() > 1 && !this.loading());
  readonly canNext = computed(() => this.page() < this.totalPages() && !this.loading());

  goTo(page: number): void {
    this.pageChange.emit({ page, pageSize: this.pageSize() });
  }

  changePageSize(value: string): void {
    // กลับไปหน้าแรกเสมอ เพราะเลขหน้าเดิมอาจเกินจำนวนหน้าใหม่
    this.pageChange.emit({ page: 1, pageSize: Number(value) });
  }
}
