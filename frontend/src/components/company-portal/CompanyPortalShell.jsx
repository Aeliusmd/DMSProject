import Image from "next/image";

export default function CompanyPortalShell({
  title,
  subtitle = "Company Portal",
  children,
  footer,
  maxWidthClassName = "max-w-[480px]",
}) {
  return (
    <main
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{
        background:
          "radial-gradient(circle at 12% 0%, rgba(0, 151, 178, 0.10), transparent 28%), linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)",
      }}
    >
      <div className={`w-full ${maxWidthClassName}`}>
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3.5 flex justify-center">
            <Image
              src="/images/logo.png"
              alt="DMS Logo"
              width={62}
              height={40}
              priority
              style={{ height: "auto" }}
              className="w-[62px]"
            />
          </div>
          <p className="text-[12px] text-[#64748B]">{subtitle}</p>
          {title ? (
            <h1 className="mt-3 text-[22px] font-semibold tracking-[-0.02em] text-[#111827]">
              {title}
            </h1>
          ) : null}
        </div>

        <section className="rounded-[9px] border border-[#E2E8F0] bg-white px-6 py-7 shadow-sm sm:px-8">
          {children}
        </section>

        {footer ? (
          <div className="mt-6 text-center text-[12px] text-[#64748B]">
            {footer}
          </div>
        ) : null}
      </div>
    </main>
  );
}
