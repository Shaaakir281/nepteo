export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="text-center text-sm font-semibold text-accent">Nepteo</p>
        <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          {children}
        </div>
      </div>
    </main>
  );
}
