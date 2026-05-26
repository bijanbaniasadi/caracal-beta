import { NextResponse, type NextRequest } from 'next/server';

const customerSessionCookie = 'caracal_customer_session';

const legacyPhpRedirects: Record<string, string> = {
  '/academy.php': '/knowledge',
  '/admin.php': '/admin',
  '/admin_panel.php': '/admin',
  '/admin_shop.php': '/admin',
  '/articles.php': '/knowledge',
  '/cancel.php': '/shop/cancel',
  '/cart.php': '/shop/cart',
  '/chat-api.php': '/contact',
  '/checkout.php': '/shop/checkout',
  '/client_panel.php': '/account',
  '/completed-jobs.php': '/contact',
  '/create-payment.php': '/shop/checkout',
  '/db_config.local.php': '/',
  '/db_config.php': '/',
  '/db_config.sample.php': '/',
  '/device-image.php': '/shop',
  '/ecu-calculator.php': '/ecu-tools',
  '/ecu-lookup.php': '/ecu-tools',
  '/ecu-patcher.php': '/ecu-patcher',
  '/ecu-remapping-dubai.php': '/ecu-remapping-dubai',
  '/ecu-tuning-dealers.php': '/contact',
  '/ecu-tuning-software.php': '/shop?category=calibration-software',
  '/ecu-tuning-tools.php': '/shop?category=ecu-tcu-tuning-tools',
  '/ecu-tuning.php': '/ecu-tuning',
  '/hosting-check.php': '/',
  '/immo-data.php': '/contact',
  '/immo-dpf-adblue-services.php': '/immo-dpf-adblue-services',
  '/includes/article-library.php': '/knowledge',
  '/includes/article-overrides.php': '/knowledge',
  '/includes/auth-security.php': '/',
  '/includes/google-reviews.php': '/contact',
  '/includes/growth.php': '/',
  '/includes/runtime-config.php': '/',
  '/includes/seo-topics.php': '/knowledge',
  '/includes/shop-gateways.php': '/shop/checkout',
  '/includes/shop.php': '/shop',
  '/includes/site-content.php': '/',
  '/includes/site-shell.php': '/',
  '/includes/training-library.php': '/knowledge',
  '/includes/translations.php': '/',
  '/index.php': '/',
  '/invoice-payment.php': '/shop/checkout',
  '/login.php': '/login',
  '/logout.php': '/login',
  '/lookup-api.php': '/ecu-tools',
  '/lookup-data.php': '/ecu-tools',
  '/lookup-options.php': '/ecu-tools',
  '/paypal-config.sample.php': '/',
  '/privacy.php': '/privacy',
  '/product.php': '/shop',
  '/projects.php': '/knowledge',
  '/refund.php': '/refund',
  '/register.php': '/register',
  '/setup-auth.php': '/',
  '/shipping.php': '/shipping',
  '/shop-return.php': '/shop/success',
  '/shop-webhook-stripe.php': '/shop/cancel',
  '/shop.php': '/shop',
  '/stripe-config.php': '/',
  '/success.php': '/shop/success',
  '/telr-config.sample.php': '/',
  '/terms.php': '/terms',
  '/tmp_diag/seogen.php': '/',
  '/tmp_diag/upd1.php': '/',
};

function isProjectionCatalogEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_NEW_CATALOG_FRONTEND === 'true' ||
    process.env.NEW_CATALOG_FRONTEND === 'true'
  );
}

function rollbackCatalogUrl(request: NextRequest): URL {
  const target = new URL('/shop', request.url);
  const q = request.nextUrl.searchParams.get('q');
  const category = request.nextUrl.searchParams.get('category');
  if (q) target.searchParams.set('q', q);
  if (category) target.searchParams.set('category', category);
  return target;
}

function redirectTarget(request: NextRequest): string | null {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname === '/knowledge-article.php') {
    const slug = searchParams.get('slug');
    return slug ? `/knowledge/${slug}` : '/knowledge';
  }

  if (pathname === '/course.php') {
    const slug = searchParams.get('slug');
    return slug ? `/knowledge/${slug}` : '/knowledge';
  }

  if (pathname === '/product.php') {
    const slug = searchParams.get('slug');
    return slug ? `/shop/${slug}` : '/shop';
  }

  if (pathname.startsWith('/courses/')) {
    return pathname.replace(/^\/courses/, '/knowledge');
  }

  return legacyPhpRedirects[pathname] ?? null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAccountRoute = pathname === '/account' || pathname.startsWith('/account/');
  const isCatalogRoute = pathname === '/catalog' || pathname.startsWith('/catalog/');

  if (isAccountRoute && !request.cookies.get(customerSessionCookie)?.value) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnTo', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (isCatalogRoute) {
    if (!isProjectionCatalogEnabled()) {
      const response = NextResponse.redirect(rollbackCatalogUrl(request), 307);
      response.headers.set('x-caracal-catalog-frontend', 'legacy-rollback');
      return response;
    }

    const response = NextResponse.next();
    response.headers.set('x-caracal-catalog-frontend', 'projection');
    return response;
  }

  const target = redirectTarget(request);

  if (!target) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL(target, request.url), 301);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
