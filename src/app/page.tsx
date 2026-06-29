"use client";

import { type FormEvent, useState } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/lib/api";
import {
  createClient,
  hasSupabaseBrowserConfig,
} from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [loginIdentity, setLoginIdentity] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [requestPending, setRequestPending] = useState(false);
  const [loginPending, setLoginPending] = useState(false);

  async function handleRequestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestPending(true);

    try {
      await apiFetch("/v1/invitations", {
        body: {
          displayName: requestName,
          email: requestEmail,
        },
        method: "POST",
      });
      setRequestSent(true);
      setRequestOpen(false);
      toast.success("Anfrage gespeichert", {
        description: `${requestName.trim()} wartet jetzt auf Admin-Freigabe.`,
      });
    } catch (error) {
      toast.error("Anfrage fehlgeschlagen", {
        description:
          error instanceof Error
            ? error.message
            : "Bitte Backend-Verbindung prüfen.",
      });
    } finally {
      setRequestPending(false);
    }
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginPending(true);

    try {
      if (!hasSupabaseBrowserConfig()) {
        throw new Error("Supabase Env Vars fehlen im Frontend.");
      }

      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: loginIdentity,
        password: loginCode,
      });

      if (error) {
        throw error;
      }

      toast.success("Du bist drin", {
        description: "Supabase-Login aktiv.",
      });
      router.push("/dashboard");
    } catch (error) {
      toast.error("Login fehlgeschlagen", {
        description:
          error instanceof Error
            ? error.message
            : "E-Mail oder Passwort prüfen.",
      });
    } finally {
      setLoginPending(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,#eff6ff_0,#ffffff_34%,#fafafa_100%)] text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-white text-sm font-semibold text-sky-600 shadow-[0_8px_24px_rgba(14,165,233,0.10)] ring-1 ring-sky-100">
              A
            </div>
            <span className="text-sm font-medium tracking-tight">
              Ayri Leaderboard
            </span>
          </div>
          <Badge className="rounded-lg border-sky-100 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-sky-700 shadow-sm">
            Sommer 2026
          </Badge>
        </header>

        <div className="grid flex-1 content-start gap-8 pb-8 pt-10 lg:grid-cols-[minmax(0,1fr)_390px] lg:content-center lg:items-center lg:gap-12">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="space-y-7 text-center sm:text-left"
            initial={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <div className="space-y-4">
              <h1 className="mx-auto max-w-[11ch] text-5xl font-semibold leading-[0.95] tracking-normal text-zinc-950 sm:mx-0 sm:text-6xl lg:text-7xl">
                Wer ist der größte{" "}
                <span className="bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-500 bg-clip-text text-transparent">
                  Ayri
                </span>
                ?
              </h1>
              <p className="mx-auto max-w-md text-base leading-7 text-zinc-500 sm:mx-0">
                Eine geschlossene Runde. Erst anfragen, dann vom Admin
                freigeben lassen und einloggen.
              </p>
            </div>

            <div className="grid gap-3 sm:flex">
              <Button
                className="h-11 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 text-white shadow-[0_12px_30px_rgba(37,99,235,0.22)] hover:from-sky-500 hover:to-blue-700 focus-visible:ring-2 focus-visible:ring-sky-200"
                onClick={() => setRequestOpen(true)}
                type="button"
              >
                Anfrage stellen
                <ArrowRight className="size-4" />
              </Button>
              <Button
                className="h-11 rounded-lg border-zinc-200 bg-white/80 px-4 text-zinc-700 shadow-sm hover:bg-white focus-visible:ring-2 focus-visible:ring-sky-200"
                onClick={() =>
                  document
                    .getElementById("login-panel")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" })
                }
                type="button"
                variant="outline"
              >
                Login
              </Button>
            </div>
          </motion.div>

          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="mx-auto w-full max-w-sm lg:max-w-none"
            id="login-panel"
            initial={{ opacity: 0, scale: 0.98, y: 18 }}
            transition={{ delay: 0.08, duration: 0.42, ease: "easeOut" }}
          >
            <Card className="rounded-lg border-0 bg-white/85 shadow-[0_24px_80px_rgba(15,23,42,0.08)] ring-1 ring-zinc-950/10 backdrop-blur">
              <CardHeader className="gap-2 px-5 pt-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">Login</CardTitle>
                    <CardDescription>
                      Mit freigegebener E-Mail und Admin-Passwort.
                    </CardDescription>
                  </div>
                  <div className="grid size-9 place-items-center rounded-lg bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                    <LockKeyhole className="size-4" />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="px-5 pb-5">
                <form className="space-y-4" onSubmit={handleLoginSubmit}>
                  <div className="space-y-2">
                    <Label htmlFor="login-identity">E-Mail</Label>
                    <div className="relative">
                      <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        className="h-11 rounded-lg border-zinc-200 bg-white pl-9 text-sm shadow-sm focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-100"
                        id="login-identity"
                        onChange={(event) =>
                          setLoginIdentity(event.target.value)
                        }
                        placeholder="timo@mail.com"
                        type="email"
                        value={loginIdentity}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-code">Passwort</Label>
                    <div className="relative">
                      <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        className="h-11 rounded-lg border-zinc-200 bg-white pl-9 text-sm shadow-sm focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-100"
                        id="login-code"
                        onChange={(event) => setLoginCode(event.target.value)}
                        placeholder="Admin-Passwort"
                        type="password"
                        value={loginCode}
                      />
                    </div>
                  </div>

                  <Button
                    className="h-11 w-full rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-sky-200"
                    disabled={loginPending}
                    type="submit"
                  >
                    {loginPending ? "Logge ein..." : "Einloggen"}
                    <ArrowRight className="size-4" />
                  </Button>

                  <Separator className="bg-zinc-100" />

                  <Button
                    className="h-11 w-full rounded-lg border-sky-100 bg-sky-50/70 text-sky-700 hover:bg-sky-50 focus-visible:ring-2 focus-visible:ring-sky-200"
                    onClick={() => setRequestOpen(true)}
                    type="button"
                    variant="outline"
                  >
                    Zugang anfragen
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="rounded-lg border-0 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.14)] ring-1 ring-zinc-950/10 sm:max-w-[380px]">
          <DialogHeader>
            <div className="mb-1 grid size-10 place-items-center rounded-lg bg-gradient-to-br from-sky-50 to-white text-sky-600 ring-1 ring-sky-100">
              <Mail className="size-4" />
            </div>
            <DialogTitle className="text-xl">Zugang anfragen</DialogTitle>
            <DialogDescription>
              Name und E-Mail gehen später an den Admin.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleRequestSubmit}>
            <div className="space-y-2">
              <Label htmlFor="request-name">Name</Label>
              <Input
                className="h-11 rounded-lg border-zinc-200 bg-white text-sm shadow-sm focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-100"
                id="request-name"
                onChange={(event) => setRequestName(event.target.value)}
                placeholder="Timo"
                required
                value={requestName}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="request-email">E-Mail</Label>
              <Input
                className="h-11 rounded-lg border-zinc-200 bg-white text-sm shadow-sm focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-100"
                id="request-email"
                onChange={(event) => setRequestEmail(event.target.value)}
                placeholder="timo@mail.com"
                required
                type="email"
                value={requestEmail}
              />
            </div>

            <Button
              className="h-11 w-full rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-[0_12px_30px_rgba(37,99,235,0.20)] hover:from-sky-500 hover:to-blue-700 focus-visible:ring-2 focus-visible:ring-sky-200"
              disabled={requestPending}
              type="submit"
            >
              {requestPending ? "Sendet..." : "Anfrage senden"}
              <ArrowRight className="size-4" />
            </Button>

            {requestSent && (
              <p className="text-center text-xs font-medium text-sky-700">
                Anfrage liegt bereit.
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
