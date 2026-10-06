import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth/auth.service';
import { TaxService, TaxYearRow } from './tax.service';
import { taxApiErrorText, yearShort } from './tax-errors';

/**
 * ปีภาษีที่กำลังเปิดอยู่ ใช้ร่วมกันระหว่างหน้าแม่กับหน้าลูกใน /tax/:yearId
 *
 * ประกาศเป็น provider ที่ระดับ route ของ :yearId หน้าลูกจึงอ่านได้ว่า
 * ตอนนี้อยู่ปีไหนโดยไม่ต้องยิง API ซ้ำ และหัวข้อกับเนื้อหาไม่หลุดจากกัน
 *
 * ไม่มี endpoint อ่านปีเดียว จึงต้องโหลดรายการปีแล้วหาเอา
 * ซึ่งเป็น query เดียวอยู่แล้วและเป็นทางเดียวที่ backend มีให้
 */
@Injectable()
export class TaxYearStore {
  private readonly taxService = inject(TaxService);
  private readonly authService = inject(AuthService);

  private readonly user = toSignal(this.authService.user$, { initialValue: null });

  /** ตั้งทันทีจาก URL ก่อนรู้ผลโหลด หน้าลูกจึงเริ่มโหลดข้อมูลของตัวเองได้เลย */
  readonly yearId = signal<number | null>(null);

  readonly year = signal<TaxYearRow | null>(null);
  readonly loading = signal(false);

  /** ไม่พบปีนี้ในรายการที่บัญชีนี้เห็น — ทั้งปีที่ถูกลบไปแล้วและปีนอกขอบเขต */
  readonly notFound = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly yearShortLabel = computed(() => yearShort(this.year()?.yearBe ?? null));

  /**
   * ปีที่เปิดอยู่นี้แก้ข้อมูลได้ไหม
   *
   * ฝ่ายการเงินส่วนกลางเปิดดูปีของหน่วยงานอื่นได้ แต่อัปโหลดและลบไม่ได้
   * หน้าลูกใช้ค่านี้ซ่อนปุ่มและแถบอัปโหลด ไม่ให้กดแล้วได้ 403 เปล่า ๆ
   */
  readonly canWriteSelectedYear = computed(() => {
    const u = this.user();
    const row = this.year();
    if (!u || !row) return false;
    if (!u.permissions.includes('payroll.export')) return false;
    if (u.scopeType === 'ALL') return true;
    return (u.hospcodes ?? []).includes(String(row.hospcode));
  });

  /** เปิดดูอยู่แต่แก้ไม่ได้ ใช้แสดงคำอธิบายให้ผู้ใช้เข้าใจว่าทำไมไม่มีปุ่ม */
  readonly readOnlyBecauseOtherOffice = computed(() => {
    const u = this.user();
    const row = this.year();
    if (!u || !row) return false;
    if (!u.permissions.includes('payroll.export')) return false;
    if (u.scopeType === 'ALL') return false;
    return !(u.hospcodes ?? []).includes(String(row.hospcode));
  });

  /** โหลดปีตาม id ที่อยู่ใน URL เรียกซ้ำด้วย id เดิมได้ ใช้ตอนต้องรีเฟรชจำนวนไฟล์ */
  load(yearId: number): void {
    this.yearId.set(yearId);
    this.loading.set(true);
    this.notFound.set(false);
    this.errorMessage.set(null);

    this.taxService.listYears().subscribe({
      next: (res) => {
        const match = (res.data ?? []).find((row) => Number(row.id) === yearId) ?? null;
        this.year.set(match);
        this.notFound.set(!match);
        this.loading.set(false);
      },
      error: (error) => {
        this.year.set(null);
        this.errorMessage.set(taxApiErrorText(error, 'LOAD_TAX_YEARS_FAILED'));
        this.loading.set(false);
      }
    });
  }

  /** ปีนี้อ่านจาก URL ไม่ได้ เช่น /tax/abc/documents */
  markInvalid(): void {
    this.yearId.set(null);
    this.year.set(null);
    this.loading.set(false);
    this.notFound.set(true);
  }

  /** โหลดปีเดิมใหม่ เช่นหลังอัปโหลดเสร็จเพื่อให้จำนวนไฟล์ที่หัวข้อตรงความจริง */
  reload(): void {
    const id = this.yearId();
    if (id === null) return;
    this.load(id);
  }
}
