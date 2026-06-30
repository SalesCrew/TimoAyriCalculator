"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Beer,
  BottleWine,
  Check,
  ChevronDown,
  Clock3,
  Crown,
  Flame,
  GlassWater,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Skull,
  TrendingUp,
  Trophy,
  type LucideIcon,
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

type ParticipantDay = {
  date: string;
  entries: number;
  ml: number;
};

type ParticipantHistory = {
  days: ParticipantDay[];
  lastDrink: string | null;
  name: string;
};

type LeaderboardPerson = ParticipantHistory & {
  pureAlcoholMl: number;
  rank: number;
};

type CumulativePoint = ParticipantDay & {
  cumulative: number;
};

type DashboardDrink = {
  abv: number;
  category?: string;
  icon: LucideIcon;
  id?: string;
  isActive?: boolean;
  name: string;
};

type ApiDrinkType = {
  abvPercent: number;
  category: string;
  id: string;
  isActive: boolean;
  name: string;
};

type DashboardSubmission = {
  alcohol: number;
  drink: string;
  person: string;
  time: string;
  units: number;
  volume: number;
};

type ApiDrinkEntry = {
  abvPercent: number;
  consumedAt: string;
  createdAt: string;
  drinkName: string;
  drinkTypeId: string | null;
  id: string;
  pureAlcoholMl: number;
  units: number;
  userDisplayName: string;
  userId: string;
  volumeMl: number;
};

type DashboardLeaderboardRow = {
  displayName: string;
  lastDrink: string | null;
  pureAlcoholMl: number;
  rank: number;
  role?: "admin" | "user";
  userId?: string;
};

type PodiumSlot = {
  heightClassName: string;
  rank: 1 | 2 | 3;
  user?: DashboardLeaderboardRow;
};

type MeResponse = {
  user: {
    displayName: string;
    email: string;
    id: string;
    role: "admin" | "user";
  };
};

type DrinkTypesResponse = {
  drinkTypes: ApiDrinkType[];
};

type LeaderboardResponse = {
  leaderboard: DashboardLeaderboardRow[];
};

type ActivityResponse = {
  activity: ApiDrinkEntry[];
};

type DrinkEntryResponse = {
  entry: ApiDrinkEntry;
};

type ParticipantHistoryResponse = {
  history: {
    days: ParticipantDay[];
    displayName: string;
    lastDrink: string | null;
    pureAlcoholMl: number;
    userId: string;
  };
};

function normalizeSearch(value: string) {
  return value
    .toLocaleLowerCase("de-AT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss");
}

function getCumulativePoints(days: ParticipantDay[]) {
  let total = 0;

  return days.map((day) => {
    total += day.ml;

    return {
      ...day,
      cumulative: Number(total.toFixed(1)),
    };
  });
}

const volumeOptions = [250, 330, 500];

function getDrinkIcon(item: Pick<ApiDrinkType, "category" | "name">) {
  if (item.category === "beer") {
    return Beer;
  }

  if (["sparkling", "wine", "wine_mix"].includes(item.category)) {
    return BottleWine;
  }

  if (["shot_mix", "spirit"].includes(item.category)) {
    return Flame;
  }

  return GlassWater;
}

function mapApiDrinkType(item: ApiDrinkType): DashboardDrink {
  return {
    abv: item.abvPercent,
    category: item.category,
    icon: getDrinkIcon(item),
    id: item.id,
    isActive: item.isActive,
    name: item.name,
  };
}

