import { ApplicationConfig, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { registerLocaleData, DATE_PIPE_DEFAULT_OPTIONS } from '@angular/common';
import localeTh from '@angular/common/locales/th';
import { appRoutes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { thPaginatorIntl } from './core/i18n/th-paginator-intl';

registerLocaleData(localeTh);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(appRoutes),
    provideHttpClient(withXhr(), withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    { provide: LOCALE_ID, useValue: 'th-TH' },
    { provide: MAT_DATE_LOCALE, useValue: 'th-TH' },
    { provide: MatPaginatorIntl, useFactory: thPaginatorIntl },
    { provide: DATE_PIPE_DEFAULT_OPTIONS, useValue: { timezone: 'Asia/Bangkok', dateFormat: 'short' } }
  ]
};
