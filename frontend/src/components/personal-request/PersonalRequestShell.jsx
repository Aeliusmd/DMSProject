import Image from "next/image";
import Link from "next/link";

export default function PersonalRequestShell({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F5F7FA]">
      <header className="border-b border-[#E5E7EB] bg-white">
        <div className="mx-auto flex h-[64px] w-full max-w-[1100px] items-center px-4 sm:px-6">
          <Link href="/landingpage" className="flex items-center gap-2.5">
            <Image
              src="/images/logo.png"
              alt="DMS Records"
              width={36}
              height={28}
              priority
              style={{ height: "auto" }}
            />
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-[#111827]">
              DMS Records
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[720px] flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>

      <footer className="border-t border-[#E5E7EB] bg-white">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-3 px-4 py-5 text-[12px] text-[#94A3B8] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} DMS Records. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>Contact</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
