import { Logo } from "@/components/Logo";
import { AuthForm } from "@/components/AuthForm";

export default function RegisterPage() {
  return (
    <>
      <header className="topbar"><div className="wrap"><Logo /></div></header>
      <main className="wrap"><AuthForm mode="register" /></main>
    </>
  );
}
