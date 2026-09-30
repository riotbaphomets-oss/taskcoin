import { logoutAction } from "@/app/actions/auth";
import { Logo } from "./Logo";

export function DashboardShell({
  name,
  title,
  children,
}: {
  name: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Logo />
          <div className="topbar-right">
            <span>{name}</span>
            <form action={logoutAction}>
              <button className="btn btn-ghost" type="submit">Abmelden</button>
            </form>
          </div>
        </div>
      </header>
      <main className="wrap dash">
        <h1>{title}</h1>
        {children}
      </main>
    </>
  );
}
