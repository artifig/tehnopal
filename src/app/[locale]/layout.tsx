import {notFound} from 'next/navigation';
import {NextIntlClientProvider} from 'next-intl';
import {ReactNode} from 'react';
import {locales} from '@/config';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {Navbar} from '@/components/ui/Navbar';
import {getMessages} from '@/i18n';
import {AssessmentProvider} from '@/context/AssessmentContext';

type Props = {
  children: ReactNode;
  params: Promise<{locale: string}>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({locale}));
}

export default async function LocaleLayout({
  children,
  params,
}: Props) {
  const {locale} = await params;

  // Ensure that the incoming locale is valid
  if (!locale || !locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="bg-black text-white min-h-screen antialiased font-[Arial] relative">
        <div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-black">
          <div 
            className="absolute -top-[500px] left-1/2 -translate-x-1/2 w-[800px] h-[800px] 
              bg-orange-500/20 rounded-full blur-3xl opacity-20 pointer-events-none"
          />
        </div>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <AssessmentProvider>
            <div className="relative flex flex-col min-h-screen">
              <header className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800">
                <div className="absolute top-0 right-0 p-4">
                  <LanguageSwitcher />
                </div>
                <Navbar />
              </header>
              <main className="flex-1 container mx-auto px-4 py-6">
                {children}
              </main>
              <footer className="relative h-24 mt-auto">
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent" />
                <div className="relative h-full flex items-center justify-center">
                  <img
                    src="/Tehnopol_logo_RGB.png"
                    alt="Tehnopol"
                    className="h-12 w-auto opacity-80 hover:opacity-100 transition-opacity"
                  />
                </div>
              </footer>
            </div>
          </AssessmentProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
} 
