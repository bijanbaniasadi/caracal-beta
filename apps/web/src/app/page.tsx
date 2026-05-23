const services = [
  'Workshop portal',
  'Tool store',
  'Consulting dashboard',
  'Backend API',
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-16">
      <section className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Caracal Tech Motors
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-slate-950">
          Development scaffold is ready.
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-slate-700">
          This workspace is initialized for the beta platform monorepo described in the
          architecture documentation.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {services.map((service) => (
          <div key={service} className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <p className="font-medium text-slate-900">{service}</p>
            <p className="mt-1 text-sm text-slate-600">Workspace placeholder</p>
          </div>
        ))}
      </section>
    </main>
  );
}
