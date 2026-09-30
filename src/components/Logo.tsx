import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="logo">
      <span className="coin" aria-hidden="true" />
      TaskCoin
    </Link>
  );
}
