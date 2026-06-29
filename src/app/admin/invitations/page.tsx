"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clipboard,
  KeyRound,
  Mail,
  ShieldCheck,
  UserPlus,
  X,
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
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/lib/api";
import {
  createClient,
  hasSupabaseBrowserConfig,
} from "@/lib/supabase/client";

type Invitation = {
  acceptedAt: string | null;
  acceptedBy: string | null;
  createdUserId: string | null;
  displayName: string;
  email: string;
  id: string;
  requestedAt: string;
  status: "accepted" | "pending" | "rejected";
};

type AdminMeResponse = {
  user: {
    displayName: string;
    email: string;
    id: string;
    role: "admin" | "user";
  };
};

type InvitationsResponse = {
  invitations: Invitation[];
};

type AcceptResponse = {
  invitation: Invitation;
  temporaryPassword: string;
  user: {
    displayName: string;
    email: string;
    id: string;
    role: "admin" | "user";
  };
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

export default function AdminInvitationsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [adminName, setAdminName] = useState("");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [passwordByInvitation, setPasswordByInvitation] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => invitations.filter((item) => item.status === "pending").length,
    [invitations],
  );

  useEffect(() => {
    async function load() {
      try {
        if (!hasSupabaseBrowserConfig()) {
          throw new Error("Supabase Env Vars fehlen im Frontend.");
        }

        const supabase = createClient();
        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session?.access_token) {
          router.push("/");
          return;
        }

        setToken(data.session.access_token);

        const me = await apiFetch<AdminMeResponse>("/v1/me", {
          token: data.session.access_token,
        });

        if (me.user.role !== "admin") {
          toast.error("Admin-Zugang erforderlich");
          router.push("/dashboard");
          return;
        }

        setAdminName(me.user.displayName);
        const response = await apiFetch<InvitationsResponse>(
          "/v1/admin/invitations",
          {
            token: data.session.access_token,
          },
        );
        setInvitations(response.invitations);
      } catch (error) {
        toast.error("Admin-Daten konnten nicht geladen werden", {
          description:
            error instanceof Error
              ? error.message
              : "Bitte Backend und Supabase prüfen.",
        });
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [router]);

  async function refreshInvitations(authToken = token) {
    if (!authToken) {
      return;
    }

    const response = await apiFetch<InvitationsResponse>(
      "/v1/admin/invitations",
      {
        token: authToken,
      },
    );
    setInvitations(response.invitations);
  }

  async function acceptInvitation(invitation: Invitation) {
    if (!token) {
      return;
    }

    setBusyId(invitation.id);

    try {
      const response = await apiFetch<AcceptResponse>(
        `/v1/admin/invitations/${invitation.id}/accept`,
        {
          body: {
            role: "user",
          },
          method: "POST",
          token,
        },
      );

      setPasswordByInvitation((current) => ({
        ...current,
        [invitation.id]: response.temporaryPassword,
      }));
      await refreshInvitations();
      toast.success("Einladung angenommen", {
        description: `${response.user.displayName} kann sich jetzt einloggen.`,
      });
    } catch (error) {
      toast.error("Annahme fehlgeschlagen", {
        description:
          error instanceof Error ? error.message : "Bitte erneut versuchen.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function rejectInvitation(invitation: Invitation) {
    if (!token) {
      return;
    }

    setBusyId(invitation.id);

    try {
      await apiFetch(`/v1/admin/invitations/${invitation.id}/reject`, {
        method: "POST",
        token,
      });
      await refreshInvitations();
      toast.success("Einladung abgelehnt");
    } catch (error) {
      toast.error("Ablehnen fehlgeschlagen", {
        description:
          error instanceof Error ? error.message : "Bitte erneut versuchen.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function copyPassword(password: string) {
    await navigator.clipboard.writeText(password);
    toast.success("Passwort kopiert");
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] text-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-1">
          <div>
            <p className="text-xs font-medium text-zinc-400">Admin</p>
            <h1 className="text-xl font-semibold tracking-normal">
              Einladungen
            </h1>
          </div>
          <Button
            className="h-9 rounded-lg border-zinc-200 bg-white text-zinc-700 shadow-sm hover:bg-zinc-50"
            onClick={() => router.push("/dashboard")}
            type="button"
            variant="outline"
          >
            Dashboard
          </Button>
        </header>

        <section className="rounded-lg border border-sky-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-sky-50 text-sky-600 ring-1 ring-sky-100">
              <ShieldCheck className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-zinc-500">
                Eingeloggt als {adminName || "Admin"}
              </p>
              <h2 className="text-2xl font-semibold tracking-normal">
                {pendingCount} offene Anfrage{pendingCount === 1 ? "" : "n"}
              </h2>
            </div>
            <Badge className="rounded-lg border-sky-100 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
              Role admin
            </Badge>
          </div>
        </section>

        <Card className="rounded-lg border-0 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.06)] ring-1 ring-zinc-950/10">
          <CardHeader className="gap-1 px-4 pt-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Anfragen verwalten</CardTitle>
                <CardDescription>
                  Akzeptieren erzeugt einen Supabase-Account und ein Passwort.
                </CardDescription>
              </div>
              <div className="grid size-9 place-items-center rounded-lg bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                <UserPlus className="size-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {loading ? (
              <div className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-500">
                Lädt...
              </div>
            ) : invitations.length === 0 ? (
              <div className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-500">
                Noch keine Anfragen.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg ring-1 ring-zinc-100">
                {invitations.map((invitation, index) => {
                  const password = passwordByInvitation[invitation.id];
                  const isBusy = busyId === invitation.id;

                  return (
                    <div key={invitation.id}>
                      <div className="space-y-3 p-3">
                        <div className="flex items-center gap-3">
                          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-zinc-50 text-zinc-500 ring-1 ring-zinc-100">
                            <Mail className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {invitation.displayName}
                            </p>
                            <p className="truncate text-xs text-zinc-500">
                              {invitation.email} · {formatDate(invitation.requestedAt)}
                            </p>
                          </div>
                          <Badge
                            className={[
                              "rounded-lg px-2 py-1 text-[11px] font-medium",
                              invitation.status === "pending"
                                ? "border-sky-100 bg-sky-50 text-sky-700"
                                : invitation.status === "accepted"
                                  ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                                  : "border-zinc-100 bg-zinc-50 text-zinc-500",
                            ].join(" ")}
                          >
                            {invitation.status}
                          </Badge>
                        </div>

                        {password && (
                          <div className="flex items-center gap-2 rounded-lg border border-sky-100 bg-sky-50/70 p-2">
                            <KeyRound className="size-4 text-sky-600" />
                            <code className="min-w-0 flex-1 truncate font-mono text-xs text-sky-800">
                              {password}
                            </code>
                            <Button
                              className="size-8 rounded-lg bg-white text-sky-700 shadow-sm hover:bg-white"
                              onClick={() => copyPassword(password)}
                              size="icon"
                              type="button"
                              variant="ghost"
                            >
                              <Clipboard className="size-4" />
                            </Button>
                          </div>
                        )}

                        {invitation.status === "pending" && (
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              className="h-10 rounded-lg bg-zinc-950 text-white hover:bg-zinc-800"
                              disabled={isBusy}
                              onClick={() => acceptInvitation(invitation)}
                              type="button"
                            >
                              <Check className="size-4" />
                              Annehmen
                            </Button>
                            <Button
                              className="h-10 rounded-lg border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                              disabled={isBusy}
                              onClick={() => rejectInvitation(invitation)}
                              type="button"
                              variant="outline"
                            >
                              <X className="size-4" />
                              Ablehnen
                            </Button>
                          </div>
                        )}
                      </div>
                      {index < invitations.length - 1 && (
                        <Separator className="bg-zinc-100" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