function mapApiEntry(entry: ApiDrinkEntry): DashboardSubmission {
  return {
    alcohol: entry.pureAlcoholMl,
    drink: entry.drinkName,
    person: entry.userDisplayName,
    time: new Intl.DateTimeFormat("de-AT", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(entry.consumedAt)),
    units: entry.units,
    volume: entry.volumeMl,
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [selectedDrink, setSelectedDrink] = useState("");
  const [drinkMenuOpen, setDrinkMenuOpen] = useState(false);
  const [drinkSearch, setDrinkSearch] = useState("");
  const [selectedVolume, setSelectedVolume] = useState(500);
  const [units, setUnits] = useState(1);
  const [submissions, setSubmissions] = useState<DashboardSubmission[]>([]);
  const [drinkOptions, setDrinkOptions] = useState<DashboardDrink[]>([]);
  const [leaderboardRows, setLeaderboardRows] =
    useState<DashboardLeaderboardRow[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [participantRows, setParticipantRows] =
    useState<LeaderboardPerson[]>([]);
  const [expandedParticipant, setExpandedParticipant] = useState<string | null>(
    null,
  );
  const drinkDropdownRef = useRef<HTMLDivElement>(null);
  const drinkSearchRef = useRef<HTMLInputElement>(null);

  const drink = useMemo(
    () => drinkOptions.find((item) => item.name === selectedDrink),
    [drinkOptions, selectedDrink],
  );
  const SelectedDrinkIcon = drink?.icon ?? GlassWater;

  const podiumSlots = useMemo<PodiumSlot[]>(() => {
    const sorted = [...leaderboardRows].sort((first, second) => {
      if (first.rank !== second.rank) {
        return first.rank - second.rank;
      }

      return second.pureAlcoholMl - first.pureAlcoholMl;
    });
    const rowsByRank = new Map(sorted.map((row) => [row.rank, row]));

    return [
      { heightClassName: "h-16", rank: 2, user: rowsByRank.get(2) },
      { heightClassName: "h-24", rank: 1, user: rowsByRank.get(1) },
      { heightClassName: "h-12", rank: 3, user: rowsByRank.get(3) },
    ];
  }, [leaderboardRows]);

  const currentAyri = useMemo(() => {
    return (
      [...leaderboardRows].sort(
        (first, second) => first.pureAlcoholMl - second.pureAlcoholMl,
      )[0] ?? null
    );
  }, [leaderboardRows]);

  const filteredDrinkTypes = useMemo(() => {
    const query = normalizeSearch(drinkSearch.trim());

    if (!query) {
      return drinkOptions;
    }

    return drinkOptions.filter((item) =>
      normalizeSearch(`${item.name} ${item.abv.toFixed(1)}`).includes(query),
    );
  }, [drinkOptions, drinkSearch]);

  const pureAlcohol = useMemo(
    () => selectedVolume * units * ((drink?.abv ?? 0) / 100),
    [drink?.abv, selectedVolume, units],
  );

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        drinkDropdownRef.current &&
        !drinkDropdownRef.current.contains(event.target as Node)
      ) {
        setDrinkMenuOpen(false);
        setDrinkSearch("");
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrinkMenuOpen(false);
        setDrinkSearch("");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!drinkMenuOpen) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      drinkSearchRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [drinkMenuOpen]);

  useEffect(() => {
    async function loadDashboard() {
      if (!hasSupabaseBrowserConfig()) {
        toast.error("Frontend ist nicht live konfiguriert", {
          description: "Supabase Env Vars fehlen.",
        });
        router.push("/");
        return;
      }

      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        router.push("/");
        return;
      }

      setAccessToken(token);

      try {
        const [me, drinks, board, activity] = await Promise.all([
          apiFetch<MeResponse>("/v1/me", { token }),
          apiFetch<DrinkTypesResponse>("/v1/drink-types", { token }),
          apiFetch<LeaderboardResponse>("/v1/leaderboard", { token }),
          apiFetch<ActivityResponse>("/v1/activity?limit=10", { token }),
        ]);
        const mappedDrinks = drinks.drinkTypes.map(mapApiDrinkType);

        setIsAdmin(me.user.role === "admin");
        setDrinkOptions(mappedDrinks);
        setLeaderboardRows(board.leaderboard);
        setSubmissions(activity.activity.map(mapApiEntry));

        setSelectedDrink((current) =>
          mappedDrinks.some((item) => item.name === current)
            ? current
            : mappedDrinks[0]?.name ?? "",
        );
      } catch (error) {
        toast.error("Live-Daten konnten nicht geladen werden", {
          description:
            error instanceof Error
              ? error.message
              : "Bitte Backend und Env Vars pruefen.",
        });
      }
    }

    void loadDashboard();
  }, [router]);

  async function openParticipants() {
    setParticipantsOpen(true);

    if (!accessToken) {
      return;
    }

    const rowsWithIds = leaderboardRows.filter((row) => row.userId);

    if (rowsWithIds.length === 0) {
      setParticipantRows([]);
      setExpandedParticipant(null);
      return;
    }

    try {
      const histories = await Promise.all(
        rowsWithIds.map(async (row) => {
          const response = await apiFetch<ParticipantHistoryResponse>(
            `/v1/participants/${row.userId}/history`,
            {
              token: accessToken,
            },
          );

          return {
            days: response.history.days,
            lastDrink: response.history.lastDrink,
            name: response.history.displayName,
            pureAlcoholMl: response.history.pureAlcoholMl,
            rank: row.rank,
          };
        }),
      );

      setParticipantRows(histories);
      setExpandedParticipant((current) =>
        current && histories.some((person) => person.name === current)
          ? current
          : histories[0]?.name ?? null,
      );
    } catch (error) {
      toast.error("History konnte nicht geladen werden", {
        description:
          error instanceof Error ? error.message : "Bitte spaeter erneut versuchen.",
      });
    }
  }

  function toggleDrinkMenu() {
    if (drinkMenuOpen) {
      setDrinkSearch("");
    }

    setDrinkMenuOpen((open) => !open);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken || !drink?.id) {
      toast.error("Submit nicht bereit", {
        description: "Bitte warten, bis Live-Daten geladen sind.",
      });
      return;
    }

    try {
      const response = await apiFetch<DrinkEntryResponse>("/v1/drink-entries", {
        body: {
          drinkTypeId: drink.id,
          units,
          volumeMl: selectedVolume,
        },
        method: "POST",
        token: accessToken,
      });
      const leaderboardResponse = await apiFetch<LeaderboardResponse>(
        "/v1/leaderboard",
        {
          token: accessToken,
        },
      );

      setSubmissions((current) =>
        [mapApiEntry(response.entry), ...current].slice(0, 10),
      );
      setLeaderboardRows(leaderboardResponse.leaderboard);
      toast.success("Drink submitted", {
        description: `${units}x ${selectedVolume} ml ${drink.name}`,
      });
    } catch (error) {
      toast.error("Submit fehlgeschlagen", {
        description:
          error instanceof Error ? error.message : "Backend-Verbindung pruefen.",
      });
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] text-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-1">
          <div>
            <p className="text-xs font-medium text-zinc-400">Dashboard</p>
            <h1 className="text-xl font-semibold tracking-normal">
              Ayri Leaderboard
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                className="h-9 rounded-lg border-sky-100 bg-white px-3 text-xs text-sky-700 shadow-sm hover:bg-sky-50"
                onClick={() => router.push("/admin/invitations")}
                type="button"
                variant="outline"
              >
                <ShieldCheck className="size-4" />
                Admin
              </Button>
            )}
            <Badge className="rounded-lg border-sky-100 bg-white px-2.5 py-1 text-[11px] font-medium text-sky-700 shadow-sm">
              Live
            </Badge>
          </div>
        </header>

        <section aria-labelledby="podium-title" className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <h2 id="podium-title" className="text-base font-semibold">
                Stärkste 3 Trinker
              </h2>
              <p className="text-sm text-zinc-500">Reiner Alkohol in ml</p>
            </div>
            <Button
              aria-label="Alle Beteiligten und Verlauf öffnen"
              className="size-9 rounded-lg border border-sky-100 bg-white text-sky-500 shadow-sm hover:bg-sky-50 hover:text-sky-600 focus-visible:ring-2 focus-visible:ring-sky-100"
              disabled={leaderboardRows.length === 0}
              onClick={openParticipants}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Trophy className="size-5" />
            </Button>
          </div>

          <div className="grid grid-cols-3 items-end gap-2">
            {podiumSlots.map((slot) => {
              const user = slot.user;
              const isPlaceholder = !user;

              return (
                <div className="flex flex-col items-center gap-2" key={slot.rank}>
                  <div
                    className={[
                      "w-full rounded-lg p-2.5 text-center shadow-[0_14px_45px_rgba(15,23,42,0.05)] ring-1",
                      isPlaceholder
                        ? "border border-dashed border-zinc-200 bg-white/70 text-zinc-400 ring-zinc-950/5"
                        : "bg-white ring-zinc-950/10",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-center gap-1 text-xs font-medium text-zinc-400">
                      {slot.rank === 1 && (
                        <Crown
                          className={[
                            "size-3",
                            isPlaceholder ? "text-zinc-300" : "text-sky-500",
                          ].join(" ")}
                        />
                      )}
                      <span>#{slot.rank}</span>
                    </div>
                    <div
                      className={[
                        "truncate text-sm font-semibold",
                        isPlaceholder ? "text-zinc-400" : "text-zinc-950",
                      ].join(" ")}
                    >
                      {user?.displayName ?? "Noch offen"}
                    </div>
                    <div
                      className={[
                        "font-mono text-[11px]",
                        isPlaceholder ? "text-zinc-300" : "text-sky-600",
                      ].join(" ")}
                    >
                      {user ? `${user.pureAlcoholMl} ml` : "--"}
                    </div>
                  </div>
                  <div
                    className={[
                      "w-full rounded-t-lg ring-1",
                      slot.heightClassName,
                      isPlaceholder
                        ? "bg-gradient-to-b from-zinc-50 to-white ring-zinc-100"
                        : "bg-gradient-to-b from-sky-100 to-white ring-sky-100",
                    ].join(" ")}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <section
          aria-label="Aktuell größter Ayri"
          className="rounded-lg border border-red-100 bg-red-50/45 p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-white text-red-500 ring-1 ring-red-100">
              <Skull className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-red-500/80">
                Aktuell größter Ayri
              </p>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="truncate text-2xl font-semibold tracking-normal">
                  {currentAyri?.displayName ?? "Noch niemand"}
                </h2>
                <span className="font-mono text-sm text-red-600">
                  {currentAyri ? `${currentAyri.pureAlcoholMl} ml` : "0 ml"}
                </span>
              </div>
              <p className="text-sm text-red-700/70">
                Zuletzt gesehen mit {currentAyri?.lastDrink ?? "keinem Drink"}.
              </p>
            </div>
          </div>
        </section>

        <Card className="relative z-20 overflow-visible rounded-lg border-0 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.06)] ring-1 ring-zinc-950/10">
          <CardHeader className="gap-1 px-4 pt-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Drink submitten</CardTitle>
                <CardDescription>
                  Getränk, Menge und Units auswählen.
                </CardDescription>
              </div>
              <div className="grid size-9 place-items-center rounded-lg bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                <Plus className="size-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="drink-type">Getränk</Label>
                <div className="relative" ref={drinkDropdownRef}>
                  <button
                    aria-expanded={drinkMenuOpen}
                    aria-haspopup="listbox"
                    className="flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3 text-left text-sm shadow-sm outline-none transition-all hover:border-zinc-300 hover:bg-zinc-50/40 focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-100"
                    disabled={drinkOptions.length === 0}
                    id="drink-type"
                    onClick={toggleDrinkMenu}
                    type="button"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <SelectedDrinkIcon className="size-4 shrink-0 text-zinc-400" />
                      <span className="truncate font-medium text-zinc-800">
                        {drink?.name ?? "Drinks laden..."}
                      </span>
                      {drink && (
                        <span className="shrink-0 font-mono text-xs text-zinc-400">
                          {drink.abv.toFixed(1)}%
                        </span>
                      )}
                    </span>
                    <ChevronDown
                      className={[
                        "size-4 shrink-0 text-zinc-400 transition-transform duration-200",
                        drinkMenuOpen ? "rotate-180 text-sky-500" : "",
                      ].join(" ")}
                    />
                  </button>

                  {drinkMenuOpen && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-zinc-100 bg-white/95 shadow-[0_24px_70px_rgba(15,23,42,0.12)] ring-1 ring-zinc-950/5 backdrop-blur">
                      <div className="border-b border-zinc-100 p-2">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                          <input
                            aria-label="Drink suchen"
                            className="h-9 w-full rounded-md border border-zinc-100 bg-zinc-50/60 px-3 pl-9 text-sm text-zinc-800 outline-none transition-all placeholder:text-zinc-400 focus:border-sky-200 focus:bg-white focus:ring-2 focus:ring-sky-100"
                            onChange={(event) =>
                              setDrinkSearch(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                              }
                            }}
                            placeholder="Drink suchen..."
                            ref={drinkSearchRef}
                            type="search"
                            value={drinkSearch}
                          />
                        </div>
                      </div>
                      <div
                        aria-label="Getränk auswählen"
                        className="max-h-72 overflow-y-auto p-1"
                        role="listbox"
                      >
                        {filteredDrinkTypes.length > 0 ? (
                          filteredDrinkTypes.map((item) => {
                            const Icon = item.icon;
                            const isSelected = item.name === selectedDrink;

                            return (
                              <button
                                aria-selected={isSelected}
                                className={[
                                  "flex h-10 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm outline-none transition-colors",
                                  isSelected
                                    ? "bg-sky-50 text-sky-700"
                                    : "text-zinc-700 hover:bg-zinc-50",
                                ].join(" ")}
                                key={item.name}
                                onClick={() => {
                                  setSelectedDrink(item.name);
                                  setDrinkMenuOpen(false);
                                  setDrinkSearch("");
                                }}
                                role="option"
                                type="button"
                              >
                                <Icon
                                  className={[
                                    "size-4 shrink-0",
                                    isSelected
                                      ? "text-sky-500"
                                      : "text-zinc-400",
                                  ].join(" ")}
                                />
                                <span className="min-w-0 flex-1 truncate font-medium">
                                  {item.name}
                                </span>
                                <span className="shrink-0 font-mono text-xs text-zinc-400">
                                  {item.abv.toFixed(1)}%
                                </span>
                                {isSelected && (
                                  <Check className="size-3.5 shrink-0 text-sky-600" />
                                )}
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-3 py-6 text-center text-sm text-zinc-400">
                            Kein Drink gefunden.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Menge</Label>
                <div className="grid grid-cols-3 gap-2">
                  {volumeOptions.map((volume) => (
                    <Button
                      className={[
                        "h-10 rounded-lg border-zinc-200 shadow-sm",
                        selectedVolume === volume
                          ? "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50"
                          : "bg-white text-zinc-700 hover:bg-zinc-50",
                      ].join(" ")}
                      key={volume}
                      onClick={() => setSelectedVolume(volume)}
                      type="button"
                      variant="outline"
                    >
                      {volume} ml
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                <div className="space-y-2">
                  <Label htmlFor="drink-units">Units</Label>
                  <Input
                    className="h-11 rounded-lg border-zinc-200 bg-white text-sm shadow-sm focus-visible:border-sky-300 focus-visible:ring-2 focus-visible:ring-sky-100"
                    id="drink-units"
                    min={1}
                    onChange={(event) =>
                      setUnits(Math.max(1, Number(event.target.value) || 1))
                    }
                    type="number"
                    value={units}
                  />
                </div>
                <div className="rounded-lg border border-sky-100 bg-sky-50/70 px-3 py-2 text-right">
                  <p className="text-[11px] font-medium text-sky-700/70">
                    Reiner Alk
                  </p>
                  <p className="font-mono text-sm font-semibold text-sky-700">
                    {pureAlcohol.toFixed(1)} ml
                  </p>
                </div>
              </div>

              <Button
                className="h-11 w-full rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-sky-200"
                disabled={!accessToken || !drink?.id}
                type="submit"
              >
                Submitten
                <Send className="size-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <section className="space-y-3" aria-labelledby="events-title">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="events-title" className="text-base font-semibold">
                Heutige Systemereignisse
              </h2>
              <p className="text-sm text-zinc-500">Letzte 10 Submissions</p>
            </div>
            <Clock3 className="size-5 text-zinc-400" />
          </div>

          <div className="rounded-lg bg-white shadow-[0_18px_60px_rgba(15,23,42,0.05)] ring-1 ring-zinc-950/10">
            {submissions.length > 0 ? (
              submissions.map((entry, index) => {
                const Icon =
                  drinkOptions.find((item) => item.name === entry.drink)?.icon ??
                  Beer;

                return (
                  <div key={`${entry.person}-${entry.time}-${index}`}>
                    <div className="flex items-center gap-3 p-3">
                      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-zinc-50 text-zinc-500 ring-1 ring-zinc-100">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          <span className="font-semibold">{entry.person}</span>{" "}
                          submitted {entry.units}x {entry.volume} ml {entry.drink}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                          <span className="font-mono">{entry.time}</span>
                          <span>/</span>
                          <span className="font-mono text-sky-600">
                            {entry.alcohol.toFixed(1)} ml alk
                          </span>
                        </div>
                      </div>
                      <UserRound className="size-4 shrink-0 text-zinc-300" />
                    </div>
                    {index < submissions.length - 1 && (
                      <Separator className="bg-zinc-100" />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">
                Noch keine Submissions.
              </div>
            )}
          </div>
        </section>
      </div>

      <Dialog open={participantsOpen} onOpenChange={setParticipantsOpen}>
        <DialogContent className="max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-lg border-0 bg-white p-0 shadow-[0_24px_90px_rgba(15,23,42,0.16)] ring-1 ring-zinc-950/10 sm:max-w-2xl">
          <DialogHeader className="border-b border-zinc-100 p-4 pr-12">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                <Trophy className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg">Alle Beteiligten</DialogTitle>
                <DialogDescription>
                  Kumulative ml Alkohol, nur an Tagen mit Submissions.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[calc(100dvh-8.5rem)] overflow-y-auto p-3">
            <div className="space-y-2">
              {participantRows.length > 0 ? (
                participantRows.map((person) => {
                const isExpanded = expandedParticipant === person.name;
                const cumulativePoints = getCumulativePoints(person.days);

                return (
                  <div
                    className={[
                      "overflow-hidden rounded-lg border bg-white transition-colors",
                      isExpanded
                        ? "border-sky-100 shadow-[0_16px_45px_rgba(14,165,233,0.08)]"
                        : "border-zinc-100",
                    ].join(" ")}
                    key={person.name}
                  >
                    <button
                      aria-expanded={isExpanded}
                      className="flex w-full items-center gap-3 p-3 text-left outline-none transition-colors hover:bg-zinc-50/70 focus-visible:bg-sky-50/60"
                      onClick={() =>
                        setExpandedParticipant((current) =>
                          current === person.name ? null : person.name,
                        )
                      }
                      type="button"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-50 font-mono text-xs text-zinc-500 ring-1 ring-zinc-100">
                        #{person.rank}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-zinc-900">
                          {person.name}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">
                          Letzter Drink: {person.lastDrink ?? "noch keiner"}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block font-mono text-sm font-semibold text-sky-600">
                          {person.pureAlcoholMl} ml
                        </span>
                        <span className="block text-[11px] text-zinc-400">
                          gesamt
                        </span>
                      </span>
                      <ChevronDown
                        className={[
                          "size-4 shrink-0 text-zinc-400 transition-transform duration-200",
                          isExpanded ? "rotate-180 text-sky-500" : "",
                        ].join(" ")}
                      />
                    </button>

                    {isExpanded && (
                      <div className="border-t border-zinc-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-3">
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium text-zinc-500">
                              Verlauf
                            </p>
                            <p className="text-sm font-semibold">
                              Kumulativer Alkohol
                            </p>
                          </div>
                          <div className="flex items-center gap-1 rounded-lg bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-100">
                            <TrendingUp className="size-3.5" />
                            {cumulativePoints.at(-1)?.cumulative ?? 0} ml
                          </div>
                        </div>

                        <CumulativeLineChart points={cumulativePoints} />

                        <div className="mt-3 grid gap-1.5">
                          {cumulativePoints.map((point) => (
                            <div
                              className="flex items-center justify-between rounded-md bg-white px-2.5 py-2 text-xs ring-1 ring-zinc-100"
                              key={`${person.name}-${point.date}`}
                            >
                              <div>
                                <p className="font-medium text-zinc-800">
                                  {point.date}
                                </p>
                                <p className="text-zinc-400">
                                  {point.entries} Submissions
                                </p>
                              </div>
                              <div className="text-right font-mono">
                                <p className="text-sky-600">+{point.ml} ml</p>
                                <p className="text-zinc-400">
                                  {point.cumulative} ml
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
                })
              ) : (
                <div className="rounded-lg bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500 ring-1 ring-zinc-100">
                  Noch keine Teilnehmer mit Submissions.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function CumulativeLineChart({ points }: { points: CumulativePoint[] }) {
  if (points.length === 0) {
    return (
      <div className="rounded-lg bg-white px-4 py-8 text-center text-sm text-zinc-500 ring-1 ring-zinc-100">
        Noch kein Verlauf.
      </div>
    );
  }

  const width = 320;
  const height = 150;
  const paddingX = 18;
  const paddingY = 20;
  const maxValue = Math.max(...points.map((point) => point.cumulative), 1);
  const coords = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : paddingX +
          (index / (points.length - 1)) * (width - paddingX * 2);
    const y =
      height -
      paddingY -
      (point.cumulative / maxValue) * (height - paddingY * 2);

    return { ...point, x, y };
  });
  const linePath = coords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const firstPoint = coords[0];
  const lastPoint = coords.at(-1);
  const areaPath =
    firstPoint && lastPoint
      ? `${linePath} L ${lastPoint.x} ${height - paddingY} L ${firstPoint.x} ${
          height - paddingY
        } Z`
      : "";

  return (
    <div className="rounded-lg bg-white p-2 ring-1 ring-zinc-100">
      <svg
        aria-label="Kumulativer Alkohol Linechart"
        className="h-36 w-full overflow-visible"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <linearGradient id="ayri-chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((ratio) => {
          const y = paddingY + ratio * (height - paddingY * 2);

          return (
            <line
              key={ratio}
              stroke="#e4e4e7"
              strokeDasharray="4 5"
              strokeWidth="1"
              x1={paddingX}
              x2={width - paddingX}
              y1={y}
              y2={y}
            />
          );
        })}
        {areaPath && <path d={areaPath} fill="url(#ayri-chart-fill)" />}
        <path
          d={linePath}
          fill="none"
          stroke="#0ea5e9"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        {coords.map((point) => (
          <g key={`${point.date}-${point.cumulative}`}>
            <circle cx={point.x} cy={point.y} fill="#ffffff" r="4.5" />
            <circle cx={point.x} cy={point.y} fill="#0ea5e9" r="2.8" />
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between gap-1 text-[10px] text-zinc-400">
        {coords.map((point) => (
          <span className="min-w-0 truncate" key={point.date}>
            {point.date}
          </span>
        ))}
      </div>
    </div>
  );
}
