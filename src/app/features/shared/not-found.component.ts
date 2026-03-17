import { Component } from '@angular/core';

@Component({
  selector: 'app-not-found',
  standalone: true,
  template: `
    <div class="state">
      <h2>404 - Not Found</h2>
      <p>ไม่พบหน้าที่ต้องการ</p>
    </div>
  `,
  styles: ['.state { padding: 22px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; }']
})
export class NotFoundComponent {}
