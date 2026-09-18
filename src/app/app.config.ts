import { ApplicationConfig, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { registerLocaleData, DATE_PIPE_DEFAULT_OPTIONS } from '@angular/common';
import localeTh from '@angular/common/locales/th';
import { providePrimeNG } from 'primeng/config';
import { appRoutes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { MophPreset, thTranslation } from './core/theme/moph-preset';

registerLocaleData(localeTh);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(appRoutes),
    provideHttpClient(withXhr(), withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: MophPreset,
        options: {
          // ไม่เปิดโหมดมืด ระบบเดิมมีธีมเดียว
          darkModeSelector: false,
          // ให้ style ของ PrimeNG อยู่ใต้ layer เพื่อไม่ทับ CSS เดิมของหน้าที่ยังไม่ได้เขียนใหม่
          cssLayer: { name: 'primeng', order: 'primeng' }
        }
      },
      translation: thTranslation
    }),
    { provide: LOCALE_ID, useValue: 'th-TH' },
    { provide: DATE_PIPE_DEFAULT_OPTIONS, useValue: { timezone: 'Asia/Bangkok', dateFormat: 'short' } }
  ]
};
