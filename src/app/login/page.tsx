import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/auth";

const errors: Record<string, string> = {
  CredentialsSignin: "אימייל או סיסמה שגויים",
  AccessDenied: "המשתמש לא מורשה. פנה למנהל המערכת",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await auth()) redirect("/");
  const { error } = await searchParams;

  async function google() {
    "use server";
    await signIn("google", { redirectTo: "/" });
  }

  async function credentials(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", { email: formData.get("email"), password: formData.get("password"), redirectTo: "/" });
    } catch (e) {
      if (e instanceof AuthError) redirect(`/login?error=${e.type}`);
      throw e; // the success redirect is thrown too
    }
  }

  const googleEnabled = !!process.env.AUTH_GOOGLE_ID; // hidden until Google OAuth is configured
  const message =typeof error === "string" ? (errors[error] ?? "הכניסה נכשלה, נסה שוב") : null;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="glass w-full max-w-sm p-8 text-center">
        <div className="bg-primary-gradient mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl text-2xl text-white">
          ✦
        </div>
        <h1 className="text-2xl font-bold">CRM השמה</h1>
        <p className="mb-6 text-sm text-slate-500">כניסה למערכת</p>

        {message && <p className="mb-4 rounded-lg bg-red-50 p-2 text-sm text-red-600">{message}</p>}

        {googleEnabled && (
          <form action={google}>
            <button className="w-full rounded-xl bg-white p-3 font-medium shadow-sm hover:shadow">התחבר עם Google</button>
          </form>
        )}

        <details open={!googleEnabled} className="mt-4 text-sm text-slate-500">
          <summary className="cursor-pointer">התחברות עם אימייל וסיסמה</summary>
          <form action={credentials} className="mt-4 space-y-3 text-start">
            <input name="email" type="email" required placeholder="אימייל" dir="ltr" className="w-full rounded-xl border border-slate-200 bg-white p-3" />
            <input name="password" type="password" required placeholder="סיסמה" dir="ltr" className="w-full rounded-xl border border-slate-200 bg-white p-3" />
            <button className="bg-accent-gradient w-full rounded-xl p-3 font-medium text-white">כניסה</button>
          </form>
        </details>
      </div>
    </main>
  );
}
