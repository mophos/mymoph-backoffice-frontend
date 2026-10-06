import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TaxYearStore } from './tax-year.store';

/**
 * กรอบของทุกหน้าที่ทำงานกับปีภาษีหนึ่งปี
 *
 * ถือหัวข้อ ปุ่มย้อนกลับ และแถบสลับระหว่าง "ไฟล์ในปีนี้" กับ "อัปโหลด"
 * หน้าลูกจึงเหลือแต่เนื้องานของตัวเอง และบอกได้ชัดตลอดว่าตอนนี้อยู่ปีไหน
 */
@Component({
  selector: 'app-tax-year-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './tax-year-layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaxYearLayoutComponent {
  private readonly route = inject(ActivatedRoute);

  readonly store = inject(TaxYearStore);

  /** แท็บอัปโหลดขึ้นเมื่อแก้ปีนี้ได้จริง ไม่ใช่แค่มี permission */
  readonly canUpload = computed(() => this.store.canWriteSelectedYear());

  constructor() {
    // route เดียวกันถูกใช้ซ้ำเมื่อเปลี่ยนแค่ :yearId จึงต้องฟัง param ไม่ใช่อ่านครั้งเดียว
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const parsed = Number(params.get('yearId'));
      if (Number.isInteger(parsed) && parsed > 0) {
        this.store.load(parsed);
      } else {
        this.store.markInvalid();
      }
    });
  }
}
