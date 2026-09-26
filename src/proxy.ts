import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Checagem otimista (só verifica o JWT). A autorização real fica em getContexto().
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ["/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|.*\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|woff2?)$).*)"],
};
