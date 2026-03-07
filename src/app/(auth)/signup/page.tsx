"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * Normalise Supabase password-policy error messages.
 * Supabase sometimes returns a raw regex or pattern string (e.g. "ABCDE...").
 * We intercept those and return a human-readable message instead.
 */
function friendlyPasswordError(msg: string): string {
  const lower = msg.toLowerCase();
  if (
    lower.includes("abcde") ||
    lower.includes("characters") ||
    lower.includes("uppercase") ||
    lower.includes("lowercase") ||
    lower.includes("digit") ||
    lower.includes("special") ||
    lower.includes("password")
  ) {
    return "Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.";
  }
  return msg;
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleGoogleLogin = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPasswordError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    // Validate password strength
    if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      const friendly = friendlyPasswordError(error.message);
      // If the friendly helper changed the string, it's a password error
      if (friendly !== error.message) {
        setPasswordError(friendly);
      } else {
        setError(error.message);
      }
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-dvh bg-[#fdfbf5] flex flex-col items-center px-4 pb-20 pt-2.5 font-[family-name:var(--font-poppins)]">
        <div className="w-full max-w-[430px] flex flex-col gap-6 mt-10 text-center">
          <div className="bg-[#dcf5f0] border border-solid border-[#186346] rounded-[14px] px-6 py-8">
            <h2 className="text-[26px] font-semibold text-black mb-4">Check your email!</h2>
            <p className="text-black mb-4">
              We&apos;ve sent a confirmation link to <strong>{email}</strong>
            </p>
            <p className="text-sm text-black/50 leading-relaxed">
              Click the link in the email to activate your account, then come back to sign in.
            </p>
          </div>
          <Link href="/login" className="text-[#186346] hover:opacity-80 font-medium">
            ← Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#fdfbf5] flex flex-col items-center px-4 pb-20 pt-2.5 font-[family-name:var(--font-poppins)]">
      <div className="w-full max-w-[430px] flex flex-col gap-6 mt-10">
        {/* Heading */}
        <div>
          <h2 className="text-[26px] font-semibold text-black">
            Create your account
          </h2>
        </div>

        <form className="flex flex-col gap-5" onSubmit={handleSignup}>
          {/* General error */}
          {error && (
            <p className="text-sm text-red-600 mt-1 leading-relaxed">{error}</p>
          )}

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-black mb-1">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#f4f4f4] rounded-[14px] h-[50px] px-5 py-3 text-lg text-black placeholder:text-[#a0a09b] focus:ring-2 focus:ring-[#186346] outline-none"
              placeholder="you@example.com"
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-black mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#f4f4f4] rounded-[14px] h-[50px] px-5 py-3 text-lg text-black placeholder:text-[#a0a09b] focus:ring-2 focus:ring-[#186346] outline-none"
              placeholder="••••••••"
            />
            {passwordError && (
              <p className="text-sm text-red-600 mt-1 leading-relaxed">{passwordError}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-black mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[#f4f4f4] rounded-[14px] h-[50px] px-5 py-3 text-lg text-black placeholder:text-[#a0a09b] focus:ring-2 focus:ring-[#186346] outline-none"
              placeholder="••••••••"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-[50px] flex items-center justify-center bg-[#186346] text-white text-lg font-semibold rounded-[14px] hover:opacity-90 transition-opacity disabled:bg-[#e5e5e0] disabled:text-[#a0a09b] disabled:cursor-not-allowed"
          >
            {loading ? "Creating account..." : "Sign up"}
          </button>

          <p className="text-sm text-black/50 text-center">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-[#186346] hover:opacity-80">
              Sign in
            </Link>
          </p>
        </form>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-black/10" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-[#fdfbf5] text-black/50">Or continue with</span>
          </div>
        </div>

        {/* Google Sign Up */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full h-[50px] flex items-center justify-center gap-3 bg-[#f4f4f4] rounded-[14px] text-lg font-semibold text-black hover:bg-[#e8e8e8] transition-colors duration-150 cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign up with Google
        </button>
      </div>
    </div>
  );
}
