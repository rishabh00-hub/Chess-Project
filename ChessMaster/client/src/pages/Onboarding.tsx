import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

interface PendingProfile {
  email: string;
  firstName: string;
  lastName: string;
}

export default function Onboarding() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [pending, setPending] = useState<PendingProfile | null>(null);
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user) {
      setLocation("/");
    }
  }, [authLoading, user, setLocation]);

  useEffect(() => {
    async function loadPending() {
      try {
        const response = await fetch("/api/users/pending", {
          credentials: "include"
        });
        if (!response.ok) {
          setStatus("Unable to load onboarding profile. Please sign in again.");
          return;
        }
        const profile = await response.json();
        if (!profile) {
          setStatus("No pending onboarding session found. Please sign in again.");
          return;
        }
        setPending(profile);
        setFirstName(profile.firstName || "");
        setLastName(profile.lastName || "");
      } catch (err) {
        setStatus("Unable to load onboarding profile. Try again later.");
      } finally {
        setIsLoading(false);
      }
    }
    loadPending();
  }, []);

  const validateUsername = async (value: string) => {
    setUsername(value);
    setUsernameAvailable(null);
    if (!value || value.trim().length < 3) {
      setUsernameAvailable(null);
      return;
    }
    try {
      const response = await fetch("/api/users/check-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: value.trim() }),
        credentials: "include"
      });
      const data = await response.json();
      setUsernameAvailable(data.available ?? false);
    } catch (err) {
      setUsernameAvailable(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setStatus("");

    const trimmedUsername = username.trim();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedUsername || trimmedUsername.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    if (!trimmedFirstName || !trimmedLastName) {
      setError("First and last name are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/users/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: trimmedUsername,
          firstName: trimmedFirstName,
          lastName: trimmedLastName
        })
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        setError(result?.message || "Onboarding failed. Please try again.");
        return;
      }
      setLocation("/");
    } catch (err) {
      setError("Unable to complete onboarding. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setLocation("/");
  };

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white">Loading onboarding...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4 py-10">
      <Card className="w-full max-w-lg bg-slate-800 border-slate-700">
        <CardContent className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-white">Complete your ChessFlow profile</h1>
            <p className="text-slate-400 mt-2">
              We found your Zoho account. Finish onboarding by choosing a unique username.
            </p>
          </div>

          {status ? (
            <div className="rounded-lg border border-rose-500 bg-rose-950/20 p-4 text-sm text-rose-200">
              {status}
            </div>
          ) : null}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="First name"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder="Last name"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(event) => validateUsername(event.target.value)}
                placeholder="Choose a username"
                autoComplete="username"
              />
              <p className="mt-2 text-sm text-slate-400">
                Choose a public username for leaderboards and match history.
              </p>
              {usernameAvailable === true && (
                <p className="mt-2 text-sm text-emerald-300">Username is available.</p>
              )}
              {usernameAvailable === false && (
                <p className="mt-2 text-sm text-rose-300">This username is already taken.</p>
              )}
            </div>

            {error ? (
              <div className="rounded-lg border border-rose-500 bg-rose-950/20 p-3 text-sm text-rose-200">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Complete Onboarding'}
              </Button>
              <Button variant="secondary" type="button" className="w-full sm:w-auto" onClick={handleCancel}>
                Return to Home
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
