import Link from "next/link";

export default function ModulesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <nav className="border-b border-neutral-800 px-6 py-4 bg-neutral-950">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="font-mono text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            ← dsa-at-work
          </Link>
          <div className="flex items-center gap-6">
            {[
              { href: "/modules/01-dfs-thinking", label: "01 DFS" },
              { href: "/modules/02-retry-queue", label: "02 Queue" },
              { href: "/modules/03-sorting-tradeoffs", label: "03 Sorting" },
              { href: "/modules/04-hashmap-cache", label: "04 Cache" },
              { href: "/modules/05-sliding-window", label: "05 Rate Limiter" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="font-mono text-xs text-neutral-600 hover:text-neutral-300 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
      {children}
    </>
  );
}
