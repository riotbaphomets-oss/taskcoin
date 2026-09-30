export type Role = "WORKER" | "CLIENT" | "ADMIN";

export function homeFor(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "CLIENT":
      return "/client";
    default:
      return "/worker";
  }
}

export function areaFor(pathname: string): Role | null {
  if (pathname.startsWith("/admin")) return "ADMIN";
  if (pathname.startsWith("/client")) return "CLIENT";
  if (pathname.startsWith("/worker")) return "WORKER";
  return null;
}
