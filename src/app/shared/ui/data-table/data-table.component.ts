import { ChangeDetectionStrategy, Component, ContentChild, TemplateRef, input, output } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { NgTemplateOutlet } from '@angular/common';

export interface DataTableColumn<T> {
  /** key ใช้เป็น matColumnDef ต้องไม่ซ้ำกันในตารางเดียว */
  key: string;
  header: string;
  /** แปลงข้อมูลหนึ่งแถวเป็นข้อความที่จะแสดง */
  cell: (row: T) => string;
  /** class เพิ่มเติมของ cell เช่น tabular-nums หรือ whitespace-nowrap */
  cssClass?: string;
}

/**
 * ตารางที่ผูกกับ API แบบแบ่งหน้าฝั่ง server
 *
 * รวม loading / empty / error / pagination ไว้ที่เดียว เพื่อให้ทุกเมนู
 * มีพฤติกรรมเหมือนกัน แทนที่แต่ละหน้าจะเขียนเองอย่างที่เป็นอยู่เดิม
 *
 * ตัวเลข page ที่รับเข้าและส่งออกเป็นแบบเริ่มที่ 1 ให้ตรงกับ API
 * ส่วน MatPaginator ใช้ index เริ่มที่ 0 การแปลงเกิดขึ้นภายใน component นี้
 */
@Component({
  selector: 'app-data-table',
  imports: [MatTableModule, MatPaginatorModule, MatProgressBarModule, MatIconModule, NgTemplateOutlet],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataTableComponent<T> {
  readonly columns = input.required<DataTableColumn<T>[]>();
  readonly rows = input.required<readonly T[]>();
  readonly total = input.required<number>();
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly loading = input(false);
  /** รหัสหรือข้อความผิดพลาดจาก API ถ้ามี */
  readonly errorMessage = input<string | null>(null);
  readonly emptyMessage = input('ไม่พบข้อมูล');
  readonly pageSizeOptions = input<number[]>([10, 20, 50]);

  readonly pageChange = output<{ page: number; pageSize: number }>();

  /** template สำหรับปุ่มท้ายแถว ส่งตัวแถวเข้าไปเป็น implicit context */
  @ContentChild('rowActions') rowActions?: TemplateRef<{ $implicit: T }>;

  get displayedColumns(): string[] {
    const keys = this.columns().map((column) => column.key);
    return this.rowActions ? [...keys, '__actions'] : keys;
  }

  onPage(event: PageEvent): void {
    this.pageChange.emit({ page: event.pageIndex + 1, pageSize: event.pageSize });
  }
}
